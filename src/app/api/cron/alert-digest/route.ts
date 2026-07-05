import { NextRequest, NextResponse } from "next/server";
import { sendAlertDigest } from "@/lib/digest";

// Scheduled alert-digest email. Token-authed via CRON_SECRET (x-cron-secret
// header or ?secret= query) — same pattern as the Fuel system's billing cron.
// Point an external scheduler at this once a day (or as often as wanted).
async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendAlertDigest();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = run;
export const POST = run;
