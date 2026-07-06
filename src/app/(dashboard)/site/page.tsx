import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isExec } from "@/lib/roles";
import { MapPin, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

const rs = (cents: number) => "Rs " + Math.round(cents / 100).toLocaleString("en-LK");

// The Site Officer's home: their own site's numbers from the merged cost
// ledger — income, spend and profit for the latest month with data, the spend
// split by category, and the machines that worked on the site that month.
// Executives can preview any site via ?site=<id>.
export default async function SitePage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.portalUser.findUnique({
    where: { id: session.userId },
    include: { site: true },
  });
  if (!user) redirect("/login");

  const { site: previewSiteId } = await searchParams;
  let site = user.site;
  if (!site && isExec(user.role) && previewSiteId) {
    site = await prisma.siteMap.findUnique({ where: { id: previewSiteId } });
  }
  if (!site) {
    if (isExec(user.role)) redirect("/sites");
    return (
      <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
        <MapPin className="w-8 h-8 text-accent mx-auto mb-2" />
        <p className="text-sm text-muted">
          Your account has no site assigned yet — ask the administrator to set one on the
          People &amp; roles page.
        </p>
      </div>
    );
  }

  // Latest month with any ledger entries for this site.
  const latest = await prisma.costEvent.findFirst({
    where: { siteId: site.id },
    orderBy: { month: "desc" },
    select: { month: true },
  });
  const month = latest?.month ?? null;

  const events = month
    ? await prisma.costEvent.findMany({ where: { siteId: site.id, month }, include: { machine: true } })
    : [];

  let incomeCents = 0;
  let costCents = 0;
  const byCategory = new Map<string, number>();
  const byMachine = new Map<string, { label: string; cents: number }>();
  for (const e of events) {
    if (e.kind === "income") incomeCents += e.amountCents;
    else {
      costCents += e.amountCents;
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amountCents);
    }
    if (e.machine) {
      const cur = byMachine.get(e.machine.id) ?? {
        label: e.machine.label || e.machine.canonicalCode,
        cents: 0,
      };
      cur.cents += e.kind === "cost" ? e.amountCents : 0;
      byMachine.set(e.machine.id, cur);
    }
  }
  const profitCents = incomeCents - costCents;
  const machines = [...byMachine.values()].sort((a, b) => b.cents - a.cents);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <MapPin className="w-6 h-6 text-accent" />
        <div>
          <h1 className="text-xl font-semibold">{site.label || site.canonicalKey}</h1>
          <p className="text-sm text-muted">
            {month ? `Site dashboard · ${month}` : "Site dashboard — no ledger data yet"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm text-muted mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Income
          </div>
          <div className="text-2xl font-semibold">{rs(incomeCents)}</div>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm text-muted mb-1">
            <TrendingDown className="w-4 h-4 text-red-400" /> Spend
          </div>
          <div className="text-2xl font-semibold">{rs(costCents)}</div>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm text-muted mb-1">
            <Wallet className="w-4 h-4 text-accent" /> Profit
          </div>
          <div className={`text-2xl font-semibold ${profitCents < 0 ? "text-red-400" : "text-emerald-400"}`}>
            {rs(profitCents)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <h2 className="font-medium mb-3">Spend by category</h2>
          {byCategory.size === 0 ? (
            <p className="text-sm text-muted">No costs recorded for this month.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {[...byCategory.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([category, cents]) => (
                  <li key={category} className="flex justify-between">
                    <span className="capitalize text-muted">{category}</span>
                    <span>{rs(cents)}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <h2 className="font-medium mb-3">Machines on this site ({machines.length})</h2>
          {machines.length === 0 ? (
            <p className="text-sm text-muted">No machine activity recorded for this month.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {machines.map((m) => (
                <li key={m.label} className="flex justify-between">
                  <span className="text-muted">{m.label}</span>
                  <span>{rs(m.cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
