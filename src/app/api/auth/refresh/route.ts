import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { rotateSession } from "@/lib/auth/tokens";
import { signAccessToken } from "@/lib/auth/jwt";
import { setAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";
import { ok, fail } from "@/lib/http";
import { REFRESH_COOKIE } from "@/lib/constants";

export async function POST(req: NextRequest) {
  const presented = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!presented) return fail("No session", 401);

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  const rotated = await rotateSession(presented);
  if (!rotated) {
    const res = fail("Session expired", 401);
    clearAuthCookies(res);
    return res;
  }

  const user = await User.findById(rotated.userId);
  if (!user || !user.isActive) {
    const res = fail("Session expired", 401);
    clearAuthCookies(res);
    return res;
  }

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
  });

  const res = ok({ user: { email: user.email, role: user.role } });
  setAuthCookies(res, accessToken, rotated.refreshToken);
  return res;
}
