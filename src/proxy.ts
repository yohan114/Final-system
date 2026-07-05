import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 replaces middleware.ts with proxy.ts. This gate protects portal
// pages; every /api route self-authenticates, so the matcher excludes /api.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public: login page and static assets.
  if (
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.includes("favicon.ico") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  // Presence check only; full JWT verification happens in server components and
  // route handlers via getSession().
  const session = request.cookies.get("portal_session")?.value;
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|public).*)"],
};
