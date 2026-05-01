"use client";

import { useEffect, useState } from "react";

const MIN_DISPLAY_MS = 2500;
const FADE_DURATION_MS = 600;

export default function SplashScreen() {
  const [mounted, setMounted] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("splashShown") === "1") {
      setMounted(false);
      return;
    }

    let fadeTimer: ReturnType<typeof setTimeout>;
    let removeTimer: ReturnType<typeof setTimeout>;

    const start = performance.now();

    const finish = () => {
      const elapsed = performance.now() - start;
      const wait = Math.max(0, MIN_DISPLAY_MS - elapsed);
      fadeTimer = setTimeout(() => {
        setFading(true);
        removeTimer = setTimeout(() => {
          setMounted(false);
          sessionStorage.setItem("splashShown", "1");
        }, FADE_DURATION_MS);
      }, wait);
    };

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish, { once: true });
    }

    return () => {
      window.removeEventListener("load", finish);
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5em",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_DURATION_MS}ms ease`,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <style>{`
        @keyframes splashLabelIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashLogoIn {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
      <span
        style={{
          fontFamily:
            "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: "clamp(11px, 1.6vw, 14px)",
          letterSpacing: "0.05em",
          color: "#6b7280",
          fontWeight: 400,
          userSelect: "none",
          opacity: 0,
          animation: "splashLabelIn 700ms cubic-bezier(0.22, 1, 0.36, 1) 100ms forwards",
        }}
      >
        Powered by
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/MWFuturetech.svg"
        alt="MW Future Tech"
        style={{
          width: "min(60vw, 360px)",
          height: "auto",
          userSelect: "none",
          opacity: 0,
          animation: "splashLogoIn 1000ms cubic-bezier(0.22, 1, 0.36, 1) 800ms forwards",
          display: "block",
          margin: "0 auto",
        }}
        draggable={false}
      />
    </div>
  );
}
