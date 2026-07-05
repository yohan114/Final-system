import { prisma } from "./db";
import { pollAllSystems } from "./systems";
import { computeAlerts } from "./alerts";
import { sendMail } from "./mailer";

// Compose the current alert state into an email digest and record the outcome.
// Recipients come from ALERT_DIGEST_TO (comma-separated), else the portal admins.

async function recipients(): Promise<string> {
  const configured = process.env.ALERT_DIGEST_TO;
  if (configured) return configured;
  const admins = await prisma.portalUser.findMany({
    where: { active: true, role: { in: ["MASTER_ADMIN", "DIRECTOR"] } },
    select: { username: true },
  });
  // Usernames aren't necessarily emails; fall back to a documented address.
  return admins.length > 0 ? admins.map((a) => a.username).join(", ") : "admin";
}

export async function buildAlertDigest() {
  const alerts = await computeAlerts();
  const when = new Date().toLocaleString();
  if (alerts.length === 0) {
    return {
      subject: "E&C Master Portal — all systems healthy",
      body: `As of ${when}, all systems are reachable. No action needed.`,
      alertCount: 0,
    };
  }
  const crit = alerts.filter((a) => a.severity === "critical").length;
  const lines = alerts.map(
    (a) => `- [${a.severity.toUpperCase()}] ${a.title} — ${a.detail}`
  );
  return {
    subject: `E&C Master Portal — ${alerts.length} alert${alerts.length === 1 ? "" : "s"}${crit ? ` (${crit} critical)` : ""}`,
    body: `As of ${when}:\n\n${lines.join("\n")}\n\nOpen the portal to drill in.`,
    alertCount: alerts.length,
  };
}

export async function sendAlertDigest() {
  // Refresh status first so the digest reflects live state.
  await pollAllSystems();
  const digest = await buildAlertDigest();
  const to = await recipients();
  const result = await sendMail(to, digest.subject, digest.body);
  const row = await prisma.outbox.create({
    data: {
      kind: "alert-digest",
      to,
      subject: digest.subject,
      body: digest.body,
      status: result.status,
      error: result.error,
    },
  });
  return { ...digest, to, status: result.status, outboxId: row.id };
}
