import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

// Newest backup snapshot in <app>/backups, reported so the portal can flag a
// stale backup. The app dir is derived from the DB location (absolute in
// unified mode, cwd-relative standalone) — never from process.cwd() alone.
function latestBackupAt(): string | null {
  try {
    const dbUrl = process.env.FUEL_DATABASE_URL || process.env.DATABASE_URL || "file:./data/app.db";
    const dbFile = path.resolve(dbUrl.replace(/^file:/, ""));
    const dir = path.join(path.dirname(path.dirname(dbFile)), "backups"); // <app>/data/.. /backups
    let latest = 0;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".db")) continue;
      const m = fs.statSync(path.join(dir, f)).mtimeMs;
      if (m > latest) latest = m;
    }
    return latest ? new Date(latest).toISOString() : null;
  } catch {
    return null;
  }
}

// Read-only KPI summary for the E&C Master Portal. Token-authed via the
// x-portal-token header (the proxy lets /api/portal/* pass). Never mutates.
export async function GET(request: NextRequest) {
  const token = request.headers.get("x-portal-token");
  const expected = process.env.FUEL_PORTAL_TOKEN || process.env.PORTAL_TOKEN;
  if (!expected || !token || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [fuelThisMonth, pendingRequests, receivables, tankStock] = await Promise.all([
    prisma.fuelIssue.aggregate({
      _sum: { totalCost: true },
      where: { voided: false, issueDate: { gte: monthStart } },
    }),
    prisma.fuelRequest.count({ where: { status: "PENDING" } }),
    prisma.bill.aggregate({
      _sum: { grandTotalCents: true },
      where: { status: { in: ["ISSUED", "OVERDUE"] } },
    }),
    prisma.bulkTank.aggregate({ _sum: { balance: true } }),
  ]);

  const rs = (cents: number) =>
    "Rs " + Math.round(cents / 100).toLocaleString("en-LK");

  const fuelCents = fuelThisMonth._sum.totalCost ?? 0;
  const owedCents = receivables._sum.grandTotalCents ?? 0;
  const litresInTanks = Math.round(tankStock._sum.balance ?? 0);

  return NextResponse.json({
    system: "fuel",
    generatedAt: now.toISOString(),
    lastBackupAt: latestBackupAt(),
    kpis: [
      { label: "Fuel this month", value: rs(fuelCents), tone: "neutral", href: "/reports" },
      { label: "Pending fuel requests", value: pendingRequests, tone: pendingRequests > 0 ? "warn" : "good", href: "/fuel/requests" },
      { label: "Receivables outstanding", value: rs(owedCents), tone: owedCents > 0 ? "warn" : "good", href: "/billing/aging" },
      { label: "Bulk tank stock", value: `${litresInTanks.toLocaleString("en-LK")} L`, tone: "neutral", href: "/admin/tanks" },
    ],
  });
}
