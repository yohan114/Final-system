import { prisma } from "@/lib/db";
import { pollAllSystems } from "@/lib/systems";
import SystemTiles, { TileSystem, TileStatus } from "@/components/SystemTiles";

// The launcher polls every enabled system's health on render so the first paint
// already shows up/down, then the client component re-polls every 30s.
export const dynamic = "force-dynamic";

export default async function LauncherPage() {
  const enabled = await prisma.system.count({ where: { enabled: true } });

  let systems: TileSystem[] = [];
  const initial: Record<string, TileStatus> = {};

  if (enabled > 0) {
    const results = await pollAllSystems();
    systems = results.map((r) => ({
      key: r.system.key,
      name: r.system.name,
      description: r.system.description,
      icon: r.system.icon,
      openUrl: r.system.openUrl,
    }));
    for (const r of results) {
      initial[r.system.key] = {
        ok: r.status.ok,
        latencyMs: r.status.latencyMs,
        detail: r.status.detail,
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
