import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { AlgaeTree } from "@/lib/models/AlgaeTree";
import { verifyPassword } from "@/lib/auth/password";
import {
  setTreeGuestCookie,
  signTreeGuestToken,
  verifyTreeGuestToken,
} from "@/lib/auth/treeGuest";
import { recordAudit } from "@/lib/auth/audit";
import { fail, getClientIp, ok } from "@/lib/http";
import { TREE_GUEST_COOKIE } from "@/lib/constants";

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

type AttemptRecord = { count: number; resetAt: number };

declare global {
  var _treePinAttempts: Map<string, AttemptRecord> | undefined;
}

const attempts = global._treePinAttempts ?? new Map<string, AttemptRecord>();
if (!global._treePinAttempts) global._treePinAttempts = attempts;

interface RouteContext {
  params: Promise<{ treeId: string; accessKey: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { treeId, accessKey } = await ctx.params;
  const token = req.cookies.get(TREE_GUEST_COOKIE)?.value;
  const guest = token ? verifyTreeGuestToken(token) : null;
  if (!guest || guest.treeId !== treeId || guest.accessKey !== accessKey) {
    return fail("PIN required", 401);
  }
  return ok({ treeId });
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { treeId, accessKey } = await ctx.params;
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
  if (!/^\d{1,12}$/.test(pin)) return fail("Enter a valid PIN", 422);

  const attemptKey = `${getClientIp(req)}:${treeId}:${accessKey}`;
  const now = Date.now();
  const current = attempts.get(attemptKey);
  if (current && current.resetAt > now && current.count >= MAX_ATTEMPTS) {
    return fail("Too many attempts. Try again later.", 429, {
      retryAfterMs: current.resetAt - now,
    });
  }
  if (current && current.resetAt <= now) attempts.delete(attemptKey);

  try {
    await connectToDatabase();
  } catch {
    return fail("Service unavailable", 503);
  }

  const tree = await AlgaeTree.findOne({
    treeId,
    publicAccessKey: accessKey,
    isActive: true,
  }).select("+publicPin");
  if (!tree) return fail("This dashboard link is invalid", 404);

  if (!tree.publicPin) {
    return fail("Dashboard PIN is not configured for this tree", 503);
  }

  const matches = await verifyPassword(pin, tree.publicPin);
  if (!matches) {
    const latest = attempts.get(attemptKey);
    attempts.set(attemptKey, {
      count: (latest?.count ?? 0) + 1,
      resetAt: latest?.resetAt && latest.resetAt > now ? latest.resetAt : now + ATTEMPT_WINDOW_MS,
    });
    await recordAudit(null, "PUBLIC_TREE_PIN_FAILED", { treeId, ip: getClientIp(req) });
    return fail("Incorrect PIN", 401);
  }

  attempts.delete(attemptKey);
  const token = signTreeGuestToken(treeId, accessKey);
  const res = ok({ treeId });
  setTreeGuestCookie(res, token);
  await recordAudit(null, "PUBLIC_TREE_PIN_VERIFIED", { treeId, ip: getClientIp(req) });
  return res;
}
