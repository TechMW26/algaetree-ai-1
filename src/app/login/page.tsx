"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Step = "credentials" | "otp";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "";

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign in failed");
        return;
      }
      setStep("otp");
      setInfo("We sent a 6-digit code to your email.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification failed");
        return;
      }
      const target = nextPath || data.redirect || "/dashboard";
      router.replace(target);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not resend code");
        return;
      }
      setInfo("A new code was sent.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <span style={styles.logoDot} />
          <span style={styles.brandText}>AlgaeTree</span>
        </div>

        {step === "credentials" ? (
          <form onSubmit={submitCredentials} style={styles.form}>
            <h1 style={styles.title}>Sign in</h1>
            <p style={styles.subtitle}>Enter your email and password to continue.</p>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="you@company.com"
              autoComplete="email"
            />
            <label style={styles.label}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {error && <div style={styles.error}>{error}</div>}
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? "Please wait…" : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} style={styles.form}>
            <h1 style={styles.title}>Verify it&apos;s you</h1>
            <p style={styles.subtitle}>Enter the 6-digit code sent to {email}.</p>
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              style={{ ...styles.input, letterSpacing: 8, textAlign: "center", fontSize: 22 }}
              placeholder="••••••"
              autoComplete="one-time-code"
            />
            {info && <div style={styles.info}>{info}</div>}
            {error && <div style={styles.error}>{error}</div>}
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? "Verifying…" : "Verify & sign in"}
            </button>
            <button type="button" onClick={resendOtp} disabled={loading} style={styles.linkButton}>
              Resend code
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg,#0b1220 0%,#0f172a 100%)",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: "rgba(15,23,42,0.7)",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 24,
    padding: 32,
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
    backdropFilter: "blur(16px)",
  },
  brand: { display: "flex", alignItems: "center", gap: 10, marginBottom: 24 },
  logoDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
  },
  brandText: { color: "#f1f5f9", fontWeight: 700, fontSize: 18 },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: 800, margin: 0 },
  subtitle: { color: "#94a3b8", fontSize: 13, margin: "0 0 8px" },
  label: { color: "#cbd5e1", fontSize: 12, fontWeight: 600, marginTop: 6 },
  input: {
    background: "rgba(2,6,23,0.6)",
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: 12,
    padding: "12px 14px",
    color: "#f1f5f9",
    fontSize: 15,
    outline: "none",
  },
  button: {
    marginTop: 10,
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
    color: "#04140a",
    fontWeight: 700,
    fontSize: 15,
    border: "none",
    borderRadius: 12,
    padding: "12px 14px",
    cursor: "pointer",
  },
  linkButton: {
    background: "none",
    border: "none",
    color: "#86efac",
    fontSize: 13,
    cursor: "pointer",
    marginTop: 4,
  },
  error: {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 13,
  },
  info: {
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#86efac",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 13,
  },
};
