import { profitForMonth, availableMonths, PnlRow } from "@/lib/costs";
import ProfitControls from "@/components/ProfitControls";
import { TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

const rs = (cents: number) => "Rs " + Math.round(cents / 100).toLocaleString("en-LK");
const CATS = ["fuel", "parts", "labour", "oil", "battery", "other"];

function profitCls(n: number) {
  return n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-muted";
}

function PnlTable({ rows, dimLabel }: { rows: PnlRow[]; dimLabel: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-card-border">
              <th className="px-4 py-3 font-medium">{dimLabel}</th>
              <th className="px-4 py-3 font-medium text-right">Income</th>
              {CATS.map((c) => (
                <th key={c} className="px-4 py-3 font-medium text-right capitalize">{c}</th>
              ))}
              <th className="px-4 py-3 font-medium text-right">Cost</th>
              <th className="px-4 py-3 font-medium text-right">Fuel margin</th>
              <th className="px-4 py-3 font-medium text-right">Profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                className={`border-b border-card-border/50 ${r.key === "unattributed" ? "text-amber-400/80" : ""}`}
              >
                <td className="px-4 py-3">{r.label}</td>
                <td className="px-4 py-3 text-right">{r.income ? rs(r.income) : "—"}</td>
                {CATS.map((c) => (
                  <td key={c} className="px-4 py-3 text-right text-muted">
                    {r.byCategory[c] ? rs(r.byCategory[c]) : "—"}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">{r.cost ? rs(r.cost) : "—"}</td>
                <td className={`px-4 py-3 text-right ${r.fuelMargin ? profitCls(r.fuelMargin) : "text-muted"}`}>
                  {r.fuelMargin ? rs(r.fuelMargin) : "—"}
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${profitCls(r.profit)}`}>
                  {rs(r.profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function ProfitPage(props: { searchParams: Promise<{ month?: string }> }) {
  const sp = await props.searchParams;
  const months = await availableMonths();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : months[0] ?? currentMonth;

  const { bySite, byMachine, totals, eventCount } = await profitForMonth(month);
  const profit = totals.income - totals.cost;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-accent" />
          <div>
            <h1 className="text-xl font-semibold">Profit &amp; loss</h1>
            <p className="text-sm text-muted">
              {month} · income billed vs true cost, per site and per machine
            </p>
          </div>
        </div>
        <ProfitControls month={month} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <div className="text-2xl font-semibold">{rs(totals.income)}</div>
          <div className="text-xs text-muted mt-1">Income billed (Fuel invoices)</div>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <div className="text-2xl font-semibold">{rs(totals.cost)}</div>
          <div className="text-xs text-muted mt-1">True cost (fuel + parts + labour + oil)</div>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <div className={`text-2xl font-semibold ${profitCls(profit)}`}>{rs(profit)}</div>
          <div className="text-xs text-muted mt-1">Profit = income − cost</div>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <div className={`text-2xl font-semibold ${profitCls(totals.fuelMargin)}`}>{rs(totals.fuelMargin)}</div>
          <div className="text-xs text-muted mt-1">
            Fuel margin — {rs(totals.fuelBilled)} billed vs {rs(totals.fuelCost)} cost
          </div>
        </div>
      </div>

      {eventCount === 0 ? (
        <div className="bg-card border border-card-border rounded-2xl p-8 text-center text-sm text-muted">
          No cost data for {month}. Click <span className="text-foreground font-medium">Ingest this month</span> to
          pull cost + income events from the systems. {months.length > 0 && `Months with data: ${months.join(", ")}.`}
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">By site</h2>
            <PnlTable rows={bySite} dimLabel="Site" />
          </section>
          <section>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
              By machine {byMachine.length > 20 ? "(top 20)" : ""}
            </h2>
            <PnlTable rows={byMachine.slice(0, 20)} dimLabel="E&C code" />
          </section>
          <p className="text-xs text-muted">
            Amounts in LKR. Rows marked <span className="text-amber-400/80">unattributed</span> are events whose
            machine/site could not be mapped — resolve them in the mapping workbench so they join the totals.
          </p>
        </div>
      )}
    </div>
  );
}
