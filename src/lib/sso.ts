import crypto from "node:crypto";

// Single sign-on hand-off: the portal signs a short-lived one-time token for a
// system; that system's /sso endpoint verifies it with the SAME shared secret
// and mints its own session for the matching local username. Compact HMAC
// format (base64url(payload).base64url(hmac-sha256)) — no dependencies, so the
// verifier is ~20 lines in every system regardless of stack.
//
// Secrets are per-system (<SYS>_SSO_SECRET). In the unified server both sides
// read the same variable, so setting it once enables the pair; unset = SSO off
// for that system and its tile falls back to a plain link.

const SSO_ENV: Record<string, string> = {
  fuel: "FUEL_SSO_SECRET",
  mainstores: "MAINSTORES_SSO_SECRET",
  workshop: "WORKSHOP_SSO_SECRET",
  oilbook: "OILBOOK_SSO_SECRET",
};

export const SSO_TOKEN_TTL_SECONDS = 60;

export function ssoSecretFor(systemKey: string): string | null {
  const envName = SSO_ENV[systemKey];
  return (envName && process.env[envName]) || null;
}

export function signSsoToken(systemKey: string, username: string): string | null {
  const secret = ssoSecretFor(systemKey);
  if (!secret) return null;
  const payload = Buffer.from(
    JSON.stringify({
      u: username,
      sys: systemKey,
      exp: Math.floor(Date.now() / 1000) + SSO_TOKEN_TTL_SECONDS,
      jti: crypto.randomBytes(8).toString("hex"),
    })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
