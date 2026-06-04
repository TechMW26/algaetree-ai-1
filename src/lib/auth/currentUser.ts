import { type NextRequest } from "next/server";
import { verifyAccessToken, type AccessTokenPayload } from "@/lib/auth/jwt";
import { ACCESS_COOKIE } from "@/lib/constants";

/** Read and verify the access token from the request cookies. */
export function getAuth(req: NextRequest): AccessTokenPayload | null {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}
