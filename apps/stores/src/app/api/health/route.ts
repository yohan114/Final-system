import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public health probe for the E&C Master Portal. The proxy matcher exempts
// /api, so no session is required. 200 when the DB is reachable, 503 otherwise.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      system: "mainstores",
      version: "0.1.0",
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, system: "mainstores", time: new Date().toISOString() },
      { status: 503 }
    );
  }
}
