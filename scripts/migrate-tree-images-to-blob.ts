import mongoose from "mongoose";
import { put } from "@vercel/blob";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

interface LegacyImage {
  treeId?: unknown;
  data?: unknown;
  contentType?: unknown;
}

function toBuffer(value: unknown): Buffer | null {
  if (Buffer.isBuffer(value)) return value;
  if (value && typeof value === "object" && "buffer" in value) {
    const buffer = (value as { buffer: unknown }).buffer;
    if (Buffer.isBuffer(buffer)) return buffer;
    if (buffer instanceof Uint8Array) return Buffer.from(buffer);
  }
  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN) {
    throw new Error("Vercel Blob credentials are not set");
  }

  await mongoose.connect(uri, { bufferCommands: false });
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB connection is unavailable");

  const legacyImages = db.collection<LegacyImage>("algaetreeimages");
  const trees = db.collection("algaetrees");
  const cursor = legacyImages.find({});
  let migrated = 0;
  let skipped = 0;

  for await (const legacy of cursor) {
    const treeId = typeof legacy.treeId === "string" ? legacy.treeId : "";
    const contentType = typeof legacy.contentType === "string" ? legacy.contentType : "";
    const data = toBuffer(legacy.data);
    if (!treeId || !data || !ALLOWED_TYPES.has(contentType)) {
      skipped += 1;
      continue;
    }

    const tree = await trees.findOne({ treeId }, { projection: { imageUrl: 1 } });
    if (!tree || (typeof tree.imageUrl === "string" && tree.imageUrl)) {
      skipped += 1;
      continue;
    }

    const blob = await put(
      `algaetrees/${encodeURIComponent(treeId)}/legacy.${EXTENSIONS[contentType]}`,
      data,
      {
        access: "public",
        addRandomSuffix: true,
        cacheControlMaxAge: 31_536_000,
        contentType,
      },
    );
    await trees.updateOne({ treeId }, { $set: { imageUrl: blob.url } });
    migrated += 1;
  }

  console.info(`Legacy tree image migration complete: ${migrated} migrated, ${skipped} skipped.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
