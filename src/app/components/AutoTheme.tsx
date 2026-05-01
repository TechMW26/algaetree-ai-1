"use client";

import { useEffect } from "react";

function getISTAutoTheme(): "light" | "dark" {
  // IST = UTC+5:30 = 330 minutes ahead
  const nowMs = Date.now() + (330 + new Date().getTimezoneOffset()) * 60_000;
  const h = new Date(nowMs).getHours();
  // Light theme: 6 AM - 6 PM (06:00-17:59), Dark theme: 6 PM - 6 AM (18:00-05:59)
  return h >= 6 && h < 18 ? "light" : "dark";
}

export default function AutoTheme() {
  useEffect(() => {
    const enforceTheme = () => {
      const auto = getISTAutoTheme();
      // Always apply the current time-based theme, no override
      document.documentElement.setAttribute("data-theme", auto);
      try {
        localStorage.setItem("themeAuto", auto);
      } catch {}
    };

    enforceTheme();
    // Check every minute for time boundary crossing
    const id = setInterval(enforceTheme, 60_000);
    return () => clearInterval(id);
  }, []);

  return null;
}
