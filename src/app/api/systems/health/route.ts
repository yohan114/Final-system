import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pollAllSystems } from "@/lib/systems";

// Live status + KPIs of every linked system, re-polled on demand. Portal-
// authenticated (self-checks the session because the proxy matcher skips /api).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await pollAllSystems();
  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    systems: results.map((r) => ({
      key: r.system.key,
      ok: r.status.ok,
      latencyMs: r.status.latencyMs,
      detail: r.status.detail,
      kpis: r.kpis ?? null,
      kpisAt: r.kpisAt,
      kpisStale: r.kpisStale,
    })),
  });
}
