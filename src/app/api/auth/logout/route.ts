import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { revokeSession } from "@/lib/auth/tokens";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { getAuth } from "@/lib/auth/currentUser";
import { recordAudit } from "@/lib/auth/audit";
import { ok } from "@/lib/http";
import { REFRESH_COOKIE } from "@/lib/constants";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    try {
      await connectToDatabase();
      await revokeSession(refreshToken);
    } catch {
      // Best effort — still clear cookies below.
    }
  }

  const auth = getAuth(req);
  if (auth) await recordAudit(auth.sub, "LOGOUT", { email: auth.email });

  const res = ok({ message: "Signed out" });
  clearAuthCookies(res);
  return res;
}
