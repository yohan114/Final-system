"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncSpine, linkMachineEntity, unlinkMachineEntity } from "@/lib/spine";
import { revalidatePath } from "next/cache";

export async function syncSpineAction() {
  const user = await requireUser();
  const report = await syncSpine();
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "SPINE_SYNC",
      entity: "Spine",
      summary: `Synced spine — ${report.canonicalMachines} machines, ${report.canonicalSites} sites; ${report.machinesUnmatched} machine entities unmapped`,
    },
  });
  revalidatePath("/machines");
  revalidatePath("/sites");
  revalidatePath("/admin/mappings");
  return report;
}

export async function linkMachineAction(formData: FormData) {
  const user = await requireUser();
  const entityId = formData.get("entityId")?.toString();
  const canonicalCode = formData.get("canonicalCode")?.toString();
  if (!entityId || !canonicalCode) return;
  const canon = await linkMachineEntity(entityId, canonicalCode);
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "SPINE_LINK",
      entity: "SystemEntity",
      entityId,
      summary: `Linked entity ${entityId} → machine ${canon.canonicalCode}`,
    },
  });
  revalidatePath("/admin/mappings");
  revalidatePath("/machines");
}

export async function unlinkMachineAction(formData: FormData) {
  await requireUser();
  const entityId = formData.get("entityId")?.toString();
  if (!entityId) return;
  await unlinkMachineEntity(entityId);
  revalidatePath("/admin/mappings");
  revalidatePath("/machines");
}
