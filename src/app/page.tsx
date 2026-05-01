"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import ThemeToggle from "./components/ThemeToggle";

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
  const router = useRouter();

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

        <div style={{ pointerEvents: "auto" }}>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
