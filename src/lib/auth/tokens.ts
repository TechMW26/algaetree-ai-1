import crypto from "crypto";
import { type Types } from "mongoose";
import { Session } from "@/lib/models/Session";
import { REFRESH_TOKEN_TTL_MS } from "@/lib/constants";

/** Opaque refresh token (high entropy random string). */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

/** Deterministic hash used to store/lookup refresh tokens without keeping plaintext. */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface CreateSessionInput {
  userId: Types.ObjectId;
  deviceInfo: string;
  ipAddress: string;
}

export async function createSession(input: CreateSessionInput): Promise<string> {
  const refreshToken = generateRefreshToken();
  await Session.create({
    userId: input.userId,
    refreshTokenHash: hashRefreshToken(refreshToken),
    deviceInfo: input.deviceInfo,
    ipAddress: input.ipAddress,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
  return refreshToken;
}

/**
 * Rotate a refresh token: validate the presented token against an active
 * session, then replace it with a fresh one (refresh-token rotation).
 * Returns the new refresh token and the owning userId, or null if invalid.
 */
export async function rotateSession(
  presentedToken: string,
): Promise<{ refreshToken: string; userId: Types.ObjectId } | null> {
  const hash = hashRefreshToken(presentedToken);
  const session = await Session.findOne({ refreshTokenHash: hash });

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const newToken = generateRefreshToken();
  session.refreshTokenHash = hashRefreshToken(newToken);
  session.expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await session.save();

  return { refreshToken: newToken, userId: session.userId };
}

export async function revokeSession(presentedToken: string): Promise<void> {
  await Session.deleteOne({ refreshTokenHash: hashRefreshToken(presentedToken) });
}
