import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { AlgaeTree } from "@/lib/models/AlgaeTree";
import { requireAuth, requireRole } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/auth/audit";
import { createTreeSchema } from "@/lib/validation/management";
import { ok, fail } from "@/lib/http";
import { ROLES } from "@/lib/constants";
import { getAccessibleTreeIds } from "@/lib/services/access";
import { asRecord, isDeviceOnline, readDeviceLocation, resolveDevice } from "@/lib/device/rtdb";

async function syncFirebaseTreeIdsToRegistry(normUrl: string) {
  const familyNames = ["AlgaeTree", "HomeAlgaeTree", "AlgeeTree", "AiAlgeeTree"];
  const familyResponses = await Promise.all(
    familyNames.map((family) => fetch(`${normUrl}/${family}.json?shallow=true`, { cache: "no-store" })),
  );
  const familyData = await Promise.all(
    familyResponses.map(async (response) => response.ok ? (await response.json()) as Record<string, unknown> : {}),
  );
  const keys = familyData.flatMap((data) => Object.keys(data).filter((key) => key !== "NoOfDevices"));
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) return;

  const existing = await AlgaeTree.find({ treeId: { $in: uniqueKeys } }).select("treeId").lean();
  const existingIds = new Set(existing.map((t) => t.treeId));
  const missing = uniqueKeys.filter((treeId) => !existingIds.has(treeId));
  if (missing.length === 0) return;

  await AlgaeTree.insertMany(
    missing.map((treeId) => ({
      treeId,
      name: treeId,
      location: "",
      city: "",
      lat: 0,
      lng: 0,
      isActive: true,
    })),
    { ordered: false },
  ).catch(() => {
    // Ignore duplicate-key races from concurrent requests.
  });
}

// ── List assigned AlgaeTrees from MongoDB, enriched with Firebase live status. ──
export async function GET(req: NextRequest) {
  const guard = requireAuth(req);
  if (!guard.ok) return guard.response;

  const baseUrl = process.env.NEXT_PUBLIC_FIREBASE_RTDB_URL;
  if (!baseUrl) return fail("Firebase not configured", 500);
  const normUrl = baseUrl.replace(/\/$/, "");

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  try {
    await syncFirebaseTreeIdsToRegistry(normUrl);
  } catch {
    // Existing DB registry remains authoritative if Firebase discovery is unavailable.
  }

  const access = await getAccessibleTreeIds(guard.auth.sub, guard.auth.role);
  const registryTrees = await AlgaeTree.find({
    isActive: true,
    ...(access.all ? {} : { treeId: { $in: access.treeIds } }),
  })
    .sort({ treeId: 1 })
    .lean();

  const treeEntries = await Promise.all(
    registryTrees.map(async (tree) => {
      const treeId = tree.treeId;
      let name = tree.name || treeId;
      let location = tree.location || "";
      let city = tree.city || "";
      let lat = tree.lat;
      let lng = tree.lng;
      let lastOnline = "";
      let online = false;

      try {
        const device = await resolveDevice(normUrl, treeId);
        if (device) {
          const info = asRecord(device.data.DeviceInfo);
          const deviceLocation = readDeviceLocation(device.data);
          const last = asRecord(device.data.LastOnline);
          const deviceId = info.DeviceID ?? device.data.DeviceID;
          if ((!tree.name || tree.name === treeId) && typeof deviceId === "string" && deviceId.trim()) name = deviceId;
          if (deviceLocation.name) {
            location = deviceLocation.name;
            if (!city) city = deviceLocation.name;
          }
          if (deviceLocation.latitude != null && deviceLocation.longitude != null) {
            lat = deviceLocation.latitude;
            lng = deviceLocation.longitude;
          }
          const date = typeof last.Date === "string" ? last.Date : "";
          const time = typeof last.Time === "string" ? last.Time : "";
          lastOnline = [date, time].filter(Boolean).join(" ");
          online = isDeviceOnline(device.data);
        }
      } catch {
        // Keep DB metadata and default offline status on Firebase failures.
      }

      return {
        treeId,
        name,
        location,
        city,
        lat,
        lng,
        online,
        lastOnline,
        isAi: treeId.startsWith("AIAT"),
        imageUrl: tree.imageUrl || "/Algaetree.png",
      };
    }),
  );

  return ok({ trees: treeEntries });
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
