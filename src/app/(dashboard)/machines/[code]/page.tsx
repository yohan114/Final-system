import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ArrowLeft, Cpu } from "lucide-react";

export const dynamic = "force-dynamic";

const SYS_NAME: Record<string, string> = {
  fuel: "Fleet Fuel & Billing",
  mainstores: "Main Stores Console",
  workshop: "Workshop & Stores",
  oilbook: "Oil Stock Book",
};

export default async function MachineDetailPage(props: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await props.params;
  const code = decodeURIComponent(rawCode);

  const machine = await prisma.machineMap.findUnique({
    where: { canonicalCode: code },
    include: { entities: { where: { kind: "machine" }, orderBy: { systemKey: "asc" } } },
  });
  if (!machine) notFound();

  return (
    <div>
      <Link href="/machines" className="text-sm text-muted hover:text-foreground flex items-center gap-1.5 mb-4">
        <ArrowLeft className="w-4 h-4" /> All machines
      </Link>

      <div className="flex items-center gap-3 mb-1">
        <Cpu className="w-6 h-6 text-accent" />
        <h1 className="text-xl font-semibold font-mono">{machine.canonicalCode}</h1>
      </div>
      <p className="text-sm text-muted mb-6">{machine.label || "—"}</p>

      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
        Present in {machine.entities.length} system{machine.entities.length === 1 ? "" : "s"}
      </h2>

      <div className="space-y-3">
        {machine.entities.map((e) => {
          let extra: Record<string, string | undefined> = {};
          try {
            extra = JSON.parse(e.extra ?? "{}");
          } catch {
            /* ignore */
          }
          const facts = [
            ["Local code", e.code],
            ["Registration", extra.registration],
            ["Serial no", extra.serialNo],
            ["Status", extra.status],
            ["Condition", extra.condition],
            ["Match", e.matchType],
          ].filter(([, v]) => v) as [string, string][];
          return (
            <div key={e.id} className="bg-card border border-card-border rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <h3 className="font-semibold">{SYS_NAME[e.systemKey] || e.systemKey}</h3>
                <span className="text-sm text-muted">{e.label || e.localId}</span>
              </div>
              <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
                {facts.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-card-border/40 pb-1">
                    <span className="text-muted">{k}</span>
                    <span className="text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-card-border rounded-2xl p-5 mt-4">
        <h3 className="font-semibold mb-1">Combined cost &amp; profit</h3>
        <p className="text-sm text-muted">
          This machine&apos;s fuel + parts + labour + oil cost, and profit vs the invoices billed for it, arrive
          with the cost engine (M5) — built on this mapping.
        </p>
      </div>
    </div>
  );
}
