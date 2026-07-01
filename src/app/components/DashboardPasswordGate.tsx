"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export interface DashboardPasswordGateProps {
  children: React.ReactNode;
  correctPassword: string;
}

export default function DashboardPasswordGate({
  children,
  correctPassword,
}: DashboardPasswordGateProps) {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState(false);

  const handleNumberClick = (num: string) => {
    setError(false);
    const newPassword = password + num;
    setPassword(newPassword);

    if (newPassword.length === correctPassword.length) {
      if (newPassword === correctPassword) {
        setUnlocked(true);
        setPassword("");
      } else {
        setError(true);
        setTimeout(() => setPassword(""), 600);
      }
    }
  };

  const handleBackspace = () => {
    setPassword(password.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPassword("");
    setError(false);
  };

  const buttonBase = {
    padding: 0,
    border: "none",
    borderRadius: 16,
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 18,
    transition: "all 0.2s ease",
    fontFamily: "inherit",
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{ height: "100%" }}
      >
        {children}
      </motion.div>

      {!unlocked && (
        <motion.div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <motion.div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          padding: 40,
          borderRadius: 32,
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.9) 100%)",
          border: "1px solid rgba(148, 163, 184, 0.2)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          width: "90%",
          maxWidth: 360,
        }}
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", width: "100%" }}>
          <motion.h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#f1f5f9",
              margin: "0 0 6px 0",
              letterSpacing: "-0.5px",
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            Access Dashboard
          </motion.h2>
          <motion.p
            style={{
              fontSize: 12,
              color: "#cbd5e1",
              margin: 0,
              fontWeight: 500,
              letterSpacing: "0.3px",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            Enter your 4-digit passcode
          </motion.p>
        </div>

        {/* Password Indicators */}
        <motion.div
          style={{
            display: "flex",
            gap: 14,
            justifyContent: "center",
          }}
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          {Array.from({ length: correctPassword.length }).map((_, i) => (
            <motion.div
              key={i}
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background:
                  i < password.length
                    ? error
                      ? "rgba(239, 68, 68, 0.25)"
                      : "rgba(34, 197, 94, 0.25)"
                    : "rgba(51, 65, 85, 0.4)",
                border:
                  i < password.length
                    ? error
                      ? "2px solid #ef4444"
                      : "2px solid #22c55e"
                    : "2px solid rgba(100, 116, 139, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
                color:
                  i < password.length
                    ? error
                      ? "#ef4444"
                      : "#22c55e"
                    : "transparent",
              }}
              animate={
                error
                  ? { x: [0, -8, 8, -8, 8, 0] }
                  : { scale: i < password.length ? 1.05 : 1 }
              }
              transition={error ? { duration: 0.5, type: "spring" } : { duration: 0.2 }}
            >
              {i < password.length ? "●" : ""}
            </motion.div>
          ))}
        </motion.div>

        {/* Number Pad Grid (1-9) */}
        <motion.div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            width: "100%",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num, idx) => (
            <motion.button
              key={num}
              onClick={() => handleNumberClick(String(num))}
              type="button"
              style={{
                ...buttonBase,
                width: "100%",
                padding: "16px 8px",
                background: "rgba(51, 65, 85, 0.45)",
                color: "#f1f5f9",
                borderWidth: "1.5px",
                borderStyle: "solid",
                borderColor: "rgba(100, 116, 139, 0.3)",
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + idx * 0.03, duration: 0.3 }}
              whileHover={{
                background: "rgba(71, 85, 105, 0.7)",
                borderColor: "rgba(148, 163, 184, 0.6)",
                y: -2,
              }}
              whileTap={{ scale: 0.92 }}
            >
              {num}
            </motion.button>
          ))}
        </motion.div>

        {/* Bottom Row: Delete | 0 | Clear */}
        <motion.div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
            width: "100%",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          {/* Delete Button */}
          <motion.button
            onClick={handleBackspace}
            disabled={password.length === 0}
            type="button"
            style={{
              ...buttonBase,
              padding: "16px 8px",
              background:
                password.length === 0
                  ? "rgba(51, 65, 85, 0.2)"
                  : "rgba(120, 53, 15, 0.3)",
              color: password.length === 0 ? "#64748b" : "#fb923c",
              borderWidth: "1.5px",
              borderStyle: "solid",
              borderColor:
                password.length === 0
                  ? "rgba(100, 116, 139, 0.2)"
                  : "rgba(251, 146, 60, 0.3)",
              opacity: password.length === 0 ? 0.5 : 1,
              pointerEvents: password.length === 0 ? "none" : "auto",
            }}
            whileHover={
              password.length > 0
                ? {
                    background: "rgba(120, 53, 15, 0.5)",
                    borderColor: "rgba(251, 146, 60, 0.6)",
                    y: -2,
                  }
                : {}
            }
            whileTap={password.length > 0 ? { scale: 0.92 } : {}}
          >
            ←
          </motion.button>

          {/* Zero Button - Center */}
          <motion.button
            onClick={() => handleNumberClick("0")}
            type="button"
            style={{
              ...buttonBase,
              padding: "16px 8px",
              background: "rgba(51, 65, 85, 0.45)",
              color: "#f1f5f9",
              borderWidth: "1.5px",
              borderStyle: "solid",
              borderColor: "rgba(100, 116, 139, 0.3)",
              fontSize: 20,
              fontWeight: 700,
            }}
            whileHover={{
              background: "rgba(71, 85, 105, 0.7)",
              borderColor: "rgba(148, 163, 184, 0.6)",
              y: -2,
            }}
            whileTap={{ scale: 0.92 }}
          >
            0
          </motion.button>

          {/* Clear Button */}
          <motion.button
            onClick={handleClear}
            disabled={password.length === 0}
            type="button"
            style={{
              ...buttonBase,
              padding: "16px 8px",
              background:
                password.length === 0
                  ? "rgba(51, 65, 85, 0.2)"
                  : "rgba(127, 29, 29, 0.3)",
              color: password.length === 0 ? "#64748b" : "#f87171",
              borderWidth: "1.5px",
              borderStyle: "solid",
              borderColor:
                password.length === 0
                  ? "rgba(100, 116, 139, 0.2)"
                  : "rgba(248, 113, 113, 0.3)",
              opacity: password.length === 0 ? 0.5 : 1,
              pointerEvents: password.length === 0 ? "none" : "auto",
            }}
            whileHover={
              password.length > 0
                ? {
                    background: "rgba(127, 29, 29, 0.5)",
                    borderColor: "rgba(248, 113, 113, 0.6)",
                    y: -2,
                  }
                : {}
            }
            whileTap={password.length > 0 ? { scale: 0.92 } : {}}
          >
            ×
          </motion.button>
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#fca5a5",
              fontWeight: 600,
              textAlign: "center",
              letterSpacing: "0.2px",
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            Incorrect code. Please try again.
          </motion.p>
        )}
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
