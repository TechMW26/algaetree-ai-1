export type DailyYield = { co2: number; o2: number };

const YIELD_RATES: readonly [DailyYield, DailyYield][] = [
  [{ co2: 1.62, o2: 1.17 }, { co2: 1.67, o2: 1.20 }],
  [{ co2: 1.77, o2: 1.28 }, { co2: 1.72, o2: 1.24 }],
  [{ co2: 1.84, o2: 1.32 }, { co2: 1.86, o2: 1.34 }],
  [{ co2: 1.89, o2: 1.36 }, { co2: 1.89, o2: 1.37 }],
  [{ co2: 1.88, o2: 1.20 }, { co2: 1.84, o2: 1.32 }],
  [{ co2: 1.89, o2: 1.35 }, { co2: 1.90, o2: 1.36 }],
  [{ co2: 2.00, o2: 1.36 }, { co2: 1.80, o2: 1.38 }],
  [{ co2: 1.62, o2: 1.17 }, { co2: 1.65, o2: 1.20 }],
  [{ co2: 1.78, o2: 1.28 }, { co2: 1.814, o2: 1.31 }],
  [{ co2: 1.94, o2: 1.41 }, { co2: 1.95, o2: 1.41 }],
  [{ co2: 1.92, o2: 1.32 }, { co2: 1.92, o2: 1.32 }],
  [{ co2: 2.03, o2: 1.44 }, { co2: 2.05, o2: 1.48 }],
];

export function dailyYieldFor(date = new Date()): DailyYield {
  const month = date.getMonth();
  const half = date.getDate() <= 15 ? 0 : 1;
  return YIELD_RATES[month]?.[half] ?? { co2: 0, o2: 0 };
}

export function cycleYield(daysPassed: number, date = new Date()): DailyYield {
  const daily = dailyYieldFor(date);
  const days = Math.max(0, Math.min(30, Math.floor(daysPassed)));
  return {
    co2: Number((days * daily.co2).toFixed(2)),
    o2: Number((days * daily.o2).toFixed(2)),
  };
}
