"use client";

import { useState, useEffect } from "react";
import {
  displayNameForModel,
  familyCandidates,
  isDeviceOnline,
  modelForDevice,
  readDeviceLocation,
  type DeviceModel,
  type ResolvedDevice,
} from "@/lib/device/rtdb";
import { cycleYield } from "@/lib/device/yields";

export interface DeviceRuntime {
  family: ResolvedDevice["family"] | "unknown";
  model: DeviceModel;
  modelLabel: string;
  siteName: string;
  latitude: number | null;
  longitude: number | null;
  online: boolean;
  status: "online" | "power-saving" | "power-saving-locked" | "offline";
  statusLabel: string;
  powerSaving: boolean;
  powerSavingPermanent: boolean;
  operationKeys: string[];
  operations: Record<string, boolean>;
  intensityKeys: string[];
  intensities: Record<string, number>;
  timings: Record<string, { on: number; off: number }>;
  hasSensors: boolean;
  sensorKeys: string[];
  simEnabled: boolean;
  simNumber: string;
  simRechargeDate: string;
  simRechargeValidity: number;
}

export interface LiveData {
  device: DeviceRuntime;
  activeTreeId: string;
  location: string;
  installationDate: string;
  treeCount: number;
  change: number;
  batteryPercentage: number;
  batteryCharging: boolean;
  displayPin: string;
  wifiSsid: string;
  wifiPassword: string;
  error: boolean;
  lastCheck: string;
  lastOnline: string;
  aqi: number;
  eco2: number;
  tds: number;
  tvoc: number;
  pm2: number;
  pm10: number;
  lTurbidity: number;
  uTurbidity: number;
  ldrStatus: {
    LDR1: boolean;
    LDR2: boolean;
    LDR3: boolean;
    LDR4: boolean;
  };
  ph: number;
  temp: number;
  do2: number;
  biomass: number;
  efficiency: number;
  volume: number;
  cycle: number;
  maint: number;
  co2: number;
  o2: number;
  air: number;
  uptime: string;
  growth: number;
  cycleStartDate: string;
  cycleEndDate: string;
  cycleDaysRemaining: number;
  cycleDay: number;
  cycleCo2: number;
  cycleO2: number;
  harvestDue: boolean;
  cycleExplorer: Array<{
    key: number;
    startDate: string;
    endDate: string;
    biomass: number;
    co2Captured: number;
    o2Released: number;
    dates: string[];
    series: {
      AQI: number[];
      CO2: number[];
      PH: number[];
      Temprature: number[];
      TDS: number[];
      ECO2: number[];
      TVOC: number[];
      LTurbidity: number[];
      UTurbidity: number[];
    };
  }>;
  /* Environment */
  ambientTemp: number;
  humidity: number;
  lightIntensity: number;
  co2Ambient: number;
  uvIndex: number;
  airQuality: number;
  /* Performance */
  photosynthRate: number;
  carbonFixRate: number;
  oxygenProd: number;
  energyUsage: number;
  waterUsage: number;
  nutrientEff: number;
  weeklyBiomass: number[];
  weeklyEnergy: number[];
  co2History: number[];
  eco2History: number[];
  tempHistory: number[];
  lTurbidityHistory: number[];
  uTurbidityHistory: number[];
  historyLabels: string[];
  /* System */
  cpuTemp: number;
  cpuUsage: number;
  memUsage: number;
  diskUsage: number;
  networkUp: boolean;
  pumpStatus: string;
  ledStatus: string;
  sensorHealth: number;
  lastCalibration: string;
  firmwareVersion: string;
  ledIntensity: {
    LED1: number;
    LED2: number;
    LED3: number;
    LED4: number;
    AirBubble: number;
  };
  operations: {
    AirBubbles: boolean;
    Drain: boolean;
    Fan: boolean;
    Filling: boolean;
    SolarCleaning: boolean;
    LED1: boolean;
    LED2: boolean;
    LED3: boolean;
    LED4: boolean;
  };
  airBubblesTiming: {
    on: number;
    off: number;
  };
  nutritionDosing: {
    Motor1Volume: number;
    Motor2Volume: number;
    Motor3Volume: number;
    Motor4Volume: number;
    Motor5Volume: number;
  };
}

