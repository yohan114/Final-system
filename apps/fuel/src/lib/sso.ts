import crypto from "node:crypto";

// Verifier for the Master Portal's single sign-on hand-off tokens
// (base64url(payload).base64url(hmac-sha256), shared secret FUEL_SSO_SECRET).
// Tokens are short-lived and single-use: the jti replay guard is in-memory,
// which holds because one process serves this app (unified or standalone).

const seenJti = new Map<string, number>(); // jti -> expiry (ms)

export function verifySsoToken(token: string): { username: string } | null {
  const secret = process.env.FUEL_SSO_SECRET;
  if (!secret || !token) return null;

  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: { u?: unknown; sys?: unknown; exp?: unknown; jti?: unknown };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
  } catch {
    return null;
  }
  if (payload.sys !== "fuel") return null;
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (typeof payload.jti !== "string" || !payload.jti || seenJti.has(payload.jti)) return null;
  if (typeof payload.u !== "string" || !payload.u) return null;

  seenJti.set(payload.jti, payload.exp * 1000);
  for (const [jti, expiry] of seenJti) if (expiry < Date.now()) seenJti.delete(jti);

  return { username: payload.u };
}
