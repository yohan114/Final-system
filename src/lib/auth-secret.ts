export const DEV_FALLBACK_SECRET = "default_portal_auth_secret_must_be_changed_in_env_file";

// Pure resolution of the JWT signing secret. Production refuses to run on the
// known fallback (unset or explicitly set to it); development falls back so
// local setups keep working. Prefer PORTAL_AUTH_SECRET so the portal never
// shares a signing key with a co-hosted system's AUTH_SECRET.
export function resolvePortalSecret(
  configured: string | undefined,
  nodeEnv: string | undefined
): { secret: string; usedFallback: boolean } {
  if (configured && configured !== DEV_FALLBACK_SECRET) {
    return { secret: configured, usedFallback: false };
  }
  if (nodeEnv === "production") {
    throw new Error(
      configured
        ? "PORTAL_AUTH_SECRET is set to the known development default. Set it to a long random value before running in production."
        : "PORTAL_AUTH_SECRET is not set. Refusing to sign or verify sessions in production — set PORTAL_AUTH_SECRET to a long random value."
    );
  }
  return { secret: DEV_FALLBACK_SECRET, usedFallback: true };
}
