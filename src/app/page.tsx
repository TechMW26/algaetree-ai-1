"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import ThemeToggle from "./components/ThemeToggle";
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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      <NetworkMap />

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
