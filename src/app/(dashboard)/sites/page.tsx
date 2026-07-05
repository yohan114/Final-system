import { prisma } from "@/lib/db";
import { MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

const SYS: Record<string, { short: string; cls: string }> = {
  fuel: { short: "Fuel", cls: "bg-blue-500/20 text-blue-300" },
  mainstores: { short: "Stores", cls: "bg-violet-500/20 text-violet-300" },
  workshop: { short: "Workshop", cls: "bg-amber-500/20 text-amber-300" },
  oilbook: { short: "Oil", cls: "bg-emerald-500/20 text-emerald-300" },
};

export default async function SitesPage() {
  const sites = await prisma.siteMap.findMany({
    orderBy: { canonicalKey: "asc" },
    include: { entities: { where: { kind: "site" }, select: { systemKey: true } } },
  });
  const multi = sites.filter((s) => new Set(s.entities.map((e) => e.systemKey)).size >= 2).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <MapPin className="w-6 h-6 text-accent" />
        <div>
          <h1 className="text-xl font-semibold">Sites &amp; projects</h1>
          <p className="text-sm text-muted">
            {sites.length} canonical · {multi} shared across 2+ systems
          </p>
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="bg-card border border-card-border rounded-2xl p-8 text-center text-sm text-muted">
          No sites yet. Sync the spine from the Machines page to pull sites from each system.
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-card-border">
                  <th className="px-4 py-3 font-medium">Site</th>
                  <th className="px-4 py-3 font-medium">Known to</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => {
                  const present = new Set(s.entities.map((e) => e.systemKey));
                  return (
                    <tr key={s.id} className="border-b border-card-border/50 hover:bg-white/5">
                      <td className="px-4 py-3">{s.label || s.canonicalKey}</td>
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
