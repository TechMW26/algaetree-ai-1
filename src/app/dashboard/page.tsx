"use client";

import { Suspense, useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveData } from "../hooks/useLiveData";
import DashboardPasswordGate from "../components/DashboardPasswordGate";

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const rise = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);
const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type ControlPanelTab =
  | "flow"
  | "lighting"
  | "algae"
  | "settings";

// Dashboard ranges are tuned for operational readability rather than raw sensor ceilings.
const GAUGE_RANGES = {
  bioReactor: {
    ph: { min: 0, max: 18 },
    tds: { min: 0, max: 1500 },
    temperature: { min: 0, max: 45 },
    efficiency: { min: 0, max: 100 },
  },
  environment: {
    temperature: { min: 0, max: 45 },
    lowerTurbidity: { min: 0, max: 4000 },
    upperTurbidity: { min: 0, max: 4000 },
  },
  performance: {
    photosynthesisRate: { min: 0, max: 40 },
    carbonFixation: { min: 0, max: 12 },
    energyUsage: { min: 0, max: 400 },
  },
} as const;

/* ── Animated Semicircle Gauge ── */
function SemiGauge({ value, min, max, label, unit, color, icon, delay = 0, tint }: {
  value: number; min: number; max: number; label: string; unit: string;
  color: string; icon: ReactNode; delay?: number; tint: string;
}) {
  const pct = clamp01((value - min) / (max - min));
  const valueText = String(value);
  const valueChars = valueText.length;
  const valueFontSize = Math.max(22, 58 - Math.max(0, valueChars - 4) * 6);
  const valueTextLength = valueChars >= 9 ? 144 : valueChars >= 8 ? 152 : valueChars >= 7 ? 160 : undefined;
  const trackColor = "var(--track-strong)";
  const showValueArc = pct > 0;

  return (
    <motion.div
      className="card flex flex-col items-center justify-center"
      style={{
        padding: "12px 8px 14px",
        flex: 1,
        background: "var(--surface)",
        overflow: "visible",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--card-tint' as any]: `${color}18`,
      }}
      variants={rise}
    >
      <div style={{ position: "relative", width: "88%", aspectRatio: "280 / 155" }}>
        <svg width="100%" height="100%" viewBox="-30 -15 280 155" preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
          {/* Track */}
          <path
            d="M 12 120 A 90 90 0 0 1 208 120"
            fill="none"
            stroke={trackColor}
            strokeWidth="18"
            strokeLinecap="round"
          />
          {/* Value arc */}
          {showValueArc ? (
            <motion.path
              d="M 12 120 A 90 90 0 0 1 208 120"
              fill="none"
              stroke={color}
              strokeWidth="18"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: pct, opacity: 1 }}
              transition={{
                pathLength: { duration: 1.6, delay, ease: [0.25, 0.46, 0.45, 0.94] },
                opacity: { duration: 0.08, delay: delay + 0.06, ease: "linear" },
              }}
            />
          ) : null}
          {/* Center value as SVG text for proper scaling */}
          <text
            x="110"
            y="112"
            textAnchor="middle"
            style={{ fill: "var(--text-2)" }}
            fontWeight="400"
            fontSize={valueFontSize}
            fontFamily="inherit"
            lengthAdjust="spacingAndGlyphs"
            textLength={valueTextLength}
          >
            {valueText}
          </text>
          <text x="110" y="138" textAnchor="middle" style={{ fill: "var(--text-3)" }} fontWeight="600" fontSize="16" fontFamily="inherit">{unit}</text>
        </svg>
      </div>
      <div className="flex items-center" style={{ gap: 8, marginTop: 6, flexShrink: 0 }}>
        {icon}
        <span className="font-semibold" style={{ fontSize: 14, color: "var(--text-2)" }}>{label}</span>
      </div>
    </motion.div>
  );
}

