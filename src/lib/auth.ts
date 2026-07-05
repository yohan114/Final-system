import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { resolvePortalSecret } from "./auth-secret";

// Unique cookie name so the portal never clobbers (or is clobbered by) a
// co-hosted system's session cookie.
const COOKIE_NAME = "portal_session";

let cachedSecret: Uint8Array | null = null;
let warnedDevFallback = false;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const configured = process.env.PORTAL_AUTH_SECRET;
  const { secret, usedFallback } = resolvePortalSecret(configured, process.env.NODE_ENV);
  if (usedFallback && !warnedDevFallback) {
    warnedDevFallback = true;
    console.warn("[auth] PORTAL_AUTH_SECRET not set — using the insecure development fallback secret.");
  }
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}

export interface PortalSession {
  userId: string;
  username: string;
  role: string;
  name: string;
}

export async function createSession(userId: string, username: string, role: string, name: string) {
  const payload: PortalSession = { userId, username, role, name };
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<PortalSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as PortalSession;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  const user = await prisma.portalUser.findUnique({ where: { id: session.userId } });
  if (!user || !user.active) throw new Error("UNAUTHORIZED");
  return user;
}
