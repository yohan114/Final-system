import { prisma } from "./db";

// Portal alerts feed: turns the StatusSample health history into a prioritised
// list. A system that failed its most recent poll is an alert; it escalates to
// critical once it has been unreachable for longer than DOWN_CRITICAL_MS
// (measured from the last successful poll, or the oldest sample we have).

const DOWN_CRITICAL_MS = 5 * 60 * 1000; // 5 minutes

export interface Alert {
  systemKey: string;
  systemName: string;
  severity: "critical" | "warning";
  title: string;
  detail: string;
  since: string | null;
}

export async function computeAlerts(): Promise<Alert[]> {
  const systems = await prisma.system.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
  });

  const alerts: Alert[] = [];
  const now = Date.now();

  for (const sys of systems) {
    const recent = await prisma.statusSample.findMany({
      where: { systemId: sys.id },
      orderBy: { at: "desc" },
      take: 30,
    });
    if (recent.length === 0 || recent[0].ok) continue;

    // Most recent poll failed. Find the last time it was up.
    const lastOk = recent.find((s) => s.ok);
    const downSince = lastOk ? lastOk.at : recent[recent.length - 1].at;
    const downMs = now - downSince.getTime();
    const severity: Alert["severity"] = downMs >= DOWN_CRITICAL_MS ? "critical" : "warning";

    const mins = Math.max(1, Math.round(downMs / 60000));
    alerts.push({
      systemKey: sys.key,
      systemName: sys.name,
      severity,
      title: `${sys.name} is unreachable`,
      detail: `${recent[0].detail || "down"} — no successful health check for ~${mins} min`,
      since: downSince.toISOString(),
    });
  }

  // Critical first, then by longest outage.
  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return (a.since ?? "").localeCompare(b.since ?? "");
  });
}