/* ── Animated Vertical Bar Chart ── */
function BarChart({ bars, delay = 0, overflowWhenDense = false }: {
  bars: { label: string; value: number; max: number; color: string }[];
  delay?: number;
  overflowWhenDense?: boolean;
}) {
  const dense = overflowWhenDense && bars.length > 8;
  const gap = dense ? 3 : 14;
  const barWidth = dense ? 24 : 36;
  const innerWidth = dense ? Math.max(100, bars.length * (barWidth + gap)) : undefined;

  return (
    <div style={{ width: "100%", overflowX: dense ? "auto" : "hidden", overflowY: "hidden" }}>
      <div className="flex items-end justify-center" style={{ gap, height: 130, width: dense ? innerWidth : "100%", minWidth: dense ? "max-content" : undefined }}>
        {bars.map((b, i) => {
          const pct = b.max > 0 ? clamp01(b.value / b.max) : 0;
          return (
            <div key={b.label} className="flex flex-col items-center" style={{ gap: 6, flex: dense ? "0 0 auto" : 1, width: dense ? barWidth : undefined }}>
              <div
                style={{
                  width: "100%", maxWidth: barWidth, height: 110, borderRadius: 10,
                  background: "var(--track)",
                  position: "relative", overflow: "hidden",
                  display: "flex", alignItems: "flex-end",
                }}
              >
                <motion.div
                  style={{
                    width: "100%", borderRadius: 10,
                    background: `linear-gradient(to top, ${b.color}dd, ${b.color}66)`,
                    boxShadow: `0 0 16px ${b.color}30`,
                  }}
                  initial={{ height: 0 }}
                  animate={{ height: `${pct * 100}%` }}
                  transition={{ duration: 1.2, delay: delay + i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
              </div>
              <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600 }}>{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ label, color = "green" }: { label: string; color?: string }) {
  const bg = color === "green" ? "rgba(34,197,94,0.12)" : "rgba(249,115,22,0.12)";
  const fg = color === "green" ? "#4ade80" : "#f97316";
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full text-[11px] font-bold uppercase tracking-wide"
      style={{ background: bg, color: fg, padding: "6px 14px" }}
    >
      <span className={`w-[6px] h-[6px] rounded-full pulse-${color}`} style={{ background: fg }} />
      {label}
    </span>
  );
}

/* ── Animated horizontal progress bar ── */
function AnimBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const safePct = clampPercent(pct);

  return (
    <div className="bar-track" style={{ marginTop: 12 }}>
      <motion.div
        style={{
          height: "100%", borderRadius: 99,
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          boxShadow: `0 0 12px ${color}40`,
        }}
        initial={{ width: 0 }}
        animate={{ width: `${safePct}%` }}
        transition={{ duration: 1.2, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
    </div>
  );
}

/* ── AQI Circular Meter (reference-style) ── */
const AQI_BANDS = [
  { from: 0, to: 5, color: "#66bb6a" },
  { from: 5, to: 15, color: "#a3c43a" },
  { from: 15, to: 30, color: "#f3c93a" },
  { from: 30, to: 50, color: "#f28a1d" },
] as const;

function AQIGauge({ value }: { value: number }) {
  const displayValue = Math.max(0, Math.round(value));
  const dialValue = Math.min(displayValue, 50);
  const cx = 160;
  const cy = 152;
  const r = 112;
  const sw = 20;
  const startDeg = 180;
  const endDeg = 480;

  const quality = displayValue <= 15
    ? "Good"
    : displayValue <= 25
      ? "Moderate"
      : displayValue <= 40
        ? "Unhealthy"
        : "Very Unhealthy";

  const qualityColor = displayValue <= 5
    ? "#66bb6a"
    : displayValue <= 15
      ? "#a3c43a"
      : displayValue <= 30
        ? "#f3c93a"
        : displayValue <= 50
          ? "#f28a1d"
          : "#b21f0f";

  const polar = (angleDeg: number, radius: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: +(cx + radius * Math.cos(rad)).toFixed(3),
      y: +(cy + radius * Math.sin(rad)).toFixed(3),
    };
  };

  const arcPath = (fromDeg: number, toDeg: number, radius: number) => {
    const p1 = polar(fromDeg, radius);
    const p2 = polar(toDeg, radius);
    const delta = toDeg - fromDeg;
    const largeArc = delta > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
  };

  // Non-linear scale to match the reference labels: 0 -> 5 -> 15 -> 50+
  const angleForValue = (v: number) => {
    if (v <= 5) {
      return 180 + (v / 5) * 55;
    }
    if (v <= 15) {
      return 235 + ((v - 5) / 10) * 125;
    }
    return 360 + ((Math.min(v, 50) - 15) / 35) * 120;
  };

  const bandPath = (from: number, to: number, gapDeg = 2.8) => {
    const fromDeg = angleForValue(from) + (from > 0 ? gapDeg : 0);
    const toDeg = angleForValue(to) - (to < 50 ? gapDeg : 0);
    return arcPath(fromDeg, toDeg, r);
  };

  const pointerDeg = angleForValue(dialValue);
  const pointerDot = polar(pointerDeg, r);
  const pointerTri = polar(pointerDeg, r - 28);

  const p0 = polar(angleForValue(0), r + 28);
  const p5 = polar(angleForValue(5), r + 28);
  const p15 = polar(angleForValue(15), r + 28);
  const p50 = polar(angleForValue(50), r + 28);

  const redTicks = Array.from({ length: 7 }, (_, i) => {
    const deg = 408 + i * 7;
    const a = polar(deg, r + 4);
    const b = polar(deg, r + 20);
    return { a, b, key: `rt-${i}` };
  });

  return (
    <svg viewBox="0 0 320 360" style={{ width: "100%", display: "block" }}>

      {/* Base ring */}
      <path d={arcPath(startDeg, endDeg, r)} fill="none" stroke="var(--track-strong)" strokeWidth={sw} strokeLinecap="round" />

      {/* Colored zones */}
      {AQI_BANDS.map((b, idx) => (
        <path key={`band-${idx}`} d={bandPath(b.from, b.to)} fill="none" stroke={b.color} strokeWidth={sw} strokeLinecap="round" />
      ))}
      <path d={arcPath(angleForValue(50) + 2.8, endDeg - 1, r)} fill="none" stroke="#b21f0f" strokeWidth={sw} strokeLinecap="round" />

      {/* Critical red hatch marks */}
      {redTicks.map((t) => (
        <line key={t.key} x1={t.a.x} y1={t.a.y} x2={t.b.x} y2={t.b.y} stroke="#b21f0f" strokeWidth="2" strokeLinecap="round" />
      ))}

      {/* Pointer triangle + marker */}
      <g transform={`translate(${pointerTri.x} ${pointerTri.y}) rotate(${pointerDeg - 90})`}>
        <polygon points="0,-7 14,0 0,7" fill="rgba(31,41,55,0.78)" />
      </g>
      <circle cx={pointerDot.x} cy={pointerDot.y} r={4.4} fill="rgba(31,41,55,0.78)" />

      {/* Radial guide lines like reference */}
      {[0, 5, 15, 50].map((v) => {
        const deg = angleForValue(v);
        const a = polar(deg, r - sw / 2 - 2);
        const b = polar(deg, r + sw / 2 + 12);
        return <line key={`guide-${v}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(31,41,55,0.45)" strokeWidth="1.2" />;
      })}

      {/* Scale labels */}
      <text x={p0.x} y={p0.y + 4} textAnchor="middle" fontSize="11" fontWeight="600" style={{ fill: "var(--text-2)" }}>0</text>
      <text x={p5.x} y={p5.y + 4} textAnchor="middle" fontSize="11" fontWeight="600" style={{ fill: "var(--text-2)" }}>5</text>
      <text x={p15.x} y={p15.y + 4} textAnchor="middle" fontSize="11" fontWeight="600" style={{ fill: "var(--text-2)" }}>15</text>
      <text x={p50.x} y={p50.y + 4} textAnchor="middle" fontSize="11" fontWeight="600" style={{ fill: "var(--text-2)" }}>50+</text>

      {/* Center labels */}
      <text x={cx} y={118} textAnchor="middle" fontSize="11" fontWeight="500" fontFamily="inherit" style={{ fill: "var(--text-2)" }}>Today&apos;s Index</text>
      <text x={cx} y={141} textAnchor="middle" fontSize="20" fontWeight="500" fontFamily="inherit" style={{ fill: qualityColor }}>{quality}</text>
      <text x={cx} y={190} textAnchor="middle" fontSize="62" fontWeight="500" fontFamily="inherit" style={{ fill: qualityColor }}>{displayValue}</text>

      <text x={cx} y={322} textAnchor="middle" fontSize="10" fontWeight="600" letterSpacing="3" fontFamily="inherit" style={{ fill: "var(--text-3)" }}>AQI INDEX</text>
    </svg>
  );
}

function ToggleChip({
  label,
  enabled,
  busy,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  busy?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      className="cursor-pointer"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        border: `1px solid ${enabled ? "rgba(34,197,94,0.42)" : "rgba(239,68,68,0.32)"}`,
        background: enabled
          ? "linear-gradient(145deg, rgba(34,197,94,0.15), rgba(16,185,129,0.04))"
          : "linear-gradient(145deg, rgba(239,68,68,0.12), rgba(248,113,113,0.04))",
        borderRadius: 14,
        padding: "10px 12px",
        opacity: busy ? 0.7 : 1,
        boxShadow: enabled ? "0 8px 20px rgba(34,197,94,0.14)" : "0 8px 20px rgba(239,68,68,0.1)",
        transition: "all .2s ease",
      }}
    >
      <div className="flex items-center" style={{ gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: enabled ? "#22c55e" : "#ef4444", boxShadow: enabled ? "0 0 12px rgba(34,197,94,0.65)" : "0 0 10px rgba(239,68,68,0.5)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", letterSpacing: "0.01em" }}>{label}</span>
      </div>
      <span
        style={{
          width: 38,
          height: 22,
          borderRadius: 999,
          background: enabled
            ? "linear-gradient(135deg, #16a34a, #22c55e)"
            : "linear-gradient(135deg, #ef4444, #f87171)",
          position: "relative",
          transition: "all .2s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: enabled ? 18 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            transition: "all .2s ease",
          }}
        />
      </span>
    </button>
  );
}

function RoundKnob({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  accent = "#22c55e",
  glowStrength = 0,
  glowColor = "#22c55e",
  variant = "large",
  framed = true,
  busy,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  accent?: string;
  glowStrength?: number;
  glowColor?: string;
  variant?: "small" | "large";
  framed?: boolean;
  busy?: boolean;
  onChange: (v: number) => void;
  onCommit: () => void;
}) {
  const isSmall = variant === "small";
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(0);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setCardWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // knobSize fills ~65% of the card width, clamped to sensible min/max
  const knobSize = cardWidth > 0
    ? Math.max(isSmall ? 80 : 110, Math.min(isSmall ? 160 : 220, Math.floor(cardWidth * 0.65)))
    : (isSmall ? 100 : 140);

  const fullAngle  = 270;
  const startAngle = (360 - fullAngle) / 2;   // 45°
  const endAngle   = startAngle + fullAngle;   // 315°
  const trackWidth = 2;
  const trackRadius = knobSize / 2 + Math.round(knobSize * 0.11);
  const totalSize  = Math.ceil(trackRadius * 2 + trackWidth * 6);
  const cx = totalSize / 2;
  const cy = totalSize / 2;

  const currentDeg = Math.floor(
    ((value - min) * (endAngle - startAngle)) / Math.max(1, max - min) + startAngle,
  );
  const activeSweep = clampNumber(currentDeg - startAngle, 0, fullAngle);
  const activeRatio = clampNumber(activeSweep / fullAngle, 0, 1);

  const pointAtDeg = (deg: number, radius: number) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx - radius * Math.sin(rad),
      y: cy + radius * Math.cos(rad),
    };
  };

  const arcPath = (startDeg: number, sweepDeg: number, radius: number) => {
    if (sweepDeg <= 0) return "";
    const endDeg = startDeg + sweepDeg;
    const s = pointAtDeg(startDeg, radius);
    const e = pointAtDeg(endDeg, radius);
    const largeArc = sweepDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const fullTrackPath = arcPath(startAngle, fullAngle, trackRadius);

  const applyValue = (next: number) => {
    const snapped = Math.round(next / step) * step;
    onChange(clampNumber(snapped, min, max));
  };

  const getDeg = (cX: number, cY: number, pts: { x: number; y: number }) => {
    const x = cX - pts.x;
    const y = cY - pts.y;
    let deg = (Math.atan(y / (x || Number.EPSILON)) * 180) / Math.PI;
    if ((x < 0 && y >= 0) || (x < 0 && y < 0)) deg += 90;
    else deg += 270;
    return Math.min(Math.max(startAngle, deg), endAngle);
  };

  const startDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (busy) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const pts  = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

    const moveHandler = (ev: MouseEvent) => {
      const deg      = getDeg(ev.clientX, ev.clientY, pts);
      const nextValue = Math.floor(((deg - startAngle) * (max - min)) / (endAngle - startAngle) + min);
      applyValue(nextValue);
    };
    const upHandler = () => {
      document.removeEventListener("mousemove", moveHandler);
      document.removeEventListener("mouseup", upHandler);
      onCommit();
    };
    document.addEventListener("mousemove", moveHandler);
    document.addEventListener("mouseup", upHandler);
  };

  const startTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (busy) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const pts  = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

    const moveHandler = (ev: TouchEvent) => {
      ev.preventDefault();
      const touch = ev.touches[0];
      if (!touch) return;
      const deg      = getDeg(touch.clientX, touch.clientY, pts);
      const nextValue = Math.floor(((deg - startAngle) * (max - min)) / (endAngle - startAngle) + min);
      applyValue(nextValue);
    };
    const endHandler = () => {
      document.removeEventListener("touchmove", moveHandler);
      document.removeEventListener("touchend", endHandler);
      onCommit();
    };
    document.addEventListener("touchmove", moveHandler, { passive: false });
    document.addEventListener("touchend", endHandler);
  };

  return (
    <div
      ref={cardRef}
      className={isSmall || !framed ? "" : "rounded-xl"}
      style={
        isSmall || !framed
          ? { padding: "2px 4px", position: "relative" }
          : {
              padding: "10px 12px",
              background: "linear-gradient(150deg, rgba(15,23,42,0.08), rgba(255,255,255,0.06)), var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "0 10px 24px rgba(2,6,23,0.14), inset 0 1px 0 rgba(255,255,255,0.22)",
              position: "relative",
            }
      }
    >
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        {/* Continuous curved dial track */}
        <div style={{ position: "relative", width: totalSize, height: totalSize, flexShrink: 0 }}>
          <svg
            width={totalSize}
            height={totalSize}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            <path
              d={fullTrackPath}
              fill="none"
              stroke="rgba(30,40,60,0.45)"
              strokeWidth={trackWidth}
              strokeLinecap="round"
              pathLength={1}
            />
            {activeRatio > 0 ? (
              <path
                d={fullTrackPath}
                fill="none"
                stroke={accent}
                strokeWidth={trackWidth}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={`${activeRatio} 1`}
                style={{ filter: `drop-shadow(0 0 4px ${accent})`, transition: "stroke-dasharray 0.08s linear" }}
              />
            ) : null}
          </svg>

          {/* Metallic knob disk, centered in the wrapper */}
          <div
            onMouseDown={startDrag}
            onTouchStart={startTouch}
            style={{
              position: "absolute",
              left: cx - knobSize / 2,
              top:  cy - knobSize / 2,
              width: knobSize,
              height: knobSize,
              borderRadius: "50%",
              border: "1px solid #222",
              borderBottom: "5px solid #222",
              backgroundImage: "radial-gradient(100% 70%, #666 6%, #333 90%)",
              boxShadow:
                (isSmall ? `0 0 ${Math.round(24 * clamp01(glowStrength))}px ${glowColor}, ` : "") +
                "0 5px 15px 2px black, 0 0 5px 3px black, 0 0 0 8px #444",
              cursor: busy ? "not-allowed" : "grab",
              opacity: busy ? 0.72 : 1,
              overflow: "hidden",
            }}
          >
            {/* Spinning metallic inner cap — grip dot is INSIDE so it rotates with the knob */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "repeating-conic-gradient(#868d99 0%, #d9dee5 14%, #9ea6b2 32%, #eef2f7 42%, #949cab 50%)",
                boxShadow: "inset 0 5px 10px rgba(255,255,255,0.45), inset 0 -12px 18px rgba(2,6,23,0.2)",
                transform: `rotate(${currentDeg}deg)`,
              }}
            >
              {/* Grip dot — child of rotating div so it moves with the knob */}
              <div
                style={{
                  position: "absolute",
                  width: "7%",
                  height: "7%",
                  bottom: "3%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  borderRadius: "50%",
                  background: accent,
                  boxShadow: `0 0 8px 1px ${accent}`,
                }}
              />
            </div>
            {/* Readout */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                pointerEvents: "none",
                fontWeight: 800,
                color: "#e2e8f0",
                textShadow: "0 1px 6px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,1)",
                fontSize: isSmall ? 20 : 28,
                zIndex: 3,
              }}
            >
              <div style={{ textAlign: "center", lineHeight: 1 }}>
                {value}
                {unit ? (
                  <small style={{ display: "block", textAlign: "center", opacity: 0.85, fontSize: 10, marginTop: 2, fontWeight: 700, color: "#cbd5e1" }}>
                    {unit}
                  </small>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: isSmall ? 6 : 8, textAlign: "center" }}>
        <span style={{ fontSize: isSmall ? 11 : 12, fontWeight: 800, color: "var(--text-2)", letterSpacing: "0.02em" }}>
          {label}
        </span>
      </div>
    </div>
  );
}

function DashboardClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  );

  useEffect(() => {
    const id = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
    }, 1000);

    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-semibold tabular-nums dash-time" style={{ fontSize: 15, color: "var(--text-3)" }}>
      {time}
    </span>
  );
}

function DashboardPageContent() {
  const searchParams = useSearchParams();
  const selectedPod = searchParams.get("pod");
  const selectedTreeId = selectedPod === "2" ? "AT00A0002" : "AT00A0001";
  const d = useLiveData(selectedTreeId);
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [explorerCycleIndex, setExplorerCycleIndex] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [cooldownLeftSec, setCooldownLeftSec] = useState(0);
  const [controlPanelTab, setControlPanelTab] = useState<ControlPanelTab>("flow");
  const lastOperationAtRef = useRef(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dialBootTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasBootstrappedDialStateRef = useRef(false);
  const dialBootStartedAtRef = useRef(Date.now());
  const isCooldownActive = cooldownLeftSec > 0;
  const controlBusy = pendingSyncCount > 0 || isCooldownActive;
  const [uiOperations, setUiOperations] = useState(d.operations);
  const [uiAirBubblesTiming, setUiAirBubblesTiming] = useState(d.airBubblesTiming);
  const [ledDraft, setLedDraft] = useState({ LED1: 0, LED2: 0, LED3: 0, LED4: 0 });
  const [nutritionDraft, setNutritionDraft] = useState({
    Motor1Volume: 0,
    Motor2Volume: 0,
    Motor3Volume: 0,
    Motor4Volume: 0,
    Motor5Volume: 0,
  });
  const operationChangeCodes: Record<keyof typeof uiOperations, number> = {
    AirBubbles: 15,
    Drain: 13,
    Fan: 16,
    Filling: 14,
    SolarCleaning: 20,
    LED1: 18,
    LED2: 19,
    LED3: 19,
    LED4: 19,
  };
  const masterLedValue = Math.round(
    (ledDraft.LED1 + ledDraft.LED2 + ledDraft.LED3 + ledDraft.LED4) / 4
  );
  const latestWeeklyBiomass = d.weeklyBiomass[d.weeklyBiomass.length - 1] ?? 0;
  const previousWeeklyBiomass = d.weeklyBiomass[d.weeklyBiomass.length - 2] ?? latestWeeklyBiomass;
  const weeklyGrowthPct = previousWeeklyBiomass > 0
    ? +(((latestWeeklyBiomass - previousWeeklyBiomass) / previousWeeklyBiomass) * 100).toFixed(1)
    : 0;
  const specificErrors: string[] = [];
  if (d.error) {
    if (d.operations.LED1 && !d.ldrStatus.LDR1) specificErrors.push("LED1");
    if (d.operations.LED2 && !d.ldrStatus.LDR2) specificErrors.push("LED2");
    if (d.operations.LED3 && !d.ldrStatus.LDR3) specificErrors.push("LED3");
    if (d.operations.LED4 && !d.ldrStatus.LDR4) specificErrors.push("LED4");
  }

  useEffect(() => {
    const ledTarget = d.ledIntensity;
    const nutritionTarget = d.nutritionDosing;
    const bubbleTarget = d.airBubblesTiming;

    const stopDialBootRamp = () => {
      if (!dialBootTimerRef.current) return;
      clearInterval(dialBootTimerRef.current);
      dialBootTimerRef.current = null;
    };

    if (!hasBootstrappedDialStateRef.current) {
      const elapsed = Date.now() - dialBootStartedAtRef.current;
      const hasNonZeroTarget =
        ledTarget.LED1 > 0 ||
        ledTarget.LED2 > 0 ||
        ledTarget.LED3 > 0 ||
        ledTarget.LED4 > 0 ||
        nutritionTarget.Motor1Volume > 0 ||
        nutritionTarget.Motor2Volume > 0 ||
        nutritionTarget.Motor3Volume > 0 ||
        nutritionTarget.Motor4Volume > 0 ||
        nutritionTarget.Motor5Volume > 0 ||
        bubbleTarget.on > 0 ||
        bubbleTarget.off > 0;

      // Wait briefly at startup so we can animate to the first fetched DB snapshot
      // instead of immediately locking in all-zero defaults.
      if (!hasNonZeroTarget && elapsed < 1500) {
        return;
      }

      if (hasNonZeroTarget) {
        stopDialBootRamp();
        let tick = 0;
        const totalTicks = 18;
        const lerpRounded = (target: number) => Math.round((target * tick) / totalTicks);

        dialBootTimerRef.current = setInterval(() => {
          tick += 1;
          setLedDraft({
            LED1: lerpRounded(ledTarget.LED1),
            LED2: lerpRounded(ledTarget.LED2),
            LED3: lerpRounded(ledTarget.LED3),
            LED4: lerpRounded(ledTarget.LED4),
          });
          setNutritionDraft({
            Motor1Volume: lerpRounded(nutritionTarget.Motor1Volume),
            Motor2Volume: lerpRounded(nutritionTarget.Motor2Volume),
            Motor3Volume: lerpRounded(nutritionTarget.Motor3Volume),
            Motor4Volume: lerpRounded(nutritionTarget.Motor4Volume),
            Motor5Volume: lerpRounded(nutritionTarget.Motor5Volume),
          });
          setUiAirBubblesTiming({
            on: Math.max(0, lerpRounded(bubbleTarget.on)),
            off: Math.max(0, lerpRounded(bubbleTarget.off)),
          });

          if (tick >= totalTicks) {
            stopDialBootRamp();
            setLedDraft(ledTarget);
            setNutritionDraft(nutritionTarget);
            setUiAirBubblesTiming(bubbleTarget);
            hasBootstrappedDialStateRef.current = true;
          }
        }, 28);
      } else {
        setLedDraft(ledTarget);
        setNutritionDraft(nutritionTarget);
        setUiAirBubblesTiming(bubbleTarget);
        hasBootstrappedDialStateRef.current = true;
      }

      return;
    }

    setLedDraft(ledTarget);
    setNutritionDraft(nutritionTarget);
    setUiAirBubblesTiming(bubbleTarget);
  }, [
    d.ledIntensity.LED1,
    d.ledIntensity.LED2,
    d.ledIntensity.LED3,
    d.ledIntensity.LED4,
    d.nutritionDosing.Motor1Volume,
    d.nutritionDosing.Motor2Volume,
    d.nutritionDosing.Motor3Volume,
    d.nutritionDosing.Motor4Volume,
    d.nutritionDosing.Motor5Volume,
    d.airBubblesTiming.on,
    d.airBubblesTiming.off,
  ]);

  useEffect(() => {
    setUiOperations(d.operations);
  }, [
    d.operations.AirBubbles,
    d.operations.Drain,
    d.operations.Fan,
    d.operations.Filling,
    d.operations.SolarCleaning,
    d.operations.LED1,
    d.operations.LED2,
    d.operations.LED3,
    d.operations.LED4,
  ]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      if (dialBootTimerRef.current) {
        clearInterval(dialBootTimerRef.current);
        dialBootTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setExplorerCycleIndex(0);
  }, [d.activeTreeId]);

  const showCooldownPopup = (remainingMs: number) => {
    const initialSec = Math.max(1, Math.ceil(remainingMs / 1000));
    setCooldownLeftSec(initialSec);

    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }

    cooldownTimerRef.current = setInterval(() => {
      setCooldownLeftSec((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const patchDevice = async (
    updates: Record<string, unknown>,
    options?: { manual?: boolean },
  ) => {
    if (!options?.manual) return;
    setPendingSyncCount((c) => c + 1);
    try {
      await fetch("/api/device-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treeId: d.activeTreeId, updates }),
      });
    } finally {
      setPendingSyncCount((c) => Math.max(0, c - 1));
    }
  };

  const encodeChangeValue = (command: number) => {
    return command;
  };

  const sendChangeCommand = async (
    command: number,
      payload: number,
    extraUpdates?: Record<string, unknown>,
    options?: { skipCooldown?: boolean },
  ) => {
    const now = Date.now();
    const isBusyFromDevice = command !== 3 && [3, 4, 5].includes(d.change);
    if (isBusyFromDevice) return false;

    if (!options?.skipCooldown) {
      const elapsed = now - lastOperationAtRef.current;
      if (elapsed < 5000) {
        showCooldownPopup(5000 - elapsed);
        return false;
      }
    }

    lastOperationAtRef.current = now;
    if (!options?.skipCooldown) {
      showCooldownPopup(5000);
    }
    await patchDevice(
      {
        ...(extraUpdates ?? {}),
          Change: encodeChangeValue(command),
      },
      { manual: true },
    );
    return true;
  };

  const toggleOperation = async (key: keyof typeof d.operations) => {
    const nextValue = !uiOperations[key];
    const nextOps = {
      ...uiOperations,
      [key]: nextValue,
    };
    setUiOperations(nextOps);
    const sent = await sendChangeCommand(operationChangeCodes[key], nextValue ? 1 : 0, {
      Operations: nextOps,
    });
    if (!sent) setUiOperations(uiOperations);
  };

  const commitIntensity = async (
    nextIntensity: typeof ledDraft,
    targets: (keyof typeof ledDraft)[],
  ) => {
    const intensityPatch = { ...d.ledIntensity };
    targets.forEach((k) => {
      intensityPatch[k] = nextIntensity[k];
    });
    const sent = await sendChangeCommand(12, 0, { Intensity: intensityPatch });
    const anySent = sent;
    if (!anySent) setLedDraft(d.ledIntensity);
  };

  const waitMs = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const commitMasterIntensitySequential = async (masterValue: number) => {
    const clampedMaster = clampNumber(Math.round(masterValue), 0, 255);
    const ledKeys = ["LED1", "LED2", "LED3", "LED4"] as const;
    const nextIntensity = {
      LED1: clampedMaster,
      LED2: clampedMaster,
      LED3: clampedMaster,
      LED4: clampedMaster,
    };

    setLedDraft(nextIntensity);

    let sequentialPatch = { ...d.ledIntensity };
    for (let i = 0; i < ledKeys.length; i += 1) {
      const key = ledKeys[i];
      sequentialPatch = {
        ...sequentialPatch,
        [key]: clampedMaster,
      };

      const sent = await sendChangeCommand(
        12,
        0,
        { Intensity: sequentialPatch },
        { skipCooldown: i > 0 },
      );

      if (!sent) {
        setLedDraft(d.ledIntensity);
        return;
      }

      if (i < ledKeys.length - 1) {
        await waitMs(120);
      }
    }
  };

  const commitNutrition = async () => {
    const sent = await sendChangeCommand(8, 0, {
      NutritionDosing: nutritionDraft,
    });
    if (!sent) setNutritionDraft(d.nutritionDosing);
  };

  const toggleFluidOperation = async (mode: "Filling" | "Drain") => {
    const nextValue = !uiOperations[mode];
    const oppositeKey = mode === "Filling" ? "Drain" : "Filling";
    const nextOps = {
      ...uiOperations,
      [mode]: nextValue,
      [oppositeKey]: nextValue ? false : uiOperations[oppositeKey],
    };
    setUiOperations(nextOps);
    const sent = await sendChangeCommand(operationChangeCodes[mode], nextValue ? 1 : 0, {
      Operations: nextOps,
    });
    if (!sent) setUiOperations(d.operations);
  };

  const updateBubblesTimingDraft = (key: "on" | "off", value: number) => {
    setUiAirBubblesTiming((prev) => ({
      on: key === "on" ? value : prev.on,
      off: key === "off" ? value : prev.off,
    }));
  };

  const commitBubblesTiming = async (key: "on" | "off") => {
    const next = uiAirBubblesTiming;
    const sent = await sendChangeCommand(7, key === "on" ? next.on : next.off, {
      Operations: {
        ...uiOperations,
        AirBubblesTiming: {
          On: next.on,
          Off: next.off,
        },
      },
    });
    if (!sent) setUiAirBubblesTiming(d.airBubblesTiming);
  };

  const cycleTotal = d.cycleExplorer.length;
  const selectedCycle = d.cycleExplorer[explorerCycleIndex];
  const cycleCanGoOlder = explorerCycleIndex < cycleTotal - 1;
  const cycleCanGoNewer = explorerCycleIndex > 0;
  const cycleSensorOrder = ["AQI", "CO2", "PH", "Temprature", "TDS", "ECO2", "TVOC", "LTurbidity", "UTurbidity"] as const;
  const cycleSensorUnit: Record<(typeof cycleSensorOrder)[number], string> = {
    AQI: "AQI",
    CO2: "ppm",
    PH: "",
    Temprature: "degC",
    TDS: "ppm",
    ECO2: "ppm",
    TVOC: "ppb",
    LTurbidity: "NTU",
    UTurbidity: "NTU",
  };
  const cycleSensorLabel: Record<(typeof cycleSensorOrder)[number], string> = {
    AQI: "AQI",
    CO2: "CO2",
    PH: "pH",
    Temprature: "Temperature",
    TDS: "TDS",
    ECO2: "ECO2",
    TVOC: "TVOC",
    LTurbidity: "Lower Turbidity",
    UTurbidity: "Upper Turbidity",
  };

  const tabLabels = ["Bio-Reactor", "Environment", "Performance", "Cycles", "System"] as const;
  const controlPanelTabs: { id: ControlPanelTab; label: string }[] = [
    { id: "flow", label: "Flow Control" },
    { id: "lighting", label: "Lighting Control" },
    { id: "algae", label: "Algae System" },
    { id: "settings", label: "System Info" },
  ];
  const tabIcons = [
    <svg key="t0" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 2v7.53a2 2 0 0 1-.21.9L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45L14.21 10.43A2 2 0 0 1 14 9.53V2"/><path d="M8.5 2h7"/></svg>,
    <svg key="t1" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><circle cx="12" cy="12" r="10"/></svg>,
    <svg key="t2" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    <svg key="t3" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>,
    <svg key="t4" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/></svg>,
  ];

  return (
    <div className="dash-fullscreen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* ────── INCOMPATIBLE DEVICE SCREEN ────── */}
      {/* Shown via CSS on screens < 1024px wide or portrait orientation */}
      <div className="dash-compat-guard">
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4"/>
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text-1, #0f172a)", marginBottom: 8 }}>Desktop Required</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2, #475569)", lineHeight: 1.6, maxWidth: 320 }}>
            The AlgaeTree AI dashboard is designed for landscape screens with a minimum width of 1024px.
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-3, #94a3b8)", marginTop: 10, lineHeight: 1.6, maxWidth: 320 }}>
            Please switch to a desktop or laptop, or rotate your device to landscape mode.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.5 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>AlgaeTree AI</span>
        </div>
      </div>
      {/* Ambient BG */}
      <div className="ambient-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Fullscreen loading overlay */}
      {navigating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            background: "var(--bg)",
          }}
        >
          <div style={{ position: "relative", width: 60, height: 60 }}>
            <svg width="60" height="60" viewBox="0 0 60 60" style={{ animation: "spin 1.2s linear infinite" }}>
              <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(34,197,94,0.15)" strokeWidth="4" />
              <path d="M30 4a26 26 0 0 1 26 26" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.5 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
            </span>
          </div>
          <p className="font-semibold" style={{ fontSize: 16, color: "var(--text-2)" }}>Loading AlgaeTree AI...</p>
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>Preparing your conversation</p>
        </motion.div>
      )}

      {cooldownLeftSec > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 130,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(2,6,23,0.34)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              borderRadius: 16,
              border: "1px solid rgba(59,130,246,0.35)",
              background: "rgba(255,255,255,0.96)",
              boxShadow: "0 14px 36px rgba(2,6,23,0.26)",
              padding: "18px 20px",
              minWidth: 260,
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 800, color: "#1d4ed8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Cooldown Active
            </p>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginTop: 6 }}>
              Controls unlock in {cooldownLeftSec}s
            </p>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginTop: 4 }}>
              Please wait before the next control action.
            </p>
          </div>
        </motion.div>
      )}

      {/* ────── NAVBAR ────── */}
      <motion.nav
        className="card relative z-10 flex items-center justify-between dash-navbar"
        style={{ margin: "20px 24px 0", padding: "14px 28px", borderRadius: 20 }}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <button
          onClick={() => router.push("/")}
          className="flex items-center cursor-pointer"
          style={{ gap: 12, background: "transparent", border: "none", padding: 0, color: "inherit" }}
          aria-label="Back to network map"
        >
          <Image src="/favicon.png" alt="AlgaeTree" width="36" height="36" style={{ borderRadius: 8 }} />
          <span className="font-bold" style={{ fontSize: 18 }}>AlgaeTree</span>
        </button>

        <div className="items-center dash-nav-tabs" style={{ gap: 8 }}>
          {tabLabels.map((t, i) => (
            <button
              key={t}
              onClick={() => setActiveTab(i)}
              className="font-medium transition-all cursor-pointer"
              style={{
                padding: "10px 22px",
                borderRadius: 14,
                fontSize: 14,
                background: i === activeTab ? "rgba(34,197,94,0.12)" : "transparent",
                color: i === activeTab ? "#16a34a" : "var(--text-2)",
                border: i === activeTab ? "1px solid rgba(34,197,94,0.2)" : "1px solid transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          className="dash-mobile-menu-btn cursor-pointer"
          onClick={() => setMenuOpen(v => !v)}
          style={{ display: "none", background: "none", border: "none", padding: 8, color: "var(--text-1)" }}
          aria-label="Menu"
        >
          <motion.div animate={menuOpen ? { rotate: 180 } : { rotate: 0 }} transition={{ duration: 0.3 }}>
            {menuOpen
              ? <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              : <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            }
          </motion.div>
        </button>

        <div className="flex items-center" style={{ gap: 14 }}>
          <DashboardClock />
        </div>
      </motion.nav>

      {/* ────── MOBILE MENU OVERLAY ────── */}
      <motion.div
        className="dash-mobile-menu-overlay"
        initial={false}
        animate={menuOpen ? { opacity: 1, pointerEvents: "auto" as const } : { opacity: 0, pointerEvents: "none" as const }}
        transition={{ duration: 0.25 }}
        onClick={() => setMenuOpen(false)}
        style={{
          display: "none", position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.6)",
        }}
      />
      <motion.div
        className="dash-mobile-menu-panel"
        initial={false}
        animate={menuOpen ? { x: 0, opacity: 1 } : { x: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        style={{
          display: "none", position: "fixed", top: 0, right: 0, bottom: 0,
          width: "75vw", maxWidth: 320, zIndex: 51,
          background: "var(--bg)", borderLeft: "1px solid var(--border)",
          padding: "80px 24px 32px", flexDirection: "column", gap: 8,
        }}
      >
        <p className="font-bold uppercase tracking-wider" style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, paddingLeft: 16 }}>Dashboard</p>
        {tabLabels.map((t, i) => (
          <motion.button
            key={t}
            onClick={() => { setActiveTab(i); setMenuOpen(false); }}
            className="flex items-center cursor-pointer font-semibold"
            style={{
              gap: 14, padding: "14px 16px", borderRadius: 16, fontSize: 15, width: "100%",
              background: i === activeTab ? "rgba(34,197,94,0.12)" : "transparent",
              color: i === activeTab ? "#4ade80" : "var(--text-2)",
              border: i === activeTab ? "1px solid rgba(34,197,94,0.2)" : "1px solid transparent",
            }}
            initial={{ x: 40, opacity: 0 }}
            animate={menuOpen ? { x: 0, opacity: 1 } : { x: 40, opacity: 0 }}
            transition={{ delay: menuOpen ? 0.05 + i * 0.06 : 0, duration: 0.3 }}
          >
            {tabIcons[i]}
            {t}
          </motion.button>
        ))}

        <div style={{ flex: 1 }} />
        <motion.button
          onClick={() => { setNavigating(true); setMenuOpen(false); router.push("/talk"); }}
          disabled={navigating}
          className="glow-btn flex items-center justify-center cursor-pointer"
          style={{
            gap: 10, padding: "16px 0", borderRadius: 16, width: "100%",
            background: "linear-gradient(135deg, #16a34a, #22c55e)",
            color: "#fff", fontWeight: 700, fontSize: 15, border: "none",
            boxShadow: "0 8px 30px rgba(34,197,94,0.3)",
          }}
          initial={{ y: 20, opacity: 0 }}
          animate={menuOpen ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
          transition={{ delay: menuOpen ? 0.3 : 0, duration: 0.35 }}
          whileTap={{ scale: 0.97 }}
        >
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
          <span>Talk to the Tree</span>
        </motion.button>
      </motion.div>

      {/* ────── BENTO GRID ────── */}
      <AnimatePresence mode="wait">
        <motion.main
          className="relative z-10 flex-1 grid overflow-hidden dash-grid"
          style={{
            padding: "16px 20px 8px",
            gap: 14,
            gridTemplateColumns: activeTab === 0 ? "1.1fr 1fr 1fr" : "1fr 1fr 1fr",
            gridTemplateRows: activeTab === 0 ? "1fr 1fr auto" : "1fr 1fr auto",
          }}
          variants={stagger}
          initial="hidden"
          animate="show"
          exit="hidden"
          transition={{ duration: 0.4 }}
          key={`${activeTab}-${d.activeTreeId}`}
        >

        {/* ═══════════ TAB 0 — BIO-REACTOR ═══════════ */}
        {activeTab === 0 && (
          <>
            {/* ── HERO CARD (spans 1 col, 2 rows) — hidden on mobile ── */}
            <motion.div
              className="card flex flex-col dash-hero"
              style={{
                padding: 32, gridRow: "1 / 3",
                background: "var(--surface)",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ['--card-tint' as any]: 'rgba(34,197,94,0.12)',
              }}
              variants={rise}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
                <div className="flex items-center" style={{ gap: 12 }}>
                  <div className="rounded-2xl flex items-center justify-center" style={{ width: 48, height: 48, background: "rgba(34,197,94,0.1)" }}>
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><path d="M10 2v7.53a2 2 0 0 1-.21.9L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45L14.21 10.43A2 2 0 0 1 14 9.53V2"/><path d="M8.5 2h7"/></svg>
                  </div>
                  <div>
                    <span className="font-bold" style={{ fontSize: 18 }}>Bio-Reactor Core</span>
                    <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2, fontWeight: 500 }}>{d.activeTreeId}</p>
                  </div>
                </div>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <Badge label="Optimal" />
                  <motion.button
                    onClick={() => { setNavigating(true); router.push(`/talk?tree=${d.activeTreeId}`); }}
                    disabled={navigating}
                    className="cursor-pointer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 14px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.22)",
                      background: navigating ? "#14532d" : "#166534",
                      color: "#ffffff",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      opacity: navigating ? 0.85 : 1,
                      lineHeight: 1,
                    }}
                    whileTap={navigating ? {} : { scale: 0.97 }}
                  >
                    {navigating ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.35" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        <span>Loading</span>
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                        <span>Talk</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center dash-tree-section" style={{ position: "relative" }}>
                <div
                  className="absolute"
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 1,
                    zIndex: 0,
                    maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 68%, rgba(0,0,0,0.25) 86%, rgba(0,0,0,0) 100%)",
                    WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 68%, rgba(0,0,0,0.25) 86%, rgba(0,0,0,0) 100%)",
                    pointerEvents: "none",
                  }}
                >
                  <Image
                    src="/Algaetree.png"
                    alt="AlgaeTree"
                    fill
                    className="object-contain"
                    style={{
                      filter: "drop-shadow(0 24px 48px rgba(34,197,94,0.2))",
                      objectPosition: "center 42%",
                    }}
                    priority
                  />
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 168,
                    background: "linear-gradient(to top, var(--surface) 0%, transparent 100%)",
                    borderBottomLeftRadius: 24,
                    borderBottomRightRadius: 24,
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: 12,
                    transform: "translateX(-50%)",
                    zIndex: 2,
                    textAlign: "center",
                  }}
                >
                  <motion.p className="font-black text-green-400 leading-none" style={{ fontSize: "4.5rem", filter: "drop-shadow(0 0 40px rgba(34,197,94,0.3))" }} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>{d.co2Ambient}</motion.p>
                  <p className="font-bold uppercase tracking-[0.3em]" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>CO2 (ppm)</p>
                </div>
              </div>
            </motion.div>

            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><path d="M10 2v7.53a2 2 0 0 1-.21.9L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45L14.21 10.43A2 2 0 0 1 14 9.53V2"/><path d="M8.5 2h7"/></svg>} label="pH Level" value={d.ph} unit="pH" min={GAUGE_RANGES.bioReactor.ph.min} max={GAUGE_RANGES.bioReactor.ph.max} color="#4ade80" delay={0.2} tint="rgba(34,197,94,0.04)" />
            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>} label="TDS" value={d.tds} unit="ppm" min={GAUGE_RANGES.bioReactor.tds.min} max={GAUGE_RANGES.bioReactor.tds.max} color="#38bdf8" delay={0.3} tint="rgba(56,189,248,0.04)" />
            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#f97316" strokeWidth="2" strokeLinecap="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>} label="Temperature" value={d.temp} unit="°C" min={GAUGE_RANGES.bioReactor.temperature.min} max={GAUGE_RANGES.bioReactor.temperature.max} color="#f97316" delay={0.4} tint="rgba(249,115,22,0.04)" />

            {/* Efficiency gauge (mobile only) */}
            <div className="dash-mobile-efficiency" style={{ display: "none" }}>
              <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} label="Efficiency" value={d.efficiency} unit="%" min={GAUGE_RANGES.bioReactor.efficiency.min} max={GAUGE_RANGES.bioReactor.efficiency.max} color="#4ade80" delay={0.35} tint="rgba(34,197,94,0.04)" />
            </div>

            {/* Biomass + Growth */}
            <motion.div className="card flex flex-col dash-mobile-biomass" style={{ padding: 28, background: "var(--surface)", ['--card-tint' as React.CSSProperties & string]: 'rgba(34,197,94,0.12)' } as React.CSSProperties} variants={rise}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>
                  <span className="font-semibold" style={{ fontSize: 15, color: "var(--text-2)" }}>Biomass & Growth</span>
                </div>
                <Badge label="Growing" />
              </div>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <div>
                  <motion.span className="font-extrabold" style={{ fontSize: 38 }} key={String(d.biomass)} initial={{ opacity: 0.6, y: 3 }} animate={{ opacity: 1, y: 0 }}>{d.biomass}</motion.span>
                  <span style={{ fontSize: 13, color: "var(--text-3)", marginLeft: 4 }}>g/L</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-400" style={{ fontSize: 18 }}>+{d.growth}%</p>
                  <p style={{ fontSize: 10, color: "var(--text-3)" }}>per cycle</p>
                </div>
              </div>
              <AnimBar pct={(d.biomass / 5) * 100} color="#4ade80" delay={0.4} />
              <div style={{ marginTop: 22, flex: 1, display: "flex", alignItems: "flex-end" }}>
                <BarChart delay={0.5} bars={d.weeklyBiomass.map((v, i) => ({
                  label: `C${i + 1}`,
                  value: v,
                  max: Math.max(5, ...d.weeklyBiomass),
                  color: i === d.weeklyBiomass.length - 1 ? "#16a34a" : "#4ade80",
                }))} overflowWhenDense />
              </div>
            </motion.div>

            {/* Mobile CTA */}
            <motion.button className="glow-btn dash-mobile-cta cursor-pointer" style={{ display: "none", alignItems: "center", justifyContent: "center", gap: 10, padding: "20px 16px", borderRadius: 20, background: navigating ? "linear-gradient(135deg, #15803d, #16a34a)" : "linear-gradient(135deg, #16a34a, #22c55e)", color: "#fff", fontWeight: 700, fontSize: 15, border: "1px solid rgba(34,197,94,0.3)", boxShadow: "0 8px 30px rgba(34,197,94,0.3)", opacity: navigating ? 0.85 : 1 }} variants={rise} onClick={() => { setNavigating(true); router.push(`/talk?tree=${d.activeTreeId}`); }} disabled={navigating} whileTap={navigating ? {} : { scale: 0.97 }}>
              {navigating ? (<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg><span>Loading...</span></>) : (<><svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg><span>Talk to the Tree</span></>)}
            </motion.button>
          </>
        )}

        {/* ═══════════ TAB 1 — ENVIRONMENT ═══════════ */}
        {activeTab === 1 && (
          <>
            {/* Hero: Environment overview */}
            <motion.div
              className="card flex flex-col dash-hero"
              style={{
                padding: 32, gridRow: "1 / 3",
                background: "var(--surface)",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ['--card-tint' as any]: 'rgba(56,189,248,0.12)',
              }}
              variants={rise}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
                <div className="flex items-center" style={{ gap: 12 }}>
                  <div className="rounded-2xl flex items-center justify-center" style={{ width: 48, height: 48, background: "rgba(56,189,248,0.1)" }}>
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><circle cx="12" cy="12" r="10"/></svg>
                  </div>
                  <span className="font-bold" style={{ fontSize: 18 }}>Environment</span>
                </div>
                <Badge label="Normal" />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center dash-tree-section" style={{ position: "relative", paddingTop: 8 }}>
                <AQIGauge value={+d.airQuality} />
              </div>
              {/* Env mini stats */}
              <div className="grid grid-cols-3" style={{ gap: 10, marginTop: 16 }}>
                {[{ l: "ECO2", v: `${d.eco2} ppm` }, { l: "CO2", v: `${d.co2Ambient} ppm` }, { l: "TVOC", v: `${d.tvoc}` }].map(s => (
                  <div key={s.l} className="rounded-xl" style={{ padding: "14px 16px", background: "var(--mini-bg)" }}>
                    <p className="font-semibold uppercase tracking-wider" style={{ fontSize: 9, color: "var(--text-3)" }}>{s.l}</p>
                    <p className="font-bold" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.2, overflowWrap: "anywhere" }}>{s.v}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#f97316" strokeWidth="2" strokeLinecap="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>} label="Temperature" value={+d.temp} unit="°C" min={GAUGE_RANGES.environment.temperature.min} max={GAUGE_RANGES.environment.temperature.max} color="#f97316" delay={0.2} tint="rgba(249,115,22,0.04)" />
            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>} label="Lower Turbidity" value={+d.lTurbidity} unit="NTU" min={GAUGE_RANGES.environment.lowerTurbidity.min} max={GAUGE_RANGES.environment.lowerTurbidity.max} color="#38bdf8" delay={0.3} tint="rgba(56,189,248,0.04)" />
            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>} label="Upper Turbidity" value={+d.uTurbidity} unit="NTU" min={GAUGE_RANGES.environment.upperTurbidity.min} max={GAUGE_RANGES.environment.upperTurbidity.max} color="#fbbf24" delay={0.4} tint="rgba(251,191,36,0.04)" />

            {/* CO₂ & Atmospheric card */}
            <motion.div className="card flex flex-col" style={{ padding: 28, background: "var(--surface)", ['--card-tint' as React.CSSProperties & string]: 'rgba(56,189,248,0.12)' } as React.CSSProperties} variants={rise}>
              <div className="flex items-center" style={{ gap: 8, marginBottom: 12 }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>
                <span className="font-semibold" style={{ fontSize: 15, color: "var(--text-2)" }}>Atmospheric CO₂</span>
              </div>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <div>
                  <motion.span className="font-extrabold" style={{ fontSize: 38 }} key={String(d.co2Ambient)} initial={{ opacity: 0.6, y: 3 }} animate={{ opacity: 1, y: 0 }}>{d.co2Ambient}</motion.span>
                  <span style={{ fontSize: 13, color: "var(--text-3)", marginLeft: 4 }}>ppm</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sky-400" style={{ fontSize: 18 }}>Normal</p>
                  <p style={{ fontSize: 10, color: "var(--text-3)" }}>outdoor range</p>
                </div>
              </div>
              <AnimBar pct={Math.min((d.co2Ambient / 800) * 100, 100)} color="#38bdf8" delay={0.4} />
              <div style={{ marginTop: 22, flex: 1, display: "flex", alignItems: "flex-end" }}>
                <BarChart delay={0.5} bars={d.co2History.map((v, i) => ({
                  label: d.historyLabels[i] ?? `P${i + 1}`,
                  value: v,
                  max: Math.max(800, ...d.co2History),
                  color: i === d.co2History.length - 1 ? "#0ea5e9" : "#38bdf8",
                }))} />
              </div>
            </motion.div>
          </>
        )}

        {/* ═══════════ TAB 2 — PERFORMANCE ═══════════ */}
        {activeTab === 2 && (
          <>
            {/* Hero: Performance overview */}
            <motion.div
              className="card flex flex-col dash-hero"
              style={{
                padding: 32, gridRow: "1 / 3",
                background: "var(--surface)",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ['--card-tint' as any]: 'rgba(168,85,247,0.12)',
              }}
              variants={rise}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
                <div className="flex items-center" style={{ gap: 12 }}>
                  <div className="rounded-2xl flex items-center justify-center" style={{ width: 48, height: 48, background: "rgba(168,85,247,0.1)" }}>
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  </div>
                  <span className="font-bold" style={{ fontSize: 18 }}>Performance</span>
                </div>
                <Badge label="High" />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center dash-tree-section" style={{ position: "relative", overflow: "hidden" }}>
                <div
                  className="absolute"
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0.96,
                    zIndex: 0,
                    maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 68%, rgba(0,0,0,0.25) 86%, rgba(0,0,0,0) 100%)",
                    WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 68%, rgba(0,0,0,0.25) 86%, rgba(0,0,0,0) 100%)",
                    pointerEvents: "none",
                  }}
                >
                  <Image
                    src="/perf-card.png"
                    alt="Performance module"
                    fill
                    className="object-contain"
                    style={{
                      filter: "drop-shadow(0 24px 48px rgba(168,85,247,0.18))",
                      objectPosition: "center 42%",
                    }}
                    priority
                  />
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 168,
                    background: "linear-gradient(to top, var(--surface) 0%, transparent 100%)",
                    borderBottomLeftRadius: 24,
                    borderBottomRightRadius: 24,
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: 12,
                    transform: "translateX(-50%)",
                    zIndex: 2,
                    textAlign: "center",
                  }}
                >
                  <motion.p className="font-black text-purple-400 leading-none" style={{ fontSize: "4.5rem", filter: "drop-shadow(0 0 40px rgba(168,85,247,0.3))" }} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>{d.nutrientEff}%</motion.p>
                  <p className="font-bold uppercase tracking-[0.3em]" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>Nutrient Efficiency</p>
                </div>
              </div>
              {/* Performance mini stats */}
              <div className="grid grid-cols-3" style={{ gap: 10, marginTop: 16 }}>
                {[{ l: "ENERGY", v: `${d.energyUsage}W` }, { l: "WATER", v: `${d.waterUsage} L/h` }, { l: "O₂ PROD", v: `${d.oxygenProd} g/h` }].map(s => (
                  <div key={s.l} className="rounded-xl" style={{ padding: "14px 16px", background: "var(--mini-bg)" }}>
                    <p className="font-semibold uppercase tracking-wider" style={{ fontSize: 9, color: "var(--text-3)" }}>{s.l}</p>
                    <p className="font-bold" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.2, overflowWrap: "anywhere" }}>{s.v}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} label="Photosynthesis Rate" value={+d.photosynthRate} unit="µmol/s" min={GAUGE_RANGES.performance.photosynthesisRate.min} max={GAUGE_RANGES.performance.photosynthesisRate.max} color="#a855f7" delay={0.2} tint="rgba(168,85,247,0.04)" />
            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>} label="Carbon Fixation" value={+d.carbonFixRate} unit="g/h" min={GAUGE_RANGES.performance.carbonFixation.min} max={GAUGE_RANGES.performance.carbonFixation.max} color="#4ade80" delay={0.3} tint="rgba(34,197,94,0.04)" />
            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67 0C8.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>} label="Energy Usage" value={d.energyUsage} unit="W" min={GAUGE_RANGES.performance.energyUsage.min} max={GAUGE_RANGES.performance.energyUsage.max} color="#fbbf24" delay={0.4} tint="rgba(251,191,36,0.04)" />

            {/* Weekly Biomass Output chart */}
            <motion.div className="card flex flex-col" style={{ padding: 28, background: "var(--surface)", ['--card-tint' as React.CSSProperties & string]: 'rgba(168,85,247,0.12)' } as React.CSSProperties} variants={rise}>
              <div className="flex items-center" style={{ gap: 8, marginBottom: 12 }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                <span className="font-semibold" style={{ fontSize: 15, color: "var(--text-2)" }}>Weekly Biomass Output</span>
              </div>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <div>
                  <motion.span className="font-extrabold" style={{ fontSize: 38 }} key={String(latestWeeklyBiomass)} initial={{ opacity: 0.6, y: 3 }} animate={{ opacity: 1, y: 0 }}>{latestWeeklyBiomass}</motion.span>
                  <span style={{ fontSize: 13, color: "var(--text-3)", marginLeft: 4 }}>g/L today</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-purple-400" style={{ fontSize: 18 }}>{weeklyGrowthPct > 0 ? `+${weeklyGrowthPct}` : `${weeklyGrowthPct}`}%</p>
                  <p style={{ fontSize: 10, color: "var(--text-3)" }}>vs previous cycle</p>
                </div>
              </div>
              <AnimBar pct={(latestWeeklyBiomass / Math.max(5, ...d.weeklyBiomass)) * 100} color="#a855f7" delay={0.4} />
              <div style={{ marginTop: 22, flex: 1, display: "flex", alignItems: "flex-end" }}>
                <BarChart delay={0.5} bars={d.weeklyBiomass.map((v, i) => ({
                  label: `C${i + 1}`,
                  value: v,
                  max: Math.max(5, ...d.weeklyBiomass),
                  color: i === d.weeklyBiomass.length - 1 ? "#7c3aed" : "#a855f7",
                }))} overflowWhenDense />
              </div>
            </motion.div>
          </>
        )}

        {/* ═══════════ TAB 3 — CYCLES ═══════════ */}
        {activeTab === 3 && (
          <>
            <motion.div
              className="card flex flex-col dash-hero"
              style={{
                padding: 28, gridRow: "1 / 3",
                background: "var(--surface)",
                ['--card-tint' as React.CSSProperties & string]: 'rgba(59,130,246,0.12)',
              } as React.CSSProperties}
              variants={rise}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div className="flex items-center" style={{ gap: 10 }}>
                  <div className="rounded-2xl flex items-center justify-center" style={{ width: 44, height: 44, background: "rgba(59,130,246,0.1)" }}>
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                  </div>
                  <div>
                    <p className="font-bold" style={{ fontSize: 18 }}>Cycle Explorer</p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>
                      {selectedCycle ? `Cycle ${selectedCycle.key}` : "No cycles available"}
                    </p>
                  </div>
                </div>
                <Badge label={selectedCycle?.endDate === "Current" ? "Current" : "Archived"} color={selectedCycle?.endDate === "Current" ? "green" : "orange"} />
              </div>

              <div className="grid grid-cols-3" style={{ gap: 8, marginBottom: 14 }}>
                {[
                  { l: "Total Cycles", v: String(cycleTotal) },
                  { l: "Start Date", v: selectedCycle?.startDate ?? "--/--/----" },
                  { l: "End Date", v: selectedCycle?.endDate ?? "--/--/----" },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl" style={{ padding: "10px 10px", border: "1px solid var(--border)", background: "var(--mini-bg)" }}>
                    <p style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.l}</p>
                    <p style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 800, marginTop: 4 }}>{s.v}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3" style={{ gap: 8, marginBottom: 14 }}>
                {[
                  { l: "Biomass", v: `${selectedCycle?.biomass ?? 0} kg` },
                  { l: "CO2 Captured", v: `${selectedCycle?.co2Captured ?? 0} kg` },
                  { l: "O2 Released", v: `${selectedCycle?.o2Released ?? 0} kg` },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl" style={{ padding: "10px 10px", border: "1px solid var(--border)", background: "var(--mini-bg)" }}>
                    <p style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.l}</p>
                    <p style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 800, marginTop: 4 }}>{s.v}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between" style={{ gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setExplorerCycleIndex((idx) => Math.min(idx + 1, cycleTotal - 1))}
                  disabled={!cycleCanGoOlder}
                  className="cursor-pointer"
                  style={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: cycleCanGoOlder ? "var(--mini-bg)" : "rgba(148,163,184,0.12)",
                    color: cycleCanGoOlder ? "var(--text-2)" : "var(--text-3)",
                    padding: "10px 12px",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    opacity: cycleCanGoOlder ? 1 : 0.6,
                  }}
                >
                  Older Cycle
                </button>
                <button
                  type="button"
                  onClick={() => setExplorerCycleIndex((idx) => Math.max(idx - 1, 0))}
                  disabled={!cycleCanGoNewer}
                  className="cursor-pointer"
                  style={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: cycleCanGoNewer ? "var(--mini-bg)" : "rgba(148,163,184,0.12)",
                    color: cycleCanGoNewer ? "var(--text-2)" : "var(--text-3)",
                    padding: "10px 12px",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    opacity: cycleCanGoNewer ? 1 : 0.6,
                  }}
                >
                  Newer Cycle
                </button>
              </div>
            </motion.div>

            <motion.div
              className="card flex flex-col"
              style={{
                padding: 24,
                gridColumn: "2 / 4",
                gridRow: "1 / 3",
                minHeight: 0,
                background: "var(--surface)",
                ['--card-tint' as React.CSSProperties & string]: 'rgba(59,130,246,0.12)',
              } as React.CSSProperties}
              variants={rise}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <span className="font-semibold" style={{ fontSize: 15, color: "var(--text-2)" }}>Cycle Sensor Data</span>
                <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>
                  {selectedCycle?.dates?.length ?? 0} samples
                </span>
              </div>

              {!selectedCycle ? (
                <div className="rounded-xl" style={{ padding: 14, border: "1px solid var(--border)", background: "var(--mini-bg)", color: "var(--text-3)", fontWeight: 700 }}>
                  No cycle data found for this device.
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
                  <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                    {cycleSensorOrder.map((sensor) => {
                      const values = selectedCycle.series[sensor];
                      const latest = values[values.length - 1] ?? 0;
                      const min = values.length ? Math.min(...values) : 0;
                      const max = values.length ? Math.max(...values) : 0;
                      return (
                        <div key={sensor} className="rounded-xl" style={{ padding: "10px 10px", border: "1px solid var(--border)", background: "var(--mini-bg)" }}>
                          <p style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cycleSensorLabel[sensor]}</p>
                          <p style={{ fontSize: 14, color: "var(--text-2)", fontWeight: 800, marginTop: 3 }}>
                            {latest} <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>{cycleSensorUnit[sensor]}</span>
                          </p>
                          <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4 }}>
                            min {min} | max {max}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl" style={{ marginTop: 10, padding: "10px 10px", border: "1px solid var(--border)", background: "var(--mini-bg)" }}>
                    <p style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Sample Dates</p>
                    <p style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 700, overflowWrap: "anywhere" }}>
                      {(selectedCycle.dates.length ? selectedCycle.dates : ["No dates"]).join(" | ")}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}

        {/* ═══════════ TAB 4 — SYSTEM ═══════════ */}
        {activeTab === 4 && (
          <>
            {/* Hero: System Status */}
            <motion.div
              className="card flex flex-col dash-hero"
              style={{
                padding: 32, gridRow: "1 / 3",
                background: "var(--surface)",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ['--card-tint' as any]: 'rgba(251,191,36,0.12)',
              }}
              variants={rise}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
                <div className="flex items-center" style={{ gap: 12 }}>
                  <div className="rounded-2xl flex items-center justify-center" style={{ width: 48, height: 48, background: "rgba(251,191,36,0.1)" }}>
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/></svg>
                  </div>
                  <span className="font-bold" style={{ fontSize: 18 }}>System Health</span>
                </div>
                <Badge label={d.networkUp ? "Online" : "Offline"} color={d.networkUp ? "green" : "orange"} />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center dash-tree-section" style={{ position: "relative", overflow: "hidden", marginTop: 4 }}>
                {(() => {
                  const batteryPercentage = Math.max(0, Math.min(100, Number(d.batteryPercentage ?? 0)));
                  const isCharging = Boolean(d.batteryCharging);
                  const batteryFill = batteryPercentage >= 70
                    ? "linear-gradient(90deg, #22c55e 0%, #4ade80 100%)"
                    : batteryPercentage >= 45
                      ? "linear-gradient(90deg, #eab308 0%, #facc15 100%)"
                      : batteryPercentage >= 20
                        ? "linear-gradient(90deg, #f97316 0%, #fb923c 100%)"
                        : "linear-gradient(90deg, #ef4444 0%, #f87171 100%)";

                  return (
                    <>
                <div
                  className="absolute"
                  style={{
                    position: "absolute",
                    top: 0,
                    inset: 0,
                    zIndex: 0,
                    pointerEvents: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0",
                    marginBottom: "10em",
                    marginTop: "-6em",
                  }}
                >
                  <img
                    src="/System.png"
                    alt="System module"
                    style={{
                      maxWidth: "72%",
                      maxHeight: "72%",
                      objectFit: "contain",
                      filter: "drop-shadow(0 24px 48px rgba(251,191,36,0.18))",
                    }}
                  />
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 220,
                    background: "linear-gradient(to top, var(--surface) 10%, rgba(255,255,255,0.86) 42%, rgba(255,255,255,0.18) 72%, transparent 100%)",
                    borderBottomLeftRadius: 24,
                    borderBottomRightRadius: 24,
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: 26,
                    transform: "translateX(-50%)",
                    zIndex: 2,
                    textAlign: "center",
                    minWidth: 280,
                    width: "min(78%, 380px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <motion.p className="font-black text-amber-400 leading-none" style={{ fontSize: "4.5rem", filter: "drop-shadow(0 0 40px rgba(251,191,36,0.28))" }} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>{d.sensorHealth}%</motion.p>
                  <p className="font-bold uppercase tracking-[0.3em]" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 0 }}>Sensor Health</p>
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
                    <div className="flex items-center justify-between" style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-3)", padding: "0" }}>
                    </div>
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: 50,
                        borderRadius: 999,
                        overflow: "hidden",
                        padding: 0,
                        background: "linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(226,232,240,0.18) 100%)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 3px rgba(15,23,42,0.12), 0 12px 24px rgba(15,23,42,0.08)",
                      }}
                    >
                      
                      <div
                        style={{
                          position: "absolute",
                          inset: 4,
                          borderRadius: 999,
                          background: "rgba(15,23,42,0.12)",
                        }}
                      />
                      
                      <motion.div
                        style={{
                          position: "absolute",
                          top: 4,
                          left: 4,
                          bottom: 4,
                          width: `${batteryPercentage}%`,
                          minWidth: batteryPercentage > 0 ? 44 : 0,
                          borderRadius: 999,
                          background: batteryFill,
                          boxShadow: isCharging
                            ? "inset 0 1px 0 rgba(255,255,255,0.34), 0 0 18px rgba(34,197,94,0.28)"
                            : "inset 0 1px 0 rgba(255,255,255,0.34), 0 0 18px rgba(248,250,252,0.12)",
                          transition: "width 240ms ease, background 240ms ease",
                        }}
                        animate={isCharging ? {
                          boxShadow: [
                            "inset 0 1px 0 rgba(255,255,255,0.34), 0 0 10px rgba(34,197,94,0.18)",
                            "inset 0 1px 0 rgba(255,255,255,0.44), 0 0 24px rgba(34,197,94,0.45)",
                            "inset 0 1px 0 rgba(255,255,255,0.34), 0 0 10px rgba(34,197,94,0.18)",
                          ],
                          opacity: [0.92, 1, 0.92],
                        } : { boxShadow: isCharging
                          ? "inset 0 1px 0 rgba(255,255,255,0.34), 0 0 18px rgba(34,197,94,0.28)"
                          : "inset 0 1px 0 rgba(255,255,255,0.34), 0 0 18px rgba(248,250,252,0.12)", opacity: 1 }}
                        transition={isCharging ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.24 }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            inset: "1px 1px auto 1px",
                            height: "48%",
                            borderRadius: 999,
                            background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.04) 100%)",
                          }}
                        />
                      </motion.div>
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 800,
                          color: "#0f172a",
                          textShadow: "0 1px 0 rgba(255,255,255,0.3)",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {batteryPercentage}%
                      </div>
                    </div>
                  </div>
                  <span className="">Battery</span>
                </div>
                    </>
                  );
                })()}
              </div>
              
            </motion.div>

            {/* Device Control (single large card) */}
            <motion.div
              className="card flex flex-col"
              style={{
                padding: 20,
                gridColumn: "2 / 4",
                gridRow: "1 / 3",
                minHeight: 0,
                position: "relative",
                background: "var(--surface)",
                ['--card-tint' as React.CSSProperties & string]: 'rgba(56,189,248,0.12)',
              } as React.CSSProperties}
              variants={rise}
            >
              {controlBusy && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(15,23,42,0.18)",
                    backdropFilter: "blur(3px)",
                    WebkitBackdropFilter: "blur(3px)",
                    borderRadius: 20,
                    pointerEvents: "auto",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "rgba(255,255,255,0.9)",
                      border: "1px solid rgba(34,197,94,0.25)",
                      borderRadius: 999,
                      padding: "10px 14px",
                      color: "#166534",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                      <circle cx="12" cy="12" r="10" stroke="rgba(22,101,52,0.2)" strokeWidth="3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Syncing controls...
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between" style={{ gap: 8, marginBottom: 12 }}>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  <span className="font-semibold" style={{ fontSize: 16, color: "var(--text-2)" }}>Device Control Center</span>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>
                  {pendingSyncCount > 0
                    ? "SYNCING..."
                    : cooldownLeftSec > 0
                      ? `COOLDOWN ${cooldownLeftSec}s`
                      : `LIVE | CHANGE ${d.change}`}
                </span>
              </div>

              <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 12 }}>
                {controlPanelTabs.map((panelTab) => {
                  const active = controlPanelTab === panelTab.id;
                  return (
                    <button
                      key={panelTab.id}
                      type="button"
                      onClick={() => setControlPanelTab(panelTab.id)}
                      className="cursor-pointer"
                      style={{
                        borderRadius: 12,
                        border: active ? "1px solid rgba(56,189,248,0.45)" : "1px solid rgba(148,163,184,0.25)",
                        background: active
                          ? "linear-gradient(140deg, rgba(56,189,248,0.2), rgba(14,116,144,0.08))"
                          : "linear-gradient(140deg, rgba(15,23,42,0.08), rgba(148,163,184,0.06))",
                        color: active ? "#0284c7" : "var(--text-2)",
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        padding: "8px 12px",
                        boxShadow: active ? "0 10px 20px rgba(2,132,199,0.15)" : "none",
                      }}
                    >
                      {panelTab.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", paddingRight: 2 }}>
                {controlPanelTab === "flow" && (
                  <div className="rounded-2xl" style={{ minHeight: "100%", padding: 12, border: "1px solid var(--border)", background: "linear-gradient(150deg, rgba(15,23,42,0.08), rgba(56,189,248,0.04))", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                      <ToggleChip label="Refilling" enabled={uiOperations.Filling} busy={controlBusy} onToggle={() => { void toggleFluidOperation("Filling"); }} />
                      <ToggleChip label="Drain" enabled={uiOperations.Drain} busy={controlBusy} onToggle={() => { void toggleFluidOperation("Drain"); }} />
                      <ToggleChip label="Air Purification" enabled={uiOperations.Fan} busy={controlBusy} onToggle={() => { void toggleOperation("Fan"); }} />
                      <ToggleChip label="Oxygen Infusion" enabled={uiOperations.AirBubbles} busy={controlBusy} onToggle={() => { void toggleOperation("AirBubbles"); }} />
                      <div style={{ gridColumn: "1 / -1" }}>
                        <ToggleChip label="Solar Cleaning" enabled={uiOperations.SolarCleaning} busy={controlBusy} onToggle={() => { void toggleOperation("SolarCleaning"); }} />
                      </div>
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: "auto" }}>
                      <RoundKnob
                        label="Bubble ON"
                        value={uiAirBubblesTiming.on}
                        min={0}
                        max={120}
                        unit="min"
                        accent="#38bdf8"
                        variant="large"
                        framed={false}
                        busy={controlBusy}
                        onChange={(v) => updateBubblesTimingDraft("on", v)}
                        onCommit={() => { void commitBubblesTiming("on"); }}
                      />
                      <RoundKnob
                        label="Bubble OFF"
                        value={uiAirBubblesTiming.off}
                        min={0}
                        max={120}
                        unit="min"
                        accent="#22c55e"
                        variant="large"
                        framed={false}
                        busy={controlBusy}
                        onChange={(v) => updateBubblesTimingDraft("off", v)}
                        onCommit={() => { void commitBubblesTiming("off"); }}
                      />
                    </div>
                  </div>
                )}

                {controlPanelTab === "lighting" && (
                  <div className="rounded-2xl" style={{ minHeight: "100%", padding: 12, border: "1px solid var(--border)", background: "linear-gradient(150deg, rgba(34,197,94,0.12), rgba(56,189,248,0.04))", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="rounded-xl" style={{ padding: "10px 12px", border: "1px solid var(--border)", background: "var(--mini-bg)" }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-2)", letterSpacing: "0.03em", textTransform: "uppercase" }}>Master Lighting</span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#16a34a" }}>{masterLedValue}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={255}
                        step={1}
                        value={masterLedValue}
                        disabled={controlBusy}
                        onChange={(e) => {
                          const next = clampNumber(Number(e.currentTarget.value), 0, 255);
                          setLedDraft({
                            LED1: next,
                            LED2: next,
                            LED3: next,
                            LED4: next,
                          });
                        }}
                        onMouseUp={(e) => {
                          void commitMasterIntensitySequential(Number(e.currentTarget.value));
                        }}
                        onTouchEnd={(e) => {
                          void commitMasterIntensitySequential(Number(e.currentTarget.value));
                        }}
                        style={{
                          width: "100%",
                          accentColor: "#22c55e",
                          cursor: controlBusy ? "not-allowed" : "pointer",
                          opacity: controlBusy ? 0.7 : 1,
                        }}
                      />
                      <p style={{ marginTop: 6, fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>
                        Applies one zone at a time in sequence: LED1 → LED2 → LED3 → LED4.
                      </p>
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                      {([
                        { key: "LED1", label: "Grow Light Zone 1", enabled: uiOperations.LED1 },
                        { key: "LED2", label: "Grow Light Zone 2", enabled: uiOperations.LED2 },
                        { key: "LED3", label: "Grow Light Zone 3", enabled: uiOperations.LED3 },
                        { key: "LED4", label: "Grow Light Zone 4", enabled: uiOperations.LED4 },
                      ] as const).map((item) => (
                        <ToggleChip key={item.key} label={item.label} enabled={item.enabled} busy={controlBusy} onToggle={() => { void toggleOperation(item.key); }} />
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: "auto" }}>
                      <RoundKnob label="Brightness 1" value={ledDraft.LED1} min={0} max={255} accent="#22c55e" glowColor="#22c55e" glowStrength={ledDraft.LED1 / 255} variant="small" busy={controlBusy} onChange={(v) => setLedDraft((p) => ({ ...p, LED1: v }))} onCommit={() => { void commitIntensity(ledDraft, ["LED1"]); }} />
                      <RoundKnob label="Brightness 2" value={ledDraft.LED2} min={0} max={255} accent="#22c55e" glowColor="#22c55e" glowStrength={ledDraft.LED2 / 255} variant="small" busy={controlBusy} onChange={(v) => setLedDraft((p) => ({ ...p, LED2: v }))} onCommit={() => { void commitIntensity(ledDraft, ["LED2"]); }} />
                      <RoundKnob label="Brightness 3" value={ledDraft.LED3} min={0} max={255} accent="#22c55e" glowColor="#22c55e" glowStrength={ledDraft.LED3 / 255} variant="small" busy={controlBusy} onChange={(v) => setLedDraft((p) => ({ ...p, LED3: v }))} onCommit={() => { void commitIntensity(ledDraft, ["LED3"]); }} />
                      <RoundKnob label="Brightness 4" value={ledDraft.LED4} min={0} max={255} accent="#22c55e" glowColor="#22c55e" glowStrength={ledDraft.LED4 / 255} variant="small" busy={controlBusy} onChange={(v) => setLedDraft((p) => ({ ...p, LED4: v }))} onCommit={() => { void commitIntensity(ledDraft, ["LED4"]); }} />
                    </div>
                  </div>
                )}

                {controlPanelTab === "algae" && (
                  <div className="rounded-2xl" style={{ minHeight: "100%", padding: 12, border: "1px solid var(--border)", background: "linear-gradient(150deg, rgba(34,197,94,0.12), rgba(22,163,74,0.05))", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start", gap: 10 }}>
                      {([
                        "Motor1Volume",
                        "Motor2Volume",
                        "Motor3Volume",
                        "Motor4Volume",
                        "Motor5Volume",
                      ] as const).map((k, idx) => (
                        <div key={k} style={{ flex: "0 1 calc(33.333% - 10px)", maxWidth: "calc(33.333% - 10px)", minWidth: 260 }}>
                          <RoundKnob
                            label={`Dosing M${idx + 1}`}
                            value={nutritionDraft[k]}
                            min={0}
                            max={255}
                            unit="ml"
                            accent="#22c55e"
                            variant="large"
                            framed={false}
                            busy={controlBusy}
                            onChange={(v) => setNutritionDraft((p) => ({ ...p, [k]: v }))}
                            onCommit={() => { void commitNutrition(); }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex" style={{ gap: 8, justifyContent: "center" }}>
                      <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => { void commitNutrition(); }}
                        disabled={controlBusy}
                        style={{ borderRadius: 12, border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.12)", color: "#15803d", padding: "8px 12px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}
                      >
                        Apply Dosing
                      </button>
                    </div>
                  </div>
                )}

                {controlPanelTab === "settings" && (
                  <div className="rounded-2xl" style={{ minHeight: "100%", padding: 12, border: "1px solid var(--border)", background: "linear-gradient(150deg, rgba(148,163,184,0.14), rgba(30,41,59,0.06))", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                      {[
                        { l: "Cooldown", v: cooldownLeftSec > 0 ? `${cooldownLeftSec}s` : "Ready" },
                        { l: "Sync State", v: controlBusy ? "Syncing" : "Idle" },
                        { l: "LED Avg", v: String(masterLedValue) },
                        { l: "Diagnostics", v: specificErrors.length > 0 ? `Attention (${specificErrors.length})` : "Optimal" },
                        { l: "WiFi SSID", v: d.wifiSsid },
                        { l: "Install Date", v: d.installationDate },
                      ].map((item) => (
                        <div key={item.l} className="rounded-xl" style={{ padding: "9px 10px", border: "1px solid var(--border)", background: "var(--mini-bg)" }}>
                          <p style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.l}</p>
                          <p style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 800, marginTop: 4, overflowWrap: "anywhere" }}>{item.v}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                      {[
                        { l: "CPU TEMP", v: `${d.cpuTemp}°C` },
                        { l: "CPU USAGE", v: `${d.cpuUsage}%` },
                        { l: "MEMORY", v: `${d.memUsage}%` },
                        { l: "DEVICE", v: d.activeTreeId },
                        { l: "LAST ONLINE", v: d.lastOnline },
                        { l: "LAST CHECK", v: d.lastCheck },
                      ].map((item) => (
                        <div key={item.l} className="rounded-xl" style={{ padding: "9px 10px", border: "1px solid var(--border)", background: "var(--mini-bg)", minWidth: 0 }}>
                          <p style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.l}</p>
                          <p style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 800, marginTop: 4, overflowWrap: "anywhere", lineHeight: 1.2 }}>{item.v}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2" style={{ gap: 8 }}>
                      {[
                        { l: "Battery", v: `${d.batteryPercentage}%`, color: "#4ade80" },
                        { l: "Charging", v: d.batteryCharging ? "Yes" : "No", color: "#38bdf8" },
                        { l: "Network", v: d.networkUp ? "Connected" : "Disconnected", color: d.networkUp ? "#4ade80" : "#f97316" },
                        { l: "Error Flag", v: d.error ? "True" : "False", color: d.error ? "#f97316" : "#a855f7" },
                      ].map((item) => (
                        <div key={item.l} className="rounded-xl flex items-center justify-between" style={{ padding: "8px 10px", background: "var(--mini-bg)", border: "1px solid var(--border)" }}>
                          <span style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 600 }}>{item.l}</span>
                          <div className="flex items-center" style={{ gap: 6 }}>
                            <span style={{ fontSize: 11, color: item.color, fontWeight: 700 }}>{item.v}</span>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl" style={{ padding: 10, border: "1px solid rgba(148,163,184,0.22)", background: "linear-gradient(150deg, rgba(2,132,199,0.08), rgba(2,6,23,0.1))" }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                        <p style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: "#38bdf8" }}>LDR Sensor Matrix</p>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)" }}>Live</span>
                      </div>
                      <div className="grid grid-cols-4" style={{ gap: 8 }}>
                        {([
                          { k: "LDR1", v: d.ldrStatus.LDR1 },
                          { k: "LDR2", v: d.ldrStatus.LDR2 },
                          { k: "LDR3", v: d.ldrStatus.LDR3 },
                          { k: "LDR4", v: d.ldrStatus.LDR4 },
                        ] as const).map((ldr) => (
                          <div key={ldr.k} className="rounded-xl" style={{ padding: "8px 8px", border: "1px solid rgba(148,163,184,0.22)", background: "rgba(15,23,42,0.12)", textAlign: "center" }}>
                            <p style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 700 }}>{ldr.k}</p>
                            <p style={{ fontSize: 11, fontWeight: 800, color: ldr.v ? "#22c55e" : "#94a3b8", letterSpacing: "0.04em" }}>{ldr.v ? "LIGHT" : "DARK"}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2" style={{ gap: 8 }}>
                      {[
                        { l: "Change Node", v: String(d.change) },
                        { l: "Display Pin", v: d.displayPin },
                      ].map((item) => (
                        <div key={item.l} className="rounded-xl" style={{ padding: "8px 10px", background: "var(--mini-bg)", border: "1px solid var(--border)" }}>
                          <p style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.l}</p>
                          <p style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 700, marginTop: 3, overflowWrap: "anywhere", lineHeight: 1.2 }}>{item.v}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-3" style={{ gap: 8 }}>
                      {[
                        { l: "Cycle Start", v: d.cycleStartDate },
                        { l: "Cycle End", v: d.cycleEndDate },
                        { l: "Days Remaining", v: `${d.cycleDaysRemaining} Days` },
                      ].map((item) => (
                        <div key={item.l} className="rounded-xl" style={{ padding: "8px 10px", background: "var(--mini-bg)", border: "1px solid var(--border)" }}>
                          <p style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.l}</p>
                          <p style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 700, marginTop: 3, lineHeight: 1.2 }}>{item.v}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex" style={{ gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => { void commitNutrition(); }}
                        disabled={controlBusy}
                        style={{ borderRadius: 12, border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.12)", color: "#15803d", padding: "8px 12px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}
                      >
                        Apply Dosing
                      </button>
                      <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => { void sendChangeCommand(9, 0, {}); }}
                        disabled={controlBusy}
                        style={{ borderRadius: 12, border: "1px solid rgba(59,130,246,0.4)", background: "rgba(59,130,246,0.12)", color: "#1d4ed8", padding: "8px 12px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}
                      >
                        Sensor Test
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </motion.div>
          </>
        )}

        {/* ── FOOTER (shared across all tabs) ── */}
        <motion.footer
          className="card flex items-center justify-between dash-footer"
          style={{
            gridColumn: "1 / -1",
            background: "var(--surface)",
          }}
          variants={rise}
        >
          {(activeTab === 0 ? [
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>, l: "Total CO2", v: `${d.co2} kg`, bg: "rgba(34,197,94,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>, l: "Total O2", v: `${d.o2} kg`, bg: "rgba(56,189,248,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67 0C8.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>, l: "TVOC", v: `${d.tvoc} ppb`, bg: "rgba(251,191,36,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>, l: "Last Online", v: d.lastOnline, bg: "rgba(168,85,247,0.12)" },
          ] : activeTab === 1 ? [
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#f97316" strokeWidth="2" strokeLinecap="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>, l: "Temp", v: `${d.temp}°C`, bg: "rgba(249,115,22,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>, l: "ECO2", v: `${d.eco2} ppm`, bg: "rgba(56,189,248,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>, l: "LTurbidity", v: `${d.lTurbidity} NTU`, bg: "rgba(251,191,36,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>, l: "UTurbidity", v: `${d.uTurbidity} NTU`, bg: "rgba(34,197,94,0.12)" },
          ] : activeTab === 2 ? [
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>, l: "Photosynthesis", v: `${d.photosynthRate} µmol/s`, bg: "rgba(168,85,247,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>, l: "Carbon Fixed", v: `${d.carbonFixRate} g/h`, bg: "rgba(34,197,94,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>, l: "O₂ Produced", v: `${d.oxygenProd} g/h`, bg: "rgba(56,189,248,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67 0C8.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>, l: "Energy", v: `${d.energyUsage}W`, bg: "rgba(251,191,36,0.12)" },
          ] : activeTab === 3 ? [
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>, l: "Cycle", v: selectedCycle ? `#${selectedCycle.key}` : "--", bg: "rgba(59,130,246,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/></svg>, l: "Biomass", v: `${selectedCycle?.biomass ?? 0} kg`, bg: "rgba(34,197,94,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#f97316" strokeWidth="2" strokeLinecap="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>, l: "CO2", v: `${selectedCycle?.co2Captured ?? 0} kg`, bg: "rgba(249,115,22,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/></svg>, l: "O2", v: `${selectedCycle?.o2Released ?? 0} kg`, bg: "rgba(56,189,248,0.12)" },
          ] : [
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#f97316" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg>, l: "CPU Temp", v: `${d.cpuTemp}°C`, bg: "rgba(249,115,22,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg>, l: "CPU Usage", v: `${d.cpuUsage}%`, bg: "rgba(56,189,248,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>, l: "Memory", v: `${d.memUsage}%`, bg: "rgba(168,85,247,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/></svg>, l: "Disk", v: `${d.diskUsage}%`, bg: "rgba(251,191,36,0.12)" },
          ]).map(s => (
            <div key={s.l} className="flex items-center dash-footer-stat" style={{ gap: 14 }}>
              <div
                className="rounded-full flex items-center justify-center dash-footer-icon"
                style={{ width: 42, height: 42, background: s.bg }}
              >{s.icon}</div>
              <div className="dash-footer-copy">
                <p className="font-semibold uppercase tracking-wider dash-footer-label" style={{ fontSize: 10, color: "var(--text-3)" }}>{s.l}</p>
                <p className="font-bold dash-footer-value" style={{ fontSize: 15, marginTop: 2 }}>{s.v}</p>
              </div>
            </div>
          ))}
        </motion.footer>
      </motion.main>
      </AnimatePresence>
    </div>
  );
}

export default function DashboardPage() {
  const password = process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD || "7500";
  return (
    <Suspense fallback={<div style={{ width: "100%", height: "100vh", background: "var(--bg)" }} />}>
      <DashboardPasswordGate correctPassword={password}>
        <Suspense fallback={null}>
          <DashboardPageContent />
        </Suspense>
      </DashboardPasswordGate>
    </Suspense>
  );
}
