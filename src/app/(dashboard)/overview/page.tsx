import { prisma } from "@/lib/db";
import { pollAllSystems, Kpi } from "@/lib/systems";
import { BarChart3, ArrowUpRight, ExternalLink, CircleAlert } from "lucide-react";

// Executive overview — the company-wide KPI wall. Every figure comes from a
// single system's /api/portal/summary; each drills into the owning system.
// No cross-system sums yet — that needs the master-data spine (M4).
export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  good: "text-emerald-400",
  warn: "text-amber-400",
  bad: "text-red-400",
  neutral: "text-foreground",
};

function deepLink(openUrl: string, href?: string): string | null {
  if (!href) return null;
  return `${openUrl.replace(/\/$/, "")}${href.startsWith("/") ? href : `/${href}`}`;
}

function KpiCard({ kpi, openUrl }: { kpi: Kpi; openUrl: string }) {
  const link = deepLink(openUrl, kpi.href);
  const inner = (
    <>
      <div className={`text-2xl font-semibold leading-tight ${TONE[kpi.tone || "neutral"]}`}>
        {kpi.value}
      </div>
      <div className="text-xs text-muted mt-1 leading-tight flex items-center gap-1">
        {kpi.label}
        {link && <ArrowUpRight className="w-3 h-3 opacity-60" />}
      </div>
    </>
  );
  const base = "bg-white/5 rounded-xl px-4 py-3.5 block";
  return link ? (
    <a href={link} target="_blank" rel="noreferrer" className={`${base} hover:bg-white/10 transition-colors`}>
      {inner}
    </a>
  ) : (
    <div className={base}>{inner}</div>
  );
}

export default async function OverviewPage() {
  const enabled = await prisma.system.count({ where: { enabled: true } });
  const results = enabled > 0 ? await pollAllSystems() : [];

  const upCount = results.filter((r) => r.status.ok).length;
  const total = results.length;
  const needsAttention = results
    .flatMap((r) => r.kpis ?? [])
    .filter((k) => k.tone === "warn" || k.tone === "bad").length;
  const now = new Date();

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-accent" />
          <div>
            <h1 className="text-xl font-semibold">Executive overview</h1>
            <p className="text-sm text-muted">
              Company-wide, as of {now.toLocaleString()} · figures are per-system
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-card border border-card-border rounded-xl px-4 py-2 text-center">
            <div className="text-lg font-semibold">
              {upCount}
              <span className="text-muted text-sm">/{total}</span>
            </div>
            <div className="text-[11px] text-muted">Systems up</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl px-4 py-2 text-center">
            <div className={`text-lg font-semibold ${needsAttention > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {needsAttention}
            </div>
            <div className="text-[11px] text-muted">Need attention</div>
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="bg-card border border-card-border rounded-2xl p-8 text-center text-sm text-muted">
          No systems registered. Run <code className="text-foreground">npm run seed</code>.
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((r) => {
            const kpis = r.kpis ?? [];
            return (
              <section key={r.system.key} className="bg-card border border-card-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${r.status.ok ? "bg-emerald-400" : "bg-red-400"}`} />
                    <h2 className="font-semibold">{r.system.name}</h2>
                    {!r.status.ok && (
                      <span className="text-xs text-red-400 flex items-center gap-1">
                        <CircleAlert className="w-3.5 h-3.5" />
                        {r.status.detail || "down"}
                        {r.kpisStale && kpis.length > 0 ? " · showing last known good" : ""}
                      </span>
                    )}
                  </div>
                  <a
                    href={r.system.openUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-muted hover:text-foreground flex items-center gap-1.5"
                  >
                    Open {r.system.name} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {kpis.length > 0 ? (
                  <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                    {kpis.map((k, i) => (
                      <KpiCard key={i} kpi={k} openUrl={r.system.openUrl} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    {r.status.ok
                      ? "No KPIs — set this system's PORTAL_TOKEN and the portal's matching token to enable the read."
                      : "No data available while the system is unreachable."}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted mt-6">
        Figures are per-system and link into the owning system for drill-down. Company-wide totals and
        profit per site / machine arrive with the master-data spine (M4) and the cost engine (M5).
      </p>
    </div>
  );
}
