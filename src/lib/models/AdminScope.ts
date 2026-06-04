import { Schema, model, models, type Model, type Types } from "mongoose";
import { ACCESS_TYPES, type AccessType } from "@/lib/constants";

export interface IAdminScope {
  _id: Types.ObjectId;
  adminId: Types.ObjectId;
  accessType: AccessType;
  createdAt: Date;
  updatedAt: Date;
}

const adminScopeSchema = new Schema<IAdminScope>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    accessType: {
      type: String,
      enum: [ACCESS_TYPES.ALL, ACCESS_TYPES.CUSTOM],
      default: ACCESS_TYPES.CUSTOM,
    },
  },
  { timestamps: true },
);

export const AdminScope: Model<IAdminScope> =
  (models.AdminScope as Model<IAdminScope>) ||
  model<IAdminScope>("AdminScope", adminScopeSchema);
