import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { snapshotFromPayload, Kpi } from "@/lib/systems";
import { Boxes, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

// The Storekeeper's home: live stores + workshop numbers from the latest KPI
// snapshots, with signed-in links (SSO) into both systems to do the work.
export default async function StoresViewPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const systems = await prisma.system.findMany({
    where: { key: { in: ["mainstores", "workshop"] } },
    orderBy: { sortOrder: "asc" },
  });

  const cards: { key: string; name: string; kpis: Kpi[]; at: string | null }[] = [];
  for (const sys of systems) {
    const latest = await prisma.kpiSnapshot.findFirst({
      where: { systemId: sys.id },
      orderBy: { at: "desc" },
    });
    const snapshot = latest ? snapshotFromPayload(latest.payload) : null;
    cards.push({
      key: sys.key,
      name: sys.name,
      kpis: snapshot?.kpis ?? [],
      at: latest?.at.toISOString() ?? null,
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Boxes className="w-6 h-6 text-accent" />
        <div>
          <h1 className="text-xl font-semibold">Stores</h1>
          <p className="text-sm text-muted">
            Main Stores and the Workshop at a glance — open either one and you are already
            signed in.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <div key={card.key} className="bg-card border border-card-border rounded-2xl p-5 flex flex-col gap-4">
            <div className="font-medium">{card.name}</div>
            {card.kpis.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {card.kpis.map((k, i) => (
                  <div key={i} className="bg-white/5 rounded-xl px-3 py-2.5">
                    <div className="text-lg font-semibold leading-tight">{k.value}</div>
                    <div className="text-[11px] text-muted mt-0.5 leading-tight">{k.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No numbers yet — they appear after the first health poll.</p>
            )}
            <a
              href={`/launch/${card.key}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 text-sm font-medium bg-white/5 hover:bg-white/10 border border-card-border rounded-xl px-4 py-2.5 mt-auto"
            >
              Open {card.name} <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
