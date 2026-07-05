import { prisma } from "./db";
import { normCode } from "./spine";

// Pull each system's month-scoped cost + income events and fold them into the
// CostEvent ledger, linked to canonical machines (by E&C code) and sites (by
// name). Idempotent on (systemKey, sourceRef): re-ingesting a month refreshes
// amounts without duplicating. Canonicals are upserted from the codes/names
// here too, so profit works even before a full spine sync.

interface CostRow {
  sourceRef: string;
  machineCode?: string | null;
  siteRef?: string | null;
  category?: string;
  qty?: number;
  amountCents: number;
  occurredAt: string;
}

interface CostsPayload {
  costs?: CostRow[];
  income?: CostRow[];
}

async function fetchCosts(
  sys: { baseUrl: string; tokenEnv: string | null },
  month: string
): Promise<CostsPayload | null> {
  if (!sys.tokenEnv) return null;
  const token = process.env[sys.tokenEnv];
  if (!token) return null;
  const url = `${sys.baseUrl.replace(/\/$/, "")}/api/portal/costs?month=${encodeURIComponent(month)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "x-portal-token": token },
    });
    if (!res.ok) return null;
    return (await res.json()) as CostsPayload;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface IngestReport {
  month: string;
  systems: { key: string; ok: boolean; costs: number; income: number }[];
  costEvents: number;
  incomeEvents: number;
  unattributedMachine: number;
  unattributedSite: number;
}

export async function ingestCosts(month: string): Promise<IngestReport> {
  const systems = await prisma.system.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
  });

  const report: IngestReport = {
    month,
    systems: [],
    costEvents: 0,
    incomeEvents: 0,
    unattributedMachine: 0,
    unattributedSite: 0,
  };

  // Resolve (and create) canonicals so cost data alone can attribute.
  const machineCache = new Map<string, string>();
  const siteCache = new Map<string, string>();

  async function machineIdFor(code: string): Promise<string> {
    const cached = machineCache.get(code);
    if (cached) return cached;
    const canon = await prisma.machineMap.upsert({
      where: { canonicalCode: code },
      update: {},
      create: { canonicalCode: code, label: code },
    });
    machineCache.set(code, canon.id);
    return canon.id;
  }
  async function siteIdFor(key: string, label: string): Promise<string> {
    const cached = siteCache.get(key);
    if (cached) return cached;
    const canon = await prisma.siteMap.upsert({
      where: { canonicalKey: key },
      update: {},
      create: { canonicalKey: key, label },
    });
    siteCache.set(key, canon.id);
    return canon.id;
  }

  for (const sys of systems) {
    const data = await fetchCosts(sys, month);
    if (!data) {
      report.systems.push({ key: sys.key, ok: false, costs: 0, income: 0 });
      continue;
    }
    const groups: [CostRow[], string][] = [
      [data.costs ?? [], "cost"],
      [data.income ?? [], "income"],
    ];

    for (const [rows, kind] of groups) {
      for (const r of rows) {
        const code = normCode(r.machineCode);
        const siteKey = normCode(r.siteRef);
        const machineId = code ? await machineIdFor(code) : null;
        const siteId = siteKey ? await siteIdFor(siteKey, r.siteRef ?? siteKey) : null;
        if (!machineId) report.unattributedMachine++;
        if (!siteId) report.unattributedSite++;

        await prisma.costEvent.upsert({
          where: { systemKey_sourceRef: { systemKey: sys.key, sourceRef: r.sourceRef } },
          update: {
            kind,
            category: kind === "income" ? "income" : r.category ?? "other",
            month,
            occurredAt: new Date(r.occurredAt),
            machineCode: r.machineCode ?? undefined,
            siteRef: r.siteRef ?? undefined,
            qty: r.qty ?? undefined,
            amountCents: r.amountCents,
            machineId,
            siteId,
          },
          create: {
            systemKey: sys.key,
            sourceRef: r.sourceRef,
            kind,
            category: kind === "income" ? "income" : r.category ?? "other",
            month,
            occurredAt: new Date(r.occurredAt),
            machineCode: r.machineCode ?? undefined,
            siteRef: r.siteRef ?? undefined,
            qty: r.qty ?? undefined,
            amountCents: r.amountCents,
            machineId,
            siteId,
          },
        });
      }
    }

    report.systems.push({
      key: sys.key,
      ok: true,
      costs: (data.costs ?? []).length,
      income: (data.income ?? []).length,
    });
    report.costEvents += (data.costs ?? []).length;
    report.incomeEvents += (data.income ?? []).length;
  }

  return report;
}

export const COST_CATEGORIES = ["fuel", "parts", "labour", "oil", "other"] as const;

export interface PnlRow {
  key: string; // siteId or machineId, or "unattributed"
  label: string;
  income: number;
  cost: number;
  byCategory: Record<string, number>;
  profit: number;
}

// Roll the ledger for a month into per-site and per-machine P/L.
export async function profitForMonth(month: string) {
  const events = await prisma.costEvent.findMany({
    where: { month },
    include: {
      site: { select: { label: true, canonicalKey: true } },
      machine: { select: { label: true, canonicalCode: true } },
    },
  });

  function roll(dim: "site" | "machine"): PnlRow[] {
    const map = new Map<string, PnlRow>();
    for (const e of events) {
      const id = dim === "site" ? e.siteId : e.machineId;
      const key = id ?? "unattributed";
      const label =
        dim === "site"
          ? e.site?.label ?? "Unattributed"
          : e.machine?.canonicalCode ?? "Unattributed";
      if (!map.has(key)) {
        map.set(key, { key, label, income: 0, cost: 0, byCategory: {}, profit: 0 });
      }
      const row = map.get(key)!;
      if (e.kind === "income") {
        row.income += e.amountCents;
      } else {
        row.cost += e.amountCents;
        row.byCategory[e.category] = (row.byCategory[e.category] ?? 0) + e.amountCents;
      }
    }
    for (const row of map.values()) row.profit = row.income - row.cost;
    return [...map.values()].sort((a, b) => {
      if (a.key === "unattributed") return 1;
      if (b.key === "unattributed") return -1;
      return b.income - a.income || b.cost - a.cost;
    });
  }

  const bySite = roll("site");
  const byMachine = roll("machine");
  const totals = {
    income: events.filter((e) => e.kind === "income").reduce((s, e) => s + e.amountCents, 0),
    cost: events.filter((e) => e.kind === "cost").reduce((s, e) => s + e.amountCents, 0),
  };
  return { bySite, byMachine, totals, eventCount: events.length };
}

export async function availableMonths(): Promise<string[]> {
  const rows = await prisma.costEvent.findMany({
    distinct: ["month"],
    select: { month: true },
    orderBy: { month: "desc" },
  });
  return rows.map((r) => r.month);
}
