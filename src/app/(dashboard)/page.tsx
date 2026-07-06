import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { pollAllSystems } from "@/lib/systems";
import { homeFor } from "@/lib/roles";
import SystemTiles, { TileSystem, TileState } from "@/components/SystemTiles";
import { ssoSecretFor } from "@/lib/sso";

// The launcher polls every enabled system's health (and KPI summary) on render
// so the first paint already shows status + numbers, then the client component
// re-polls every 30s.
export const dynamic = "force-dynamic";

export default async function LauncherPage() {
  // Role-based landing: Site Officers and Storekeepers go straight to their
  // own dashboards; executives and drivers keep the launcher as home.
  const session = await getSession();
  if (session) {
    const home = homeFor(session.role);
    if (home !== "/") redirect(home);
  }

  const enabled = await prisma.system.count({ where: { enabled: true } });

  let systems: TileSystem[] = [];
  const initial: Record<string, TileState> = {};

  if (enabled > 0) {
    const results = await pollAllSystems();
    systems = results.map((r) => ({
      key: r.system.key,
      name: r.system.name,
      description: r.system.description,
      icon: r.system.icon,
      openUrl: r.system.openUrl,
      // With an SSO secret configured, open through /launch/<key> so the user
      // arrives already signed in; otherwise plain link (old behaviour).
      launchUrl: ssoSecretFor(r.system.key) ? `/launch/${r.system.key}` : r.system.openUrl,
    }));
    for (const r of results) {
      initial[r.system.key] = {
        ok: r.status.ok,
        latencyMs: r.status.latencyMs,
        detail: r.status.detail,
        kpis: r.kpis ?? null,
        kpisAt: r.kpisAt,
        kpisStale: r.kpisStale,
      };
    }
  }

  if (systems.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
        <h1 className="text-lg font-semibold mb-1">No systems registered yet</h1>
        <p className="text-sm text-muted">
          Run <code className="text-foreground">npm run seed</code> to register the four E&amp;C systems.
        </p>
      </div>
    );
  }

  return <SystemTiles systems={systems} initial={initial} />;
}
