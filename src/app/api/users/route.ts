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
import { createUserSchema } from "@/lib/validation/management";
import { ok, fail } from "@/lib/http";
import { ROLES, ACCESS_TYPES } from "@/lib/constants";

// ── List users (scoped) ──
export async function GET(req: NextRequest) {
  const guard = requireRole(req, [ROLES.SUPER_ADMIN, ROLES.ADMIN]);
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  // Super Admin sees everyone; Admin sees only customers they created.
  const filter =
    guard.auth.role === ROLES.SUPER_ADMIN
      ? {}
      : { createdBy: guard.auth.sub, role: ROLES.CUSTOMER };

  const users = await User.find(filter)
    .select("email role isActive createdBy createdAt")
    .sort({ createdAt: -1 })
    .lean();

  return ok({ users });
}

// ── Create user ──
export async function POST(req: NextRequest) {
  const guard = requireRole(req, [ROLES.SUPER_ADMIN, ROLES.ADMIN]);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body", 400);
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const { email, role, accessType, treeIds = [] } = parsed.data;
  const creator = guard.auth;

  // Authorization rules on who can create whom.
  if (role === ROLES.ADMIN && creator.role !== ROLES.SUPER_ADMIN) {
    return fail("Only a Super Admin can create Admins", 403);
  }

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  const existing = await User.findOne({ email });
  if (existing) return fail("A user with this email already exists", 409);

  // Determine the set of trees the new user may be assigned.
  let resolvedTreeIds = [...new Set(treeIds)];
  let adminAccessType = accessType ?? ACCESS_TYPES.CUSTOM;

  if (role === ROLES.ADMIN) {
    // Super Admin creating an Admin. ALL or CUSTOM scope.
    if (adminAccessType === ACCESS_TYPES.CUSTOM) {
      if (!(await validateTreeIdsExist(resolvedTreeIds))) {
        return fail("One or more AlgaeTree IDs are invalid", 422);
      }
    } else {
      resolvedTreeIds = []; // ALL scope is dynamic, no explicit assignments
    }
  } else {
    // Creating a Customer. Customers never get an "ALL" scope.
    if (resolvedTreeIds.length > 0) {
      if (!(await validateTreeIdsExist(resolvedTreeIds))) {
        return fail("One or more AlgaeTree IDs are invalid", 422);
      }
      // An Admin can only assign trees within their own scope.
      if (creator.role === ROLES.ADMIN) {
        const scope = await getAccessibleTreeIds(creator.sub, creator.role);
        if (!scope.all) {
          const allowed = new Set(scope.treeIds);
          const outOfScope = resolvedTreeIds.filter((id) => !allowed.has(id));
          if (outOfScope.length > 0) {
            return fail("Cannot assign AlgaeTrees outside your access scope", 403);
          }
        }
      }
    }
  }

  const user = await User.create({
    email,
    role,
    createdBy: creator.sub,
    isActive: true,
  });

  if (role === ROLES.ADMIN) {
    await AdminScope.updateOne(
      { adminId: user._id },
      { $set: { accessType: adminAccessType } },
      { upsert: true },
    );
    if (adminAccessType === ACCESS_TYPES.CUSTOM) {
      await setUserAssignments(user._id, resolvedTreeIds, creator.sub);
    }
  } else if (resolvedTreeIds.length > 0) {
    await setUserAssignments(user._id, resolvedTreeIds, creator.sub);
  }

  await recordAudit(creator.sub, "USER_CREATED", {
    createdUserId: user._id.toString(),
    email,
    role,
    accessType: role === ROLES.ADMIN ? adminAccessType : undefined,
    treeIds: resolvedTreeIds,
  });

  return ok(
    { user: { id: user._id.toString(), email: user.email, role: user.role } },
    201,
  );
}
