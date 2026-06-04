import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { OtpVerification } from "@/lib/models/OtpVerification";
import { verifyOtp } from "@/lib/auth/otp";
import { signAccessToken } from "@/lib/auth/jwt";
import { createSession } from "@/lib/auth/tokens";
import { setAuthCookies } from "@/lib/auth/cookies";
import { recordAudit } from "@/lib/auth/audit";
import { verifyOtpSchema } from "@/lib/validation/auth";
import { ok, fail, getClientIp, getDeviceInfo } from "@/lib/http";
import { OTP_MAX_ATTEMPTS, ROLE_HOME, type Role } from "@/lib/constants";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body", 400);
  }

  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const { email, otp } = parsed.data;

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  const user = await User.findOne({ email });
  if (!user || !user.isActive) {
    return fail("Invalid or expired code", 401);
  }

  const record = await OtpVerification.findOne({
    userId: user._id,
    purpose: "login",
    verified: false,
  }).sort({ createdAt: -1 });

  if (!record) {
    return fail("Invalid or expired code", 401);
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    await OtpVerification.deleteOne({ _id: record._id });
    return fail("Code has expired. Please request a new one.", 401);
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await OtpVerification.deleteOne({ _id: record._id });
    return fail("Too many attempts. Please sign in again.", 429);
  }

  const matches = await verifyOtp(otp, record.otpHash);
  if (!matches) {
    record.attempts += 1;
    await record.save();
    await recordAudit(user._id, "OTP_FAILED", { email, ip: getClientIp(req) });
    return fail("Invalid or expired code", 401);
  }

  // Success — consume the OTP and establish a session.
  await OtpVerification.deleteOne({ _id: record._id });

  const refreshToken = await createSession({
    userId: user._id,
    deviceInfo: getDeviceInfo(req),
    ipAddress: getClientIp(req),
  });

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
  });

  await recordAudit(user._id, "LOGIN_SUCCESS", { email, ip: getClientIp(req) });

  const res = ok({
    message: "Authenticated",
    user: { email: user.email, role: user.role },
    redirect: ROLE_HOME[user.role as Role],
  });
  setAuthCookies(res, accessToken, refreshToken);
  return res;
}
