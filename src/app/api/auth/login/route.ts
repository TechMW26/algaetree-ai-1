import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { verifyPassword } from "@/lib/auth/password";
import { issueLoginOtp } from "@/lib/auth/otpService";
import { recordAudit } from "@/lib/auth/audit";
import { loginSchema } from "@/lib/validation/auth";
import { ok, fail, getClientIp } from "@/lib/http";
import { MAX_FAILED_LOGINS, LOGIN_LOCK_MS } from "@/lib/constants";

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

  const { email, password } = parsed.data;

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  const user = await User.findOne({ email });

  // Generic error to avoid user enumeration.
  const invalidCreds = () => fail("Invalid email or password", 401);

  if (!user || !user.isActive) {
    await recordAudit(user?._id ?? null, "LOGIN_FAILED", {
      email,
      reason: !user ? "no_user" : "inactive",
      ip: getClientIp(req),
    });
    return invalidCreds();
  }

  // Account lockout check.
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    return fail("Account temporarily locked. Try again later.", 423);
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
      user.lockUntil = new Date(Date.now() + LOGIN_LOCK_MS);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    await recordAudit(user._id, "LOGIN_FAILED", { email, reason: "bad_password", ip: getClientIp(req) });
    return invalidCreds();
  }

  // Reset failure counters on a successful credential check.
  if (user.failedLoginAttempts !== 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
  }

  const otpResult = await issueLoginOtp(user._id, user.email);
  if (!otpResult.ok) {
    return fail("An OTP was already sent. Please wait before requesting another.", 429, {
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
