import crypto from "crypto";
import { cookies } from "next/headers";

// Unique per-system cookie name so this app can be co-hosted behind one domain
// alongside the other E&C systems without clobbering their `session` cookies.
const COOKIE_NAME = "mainstores_session";

const DEV_FALLBACK_SECRET = "default_auth_secret_for_main_stores_system_32_bytes";
const ALGORITHM = "aes-256-gcm";

// Resolve the encryption key lazily so `next build` (no runtime secrets) works;
// production refuses to run on the known fallback instead of silently using it.
// Prefer a system-scoped secret so a shared machine-level AUTH_SECRET on the box
// cannot leak into this app's key derivation.
let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const configured = process.env.MAINSTORES_AUTH_SECRET || process.env.AUTH_SECRET;
  if (!configured || configured === DEV_FALLBACK_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "MAINSTORES_AUTH_SECRET is not set (or is the known default). Set it to a long random value before running in production."
      );
    }
    console.warn("[auth] MAINSTORES_AUTH_SECRET not set — using the insecure development fallback secret.");
  }
  cachedKey = crypto.scryptSync(configured || DEV_FALLBACK_SECRET, "mainstores.session.v1", 32);
  return cachedKey;
}

// Password Hashing Settings
const ITERATIONS = 10000;
const KEY_LEN = 64;
const DIGEST = "sha512";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;
    const verifyHash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(verifyHash, "hex"));
  } catch (err) {
    return false;
  }
}

export function encryptSession(data: any): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
}

export function decryptSession(token: string): any | null {
  try {
    const [ivHex, encrypted, authTagHex] = token.split(":");
    if (!ivHex || !encrypted || !authTagHex) return null;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
  } catch (err) {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionToken) return null;
  return decryptSession(sessionToken);
}

export async function setSession(data: any) {
  const token = encryptSession(data);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
