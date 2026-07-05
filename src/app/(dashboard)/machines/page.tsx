import Link from "next/link";
import { prisma } from "@/lib/db";
import SyncButton from "@/components/SyncButton";
import { Cpu, TriangleAlert } from "lucide-react";

export const dynamic = "force-dynamic";

const SYS: Record<string, { short: string; cls: string }> = {
  fuel: { short: "Fuel", cls: "bg-blue-500/20 text-blue-300" },
  mainstores: { short: "Stores", cls: "bg-violet-500/20 text-violet-300" },
  workshop: { short: "Workshop", cls: "bg-amber-500/20 text-amber-300" },
  oilbook: { short: "Oil", cls: "bg-emerald-500/20 text-emerald-300" },
};

export default async function MachinesPage() {
  const machines = await prisma.machineMap.findMany({
    orderBy: { canonicalCode: "asc" },
    include: { entities: { where: { kind: "machine" }, select: { systemKey: true } } },
  });
  const unmapped = await prisma.systemEntity.count({ where: { kind: "machine", machineId: null } });

  const multiSystem = machines.filter(
    (m) => new Set(m.entities.map((e) => e.systemKey)).size >= 2
  ).length;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <Cpu className="w-6 h-6 text-accent" />
          <div>
            <h1 className="text-xl font-semibold">Machines</h1>
            <p className="text-sm text-muted">
              {machines.length} canonical · {multiSystem} known to 2+ systems
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {unmapped > 0 && (
            <Link
              href="/admin/mappings"
              className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1.5"
            >
              <TriangleAlert className="w-4 h-4" /> {unmapped} unmapped
            </Link>
          )}
          <SyncButton />
        </div>
      </div>

      {machines.length === 0 ? (
        <div className="bg-card border border-card-border rounded-2xl p-8 text-center text-sm text-muted">
          No machines yet. Click <span className="text-foreground font-medium">Sync from systems</span> to pull
          fleet identities from each system and match them by E&amp;C code.
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-card-border">
                  <th className="px-4 py-3 font-medium">E&amp;C code</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Known to</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => {
                  const present = new Set(m.entities.map((e) => e.systemKey));
                  return (
                    <tr key={m.id} className="border-b border-card-border/50 hover:bg-white/5">
                      <td className="px-4 py-3">
                        <Link href={`/machines/${encodeURIComponent(m.canonicalCode)}`} className="font-mono text-accent hover:underline">
                          {m.canonicalCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{m.label || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {Object.keys(SYS).map((k) =>
                            present.has(k) ? (
                              <span key={k} className={`text-[11px] px-2 py-0.5 rounded-md ${SYS[k].cls}`}>
                                {SYS[k].short}
                              </span>
                            ) : null
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
