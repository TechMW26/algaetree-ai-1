import { type NextRequest, type NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/currentUser";
import { type AccessTokenPayload } from "@/lib/auth/jwt";
import { type Role } from "@/lib/constants";
import { fail } from "@/lib/http";

export type RbacResult =
  | { ok: true; auth: AccessTokenPayload }
  | { ok: false; response: NextResponse };

export function requireAuth(req: NextRequest): RbacResult {
  const auth = getAuth(req);
  if (!auth) return { ok: false, response: fail("Not authenticated", 401) };
  return { ok: true, auth };
}

export function requireRole(req: NextRequest, roles: Role[]): RbacResult {
  const result = requireAuth(req);
  if (!result.ok) return result;
  if (!roles.includes(result.auth.role)) {
    return { ok: false, response: fail("Forbidden", 403) };
  }
  return result;
}
