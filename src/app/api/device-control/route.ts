import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/currentUser";
import { verifyTreeGuestToken } from "@/lib/auth/treeGuest";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getAccessibleTreeIds } from "@/lib/services/access";
import { TREE_GUEST_COOKIE } from "@/lib/constants";

type ControlPayload = {
  treeId: string;
  updates: Record<string, unknown>;
};

const ALLOWED_KEYS = [
  "Change",
  "Intensity",
  "Operations",
  "NutritionDosing",
];

/** Change codes that indicate the pod is busy processing a previous command. */
const BUSY_CHANGE_CODES = new Set([3, 4, 5]);

async function authorizeTreeControl(req: NextRequest, treeId: string): Promise<NextResponse | null> {
  const guestToken = req.cookies.get(TREE_GUEST_COOKIE)?.value;
  const guest = guestToken ? verifyTreeGuestToken(guestToken) : null;
  if (guest?.treeId === treeId) return null;

  const auth = getAuth(req);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const access = await getAccessibleTreeIds(auth.sub, auth.role);
    if (!access.all && !access.treeIds.includes(treeId)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Service unavailable" }, { status: 503 });
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ControlPayload;
    if (!body?.treeId || !body?.updates || typeof body.updates !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const authorizationError = await authorizeTreeControl(req, body.treeId);
    if (authorizationError) return authorizationError;

    const keys = Object.keys(body.updates);
    const hasInvalid = keys.some((k) => !ALLOWED_KEYS.includes(k));
    if (hasInvalid) {
      return NextResponse.json({ ok: false, error: "Unsupported update key" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_FIREBASE_RTDB_URL;
    if (!baseUrl) {
      return NextResponse.json({ ok: false, error: "RTDB URL not configured" }, { status: 500 });
    }

    const normUrl = baseUrl.replace(/\/$/, "");
    const treeNode = body.treeId.startsWith("AIAT") ? "AiAlgeeTree" : "AlgeeTree";
    const treePath = `${treeNode}/${encodeURIComponent(body.treeId)}`;

    // ── 1. Read current pod state first (never write without knowing the state) ──
    let currentState: { Change?: number } = {};
    try {
      const readRes = await fetch(`${normUrl}/${treePath}/Change.json`, { cache: "no-store" });
      if (readRes.ok) {
        const changeVal = await readRes.json();
        if (typeof changeVal === "number") currentState = { Change: changeVal };
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: "Could not read current device state" },
        { status: 502 },
      );
    }

    // ── 2. Reject if the pod is busy processing a previous command ──
    if (currentState.Change != null && BUSY_CHANGE_CODES.has(currentState.Change)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Device is busy. Please wait for the current operation to complete.",
          change: currentState.Change,
        },
        { status: 423 },
      );
    }

    // ── 3. Only proceed after confirming pod is ready ──
    const target = `${normUrl}/${treePath}.json`;
    const patchRes = await fetch(target, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.updates),
      cache: "no-store",
    });

    if (!patchRes.ok) {
      const text = await patchRes.text();
      return NextResponse.json(
        { ok: false, error: "Failed to update device", details: text },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Unexpected error", details: String(error) },
      { status: 500 },
    );
  }
}
