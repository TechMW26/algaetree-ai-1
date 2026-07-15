"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PublicTreePinGate({
  treeId,
  accessKey,
}: {
  treeId: string;
  accessKey: string;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const dashboardPath = `/dashboard?tree=${encodeURIComponent(treeId)}&share=${encodeURIComponent(accessKey)}`;
  const accessApi = `/api/public-tree/${encodeURIComponent(treeId)}/${encodeURIComponent(accessKey)}`;

  useEffect(() => {
    let active = true;
    void fetch(accessApi, { cache: "no-store" }).then((res) => {
      if (!active) return;
      if (res.ok) {
        router.replace(dashboardPath);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [accessApi, dashboardPath, router]);

  const verifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(accessApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "PIN verification failed");
        return;
      }
      router.replace(dashboardPath);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={s.page}>
      <form onSubmit={verifyPin} style={s.card}>
        <Image src="/favicon.png" alt="AlgaeTree" width={54} height={54} style={{ borderRadius: 14 }} priority />
        <div style={{ textAlign: "center" }}>
          <h1 style={s.title}>Open AlgaeTree Dashboard</h1>
          <p style={s.subtitle}>{treeId}</p>
        </div>
        <label htmlFor="tree-pin" style={s.label}>Dashboard PIN</label>
        <input
          id="tree-pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={12}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="Enter PIN"
          autoComplete="one-time-code"
          autoFocus
          required
          style={s.input}
        />
        {error && <div role="alert" style={s.error}>{error}</div>}
        <button type="submit" disabled={loading || !pin} style={s.button}>
          {loading ? "Verifying…" : "Open dashboard"}
        </button>
        <p style={s.note}>Use the PIN configured on this AlgaeTree.</p>
      </form>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background: "radial-gradient(900px 500px at 50% 0%, rgba(34,197,94,0.14), transparent 65%), var(--bg)",
  },
  card: {
    width: "100%",
    maxWidth: 390,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    padding: "34px 30px",
    border: "1px solid var(--border)",
    borderRadius: 24,
    background: "var(--surface)",
    boxShadow: "0 30px 70px -30px rgba(0,0,0,0.45)",
  },
  title: { margin: 0, fontSize: 23, fontWeight: 900, color: "var(--text-1)" },
  subtitle: { margin: "6px 0 0", color: "#16a34a", fontSize: 13, fontWeight: 800 },
  label: { width: "100%", marginTop: 8, color: "var(--text-2)", fontSize: 12, fontWeight: 700 },
  input: {
    width: "100%",
    padding: "14px 16px",
    border: "1px solid var(--border)",
    borderRadius: 13,
    outline: "none",
    background: "var(--surface-hover)",
    color: "var(--text-1)",
    textAlign: "center",
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 8,
  },
  error: { width: "100%", padding: "9px 12px", borderRadius: 10, background: "rgba(239,68,68,0.12)", color: "#dc2626", fontSize: 13 },
  button: { width: "100%", marginTop: 4, padding: "13px 16px", border: 0, borderRadius: 13, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#04140a", fontSize: 14, fontWeight: 800, cursor: "pointer" },
  note: { margin: "2px 0 0", color: "var(--text-3)", fontSize: 11.5 },
};
