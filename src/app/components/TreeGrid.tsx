"use client";

import { useEffect, useMemo, useState } from "react";

interface Tree {
  treeId: string;
  name: string;
  location: string;
  city?: string;
  lat: number;
  lng: number;
}

const ALL_CITIES = "__all__";

function cityOf(t: Tree): string {
  return (t.city && t.city.trim()) || (t.location && t.location.trim()) || "Unknown";
}

export default function TreeGrid() {
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [city, setCity] = useState<string>(ALL_CITIES);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/algaetrees", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        if (active) setTrees(data.trees ?? []);
      } catch {
        if (active) setError("Could not load AlgaeTrees.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // City -> count, sorted by count desc.
  const cityCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of trees) {
      const c = cityOf(t);
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [trees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trees.filter((t) => {
      const matchCity = city === ALL_CITIES || cityOf(t) === city;
      const matchQuery =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.treeId.toLowerCase().includes(q) ||
        (t.location ?? "").toLowerCase().includes(q);
      return matchCity && matchQuery;
    });
  }, [trees, city, query]);

  return (
    <div style={s.wrap}>
      {/* Filter bar */}
      <div style={s.toolbar}>
        <div style={s.cityChips}>
          <button
            type="button"
            onClick={() => setCity(ALL_CITIES)}
            style={{ ...s.chip, ...(city === ALL_CITIES ? s.chipActive : null) }}
          >
            All cities
            <span style={s.chipCount}>{trees.length}</span>
          </button>
          {cityCounts.map(([c, n]) => (
            <button
              key={c}
              type="button"
              onClick={() => setCity(c)}
              style={{ ...s.chip, ...(city === c ? s.chipActive : null) }}
            >
              {c}
              <span style={s.chipCount}>{n}</span>
            </button>
          ))}
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

      {/* Summary */}
      {!loading && !error && (
        <p style={s.summary}>
          Showing <strong style={s.strong}>{filtered.length}</strong> of {trees.length} AlgaeTree
          {trees.length === 1 ? "" : "s"}
          {city !== ALL_CITIES && (
            <>
              {" "}in <strong style={s.strong}>{city}</strong>
            </>
          )}
          {" · "}
          <strong style={s.strong}>{cityCounts.length}</strong> cit
          {cityCounts.length === 1 ? "y" : "ies"}
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
            <article key={t.treeId} style={s.card}>
              <div style={s.cardTop}>
                <span style={s.leaf}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 21c5-2 8-6 8-11V5l-8-2-8 2v5c0 5 3 9 8 11Z" fill="#22c55e" opacity="0.9" />
                    <path d="M12 7v9M9 10c1.5 0 3 .8 3 3M15 10c-1.5 0-3 .8-3 3" stroke="#04140a" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </span>
                <div style={{ minWidth: 0 }}>
                  <h3 style={s.name}>{t.name}</h3>
                  <span style={s.id}>{t.treeId}</span>
                </div>
              </div>

              <div style={s.rows}>
                <Row label="City" value={cityOf(t)} />
                <Row label="Location" value={t.location || "—"} />
                <Row label="Coordinates" value={`${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}`} />
              </div>

              <a
                href={`https://www.google.com/maps?q=${t.lat},${t.lng}`}
                target="_blank"
                rel="noreferrer"
                style={s.mapLink}
              >
                View on map ↗
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
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
  wrap: { padding: "96px 24px 48px", maxWidth: 1200, margin: "0 auto" },
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
  },
  cityChips: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text-1)",
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  chipActive: {
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
    color: "#04140a",
    borderColor: "transparent",
  },
  chipCount: {
    background: "rgba(0,0,0,0.18)",
    borderRadius: 999,
    padding: "1px 8px",
    fontSize: 11,
    fontWeight: 700,
  },
  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "8px 14px",
    minWidth: 240,
  },
  search: {
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-1)",
    fontSize: 13.5,
    width: "100%",
  },
  summary: { color: "var(--text-2)", fontSize: 13, margin: "0 0 18px" },
  strong: { color: "var(--text-1)", fontWeight: 700 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 16,
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 18,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  cardTop: { display: "flex", alignItems: "center", gap: 12 },
  leaf: {
    flex: "0 0 auto",
    width: 38,
    height: 38,
    borderRadius: 11,
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.28)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    margin: 0,
    fontSize: 15.5,
    fontWeight: 700,
    color: "var(--text-1)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  id: { fontSize: 12, color: "#22c55e", fontWeight: 600, letterSpacing: 0.4 },
  rows: { display: "flex", flexDirection: "column", gap: 8 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowLabel: { fontSize: 12, color: "var(--text-2)" },
  rowValue: {
    fontSize: 12.5,
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
    fontSize: 12.5,
    fontWeight: 600,
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
