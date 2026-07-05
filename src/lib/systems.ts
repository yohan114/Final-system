import { prisma } from "./db";

export interface SystemStatus {
  ok: boolean;
  latencyMs: number | null;
  detail: string | null;
  checkedAt: string;
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

// Check every enabled system and persist a StatusSample for each. Returns the
// systems with their live status attached.
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
      return { system: sys, status };
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
