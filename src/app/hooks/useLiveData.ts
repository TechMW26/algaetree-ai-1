"use client";

import { useState, useEffect } from "react";

export interface LiveData {
  activeTreeId: string;
  location: string;
  treeCount: number;
  batteryPercentage: number;
  batteryCharging: boolean;
  error: boolean;
  lastCheck: string;
  lastOnline: string;
  aqi: number;
  eco2: number;
  tds: number;
  tvoc: number;
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
  Biomass?: number;
  O2Released?: number;
  "CO2Captured "?: number;
  Date?: string[];
  CO2?: number[];
  ECO2?: number[];
  Temprature?: number[];
  LTurbidity?: number[];
  UTurbidity?: number[];
};

type DbTree = {
  DeviceID?: string;
  Error?: boolean;
  Location?: string;
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
    TotalCO2Absorbed?: number;
    TotalO2Released?: number;
  };
  Intensity?: {
    LED1?: number;
    LED2?: number;
    LED3?: number;
    LED4?: number;
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
  };
  NutritionDosing?: {
    Motor1Volume?: number;
    Motor2Volume?: number;
    Motor3Volume?: number;
    Motor4Volume?: number;
    Motor5Volume?: number;
  };
};

type DbRoot = {
  AlgeeTree?: Record<string, DbTree | number | undefined>;
};

const DEFAULT_TREE_ID = "AT00A0001";

function toNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
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

