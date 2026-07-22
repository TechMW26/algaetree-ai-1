import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { requireRole } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/auth/audit";
import { AlgaeTree } from "@/lib/models/AlgaeTree";
import { hashPassword } from "@/lib/auth/password";
import { fail, ok } from "@/lib/http";
import { ROLES } from "@/lib/constants";

interface RouteContext {
  params: Promise<{ treeId: string }>;
}

// PATCH — set or update the dashboard PIN for a tree
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const guard = requireRole(req, [ROLES.SUPER_ADMIN]);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body", 400);
  }

  const pin =
    body && typeof body === "object" && "pin" in body
      ? String((body as { pin: unknown }).pin).trim()
      : "";

  if (!/^\d{4,12}$/.test(pin)) {
    return fail("PIN must be 4–12 digits", 422);
  }

  const { treeId } = await ctx.params;

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  const hashed = await hashPassword(pin);

  const result = await AlgaeTree.updateOne(
    { treeId, isActive: true },
    { $set: { publicPin: hashed } },
  );

  if (result.matchedCount === 0) {
    return fail("AlgaeTree not found", 404);
  }

  await recordAudit(guard.auth.sub, "ALGAETREE_PIN_SET", { treeId });
  return ok({ success: true });
}

// DELETE — remove the dashboard PIN for a tree
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const guard = requireRole(req, [ROLES.SUPER_ADMIN]);
  if (!guard.ok) return guard.response;

  const { treeId } = await ctx.params;

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  await AlgaeTree.updateOne(
    { treeId, isActive: true },
    { $unset: { publicPin: "" } },
  );

  await recordAudit(guard.auth.sub, "ALGAETREE_PIN_REMOVED", { treeId });
  return ok({ success: true });
}
