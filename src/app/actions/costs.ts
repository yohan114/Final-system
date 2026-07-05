"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ingestCosts } from "@/lib/costs";
import { revalidatePath } from "next/cache";

export async function ingestCostsAction(month: string) {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("month=YYYY-MM required");
  const report = await ingestCosts(month);
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "COST_INGEST",
      entity: "Costs",
      summary: `Ingested ${month} — ${report.costEvents} cost + ${report.incomeEvents} income events`,
    },
  });
  revalidatePath("/profit");
  return report;
}