function mapTreeToLiveData(treeId: string, tree: DbTree, noOfDevices: number): LiveData {
  const sensors = tree.SensorsData ?? {};
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

  const totalCo2 = toNum(tree.Cycle?.TotalCO2Absorbed, toNum(latestCycle?.["CO2Captured "], 0));
  const totalO2 = toNum(tree.Cycle?.TotalO2Released, toNum(latestCycle?.O2Released, 0));

  const led1 = toNum(tree.Intensity?.LED1, 0);
  const led2 = toNum(tree.Intensity?.LED2, 0);
  const led3 = toNum(tree.Intensity?.LED3, 0);
  const led4 = toNum(tree.Intensity?.LED4, 0);
  const avgLed = (led1 + led2 + led3 + led4) / 4;

  const batteryPercentage = toNum(tree.Battery?.Percentage, 0);
  const hasError = !!tree.Error;
  const freshnessPenalty = diffDays(tree.SensorsData?.LastCheck?.Date) > 2 ? 20 : 0;
  const efficiency = Math.max(0, Math.min(100, (hasError ? 70 : 96) - freshnessPenalty));

  return {
    activeTreeId: tree.DeviceID ?? treeId,
    location: tree.Location ?? "Unknown",
    treeCount: noOfDevices,
    batteryPercentage,
    batteryCharging: !!tree.Battery?.Charging,
    error: hasError,
    lastCheck: fmtDateTime(tree.SensorsData?.LastCheck?.Date, tree.SensorsData?.LastCheck?.Time),
    lastOnline: fmtDateTime(tree.LastOnline?.Date, tree.LastOnline?.Time),
    aqi: toNum(sensors.AQI, 0),
    eco2: +toNum(sensors.ECO2, 0).toFixed(2),
    tds: toNum(sensors.TDS, 0),
    tvoc: +toNum(sensors.TVOC, 0).toFixed(2),
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
    air: Math.max(0, Math.round(toNum(sensors.AQI, 0) * 30)),
    uptime: `${diffDays(tree.LastOnline?.Date)}d`,
    growth,
    ambientTemp: +toNum(sensors.Temprature, 0).toFixed(2),
    humidity: 0,
    lightIntensity: Math.round(avgLed * 100),
    co2Ambient: toNum(sensors.CO2, 0),
    uvIndex: 0,
    airQuality: toNum(sensors.AQI, 0),
    photosynthRate: +toNum(latestCycle?.Biomass, 0).toFixed(2),
    carbonFixRate: +toNum(latestCycle?.["CO2Captured "], 0).toFixed(2),
    oxygenProd: +toNum(latestCycle?.O2Released, 0).toFixed(2),
    energyUsage: Math.round((led1 + led2 + led3 + led4) / 8),
    waterUsage: 0,
    nutrientEff: Math.max(0, Math.min(100, 100 - Math.min(100, toNum(sensors.TDS, 0)))),
    weeklyBiomass: [
      toNum((cycleData["0"] as DbCyclePoint | undefined)?.Biomass, biomass),
      toNum((cycleData["1"] as DbCyclePoint | undefined)?.Biomass, biomass),
      toNum((cycleData["2"] as DbCyclePoint | undefined)?.Biomass, biomass),
      biomass,
      biomass,
      biomass,
      biomass,
    ],
    weeklyEnergy: [
      Math.round(avgLed / 2),
      Math.round(avgLed / 2),
      Math.round(avgLed / 2),
      Math.round(avgLed / 2),
      Math.round(avgLed / 2),
      Math.round(avgLed / 2),
      Math.round(avgLed / 2),
    ],
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
    networkUp: diffDays(tree.LastOnline?.Date) <= 1,
    pumpStatus: tree.Operations?.AirBubbles ? "Running" : "Idle",
    ledStatus: tree.Operations?.LED1 || tree.Operations?.LED2 || tree.Operations?.LED3 || tree.Operations?.LED4 ? "Active" : "Off",
    sensorHealth: hasError ? 55 : 96,
    lastCalibration: fmtDateTime(tree.SensorsData?.LastCheck?.Date, tree.SensorsData?.LastCheck?.Time),
    firmwareVersion: "Live-RTDB",
    ledIntensity: {
      LED1: led1,
      LED2: led2,
      LED3: led3,
      LED4: led4,
    },
    operations: {
      AirBubbles: !!tree.Operations?.AirBubbles,
      Drain: !!tree.Operations?.Drain,
      Fan: !!tree.Operations?.Fan,
      Filling: !!tree.Operations?.Filling,
      SolarCleaning: !!tree.Operations?.SolarCleaning,
      LED1: !!tree.Operations?.LED1,
      LED2: !!tree.Operations?.LED2,
      LED3: !!tree.Operations?.LED3,
      LED4: !!tree.Operations?.LED4,
    },
    airBubblesTiming: {
      on: toNum(tree.Operations?.AirBubblesTiming?.On, 0),
      off: toNum(tree.Operations?.AirBubblesTiming?.Off, 0),
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

export function useLiveData(treeId: string = DEFAULT_TREE_ID): LiveData {
  const [d, setD] = useState<LiveData>({
    activeTreeId: treeId,
    location: "Loading...",
    treeCount: 0,
    batteryPercentage: 0,
    batteryCharging: false,
    error: false,
    lastCheck: "--/--/---- --:--",
    lastOnline: "--/--/---- --:--",
    aqi: 0,
    eco2: 0,
    tds: 0,
    tvoc: 0,
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
    ledIntensity: { LED1: 0, LED2: 0, LED3: 0, LED4: 0 },
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
    airBubblesTiming: { on: 0, off: 0 },
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

    const load = async () => {
      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/.json`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as DbRoot;
        const root = json.AlgeeTree ?? {};

        const noOfDevices = toNum((root.NoOfDevices as number | undefined), 0);
        const requestedTree = root[treeId] as DbTree | undefined;
        const fallbackTree = root[DEFAULT_TREE_ID] as DbTree | undefined;
        const anyTree = Object.entries(root).find(([k]) => k !== "NoOfDevices")?.[1] as DbTree | undefined;
        const selectedTree = requestedTree ?? fallbackTree ?? anyTree;
        const selectedTreeId = requestedTree
          ? treeId
          : fallbackTree
            ? DEFAULT_TREE_ID
            : (selectedTree?.DeviceID ?? DEFAULT_TREE_ID);

        if (!selectedTree || cancelled) return;
        setD(mapTreeToLiveData(selectedTreeId, selectedTree, noOfDevices));
      } catch {
        // Keep last successful snapshot on network/API errors.
      }
    };

    void load();
    const id = setInterval(() => {
      void load();
    }, 8000);

    return () => clearInterval(id);
  }, [treeId]);

  return d;
}
