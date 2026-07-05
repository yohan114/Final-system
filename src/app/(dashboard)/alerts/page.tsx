import { prisma } from "@/lib/db";
import { pollAllSystems } from "@/lib/systems";
import { computeAlerts } from "@/lib/alerts";
import DigestButton from "@/components/DigestButton";
import { ShieldCheck, TriangleAlert, CircleAlert, Mail } from "lucide-react";

// Fresh-poll on load so the feed reflects current state, then roll the health
// history into alerts.
export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  await pollAllSystems();
  const alerts = await computeAlerts();
  const digests = await prisma.outbox.findMany({
    where: { kind: "alert-digest" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <TriangleAlert className="w-6 h-6 text-accent" />
          <div>
            <h1 className="text-xl font-semibold">Alerts</h1>
            <p className="text-sm text-muted">
              {alerts.length === 0 ? "No active alerts" : `${alerts.length} active`}
            </p>
          </div>
        </div>
        <DigestButton />
      </div>

      {alerts.length === 0 ? (
        <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
          <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-muted">All systems reachable. Nothing needs attention.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const crit = a.severity === "critical";
            return (
              <div
                key={a.systemKey}
                className={`rounded-2xl p-4 border flex items-start gap-3 ${
                  crit
                    ? "bg-red-500/10 border-red-500/25"
                    : "bg-amber-500/10 border-amber-500/25"
                }`}
              >
                <CircleAlert className={`w-5 h-5 mt-0.5 flex-shrink-0 ${crit ? "text-red-400" : "text-amber-400"}`} />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{a.title}</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-md uppercase tracking-wide ${
                        crit ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {a.severity}
                    </span>
                  </div>
                  <p className="text-sm text-muted mt-0.5">{a.detail}</p>
                  {a.since && (
                    <p className="text-[11px] text-muted mt-1">Since {new Date(a.since).toLocaleString()}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {digests.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Recent digests</h2>
          <div className="bg-card border border-card-border rounded-2xl divide-y divide-card-border/50">
            {digests.map((d) => (
              <div key={d.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-muted flex-shrink-0" />
                <span className="flex-1 truncate">{d.subject}</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-md ${
                    d.status === "sent"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : d.status === "failed"
                        ? "bg-red-500/20 text-red-300"
                        : "bg-white/10 text-muted"
                  }`}
                >
                  {d.status}
                </span>
                <span className="text-[11px] text-muted whitespace-nowrap">
                  {new Date(d.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted mt-6">
        A system escalates to <span className="text-red-400">critical</span> after ~5 minutes with no successful
        health check. The <span className="text-foreground">Send digest now</span> button (and the{" "}
        <code className="text-foreground">/api/cron/alert-digest</code> endpoint) emails this feed; without SMTP
        configured the digest is recorded as <em>simulated</em>.
      </p>
    </div>
  );
}
