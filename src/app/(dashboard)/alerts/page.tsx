import { pollAllSystems } from "@/lib/systems";
import { computeAlerts } from "@/lib/alerts";
import { ShieldCheck, TriangleAlert, CircleAlert } from "lucide-react";

// Fresh-poll on load so the feed reflects current state, then roll the health
// history into alerts.
export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  await pollAllSystems();
  const alerts = await computeAlerts();

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <TriangleAlert className="w-6 h-6 text-accent" />
        <div>
          <h1 className="text-xl font-semibold">Alerts</h1>
          <p className="text-sm text-muted">
            {alerts.length === 0 ? "No active alerts" : `${alerts.length} active`}
          </p>
        </div>
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

      <p className="text-xs text-muted mt-6">
        A system escalates to <span className="text-red-400">critical</span> after ~5 minutes with no successful
        health check. Backup-staleness alerts arrive once each system reports its last backup time (M7).
      </p>
    </div>
  );
}
