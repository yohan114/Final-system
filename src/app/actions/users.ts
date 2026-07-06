"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ASSIGNABLE_ROLES, isAdmin } from "@/lib/roles";

async function requireAdmin() {
  const session = await getSession();
  if (!session || !isAdmin(session.role)) {
    throw new Error("Only the administrator can manage users");
  }
  return session;
}

export async function createUserAction(formData: FormData) {
  try {
    const admin = await requireAdmin();
    const username = formData.get("username")?.toString().trim().toLowerCase();
    const name = formData.get("name")?.toString().trim();
    const password = formData.get("password")?.toString();
    const role = formData.get("role")?.toString();
    const siteId = formData.get("siteId")?.toString() || null;

    if (!username || !name || !password) return { error: "Username, name and password are required" };
    if (password.length < 8) return { error: "Password must be at least 8 characters" };
    if (!role || !(ASSIGNABLE_ROLES as readonly string[]).includes(role)) return { error: "Choose a valid role" };
    if (role === "SITE" && !siteId) return { error: "A Site Officer must be assigned to a site" };

    const existing = await prisma.portalUser.findUnique({ where: { username } });
    if (existing) return { error: `Username "${username}" already exists` };

    const user = await prisma.portalUser.create({
      data: {
        username,
        name,
        passwordHash: bcrypt.hashSync(password, 10),
        role,
        siteId: role === "SITE" ? siteId : null,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: admin.userId,
        action: "CREATE",
        entity: "PortalUser",
        entityId: user.id,
        summary: `Created user ${username} (${role})`,
      },
    });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create user" };
  }
}

export async function setUserActiveAction(userId: string, active: boolean) {
  try {
    const admin = await requireAdmin();
    if (admin.userId === userId && !active) return { error: "You cannot deactivate your own account" };
    const user = await prisma.portalUser.update({ where: { id: userId }, data: { active } });
    await prisma.auditLog.create({
      data: {
        actorId: admin.userId,
        action: "UPDATE",
        entity: "PortalUser",
        entityId: userId,
        summary: `${active ? "Activated" : "Deactivated"} user ${user.username}`,
      },
    });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update user" };
  }
}

export async function resetPasswordAction(userId: string, formData: FormData) {
  try {
    const admin = await requireAdmin();
    const password = formData.get("password")?.toString();
    if (!password || password.length < 8) return { error: "Password must be at least 8 characters" };
    const user = await prisma.portalUser.update({
      where: { id: userId },
      data: { passwordHash: bcrypt.hashSync(password, 10) },
    });
    await prisma.auditLog.create({
      data: {
        actorId: admin.userId,
        action: "UPDATE",
        entity: "PortalUser",
        entityId: userId,
        summary: `Reset password for ${user.username}`,
      },
    });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reset password" };
  }
}
