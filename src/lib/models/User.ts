import { Schema, model, models, type Model, type Types } from "mongoose";
import { ROLE_VALUES, type Role } from "@/lib/constants";

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: Role;
  createdBy: Types.ObjectId | null;
  isActive: boolean;
  failedLoginAttempts: number;
  lockUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLE_VALUES, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isActive: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

export const User: Model<IUser> =
  (models.User as Model<IUser>) || model<IUser>("User", userSchema);
