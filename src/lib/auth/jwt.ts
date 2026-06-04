import jwt, { type SignOptions } from "jsonwebtoken";
import { ACCESS_TOKEN_TTL, type Role } from "@/lib/constants";

export interface AccessTokenPayload {
  sub: string; // userId
  role: Role;
  email: string;
}

function accessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not set");
  return secret;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: ACCESS_TOKEN_TTL };
  return jwt.sign(payload, accessSecret(), options);
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, accessSecret());
    if (typeof decoded === "string") return null;
    const { sub, role, email } = decoded as Record<string, unknown>;
    if (typeof sub !== "string" || typeof role !== "string" || typeof email !== "string") {
      return null;
    }
    return { sub, role: role as Role, email };
  } catch {
    return null;
  }
}
