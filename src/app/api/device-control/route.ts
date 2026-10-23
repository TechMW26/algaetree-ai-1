import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/currentUser";
import { verifyTreeGuestToken } from "@/lib/auth/treeGuest";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getAccessibleTreeIds } from "@/lib/services/access";
import { TREE_GUEST_COOKIE } from "@/lib/constants";
import {
  asRecord,
  isDeviceOnline,
  normalizeRtdbUrl,
  readDevicePassword,
  resolveDevice,
} from "@/lib/device/rtdb";

type ControlPayload = {
  treeId: string;
  command?: number | null;
  label?: string;
  updates: Record<string, unknown>;
  currentPassword?: string;
  overwritePending?: boolean;
  verifyOnly?: boolean;
};

const COMMAND_CODES = new Set([1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
const PASSWORD_COMMANDS = new Set([1, 3, 4, 9, 25]);
const COMMERCIAL_ONLY_COMMANDS = new Set([8, 13, 15, 16, 20, 21, 22, 25]);
const BOOLEAN_PATH = /^Operations\/(LED[1-4]|AirBubble1|AirBubble2|AirBubble|Fan1|Fan2|Camera|Filling|PowerSaving|PowerSavingPermenent)$/;
const TIMING_PATH = /^Operations\/(AirBubble1Timing|AirBubble2Timing|AirBubbleTiming)\/(On|Off)$/;
const INTENSITY_PATH = /^Intensity\/(LED[1-4]|AirBubble1|AirBubble2|AirBubble)$/;
const WIFI_PATH = /^WiFi\/(SSID|Password)$/;
const DEVICE_INFO_PATH = /^DeviceInfo\/(DisplayPin|Password|InstallationDate)$/;
const LOCATION_PATH = /^Location\/(Name|Lat|Long)$/;
const SIM_PATH = /^DeviceInfo\/Sim\/(Number|RechargeDate|RechargeValidity)$/;
const CYCLE_PATH = /^Cycle\/(NewCycleStartDate|TotalCO2Absorbed|TotalO2Released|Data\/Count|Data\/\d+\/(StartDate|EndDate|CO2Captured|O2Released|Biomass))$/;

function isWholeNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function validDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return false;
  const [day, month, year] = value.split("/").map(Number);
  if (year < 2000 || year > 2100) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function validateUpdate(path: string, value: unknown): string | null {
  if (BOOLEAN_PATH.test(path)) return typeof value === "boolean" ? null : `${path} must be true or false`;
  if (TIMING_PATH.test(path)) return isWholeNumber(value, 1, 60) ? null : `${path} must be a whole number from 1 to 60`;
  if (INTENSITY_PATH.test(path)) return isWholeNumber(value, 0, 255) ? null : `${path} must be a whole number from 0 to 255`;
  if (WIFI_PATH.test(path)) {
    if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) return `${path} contains invalid characters`;
    if (path.endsWith("/SSID")) return value.length > 0 && new TextEncoder().encode(value).length <= 32 ? null : "Wi-Fi name must be 1–32 bytes";
    return value.length >= 8 && value.length <= 63 ? null : "Wi-Fi password must be 8–63 characters";
  }
  if (DEVICE_INFO_PATH.test(path)) {
    if (path.endsWith("/DisplayPin")) return isWholeNumber(value, 1000, 9999) ? null : "Display PIN must be exactly 4 digits and cannot start with 0";
    if (path.endsWith("/Password")) return typeof value === "string" && value.length >= 4 ? null : "Device password must be at least 4 characters";
    return validDate(value) ? null : "Installation date must be a valid DD/MM/YYYY date";
  }
  if (LOCATION_PATH.test(path)) {
    if (path.endsWith("/Name")) return typeof value === "string" && value.trim().length > 0 ? null : "Site name is required";
    if (typeof value !== "number" || !Number.isFinite(value)) return `${path} must be a number`;
    if (path.endsWith("/Lat")) return value >= -90 && value <= 90 ? null : "Latitude must be from -90 to 90";
    return value >= -180 && value <= 180 ? null : "Longitude must be from -180 to 180";
  }
  if (SIM_PATH.test(path)) {
    if (path.endsWith("/RechargeDate")) return validDate(value) ? null : "Recharge date must be DD/MM/YYYY";
    if (path.endsWith("/RechargeValidity")) return isWholeNumber(value, 1, 3650) ? null : "SIM validity must be a positive number of days";
    return (typeof value === "number" && /^\d{10,13}$/.test(String(value))) || (typeof value === "string" && /^\+\d{10,15}$/.test(value))
      ? null
      : "SIM number must be 10–13 digits, or + followed by 10–15 digits";
  }
  if (CYCLE_PATH.test(path)) {
    if (/(StartDate|EndDate|NewCycleStartDate)$/.test(path)) return validDate(value) ? null : `${path} must be DD/MM/YYYY`;
    if (path.endsWith("/Count")) return isWholeNumber(value, 0, 1_000_000) ? null : "Cycle count must be a whole number";
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? null : `${path} must be zero or greater`;
  }
  return "Unsupported update path";
}

function updateMatchesExistingHardware(path: string, data: Record<string, unknown>): boolean {
  if (!BOOLEAN_PATH.test(path) && !TIMING_PATH.test(path) && !INTENSITY_PATH.test(path)) return true;
  const [section, key] = path.split("/");
  const node = asRecord(data[section]);
  return key in node;
}

function needsPassword(body: ControlPayload): boolean {
  if (body.verifyOnly) return true;
  if (body.command != null && PASSWORD_COMMANDS.has(body.command)) return true;
  return Object.keys(body.updates).some((path) =>
    path === "DeviceInfo/Password" ||
    path === "DeviceInfo/DisplayPin" ||
    path.startsWith("WiFi/") ||
    path.startsWith("Cycle/Data/"),
  );
}

async function authorizeTreeControl(req: NextRequest, treeId: string): Promise<NextResponse | null> {
  const guestToken = req.cookies.get(TREE_GUEST_COOKIE)?.value;
  const guest = guestToken ? verifyTreeGuestToken(guestToken) : null;
  if (guest?.treeId === treeId) return null;

  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

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

async function waitForAcknowledgement(baseUrl: string, path: string): Promise<boolean> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      const response = await fetch(`${baseUrl}/${path}/Change.json`, { cache: "no-store" });
      if (response.ok && (await response.json()) === 0) return true;
    } catch {
      // The live listener continues to surface the pending command.
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ControlPayload;
    const treeId = typeof body?.treeId === "string" ? body.treeId.trim().toUpperCase() : "";
    if (!treeId || !body?.updates || typeof body.updates !== "object" || Array.isArray(body.updates)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    if (body.command != null && (!Number.isInteger(body.command) || !COMMAND_CODES.has(body.command))) {
      return NextResponse.json({ ok: false, error: "Unsupported command code" }, { status: 400 });
    }

    const authorizationError = await authorizeTreeControl(req, treeId);
    if (authorizationError) return authorizationError;

    const baseUrl = process.env.NEXT_PUBLIC_FIREBASE_RTDB_URL;
    if (!baseUrl) return NextResponse.json({ ok: false, error: "RTDB URL not configured" }, { status: 500 });
    const normalizedBase = normalizeRtdbUrl(baseUrl);
    const device = await resolveDevice(normalizedBase, treeId);
    if (!device) return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });

    if (device.family === "HomeAlgaeTree" && body.command != null && COMMERCIAL_ONLY_COMMANDS.has(body.command)) {
      return NextResponse.json({ ok: false, error: "This command is not supported by Home AlgaeTree" }, { status: 422 });
    }

    for (const [path, value] of Object.entries(body.updates)) {
      const error = validateUpdate(path, value);
      if (error) return NextResponse.json({ ok: false, error }, { status: 422 });
      if (!updateMatchesExistingHardware(path, device.data)) {
        return NextResponse.json({ ok: false, error: `${path} is not available on this device` }, { status: 422 });
      }
    }

    if (needsPassword(body) && body.currentPassword !== readDevicePassword(device.data)) {
      return NextResponse.json({ ok: false, error: "Incorrect device password" }, { status: 403 });
    }

    if (body.verifyOnly) {
      return NextResponse.json({ ok: true, verified: true, family: device.family, model: device.model });
    }

    if (body.command != null && !isDeviceOnline(device.data)) {
      return NextResponse.json({ ok: false, error: "Device is offline. Retry when it is online." }, { status: 409 });
    }

    const currentChange = Number(device.data.Change ?? 0);
    if (body.command != null && currentChange !== 0 && !body.overwritePending) {
      return NextResponse.json(
        {
          ok: false,
          error: "A device command is already pending",
          pendingCommand: currentChange,
          requiresOverwriteConfirmation: true,
        },
        { status: 409 },
      );
    }

    const atomicUpdate: Record<string, unknown> = { ...body.updates };
    if (body.command != null) atomicUpdate.Change = body.command;

    const patchResponse = await fetch(`${normalizedBase}/${device.path}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(atomicUpdate),
      cache: "no-store",
    });
    if (!patchResponse.ok) {
      return NextResponse.json(
        { ok: false, error: "Failed to update device", details: await patchResponse.text() },
        { status: 502 },
      );
    }

    const acknowledged = body.command == null
      ? true
      : await waitForAcknowledgement(normalizedBase, device.path);

    return NextResponse.json({
      ok: true,
      acknowledged,
      pending: !acknowledged,
      command: body.command ?? null,
      family: device.family,
      model: device.model,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Unexpected error", details: String(error) },
      { status: 500 },
    );
  }
}
