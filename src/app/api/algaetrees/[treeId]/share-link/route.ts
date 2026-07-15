import crypto from "crypto";
import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { requireRole } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/auth/audit";
import { AlgaeTree } from "@/lib/models/AlgaeTree";
import { fail, ok } from "@/lib/http";
import { ROLES } from "@/lib/constants";

interface RouteContext {
  params: Promise<{ treeId: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const guard = requireRole(req, [ROLES.SUPER_ADMIN]);
  if (!guard.ok) return guard.response;

  const { treeId } = await ctx.params;
  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  const tree = await AlgaeTree.findOne({ treeId, isActive: true }).select("+publicAccessKey");
  if (!tree) return fail("AlgaeTree not found", 404);

  if (!tree.publicAccessKey) {
    tree.publicAccessKey = crypto.randomBytes(24).toString("base64url");
    await tree.save();
    await recordAudit(guard.auth.sub, "ALGAETREE_PUBLIC_LINK_CREATED", { treeId });
  }

  return ok({
    path: `/tree/${encodeURIComponent(treeId)}/${encodeURIComponent(tree.publicAccessKey)}`,
  });
}
