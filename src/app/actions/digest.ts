"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendAlertDigest } from "@/lib/digest";
import { revalidatePath } from "next/cache";

export async function sendDigestAction() {
  const user = await requireUser();
  const result = await sendAlertDigest();
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "ALERT_DIGEST",
      entity: "Outbox",
      entityId: result.outboxId,
      summary: `Sent alert digest (${result.alertCount} alert${result.alertCount === 1 ? "" : "s"}, ${result.status}) to ${result.to}`,
    },
  });
  revalidatePath("/alerts");
  return result;
}
