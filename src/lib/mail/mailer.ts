import nodemailer, { type Transporter } from "nodemailer";

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });

  return cachedTransporter;
}

/**
 * Deliver a login OTP by email. Falls back to logging on the server console when
 * SMTP is not configured so local development still works.
 */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    // eslint-disable-next-line no-console
    console.info(`[OTP] (no SMTP configured) Code for ${to}: ${otp}`);
    return;
  }

  const from = process.env.SMTP_FROM ?? "AlgaeTree <no-reply@algaetree.ai>";

  await transporter.sendMail({
    from,
    to,
    subject: "Your AlgaeTree verification code",
    text: `Your verification code is ${otp}. It expires in 5 minutes.`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px;color:#16a34a">AlgaeTree</h2>
        <p style="margin:0 0 16px;font-size:14px;color:#334155">Use the code below to complete your sign in.</p>
        <div style="font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;padding:16px;background:#f0fdf4;border-radius:12px;color:#166534">${otp}</div>
        <p style="margin:16px 0 0;font-size:12px;color:#64748b">This code expires in 5 minutes. If you didn't request it, you can ignore this email.</p>
      </div>
    `,
  });
}
