import nodemailer from "nodemailer";

// Minimal mailer: sends via SMTP when SMTP_HOST is configured, otherwise
// "simulates" (returns simulated) so the digest works — and is recordable and
// testable — before any SMTP is wired. Same graceful-degradation pattern the
// E&C systems already use.

export interface MailResult {
  status: "sent" | "simulated" | "failed";
  error?: string;
}

export async function sendMail(to: string, subject: string, text: string): Promise<MailResult> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return { status: "simulated" };
  }
  try {
    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || "E&C Master Portal <portal@ec-workshops.online>",
      to,
      subject,
      text,
    });
    return { status: "sent" };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}
