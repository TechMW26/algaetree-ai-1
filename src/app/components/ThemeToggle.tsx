"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return (document.documentElement.getAttribute("data-theme") as Theme) || "light";
}

function getISTAutoTheme(): "light" | "dark" {
  const nowMs = Date.now() + (330 + new Date().getTimezoneOffset()) * 60_000;
  const h = new Date(nowMs).getHours();
  return h >= 6 && h < 18 ? "light" : "dark";
}

export default function ThemeToggle({ size = 36 }: { size?: number }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(readTheme());
  }, []);

  const toggle = () => {
    // Re-apply auto theme instead of toggling
    const auto = getISTAutoTheme();
    setTheme(auto);
    document.documentElement.setAttribute("data-theme", auto);
  };

  const isLight = theme === "light";

  return (
    <button
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className="cursor-pointer flex items-center justify-center rounded-full transition-colors"
      style={{
        width: size,
        height: size,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        color: "var(--text-2)",
        flexShrink: 0,
      }}
    >
      {isLight ? (
        // moon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // sun
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
    </button>
  );
}
