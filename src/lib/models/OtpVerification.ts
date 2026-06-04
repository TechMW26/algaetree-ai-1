import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IOtpVerification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  otpHash: string;
  purpose: string;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  lastSentAt: Date;
  createdAt: Date;
}

const otpSchema = new Schema<IOtpVerification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    otpHash: { type: String, required: true },
    purpose: { type: String, default: "login" },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    lastSentAt: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Auto-remove expired OTP documents.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpVerification: Model<IOtpVerification> =
  (models.OtpVerification as Model<IOtpVerification>) ||
  model<IOtpVerification>("OtpVerification", otpSchema);
