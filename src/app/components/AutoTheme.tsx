"use client";

import { useEffect } from "react";

function getISTAutoTheme(): "light" | "dark" {
  // IST = UTC+5:30
  const nowMs = Date.now() + (330 + new Date().getTimezoneOffset()) * 60_000;
  const h = new Date(nowMs).getHours();
  return h >= 18 || h < 5 ? "dark" : "light";
}

export default function AutoTheme() {
  useEffect(() => {
    const tick = () => {
      const auto = getISTAutoTheme();
      let lastAuto: string | null = null;
      try {
        lastAuto = localStorage.getItem("themeAuto");
      } catch {}

      // Boundary crossed → reset theme to the new auto value, clearing any manual override.
      if (lastAuto !== auto) {
        document.documentElement.setAttribute("data-theme", auto);
        try {
          localStorage.setItem("themeAuto", auto);
          localStorage.setItem("theme", auto);
        } catch {}
      }
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return null;
}
