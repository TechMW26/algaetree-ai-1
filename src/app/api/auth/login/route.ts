import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { issueLoginOtp } from "@/lib/auth/otpService";
import { recordAudit } from "@/lib/auth/audit";
import { loginSchema } from "@/lib/validation/auth";
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

  const user = await User.findOne({ email });

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
