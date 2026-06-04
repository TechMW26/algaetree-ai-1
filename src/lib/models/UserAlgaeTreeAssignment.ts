import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IUserAlgaeTreeAssignment {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  algaeTreeId: string;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
}

const assignmentSchema = new Schema<IUserAlgaeTreeAssignment>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  algaeTreeId: { type: String, required: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  assignedAt: { type: Date, default: () => new Date() },
});

// A user cannot be assigned the same tree twice.
assignmentSchema.index({ userId: 1, algaeTreeId: 1 }, { unique: true });

export const UserAlgaeTreeAssignment: Model<IUserAlgaeTreeAssignment> =
  (models.UserAlgaeTreeAssignment as Model<IUserAlgaeTreeAssignment>) ||
  model<IUserAlgaeTreeAssignment>("UserAlgaeTreeAssignment", assignmentSchema);
