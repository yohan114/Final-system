import Link from "next/link";
import { prisma } from "@/lib/db";
import { suggestMatches } from "@/lib/spine";
import { linkMachineAction } from "@/app/actions/spine";
import SyncButton from "@/components/SyncButton";
import { Link2, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

const SYS: Record<string, { name: string; cls: string }> = {
  fuel: { name: "Fuel", cls: "bg-blue-500/20 text-blue-300" },
  mainstores: { name: "Stores", cls: "bg-violet-500/20 text-violet-300" },
  workshop: { name: "Workshop", cls: "bg-amber-500/20 text-amber-300" },
  oilbook: { name: "Oil", cls: "bg-emerald-500/20 text-emerald-300" },
};

const SHOW = 50;

export default async function MappingsPage() {
  const totalUnmapped = await prisma.systemEntity.count({
    where: { kind: "machine", machineId: null },
  });
  const entities = await prisma.systemEntity.findMany({
    where: { kind: "machine", machineId: null },
    orderBy: [{ systemKey: "asc" }, { label: "asc" }],
    take: SHOW,
  });

  const withSuggestions = await Promise.all(
    entities.map(async (e) => ({ e, suggestions: await suggestMatches(e, 4) }))
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <Link2 className="w-6 h-6 text-accent" />
          <div>
            <h1 className="text-xl font-semibold">Mapping workbench</h1>
            <p className="text-sm text-muted">
              {totalUnmapped} machine record{totalUnmapped === 1 ? "" : "s"} not yet matched to an E&amp;C code
            </p>
          </div>
        </div>
        <SyncButton />
      </div>

      {totalUnmapped === 0 ? (
        <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-muted">
            Every machine record is mapped. See <Link href="/machines" className="text-accent hover:underline">Machines</Link>.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted mb-3">
            These come from systems that key machines by serial/plate or free-text names (Main Stores, Workshop),
            so they can&apos;t auto-match by E&amp;C code. Confirm a code to fold each into the canonical machine.
            {totalUnmapped > SHOW ? ` Showing the first ${SHOW}.` : ""}
          </p>
          <div className="space-y-3">
            {withSuggestions.map(({ e, suggestions }) => (
              <div key={e.id} className="bg-card border border-card-border rounded-2xl p-4">
                <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                  <span className={`text-[11px] px-2 py-0.5 rounded-md ${SYS[e.systemKey]?.cls || ""}`}>
                    {SYS[e.systemKey]?.name || e.systemKey}
                  </span>
                  <span className="font-medium">{e.label || e.localId}</span>
                  {e.code && <span className="text-xs text-muted font-mono">code: {e.code}</span>}
                </div>

                <div className="flex items-end gap-3 flex-wrap">
                  {suggestions.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted">Suggestions:</span>
                      {suggestions.map((s) => (
                        <form key={s.id} action={linkMachineAction}>
                          <input type="hidden" name="entityId" value={e.id} />
                          <input type="hidden" name="canonicalCode" value={s.canonicalCode} />
                          <button className="text-xs font-mono px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/30 border border-accent/25 transition-colors">
                            {s.canonicalCode}
                          </button>
                        </form>
                      ))}
                    </div>
                  )}

                  <form action={linkMachineAction} className="flex items-end gap-2 ml-auto">
                    <input type="hidden" name="entityId" value={e.id} />
                    <div>
                      <label className="block text-[11px] text-muted mb-1">E&amp;C code</label>
                      <input
                        name="canonicalCode"
                        required
                        placeholder="e.g. DT-123"
                        className="bg-[#1b2230] border border-card-border rounded-lg px-3 py-1.5 text-sm font-mono w-32 focus:outline-none focus:border-accent/50"
                      />
                    </div>
                    <button className="text-sm font-medium bg-white/5 hover:bg-white/10 border border-card-border rounded-lg px-3 py-1.5">
                      Link
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
