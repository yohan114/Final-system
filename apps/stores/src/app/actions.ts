"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { 
  getSession, 
  setSession, 
  destroySession, 
  hashPassword, 
  verifyPassword 
} from "@/lib/auth";

// Helper to merge date input with strict current time (to capture seconds)
function parseDateWithCurrentTime(dateStr: string): Date {
  const d = new Date(dateStr);
  const now = new Date();
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return d;
}

// Authorization helper
async function assertRole(allowedRoles: string[]) {
  const session = await getSession();
  if (!session) {
    throw new Error("Not authenticated. Please log in.");
  }
  if (session.mustChangePassword) {
    throw new Error("You must change your temporary password before performing any system actions.");
  }
  if (!allowedRoles.includes(session.role)) {
    throw new Error("Unauthorized. You do not have the required role.");
  }
  return session;
}

// -------------------------------------------------------------
// Authentication Actions
// -------------------------------------------------------------

export async function loginAction(formData: FormData) {
  const username = formData.get("username")?.toString().trim();
  const password = formData.get("password")?.toString();

  if (!username || !password) {
    return { error: "Username and password are required." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return { error: "Invalid username or password." };
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return { error: "Invalid username or password." };
    }

    // Set cookie session
    await setSession({
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });

    return { success: true };
  } catch (err: any) {
    console.error("Login action error:", err);
    return { error: err.message || "Login failed." };
  }
}

export async function logoutAction() {
  await destroySession();
  revalidatePath("/");
  return { success: true };
}

export async function changePasswordAction(data: {
  oldPassword?: string;
  newPassword: string;
}) {
  try {
    const session = await getSession();
    if (!session) {
      throw new Error("Not authenticated. Please log in.");
    }
    const { oldPassword, newPassword } = data;
    if (!oldPassword) {
      return { error: "Current password is required." };
    }
    if (!newPassword || newPassword.trim().length < 6) {
      return { error: "New password must be at least 6 characters long." };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return { error: "User not found." };
    }

    const isValid = verifyPassword(oldPassword, user.passwordHash);
    if (!isValid) {
      return { error: "Current password is incorrect." };
    }

    const newHash = hashPassword(newPassword);
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    // Re-encrypt session cookie with updated flag
    await setSession({
      userId: session.userId,
      username: session.username,
      name: session.name,
      role: session.role,
      mustChangePassword: false,
    });

    console.log(`Password successfully updated for user @${session.username}`);

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("Change password error:", err);
    return { error: err.message || "Failed to change password." };
  }
}

export async function adminResetPasswordAction(data: {
  userId: string;
  newPassword: string;
}) {
  try {
    const session = await assertRole(["ADMIN"]);
    const { userId, newPassword } = data;

    if (!userId || !newPassword || newPassword.trim().length < 6) {
      return { error: "A valid new password of at least 6 characters is required." };
    }

    const newHash = hashPassword(newPassword);
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: true, // Flag the user to change password on next login!
      },
    });

    console.log(`[PASSWORD RESET] Admin @${session.username} reset password for @${user.username} to: ${newPassword}`);

    revalidatePath("/");
    return { success: true, username: user.username };
  } catch (err: any) {
    console.error("Admin reset password error:", err);
    return { error: err.message || "Failed to reset password." };
  }
}

// -------------------------------------------------------------
// User Management Actions (ADMIN only)
// -------------------------------------------------------------

export async function listUsersAction() {
  try {
    await assertRole(["ADMIN"]);
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { username: "asc" },
    });
    return { success: true, users };
  } catch (err: any) {
    return { error: err.message || "Failed to list users." };
  }
}

export async function createUserAction(data: {
  username: string;
  name: string;
  role: string;
  password?: string;
}) {
  try {
    await assertRole(["ADMIN"]);
    const { username, name, role, password } = data;

    if (!username?.trim() || !name?.trim() || !role?.trim() || !password) {
      return { error: "All fields are required to create a user." };
    }

    const cleanUsername = username.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    if (existing) {
      return { error: `Username '${cleanUsername}' is already taken.` };
    }

    const passwordHash = hashPassword(password);
    await prisma.user.create({
      data: {
        username: cleanUsername,
        name: name.trim(),
        role,
        passwordHash,
      },
    });

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to create user." };
  }
}

