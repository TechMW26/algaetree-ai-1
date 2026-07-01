import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { AlgaeTree } from "@/lib/models/AlgaeTree";
import { requireAuth, requireRole } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/auth/audit";
import { createTreeSchema } from "@/lib/validation/management";
import { ok, fail } from "@/lib/http";
import { ROLES } from "@/lib/constants";
import { getAccessibleTreeIds } from "@/lib/services/access";

function parseDdMmYyyy(value?: string): Date | null {
  if (!value) return null;
  const [dd, mm, yyyy] = value.split("/").map(Number);
  if (!dd || !mm || !yyyy) return null;
  const dt = new Date(yyyy, mm - 1, dd);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function diffDays(fromDate?: string): number {
  const start = parseDdMmYyyy(fromDate);
  if (!start) return Number.POSITIVE_INFINITY;
  const ms = Date.now() - start.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

async function syncFirebaseTreeIdsToRegistry(normUrl: string) {
  const [algeeRes, aiRes] = await Promise.all([
    fetch(`${normUrl}/AlgeeTree.json?shallow=true`, { cache: "no-store" }),
    fetch(`${normUrl}/AiAlgeeTree.json?shallow=true`, { cache: "no-store" }),
  ]);
  const algeeData: Record<string, unknown> = algeeRes.ok ? await algeeRes.json() : {};
  const aiData: Record<string, unknown> = aiRes.ok ? await aiRes.json() : {};
  const keys = [
    ...Object.keys(algeeData).filter((k) => k !== "NoOfDevices"),
    ...Object.keys(aiData).filter((k) => k !== "NoOfDevices"),
  ];
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
      const node = treeId.startsWith("AIAT") ? "AiAlgeeTree" : "AlgeeTree";
      let name = tree.name || treeId;
      let location = tree.location || "";
      let lastOnline = "";
      let online = false;

      try {
        const [devRes, locRes, lastOnlineRes] = await Promise.all([
          fetch(`${normUrl}/${node}/${encodeURIComponent(treeId)}/DeviceID.json`, { cache: "no-store" }),
          fetch(`${normUrl}/${node}/${encodeURIComponent(treeId)}/Location.json`, { cache: "no-store" }),
          fetch(`${normUrl}/${node}/${encodeURIComponent(treeId)}/LastOnline.json`, { cache: "no-store" }),
        ]);

        if (devRes.ok) {
          const devId = await devRes.json();
          if (typeof devId === "string" && devId.trim()) name = devId;
        }
        if (locRes.ok) {
          const loc = await locRes.json();
          if (typeof loc === "string" && loc.trim()) location = loc;
        }
        if (lastOnlineRes.ok) {
          const last = await lastOnlineRes.json();
          if (last && typeof last === "object") {
            const value = last as { Date?: unknown; Time?: unknown };
            const date = typeof value.Date === "string" ? value.Date : "";
            const time = typeof value.Time === "string" ? value.Time : "";
            lastOnline = [date, time].filter(Boolean).join(" ");
            online = diffDays(date) <= 1;
          }
        }
      } catch {
        // Keep DB metadata and default offline status on Firebase failures.
      }

      return {
        treeId,
        name,
        location,
        city: tree.city || "",
        lat: tree.lat,
        lng: tree.lng,
        online,
        lastOnline,
        isAi: treeId.startsWith("AIAT"),
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
