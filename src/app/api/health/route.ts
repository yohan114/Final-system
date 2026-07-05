import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// The portal's own health probe (so it too can be supervised/monitored).
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      system: "portal",
      version: "0.1.0",
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, system: "portal", time: new Date().toISOString() },
      { status: 503 }
    );
  }
}