export async function deleteUserAction(id: string) {
  try {
    const session = await assertRole(["ADMIN"]);
    
    if (session.userId === id) {
      return { error: "You cannot delete your own admin account." };
    }

    await prisma.user.delete({
      where: { id },
    });

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to delete user." };
  }
}

// -------------------------------------------------------------
// Site Management Actions (ADMIN, SK)
// -------------------------------------------------------------

export async function createSiteAction(name: string) {
  try {
    await assertRole(["ADMIN", "SK"]);
    if (!name?.trim()) return { error: "Site name is required." };

    const site = await prisma.site.create({
      data: { name: name.trim() },
    });

    revalidatePath("/");
    return { success: true, site };
  } catch (err: any) {
    return { error: err.message || "Failed to create site." };
  }
}

export async function deleteSiteAction(id: string) {
  try {
    await assertRole(["ADMIN", "SK"]);
    await prisma.site.delete({ where: { id } });
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to delete site." };
  }
}

// -------------------------------------------------------------
// Machine Management Actions (ADMIN, SK)
// -------------------------------------------------------------

export async function createMachineAction(data: {
  name: string;
  code: string;
  condition: string;
  siteId?: string | null;
  mediaFiles?: { url: string; type: string }[];
}) {
  try {
    await assertRole(["ADMIN", "SK"]);
    const { name, code, condition, siteId, mediaFiles } = data;

    if (!name?.trim() || !code?.trim()) {
      return { error: "Machine name and serial code are required." };
    }

    if (siteId && (!mediaFiles || mediaFiles.length === 0)) {
      return { error: "Assigning the machine to a site requires uploading images or videos." };
    }

    const machine = await prisma.$transaction(async (tx) => {
      const mach = await tx.machine.create({
        data: {
          name: name.trim(),
          code: code.trim(),
          condition,
          siteId: siteId || null,
          status: siteId ? "SITE" : "WORKSHOP",
        },
      });

      if (mediaFiles && mediaFiles.length > 0) {
        await tx.mediaFile.createMany({
          data: mediaFiles.map((f) => ({
            url: f.url,
            type: f.type,
            phase: "MACHINE_REGISTER",
            machineId: mach.id,
          })),
        });
      }

      return mach;
    });

    revalidatePath("/");
    return { success: true, machine };
  } catch (err: any) {
    return { error: err.message || "Failed to create machine." };
  }
}

export async function updateMachineAction(
  id: string,
  data: {
    name?: string;
    code?: string;
    condition?: string;
    siteId?: string | null;
    status?: string;
    mediaFiles?: { url: string; type: string }[];
  }
) {
  try {
    await assertRole(["ADMIN", "SK"]);
    const { name, code, condition, siteId, status, mediaFiles } = data;

    if (siteId && (!mediaFiles || mediaFiles.length === 0)) {
      return { error: "Assigning the machine to a site requires uploading images or videos." };
    }

    const machine = await prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (code !== undefined) updateData.code = code.trim();
      if (condition !== undefined) updateData.condition = condition;
      if (siteId !== undefined) updateData.siteId = siteId;
      if (status !== undefined) updateData.status = status;

      const mach = await tx.machine.update({
        where: { id },
        data: updateData,
      });

      if (mediaFiles && mediaFiles.length > 0) {
        await tx.mediaFile.createMany({
          data: mediaFiles.map((f) => ({
            url: f.url,
            type: f.type,
            phase: "MACHINE_ASSIGN",
            machineId: id,
          })),
        });
      }

      return mach;
    });

    revalidatePath("/");
    return { success: true, machine };
  } catch (err: any) {
    return { error: err.message || "Failed to update machine." };
  }
}

export async function deleteMachineAction(id: string) {
  try {
    await assertRole(["ADMIN", "SK"]);
    await prisma.machine.delete({ where: { id } });
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to delete machine." };
  }
}

// -------------------------------------------------------------
// Machine/Tool Request Actions (Role Enforced)
// -------------------------------------------------------------

export async function createRequestAction(data: {
  mrnNumber: string;
  itemName: string;
  quantity: number;
  purpose?: string;
  targetSite?: string;
}) {
  try {
    const session = await assertRole(["ADMIN", "SK"]);
    const { mrnNumber, itemName, quantity, purpose, targetSite } = data;

    if (!mrnNumber?.trim() || !itemName?.trim() || !quantity || quantity <= 0) {
      return { error: "MRN Number, Item Name and valid Quantity are required." };
    }

    const request = await prisma.machineRequest.create({
      data: {
        mrnNumber: mrnNumber.trim(),
        itemName: itemName.trim(),
        quantity,
        purpose: purpose?.trim() || null,
        targetSite: targetSite?.trim() || null,
        status: "PENDING",
        requestedBy: session.username,
      },
    });

    revalidatePath("/");
    return { success: true, request };
  } catch (err: any) {
    console.error("Create request error:", err);
    return { error: err.message || "Failed to create request" };
  }
}

