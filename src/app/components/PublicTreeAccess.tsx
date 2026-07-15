"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export default function PublicTreeAccess({
  treeId,
  accessKey,
  children,
}: {
  treeId: string;
  accessKey: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    const api = `/api/public-tree/${encodeURIComponent(treeId)}/${encodeURIComponent(accessKey)}`;
    void fetch(api, { cache: "no-store" }).then((res) => {
      if (!active) return;
      if (res.ok) {
        setAllowed(true);
      } else {
        router.replace(`/tree/${encodeURIComponent(treeId)}/${encodeURIComponent(accessKey)}`);
      }
    }).catch(() => {
      if (active) router.replace(`/tree/${encodeURIComponent(treeId)}/${encodeURIComponent(accessKey)}`);
    });
    return () => {
      active = false;
    };
  }, [accessKey, router, treeId]);

  if (!allowed) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text-2)", fontSize: 14 }}>
        Verifying dashboard access…
      </div>
    );
  }

  return children;
}
