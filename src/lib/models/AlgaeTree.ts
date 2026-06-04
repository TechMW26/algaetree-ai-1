import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * Registry of AlgaeTrees. This stores ONLY metadata used for access control and
 * map placement (id, display name, coordinates, location label).
 *
 * Live telemetry, device status and real-time data continue to live in Firebase
 * Realtime Database under /AlgeeTree/{treeId} and are NOT duplicated here.
 */
export interface IAlgaeTree {
  _id: Types.ObjectId;
  treeId: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const algaeTreeSchema = new Schema<IAlgaeTree>(
  {
    treeId: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, default: "" },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const AlgaeTree: Model<IAlgaeTree> =
  (models.AlgaeTree as Model<IAlgaeTree>) ||
  model<IAlgaeTree>("AlgaeTree", algaeTreeSchema);
