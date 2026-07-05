import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Read-only entity list for the Master Portal's master-data spine (M4).
// Machines here are keyed by serial/plate (Machine.code), NOT the E&C code, so
// they will not auto-match by code — the portal queues them for manual/fuzzy
// mapping. Token-authed via x-portal-token (proxy matcher exempts /api).
export async function GET(request: NextRequest) {
  const token = request.headers.get("x-portal-token");
  const expected = process.env.MAINSTORES_PORTAL_TOKEN || process.env.PORTAL_TOKEN;
  if (!expected || !token || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [machines, sites] = await Promise.all([
    prisma.machine.findMany({
      select: { id: true, code: true, name: true, status: true, condition: true },
      orderBy: { name: "asc" },
    }),
    prisma.site.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({
    system: "mainstores",
    generatedAt: new Date().toISOString(),
    machines: machines.map((m) => ({
      localId: m.id,
      code: m.code, // serial / plate no — not an E&C code
      serialNo: m.code,
      label: m.name,
      status: m.status,
      condition: m.condition,
    })),
    sites: sites.map((s) => ({ localId: s.id, name: s.name })),
  });
}
