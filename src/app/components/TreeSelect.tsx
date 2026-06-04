"use client";

import { useEffect, useRef, useState } from "react";

export interface TreeOption {
  treeId: string;
  name: string;
  lat: number;
  lng: number;
}

interface TreeSelectProps {
  options: TreeOption[];
  value: string;
  onChange: (treeId: string) => void;
  placeholder?: string;
}

/**
 * Custom, fully-styled AlgaeTree selector. Replaces the native <select> so it
 * matches the app theme and renders nicely over the Leaflet map.
 */
export default function TreeSelect({
  options,
  value,
  onChange,
  placeholder = "Select an AlgaeTree…",
}: TreeSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.treeId === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={s.root}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={s.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={s.leadingIcon} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v8" />
            <path d="M12 22v-6" />
            <path d="M12 10c-3 0-5-2-5-5 3 0 5 2 5 5Z" />
            <path d="M12 16c3 0 5-2 5-5-3 0-5 2-5 5Z" />
          </svg>
        </span>
        <span style={s.triggerText}>
          {selected ? (
            <>
              <span style={s.triggerName}>{selected.name}</span>
              <span style={s.triggerId}>{selected.treeId}</span>
            </>
          ) : (
            <span style={s.placeholder}>{placeholder}</span>
          )}
        </span>
        <span style={{ ...s.chevron, transform: open ? "rotate(180deg)" : "rotate(0deg)" }} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <ul style={s.menu} role="listbox">
          {options.length === 0 && <li style={s.empty}>No AlgaeTrees assigned</li>}
          {options.map((o) => {
            const isSel = o.treeId === value;
            return (
              <li key={o.treeId} role="option" aria-selected={isSel}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.treeId);
                    setOpen(false);
                  }}
                  style={{ ...s.item, ...(isSel ? s.itemActive : null) }}
                >
                  <span style={{ ...s.dot, background: isSel ? "#22c55e" : "rgba(148,163,184,0.5)" }} />
                  <span style={s.itemTextWrap}>
                    <span style={s.itemName}>{o.name}</span>
                    <span style={s.itemId}>{o.treeId}</span>
                  </span>
                  {isSel && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { position: "relative", width: 260, fontFamily: "inherit" },
  trigger: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "var(--surface, rgba(15,23,42,0.88))",
    border: "1px solid var(--border, rgba(148,163,184,0.25))",
    borderRadius: 16,
    padding: "10px 14px",
    cursor: "pointer",
    color: "var(--text-1, #f1f5f9)",
    boxShadow: "0 12px 34px rgba(0,0,0,0.35)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },
  leadingIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 8,
    background: "rgba(34,197,94,0.15)",
    color: "#22c55e",
    flexShrink: 0,
  },
  triggerText: { display: "flex", flexDirection: "column", flex: 1, textAlign: "left", lineHeight: 1.2, minWidth: 0 },
  triggerName: { fontSize: 14, fontWeight: 700, color: "var(--text-1, #f1f5f9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  triggerId: { fontSize: 11, color: "var(--text-3, #64748b)", fontWeight: 500 },
  placeholder: { fontSize: 14, fontWeight: 600, color: "var(--text-2, #94a3b8)" },
  chevron: { color: "var(--text-2, #94a3b8)", display: "flex", transition: "transform 0.2s ease", flexShrink: 0 },
  menu: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    right: 0,
    margin: 0,
    padding: 6,
    listStyle: "none",
    background: "var(--surface, rgba(15,23,42,0.96))",
    border: "1px solid var(--border, rgba(148,163,184,0.22))",
    borderRadius: 16,
    boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    maxHeight: 280,
    overflowY: "auto",
    zIndex: 1300,
  },
  empty: { padding: "10px 12px", fontSize: 13, color: "var(--text-3, #64748b)" },
  item: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "transparent",
    border: "none",
    borderRadius: 10,
    padding: "10px 12px",
    cursor: "pointer",
    color: "var(--text-1, #f1f5f9)",
    textAlign: "left",
  },
  itemActive: { background: "rgba(34,197,94,0.12)" },
  dot: { width: 8, height: 8, borderRadius: 999, flexShrink: 0 },
  itemTextWrap: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  itemId: { fontSize: 11, color: "var(--text-3, #64748b)" },
};
