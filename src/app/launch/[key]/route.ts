import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { signSsoToken } from "@/lib/sso";

// Single sign-on launch: a signed-in portal user opens a system through here.
// We mint a short-lived one-time token for their username and redirect to the
// system's /sso endpoint, which verifies it and creates that system's own
// session. Without an SSO secret configured the redirect is just a plain link
// to the system (feature off, old behaviour).
// Portal-internal redirects are RELATIVE: under the unified custom server,
// request.url's host is the server's bind address, not the browser's host.
const redirectTo = (path: string) => new NextResponse(null, { status: 307, headers: { Location: path } });

export async function GET(request: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const session = await getSession();
  if (!session) {
    return redirectTo("/login");
  }

  const { key } = await ctx.params;
  const sys = await prisma.system.findUnique({ where: { key } });
  if (!sys || !sys.enabled) {
    return redirectTo("/");
  }

  const base = sys.openUrl.replace(/\/$/, "");
  const token = signSsoToken(key, session.username);
  const target = token ? `${base}/sso?token=${encodeURIComponent(token)}` : base;

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: "LAUNCH",
      entity: "System",
      entityId: sys.id,
      summary: `${session.username} opened ${sys.name}${token ? " via SSO" : ""}`,
    },
  });

  return NextResponse.redirect(target);
}
