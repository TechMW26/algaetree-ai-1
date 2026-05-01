"use client";

import { Suspense, useState, useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLiveData } from "../hooks/useLiveData";
import ThemeToggle from "../components/ThemeToggle";

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const rise = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

/* ── Animated Semicircle Gauge ── */
function SemiGauge({ value, min, max, label, unit, color, icon, delay = 0, tint }: {
  value: number; min: number; max: number; label: string; unit: string;
  color: string; icon: ReactNode; delay?: number; tint: string;
}) {
  const pct = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const valueText = String(value);
  const valueChars = valueText.length;
  const valueFontSize = Math.max(22, 58 - Math.max(0, valueChars - 4) * 6);
  const valueTextLength = valueChars >= 9 ? 144 : valueChars >= 8 ? 152 : valueChars >= 7 ? 160 : undefined;
  const r = 90;
  const circumHalf = Math.PI * r;
  const dashLen = pct * circumHalf;
  const trackColor = "var(--track-strong)";

  return (
    <motion.div
      className="card flex flex-col items-center justify-center"
      style={{
        padding: "12px 8px 14px",
        flex: 1,
        background: `linear-gradient(145deg, ${tint}, var(--surface))`,
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
          <motion.path
            d="M 12 120 A 90 90 0 0 1 208 120"
            fill="none"
            stroke={color}
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={`${circumHalf}`}
            initial={{ strokeDashoffset: circumHalf }}
            animate={{ strokeDashoffset: circumHalf - dashLen }}
            transition={{ duration: 1.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
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
function BarChart({ bars, delay = 0 }: {
  bars: { label: string; value: number; max: number; color: string }[];
  delay?: number;
}) {
  return (
    <div className="flex items-end justify-center" style={{ gap: 14, height: 130, width: "100%" }}>
      {bars.map((b, i) => {
        const pct = Math.min(b.value / b.max, 1);
        return (
          <div key={b.label} className="flex flex-col items-center" style={{ gap: 6, flex: 1 }}>
            <div
              style={{
                width: "100%", maxWidth: 36, height: 110, borderRadius: 10,
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
  return (
    <div className="bar-track" style={{ marginTop: 12 }}>
      <motion.div
        style={{
          height: "100%", borderRadius: 99,
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          boxShadow: `0 0 12px ${color}40`,
        }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 1.2, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
    </div>
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
        border: `1px solid ${enabled ? "rgba(34,197,94,0.5)" : "var(--border)"}`,
        background: enabled
          ? "linear-gradient(140deg, rgba(34,197,94,0.14), rgba(34,197,94,0.04))"
          : "linear-gradient(140deg, var(--surface), var(--mini-bg))",
        borderRadius: 14,
        padding: "11px 12px",
        opacity: busy ? 0.7 : 1,
        boxShadow: enabled ? "0 6px 20px rgba(34,197,94,0.12)" : "none",
        transition: "all .2s ease",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>{label}</span>
      <span
        style={{
          width: 34,
          height: 20,
          borderRadius: 999,
          background: enabled ? "linear-gradient(135deg, #16a34a, #22c55e)" : "var(--track)",
          position: "relative",
          transition: "all .2s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: enabled ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transition: "all .2s ease",
          }}
        />
      </span>
    </button>
  );
}

function IntensitySlider({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit: () => void;
}) {
  return (
    <div className="rounded-xl" style={{ padding: "10px 12px", background: "linear-gradient(145deg, var(--mini-bg), var(--surface))", border: "1px solid var(--border)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>{label}</span>
        <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={255}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        style={{ width: "100%", accentColor: "#22c55e" }}
      />
    </div>
  );
}

function DashboardPageContent() {
  const searchParams = useSearchParams();
  const selectedPod = searchParams.get("pod");
  const selectedTreeId = selectedPod === "2" ? "AT00A0002" : "AT00A0001";
  const d = useLiveData(selectedTreeId);
  const router = useRouter();
  const [time, setTime] = useState("");
  const [navigating, setNavigating] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const controlBusy = pendingSyncCount > 0;
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

  useEffect(() => {
    setLedDraft(d.ledIntensity);
  }, [d.ledIntensity.LED1, d.ledIntensity.LED2, d.ledIntensity.LED3, d.ledIntensity.LED4]);

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
    setUiAirBubblesTiming(d.airBubblesTiming);
  }, [d.airBubblesTiming.on, d.airBubblesTiming.off]);

  useEffect(() => {
    setNutritionDraft(d.nutritionDosing);
  }, [
    d.nutritionDosing.Motor1Volume,
    d.nutritionDosing.Motor2Volume,
    d.nutritionDosing.Motor3Volume,
    d.nutritionDosing.Motor4Volume,
    d.nutritionDosing.Motor5Volume,
  ]);

  const patchDevice = async (updates: Record<string, unknown>) => {
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

  const toggleOperation = async (key: keyof typeof d.operations) => {
    const nextOps = {
      ...uiOperations,
      [key]: !uiOperations[key],
    };
    setUiOperations(nextOps);
    await patchDevice({
      Operations: nextOps,
    });
  };

  const commitIntensity = async () => {
    await patchDevice({ Intensity: ledDraft });
  };

  const commitNutrition = async () => {
    await patchDevice({ NutritionDosing: nutritionDraft });
  };

  const setBubblesTiming = async (key: "on" | "off", value: number) => {
    const next = {
      on: key === "on" ? value : uiAirBubblesTiming.on,
      off: key === "off" ? value : uiAirBubblesTiming.off,
    };
    setUiAirBubblesTiming(next);
    await patchDevice({
      Operations: {
        ...uiOperations,
        AirBubblesTiming: {
          On: next.on,
          Off: next.off,
        },
      },
    });
  };

  const tabLabels = ["Bio-Reactor", "Environment", "Performance", "System"] as const;
  const tabIcons = [
    <svg key="t0" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 2v7.53a2 2 0 0 1-.21.9L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45L14.21 10.43A2 2 0 0 1 14 9.53V2"/><path d="M8.5 2h7"/></svg>,
    <svg key="t1" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><circle cx="12" cy="12" r="10"/></svg>,
    <svg key="t2" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    <svg key="t3" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/></svg>,
  ];

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg)" }}>
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
            backdropFilter: "blur(20px)",
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
          <span className="font-semibold tabular-nums dash-time" style={{ fontSize: 15, color: "var(--text-3)" }}>{time}</span>
          <ThemeToggle />
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
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
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
      <motion.main
        className="relative z-10 flex-1 grid overflow-hidden dash-grid"
        style={{
          padding: "20px 24px",
          gap: 18,
          gridTemplateColumns: activeTab === 0 ? "1.1fr 1fr 1fr" : "1fr 1fr 1fr",
          gridTemplateRows: activeTab === 0 ? "1fr 1fr auto" : "1fr 1fr auto",
        }}
        variants={stagger}
        initial="hidden"
        animate="show"
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
                background: "linear-gradient(160deg, rgba(34,197,94,0.06) 0%, var(--surface) 40%, rgba(34,197,94,0.03) 100%)",
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
                  <span className="font-bold" style={{ fontSize: 18 }}>Bio-Reactor Core</span>
                </div>
                <Badge label="Optimal" />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center dash-tree-section" style={{ position: "relative", overflow: "hidden" }}>
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
                    src="/Ai Main_00.png"
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
              <motion.button onClick={() => { setNavigating(true); router.push(`/talk?tree=${d.activeTreeId}`); }} disabled={navigating} className="glow-btn flex items-center justify-center cursor-pointer dash-desktop-cta" style={{ gap: 10, marginTop: 20, padding: "16px 0", borderRadius: 16, background: navigating ? "linear-gradient(135deg, #15803d, #16a34a)" : "linear-gradient(135deg, #16a34a, #22c55e)", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", boxShadow: "0 8px 30px rgba(34,197,94,0.3)", opacity: navigating ? 0.85 : 1 }} whileHover={navigating ? {} : { scale: 1.02 }} whileTap={navigating ? {} : { scale: 0.97 }}>
                {navigating ? (<><svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg><span>Loading…</span></>) : (<><svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg><span>Talk to the Tree</span><span className="pulse-dot rounded-full" style={{ width: 8, height: 8, background: "#fff" }} /></>)}
              </motion.button>
              <div className="grid grid-cols-3" style={{ gap: 10, marginTop: 16 }}>
                {[{ l: "DEVICE", v: d.activeTreeId }, { l: "BATTERY", v: `${d.batteryPercentage}%` }, { l: "LAST CHECK", v: d.lastCheck }].map(s => (
                  <div key={s.l} className="rounded-xl" style={{ padding: "14px 16px", background: "var(--mini-bg)" }}>
                    <p className="font-semibold uppercase tracking-wider" style={{ fontSize: 9, color: "var(--text-3)" }}>{s.l}</p>
                    <p className="font-bold" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.2, overflowWrap: "anywhere" }}>{s.v}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><path d="M10 2v7.53a2 2 0 0 1-.21.9L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45L14.21 10.43A2 2 0 0 1 14 9.53V2"/><path d="M8.5 2h7"/></svg>} label="pH Level" value={d.ph} unit="pH" min={0} max={14} color="#4ade80" delay={0.2} tint="rgba(34,197,94,0.04)" />
            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>} label="TDS" value={d.tds} unit="ppm" min={0} max={1200} color="#38bdf8" delay={0.3} tint="rgba(56,189,248,0.04)" />
            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#f97316" strokeWidth="2" strokeLinecap="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>} label="Temperature" value={d.temp} unit="°C" min={0} max={50} color="#f97316" delay={0.4} tint="rgba(249,115,22,0.04)" />

            {/* Efficiency gauge (mobile only) */}
            <div className="dash-mobile-efficiency" style={{ display: "none" }}>
              <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} label="Efficiency" value={d.efficiency} unit="%" min={0} max={100} color="#4ade80" delay={0.35} tint="rgba(34,197,94,0.04)" />
            </div>

            {/* Biomass + Growth */}
            <motion.div className="card flex flex-col dash-mobile-biomass" style={{ padding: 28, background: "linear-gradient(150deg, rgba(34,197,94,0.05) 0%, var(--surface) 50%, rgba(34,197,94,0.02) 100%)", ['--card-tint' as React.CSSProperties & string]: 'rgba(34,197,94,0.12)' } as React.CSSProperties} variants={rise}>
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
                }))} />
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
                background: "linear-gradient(160deg, rgba(56,189,248,0.06) 0%, var(--surface) 40%, rgba(56,189,248,0.03) 100%)",
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
                    src="/env-card-klev.png"
                    alt="Environment module"
                    fill
                    className="object-contain"
                    style={{
                      filter: "drop-shadow(0 24px 48px rgba(56,189,248,0.18))",
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
                  <motion.p className="font-black text-sky-400 leading-none" style={{ fontSize: "4.5rem", filter: "drop-shadow(0 0 40px rgba(56,189,248,0.3))" }} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>{d.airQuality}</motion.p>
                  <p className="font-bold uppercase tracking-[0.3em]" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>AQI (Index)</p>
                </div>
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

            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#f97316" strokeWidth="2" strokeLinecap="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>} label="Temperature" value={+d.temp} unit="°C" min={0} max={60} color="#f97316" delay={0.2} tint="rgba(249,115,22,0.04)" />
            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>} label="Lower Turbidity" value={+d.lTurbidity} unit="NTU" min={0} max={3000} color="#38bdf8" delay={0.3} tint="rgba(56,189,248,0.04)" />
            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>} label="Upper Turbidity" value={+d.uTurbidity} unit="NTU" min={0} max={3000} color="#fbbf24" delay={0.4} tint="rgba(251,191,36,0.04)" />

            {/* CO₂ & Atmospheric card */}
            <motion.div className="card flex flex-col" style={{ padding: 28, background: "linear-gradient(150deg, rgba(56,189,248,0.05) 0%, var(--surface) 50%, rgba(56,189,248,0.02) 100%)", ['--card-tint' as React.CSSProperties & string]: 'rgba(56,189,248,0.12)' } as React.CSSProperties} variants={rise}>
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
                background: "linear-gradient(160deg, rgba(168,85,247,0.06) 0%, var(--surface) 40%, rgba(168,85,247,0.03) 100%)",
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

            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} label="Photosynthesis Rate" value={+d.photosynthRate} unit="µmol/s" min={0} max={30} color="#a855f7" delay={0.2} tint="rgba(168,85,247,0.04)" />
            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>} label="Carbon Fixation" value={+d.carbonFixRate} unit="g/h" min={0} max={10} color="#4ade80" delay={0.3} tint="rgba(34,197,94,0.04)" />
            <SemiGauge icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67 0C8.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>} label="Energy Usage" value={d.energyUsage} unit="W" min={0} max={300} color="#fbbf24" delay={0.4} tint="rgba(251,191,36,0.04)" />

            {/* Weekly Biomass Output chart */}
            <motion.div className="card flex flex-col" style={{ padding: 28, background: "linear-gradient(150deg, rgba(168,85,247,0.05) 0%, var(--surface) 50%, rgba(168,85,247,0.02) 100%)", ['--card-tint' as React.CSSProperties & string]: 'rgba(168,85,247,0.12)' } as React.CSSProperties} variants={rise}>
              <div className="flex items-center" style={{ gap: 8, marginBottom: 12 }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                <span className="font-semibold" style={{ fontSize: 15, color: "var(--text-2)" }}>Weekly Biomass Output</span>
              </div>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <div>
                  <motion.span className="font-extrabold" style={{ fontSize: 38 }} key={String(d.weeklyBiomass[6])} initial={{ opacity: 0.6, y: 3 }} animate={{ opacity: 1, y: 0 }}>{d.weeklyBiomass[6]}</motion.span>
                  <span style={{ fontSize: 13, color: "var(--text-3)", marginLeft: 4 }}>g/L today</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-purple-400" style={{ fontSize: 18 }}>+12%</p>
                  <p style={{ fontSize: 10, color: "var(--text-3)" }}>vs last week</p>
                </div>
              </div>
              <AnimBar pct={(d.weeklyBiomass[6] / 5) * 100} color="#a855f7" delay={0.4} />
              <div style={{ marginTop: 22, flex: 1, display: "flex", alignItems: "flex-end" }}>
                <BarChart delay={0.5} bars={d.weeklyBiomass.map((v, i) => ({
                  label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
                  value: v, max: 5,
                  color: i === 6 ? "#7c3aed" : "#a855f7",
                }))} />
              </div>
            </motion.div>
          </>
        )}

        {/* ═══════════ TAB 3 — SYSTEM ═══════════ */}
        {activeTab === 3 && (
          <>
            {/* Hero: System Status */}
            <motion.div
              className="card flex flex-col dash-hero"
              style={{
                padding: 32, gridRow: "1 / 3",
                background: "linear-gradient(160deg, rgba(251,191,36,0.06) 0%, var(--surface) 40%, rgba(251,191,36,0.03) 100%)",
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
              <div className="flex-1 flex flex-col items-center justify-center" style={{ gap: 12 }}>
                <motion.p className="font-black text-amber-400 leading-none" style={{ fontSize: "4.5rem", filter: "drop-shadow(0 0 40px rgba(251,191,36,0.3))" }} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>{d.sensorHealth}%</motion.p>
                <p className="font-bold uppercase tracking-[0.3em]" style={{ fontSize: 11, color: "var(--text-3)" }}>Sensor Health</p>
              </div>

              <div className="grid grid-cols-3" style={{ gap: 10, marginTop: 8 }}>
                {[
                  { l: "CPU TEMP", v: `${d.cpuTemp}°C` },
                  { l: "CPU USAGE", v: `${d.cpuUsage}%` },
                  { l: "MEMORY", v: `${d.memUsage}%` },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl" style={{ padding: "12px 12px", background: "var(--mini-bg)", border: "1px solid var(--border)" }}>
                    <p className="font-semibold uppercase tracking-wider" style={{ fontSize: 9, color: "var(--text-3)" }}>{s.l}</p>
                    <p className="font-bold" style={{ fontSize: 14, marginTop: 4 }}>{s.v}</p>
                  </div>
                ))}
              </div>

              {/* System mini stats */}
              <div className="grid grid-cols-3" style={{ gap: 10, marginTop: 16 }}>
                {[{ l: "DEVICE", v: d.activeTreeId }, { l: "LAST ONLINE", v: d.lastOnline }, { l: "LAST CHECK", v: d.lastCheck }].map(s => (
                  <div key={s.l} className="rounded-xl" style={{ padding: "14px 16px", background: "var(--mini-bg)" }}>
                    <p className="font-semibold uppercase tracking-wider" style={{ fontSize: 9, color: "var(--text-3)" }}>{s.l}</p>
                    <p className="font-bold" style={{ fontSize: 14, marginTop: 4 }}>{s.v}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2" style={{ gap: 10, marginTop: 12 }}>
                {[
                  { l: "Battery", v: `${d.batteryPercentage}%`, color: "#4ade80" },
                  { l: "Charging", v: d.batteryCharging ? "Yes" : "No", color: "#38bdf8" },
                  { l: "Network", v: d.networkUp ? "Connected" : "Disconnected", color: d.networkUp ? "#4ade80" : "#f97316" },
                  { l: "Error Flag", v: d.error ? "True" : "False", color: d.error ? "#f97316" : "#a855f7" },
                ].map((item) => (
                  <div key={item.l} className="rounded-xl flex items-center justify-between" style={{ padding: "10px 12px", background: "var(--mini-bg)", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>{item.l}</span>
                    <div className="flex items-center" style={{ gap: 6 }}>
                      <span style={{ fontSize: 12, color: item.color, fontWeight: 700 }}>{item.v}</span>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Device Control (single large card) */}
            <motion.div
              className="card flex flex-col"
              style={{
                padding: 28,
                gridColumn: "2 / 4",
                gridRow: "1 / 3",
                position: "relative",
                background: "linear-gradient(145deg, rgba(14,165,233,0.06), var(--surface), rgba(34,197,94,0.05))",
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

              <div className="flex items-center justify-between" style={{ gap: 8, marginBottom: 16 }}>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  <span className="font-semibold" style={{ fontSize: 16, color: "var(--text-2)" }}>Device Control Center</span>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>{controlBusy ? "SYNCING..." : "LIVE"}</span>
              </div>

              <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
                <ToggleChip label="Air Bubbles" enabled={uiOperations.AirBubbles} busy={controlBusy} onToggle={() => { void toggleOperation("AirBubbles"); }} />
                <ToggleChip label="Fan" enabled={uiOperations.Fan} busy={controlBusy} onToggle={() => { void toggleOperation("Fan"); }} />
                <ToggleChip label="Drain" enabled={uiOperations.Drain} busy={controlBusy} onToggle={() => { void toggleOperation("Drain"); }} />
                <ToggleChip label="Filling" enabled={uiOperations.Filling} busy={controlBusy} onToggle={() => { void toggleOperation("Filling"); }} />
                <ToggleChip label="Solar Cleaning" enabled={uiOperations.SolarCleaning} busy={controlBusy} onToggle={() => { void toggleOperation("SolarCleaning"); }} />
                <ToggleChip
                  label="LED Auto Ops"
                  enabled={uiOperations.LED1 || uiOperations.LED2 || uiOperations.LED3 || uiOperations.LED4}
                  busy={controlBusy}
                  onToggle={() => {
                    const next = !(uiOperations.LED1 || uiOperations.LED2 || uiOperations.LED3 || uiOperations.LED4);
                    const nextOps = {
                      ...uiOperations,
                      LED1: next,
                      LED2: next,
                      LED3: next,
                      LED4: next,
                    };
                    setUiOperations(nextOps);
                    void patchDevice({
                      Operations: nextOps,
                    });
                  }}
                />
              </div>

              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", marginBottom: 8 }}>LED Intensity Control</p>
              <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
                <IntensitySlider label="LED1" value={ledDraft.LED1} onChange={(v) => setLedDraft((p) => ({ ...p, LED1: v }))} onCommit={() => { void commitIntensity(); }} />
                <IntensitySlider label="LED2" value={ledDraft.LED2} onChange={(v) => setLedDraft((p) => ({ ...p, LED2: v }))} onCommit={() => { void commitIntensity(); }} />
                <IntensitySlider label="LED3" value={ledDraft.LED3} onChange={(v) => setLedDraft((p) => ({ ...p, LED3: v }))} onCommit={() => { void commitIntensity(); }} />
                <IntensitySlider label="LED4" value={ledDraft.LED4} onChange={(v) => setLedDraft((p) => ({ ...p, LED4: v }))} onCommit={() => { void commitIntensity(); }} />
              </div>

              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", marginBottom: 8 }}>Air Bubble Cycle Timing</p>
              <div className="grid grid-cols-2" style={{ gap: 10, marginBottom: 14 }}>
                <div className="rounded-xl" style={{ padding: "10px 12px", background: "var(--mini-bg)", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}>Bubbles ON (sec)</p>
                  <input type="range" min={1} max={120} value={uiAirBubblesTiming.on} onChange={(e) => { void setBubblesTiming("on", Number(e.target.value)); }} style={{ width: "100%", accentColor: "#22c55e" }} />
                  <p style={{ fontSize: 11, color: "var(--text-3)" }}>{uiAirBubblesTiming.on}s</p>
                </div>
                <div className="rounded-xl" style={{ padding: "10px 12px", background: "var(--mini-bg)", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}>Bubbles OFF (sec)</p>
                  <input type="range" min={1} max={120} value={uiAirBubblesTiming.off} onChange={(e) => { void setBubblesTiming("off", Number(e.target.value)); }} style={{ width: "100%", accentColor: "#22c55e" }} />
                  <p style={{ fontSize: 11, color: "var(--text-3)" }}>{uiAirBubblesTiming.off}s</p>
                </div>
              </div>

              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", marginBottom: 8 }}>Nutrition Dosing (Motor Volumes)</p>
              <div className="grid" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8, marginBottom: 14 }}>
                {([
                  "Motor1Volume",
                  "Motor2Volume",
                  "Motor3Volume",
                  "Motor4Volume",
                  "Motor5Volume",
                ] as const).map((k) => (
                  <IntensitySlider
                    key={k}
                    label={k.replace("Volume", "")}
                    value={nutritionDraft[k]}
                    onChange={(v) => setNutritionDraft((p) => ({ ...p, [k]: v }))}
                    onCommit={() => { void commitNutrition(); }}
                  />
                ))}
              </div>

              <div className="grid grid-cols-4" style={{ gap: 8 }}>
                {([
                  { k: "LDR1", v: d.ldrStatus.LDR1 },
                  { k: "LDR2", v: d.ldrStatus.LDR2 },
                  { k: "LDR3", v: d.ldrStatus.LDR3 },
                  { k: "LDR4", v: d.ldrStatus.LDR4 },
                ] as const).map((ldr) => (
                  <div key={ldr.k} className="rounded-xl" style={{ padding: "8px 10px", background: "var(--mini-bg)", border: "1px solid var(--border)", textAlign: "center" }}>
                    <p style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>{ldr.k}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: ldr.v ? "#22c55e" : "#94a3b8" }}>{ldr.v ? "LIGHT" : "DARK"}</p>
                  </div>
                ))}
              </div>

            </motion.div>
          </>
        )}

        {/* ── FOOTER (shared across all tabs) ── */}
        <motion.footer
          className="card flex items-center justify-between dash-footer"
          style={{
            padding: "22px 36px", gridColumn: "1 / -1",
            background: "linear-gradient(135deg, rgba(34,197,94,0.03), var(--surface), rgba(56,189,248,0.03))",
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
          ] : [
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#f97316" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg>, l: "CPU Temp", v: `${d.cpuTemp}°C`, bg: "rgba(249,115,22,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg>, l: "CPU Usage", v: `${d.cpuUsage}%`, bg: "rgba(56,189,248,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>, l: "Memory", v: `${d.memUsage}%`, bg: "rgba(168,85,247,0.12)" },
            { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/></svg>, l: "Disk", v: `${d.diskUsage}%`, bg: "rgba(251,191,36,0.12)" },
          ]).map(s => (
            <div key={s.l} className="flex items-center" style={{ gap: 14 }}>
              <div
                className="rounded-full flex items-center justify-center"
                style={{ width: 42, height: 42, background: s.bg }}
              >{s.icon}</div>
              <div>
                <p className="font-semibold uppercase tracking-wider" style={{ fontSize: 10, color: "var(--text-3)" }}>{s.l}</p>
                <p className="font-bold" style={{ fontSize: 15, marginTop: 2 }}>{s.v}</p>
              </div>
            </div>
          ))}
        </motion.footer>
      </motion.main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageContent />
    </Suspense>
  );
}
