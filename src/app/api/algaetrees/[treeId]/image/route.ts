import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { AlgaeTree } from "@/lib/models/AlgaeTree";

interface RouteContext {
  params: Promise<{ treeId: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { treeId } = await ctx.params;

  try {
    await connectToDatabase();
    const tree = await AlgaeTree.findOne({ treeId }).select("imageUrl").lean();
    if (tree?.imageUrl) {
      const response = NextResponse.redirect(tree.imageUrl, 307);
      response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
      return response;
    }
  } catch {
    // Fall back to the bundled default artwork.
  }

  const response = NextResponse.redirect(new URL("/Algaetree.png", req.url), 307);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