type DbCyclePoint = {
  StartDate?: string;
  EndDate?: string;
  Biomass?: number;
  O2Released?: number;
  "CO2Captured "?: number;
  CO2Captured?: number;
  Date?: string[];
  AQI?: number[];
  CO2?: number[];
  PH?: number[];
  TDS?: number[];
  ECO2?: number[];
  TVOC?: number[];
  Temprature?: number[];
  LTurbidity?: number[];
  UTurbidity?: number[];
};

type DbTree = {
  Change?: number;
  DeviceID?: string;
  DisplayPin?: number | string;
  Error?: boolean;
  InstallationDate?: string;
  Password?: string;
  DeviceInfo?: {
    DeviceID?: string;
    Password?: string;
    DisplayPin?: number | string;
    InstallationDate?: string;
    Sim?: {
      Sim?: boolean;
      Number?: number | string;
      RechargeDate?: string;
      RechargeValidity?: number;
    };
  };
  Battery?: {
    Charging?: boolean;
    Percentage?: number;
  };
  LastOnline?: {
    Date?: string;
    Time?: string;
  };
  SensorsData?: {
    AQI?: number;
    CO2?: number;
    ECO2?: number;
    LDR1?: boolean;
    LDR2?: boolean;
    LDR3?: boolean;
    LDR4?: boolean;
    PH?: number;
    TDS?: number;
    TVOC?: number;
    PM2?: number;
    PM10?: number;
    Temprature?: number;
    LTurbidity?: number;
    UTurbidity?: number;
    LastCheck?: {
      Date?: string;
      Time?: string;
    };
  };
  Cycle?: {
    Data?: Record<string, DbCyclePoint | number | undefined>;
    NewCycleStartDate?: string;
    TotalCO2Absorbed?: number;
    TotalO2Released?: number;
  };
  Intensity?: {
    LED1?: number;
    LED2?: number;
    LED3?: number;
    LED4?: number;
    AirBubble?: number;
    AirBubble1?: number;
    AirBubble2?: number;
  };
  Operations?: {
    AirBubbles?: boolean;
    AirBubblesTiming?: {
      Off?: number;
      On?: number;
    };
    Drain?: boolean;
    Fan?: boolean;
    Filling?: boolean;
    LED1?: boolean;
    LED2?: boolean;
    LED3?: boolean;
    LED4?: boolean;
    SolarCleaning?: boolean;
    AirBubble?: boolean;
    AirBubble1?: boolean;
    AirBubble2?: boolean;
    AirBubbleTiming?: { Off?: number; On?: number };
    AirBubble1Timing?: { Off?: number; On?: number };
    AirBubble2Timing?: { Off?: number; On?: number };
    Fan1?: boolean;
    Fan2?: boolean;
    Camera?: boolean;
    PowerSaving?: boolean;
    PowerSavingPermenent?: boolean;
  };
  NutritionDosing?: {
    Motor1Volume?: number;
    Motor2Volume?: number;
    Motor3Volume?: number;
    Motor4Volume?: number;
    Motor5Volume?: number;
  };
  WiFi?: {
    SSID?: string;
    Password?: string;
  };
  Location?: string | { Name?: string; Lat?: number; Long?: number };
};

const DEFAULT_TREE_ID = "AT00A0001";

function toNum(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function toNumArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => toNum(item, 0));
}

function pickNum(
  source: Record<string, unknown>,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    if (key in source) {
      const n = toNum(source[key], Number.NaN);
      if (Number.isFinite(n)) return n;
    }
  }
  return fallback;
}

function fmtDateTime(date?: string, time?: string): string {
  const d = date ?? "--/--/----";
  const t = time ?? "--:--";
  return `${d} ${t}`;
}

