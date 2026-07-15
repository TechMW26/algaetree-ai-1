import { type NextRequest } from "next/server";
import { del, put } from "@vercel/blob";
import { connectToDatabase } from "@/lib/db/mongoose";
import { requireRole } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/auth/audit";
import { AlgaeTree } from "@/lib/models/AlgaeTree";
import { updateTreeSchema } from "@/lib/validation/management";
import { fail, ok } from "@/lib/http";
import { ROLES } from "@/lib/constants";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

interface RouteContext {
  params: Promise<{ treeId: string }>;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const guard = requireRole(req, [ROLES.SUPER_ADMIN]);
  if (!guard.ok) return guard.response;

  const { treeId } = await ctx.params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Invalid form data", 400);
  }

  const parsed = updateTreeSchema.safeParse({
    name: form.get("name"),
    location: form.get("location") ?? "",
    city: form.get("city") ?? "",
    lat: form.get("lat"),
    lng: form.get("lng"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const image = form.get("image");
  if (image instanceof File && image.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
      return fail("Image must be a PNG, JPEG, or WebP file", 422);
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return fail("Image must be 4 MB or smaller", 422);
    }
  }

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  let uploadedUrl = "";
  try {
    const tree = await AlgaeTree.findOne({ treeId });
    if (!tree) return fail("AlgaeTree not found", 404);

    const previousImageUrl = tree.imageUrl;
    if (image instanceof File && image.size > 0) {
      const extension = IMAGE_EXTENSIONS[image.type];
      const blob = await put(
        `algaetrees/${encodeURIComponent(treeId)}/${Date.now()}.${extension}`,
        image,
        {
          access: "public",
          addRandomSuffix: true,
          cacheControlMaxAge: 31_536_000,
          contentType: image.type,
        },
      );
      uploadedUrl = blob.url;
      tree.imageUrl = blob.url;
    }

    tree.name = parsed.data.name;
    tree.location = parsed.data.location;
    tree.city = parsed.data.city;
    tree.lat = parsed.data.lat;
    tree.lng = parsed.data.lng;
    await tree.save();

    if (uploadedUrl && previousImageUrl && previousImageUrl !== uploadedUrl) {
      await del(previousImageUrl).catch(() => {
        // The new image is already linked; stale-blob cleanup is best effort.
      });
    }

    await recordAudit(guard.auth.sub, "ALGAETREE_UPDATED", {
      treeId,
      imageUpdated: image instanceof File && image.size > 0,
    });

    return ok({
      tree: {
        treeId: tree.treeId,
        name: tree.name,
        location: tree.location,
        city: tree.city,
        lat: tree.lat,
        lng: tree.lng,
        imageUrl: tree.imageUrl || "/Algaetree.png",
      },
    });
  } catch {
    if (uploadedUrl) {
      await del(uploadedUrl).catch(() => {
        // Best effort rollback if the MongoDB update fails.
      });
    }
    return fail("Failed to update AlgaeTree", 500);
  }
}
