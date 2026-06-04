import crypto from "crypto";
import bcrypt from "bcryptjs";
import { OTP_LENGTH } from "@/lib/constants";

/** Generate a cryptographically secure numeric OTP of the configured length. */
export function generateOtp(length: number = OTP_LENGTH): string {
  let otp = "";
  for (let i = 0; i < length; i += 1) {
    otp += crypto.randomInt(0, 10).toString();
  }
  return otp;
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}
