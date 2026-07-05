import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { verifySsoToken } from "@/lib/sso";

// Single sign-on entry from the E&C Master Portal: verify the portal's signed
// one-time token and mint this system's own session for the matching local
// user. Any failure lands on the normal login page — SSO never weakens it.
// Redirects are RELATIVE: under the unified custom server, request.url's host
// is the server's bind address, not the sub-domain the browser is on.
const redirectTo = (path: string) => new NextResponse(null, { status: 307, headers: { Location: path } });

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const verified = verifySsoToken(token);
  if (!verified) {
    return redirectTo("/login");
  }

  const user = await prisma.user.findUnique({ where: { username: verified.username } });
  if (!user || !user.active) {
    return redirectTo("/login");
  }

  await createSession(user.id, user.username, user.role, user.name, user.projectId, user.bulkTankId);
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      summary: `User ${user.username} signed in via portal SSO`,
    },
  });

  return redirectTo("/");
}
