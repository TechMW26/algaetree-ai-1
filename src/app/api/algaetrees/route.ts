import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { AlgaeTree } from "@/lib/models/AlgaeTree";
import { requireAuth, requireRole } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/auth/audit";
import { getAccessibleTreeIds } from "@/lib/services/access";
import { createTreeSchema } from "@/lib/validation/management";
import { ok, fail } from "@/lib/http";
import { ROLES } from "@/lib/constants";

// ── List AlgaeTrees the current user can access ──
export async function GET(req: NextRequest) {
  const guard = requireAuth(req);
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  const access = await getAccessibleTreeIds(guard.auth.sub, guard.auth.role);

  // Super Admin / ALL-scope admins see the whole registry.
  const filter = access.all
    ? { isActive: true }
    : { isActive: true, treeId: { $in: access.treeIds } };

  const trees = await AlgaeTree.find(filter)
    .select("treeId name location city lat lng")
    .sort({ treeId: 1 })
    .lean();

  return ok({ trees, all: access.all });
}

// ── Add a new AlgaeTree to the registry (Super Admin only) ──
// New trees are automatically accessible to ALL-scope admins (auto-grant rule)
// because access is resolved dynamically against the registry.
export async function POST(req: NextRequest) {
  const guard = requireRole(req, [ROLES.SUPER_ADMIN]);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body", 400);
  }

  const parsed = createTreeSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  const existing = await AlgaeTree.findOne({ treeId: parsed.data.treeId });
  if (existing) return fail("An AlgaeTree with this ID already exists", 409);

  const tree = await AlgaeTree.create({ ...parsed.data, isActive: true });

  await recordAudit(guard.auth.sub, "ALGAETREE_CREATED", { treeId: tree.treeId });

  return ok({ tree }, 201);
}
