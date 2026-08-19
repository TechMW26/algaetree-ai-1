"use client";

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

  const appendDigit = (digit: string) => {
    setError("");
    setPin((current) => current.length < 12 ? `${current}${digit}` : current);
  };

  const removeDigit = () => {
    setError("");
    setPin((current) => current.slice(0, -1));
  };

  const clearPin = () => {
    setError("");
    setPin("");
  };

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
    <main className="public-pin-page" style={s.page}>
      <form className="public-pin-card" onSubmit={verifyPin} style={s.card}>
        <div className="public-pin-brand" style={s.brand}>
          <div style={{ textAlign: "center" }}>
            <h1 style={s.title}>Dashboard Access</h1>
            <p style={s.subtitle}>{treeId}</p>
          </div>
        </div>
        <div className="public-pin-entry" style={s.entry}>
          <label htmlFor="tree-pin" style={s.label}>Dashboard PIN</label>
          <input
            id="tree-pin"
            type="password"
            inputMode="none"
            maxLength={12}
            value={pin}
            placeholder="Enter PIN"
            autoComplete="off"
            readOnly
            required
            aria-label={`${pin.length} PIN digits entered`}
            style={s.input}
          />
          {error && <div role="alert" style={s.error}>{error}</div>}
        </div>
        <div className="public-pin-keypad" style={s.keypad} aria-label="Dashboard PIN keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => appendDigit(digit)}
              disabled={loading || pin.length >= 12}
              aria-label={`Enter ${digit}`}
              style={s.key}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={clearPin}
            disabled={loading || !pin}
            aria-label="Clear PIN"
            style={{ ...s.key, ...s.actionKey }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => appendDigit("0")}
            disabled={loading || pin.length >= 12}
            aria-label="Enter 0"
            style={s.key}
          >
            0
          </button>
          <button
            type="button"
            onClick={removeDigit}
            disabled={loading || !pin}
            aria-label="Delete last PIN digit"
            style={{ ...s.key, ...s.actionKey }}
          >
            Delete
          </button>
        </div>
        <button className="public-pin-submit" type="submit" disabled={loading || !pin} style={s.button}>
          {loading ? "Verifying…" : "Open dashboard"}
        </button>
      </form>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    height: "100dvh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: 20,
    overflowY: "auto",
    background: "radial-gradient(900px 500px at 50% 0%, rgba(34,197,94,0.14), transparent 65%), var(--bg)",
  },
  card: {
    width: "100%",
    maxWidth: 390,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "clamp(20px, 4vh, 34px) 30px",
    border: "1px solid var(--border)",
    borderRadius: 24,
    background: "var(--surface)",
    boxShadow: "0 30px 70px -30px rgba(0,0,0,0.45)",
    margin: "auto 0",
  },
  brand: { display: "flex", flexDirection: "column", alignItems: "center" },
  title: { margin: 0, fontSize: 23, fontWeight: 900, color: "var(--text-1)" },
  subtitle: { margin: "6px 0 0", color: "#16a34a", fontSize: 13, fontWeight: 800 },
  entry: { width: "100%", display: "flex", flexDirection: "column", gap: 10 },
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
  keypad: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 9,
  },
  key: {
    minHeight: 52,
    border: "1px solid var(--border)",
    borderRadius: 13,
    background: "var(--surface-hover)",
    color: "var(--text-1)",
    fontSize: 20,
    fontWeight: 800,
    cursor: "pointer",
    touchAction: "manipulation",
  },
  actionKey: {
    color: "var(--text-2)",
    fontSize: 12,
  },
  error: { width: "100%", padding: "9px 12px", borderRadius: 10, background: "rgba(239,68,68,0.12)", color: "#dc2626", fontSize: 13 },
  button: { width: "100%", marginTop: 4, padding: "13px 16px", border: 0, borderRadius: 13, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#04140a", fontSize: 14, fontWeight: 800, cursor: "pointer" },
};
