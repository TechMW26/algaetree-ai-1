import { type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/currentUser";
import { ROLE_HOME, type Role } from "@/lib/constants";
import { ok, fail } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth) return fail("Not authenticated", 401);

  return ok({
    user: {
      id: auth.sub,
      email: auth.email,
      role: auth.role,
      home: ROLE_HOME[auth.role as Role],
    },
  });
}
