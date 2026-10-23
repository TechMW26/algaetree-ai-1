"use client";

import { useEffect, useMemo, useState } from "react";
import type { LiveData } from "../hooks/useLiveData";

type Panel = "hardware" | "lighting" | "power" | "details";
type MutationOptions = {
  password?: string;
  overwritePending?: boolean;
  verifyOnly?: boolean;
};

const OPERATION_COMMANDS: Record<string, number> = {
  Filling: 13,
  AirBubble: 14,
  AirBubble1: 14,
  AirBubble2: 15,
  Camera: 16,
  LED1: 17,
  LED2: 18,
  LED3: 19,
  LED4: 20,
  Fan1: 21,
  Fan2: 22,
  PowerSaving: 23,
  PowerSavingPermenent: 23,
};

const LABELS: Record<string, string> = {
  AirBubble: "Air pump",
  AirBubble1: "Air pump 1",
  AirBubble2: "Air pump 2",
  AirBubbleTiming: "Air pump timing",
  AirBubble1Timing: "Air pump 1 timing",
  AirBubble2Timing: "Air pump 2 timing",
  Fan1: "Fan 1",
  Fan2: "Fan 2",
  Camera: "Camera",
  Filling: "Water filling",
  LED1: "Grow light 1",
  LED2: "Grow light 2",
  LED3: "Grow light 3",
  LED4: "Grow light 4",
};

function formatDate(date = new Date()): string {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function parseDate(value: string): Date | null {
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return null;
  const result = new Date(year, month - 1, day);
  return Number.isNaN(result.getTime()) ? null : result;
}

function simDaysLeft(data: LiveData): number | null {
  const start = parseDate(data.device.simRechargeDate);
  if (!start || data.device.simRechargeValidity <= 0) return null;
  start.setDate(start.getDate() + data.device.simRechargeValidity);
  return Math.ceil((start.getTime() - Date.now()) / 86_400_000);
}

function Button({ children, onClick, disabled, tone = "blue" }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "blue" | "green" | "red" | "amber";
}) {
  const colors = {
    blue: ["#0284c7", "rgba(14,165,233,.12)", "rgba(14,165,233,.35)"],
    green: ["#15803d", "rgba(34,197,94,.12)", "rgba(34,197,94,.35)"],
    red: ["#dc2626", "rgba(239,68,68,.10)", "rgba(239,68,68,.30)"],
    amber: ["#b45309", "rgba(245,158,11,.12)", "rgba(245,158,11,.35)"],
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: 11,
        border: `1px solid ${colors[2]}`,
        background: colors[1],
        color: colors[0],
        padding: "8px 11px",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? .5 : 1,
      }}
    >{children}</button>
  );
}

function ToggleRow({ label, value, disabled, held, onChange }: {
  label: string;
  value: boolean;
  disabled?: boolean;
  held?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      style={{
        minWidth: 0,
        minHeight: 46,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 13,
        border: `1px solid ${held ? "rgba(245,158,11,.35)" : value ? "rgba(34,197,94,.38)" : "var(--border)"}`,
        background: held ? "rgba(245,158,11,.10)" : value ? "rgba(34,197,94,.10)" : "var(--mini-bg)",
        color: "var(--text-2)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled && !held ? .55 : 1,
      }}
    >
      <span style={{ minWidth: 0, fontSize: 11, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {held ? (
        <span style={{ color: "#d97706", fontSize: 10, fontWeight: 900 }}>HELD</span>
      ) : (
        <span style={{ width: 40, height: 22, borderRadius: 99, background: value ? "#22c55e" : "#ef4444", position: "relative", flex: "0 0 auto" }}>
          <span style={{ position: "absolute", top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left .18s ease" }} />
        </span>
      )}
    </button>
  );
}

function FieldCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ minWidth: 0, padding: "9px 10px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--mini-bg)" }}>
      <p style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</p>
      <p style={{ marginTop: 4, fontSize: 12, color: accent ?? "var(--text-2)", fontWeight: 800, overflowWrap: "anywhere" }}>{value}</p>
    </div>
  );
}

