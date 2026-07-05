import { BarChart3 } from "lucide-react";

// Executive overview — the cross-system KPI wall and, from M5, the P/L board.
// Stubbed here: it lights up once each system exposes GET /api/portal/summary
// (M2) and the master-data spine lands (M4).
export default function OverviewPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <BarChart3 className="w-6 h-6 text-accent" />
        <div>
          <h1 className="text-xl font-semibold">Executive overview</h1>
          <p className="text-sm text-muted">Company-wide KPIs and profit per site / machine.</p>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-2xl p-8">
        <h2 className="font-semibold mb-3">Coming in the next phases</h2>
        <ul className="space-y-2 text-sm text-muted">
          <li>
            <span className="text-foreground font-medium">M2 — headline KPIs:</span> each system exposes a
            token-authed <code className="text-foreground">/api/portal/summary</code>; the tiles and this wall
            show live numbers (fuel spend, pending MRNs, open job cards, low oil stock).
          </li>
          <li>
            <span className="text-foreground font-medium">M3 — executive overview:</span> the full company KPI
            wall, each figure deep-linking into the owning system.
          </li>
          <li>
            <span className="text-foreground font-medium">M4 — master data spine:</span> one machine and one site
            list mapped across all four systems.
          </li>
          <li>
            <span className="text-foreground font-medium">M5 — profit engine:</span> Profit = income billed −
            true cost (fuel + parts + labour + oil + batteries), per site and per machine.
          </li>
        </ul>
      </div>
    </div>
  );
}
