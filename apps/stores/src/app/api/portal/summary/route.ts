import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Read-only KPI summary for the E&C Master Portal. Token-authed via the
// x-portal-token header (the proxy matcher already exempts /api, so this
// handler self-authenticates). Never mutates.
export async function GET(request: NextRequest) {
  const token = request.headers.get("x-portal-token");
  const expected = process.env.MAINSTORES_PORTAL_TOKEN || process.env.PORTAL_TOKEN;
  if (!expected || !token || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [pending, inRepair, atSite, inWorkshop] = await Promise.all([
    prisma.machineRequest.count({ where: { status: "PENDING" } }),
    prisma.machine.count({ where: { status: "REPAIR" } }),
    prisma.machine.count({ where: { status: "SITE" } }),
    prisma.machine.count({ where: { status: "WORKSHOP" } }),
  ]);

  return NextResponse.json({
    system: "mainstores",
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: "Awaiting HO approval", value: pending, tone: pending > 0 ? "warn" : "good" },
      { label: "Machines in repair", value: inRepair, tone: inRepair > 0 ? "bad" : "good" },
      { label: "Machines at site", value: atSite, tone: "neutral" },
      { label: "Machines in workshop", value: inWorkshop, tone: "neutral" },
    ],
  });
}