export async function approveRequestAction(id: string) {
  try {
    await assertRole(["ADMIN", "HEADOFFICE"]);

    const request = await prisma.machineRequest.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    revalidatePath("/");
    return { success: true, request };
  } catch (err: any) {
    console.error("Approve request error:", err);
    return { error: err.message || "Failed to approve request" };
  }
}

export async function receiveWorkshopAction(data: {
  id: string;
  receivedDate: string;
  receiptNotes?: string;
  machineId?: string | null; // Physical machine allocation
  condition?: string;       // Dynamic condition check during receive
  mediaFiles: { url: string; type: string }[];
}) {
  try {
    const session = await assertRole(["ADMIN", "SK"]);
    const { id, receivedDate, receiptNotes, machineId, condition, mediaFiles } = data;

    if (!receivedDate) {
      return { error: "Received date is required." };
    }

    const strictReceivedDate = parseDateWithCurrentTime(receivedDate);

    await prisma.$transaction(async (tx: any) => {
      // 1. Update request status
      await tx.machineRequest.update({
        where: { id },
        data: {
          receivedDate: strictReceivedDate,
          receiptNotes: receiptNotes?.trim() || null,
          status: "RECEIVED_WORKSHOP",
          receivedBy: session.username,
          machineId: machineId || null,
        },
      });

      // 2. If a physical machine was selected, update its state
      if (machineId) {
        await tx.machine.update({
          where: { id: machineId },
          data: {
            status: "WORKSHOP",
            siteId: null,
            condition: condition || "GOOD",
          },
        });
      }

      // 3. Create associated media files
      if (mediaFiles && mediaFiles.length > 0) {
        await tx.mediaFile.createMany({
          data: mediaFiles.map((f) => ({
            url: f.url,
            type: f.type,
            phase: "RECEIPT",
            requestId: id,
          })),
        });
      }
    });

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("Receive workshop error:", err);
    return { error: err.message || "Failed to receive at workshop" };
  }
}

export async function dispatchSiteAction(data: {
  id: string;
  sentSiteDate: string;
  transferNoteNo: string;
  dispatchNotes?: string;
  siteId?: string | null;  // Allocating to a structured Site
  mediaFiles: { url: string; type: string }[];
}) {
  try {
    const session = await assertRole(["ADMIN", "SK"]);
    const { id, sentSiteDate, transferNoteNo, dispatchNotes, siteId, mediaFiles } = data;

    if (!sentSiteDate || !transferNoteNo?.trim()) {
      return { error: "Sent to site date and Transfer Note Number are required." };
    }

    if (!mediaFiles || mediaFiles.length === 0) {
      return { error: "Assigning the machine to a site (dispatching) requires uploading images or videos." };
    }

    const strictSentSiteDate = parseDateWithCurrentTime(sentSiteDate);

    await prisma.$transaction(async (tx: any) => {
      const request = await tx.machineRequest.findUnique({
        where: { id },
      });

      // 1. Update request status
      await tx.machineRequest.update({
        where: { id },
        data: {
          sentSiteDate: strictSentSiteDate,
          transferNoteNo: transferNoteNo.trim(),
          dispatchNotes: dispatchNotes?.trim() || null,
          status: "SENT_TO_SITE",
          dispatchedBy: session.username,
        },
      });

      // 2. Update physical machine location
      if (request?.machineId) {
        await tx.machine.update({
          where: { id: request.machineId },
          data: {
            status: "SITE",
            siteId: siteId || null,
          },
        });
      }

      // 3. Create associated media files
      if (mediaFiles && mediaFiles.length > 0) {
        await tx.mediaFile.createMany({
          data: mediaFiles.map((f) => ({
            url: f.url,
            type: f.type,
            phase: "DISPATCH",
            requestId: id,
          })),
        });
      }
    });

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("Dispatch to site error:", err);
    return { error: err.message || "Failed to dispatch to site" };
  }
}

