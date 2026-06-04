import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { requireRole } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/auth/audit";
import { getAccessibleTreeIds } from "@/lib/services/access";
import { updateUserSchema } from "@/lib/validation/management";
import { ok, fail } from "@/lib/http";
import { ROLES } from "@/lib/constants";

interface RouteContext {
  params: Promise<{ uid: string }>;
}

// ── Get a single user with their assigned trees ──
export async function GET(req: NextRequest, ctx: RouteContext) {
  const guard = requireRole(req, [ROLES.SUPER_ADMIN, ROLES.ADMIN]);
  if (!guard.ok) return guard.response;

  const { uid } = await ctx.params;

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  const user = await User.findById(uid).select("email role isActive createdBy createdAt").lean();
  if (!user) return fail("User not found", 404);

  // Admins may only inspect customers they created.
  if (
    guard.auth.role === ROLES.ADMIN &&
    (user.role !== ROLES.CUSTOMER || String(user.createdBy) !== guard.auth.sub)
  ) {
    return fail("Forbidden", 403);
  }

  const access = await getAccessibleTreeIds(uid, user.role);
  return ok({ user, access });
}

// ── Update a user (activate / deactivate) ──
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const guard = requireRole(req, [ROLES.SUPER_ADMIN, ROLES.ADMIN]);
  if (!guard.ok) return guard.response;

  const { uid } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body", 400);
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  const user = await User.findById(uid);
  if (!user) return fail("User not found", 404);

  // Admins may only modify customers they created. Nobody edits a Super Admin here.
  if (user.role === ROLES.SUPER_ADMIN) {
    return fail("Cannot modify a Super Admin", 403);
  }
  if (
    guard.auth.role === ROLES.ADMIN &&
    (user.role !== ROLES.CUSTOMER || String(user.createdBy) !== guard.auth.sub)
  ) {
    return fail("Forbidden", 403);
  }

  if (typeof parsed.data.isActive === "boolean") {
    user.isActive = parsed.data.isActive;
  }
  await user.save();

  await recordAudit(guard.auth.sub, "USER_UPDATED", {
    targetUserId: uid,
    isActive: user.isActive,
  });

  return ok({ user: { id: user._id.toString(), email: user.email, isActive: user.isActive } });
}
