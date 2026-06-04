import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { AdminScope } from "@/lib/models/AdminScope";
import { requireRole } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/auth/audit";
import {
  getAccessibleTreeIds,
  setUserAssignments,
  validateTreeIdsExist,
} from "@/lib/services/access";
import { assignTreesSchema } from "@/lib/validation/management";
import { ok, fail } from "@/lib/http";
import { ROLES, ACCESS_TYPES } from "@/lib/constants";

// ── Get a user's current assignments ──
export async function GET(req: NextRequest) {
  const guard = requireRole(req, [ROLES.SUPER_ADMIN, ROLES.ADMIN]);
  if (!guard.ok) return guard.response;

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return fail("userId query parameter is required", 422);

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  const target = await User.findById(userId).select("role createdBy").lean();
  if (!target) return fail("User not found", 404);

  if (
    guard.auth.role === ROLES.ADMIN &&
    (target.role !== ROLES.CUSTOMER || String(target.createdBy) !== guard.auth.sub)
  ) {
    return fail("Forbidden", 403);
  }

  const access = await getAccessibleTreeIds(userId, target.role);
  return ok({ access });
}

// ── Assign / update a user's AlgaeTree access ──
export async function POST(req: NextRequest) {
  const guard = requireRole(req, [ROLES.SUPER_ADMIN, ROLES.ADMIN]);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body", 400);
  }

  const parsed = assignTreesSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const { userId, accessType, treeIds = [] } = parsed.data;
  const actor = guard.auth;

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  const target = await User.findById(userId).select("role createdBy").lean();
  if (!target) return fail("User not found", 404);
  if (target.role === ROLES.SUPER_ADMIN) {
    return fail("Cannot modify Super Admin access", 403);
  }

  const uniqueTreeIds = [...new Set(treeIds)];

  // ── Assigning to an Admin (Super Admin only) ──
  if (target.role === ROLES.ADMIN) {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      return fail("Only a Super Admin can assign Admin access", 403);
    }
    const type = accessType ?? ACCESS_TYPES.CUSTOM;

    if (type === ACCESS_TYPES.ALL) {
      await AdminScope.updateOne(
        { adminId: userId },
        { $set: { accessType: ACCESS_TYPES.ALL } },
        { upsert: true },
      );
      await setUserAssignments(userId, [], actor.sub); // ALL is dynamic
    } else {
      if (!(await validateTreeIdsExist(uniqueTreeIds))) {
        return fail("One or more AlgaeTree IDs are invalid", 422);
      }
      await AdminScope.updateOne(
        { adminId: userId },
        { $set: { accessType: ACCESS_TYPES.CUSTOM } },
        { upsert: true },
      );
      await setUserAssignments(userId, uniqueTreeIds, actor.sub);
    }

    await recordAudit(actor.sub, "ADMIN_ACCESS_ASSIGNED", { adminId: userId, accessType: type, treeIds: uniqueTreeIds });
    return ok({ message: "Admin access updated", accessType: type });
  }

  // ── Assigning to a Customer ──
  if (
    actor.role === ROLES.ADMIN &&
    String(target.createdBy) !== actor.sub
  ) {
    return fail("Forbidden", 403);
  }

  if (!(await validateTreeIdsExist(uniqueTreeIds))) {
    return fail("One or more AlgaeTree IDs are invalid", 422);
  }

  // Admins can only assign within their own scope.
  if (actor.role === ROLES.ADMIN) {
    const scope = await getAccessibleTreeIds(actor.sub, actor.role);
    if (!scope.all) {
      const allowed = new Set(scope.treeIds);
      const outOfScope = uniqueTreeIds.filter((id) => !allowed.has(id));
      if (outOfScope.length > 0) {
        return fail("Cannot assign AlgaeTrees outside your access scope", 403);
      }
    }
  }

  await setUserAssignments(userId, uniqueTreeIds, actor.sub);
  await recordAudit(actor.sub, "CUSTOMER_ACCESS_ASSIGNED", { customerId: userId, treeIds: uniqueTreeIds });
  return ok({ message: "Customer access updated", treeIds: uniqueTreeIds });
}
