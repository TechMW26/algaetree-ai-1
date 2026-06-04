"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Step = "email" | "otp";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const otpRef = useRef<HTMLInputElement>(null);

  // Resend cooldown countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // Focus the OTP field when we reach that step.
  useEffect(() => {
    if (step === "otp") otpRef.current?.focus();
  }, [step]);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign in failed");
        return;
      }
      setStep("otp");
      setResendIn(30);
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
      const target = nextPath || data.redirect || "/";
      router.replace(target);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resendIn > 0) return;
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
      setResendIn(30);
      setInfo("A new code was sent.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const editEmail = () => {
    setStep("email");
    setOtp("");
    setError("");
    setInfo("");
  };

  return (
    <div style={styles.page}>
      <div style={styles.glowA} />
      <div style={styles.glowB} />

      <div style={styles.card}>
        <div style={styles.brand}>
          <span style={styles.logo}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 21c5-2 8-6 8-11V5l-8-2-8 2v5c0 5 3 9 8 11Z" fill="url(#g)" />
              <path
                d="M12 7v9M9 10c1.5 0 3 .8 3 3M15 10c-1.5 0-3 .8-3 3"
                stroke="#04140a"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="g" x1="4" y1="3" x2="20" y2="21">
                  <stop stopColor="#34d399" />
                  <stop offset="1" stopColor="#16a34a" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          <span style={styles.brandText}>AlgaeTree</span>
        </div>

        {step === "email" ? (
          <form onSubmit={submitEmail} style={styles.form}>
            <h1 style={styles.title}>Sign in</h1>
            <p style={styles.subtitle}>
              Enter your email and we&apos;ll send you a one-time code.
            </p>

            <label style={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="you@company.com"
              autoComplete="email"
              autoFocus
            />

            {error && <div style={styles.error}>{error}</div>}

            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? "Sending code…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} style={styles.form}>
            <h1 style={styles.title}>Check your email</h1>
            <p style={styles.subtitle}>
              We sent a 6-digit code to{" "}
              <strong style={styles.emailHi}>{email}</strong>.
            </p>

            <input
              ref={otpRef}
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              style={styles.otpInput}
              placeholder="••••••"
              autoComplete="one-time-code"
            />

            {info && <div style={styles.info}>{info}</div>}
            {error && <div style={styles.error}>{error}</div>}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              style={{
                ...styles.button,
                ...(otp.length !== 6 ? styles.buttonDisabled : null),
              }}
            >
              {loading ? "Verifying…" : "Verify & sign in"}
            </button>

            <div style={styles.row}>
              <button type="button" onClick={editEmail} style={styles.linkButton}>
                ← Change email
              </button>
              <button
                type="button"
                onClick={resendOtp}
                disabled={loading || resendIn > 0}
                style={{
                  ...styles.linkButton,
                  ...(resendIn > 0 ? styles.linkDisabled : null),
                }}
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        <p style={styles.footer}>Protected by one-time passcode verification.</p>
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
    background:
      "radial-gradient(1200px 600px at 50% -10%, rgba(34,197,94,0.10), transparent 60%), linear-gradient(135deg,#070d18 0%,#0b1426 100%)",
    padding: 20,
    overflow: "hidden",
  },
  glowA: {
    position: "absolute",
    top: "-12%",
    left: "10%",
    width: 360,
    height: 360,
    borderRadius: "50%",
    background: "rgba(34,197,94,0.18)",
    filter: "blur(120px)",
    pointerEvents: "none",
  },
  glowB: {
    position: "absolute",
    bottom: "-15%",
    right: "8%",
    width: 380,
    height: 380,
    borderRadius: "50%",
    background: "rgba(56,189,248,0.12)",
    filter: "blur(130px)",
    pointerEvents: "none",
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 400,
    background:
      "linear-gradient(180deg, rgba(17,26,45,0.82), rgba(9,15,28,0.86))",
    border: "1px solid rgba(148,163,184,0.16)",
    borderRadius: 24,
    padding: "34px 32px",
    boxShadow: "0 30px 70px -25px rgba(0,0,0,0.75)",
    backdropFilter: "blur(18px)",
  },
  brand: { display: "flex", alignItems: "center", gap: 10, marginBottom: 26 },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 11,
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    color: "#f1f5f9",
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: -0.2,
  },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  title: {
    color: "#f8fafc",
    fontSize: 26,
    fontWeight: 800,
    margin: 0,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 13.5,
    lineHeight: 1.5,
    margin: "6px 0 12px",
  },
  emailHi: { color: "#e2e8f0", fontWeight: 600 },
  label: { color: "#cbd5e1", fontSize: 12, fontWeight: 600, marginTop: 2 },
  input: {
    background: "rgba(2,6,23,0.55)",
    border: "1px solid rgba(148,163,184,0.22)",
    borderRadius: 12,
    padding: "13px 14px",
    color: "#f1f5f9",
    fontSize: 15,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  otpInput: {
    background: "rgba(2,6,23,0.55)",
    border: "1px solid rgba(148,163,184,0.22)",
    borderRadius: 12,
    padding: "16px 14px",
    color: "#f1f5f9",
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: 14,
    textAlign: "center",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  button: {
    marginTop: 12,
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
    color: "#04140a",
    fontWeight: 700,
    fontSize: 15,
    border: "none",
    borderRadius: 12,
    padding: "13px 14px",
    cursor: "pointer",
    boxShadow: "0 12px 24px -10px rgba(34,197,94,0.6)",
  },
  buttonDisabled: { opacity: 0.45, cursor: "not-allowed", boxShadow: "none" },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  linkButton: {
    background: "none",
    border: "none",
    color: "#86efac",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
    fontWeight: 600,
  },
  linkDisabled: { color: "#64748b", cursor: "not-allowed" },
  error: {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5",
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 13,
  },
  info: {
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#86efac",
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 13,
  },
  footer: {
    color: "#475569",
    fontSize: 11.5,
    textAlign: "center",
    margin: "22px 0 0",
  },
};
