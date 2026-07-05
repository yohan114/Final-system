"use server";

import { createSession, deleteSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export async function loginAction(_prevState: unknown, formData: FormData) {
  const username = formData.get("username")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();

  if (!username || !password) {
    return { error: "Please enter both username and password" };
  }

  try {
    const user = await prisma.portalUser.findUnique({ where: { username } });
    if (!user || !user.active) {
      return { error: "Invalid username or password" };
    }

    const isValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isValid) {
      return { error: "Invalid username or password" };
    }

    await createSession(user.id, user.username, user.role, user.name);

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "LOGIN",
        entity: "PortalUser",
        entityId: user.id,
        summary: `${user.username} signed in to the Master Portal`,
      },
    });
  } catch (err) {
    console.error("Portal login error:", err);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
