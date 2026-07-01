"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const [view, setView] = useState<"map" | "grid">("grid");

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
          top: 28,
          left: "clamp(20px, 3vw, 48px)",
          right: "clamp(20px, 3vw, 48px)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
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
            padding: "12px 20px",
            borderRadius: 28,
            border: "1px solid var(--border)",
            pointerEvents: "auto",
            color: "var(--text-1)",
            minHeight: 56,
          }}
          aria-label="AlgaeTree Network"
        >
          <Image src="/favicon.png" alt="" width={34} height={34} style={{ borderRadius: 8 }} />
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

        <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {canManage && (
            <button
              onClick={() => router.push(managePath)}
              className="cursor-pointer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--surface)",
                padding: "11px 17px",
                borderRadius: 999,
                border: "1px solid var(--border)",
                color: "var(--text-1)",
                fontSize: 14,
                fontWeight: 600,
                minHeight: 46,
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
              minHeight: 48,
            }}
          >
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
          </div>
          <button
            onClick={() => void logout()}
            className="cursor-pointer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--surface)",
              padding: "11px 17px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              color: "var(--text-1)",
              fontSize: 14,
              fontWeight: 600,
              minHeight: 46,
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
        </div>
      </div>
    </div>
  );
}