export async function returnWorkshopAction(data: {
  id: string;
  returnedDate: string;
  returnReason: string; // "PROJECT_END" | "REPAIR" | "OTHER"
  condition?: string;   // Dynamic return condition: e.g. "DAMAGED" or "BROKEN"
  returnNotes?: string;
  mediaFiles: { url: string; type: string }[];
}) {
  try {
    const session = await assertRole(["ADMIN", "SK"]);
    const { id, returnedDate, returnReason, condition, returnNotes, mediaFiles } = data;

    if (!returnedDate || !returnReason) {
      return { error: "Returned date and Return Reason are required." };
    }

    const strictReturnedDate = parseDateWithCurrentTime(returnedDate);
    const newStatus = returnReason === "REPAIR" || condition === "DAMAGED" || condition === "BROKEN" 
      ? "IN_REPAIR" 
      : "RETURNED_WORKSHOP";

    await prisma.$transaction(async (tx: any) => {
      const request = await tx.machineRequest.findUnique({
        where: { id },
      });

      // 1. Update request status
      await tx.machineRequest.update({
        where: { id },
        data: {
          returnedDate: strictReturnedDate,
          returnReason,
          returnNotes: returnNotes?.trim() || null,
          status: newStatus,
          returnedBy: session.username,
        },
      });

      // 2. Reset machine location & update its condition
      if (request?.machineId) {
        await tx.machine.update({
          where: { id: request.machineId },
          data: {
            status: newStatus === "IN_REPAIR" ? "REPAIR" : "WORKSHOP",
            siteId: null,
            condition: condition || "GOOD",
          },
        });
      }

      // 3. Create associated media files
      if (mediaFiles && mediaFiles.length > 0) {
        await tx.mediaFile.createMany({
          data: mediaFiles.map((f) => ({
            url: f.url,
            type: f.type,
            phase: "RETURN",
            requestId: id,
          })),
        });
      }
    });

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("Return to workshop error:", err);
    return { error: err.message || "Failed to return to workshop" };
  }
}

// -------------------------------------------------------------
// Admin Edit / Delete Option (ADMIN only)
// -------------------------------------------------------------

export async function editRequestAction(
  id: string,
  data: {
    mrnNumber: string;
    itemName: string;
    quantity: number;
    purpose?: string;
    targetSite?: string;
    machineId?: string | null;
    status?: string;
  }
) {
  try {
    await assertRole(["ADMIN"]);
    const { mrnNumber, itemName, quantity, purpose, targetSite, machineId, status } = data;

    if (!mrnNumber?.trim() || !itemName?.trim() || !quantity || quantity <= 0) {
      return { error: "MRN, Item Name and valid Quantity are required." };
    }

    await prisma.$transaction(async (tx: any) => {
      const existing = await tx.machineRequest.findUnique({ where: { id } });

      // Update machine link if changed
      if (machineId !== undefined && existing.machineId !== machineId) {
        // Free old machine if it was linked
        if (existing.machineId) {
          await tx.machine.update({
            where: { id: existing.machineId },
            data: { status: "WORKSHOP", siteId: null },
          });
        }
        // Link new machine and adjust status based on request status
        if (machineId) {
          const machineStatus = status === "SENT_TO_SITE" ? "SITE" : (status === "IN_REPAIR" ? "REPAIR" : "WORKSHOP");
          await tx.machine.update({
            where: { id: machineId },
            data: { status: machineStatus },
          });
        }
      }

      await tx.machineRequest.update({
        where: { id },
        data: {
          mrnNumber: mrnNumber.trim(),
          itemName: itemName.trim(),
          quantity,
          purpose: purpose?.trim() || null,
          targetSite: targetSite?.trim() || null,
          machineId: machineId || null,
          status: status || existing.status,
        },
      });
    });

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("Edit request error:", err);
    return { error: err.message || "Failed to edit request." };
  }
}

export async function deleteRequestAction(id: string) {
  try {
    await assertRole(["ADMIN"]);

    await prisma.$transaction(async (tx: any) => {
      const request = await tx.machineRequest.findUnique({ where: { id } });
      
      // Free linked machine if exists
      if (request?.machineId) {
        await tx.machine.update({
          where: { id: request.machineId },
          data: { status: "WORKSHOP", siteId: null },
        });
      }

      await tx.machineRequest.delete({
        where: { id },
      });
    });

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("Delete request error:", err);
    return { error: err.message || "Failed to delete request." };
  }
}
