import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const session = request.cookies.get("mainstores_session")?.value;
  const { pathname } = request.nextUrl;

  // Bypass authentication check for login, assets, static uploads, and favicon
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Redirect to /login if no session is present
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Apply middleware to all routes except API routes and next static assets
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
