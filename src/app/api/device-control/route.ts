import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ControlPayload;
    if (!body?.treeId || !body?.updates || typeof body.updates !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const keys = Object.keys(body.updates);
    const hasInvalid = keys.some((k) => !ALLOWED_KEYS.includes(k));
    if (hasInvalid) {
      return NextResponse.json({ ok: false, error: "Unsupported update key" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_FIREBASE_RTDB_URL;
    if (!baseUrl) {
      return NextResponse.json({ ok: false, error: "RTDB URL not configured" }, { status: 500 });
    }

    const target = `${baseUrl.replace(/\/$/, "")}/AlgeeTree/${encodeURIComponent(body.treeId)}.json`;
    const patchRes = await fetch(target, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body.updates),
      cache: "no-store",
    });

    if (!patchRes.ok) {
      const text = await patchRes.text();
      return NextResponse.json(
        { ok: false, error: "Failed to update RTDB", details: text },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Unexpected error", details: String(error) },
      { status: 500 }
    );
  }
}