function Schedule({ data }: { data: LiveData }) {
  const compact = data.device.model === "home-compact";
  const home = data.device.family === "HomeAlgaeTree";
  const rows = home
    ? [
      { label: "Lights", start: compact ? 7 : 8, end: 24 },
      { label: "Air pump", start: compact ? 7 : 8, end: 24 },
      { label: "Auto restart", events: [0, 10, 18] },
    ]
    : [
      { label: "Lights", start: 18, end: 24 },
      { label: "Air pumps", start: 8, end: 24 },
      { label: "Fans", start: 8, end: 17 },
      { label: "Sensor test", events: [10, 18] },
      { label: "Auto restart", events: [0, 10, 18] },
    ];
  const now = new Date();
  const istMinutes = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(now).replace(":", ""));
  const markerHour = Math.floor(istMinutes / 100) + (istMinutes % 100) / 60;

  return (
    <div style={{ padding: 11, borderRadius: 14, border: "1px solid var(--border)", background: "var(--mini-bg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: "var(--text-2)" }}>Daily automation · IST</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#0284c7" }}>{markerHour.toFixed(1)} h</span>
      </div>
      <div style={{ display: "grid", gap: 7 }}>
        {rows.map((row) => {
          const active = row.start != null && row.end != null && markerHour >= row.start && markerHour < row.end;
          const nextEvent = row.events?.find((hour) => hour > markerHour) ?? row.events?.[0];
          return (
            <div key={row.label} style={{ display: "grid", gridTemplateColumns: "88px minmax(0,1fr) 58px", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "var(--text-3)" }}>{row.label}</span>
              <div style={{ height: 8, borderRadius: 99, background: "var(--track)", position: "relative", overflow: "visible" }}>
                {row.start != null && row.end != null && <span style={{ position: "absolute", left: `${row.start / 24 * 100}%`, width: `${Math.max(1, (row.end - row.start) / 24 * 100)}%`, top: 0, bottom: 0, borderRadius: 99, background: active ? "#22c55e" : "#64748b" }} />}
                {row.events?.map((hour) => <span key={hour} style={{ position: "absolute", left: `${hour / 24 * 100}%`, top: -2, width: 3, height: 12, borderRadius: 3, background: "#64748b" }} />)}
                <span style={{ position: "absolute", left: `${markerHour / 24 * 100}%`, top: -3, width: 2, height: 14, background: "#f97316" }} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 800, color: active ? "#16a34a" : "var(--text-3)", textAlign: "right" }}>{active ? "On now" : row.events ? `Next ${String(nextEvent).padStart(2, "0")}:00` : `From ${String(row.start).padStart(2, "0")}:00`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DeviceControlCenter({ data }: { data: LiveData }) {
  const [panel, setPanel] = useState<Panel>("hardware");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [pendingLabel, setPendingLabel] = useState("");
  const [pinVisible, setPinVisible] = useState(false);
  const [intensities, setIntensities] = useState<Record<string, number>>(data.device.intensities);
  const [timings, setTimings] = useState<Record<string, { on: number; off: number }>>(data.device.timings);

  useEffect(() => setIntensities(data.device.intensities), [data.device.intensities]);
  useEffect(() => setTimings(data.device.timings), [data.device.timings]);
  useEffect(() => {
    if (data.change === 0) setPendingLabel("");
  }, [data.change]);
  useEffect(() => {
    if (data.installationDate === "01/01/2000") {
      setPanel("details");
      setNotice({ tone: "warn", text: "First-time setup is required before normal operation." });
    }
  }, [data.installationDate]);

  const ledKeys = useMemo(() => data.device.operationKeys.filter((key) => /^LED[1-4]$/.test(key)), [data.device.operationKeys]);
  const hardwareKeys = useMemo(() => data.device.operationKeys.filter((key) =>
    !/^LED[1-4]$/.test(key) && key !== "PowerSaving" && key !== "PowerSavingPermenent"), [data.device.operationKeys]);
  const airIntensityKeys = data.device.intensityKeys.filter((key) => key.startsWith("AirBubble"));
  const ledIntensityKeys = data.device.intensityKeys.filter((key) => /^LED[1-4]$/.test(key));
  const powerActive = data.device.powerSaving || data.device.powerSavingPermanent;
  const simRemaining = simDaysLeft(data);

  async function mutate(
    command: number | null,
    label: string,
    updates: Record<string, unknown>,
    options: MutationOptions = {},
  ): Promise<boolean> {
    if (command != null && !data.device.online) {
      setNotice({ tone: "error", text: "Device is offline. Retry when it is online." });
      return false;
    }
    setBusy(true);
    setNotice(null);
    if (command != null) setPendingLabel(label);
    try {
      const response = await fetch("/api/device-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treeId: data.activeTreeId,
          command,
          label,
          updates,
          currentPassword: options.password,
          overwritePending: options.overwritePending,
          verifyOnly: options.verifyOnly,
        }),
      });
      const result = await response.json() as {
        ok?: boolean;
        error?: string;
        acknowledged?: boolean;
        requiresOverwriteConfirmation?: boolean;
        pendingCommand?: number;
      };
      if (!response.ok && result.requiresOverwriteConfirmation) {
        const overwrite = window.confirm(`Command ${result.pendingCommand ?? data.change} is still pending. Replace it with “${label}”?`);
        if (!overwrite) return false;
        return mutate(command, label, updates, { ...options, overwritePending: true });
      }
      if (!response.ok || !result.ok) {
        setNotice({ tone: "error", text: result.error ?? "The device update failed." });
        return false;
      }
      setNotice({
        tone: result.acknowledged === false ? "warn" : "ok",
        text: result.acknowledged === false ? `Waiting for device to pick up: ${label}` : `${label} applied`,
      });
      return true;
    } catch {
      setNotice({ tone: "error", text: "Could not reach the control service." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleOperation(key: string) {
    if (key === "Filling" && !window.confirm("Start water filling? The pump stops automatically when the upper level sensor is full.")) return;
    const command = OPERATION_COMMANDS[key];
    if (!command) return;
    const next = !data.device.operations[key];
    await mutate(command, `${LABELS[key] ?? key} ${next ? "on" : "off"}`, { [`Operations/${key}`]: next });
  }

  async function commitIntensity(kind: "led" | "air") {
    const keys = kind === "led" ? ledIntensityKeys : airIntensityKeys;
    const updates = Object.fromEntries(keys.map((key) => [`Intensity/${key}`, Math.round(intensities[key] ?? 0)]));
    await mutate(kind === "led" ? 10 : 12, kind === "led" ? "LED intensity" : "Air pump intensity", updates);
  }

  async function commitTiming(key: string) {
    const timing = timings[key];
    if (!timing) return;
    const command = key === "AirBubble2Timing" ? 8 : 7;
    await mutate(command, LABELS[key] ?? key, {
      [`Operations/${key}/On`]: Math.max(1, Math.min(60, Math.round(timing.on))),
      [`Operations/${key}/Off`]: Math.max(1, Math.min(60, Math.round(timing.off))),
    });
  }

  async function togglePowerSaving() {
    if (data.device.powerSavingPermanent) return;
    const next = !data.device.powerSaving;
    const explanation = next
      ? "Power saving caps lights at 60, pumps at 150, uses 5/15 timing, and holds fans/camera off. Continue?"
      : "Turn power saving off and restore the saved settings?";
    if (!window.confirm(explanation)) return;
    await mutate(23, `Power saving ${next ? "on" : "off"}`, { "Operations/PowerSaving": next });
  }

  async function togglePermanent() {
    const next = !data.device.powerSavingPermanent;
    if (next) {
      if (!window.confirm("Lock power saving on regardless of battery level or display control?")) return;
      await mutate(23, "Permanent power saving on", {
        "Operations/PowerSavingPermenent": true,
        "Operations/PowerSaving": true,
      });
      return;
    }
    const exitNow = window.confirm("Permanent mode will be unlocked. Select OK to exit power saving now, or Cancel to keep power saving on.");
    await mutate(23, "Permanent power saving off", {
      "Operations/PowerSavingPermenent": false,
      "Operations/PowerSaving": !exitNow,
    });
  }

  function askPassword(reason: string): string | null {
    const password = window.prompt(`Enter the device password to ${reason}:`);
    return password?.trim() ? password : null;
  }

  async function updateWifi() {
    const ssid = window.prompt("New 2.4 GHz Wi-Fi network name:", data.wifiSsid)?.trim();
    if (!ssid) return;
    const password = window.prompt("New Wi-Fi password (8–63 characters):") ?? "";
    const currentPassword = askPassword("change Wi-Fi");
    if (!currentPassword) return;
    if (!window.confirm(`The device may go offline while switching to “${ssid}”. Continue?`)) return;
    await mutate(4, "Wi-Fi change", { "WiFi/SSID": ssid, "WiFi/Password": password }, { password: currentPassword });
  }

  async function changePin() {
    const rawPin = window.prompt("New display PIN (1000–9999; no leading zero):")?.trim();
    if (!rawPin) return;
    const password = askPassword("change the display PIN");
    if (!password) return;
    await mutate(9, "Display PIN change", { "DeviceInfo/DisplayPin": Number(rawPin) }, { password });
  }

  async function showPin() {
    const password = askPassword("show the display PIN");
    if (!password) return;
    if (await mutate(null, "Password verified", {}, { password, verifyOnly: true })) setPinVisible(true);
  }

  async function changePassword() {
    const currentPassword = askPassword("change the device password");
    if (!currentPassword) return;
    const next = window.prompt("New device password (at least 4 characters):") ?? "";
    const repeated = window.prompt("Enter the new password again:") ?? "";
    if (next !== repeated) {
      setNotice({ tone: "error", text: "The new passwords do not match." });
      return;
    }
    await mutate(null, "Device password changed", { "DeviceInfo/Password": next }, { password: currentPassword });
  }

  async function updateLocation() {
    const name = window.prompt("Site name:", data.device.siteName)?.trim() || "AlgaeTree site";
    const lat = Number(window.prompt("Latitude (-90 to 90):", data.device.latitude == null ? "" : String(data.device.latitude)));
    const long = Number(window.prompt("Longitude (-180 to 180):", data.device.longitude == null ? "" : String(data.device.longitude)));
    if (!Number.isFinite(lat) || !Number.isFinite(long)) return;
    await mutate(null, "Location updated", {
      "Location/Name": name,
      "Location/Lat": Number(lat.toFixed(6)),
      "Location/Long": Number(long.toFixed(6)),
    });
  }

  async function completeSetup() {
    const installationDate = window.prompt("Installation date (DD/MM/YYYY):", formatDate())?.trim();
    if (!installationDate) return;
    const updates: Record<string, unknown> = {
      "DeviceInfo/InstallationDate": installationDate,
      "Cycle/NewCycleStartDate": installationDate,
    };
    const addLocation = window.confirm("Add the installation location now?");
    if (addLocation) {
      const name = window.prompt("Site name:", data.device.siteName === "AlgaeTree site" ? "" : data.device.siteName)?.trim() || "AlgaeTree site";
      const lat = Number(window.prompt("Latitude (-90 to 90):", ""));
      const long = Number(window.prompt("Longitude (-180 to 180):", ""));
      if (!Number.isFinite(lat) || !Number.isFinite(long)) return;
      updates["Location/Name"] = name;
      updates["Location/Lat"] = Number(lat.toFixed(6));
      updates["Location/Long"] = Number(long.toFixed(6));
    }
    await mutate(null, "First-time setup completed", updates);
  }

  async function startNewCycle() {
    const biomass = Number(window.prompt("Harvested biomass in kg (0 or greater):"));
    if (!Number.isFinite(biomass) || biomass < 0) return;
    const password = askPassword("start a new growth cycle");
    if (!password || !window.confirm("Archive this harvest and start a new 30-day cycle now?")) return;
    const today = formatDate();
    const index = Math.max(0, data.cycle);
    await mutate(null, "New growth cycle started", {
      [`Cycle/Data/${index}/StartDate`]: data.cycleStartDate,
      [`Cycle/Data/${index}/EndDate`]: today,
      [`Cycle/Data/${index}/CO2Captured`]: data.cycleCo2,
      [`Cycle/Data/${index}/O2Released`]: data.cycleO2,
      [`Cycle/Data/${index}/Biomass`]: Number(biomass.toFixed(2)),
      "Cycle/Data/Count": index + 1,
      "Cycle/TotalCO2Absorbed": data.co2,
      "Cycle/TotalO2Released": data.o2,
      "Cycle/NewCycleStartDate": today,
    }, { password });
  }

  async function protectedCommand(command: number, label: string, warning?: string) {
    if (warning && !window.confirm(warning)) return;
    const password = [1, 3, 9, 25].includes(command) ? askPassword(label.toLowerCase()) : undefined;
    if ([1, 3, 9, 25].includes(command) && !password) return;
    await mutate(command, label, {}, { password: password ?? undefined });
  }

  const noticeColor = notice?.tone === "error" ? "#dc2626" : notice?.tone === "warn" ? "#d97706" : "#15803d";

  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {(busy || data.change !== 0 || notice) && (
        <div style={{ flex: "0 0 auto", padding: "8px 11px", borderRadius: 12, border: `1px solid ${busy || data.change !== 0 ? "rgba(245,158,11,.35)" : `${noticeColor}40`}`, background: busy || data.change !== 0 ? "rgba(245,158,11,.10)" : `${noticeColor}10`, color: busy || data.change !== 0 ? "#b45309" : noticeColor, fontSize: 10, fontWeight: 800 }}>
          {busy ? `Sending: ${pendingLabel || "device update"}` : data.change !== 0 ? `Waiting for device to pick up: ${pendingLabel || `command ${data.change}`}` : notice?.text}
        </div>
      )}

      <div style={{ flex: "0 0 auto", display: "flex", gap: 7, flexWrap: "wrap" }}>
        {(["hardware", "lighting", "power", "details"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setPanel(item)} style={{ borderRadius: 11, border: panel === item ? "1px solid rgba(14,165,233,.5)" : "1px solid var(--border)", background: panel === item ? "rgba(14,165,233,.12)" : "var(--mini-bg)", color: panel === item ? "#0284c7" : "var(--text-2)", padding: "7px 11px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".04em", cursor: "pointer" }}>
            {item === "hardware" ? "Hardware" : item === "lighting" ? "Lighting" : item === "power" ? "Power" : "System details"}
          </button>
        ))}
      </div>

      <div className="dash-system-control-panel" style={{ flex: "1 1 0", minHeight: 0, paddingRight: 4 }}>
        {panel === "hardware" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
              {hardwareKeys.map((key) => {
                const held = powerActive && (key.startsWith("Fan") || key === "Camera");
                return <ToggleRow key={key} label={LABELS[key] ?? key} value={data.device.operations[key]} held={held} disabled={busy || held || !data.device.online} onChange={() => void toggleOperation(key)} />;
              })}
            </div>

            {airIntensityKeys.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(2, airIntensityKeys.length)}, minmax(0,1fr))`, gap: 8 }}>
                {airIntensityKeys.map((key) => (
                  <div key={key} style={{ padding: 10, borderRadius: 13, border: "1px solid var(--border)", background: "var(--mini-bg)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 10, fontWeight: 800, color: "var(--text-2)" }}><span>{LABELS[key] ?? key} intensity</span><span>{intensities[key] ?? 0}</span></div>
                    <input type="range" min={0} max={255} value={intensities[key] ?? 0} disabled={busy || powerActive || !data.device.online} onChange={(event) => setIntensities((current) => ({ ...current, [key]: Number(event.currentTarget.value) }))} onPointerUp={() => void commitIntensity("air")} style={{ width: "100%", marginTop: 8, accentColor: "#0ea5e9" }} />
                    {powerActive && <p style={{ marginTop: 4, fontSize: 9, color: "#d97706", fontWeight: 800 }}>Power-saving cap: 150 · saved {data.device.intensities[key]}</p>}
                  </div>
                ))}
              </div>
            )}

            {Object.keys(timings).map((key) => (
              <div key={key} style={{ padding: 10, borderRadius: 13, border: "1px solid var(--border)", background: "var(--mini-bg)", display: "grid", gridTemplateColumns: "minmax(100px,1fr) 90px 90px auto", gap: 8, alignItems: "end" }}>
                <div><p style={{ fontSize: 10, fontWeight: 900, color: "var(--text-2)" }}>{LABELS[key] ?? key}</p><p style={{ fontSize: 9, color: "var(--text-3)", marginTop: 3 }}>Run / rest minutes</p></div>
                {(["on", "off"] as const).map((part) => <label key={part} style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 800, textTransform: "uppercase" }}>{part}<input type="number" min={1} max={60} value={timings[key]?.[part] ?? 1} disabled={busy || powerActive || !data.device.online} onChange={(event) => setTimings((current) => ({ ...current, [key]: { ...current[key], [part]: Number(event.currentTarget.value) } }))} style={{ display: "block", width: "100%", marginTop: 4, padding: "7px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)" }} /></label>)}
                <Button disabled={busy || powerActive || !data.device.online} onClick={() => void commitTiming(key)}>Apply</Button>
              </div>
            ))}
          </div>
        )}

        {panel === "lighting" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
              {ledKeys.map((key) => <ToggleRow key={key} label={LABELS[key] ?? key} value={data.device.operations[key]} disabled={busy || !data.device.online} onChange={() => void toggleOperation(key)} />)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, ledIntensityKeys.length))}, minmax(0,1fr))`, gap: 8 }}>
              {ledIntensityKeys.map((key) => (
                <div key={key} style={{ padding: 10, borderRadius: 13, border: "1px solid var(--border)", background: "var(--mini-bg)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 10, fontWeight: 800, color: "var(--text-2)" }}><span>{key}</span><span>{intensities[key] ?? 0}</span></div>
                  <input type="range" min={0} max={255} value={intensities[key] ?? 0} disabled={busy || powerActive || !data.device.online} onChange={(event) => setIntensities((current) => ({ ...current, [key]: Number(event.currentTarget.value) }))} onPointerUp={() => void commitIntensity("led")} style={{ width: "100%", marginTop: 8, accentColor: "#22c55e" }} />
                  {powerActive && <p style={{ marginTop: 4, fontSize: 9, color: "#d97706", fontWeight: 800 }}>Capped at 60 · saved {data.device.intensities[key]}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {panel === "power" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ padding: 12, borderRadius: 14, border: "1px solid var(--border)", background: "var(--mini-bg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}><div><p style={{ fontSize: 13, fontWeight: 900, color: "var(--text-1)" }}>{data.device.statusLabel}</p><p style={{ marginTop: 3, fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>{data.device.powerSavingPermanent ? "Always on; display and battery thresholds cannot turn it off." : data.device.powerSaving ? "Lights and pumps are capped; fans and camera are held off." : data.batteryPercentage < 48 ? "The device will enter power saving on its next battery check." : "Saved intensities and timers are active."}</p></div><strong style={{ fontSize: 22, color: data.batteryPercentage < 20 ? "#ef4444" : data.batteryPercentage < 48 ? "#f59e0b" : "#22c55e" }}>{data.batteryPercentage}%</strong></div>
              <div style={{ position: "relative", height: 12, marginTop: 13, borderRadius: 99, background: "var(--track)" }}><span style={{ display: "block", width: `${Math.max(0, Math.min(100, data.batteryPercentage))}%`, height: "100%", borderRadius: 99, background: data.batteryPercentage < 20 ? "#ef4444" : data.batteryPercentage < 48 ? "#f59e0b" : "#22c55e" }} /><span style={{ position: "absolute", left: "48%", top: -4, width: 2, height: 20, background: "#f59e0b" }} /><span style={{ position: "absolute", left: "80%", top: -4, width: 2, height: 20, background: "#22c55e" }} /></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 9, color: "var(--text-3)", fontWeight: 800 }}><span>0%</span><span>48% auto on</span><span>80% auto off</span><span>100%</span></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
              <ToggleRow label="Power saving" value={data.device.powerSaving} disabled={busy || data.device.powerSavingPermanent || !data.device.online} onChange={() => void togglePowerSaving()} />
              <ToggleRow label="Permanent power saving" value={data.device.powerSavingPermanent} disabled={busy || !data.device.online} onChange={() => void togglePermanent()} />
            </div>
            <Schedule data={data} />
          </div>
        )}

        {panel === "details" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
              <FieldCard label="Device" value={data.activeTreeId} />
              <FieldCard label="Model" value={data.device.modelLabel} />
              <FieldCard label="Status" value={data.device.statusLabel} accent={data.device.online ? data.device.powerSaving ? "#d97706" : "#16a34a" : "#64748b"} />
              <FieldCard label="Site" value={data.device.siteName} />
              <FieldCard label="Installation" value={data.installationDate} />
              <FieldCard label="Last reading" value={data.lastCheck} />
              <FieldCard label="Wi-Fi" value={data.wifiSsid} />
              <FieldCard label="Display PIN" value={pinVisible ? data.displayPin : "••••"} />
              <FieldCard label="Cycle" value={data.harvestDue ? "Harvest due" : `Day ${data.cycleDay} of 30`} accent={data.harvestDue ? "#d97706" : undefined} />
            </div>

            {data.device.simEnabled && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}><FieldCard label="SIM" value={data.device.simNumber || "Configured"} /><FieldCard label="Recharge date" value={data.device.simRechargeDate || "--"} /><FieldCard label="Validity" value={simRemaining == null ? "--" : simRemaining < 0 ? "Expired" : `${simRemaining} days left`} accent={simRemaining != null && simRemaining <= 5 ? "#dc2626" : undefined} /></div>}

            <Schedule data={data} />

            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {data.installationDate === "01/01/2000" && <Button disabled={busy} tone="green" onClick={() => void completeSetup()}>Complete first-time setup</Button>}
              <Button disabled={busy} onClick={() => void updateWifi()}>Update Wi-Fi</Button>
              <Button disabled={busy} onClick={() => void showPin()}>Show PIN</Button>
              <Button disabled={busy} onClick={() => void changePin()}>Change PIN</Button>
              <Button disabled={busy} onClick={() => void changePassword()}>Change password</Button>
              <Button disabled={busy} onClick={() => void updateLocation()}>Update location</Button>
              <Button disabled={busy} tone="green" onClick={() => void startNewCycle()}>Start new cycle</Button>
              <Button disabled={busy || !data.device.online} onClick={() => void protectedCommand(6, "Clock sync")}>Sync clock</Button>
              <Button disabled={busy || !data.device.online || !data.device.hasSensors} onClick={() => void protectedCommand(9, "Sensor test")}>Sensor test</Button>
              <Button disabled={busy || !data.device.online || data.device.family !== "AlgaeTree"} tone="amber" onClick={() => void protectedCommand(25, "CO₂ calibration", "Calibrate only after 20 minutes in fresh outdoor air (approximately 400 ppm). Continue?")}>Calibrate CO₂</Button>
              <Button disabled={busy || !data.device.online} tone="amber" onClick={() => void protectedCommand(1, "Restart device", "Restart the device now?")}>Restart</Button>
              <Button disabled={busy || !data.device.online} tone="red" onClick={() => void protectedCommand(3, "Factory reset", "Factory reset restores PIN 1234, password Password, full intensities, 15/5 timers, and turns every output off. Growth-cycle data is kept. Continue?")}>Factory reset</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
