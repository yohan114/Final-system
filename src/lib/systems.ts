import { prisma } from "./db";

export interface SystemStatus {
  ok: boolean;
  latencyMs: number | null;
  detail: string | null;
  checkedAt: string;
}

export interface Kpi {
  label: string;
  value: string | number;
  tone?: "good" | "warn" | "bad" | "neutral";
  // Optional path within the owning system that this KPI drills into. The
  // portal composes openUrl + href so the link opens in that system (where the
  // user signs in). Absent/empty → the whole system links to its app root.
  href?: string;
}

// Read one system's KPI summary. Server-to-server with the per-system token
// (from tokenEnv); a 4s timeout so a slow system can't stall the launcher.
// Returns null when the token isn't configured yet or the read fails.
async function fetchSummary(sys: {
  baseUrl: string;
  summaryPath: string;
  tokenEnv: string | null;
}): Promise<Kpi[] | null> {
  if (!sys.summaryPath || !sys.tokenEnv) return null;
  const token = process.env[sys.tokenEnv];
  if (!token) return null;
  const url = `${sys.baseUrl.replace(/\/$/, "")}${sys.summaryPath}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "x-portal-token": token },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.kpis)) return null;
    return data.kpis.slice(0, 4) as Kpi[];
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Poll one system's health endpoint, server-to-server, with a hard timeout so a
// hung system can never block the launcher. Never throws — a failure is just a
// down status.
export async function checkHealth(baseUrl: string, healthPath: string): Promise<SystemStatus> {
  const url = `${baseUrl.replace(/\/$/, "")}${healthPath}`;
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    const latencyMs = Date.now() - started;
    const ok = res.ok;
    let detail: string | null = null;
    if (!ok) detail = `HTTP ${res.status}`;
    return { ok, latencyMs, detail, checkedAt: new Date().toISOString() };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const detail = err instanceof Error && err.name === "AbortError" ? "timeout" : "unreachable";
    return { ok: false, latencyMs, detail, checkedAt: new Date().toISOString() };
  } finally {
    clearTimeout(timeout);
  }
}

// Check every enabled system: persist a StatusSample, and when it's up (and a
// token is configured) fetch its KPI summary and persist a KpiSnapshot. KPIs
// for display fall back to the latest stored snapshot (last-known-good) so the
// tiles keep showing numbers through a brief outage.
export async function pollAllSystems() {
  const systems = await prisma.system.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
  });

  const results = await Promise.all(
    systems.map(async (sys) => {
      const status = await checkHealth(sys.baseUrl, sys.healthPath);
      await prisma.statusSample.create({
        data: {
          systemId: sys.id,
          ok: status.ok,
          latencyMs: status.latencyMs ?? undefined,
          detail: status.detail ?? undefined,
        },
      });

      let kpis: Kpi[] | null = null;
      let kpisAt: string | null = null;
      let kpisStale = false;

      if (status.ok) {
        kpis = await fetchSummary(sys);
        if (kpis) {
          const snap = await prisma.kpiSnapshot.create({
            data: { systemId: sys.id, payload: JSON.stringify(kpis) },
          });
          kpisAt = snap.at.toISOString();
        }
      }

      // Fall back to the last good snapshot when this poll produced none.
      if (!kpis) {
        const latest = await prisma.kpiSnapshot.findFirst({
          where: { systemId: sys.id },
          orderBy: { at: "desc" },
        });
        if (latest) {
          try {
            kpis = JSON.parse(latest.payload) as Kpi[];
            kpisAt = latest.at.toISOString();
            kpisStale = true;
          } catch {
            kpis = null;
          }
        }
      }

      return { system: sys, status, kpis, kpisAt, kpisStale };
    })
  );

  return results;
}

// Recent samples for a system's uptime strip (newest first).
export async function recentSamples(systemId: string, limit = 24) {
  return prisma.statusSample.findMany({
    where: { systemId },
    orderBy: { at: "desc" },
    take: limit,
  });
}
