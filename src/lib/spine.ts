import { prisma } from "./db";

// The master-data spine: pull machines + sites from every enabled system and
// map them onto canonical identities. Machines auto-match by E&C code; sites
// auto-match by normalized name. Entities with no matchable key (serial/plate
// codes, free-text names) stay unlinked for manual mapping. Read-only toward
// the systems — this only writes the portal's own mapping tables.

export function normCode(s: string | null | undefined): string {
  return String(s ?? "").toUpperCase().replace(/\s+/g, " ").trim();
}

interface EntityIn {
  localId: string;
  code?: string;
  name?: string;
  label?: string;
  registration?: string;
  serialNo?: string;
  status?: string;
  condition?: string;
}

interface EntitiesPayload {
  machines?: EntityIn[];
  sites?: EntityIn[];
}

async function fetchEntities(sys: {
  baseUrl: string;
  tokenEnv: string | null;
}): Promise<EntitiesPayload | null> {
  if (!sys.tokenEnv) return null;
  const token = process.env[sys.tokenEnv];
  if (!token) return null;
  const url = `${sys.baseUrl.replace(/\/$/, "")}/api/portal/entities`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "x-portal-token": token },
    });
    if (!res.ok) return null;
    return (await res.json()) as EntitiesPayload;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface SyncReport {
  at: string;
  systems: { key: string; ok: boolean; machines: number; sites: number }[];
  machinesMatched: number;
  machinesUnmatched: number;
  sitesMatched: number;
  sitesUnmatched: number;
  canonicalMachines: number;
  canonicalSites: number;
}

export async function syncSpine(): Promise<SyncReport> {
  const systems = await prisma.system.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
  });

  const report: SyncReport = {
    at: new Date().toISOString(),
    systems: [],
    machinesMatched: 0,
    machinesUnmatched: 0,
    sitesMatched: 0,
    sitesUnmatched: 0,
    canonicalMachines: 0,
    canonicalSites: 0,
  };

  for (const sys of systems) {
    const data = await fetchEntities(sys);
    if (!data) {
      report.systems.push({ key: sys.key, ok: false, machines: 0, sites: 0 });
      continue;
    }

    const machines = data.machines ?? [];
    const sites = data.sites ?? [];

    for (const m of machines) {
      const code = normCode(m.code);
      let machineId: string | null = null;
      let matchType: string | null = null;

      if (code) {
        const canon = await prisma.machineMap.upsert({
          where: { canonicalCode: code },
          update: { label: m.label ?? undefined },
          create: { canonicalCode: code, label: m.label ?? code },
        });
        machineId = canon.id;
        matchType = "auto-code";
      }

      const extra = JSON.stringify({
        registration: m.registration,
        serialNo: m.serialNo,
        status: m.status,
        condition: m.condition,
      });

      // Preserve a manual link across re-syncs.
      const existing = await prisma.systemEntity.findUnique({
        where: { systemKey_kind_localId: { systemKey: sys.key, kind: "machine", localId: m.localId } },
      });
      const keepManual = existing?.matchType === "manual";

      await prisma.systemEntity.upsert({
        where: { systemKey_kind_localId: { systemKey: sys.key, kind: "machine", localId: m.localId } },
        update: {
          code: m.code ?? undefined,
          label: m.label ?? undefined,
          extra,
          syncedAt: new Date(),
          ...(keepManual ? {} : { machineId, matchType }),
        },
        create: {
          systemKey: sys.key,
          kind: "machine",
          localId: m.localId,
          code: m.code ?? undefined,
          label: m.label ?? undefined,
          extra,
          machineId,
          matchType,
        },
      });

      if (machineId || keepManual) report.machinesMatched++;
      else report.machinesUnmatched++;
    }

    for (const s of sites) {
      const key = normCode(s.name ?? s.code);
      let siteId: string | null = null;
      let matchType: string | null = null;
      if (key) {
        const canon = await prisma.siteMap.upsert({
          where: { canonicalKey: key },
          update: { label: s.name ?? undefined },
          create: { canonicalKey: key, label: s.name ?? key },
        });
        siteId = canon.id;
        matchType = "auto-name";
      }

      const existing = await prisma.systemEntity.findUnique({
        where: { systemKey_kind_localId: { systemKey: sys.key, kind: "site", localId: s.localId } },
      });
      const keepManual = existing?.matchType === "manual";

      await prisma.systemEntity.upsert({
        where: { systemKey_kind_localId: { systemKey: sys.key, kind: "site", localId: s.localId } },
        update: {
          code: s.code ?? undefined,
          label: s.name ?? undefined,
          syncedAt: new Date(),
          ...(keepManual ? {} : { siteId, matchType }),
        },
        create: {
          systemKey: sys.key,
          kind: "site",
          localId: s.localId,
          code: s.code ?? undefined,
          label: s.name ?? undefined,
          siteId,
          matchType,
        },
      });

      if (siteId || keepManual) report.sitesMatched++;
      else report.sitesUnmatched++;
    }

    report.systems.push({ key: sys.key, ok: true, machines: machines.length, sites: sites.length });
  }

  report.canonicalMachines = await prisma.machineMap.count();
  report.canonicalSites = await prisma.siteMap.count();
  return report;
}

// Manually link an unmatched machine entity to a canonical machine (creating the
// canonical if needed). Marks the link manual so re-syncs preserve it.
export async function linkMachineEntity(entityId: string, canonicalCode: string) {
  const code = normCode(canonicalCode);
  if (!code) throw new Error("A canonical E&C code is required");
  const entity = await prisma.systemEntity.findUnique({ where: { id: entityId } });
  if (!entity || entity.kind !== "machine") throw new Error("Machine entity not found");
  const canon = await prisma.machineMap.upsert({
    where: { canonicalCode: code },
    update: {},
    create: { canonicalCode: code, label: entity.label ?? code },
  });
  await prisma.systemEntity.update({
    where: { id: entityId },
    data: { machineId: canon.id, matchType: "manual" },
  });
  return canon;
}

export async function unlinkMachineEntity(entityId: string) {
  await prisma.systemEntity.update({
    where: { id: entityId },
    data: { machineId: null, matchType: null },
  });
}

// Fuzzy suggestions for an unmatched entity: canonical machines whose code or
// label shares a token with the entity's label/serial. Cheap substring scoring.
export async function suggestMatches(entity: { label?: string | null; code?: string | null; extra?: string | null }, limit = 5) {
  const hay = normCode([entity.label, entity.code].filter(Boolean).join(" "));
  let serial = "";
  try {
    serial = normCode(JSON.parse(entity.extra ?? "{}").serialNo ?? "");
  } catch {
    /* ignore */
  }
  if (!hay && !serial) return [];
  const candidates = await prisma.machineMap.findMany({ take: 500 });
  const scored = candidates
    .map((c) => {
      const code = normCode(c.canonicalCode);
      const label = normCode(c.label);
      let score = 0;
      if (serial && (code.includes(serial) || label.includes(serial))) score += 3;
      for (const tok of hay.split(" ").filter((t) => t.length >= 3)) {
        if (code.includes(tok) || label.includes(tok)) score += 1;
      }
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((x) => x.c);
}
