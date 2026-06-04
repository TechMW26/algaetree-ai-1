"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

export interface AuthUser {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "CUSTOMER";
  home: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  logout: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

async function fetchMe(): Promise<AuthUser | null> {
  let res = await fetch("/api/auth/me", { cache: "no-store" });
  if (res.status === 401) {
    // Try a silent refresh, then retry.
    const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
    if (!refreshed.ok) return null;
    res = await fetch("/api/auth/me", { cache: "no-store" });
  }
  if (!res.ok) return null;
  const data = await res.json();
  return data.user as AuthUser;
}

/**
 * Client-side guard. Verifies the session (refreshing the access token if
 * needed) and enforces allowed roles. Renders children only when authorized.
 */
export function AuthGuard({
  allowedRoles,
  children,
}: {
  allowedRoles?: AuthUser["role"][];
  children: ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      const me = await fetchMe();
      if (!active) return;
      if (!me) {
        router.replace("/login");
        return;
      }
      if (allowedRoles && !allowedRoles.includes(me.role)) {
        router.replace(me.home);
        return;
      }
      setUser(me);
      setStatus("ready");
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  if (status === "loading") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          color: "var(--text-2)",
          fontSize: 14,
        }}
      >
        Verifying session…
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}
