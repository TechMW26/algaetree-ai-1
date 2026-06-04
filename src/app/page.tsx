"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "./components/ThemeToggle";
import TreeGrid from "./components/TreeGrid";
import { AuthGuard, useAuth } from "./components/AuthGuard";

const NetworkMap = dynamic(() => import("./components/NetworkMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-2)",
        fontSize: 14,
        background: "var(--bg)",
      }}
    >
      Loading network map…
    </div>
  ),
});

export default function NetworkPage() {
  return (
    <AuthGuard>
      <NetworkPageContent />
    </AuthGuard>
  );
}

function NetworkPageContent() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const canManage = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const managePath = user?.role === "SUPER_ADMIN" ? "/super-admin" : "/admin";
  const [view, setView] = useState<"map" | "grid">("map");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        overflow: view === "grid" ? "auto" : "hidden",
      }}
    >
      {view === "map" ? <NetworkMap /> : <TreeGrid />}

      {/* Header overlay */}
      <div
        style={{
          position: "fixed",
          top: 24,
          left: 24,
          right: 24,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pointerEvents: "none",
        }}
      >
        <button
          onClick={() => router.push("/dashboard")}
          className="cursor-pointer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--surface)",
            padding: "10px 18px",
            borderRadius: 24,
            border: "1px solid var(--border)",
            pointerEvents: "auto",
            color: "var(--text-1)",
          }}
          aria-label="AlgaeTree Network"
        >
          <Image src="/favicon.png" alt="" width={24} height={24} style={{ borderRadius: 6 }} />
          <span
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "var(--text-1)",
              letterSpacing: "0.01em",
            }}
          >
            AlgaeTree Network
          </span>
        </button>

        <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {canManage && (
            <button
              onClick={() => router.push(managePath)}
              className="cursor-pointer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--surface)",
                padding: "10px 16px",
                borderRadius: 24,
                border: "1px solid var(--border)",
                color: "var(--text-1)",
                fontSize: 14,
                fontWeight: 600,
              }}
              aria-label="Open management console"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7h18M3 12h18M3 17h18" />
              </svg>
              Manage
            </button>
          )}
          <div
            style={{
              display: "flex",
              gap: 4,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: 4,
            }}
          >
            <button
              onClick={() => setView("map")}
              className="cursor-pointer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                border: "none",
                borderRadius: 999,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: view === "map" ? "linear-gradient(135deg,#22c55e,#16a34a)" : "transparent",
                color: view === "map" ? "#04140a" : "var(--text-1)",
              }}
              aria-pressed={view === "map"}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
                <path d="M9 4v14M15 6v14" />
              </svg>
              Map
            </button>
            <button
              onClick={() => setView("grid")}
              className="cursor-pointer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                border: "none",
                borderRadius: 999,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: view === "grid" ? "linear-gradient(135deg,#22c55e,#16a34a)" : "transparent",
                color: view === "grid" ? "#04140a" : "var(--text-1)",
              }}
              aria-pressed={view === "grid"}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              Grid
            </button>
          </div>
          <button
            onClick={() => void logout()}
            className="cursor-pointer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--surface)",
              padding: "10px 16px",
              borderRadius: 24,
              border: "1px solid var(--border)",
              color: "var(--text-1)",
              fontSize: 14,
              fontWeight: 600,
            }}
            aria-label="Sign out"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            Sign out
          </button>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
