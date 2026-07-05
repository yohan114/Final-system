import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { profitForMonth } from "@/lib/costs";

// CSV export of the month's per-site and per-machine P/L. Portal-authenticated
// (self-checks the session because the proxy matcher skips /api).
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month=YYYY-MM required" }, { status: 400 });
  }

  const { bySite, byMachine } = await profitForMonth(month);
  const cats = ["fuel", "parts", "labour", "oil", "other"];
  const rupees = (c: number) => (c / 100).toFixed(2);
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;

  const header = ["Dimension", "Name", "Income", ...cats, "TotalCost", "FuelMargin", "Profit"];
  const lines = [header.join(",")];
  for (const [dim, rows] of [["Site", bySite], ["Machine", byMachine]] as const) {
    for (const r of rows) {
      lines.push(
        [
          dim,
          esc(r.label),
          rupees(r.income),
          ...cats.map((c) => rupees(r.byCategory[c] ?? 0)),
          rupees(r.cost),
          rupees(r.fuelMargin),
          rupees(r.profit),
        ].join(",")
      );
    }
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ec-profit-${month}.csv"`,
    },
  });
}
