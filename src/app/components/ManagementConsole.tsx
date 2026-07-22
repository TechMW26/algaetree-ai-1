"use client";

import Link from "next/link";
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
  city?: string;
  lat: number;
  lng: number;
  isAi?: boolean;
  imageUrl: string;
}

interface ManagedUser {
  _id: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "CUSTOMER";
  isActive: boolean;
  createdBy: string | null;
}

function reconcileTrees(current: Tree[], incoming: Tree[]): Tree[] {
  const currentById = new Map(current.map((t) => [t.treeId, t]));
  let changed = current.length !== incoming.length;
  const next = incoming.map((tree) => {
    const existing = currentById.get(tree.treeId);
    if (!existing) {
      changed = true;
      return tree;
    }
    const same = JSON.stringify(existing) === JSON.stringify(tree);
    if (!same) changed = true;
    return same ? existing : tree;
  });
  return changed ? next : current;
}

export default function ManagementConsole({ mode }: { mode: "super" | "admin" }) {
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState<"overview" | "create" | "users" | "access" | "registry">("overview");
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

  // tree registry form
  const [treeId, setTreeId] = useState("");
  const [treeName, setTreeName] = useState("");
  const [treeLocation, setTreeLocation] = useState("");
  const [treeCity, setTreeCity] = useState("");
  const [treeLat, setTreeLat] = useState("");
  const [treeLng, setTreeLng] = useState("");

  // assignment editor
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editAccessAll, setEditAccessAll] = useState(false);
  const [editTrees, setEditTrees] = useState<string[]>([]);
  const [treeSearch, setTreeSearch] = useState("");

  // tree metadata editor
  const [editingTree, setEditingTree] = useState<Tree | null>(null);
  const [editTreeName, setEditTreeName] = useState("");
  const [editTreeLocation, setEditTreeLocation] = useState("");
  const [editTreeCity, setEditTreeCity] = useState("");
  const [editTreeLat, setEditTreeLat] = useState("");
  const [editTreeLng, setEditTreeLng] = useState("");
  const [editTreeImage, setEditTreeImage] = useState<File | null>(null);
  const [editTreeImagePreview, setEditTreeImagePreview] = useState("");

  // pin setter modal
  const [settingPinTree, setSettingPinTree] = useState<Tree | null>(null);
  const [newPin, setNewPin] = useState("");

  const notify = (type: "ok" | "err", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadTrees = useCallback(async () => {
    const res = await fetch("/api/algaetrees", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setTrees((current) => reconcileTrees(current, data.trees ?? []));
      setTreesAll(true);
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
    const refreshId = setInterval(() => void loadTrees(), 10000);
    return () => clearInterval(refreshId);
  }, [loadTrees, loadUsers]);

  useEffect(() => {
    return () => {
      if (editTreeImagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(editTreeImagePreview);
      }
    };
  }, [editTreeImagePreview]);

  const toggleTree = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((t) => t !== id) : [...list, id]);
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { email, role };
      const validTreeIds = new Set(trees.map((t) => t.treeId));
      const resolvedSelectedTrees = selectedTrees.filter((id) => validTreeIds.has(id));
      if (role === "ADMIN") {
        payload.accessType = accessAll ? "ALL" : "CUSTOM";
        if (!accessAll) payload.treeIds = resolvedSelectedTrees;
      } else {
        payload.treeIds = resolvedSelectedTrees;
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

  const createTree = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const lat = Number(treeLat);
      const lng = Number(treeLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        notify("err", "Latitude and longitude must be valid numbers");
        return;
      }
      const res = await fetch("/api/algaetrees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treeId,
          name: treeName,
          location: treeLocation,
          city: treeCity,
          lat,
          lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify("err", data.error ?? "Failed to create AlgaeTree");
        return;
      }
      notify("ok", `Created ${data.tree.treeId}`);
      setTreeId("");
      setTreeName("");
      setTreeLocation("");
      setTreeCity("");
      setTreeLat("");
      setTreeLng("");
      await loadTrees();
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
      const validTreeIds = new Set(trees.map((t) => t.treeId));
      const resolvedEditTrees = editTrees.filter((id) => validTreeIds.has(id));
      if (editingUser.role === "ADMIN") {
        payload.accessType = editAccessAll ? "ALL" : "CUSTOM";
        if (!editAccessAll) payload.treeIds = resolvedEditTrees;
      } else {
        payload.treeIds = resolvedEditTrees;
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

  const openTreeEditor = (tree: Tree) => {
    setEditingTree(tree);
    setEditTreeName(tree.name);
    setEditTreeLocation(tree.location);
    setEditTreeCity(tree.city ?? "");
    setEditTreeLat(String(tree.lat));
    setEditTreeLng(String(tree.lng));
    setEditTreeImage(null);
    setEditTreeImagePreview(tree.imageUrl || "/Algaetree.png");
  };

  const saveTree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTree) return;

    const lat = Number(editTreeLat);
    const lng = Number(editTreeLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      notify("err", "Latitude and longitude must be valid numbers");
      return;
    }

    const form = new FormData();
    form.set("name", editTreeName);
    form.set("location", editTreeLocation);
    form.set("city", editTreeCity);
    form.set("lat", String(lat));
    form.set("lng", String(lng));
    if (editTreeImage) form.set("image", editTreeImage);

    setBusy(true);
    try {
      const res = await fetch(`/api/algaetrees/${encodeURIComponent(editingTree.treeId)}`, {
        method: "PATCH",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        notify("err", data.error ?? "Failed to update AlgaeTree");
        return;
      }
      notify("ok", `Updated ${editingTree.treeId}`);
      setEditingTree(null);
      await loadTrees();
    } catch {
      notify("err", "Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const copyPublicLink = async (tree: Tree) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/algaetrees/${encodeURIComponent(tree.treeId)}/share-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        notify("err", data.error ?? "Failed to create dashboard link");
        return;
      }

      const url = new URL(data.path, window.location.origin).toString();
      try {
        await navigator.clipboard.writeText(url);
        notify("ok", `Dashboard link copied for ${tree.treeId}`);
      } catch {
        window.prompt("Copy this dashboard link", url);
      }
    } catch {
      notify("err", "Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const savePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingPinTree) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/algaetrees/${encodeURIComponent(settingPinTree.treeId)}/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: newPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify("err", data.error ?? "Failed to set PIN");
        return;
      }
      notify("ok", `PIN set for ${settingPinTree.treeId}`);
      setSettingPinTree(null);
      setNewPin("");
    } catch {
      notify("err", "Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const removePin = async () => {
    if (!settingPinTree) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/algaetrees/${encodeURIComponent(settingPinTree.treeId)}/pin`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        notify("err", data.error ?? "Failed to remove PIN");
        return;
      }
      notify("ok", `PIN removed for ${settingPinTree.treeId}`);
      setSettingPinTree(null);
      setNewPin("");
    } catch {
      notify("err", "Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "super" ? "Super Admin Console" : "Admin Console";
  const canCreateAdmin = mode === "super";
  const activeUsers = users.filter((u) => u.isActive).length;

  const visibleTrees = useMemo(() => trees, [trees]);

  const registryFiltered = useMemo(() => {
    const q = treeSearch.trim().toLowerCase();
    if (!q) return trees;
    return trees.filter(
      (t) =>
        t.treeId.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q),
    );
  }, [trees, treeSearch]);

  return (
    <div style={s.page}>
      <aside style={s.sidebar}>
        <div>
          <h1 style={s.h1}>{title}</h1>
          <p style={s.sub}>{user?.email}</p>
        </div>
        <nav style={s.nav}>
          {[
            ["overview", "Overview"],
            ["create", `Create ${canCreateAdmin ? "User" : "Customer"}`],
            ["users", "Users"],
            ["access", "Tree Access"],
            ["registry", "Tree Registry"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveView(id as typeof activeView)}
              style={{ ...s.navItem, ...(activeView === id ? s.navItemActive : null) }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div style={s.sidebarActions}>
          <Link href="/" style={s.backLink}>← Dashboard</Link>
          <button onClick={() => void logout()} style={s.logout}>Sign out</button>
        </div>
      </aside>

      <main style={s.main}>
        <header style={s.header}>
          <div>
            <h2 style={s.pageTitle}>{activeView === "overview" ? "Operations" : activeView === "create" ? "Create user" : activeView === "users" ? "Manage users" : activeView === "access" ? "Tree access" : "Tree registry"}</h2>
            <p style={s.sub}>Manage users, access scopes, and DB-backed AlgaeTree placement.</p>
          </div>
        </header>

        {message && (
          <div style={{ ...s.toast, ...(message.type === "ok" ? s.toastOk : s.toastErr) }}>
            {message.text}
          </div>
        )}

        {activeView === "overview" && (
          <section style={s.dashboardGrid}>
            {[
              ["Users", users.length],
              ["Active users", activeUsers],
              ["AlgaeTrees", trees.length],
              ["AI trees", trees.filter((t) => t.isAi).length],
            ].map(([label, value]) => (
              <div key={label} style={s.metricCard}>
                <span style={s.muted}>{label}</span>
                <strong style={s.metricValue}>{value}</strong>
              </div>
            ))}
          </section>
        )}

        {activeView === "create" && (
          <section style={{ ...s.wideCard, flex: 1, minHeight: 0 }}>
            <h2 style={s.h2}>Create {canCreateAdmin ? "user" : "customer"}</h2>
            <form onSubmit={createUser} style={s.formWide}>
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
                <Checkbox checked={accessAll} onChange={() => setAccessAll(!accessAll)} label="All AlgaeTrees" sub="Includes future trees" />
              )}
              {!(role === "ADMIN" && accessAll) && (
                <div style={s.treeListLarge}>
                  <span style={s.treeListLabel}>Assign AlgaeTrees</span>
                  {visibleTrees.length === 0 && <span style={s.muted}>No trees available</span>}
                  {visibleTrees.map((t) => (
                    <Checkbox key={t.treeId} checked={selectedTrees.includes(t.treeId)} onChange={() => toggleTree(t.treeId, selectedTrees, setSelectedTrees)} label={<>{t.name}{t.isAi && <span style={s.aiBadge}>AI</span>}</>} sub={t.treeId} />
                  ))}
                </div>
              )}
              <button type="submit" disabled={busy} style={s.primary}>{busy ? "Saving…" : "Create"}</button>
            </form>
          </section>
        )}

        {(activeView === "users" || activeView === "access") && (
          <section style={{ ...s.wideCard, flex: 1, minHeight: 0 }}>
            <h2 style={s.h2}>{activeView === "users" ? "Users" : "Tree access"}</h2>
            <div style={s.scrollListLarge}>
              {users.length === 0 && <span style={s.muted}>No users yet</span>}
              {users.map((u) => (
                <div key={u._id} style={s.userRow}>
                  <div>
                    <div style={s.userEmail}>{u.email}</div>
                    <div style={s.userMeta}>
                      <span style={s.badge}>{u.role}</span>
                      <span style={{ color: u.isActive ? "#4ade80" : "#f87171" }}>{u.isActive ? "Active" : "Disabled"}</span>
                    </div>
                  </div>
                  {u.role !== "SUPER_ADMIN" && (
                    <div style={s.userActions}>
                      <button style={s.smallBtn} onClick={() => void openEditor(u)}>Access</button>
                      <button style={s.smallBtn} onClick={() => void toggleActive(u)}>{u.isActive ? "Disable" : "Enable"}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeView === "registry" && (
          <section style={s.registryLayout}>
            {mode === "super" && (
              <div style={s.wideCard}>
                <h2 style={s.h2}>Add AlgaeTree to DB</h2>
                <form onSubmit={createTree} style={s.form}>
                  <input style={s.input} placeholder="Tree ID" required value={treeId} onChange={(e) => setTreeId(e.target.value)} />
                  <input style={s.input} placeholder="Name" required value={treeName} onChange={(e) => setTreeName(e.target.value)} />
                  <input style={s.input} placeholder="Location" value={treeLocation} onChange={(e) => setTreeLocation(e.target.value)} />
                  <input style={s.input} placeholder="City" value={treeCity} onChange={(e) => setTreeCity(e.target.value)} />
                  <div style={s.twoCols}>
                    <input style={s.input} placeholder="Latitude" required value={treeLat} onChange={(e) => setTreeLat(e.target.value)} />
                    <input style={s.input} placeholder="Longitude" required value={treeLng} onChange={(e) => setTreeLng(e.target.value)} />
                  </div>
                  <button type="submit" disabled={busy} style={s.primary}>{busy ? "Saving…" : "Add tree"}</button>
                </form>
              </div>
            )}
            <div style={{ ...s.wideCard, height: "100%" }}>
              <h2 style={s.h2}>AlgaeTrees {treesAll && <span style={s.muted}>(DB)</span>}</h2>
              <input style={s.input} type="text" placeholder="Search trees…" value={treeSearch} onChange={(e) => setTreeSearch(e.target.value)} />
              <div style={s.scrollListLarge}>
                {registryFiltered.length === 0 && <span style={s.muted}>No trees match</span>}
                {registryFiltered.map((t) => (
                  <div key={t.treeId} style={s.userRow}>
                    <div style={s.treeRegistryRow}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.imageUrl || "/Algaetree.png"} alt="" style={s.treeThumb} />
                      <div>
                      <div style={s.userEmail}>{t.name}{t.isAi && <span style={s.aiBadge}>AI</span>}</div>
                      <div style={s.userMeta}>
                        <span style={s.badge}>{t.treeId}</span>
                        <span style={s.muted}>{t.location || t.city || "No location label"}</span>
                        <span style={s.muted}>{t.lat}, {t.lng}</span>
                      </div>
                      </div>
                    </div>
                    {mode === "super" && (
                      <div style={s.userActions}>
                        <button type="button" style={s.smallBtn} disabled={busy} onClick={() => openTreeEditor(t)}>Edit</button>
                        <button type="button" style={s.smallBtn} disabled={busy} onClick={() => { setSettingPinTree(t); setNewPin(""); }}>Set PIN</button>
                        <button type="button" style={s.smallBtn} disabled={busy} onClick={() => void copyPublicLink(t)}>Copy link</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

      </main>

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
                    label={<>{t.name}{t.isAi && <span style={s.aiBadge}>AI</span>}</>}
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

      {editingTree && (
        <div style={s.modalBg} onClick={() => setEditingTree(null)}>
          <form style={{ ...s.modal, maxWidth: 560 }} onSubmit={saveTree} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.h2}>Edit AlgaeTree — {editingTree.treeId}</h2>
            <div style={s.treeImageEditor}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={editTreeImagePreview || "/Algaetree.png"} alt="AlgaeTree preview" style={s.treeImagePreview} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={s.fieldLabel}>Tree image</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setEditTreeImage(file);
                    if (file) setEditTreeImagePreview(URL.createObjectURL(file));
                  }}
                  style={s.fileInput}
                />
                <span style={s.muted}>PNG, JPEG, or WebP. Maximum 4 MB.</span>
              </div>
            </div>
            <input style={s.input} placeholder="Name" required value={editTreeName} onChange={(e) => setEditTreeName(e.target.value)} />
            <input style={s.input} placeholder="Location" value={editTreeLocation} onChange={(e) => setEditTreeLocation(e.target.value)} />
            <input style={s.input} placeholder="City" value={editTreeCity} onChange={(e) => setEditTreeCity(e.target.value)} />
            <div style={s.twoCols}>
              <input style={s.input} placeholder="Latitude" required value={editTreeLat} onChange={(e) => setEditTreeLat(e.target.value)} />
              <input style={s.input} placeholder="Longitude" required value={editTreeLng} onChange={(e) => setEditTreeLng(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button type="submit" style={s.primary} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
              <button type="button" style={s.smallBtn} onClick={() => setEditingTree(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* PIN setter modal */}
      {settingPinTree && (
        <div style={s.modalBg} onClick={() => setSettingPinTree(null)}>
          <form style={s.modal} onSubmit={savePin} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.h2}>Set Dashboard PIN — {settingPinTree.treeId}</h2>
            <p style={s.sub}>This PIN will be required to access the shared dashboard link.</p>
            <input
              style={s.input}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={12}
              placeholder="Enter 4–12 digit PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              autoFocus
              required
            />
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button type="submit" style={s.primary} disabled={busy || newPin.length < 4}>
                {busy ? "Saving…" : "Save PIN"}
              </button>
              <button type="button" style={s.smallBtn} disabled={busy} onClick={() => void removePin()}>
                Remove PIN
              </button>
              <button type="button" style={s.smallBtn} onClick={() => setSettingPinTree(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    height: "100dvh",
    background: "radial-gradient(1200px 600px at 15% -10%, rgba(34,197,94,0.10), transparent 55%), radial-gradient(1000px 500px at 100% 0%, rgba(56,189,248,0.07), transparent 50%), var(--bg)",
    color: "var(--text-1)",
    display: "grid",
    gridTemplateColumns: "260px minmax(0, 1fr)",
    overflow: "hidden",
  },
  sidebar: {
    height: "100dvh",
    background: "var(--surface)",
    borderRight: "1px solid var(--border)",
    padding: "20px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    overflow: "hidden",
  },
  nav: { display: "flex", flexDirection: "column", gap: 8 },
  navItem: {
    width: "100%",
    border: "1px solid transparent",
    borderRadius: 10,
    background: "transparent",
    color: "var(--text-2)",
    padding: "10px 12px",
    textAlign: "left",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background .15s, color .15s",
  },
  navItemActive: {
    background: "rgba(34,197,94,0.13)",
    borderColor: "rgba(34,197,94,0.24)",
    color: "#16a34a",
  },
  sidebarActions: { marginTop: "auto", display: "grid", gap: 8, paddingTop: 12, borderTop: "1px solid var(--border)" },
  main: { minWidth: 0, display: "flex", flexDirection: "column", gap: 0, overflow: "hidden", padding: "20px 24px 20px 24px" },
  pageTitle: { margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text-1)", letterSpacing: -0.2 },
  dashboardGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, flexShrink: 0 },
  metricCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: "16px 18px",
    minHeight: 96,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  metricValue: { fontSize: 30, fontWeight: 800, color: "var(--text-1)" },
  wideCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflow: "hidden",
    minHeight: 0,
  },
  registryLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 380px) minmax(0, 1fr)",
    gap: 16,
    alignItems: "start",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  formWide: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, alignContent: "start" },
  twoCols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  scrollListLarge: { display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 },
  treeListLarge: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 360, overflowY: "auto", padding: 10, background: "var(--surface-hover)", borderRadius: 12, border: "1px solid var(--border)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12, flexShrink: 0 },
  headerActions: { display: "flex", alignItems: "center", gap: 10 },
  h1: { margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: -0.3, color: "var(--text-1)", lineHeight: 1.2 },
  sub: { margin: "2px 0 0", color: "var(--text-2)", fontSize: 12, overflowWrap: "break-word", wordBreak: "break-word" },
  backLink: { textDecoration: "none", color: "var(--text-1)", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, textAlign: "center" as const },
  logout: { background: "var(--surface-hover)", color: "var(--text-1)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontWeight: 600, fontSize: 12 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 18, alignItems: "start" },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 16px 40px -28px rgba(0,0,0,0.45)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxHeight: "calc(100vh - 160px)",
    overflow: "hidden",
  },
  h2: { margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "var(--text-1)", flexShrink: 0 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  fieldLabel: { display: "block", fontSize: 12, color: "var(--text-2)", fontWeight: 600, marginBottom: 6 },
  input: {
    background: "var(--surface-hover)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "10px 12px",
    color: "var(--text-1)",
    fontSize: 13,
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
  checkBoxOn: { background: "linear-gradient(135deg,#22c55e,#16a34a)", borderWidth: "1.5px", borderStyle: "solid", borderColor: "#22c55e" },
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
  aiBadge: {
    display: "inline-flex",
    alignItems: "center",
    marginLeft: 5,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 0.5,
    background: "linear-gradient(135deg,#818cf8,#6366f1)",
    color: "#fff",
    borderRadius: 4,
    padding: "1px 6px",
    verticalAlign: "middle",
    lineHeight: 1.3,
  },
  primary: { background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#04140a", fontWeight: 700, border: "none", borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontSize: 13, flexShrink: 0 },
  userList: { display: "flex", flexDirection: "column", gap: 8 },
  scrollList: { display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto", paddingRight: 4 },
  userRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 10, gap: 12 },
  treeRegistryRow: { display: "flex", alignItems: "center", gap: 12, minWidth: 0 },
  treeThumb: { width: 40, height: 48, objectFit: "contain", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", flexShrink: 0 },
  treeImageEditor: { display: "grid", gridTemplateColumns: "130px minmax(0, 1fr)", gap: 18, alignItems: "center", padding: 14, border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface-hover)" },
  treeImagePreview: { width: 130, height: 150, objectFit: "contain", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" },
  fileInput: { width: "100%", color: "var(--text-2)", fontSize: 12 },
  userEmail: { fontSize: 14, fontWeight: 600, color: "var(--text-1)" },
  userMeta: { display: "flex", gap: 8, alignItems: "center", marginTop: 4, fontSize: 12 },
  badge: { background: "rgba(34,197,94,0.16)", color: "#15803d", borderRadius: 5, padding: "2px 7px", fontSize: 10, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap" as const },
  userActions: { display: "flex", gap: 6 },
  smallBtn: { background: "var(--surface-hover)", color: "var(--text-1)", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" as const },
  toast: { padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13, fontWeight: 600, flexShrink: 0 },
  toastOk: { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#15803d" },
  toastErr: { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#dc2626" },
  modalBg: { position: "fixed", inset: 0, background: "rgba(2,6,23,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 },
  modal: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 22, width: "100%", maxWidth: 440, boxShadow: "0 30px 70px -32px rgba(0,0,0,0.5)" },
};
