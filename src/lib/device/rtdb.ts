export const DEVICE_FAMILIES = ["AlgaeTree", "HomeAlgaeTree"] as const;

export type DeviceFamily = (typeof DEVICE_FAMILIES)[number];
export type DeviceModel = "commercial" | "home-display" | "home-compact" | "legacy";

export type ResolvedDevice = {
  family: DeviceFamily | "AlgeeTree" | "AiAlgeeTree";
  model: DeviceModel;
  path: string;
  data: Record<string, unknown>;
};

export type DeviceLocation = {
  name: string;
  latitude: number | null;
  longitude: number | null;
};

const LEGACY_FAMILIES = ["AlgeeTree", "AiAlgeeTree"] as const;

export function familyCandidates(treeId: string): readonly string[] {
  const normalized = treeId.trim().toUpperCase();
  if (normalized.startsWith("HA")) {
    return ["HomeAlgaeTree", "AlgaeTree", ...LEGACY_FAMILIES];
  }
  if (normalized.startsWith("AIAT")) {
    return ["AlgaeTree", "AiAlgeeTree", "AlgeeTree", "HomeAlgaeTree"];
  }
  return ["AlgaeTree", "HomeAlgaeTree", ...LEGACY_FAMILIES];
}

export function modelForDevice(
  family: ResolvedDevice["family"],
  data: Record<string, unknown>,
): DeviceModel {
  if (family === "AlgaeTree") return "commercial";
  if (family === "HomeAlgaeTree") {
    const info = asRecord(data.DeviceInfo);
    const pin = info.DisplayPin;
    return pin == null ? "home-compact" : "home-display";
  }
  return "legacy";
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeRtdbUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export async function resolveDevice(
  baseUrl: string,
  treeId: string,
): Promise<ResolvedDevice | null> {
  const normalizedBase = normalizeRtdbUrl(baseUrl);
  const normalizedId = treeId.trim().toUpperCase();

  for (const family of familyCandidates(normalizedId)) {
    const path = `${family}/${encodeURIComponent(normalizedId)}`;
    const response = await fetch(`${normalizedBase}/${path}.json`, { cache: "no-store" });
    if (!response.ok) continue;
    const data = (await response.json()) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) continue;
    const record = data as Record<string, unknown>;
    return {
      family: family as ResolvedDevice["family"],
      model: modelForDevice(family as ResolvedDevice["family"], record),
      path,
      data: record,
    };
  }

  return null;
}

function parseNumericTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const timestamp = value < 10_000_000_000 ? value * 1000 : value;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function parseIstHeartbeat(dateValue: unknown, timeValue?: unknown): number | null {
  const numeric = parseNumericTimestamp(dateValue);
  if (numeric != null) return numeric;
  if (typeof dateValue !== "string") return null;

  const date = dateValue.trim();
  const time = typeof timeValue === "string" ? timeValue.trim() : "";
  if (!time) {
    const parsed = Date.parse(date);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const dateParts = date.split(/[\/-]/).map(Number);
  if (dateParts.length !== 3 || !dateParts.every(Number.isFinite)) return null;
  const [first, second, third] = dateParts;
  const [year, month, day] = first > 999
    ? [first, second, third]
    : [third, second, first];

  const timeMatch = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!timeMatch) return null;
  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const secondValue = Number(timeMatch[3] ?? 0);
  const meridiem = timeMatch[4]?.toUpperCase();
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (meridiem === "PM" ? 12 : 0);
  }
  if (hour > 23 || minute > 59 || secondValue > 59) return null;

  const utcTimestamp = Date.UTC(year, month - 1, day, hour, minute, secondValue) - 330 * 60_000;
  const istCheck = new Date(utcTimestamp + 330 * 60_000);
  if (
    istCheck.getUTCFullYear() !== year ||
    istCheck.getUTCMonth() !== month - 1 ||
    istCheck.getUTCDate() !== day
  ) return null;
  return utcTimestamp;
}

export function heartbeatTimestamp(data: Record<string, unknown>): number | null {
  const lastOnline = asRecord(data.LastOnline);
  return parseIstHeartbeat(
    lastOnline.Timestamp ?? lastOnline.timestamp ?? lastOnline.Date ?? data.LastOnline,
    lastOnline.Time,
  );
}

export function isDeviceOnline(data: Record<string, unknown>, now = Date.now()): boolean {
  const heartbeat = heartbeatTimestamp(data);
  if (heartbeat == null) return false;
  const age = now - heartbeat;
  return age >= -5 * 60_000 && age <= 11 * 60_000;
}

function finiteCoordinate(value: unknown, min: number, max: number): number | null {
  const numericValue = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof numericValue === "number" && Number.isFinite(numericValue) && numericValue >= min && numericValue <= max
    ? numericValue
    : null;
}

export function readDeviceLocation(data: Record<string, unknown>): DeviceLocation {
  const location = asRecord(data.Location);
  const rawName = location.Name ?? location.name ?? (typeof data.Location === "string" ? data.Location : "");
  return {
    name: typeof rawName === "string" ? rawName.trim() : "",
    latitude: finiteCoordinate(location.Lat ?? location.lat ?? location.Latitude ?? location.latitude, -90, 90),
    longitude: finiteCoordinate(location.Long ?? location.long ?? location.Lng ?? location.lng ?? location.Longitude ?? location.longitude, -180, 180),
  };
}

export function readDevicePassword(data: Record<string, unknown>): string {
  const info = asRecord(data.DeviceInfo);
  const value = info.Password ?? data.Password;
  return typeof value === "string" ? value : "";
}

export function displayNameForModel(model: DeviceModel): string {
  if (model === "commercial") return "Commercial AlgaeTree";
  if (model === "home-display") return "Home AlgaeTree · Display";
  if (model === "home-compact") return "Home AlgaeTree · Compact";
  return "Legacy AlgaeTree";
}
