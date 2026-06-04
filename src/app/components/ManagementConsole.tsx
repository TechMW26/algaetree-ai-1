"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthGuard";

/* ---------- Custom animated checkbox ---------- */
function Checkbox({
  checked,
  onChange,
  label,
  sub,
}: {
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onChange} style={s.checkBtn} aria-pressed={checked}>
      <span
        style={{
          ...s.checkBox,
          ...(checked ? s.checkBoxOn : null),
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          style={{ opacity: checked ? 1 : 0, transition: "opacity .15s ease" }}
        >
          <path
            d="M3 8.5l3.2 3.2L13 4.5"
            stroke="#04140a"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span style={s.checkLabel}>
        {label}
        {sub != null && <span style={s.checkSub}>{sub}</span>}
      </span>
    </button>
  );
}

/* ---------- Custom dropdown ---------- */
function Dropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={s.ddTrigger}>
        <span>{current?.label ?? "Select…"}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .18s ease" }}
        >
          <path d="M4 6l4 4 4-4" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={s.ddMenu}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={{ ...s.ddItem, ...(o.value === value ? s.ddItemActive : null) }}
            >
              <span>{o.label}</span>
              {o.value === value && (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5l3.2 3.2L13 4.5" stroke="#22c55e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Tree {
  treeId: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
}

interface ManagedUser {
  _id: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "CUSTOMER";
  isActive: boolean;
  createdBy: string | null;
}

export default function ManagementConsole({ mode }: { mode: "super" | "admin" }) {
  const { user, logout } = useAuth();
  const [trees, setTrees] = useState<Tree[]>([]);
  const [treesAll, setTreesAll] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // create form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "CUSTOMER">(mode === "super" ? "ADMIN" : "CUSTOMER");
  const [accessAll, setAccessAll] = useState(false);
  const [selectedTrees, setSelectedTrees] = useState<string[]>([]);

  // assignment editor
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editAccessAll, setEditAccessAll] = useState(false);
  const [editTrees, setEditTrees] = useState<string[]>([]);

  const notify = (type: "ok" | "err", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadTrees = useCallback(async () => {
    const res = await fetch("/api/algaetrees", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setTrees(data.trees ?? []);
      setTreesAll(Boolean(data.all));
    }
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/users", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
    }
  }, []);

  useEffect(() => {
    void loadTrees();
    void loadUsers();
  }, [loadTrees, loadUsers]);

  const toggleTree = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((t) => t !== id) : [...list, id]);
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { email, role };
      if (role === "ADMIN") {
        payload.accessType = accessAll ? "ALL" : "CUSTOM";
        if (!accessAll) payload.treeIds = selectedTrees;
      } else {
        payload.treeIds = selectedTrees;
      }
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        notify("err", data.error ?? "Failed to create user");
        return;
      }
      notify("ok", `Created ${data.user.email}`);
      setEmail("");
      setSelectedTrees([]);
      setAccessAll(false);
      await loadUsers();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u: ManagedUser) => {
    const res = await fetch(`/api/users/${u._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (res.ok) {
      notify("ok", `${u.email} ${!u.isActive ? "enabled" : "disabled"}`);
      await loadUsers();
    } else {
      const data = await res.json();
      notify("err", data.error ?? "Update failed");
    }
  };

  const openEditor = async (u: ManagedUser) => {
    setEditingUser(u);
    setEditTrees([]);
    setEditAccessAll(false);
    const res = await fetch(`/api/assignments?userId=${u._id}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setEditAccessAll(Boolean(data.access?.all) && u.role === "ADMIN");
      setEditTrees(data.access?.treeIds ?? []);
    }
  };

  const saveAssignments = async () => {
    if (!editingUser) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { userId: editingUser._id };
      if (editingUser.role === "ADMIN") {
        payload.accessType = editAccessAll ? "ALL" : "CUSTOM";
        if (!editAccessAll) payload.treeIds = editTrees;
      } else {
        payload.treeIds = editTrees;
      }
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        notify("err", data.error ?? "Failed to update access");
        return;
      }
      notify("ok", "Access updated");
      setEditingUser(null);
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "super" ? "Super Admin Console" : "Admin Console";
  const canCreateAdmin = mode === "super";

  const visibleTrees = useMemo(() => trees, [trees]);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div>
          <h1 style={s.h1}>{title}</h1>
          <p style={s.sub}>{user?.email}</p>
        </div>
        <div style={s.headerActions}>
          <a href="/" style={s.backLink}>← Map</a>
          <button onClick={() => void logout()} style={s.logout}>Sign out</button>
        </div>
      </header>

      {message && (
        <div style={{ ...s.toast, ...(message.type === "ok" ? s.toastOk : s.toastErr) }}>
          {message.text}
        </div>
      )}

      <div style={s.grid}>
        {/* Create user */}
        <section style={s.card}>
          <h2 style={s.h2}>Create {canCreateAdmin ? "user" : "customer"}</h2>
          <form onSubmit={createUser} style={s.form}>
            <input style={s.input} type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            {canCreateAdmin && (
              <div>
                <span style={s.fieldLabel}>Role</span>
                <Dropdown
                  value={role}
                  onChange={(v) => setRole(v as "ADMIN" | "CUSTOMER")}
                  options={[
                    { value: "ADMIN", label: "Admin" },
                    { value: "CUSTOMER", label: "Customer" },
                  ]}
                />
              </div>
            )}

            {role === "ADMIN" && canCreateAdmin && (
              <Checkbox
                checked={accessAll}
                onChange={() => setAccessAll(!accessAll)}
                label="All AlgaeTrees"
                sub="Includes future trees"
              />
            )}

            {!(role === "ADMIN" && accessAll) && (
              <div style={s.treeList}>
                <span style={s.treeListLabel}>Assign AlgaeTrees</span>
                {visibleTrees.length === 0 && <span style={s.muted}>No trees available</span>}
                {visibleTrees.map((t) => (
                  <Checkbox
                    key={t.treeId}
                    checked={selectedTrees.includes(t.treeId)}
                    onChange={() => toggleTree(t.treeId, selectedTrees, setSelectedTrees)}
                    label={t.name}
                    sub={t.treeId}
                  />
                ))}
              </div>
            )}

            <button type="submit" disabled={busy} style={s.primary}>
              {busy ? "Saving…" : "Create"}
            </button>
          </form>
        </section>

        {/* Users list */}
        <section style={s.card}>
          <h2 style={s.h2}>Users</h2>
          <div style={s.userList}>
            {users.length === 0 && <span style={s.muted}>No users yet</span>}
            {users.map((u) => (
              <div key={u._id} style={s.userRow}>
                <div>
                  <div style={s.userEmail}>{u.email}</div>
                  <div style={s.userMeta}>
                    <span style={s.badge}>{u.role}</span>
                    <span style={{ color: u.isActive ? "#4ade80" : "#f87171" }}>
                      {u.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>
                </div>
                {u.role !== "SUPER_ADMIN" && (
                  <div style={s.userActions}>
                    <button style={s.smallBtn} onClick={() => void openEditor(u)}>Access</button>
                    <button style={s.smallBtn} onClick={() => void toggleActive(u)}>
                      {u.isActive ? "Disable" : "Enable"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Tree registry */}
        <section style={s.card}>
          <h2 style={s.h2}>AlgaeTrees {treesAll && <span style={s.muted}>(all)</span>}</h2>
          <div style={s.userList}>
            {visibleTrees.map((t) => (
              <div key={t.treeId} style={s.userRow}>
                <div>
                  <div style={s.userEmail}>{t.name}</div>
                  <div style={s.userMeta}>
                    <span style={s.badge}>{t.treeId}</span>
                    <span style={s.muted}>{t.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Assignment editor modal */}
      {editingUser && (
        <div style={s.modalBg} onClick={() => setEditingUser(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.h2}>Access — {editingUser.email}</h2>
            {editingUser.role === "ADMIN" && mode === "super" && (
              <Checkbox
                checked={editAccessAll}
                onChange={() => setEditAccessAll(!editAccessAll)}
                label="All AlgaeTrees"
                sub="Includes future trees"
              />
            )}
            {!(editingUser.role === "ADMIN" && editAccessAll) && (
              <div style={s.treeList}>
                {visibleTrees.map((t) => (
                  <Checkbox
                    key={t.treeId}
                    checked={editTrees.includes(t.treeId)}
                    onChange={() => toggleTree(t.treeId, editTrees, setEditTrees)}
                    label={t.name}
                    sub={t.treeId}
                  />
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={s.primary} disabled={busy} onClick={() => void saveAssignments()}>Save</button>
              <button style={s.smallBtn} onClick={() => setEditingUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(1200px 600px at 15% -10%, rgba(34,197,94,0.10), transparent 55%), radial-gradient(1000px 500px at 100% 0%, rgba(56,189,248,0.07), transparent 50%), var(--bg)",
    color: "var(--text-1)",
    padding: "28px 28px 48px",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 },
  headerActions: { display: "flex", alignItems: "center", gap: 10 },
  h1: { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: "var(--text-1)" },
  sub: { margin: "4px 0 0", color: "var(--text-2)", fontSize: 13 },
  backLink: { textDecoration: "none", color: "var(--text-1)", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600 },
  logout: { background: "var(--surface-hover)", color: "var(--text-1)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 600 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 18 },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 16px 40px -28px rgba(0,0,0,0.45)",
  },
  h2: { margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "var(--text-1)" },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  fieldLabel: { display: "block", fontSize: 12, color: "var(--text-2)", fontWeight: 600, marginBottom: 6 },
  input: {
    background: "var(--surface-hover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "11px 13px",
    color: "var(--text-1)",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  /* custom checkbox */
  checkBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    padding: "6px 4px",
    cursor: "pointer",
    color: "var(--text-1)",
  },
  checkBox: {
    flex: "0 0 auto",
    width: 20,
    height: 20,
    borderRadius: 6,
    border: "1.5px solid var(--border-hover)",
    background: "var(--surface-hover)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background .15s ease, border-color .15s ease",
  },
  checkBoxOn: { background: "linear-gradient(135deg,#22c55e,#16a34a)", borderColor: "#22c55e" },
  checkLabel: { display: "flex", flexDirection: "column", lineHeight: 1.25, fontSize: 13.5, fontWeight: 600 },
  checkSub: { color: "var(--text-2)", fontSize: 11, fontWeight: 500 },
  /* custom dropdown */
  ddTrigger: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    background: "var(--surface-hover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "11px 13px",
    color: "var(--text-1)",
    fontSize: 14,
    cursor: "pointer",
  },
  ddMenu: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 6,
    zIndex: 40,
    boxShadow: "0 18px 40px -20px rgba(0,0,0,0.45)",
  },
  ddItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    padding: "9px 11px",
    color: "var(--text-1)",
    fontSize: 14,
    cursor: "pointer",
  },
  ddItemActive: { background: "rgba(34,197,94,0.14)", color: "#15803d" },
  checkRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-2)" },
  treeList: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto", padding: 10, background: "var(--surface-hover)", borderRadius: 12, border: "1px solid var(--border)" },
  treeListLabel: { fontSize: 12, color: "var(--text-2)", fontWeight: 600, marginBottom: 2 },
  treeItem: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 },
  muted: { color: "var(--text-2)", fontSize: 12 },
  primary: { background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#04140a", fontWeight: 700, border: "none", borderRadius: 12, padding: "11px 14px", cursor: "pointer", fontSize: 14, marginTop: 2 },
  userList: { display: "flex", flexDirection: "column", gap: 8 },
  userRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 13px", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 12 },
  userEmail: { fontSize: 14, fontWeight: 600, color: "var(--text-1)" },
  userMeta: { display: "flex", gap: 8, alignItems: "center", marginTop: 4, fontSize: 12 },
  badge: { background: "rgba(34,197,94,0.16)", color: "#15803d", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 0.3 },
  userActions: { display: "flex", gap: 6 },
  smallBtn: { background: "var(--surface-hover)", color: "var(--text-1)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 11px", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  toast: { padding: "11px 15px", borderRadius: 12, marginBottom: 16, fontSize: 13, fontWeight: 600 },
  toastOk: { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#15803d" },
  toastErr: { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#dc2626" },
  modalBg: { position: "fixed", inset: 0, background: "rgba(2,6,23,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 },
  modal: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 22, width: "100%", maxWidth: 440, boxShadow: "0 30px 70px -32px rgba(0,0,0,0.5)" },
};
