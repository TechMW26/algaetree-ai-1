import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { issueLoginOtp } from "@/lib/auth/otpService";
import { recordAudit } from "@/lib/auth/audit";
import { resendOtpSchema } from "@/lib/validation/auth";
import { ok, fail, getClientIp } from "@/lib/http";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body", 400);
  }

  const parsed = resendOtpSchema.safeParse(body);
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

  // Always return success to avoid leaking which emails exist.
  if (!user || !user.isActive) {
    return ok({ message: "If an account exists, a new code was sent." });
  }

  const result = await issueLoginOtp(user._id, user.email);
  if (!result.ok) {
    return fail("Please wait before requesting another code.", 429, {
      retryAfterMs: result.retryAfterMs,
    });
  }

  await recordAudit(user._id, "LOGIN_OTP_RESENT", { email, ip: getClientIp(req) });
  return ok({ message: "A new code was sent to your email." });
}
