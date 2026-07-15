import { jwtVerify } from "jose";
import { type Role } from "@/lib/constants";

export interface EdgeAccessPayload {
  sub: string;
  role: Role;
  email: string;
}

export interface EdgeTreeGuestPayload {
  treeId: string;
  accessKey: string;
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

export async function verifyTreeGuestTokenEdge(
  token: string,
): Promise<EdgeTreeGuestPayload | null> {
  const secret = process.env.TREE_GUEST_SECRET ?? process.env.JWT_ACCESS_SECRET;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const { treeId, accessKey, type } = payload as Record<string, unknown>;
    if (
      type !== "tree_guest" ||
      typeof treeId !== "string" ||
      typeof accessKey !== "string"
    ) {
      return null;
    }
    return { treeId, accessKey };
  } catch {
    return null;
  }
}
