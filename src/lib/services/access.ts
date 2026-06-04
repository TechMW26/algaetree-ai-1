import { type Types } from "mongoose";
import { AlgaeTree } from "@/lib/models/AlgaeTree";
import { AdminScope } from "@/lib/models/AdminScope";
import { UserAlgaeTreeAssignment } from "@/lib/models/UserAlgaeTreeAssignment";
import { ACCESS_TYPES, ROLES, type Role } from "@/lib/constants";

/** All active tree IDs in the registry. */
export async function getAllTreeIds(): Promise<string[]> {
  const trees = await AlgaeTree.find({ isActive: true }).select("treeId").lean();
  return trees.map((t) => t.treeId);
}

export interface AccessResult {
  /** True when the user can access every tree (incl. future ones). */
  all: boolean;
  treeIds: string[];
}

/**
 * Resolve the set of AlgaeTrees a user can access.
 * - SUPER_ADMIN: all (always, incl. future trees)
 * - ADMIN with scope ALL: all (incl. future trees — auto-grant rule)
 * - ADMIN with scope CUSTOM / CUSTOMER: explicitly assigned trees only
 */
export async function getAccessibleTreeIds(
  userId: Types.ObjectId | string,
  role: Role,
): Promise<AccessResult> {
  if (role === ROLES.SUPER_ADMIN) {
    return { all: true, treeIds: await getAllTreeIds() };
  }

  if (role === ROLES.ADMIN) {
    const scope = await AdminScope.findOne({ adminId: userId }).lean();
    if (scope?.accessType === ACCESS_TYPES.ALL) {
      return { all: true, treeIds: await getAllTreeIds() };
    }
  }

  const assignments = await UserAlgaeTreeAssignment.find({ userId })
    .select("algaeTreeId")
    .lean();
  return { all: false, treeIds: assignments.map((a) => a.algaeTreeId) };
}

/** Validate that all requested tree IDs exist in the registry. */
export async function validateTreeIdsExist(treeIds: string[]): Promise<boolean> {
  if (treeIds.length === 0) return true;
  const count = await AlgaeTree.countDocuments({
    treeId: { $in: treeIds },
    isActive: true,
  });
  return count === new Set(treeIds).size;
}

/**
 * Replace a user's explicit tree assignments with the provided set.
 * Used for CUSTOM admin scopes and customer assignments.
 */
export async function setUserAssignments(
  userId: Types.ObjectId | string,
  treeIds: string[],
  assignedBy: Types.ObjectId | string,
): Promise<void> {
  await UserAlgaeTreeAssignment.deleteMany({ userId });
  if (treeIds.length === 0) return;
  const unique = [...new Set(treeIds)];
  await UserAlgaeTreeAssignment.insertMany(
    unique.map((algaeTreeId) => ({ userId, algaeTreeId, assignedBy })),
    { ordered: false },
  );
}
