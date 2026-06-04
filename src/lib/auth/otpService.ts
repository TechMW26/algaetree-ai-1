import { type Types } from "mongoose";
import { OtpVerification } from "@/lib/models/OtpVerification";
import { generateOtp, hashOtp } from "@/lib/auth/otp";
import { sendOtpEmail } from "@/lib/mail/mailer";
import { OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS } from "@/lib/constants";

export interface IssueOtpResult {
  ok: boolean;
  retryAfterMs?: number;
}

/**
 * Create (or refresh) a login OTP for a user, store it hashed with an expiry,
 * and deliver it by email. Enforces a resend cooldown.
 */
export async function issueLoginOtp(
  userId: Types.ObjectId,
  email: string,
): Promise<IssueOtpResult> {
  const existing = await OtpVerification.findOne({
    userId,
    purpose: "login",
    verified: false,
  }).sort({ createdAt: -1 });

  if (existing) {
    const sinceLast = Date.now() - existing.lastSentAt.getTime();
    if (sinceLast < OTP_RESEND_COOLDOWN_MS) {
      return { ok: false, retryAfterMs: OTP_RESEND_COOLDOWN_MS - sinceLast };
    }
  }

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // Replace any previous unverified login OTPs for this user.
  await OtpVerification.deleteMany({ userId, purpose: "login", verified: false });
  await OtpVerification.create({
    userId,
    otpHash,
    purpose: "login",
    expiresAt,
    attempts: 0,
    verified: false,
    lastSentAt: new Date(),
  });

  await sendOtpEmail(email, otp);
  return { ok: true };
}
