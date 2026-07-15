"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

interface Tree {
  treeId: string;
  name: string;
  location: string;
  city?: string;
  lat: number;
  lng: number;
  online: boolean;
  lastOnline?: string;
  isAi?: boolean;
  imageUrl: string;
}

const ALL_CITIES = "__all__";
const UNLISTED = "__unlisted__";
type StatusFilter = "all" | "online" | "offline";

function hasLocation(t: Tree): boolean {
  return !!(t.city?.trim() || t.location?.trim());
}

function cityOf(t: Tree): string {
  if (!hasLocation(t)) return UNLISTED;
  return (t.city && t.city.trim()) || (t.location && t.location.trim()) || UNLISTED;
}

function cityLabel(c: string): string {
  return c === UNLISTED ? "Unlisted" : c;
}

function reconcileTrees(current: Tree[], incoming: Tree[]): Tree[] {
  const incomingIds = new Set(incoming.map((t) => t.treeId));
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
  if (!changed && current.some((t) => !incomingIds.has(t.treeId))) changed = true;
  return changed ? next : current;
}

export default function TreeGrid() {
  const router = useRouter();
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [city, setCity] = useState<string>(ALL_CITIES);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [aiOnly, setAiOnly] = useState(false);
  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const cityMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    const loadTrees = async (initial = false) => {
      try {
        const res = await fetch("/api/algaetrees", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        if (active) {
          setTrees((current) => reconcileTrees(current, data.trees ?? []));
          setError("");
        }
      } catch {
        if (active && initial) setError("Could not load AlgaeTrees.");
      } finally {
        if (active && initial) setLoading(false);
      }
    };
    void loadTrees(true);
    const refreshId = setInterval(() => void loadTrees(), 10000);
    return () => {
      active = false;
      clearInterval(refreshId);
    };
  }, []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!cityMenuRef.current?.contains(e.target as Node)) setCityMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // City -> count (excluding Unlisted), sorted by count desc.
  const cityCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of trees) {
      const c = cityOf(t);
      if (c === UNLISTED) continue;
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [trees]);

  const unlistedCount = useMemo(
    () => trees.filter((t) => !hasLocation(t)).length,
    [trees],
  );

  const cityOptions = useMemo(() => {
    const options = [
      { value: ALL_CITIES, label: "All cities", count: trees.length },
      ...cityCounts.map(([value, count]) => ({ value, label: cityLabel(value), count })),
    ];
    if (unlistedCount > 0) options.push({ value: UNLISTED, label: "Unlisted", count: unlistedCount });
    return options;
  }, [cityCounts, trees.length, unlistedCount]);

  const filteredCityOptions = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return cityOptions;
    return cityOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [cityOptions, cityQuery]);

  const effectiveCity = cityOptions.some((o) => o.value === city) ? city : ALL_CITIES;
  const selectedCity = cityOptions.find((o) => o.value === effectiveCity) ?? cityOptions[0];
  const onlineCount = useMemo(() => trees.filter((t) => t.online).length, [trees]);
  const offlineCount = trees.length - onlineCount;

  const aiCount = useMemo(() => trees.filter((t) => t.isAi).length, [trees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trees.filter((t) => {
      const matchCity =
        effectiveCity === ALL_CITIES ||
        (effectiveCity === UNLISTED ? !hasLocation(t) : cityOf(t) === effectiveCity);
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "online" ? t.online : !t.online);
      const matchAi = !aiOnly || t.isAi;
      const matchQuery =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.treeId.toLowerCase().includes(q) ||
        (t.location ?? "").toLowerCase().includes(q);
      return matchCity && matchStatus && matchAi && matchQuery;
    });
  }, [trees, effectiveCity, statusFilter, aiOnly, query]);

  return (
    <main style={s.wrap}>
      {/* Filter bar */}
      <div style={s.toolbar}>
        <div style={s.filterControls}>
          <div ref={cityMenuRef} style={s.cityFilter}>
            <button
              type="button"
              onClick={() => {
                setCityMenuOpen((open) => !open);
                setCityQuery("");
              }}
              style={s.cityTrigger}
              aria-haspopup="listbox"
              aria-expanded={cityMenuOpen}
            >
              <span style={s.cityTriggerText}>
                <span style={s.cityTriggerLabel}>{selectedCity?.label ?? "All cities"}</span>
                <span style={s.cityTriggerMeta}>{selectedCity?.count ?? trees.length} AlgaeTrees</span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {cityMenuOpen && (
              <div style={s.cityMenu}>
                <div style={s.citySearchWrap}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                  </svg>
                  <input
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                    placeholder="Search cities"
                    style={s.citySearch}
                    autoFocus
                  />
                </div>
                <div role="listbox" aria-label="Cities" style={s.cityList}>
                  {filteredCityOptions.length === 0 ? (
                    <div style={s.cityEmpty}>No cities found</div>
                  ) : (
                    filteredCityOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setCity(option.value);
                          setCityMenuOpen(false);
                          setCityQuery("");
                        }}
                        role="option"
                        aria-selected={city === option.value}
                        style={{ ...s.cityOption, ...(city === option.value ? s.cityOptionActive : null) }}
                      >
                        <span>{option.label}</span>
                        <span style={s.cityCount}>{option.count}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={s.statusTabs} aria-label="Pod status filter">
            {[
              ["all", "All", trees.length],
              ["online", "Online", onlineCount],
              ["offline", "Offline", offlineCount],
            ].map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value as StatusFilter)}
                style={{ ...s.statusTab, ...(statusFilter === value ? s.statusTabActive : null) }}
                aria-pressed={statusFilter === value}
              >
                {label}
                <span style={s.statusTabCount}>{count}</span>
              </button>
            ))}
            <div style={s.aiToggleDivider} />
            <button
              type="button"
              onClick={() => setAiOnly((v) => !v)}
              style={{ ...s.aiToggle, ...(aiOnly ? s.aiToggleActive : null) }}
              aria-pressed={aiOnly}
              aria-label="Show AI pods only"
            >
              <span style={s.aiSwitchTrack}>
                <span style={{ ...s.aiSwitchThumb, ...(aiOnly ? s.aiSwitchThumbActive : null) }} />
              </span>
              AI Pods
              <span style={s.statusTabCount}>{aiCount}</span>
            </button>
          </div>

          <div style={s.searchWrap}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, ID or location"
              style={s.search}
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      {!loading && !error && (
        <p style={s.summary}>
          Showing <strong style={s.strong}>{filtered.length}</strong> of {trees.length} AlgaeTree
          {trees.length === 1 ? "" : "s"}
          {effectiveCity !== ALL_CITIES && (
            <>
              {" "}in <strong style={s.strong}>{cityLabel(effectiveCity)}</strong>
            </>
          )}
          {" · "}
          <strong style={s.strong}>{cityCounts.length}</strong> cit
          {cityCounts.length === 1 ? "y" : "ies"}
          {unlistedCount > 0 && (
            <>
              {" · "}
              <strong style={s.strong}>{unlistedCount}</strong> unlisted
            </>
          )}
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div style={s.state}>Loading AlgaeTrees…</div>
      ) : error ? (
        <div style={s.state}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={s.state}>No AlgaeTrees match your filters.</div>
      ) : (
        <div style={s.grid}>
          {filtered.map((t) => (
            <article
              key={t.treeId}
              style={s.card}
              role="link"
              tabIndex={0}
              aria-label={`Open dashboard for ${t.name}`}
              onClick={() => router.push(`/dashboard?tree=${encodeURIComponent(t.treeId)}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/dashboard?tree=${encodeURIComponent(t.treeId)}`);
                }
              }}
            >
              <div style={s.cardHero}>
                <div style={s.cardCopy}>
                  <span style={{ ...s.statusPill, ...(t.online ? null : s.statusPillOffline) }}>
                    <span style={{ ...s.statusDot, ...(t.online ? null : s.statusDotOffline) }} />
                    {t.online ? "Online" : "Offline"}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={s.name}>
                      {t.name}
                      {t.isAi && <span style={s.aiBadge}>AI</span>}
                    </h3>
                    <span style={s.id}>{t.treeId}</span>
                  </div>
                </div>

                <div style={s.podFrame}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.imageUrl || "/Algaetree.png"} alt="" style={s.podImage} />
                </div>
              </div>

              <div style={s.rows}>
                <Row label="City" value={cityLabel(cityOf(t))} />
                <Row label="Location" value={t.location || "—"} />
                <Row
                  label="Coordinates"
                  value={
                    t.lat || t.lng
                      ? `${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}`
                      : "—"
                  }
                />
              </div>

              {t.lat || t.lng ? (
                <a
                  href={`https://www.google.com/maps?q=${t.lat},${t.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={s.mapLink}
                >
                  View on map
                </a>
              ) : (
                <span style={{ ...s.mapLink, opacity: 0.35, cursor: "default" }}>
                  No location set
                </span>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={s.rowValue} title={value}>
        {value}
      </span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    width: "100%",
    maxWidth: 1760,
    margin: "0 auto",
    padding: "132px clamp(20px, 3vw, 48px) 56px",
  },
  toolbar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 24,
  },
  filterControls: {
    display: "flex",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 14,
    width: "100%",
    minWidth: 0,
  },
  cityFilter: { position: "relative", flex: "0 0 380px", minWidth: 260 },
  cityTrigger: {
    width: "100%",
    minHeight: 54,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text-1)",
    borderRadius: 18,
    padding: "10px 16px",
    cursor: "pointer",
    textAlign: "left",
  },
  cityTriggerText: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  cityTriggerLabel: {
    fontSize: 14.5,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cityTriggerMeta: { fontSize: 12.5, fontWeight: 600, color: "var(--text-2)" },
  cityMenu: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    zIndex: 20,
    width: "100%",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 18,
    padding: 10,
    boxShadow: "0 18px 42px rgba(0,0,0,0.18)",
  },
  citySearchWrap: {
    minHeight: 42,
    display: "flex",
    alignItems: "center",
    gap: 9,
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: "0 12px",
    marginBottom: 8,
  },
  citySearch: {
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-1)",
    fontSize: 14,
  },
  cityList: { maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 },
  cityOption: {
    width: "100%",
    minHeight: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    border: "none",
    borderRadius: 12,
    background: "transparent",
    color: "var(--text-1)",
    padding: "8px 10px",
    fontSize: 14,
    fontWeight: 650,
    cursor: "pointer",
    textAlign: "left",
  },
  cityOptionActive: { background: "rgba(34,197,94,0.16)", color: "#22c55e" },
  cityCount: {
    minWidth: 26,
    borderRadius: 999,
    padding: "2px 8px",
    background: "var(--track-strong)",
    color: "var(--text-2)",
    textAlign: "center",
    fontSize: 12,
    fontWeight: 800,
  },
  cityEmpty: { padding: "18px 10px", color: "var(--text-2)", fontSize: 13.5, textAlign: "center" },
  statusTabs: {
    height: 54,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    border: "1px solid var(--border)",
    borderRadius: 18,
    padding: 4,
    background: "var(--surface)",
    flex: "0 0 auto",
  },
  statusTab: {
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "none",
    borderRadius: 14,
    padding: "8px 13px",
    background: "transparent",
    color: "var(--text-2)",
    fontSize: 13.5,
    fontWeight: 800,
    cursor: "pointer",
  },
  statusTabActive: {
    background: "rgba(34,197,94,0.14)",
    color: "#22c55e",
  },
  statusTabCount: {
    minWidth: 23,
    borderRadius: 999,
    padding: "1px 7px",
    background: "rgba(0,0,0,0.16)",
    color: "currentColor",
    textAlign: "center",
    fontSize: 12,
    fontWeight: 900,
  },
  aiToggleDivider: {
    width: 1,
    height: 24,
    background: "var(--border)",
    margin: "0 4px",
    alignSelf: "center",
  },
  aiToggle: {
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    gap: 9,
    border: "none",
    borderRadius: 14,
    padding: "8px 12px",
    background: "transparent",
    color: "var(--text-2)",
    fontSize: 13.5,
    fontWeight: 800,
    cursor: "pointer",
  },
  aiToggleActive: {
    background: "rgba(99,102,241,0.16)",
    color: "#818cf8",
  },
  aiSwitchTrack: {
    width: 34,
    height: 20,
    borderRadius: 999,
    padding: 2,
    background: "var(--track-strong)",
    border: "1px solid var(--border)",
    display: "inline-flex",
    alignItems: "center",
  },
  aiSwitchThumb: {
    width: 14,
    height: 14,
    borderRadius: 999,
    background: "var(--text-3)",
    transition: "transform 160ms ease, background 160ms ease",
  },
  aiSwitchThumbActive: {
    transform: "translateX(14px)",
    background: "#818cf8",
  },
  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 18,
    padding: "0 18px",
    flex: "1 1 360px",
    minWidth: 280,
    height: 54,
  },
  search: {
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-1)",
    fontSize: 14.5,
    width: "100%",
  },
  summary: { color: "var(--text-2)", fontSize: 14, margin: "0 0 24px" },
  strong: { color: "var(--text-1)", fontWeight: 700 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 20,
    alignItems: "stretch",
  },
  card: {
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(145deg, rgba(34,197,94,0.10), transparent 42%), var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 20,
    padding: 22,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minHeight: 288,
    cursor: "pointer",
  },
  cardHero: {
    minHeight: 130,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 106px",
    alignItems: "center",
    gap: 16,
    paddingBottom: 14,
    borderBottom: "1px solid var(--row-divider)",
  },
  cardCopy: { minWidth: 0, display: "flex", flexDirection: "column", gap: 14 },
  statusPill: {
    width: "fit-content",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "6px 10px",
    background: "rgba(34,197,94,0.12)",
    color: "#22c55e",
    fontSize: 11.5,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  statusPillOffline: {
    background: "rgba(249,115,22,0.12)",
    color: "#f97316",
  },
  aiBadge: {
    display: "inline-flex",
    alignItems: "center",
    marginLeft: 8,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.5,
    background: "linear-gradient(135deg,#818cf8,#6366f1)",
    color: "#fff",
    borderRadius: 5,
    padding: "2px 7px",
    verticalAlign: "middle",
    lineHeight: 1.3,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: "#22c55e",
    boxShadow: "0 0 12px rgba(34,197,94,0.7)",
  },
  statusDotOffline: {
    background: "#f97316",
    boxShadow: "0 0 12px rgba(249,115,22,0.7)",
  },
  podFrame: {
    flex: "0 0 auto",
    width: 108,
    height: 136,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  podImage: {
    width: 72,
    height: 136,
    objectFit: "contain",
    filter: "drop-shadow(0 14px 18px rgba(34,197,94,0.22))",
  },
  name: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    color: "var(--text-1)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  id: { display: "inline-block", marginTop: 5, fontSize: 13.5, color: "#22c55e", fontWeight: 700, letterSpacing: 0.3 },
  rows: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    border: "1px solid var(--row-divider)",
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 12px",
    borderBottom: "1px solid var(--row-divider)",
  },
  rowLabel: { fontSize: 13.5, color: "var(--text-2)" },
  rowValue: {
    fontSize: 13.5,
    color: "var(--text-1)",
    fontWeight: 600,
    maxWidth: "62%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    textAlign: "right",
  },
  mapLink: {
    marginTop: "auto",
    alignSelf: "flex-start",
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(34,197,94,0.12)",
    fontSize: 13.5,
    fontWeight: 800,
    color: "#22c55e",
    textDecoration: "none",
  },
  state: {
    padding: "60px 0",
    textAlign: "center",
    color: "var(--text-2)",
    fontSize: 14,
  },
};
