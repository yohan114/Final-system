import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

// Newest backup snapshot in <app>/backups (written by scripts/backup.js),
// reported so the portal can flag a stale backup. The app dir is derived from
// the DB location (absolute in unified mode, cwd-relative standalone).
function latestBackupAt(): string | null {
  try {
    const dbUrl = process.env.MAINSTORES_DATABASE_URL || process.env.DATABASE_URL || "file:./dev.db";
    const dbFile = path.resolve(dbUrl.replace(/^file:/, ""));
    const dir = path.join(path.dirname(dbFile), "backups"); // dev.db sits in the app root
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
    lastBackupAt: latestBackupAt(),
    kpis: [
      { label: "Awaiting HO approval", value: pending, tone: pending > 0 ? "warn" : "good" },
      { label: "Machines in repair", value: inRepair, tone: inRepair > 0 ? "bad" : "good" },
      { label: "Machines at site", value: atSite, tone: "neutral" },
      { label: "Machines in workshop", value: inWorkshop, tone: "neutral" },
    ],
  });
}
