import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ISession {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  refreshTokenHash: string;
  deviceInfo: string;
  ipAddress: string;
  createdAt: Date;
  expiresAt: Date;
}

const sessionSchema = new Schema<ISession>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  refreshTokenHash: { type: String, required: true, index: true },
  deviceInfo: { type: String, default: "" },
  ipAddress: { type: String, default: "" },
  createdAt: { type: Date, default: () => new Date() },
  expiresAt: { type: Date, required: true },
});

// Auto-remove expired sessions.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session: Model<ISession> =
  (models.Session as Model<ISession>) || model<ISession>("Session", sessionSchema);
