import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { AdminScope } from "@/lib/models/AdminScope";
import { issueLoginOtp, type IssueOtpResult } from "@/lib/auth/otpService";
import { recordAudit } from "@/lib/auth/audit";
import { hashPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validation/auth";
import { ROLES, ACCESS_TYPES } from "@/lib/constants";
import { ok, fail, getClientIp } from "@/lib/http";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const { email } = parsed.data;

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  let user = await User.findOne({ email });

  // Auto-provision the super admin on first login so seed does not need to run first.
  if (!user && email === process.env.SEED_SUPER_ADMIN_EMAIL?.toLowerCase().trim()) {
    const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
    if (password) {
      user = await User.create({
        email,
        passwordHash: await hashPassword(password),
        role: ROLES.SUPER_ADMIN,
        createdBy: null,
        isActive: true,
      });
      await AdminScope.updateOne(
        { adminId: user._id },
        { $set: { accessType: ACCESS_TYPES.ALL } },
        { upsert: true },
      );
    }
  }

  // The user must exist to receive an OTP.
  if (!user) {
    await recordAudit(null, "LOGIN_FAILED", {
      email,
      reason: "no_user",
      ip: getClientIp(req),
    });
    return fail("This email is not registered", 404);
  }

  if (!user.isActive) {
    await recordAudit(user._id, "LOGIN_FAILED", {
      email,
      reason: "inactive",
      ip: getClientIp(req),
    });
    return fail("This account has been disabled", 403);
  }

  // Account lockout check.
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    return fail("Account temporarily locked. Try again later.", 423);
  }

  let otpResult: IssueOtpResult;
  try {
    otpResult = await issueLoginOtp(user._id, user.email);
  } catch {
    return fail(
      "We couldn't send the verification code. The mail server may be unavailable. Please try again.",
      502,
    );
  }

  if (!otpResult.ok) {
    return fail("An OTP was already sent. Please wait before requesting another.", 429, {
      requiresOtp: true,
      email: user.email,
      retryAfterMs: otpResult.retryAfterMs,
    });
  }

  await recordAudit(user._id, "LOGIN_OTP_ISSUED", { email, ip: getClientIp(req) });

  return ok({
    message: "OTP sent to your registered email",
    requiresOtp: true,
    email: user.email,
  });
}
