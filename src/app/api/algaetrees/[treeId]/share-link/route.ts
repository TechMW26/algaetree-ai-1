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

  const tree = await AlgaeTree.collection.findOne(
    { treeId, isActive: true },
    { projection: { _id: 1, publicAccessKey: 1 } },
  );
  if (!tree) return fail("AlgaeTree not found", 404);

  let publicAccessKey = tree.publicAccessKey;
  if (!publicAccessKey) {
    const candidate = crypto.randomBytes(24).toString("base64url");
    const result = await AlgaeTree.collection.updateOne(
      {
        _id: tree._id,
        $or: [
          { publicAccessKey: { $exists: false } },
          { publicAccessKey: null },
          { publicAccessKey: "" },
        ],
      },
      { $set: { publicAccessKey: candidate } },
    );
    const updated = await AlgaeTree.collection.findOne(
      { _id: tree._id },
      { projection: { publicAccessKey: 1 } },
    );
    publicAccessKey = updated?.publicAccessKey;
    if (!publicAccessKey) return fail("Could not create dashboard link", 500);
    if (result.modifiedCount === 1) {
      await recordAudit(guard.auth.sub, "ALGAETREE_PUBLIC_LINK_CREATED", { treeId });
    }
  }

  return ok({
    path: `/tree/${encodeURIComponent(treeId)}/${encodeURIComponent(publicAccessKey)}`,
  });
}
