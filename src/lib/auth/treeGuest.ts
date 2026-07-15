import jwt from "jsonwebtoken";
import { type NextResponse } from "next/server";
import { TREE_GUEST_COOKIE, TREE_GUEST_TTL_SECONDS } from "@/lib/constants";

export interface TreeGuestPayload {
  treeId: string;
  accessKey: string;
  type: "tree_guest";
}

function guestSecret(): string {
  const secret = process.env.TREE_GUEST_SECRET ?? process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("TREE_GUEST_SECRET or JWT_ACCESS_SECRET is not set");
  return secret;
}

export function signTreeGuestToken(treeId: string, accessKey: string): string {
  return jwt.sign(
    { treeId, accessKey, type: "tree_guest" } satisfies TreeGuestPayload,
    guestSecret(),
    { expiresIn: TREE_GUEST_TTL_SECONDS },
  );
}

export function verifyTreeGuestToken(token: string): TreeGuestPayload | null {
  try {
    const decoded = jwt.verify(token, guestSecret());
    if (typeof decoded === "string") return null;
    if (
      decoded.type !== "tree_guest" ||
      typeof decoded.treeId !== "string" ||
      typeof decoded.accessKey !== "string"
    ) {
      return null;
    }
    return {
      treeId: decoded.treeId,
      accessKey: decoded.accessKey,
      type: "tree_guest",
    };
  } catch {
    return null;
  }
}

export function setTreeGuestCookie(res: NextResponse, token: string): void {
  res.cookies.set(TREE_GUEST_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TREE_GUEST_TTL_SECONDS,
  });
}
