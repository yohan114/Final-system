import { prisma } from "./db";
import { snapshotFromPayload } from "./systems";

// Portal alerts feed: turns the StatusSample health history into a prioritised
// list. A system that failed its most recent poll is an alert; it escalates to
// critical once it has been unreachable for longer than DOWN_CRITICAL_MS
// (measured from the last successful poll, or the oldest sample we have).
// Each system also reports its newest on-disk backup with its KPI summary;
// a missing or old backup raises a staleness alert (warning after 48 h,
// critical after 7 days — an untested backup is a time bomb).

const DOWN_CRITICAL_MS = 5 * 60 * 1000; // 5 minutes
const BACKUP_WARN_MS = 48 * 60 * 60 * 1000; // 48 hours
const BACKUP_CRITICAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

  // Backup staleness — read each system's latest reported snapshot. Systems
  // that predate backup reporting (legacy array payloads) are skipped.
  for (const sys of systems) {
    const latest = await prisma.kpiSnapshot.findFirst({
      where: { systemId: sys.id },
      orderBy: { at: "desc" },
    });
    if (!latest) continue;
    const snapshot = snapshotFromPayload(latest.payload);
    if (!snapshot || snapshot.lastBackupAt === undefined) continue;

    if (snapshot.lastBackupAt === null) {
      alerts.push({
        systemKey: sys.key,
        systemName: sys.name,
        severity: "warning",
        title: `${sys.name} has no backup`,
        detail: "The system reports no backup snapshot on disk — schedule its backup job.",
        since: null,
      });
      continue;
    }

    const ageMs = now - new Date(snapshot.lastBackupAt).getTime();
    if (ageMs < BACKUP_WARN_MS) continue;
    const hours = Math.round(ageMs / 3600000);
    const days = Math.floor(hours / 24);
    alerts.push({
      systemKey: sys.key,
      systemName: sys.name,
      severity: ageMs >= BACKUP_CRITICAL_MS ? "critical" : "warning",
      title: `${sys.name} backup is stale`,
      detail: `Newest backup is ${days >= 2 ? `${days} days` : `${hours} hours`} old — check the backup job.`,
      since: snapshot.lastBackupAt,
    });
  }

  // Critical first, then by longest outage.
  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return (a.since ?? "").localeCompare(b.since ?? "");
  });
}
