import { jwtVerify } from "jose";
import { type Role } from "@/lib/constants";

export interface EdgeAccessPayload {
  sub: string;
  role: Role;
  email: string;
}

/** Verify an access token in the Edge runtime (middleware) using jose. */
export async function verifyAccessTokenEdge(
  token: string,
): Promise<EdgeAccessPayload | null> {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const { sub, role, email } = payload as Record<string, unknown>;
    if (typeof sub !== "string" || typeof role !== "string" || typeof email !== "string") {
      return null;
    }
    return { sub, role: role as Role, email };
  } catch {
    return null;
  }
}