function parseDdMmYyyy(value?: string): Date | null {
  if (!value) return null;
  const [dd, mm, yyyy] = value.split("/").map(Number);
  if (!dd || !mm || !yyyy) return null;
  const dt = new Date(yyyy, mm - 1, dd);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function diffDays(fromDate?: string): number {
  const start = parseDdMmYyyy(fromDate);
  if (!start) return 0;
  const ms = Date.now() - start.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function formatDdMmYyyy(dt: Date): string {
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function cycleEndDate(startDate?: string): string {
  const start = parseDdMmYyyy(startDate);
  if (!start) return "--/--/----";
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  return formatDdMmYyyy(end);
}

function mapTreeToLiveData(
  treeId: string,
  tree: DbTree,
  noOfDevices: number,
  family: DeviceRuntime["family"] = "unknown",
): LiveData {
  const rawTree = tree as unknown as Record<string, unknown>;
  const deviceInfo = tree.DeviceInfo ?? {};
  const deviceLocation = readDeviceLocation(rawTree);
  const siteName = deviceLocation.name || "AlgaeTree site";
  const operationsNode = (tree.Operations ?? {}) as Record<string, unknown>;
  const intensityNode = (tree.Intensity ?? {}) as Record<string, unknown>;
  const model = family === "unknown"
    ? "legacy"
    : modelForDevice(family, rawTree);
  const online = isDeviceOnline(rawTree);
  const powerSaving = Boolean(tree.Operations?.PowerSaving);
  const powerSavingPermanent = Boolean(tree.Operations?.PowerSavingPermenent);
  const status = !online
    ? "offline"
    : powerSavingPermanent
      ? "power-saving-locked"
      : powerSaving
        ? "power-saving"
        : "online";
  const statusLabel = status === "power-saving-locked"
    ? "Power saving locked"
    : status === "power-saving"
      ? "Power saving"
      : status === "online"
        ? "Online"
        : "Offline";
  const dynamicOperations = Object.fromEntries(
    Object.entries(operationsNode).filter(([, value]) => typeof value === "boolean"),
  ) as Record<string, boolean>;
  const dynamicIntensities = Object.fromEntries(
    Object.entries(intensityNode)
      .filter(([, value]) => typeof value === "number" || typeof value === "string")
      .map(([key, value]) => [key, toNum(value, 0)]),
  );
  const dynamicTimings = Object.fromEntries(
    Object.entries(operationsNode)
      .filter(([key, value]) => key.endsWith("Timing") && value && typeof value === "object")
      .map(([key, value]) => {
        const timing = value as { On?: unknown; Off?: unknown };
        return [key, {
          on: Math.max(1, Math.min(60, toNum(timing.On, 15))),
          off: Math.max(1, Math.min(60, toNum(timing.Off, 5))),
        }];
      }),
  );
  const sensors = tree.SensorsData ?? {};
  const sensorsRaw = sensors as Record<string, unknown>;
  const cycleData = tree.Cycle?.Data ?? {};
  const cycleKeys = Object.keys(cycleData)
    .filter((k) => k !== "Count")
    .sort((a, b) => Number(a) - Number(b));
  const latestKey = cycleKeys.at(-1);
  const prevKey = cycleKeys.length > 1 ? cycleKeys.at(-2) : undefined;
  const latestCycle = (latestKey ? cycleData[latestKey] : undefined) as DbCyclePoint | undefined;
  const prevCycle = (prevKey ? cycleData[prevKey] : undefined) as DbCyclePoint | undefined;

  const rawDates = latestCycle?.Date ?? [];
  const historyLabels = (rawDates.length > 0 ? rawDates : ["P1", "P2", "P3", "P4"]).map((d, i) => {
    if (!d) return `P${i + 1}`;
    const parts = d.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : d;
  });
  const co2History = (latestCycle?.CO2 ?? []).map((v) => toNum(v, 0));
  const eco2History = (latestCycle?.ECO2 ?? []).map((v) => toNum(v, 0));
  const tempHistory = (latestCycle?.Temprature ?? []).map((v) => toNum(v, 0));
  const lTurbidityHistory = (latestCycle?.LTurbidity ?? []).map((v) => toNum(v, 0));
  const uTurbidityHistory = (latestCycle?.UTurbidity ?? []).map((v) => toNum(v, 0));

  const biomass = toNum(latestCycle?.Biomass, 0);
  const prevBiomass = toNum(prevCycle?.Biomass, biomass || 1);
  const growth = prevBiomass > 0 ? +(((biomass - prevBiomass) / prevBiomass) * 100).toFixed(1) : 0;
  const cycleBiomass = cycleKeys.map((k) =>
    toNum((cycleData[k] as DbCyclePoint | undefined)?.Biomass, 0),
  );
  const weeklyBiomass = cycleBiomass.length > 0 ? cycleBiomass : [biomass];
  const cycleExplorer = [...cycleKeys]
    .sort((a, b) => Number(b) - Number(a))
    .map((k) => {
      const node = (cycleData[k] as DbCyclePoint | undefined) ?? {};
      const key = Number(k);
      return {
        key: Number.isFinite(key) ? key : 0,
        startDate: node.StartDate ?? tree.Cycle?.NewCycleStartDate ?? "--/--/----",
        endDate: node.EndDate ?? "Current",
        biomass: +toNum(node.Biomass, 0).toFixed(2),
        co2Captured: +toNum(node.CO2Captured, toNum(node["CO2Captured "], 0)).toFixed(2),
        o2Released: +toNum(node.O2Released, 0).toFixed(2),
        dates: Array.isArray(node.Date) ? node.Date.map((d) => String(d)) : [],
        series: {
          AQI: toNumArray(node.AQI),
          CO2: toNumArray(node.CO2),
          PH: toNumArray(node.PH),
          Temprature: toNumArray(node.Temprature),
          TDS: toNumArray(node.TDS),
          ECO2: toNumArray(node.ECO2),
          TVOC: toNumArray(node.TVOC),
          LTurbidity: toNumArray(node.LTurbidity),
          UTurbidity: toNumArray(node.UTurbidity),
        },
      };
    });

  const storedCo2 = toNum(tree.Cycle?.TotalCO2Absorbed, toNum(latestCycle?.CO2Captured, toNum(latestCycle?.["CO2Captured "], 0)));
  const storedO2 = toNum(tree.Cycle?.TotalO2Released, toNum(latestCycle?.O2Released, 0));
  const cycleStart = tree.Cycle?.NewCycleStartDate ?? deviceInfo.InstallationDate ?? tree.InstallationDate;
  const daysPassed = diffDays(cycleStart);
  const currentYield = cycleYield(daysPassed);
  const totalCo2 = storedCo2 + currentYield.co2;
  const totalO2 = storedO2 + currentYield.o2;
  const cycleRemaining = Math.max(0, 30 - daysPassed);

  const led1 = toNum(tree.Intensity?.LED1, 0);
  const led2 = toNum(tree.Intensity?.LED2, 0);
  const led3 = toNum(tree.Intensity?.LED3, 0);
  const led4 = toNum(tree.Intensity?.LED4, 0);
  const airBubble = toNum(tree.Intensity?.AirBubble1, toNum(tree.Intensity?.AirBubble, 0));
  const activeLedValues = ["LED1", "LED2", "LED3", "LED4"]
    .filter((key) => key in intensityNode)
    .map((key) => toNum(intensityNode[key], 0));
  const avgLed = activeLedValues.length > 0
    ? activeLedValues.reduce((sum, value) => sum + value, 0) / activeLedValues.length
    : 0;

  const batteryPercentage = toNum(tree.Battery?.Percentage, 0);
  const hasError = !!tree.Error;
  const freshnessPenalty = diffDays(tree.SensorsData?.LastCheck?.Date) > 2 ? 20 : 0;
  const efficiency = Math.max(0, Math.min(100, (hasError ? 70 : 96) - freshnessPenalty));

  // AQI arrives with mixed key names across device payload versions.
  const aqiValue = pickNum(
    sensorsRaw,
    ["AQI", "Aqi", "aqi", "AirQuality", "Air_Quality", "AirQualityIndex", "AQIIndex", "AQI_Value"],
    0,
  );

  return {
    device: {
      family,
      model,
      modelLabel: displayNameForModel(model),
      siteName,
      latitude: deviceLocation.latitude,
      longitude: deviceLocation.longitude,
      online,
      status,
      statusLabel,
      powerSaving,
      powerSavingPermanent,
      operationKeys: Object.keys(dynamicOperations),
      operations: dynamicOperations,
      intensityKeys: Object.keys(dynamicIntensities),
      intensities: dynamicIntensities,
      timings: dynamicTimings,
      hasSensors: Object.keys(sensors).some((key) => key !== "LastCheck"),
      sensorKeys: Object.keys(sensors).filter((key) => key !== "LastCheck"),
      simEnabled: Boolean(deviceInfo.Sim?.Sim),
      simNumber: deviceInfo.Sim?.Number == null ? "" : String(deviceInfo.Sim.Number),
      simRechargeDate: deviceInfo.Sim?.RechargeDate ?? "",
      simRechargeValidity: toNum(deviceInfo.Sim?.RechargeValidity, 0),
    },
    activeTreeId: treeId,
    location: siteName,
    installationDate: deviceInfo.InstallationDate ?? tree.InstallationDate ?? "--/--/----",
    treeCount: noOfDevices,
    change: toNum(tree.Change, 0),
    batteryPercentage,
    batteryCharging: !!tree.Battery?.Charging,
    displayPin: deviceInfo.DisplayPin != null
      ? String(deviceInfo.DisplayPin)
      : tree.DisplayPin != null
        ? String(tree.DisplayPin)
        : "----",
    wifiSsid: tree.WiFi?.SSID ?? "Unknown",
    wifiPassword: tree.WiFi?.Password ?? "",
    error: hasError,
    lastCheck: fmtDateTime(tree.SensorsData?.LastCheck?.Date, tree.SensorsData?.LastCheck?.Time),
    lastOnline: fmtDateTime(tree.LastOnline?.Date, tree.LastOnline?.Time),
    aqi: aqiValue,
    eco2: +toNum(sensors.ECO2, 0).toFixed(2),
    tds: toNum(sensors.TDS, 0),
    tvoc: +toNum(sensors.TVOC, 0).toFixed(2),
    pm2: +toNum(sensors.PM2, 0).toFixed(2),
    pm10: +toNum(sensors.PM10, 0).toFixed(2),
    lTurbidity: +toNum(sensors.LTurbidity, 0).toFixed(2),
    uTurbidity: +toNum(sensors.UTurbidity, 0).toFixed(2),
    ldrStatus: {
      LDR1: !!sensors.LDR1,
      LDR2: !!sensors.LDR2,
      LDR3: !!sensors.LDR3,
      LDR4: !!sensors.LDR4,
    },
    ph: +toNum(sensors.PH, 0).toFixed(2),
    temp: +toNum(sensors.Temprature, 0).toFixed(2),
    do2: +toNum(latestCycle?.O2Released, 0).toFixed(2),
    biomass: +biomass.toFixed(2),
    efficiency,
    volume: 300,
    cycle: toNum((cycleData.Count as number | undefined), cycleKeys.length),
    maint: Math.max(0, 30 - diffDays(tree.SensorsData?.LastCheck?.Date)),
    co2: +totalCo2.toFixed(2),
    o2: +totalO2.toFixed(2),
    air: aqiValue,
    uptime: `${diffDays(tree.LastOnline?.Date)}d`,
    growth,
    cycleStartDate: cycleStart ?? "--/--/----",
    cycleEndDate: cycleEndDate(cycleStart),
    cycleDaysRemaining: cycleRemaining,
    cycleDay: Math.min(30, daysPassed + 1),
    cycleCo2: currentYield.co2,
    cycleO2: currentYield.o2,
    harvestDue: daysPassed >= 30,
    cycleExplorer,
    ambientTemp: +toNum(sensors.Temprature, 0).toFixed(2),
    humidity: 0,
    lightIntensity: Math.round(avgLed * 100),
    co2Ambient: toNum(sensors.CO2, 0),
    uvIndex: 0,
    airQuality: aqiValue,
    photosynthRate: +toNum(latestCycle?.Biomass, 0).toFixed(2),
    carbonFixRate: +toNum(latestCycle?.CO2Captured, toNum(latestCycle?.["CO2Captured "], 0)).toFixed(2),
    oxygenProd: +toNum(latestCycle?.O2Released, 0).toFixed(2),
    energyUsage: Math.round((led1 + led2 + led3 + led4) / 8),
    waterUsage: 0,
    nutrientEff: Math.max(0, Math.min(100, 100 - Math.min(100, toNum(sensors.TDS, 0)))),
    weeklyBiomass,
    weeklyEnergy: weeklyBiomass.map(() => Math.round(avgLed / 2)),
    co2History,
    eco2History,
    tempHistory,
    lTurbidityHistory,
    uTurbidityHistory,
    historyLabels,
    cpuTemp: +toNum(sensors.Temprature, 0).toFixed(2),
    cpuUsage: Math.min(100, Math.round(avgLed / 2.55)),
    memUsage: 0,
    diskUsage: 0,
    networkUp: online,
    pumpStatus: tree.Operations?.AirBubble1 || tree.Operations?.AirBubble || tree.Operations?.AirBubbles ? "Running" : "Idle",
    ledStatus: tree.Operations?.LED1 || tree.Operations?.LED2 || tree.Operations?.LED3 || tree.Operations?.LED4 ? "Active" : "Off",
    sensorHealth: hasError ? 55 : 96,
    lastCalibration: fmtDateTime(tree.SensorsData?.LastCheck?.Date, tree.SensorsData?.LastCheck?.Time),
    firmwareVersion: "Live-RTDB",
    ledIntensity: {
      LED1: led1,
      LED2: led2,
      LED3: led3,
      LED4: led4,
      AirBubble: airBubble,
    },
    operations: {
      AirBubbles: !!(tree.Operations?.AirBubble1 || tree.Operations?.AirBubble || tree.Operations?.AirBubbles),
      Drain: !!tree.Operations?.Drain,
      Fan: !!(tree.Operations?.Fan1 || tree.Operations?.Fan2 || tree.Operations?.Fan),
      Filling: !!tree.Operations?.Filling,
      SolarCleaning: !!tree.Operations?.SolarCleaning,
      LED1: !!tree.Operations?.LED1,
      LED2: !!tree.Operations?.LED2,
      LED3: !!tree.Operations?.LED3,
      LED4: !!tree.Operations?.LED4,
    },
    airBubblesTiming: {
      on: toNum(tree.Operations?.AirBubble1Timing?.On, toNum(tree.Operations?.AirBubbleTiming?.On, toNum(tree.Operations?.AirBubblesTiming?.On, 15))),
      off: toNum(tree.Operations?.AirBubble1Timing?.Off, toNum(tree.Operations?.AirBubbleTiming?.Off, toNum(tree.Operations?.AirBubblesTiming?.Off, 5))),
    },
    nutritionDosing: {
      Motor1Volume: toNum(tree.NutritionDosing?.Motor1Volume, 0),
      Motor2Volume: toNum(tree.NutritionDosing?.Motor2Volume, 0),
      Motor3Volume: toNum(tree.NutritionDosing?.Motor3Volume, 0),
      Motor4Volume: toNum(tree.NutritionDosing?.Motor4Volume, 0),
      Motor5Volume: toNum(tree.NutritionDosing?.Motor5Volume, 0),
    },
  };
}

function makeOfflineLiveData(treeId: string): LiveData {
  return {
    device: {
      family: "unknown",
      model: "legacy",
      modelLabel: "AlgaeTree",
      siteName: "Offline",
      latitude: null,
      longitude: null,
      online: false,
      status: "offline",
      statusLabel: "Offline",
      powerSaving: false,
      powerSavingPermanent: false,
      operationKeys: [],
      operations: {},
      intensityKeys: [],
      intensities: {},
      timings: {},
      hasSensors: false,
      sensorKeys: [],
      simEnabled: false,
      simNumber: "",
      simRechargeDate: "",
      simRechargeValidity: 0,
    },
    activeTreeId: treeId,
    location: "Offline",
    installationDate: "--/--/----",
    treeCount: 0,
    change: 0,
    batteryPercentage: 0,
    batteryCharging: false,
    displayPin: "----",
    wifiSsid: "Unknown",
    wifiPassword: "",
    error: true,
    lastCheck: "--/--/---- --:--",
    lastOnline: "--/--/---- --:--",
    aqi: 0,
    eco2: 0,
    tds: 0,
    tvoc: 0,
    pm2: 0,
    pm10: 0,
    lTurbidity: 0,
    uTurbidity: 0,
    ldrStatus: { LDR1: false, LDR2: false, LDR3: false, LDR4: false },
    ph: 0,
    temp: 0,
    do2: 0,
    biomass: 0,
    efficiency: 0,
    volume: 0,
    cycle: 0,
    maint: 0,
    co2: 0,
    o2: 0,
    air: 0,
    uptime: "0d",
    growth: 0,
    cycleStartDate: "--/--/----",
    cycleEndDate: "--/--/----",
    cycleDaysRemaining: 0,
    cycleDay: 0,
    cycleCo2: 0,
    cycleO2: 0,
    harvestDue: false,
    cycleExplorer: [],
    ambientTemp: 0,
    humidity: 0,
    lightIntensity: 0,
    co2Ambient: 0,
    uvIndex: 0,
    airQuality: 0,
    photosynthRate: 0,
    carbonFixRate: 0,
    oxygenProd: 0,
    energyUsage: 0,
    waterUsage: 0,
    nutrientEff: 0,
    weeklyBiomass: [0, 0, 0, 0, 0, 0, 0],
    weeklyEnergy: [0, 0, 0, 0, 0, 0, 0],
    co2History: [0],
    eco2History: [0],
    tempHistory: [0],
    lTurbidityHistory: [0],
    uTurbidityHistory: [0],
    historyLabels: ["P1"],
    cpuTemp: 0,
    cpuUsage: 0,
    memUsage: 0,
    diskUsage: 0,
    networkUp: false,
    pumpStatus: "Idle",
    ledStatus: "Off",
    sensorHealth: 0,
    lastCalibration: "--/--/---- --:--",
    firmwareVersion: "Live-RTDB",
    ledIntensity: { LED1: 0, LED2: 0, LED3: 0, LED4: 0, AirBubble: 0 },
    operations: {
      AirBubbles: false,
      Drain: false,
      Fan: false,
      Filling: false,
      SolarCleaning: false,
      LED1: false,
      LED2: false,
      LED3: false,
      LED4: false,
    },
    airBubblesTiming: { on: 15, off: 5 },
    nutritionDosing: {
      Motor1Volume: 0,
      Motor2Volume: 0,
      Motor3Volume: 0,
      Motor4Volume: 0,
      Motor5Volume: 0,
    },
  };
}

export function useLiveData(treeId: string = DEFAULT_TREE_ID): LiveData {
  const [d, setD] = useState<LiveData>({
    device: {
      family: "unknown",
      model: "legacy",
      modelLabel: "Loading device",
      siteName: "Loading...",
      latitude: null,
      longitude: null,
      online: false,
      status: "offline",
      statusLabel: "Loading",
      powerSaving: false,
      powerSavingPermanent: false,
      operationKeys: [],
      operations: {},
      intensityKeys: [],
      intensities: {},
      timings: {},
      hasSensors: false,
      sensorKeys: [],
      simEnabled: false,
      simNumber: "",
      simRechargeDate: "",
      simRechargeValidity: 0,
    },
    activeTreeId: treeId,
    location: "Loading...",
    installationDate: "--/--/----",
    treeCount: 0,
    change: 0,
    batteryPercentage: 0,
    batteryCharging: false,
    displayPin: "----",
    wifiSsid: "Unknown",
    wifiPassword: "",
    error: false,
    lastCheck: "--/--/---- --:--",
    lastOnline: "--/--/---- --:--",
    aqi: 0,
    eco2: 0,
    tds: 0,
    tvoc: 0,
    pm2: 0,
    pm10: 0,
    lTurbidity: 0,
    uTurbidity: 0,
    ldrStatus: { LDR1: false, LDR2: false, LDR3: false, LDR4: false },
    ph: 0,
    temp: 0,
    do2: 0,
    biomass: 0,
    efficiency: 0,
    volume: 0,
    cycle: 0,
    maint: 0,
    co2: 0,
    o2: 0,
    air: 0,
    uptime: "0d",
    growth: 0,
    cycleStartDate: "--/--/----",
    cycleEndDate: "--/--/----",
    cycleDaysRemaining: 0,
    cycleDay: 0,
    cycleCo2: 0,
    cycleO2: 0,
    harvestDue: false,
    cycleExplorer: [],
    /* Environment */
    ambientTemp: 0, humidity: 0, lightIntensity: 0,
    co2Ambient: 0, uvIndex: 0, airQuality: 0,
    /* Performance */
    photosynthRate: 0, carbonFixRate: 0, oxygenProd: 0,
    energyUsage: 0, waterUsage: 0, nutrientEff: 0,
    weeklyBiomass: [0, 0, 0, 0, 0, 0, 0],
    weeklyEnergy: [0, 0, 0, 0, 0, 0, 0],
    co2History: [0],
    eco2History: [0],
    tempHistory: [0],
    lTurbidityHistory: [0],
    uTurbidityHistory: [0],
    historyLabels: ["P1"],
    /* System */
    cpuTemp: 0, cpuUsage: 0, memUsage: 0,
    diskUsage: 0, networkUp: false, pumpStatus: "Idle",
    ledStatus: "Off", sensorHealth: 0,
    lastCalibration: "--/--/---- --:--", firmwareVersion: "Live-RTDB",
    ledIntensity: { LED1: 0, LED2: 0, LED3: 0, LED4: 0, AirBubble: 0 },
    operations: {
      AirBubbles: false,
      Drain: false,
      Fan: false,
      Filling: false,
      SolarCleaning: false,
      LED1: false,
      LED2: false,
      LED3: false,
      LED4: false,
    },
    airBubblesTiming: { on: 15, off: 5 },
    nutritionDosing: {
      Motor1Volume: 0,
      Motor2Volume: 0,
      Motor3Volume: 0,
      Motor4Volume: 0,
      Motor5Volume: 0,
    },
  });

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_FIREBASE_RTDB_URL;
    if (!baseUrl) return;

    let cancelled = false;
    let stream: EventSource | null = null;
    const normalizedBase = baseUrl.replace(/\/$/, "");
    const normalizedTreeId = treeId.trim().toUpperCase();
    let deviceCache: DbTree | null = null;
    let resolvedFamily: DeviceRuntime["family"] = "unknown";
    let resolvedPath = "";

    const publish = () => {
      if (cancelled) return;
      if (!deviceCache) {
        setD(makeOfflineLiveData(normalizedTreeId));
        return;
      }
      setD(mapTreeToLiveData(normalizedTreeId, deviceCache, 0, resolvedFamily));
    };

    const applyPathUpdate = (path: string, data: unknown, mergeObject: boolean) => {
      const parts = path.split("/").filter(Boolean);
      if (parts.length === 0) {
        if (data && typeof data === "object") {
          deviceCache = mergeObject && deviceCache
            ? { ...deviceCache, ...(data as DbTree) }
            : data as DbTree;
          publish();
        }
        return;
      }

      if (!deviceCache) deviceCache = {};
      let cursor = deviceCache as Record<string, unknown>;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const key = parts[i];
        const current = cursor[key];
        if (!current || typeof current !== "object") {
          cursor[key] = {};
        }
        cursor = cursor[key] as Record<string, unknown>;
      }

      const leaf = parts[parts.length - 1];
      if (
        mergeObject &&
        data &&
        typeof data === "object" &&
        cursor[leaf] &&
        typeof cursor[leaf] === "object"
      ) {
        cursor[leaf] = {
          ...(cursor[leaf] as Record<string, unknown>),
          ...(data as Record<string, unknown>),
        };
      } else {
        cursor[leaf] = data as unknown;
      }

      publish();
    };

    const loadSnapshot = async () => {
      const candidates = resolvedFamily === "unknown"
        ? familyCandidates(normalizedTreeId)
        : [resolvedFamily, ...familyCandidates(normalizedTreeId).filter((item) => item !== resolvedFamily)];
      for (const family of candidates) {
        try {
          const path = `${family}/${encodeURIComponent(normalizedTreeId)}`;
          const res = await fetch(`${normalizedBase}/${path}.json`, { cache: "no-store" });
          if (!res.ok) continue;
          const json = (await res.json()) as DbTree | null;
          if (!json || typeof json !== "object" || cancelled) continue;
          deviceCache = json;
          resolvedFamily = family as DeviceRuntime["family"];
          resolvedPath = path;
          publish();
          return true;
        } catch {
          // Try the next family. Both new roots and legacy roots can coexist.
        }
      }
      if (!cancelled) setD(makeOfflineLiveData(normalizedTreeId));
      return false;
    };

    const handleStreamEvent = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { path?: string; data?: unknown };
        const path = payload.path ?? "/";
        const data = payload.data;
        const isPatch = (event.type ?? "").toLowerCase() === "patch";

        if (path === "/") {
          if (data && typeof data === "object") {
            deviceCache = isPatch && deviceCache
              ? { ...deviceCache, ...(data as DbTree) }
              : data as DbTree;
            publish();
          }
          return;
        }

        applyPathUpdate(path, data, isPatch);
      } catch {
        // Ignore malformed stream events.
      }
    };

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const openStream = async () => {
      if (cancelled || typeof EventSource === "undefined") return;
      if (!resolvedPath && !(await loadSnapshot())) return;
      try {
        stream?.close();
      } catch {
        // ignore
      }
      stream = new EventSource(`${normalizedBase}/${resolvedPath}.json`);
      stream.addEventListener("put", handleStreamEvent as EventListener);
      stream.addEventListener("patch", handleStreamEvent as EventListener);
      stream.onerror = () => {
        // RTDB SSE can stall after regional redirects or network blips. Re-sync
        // immediately via REST and reopen the stream so other tabs stay live.
        void loadSnapshot();
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          void openStream();
        }, 2000);
      };
    };

    void openStream();

    // Aggressive safety refresh so cross-tab updates surface within a few seconds
    // even if the SSE channel is silently wedged.
    const id = setInterval(() => {
      void loadSnapshot();
    }, 3000);

    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void loadSnapshot();
        void openStream();
      }
    };

    const handleFocus = () => {
      void loadSnapshot();
    };

    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
      window.addEventListener("focus", handleFocus);
      window.addEventListener("online", handleFocus);
    }

    return () => {
      cancelled = true;
      clearInterval(id);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stream?.close();
      if (typeof window !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("focus", handleFocus);
        window.removeEventListener("online", handleFocus);
      }
    };
  }, [treeId]);

  return d;
}
