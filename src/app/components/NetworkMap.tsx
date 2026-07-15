"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import TreeSelect from "./TreeSelect";

type MapTree = {
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
};

const COUNTRY_GEOJSON_URLS = {
  India: "https://raw.githubusercontent.com/datameet/maps/master/Country/india-composite.geojson",
  UAE: "https://raw.githubusercontent.com/mledoze/countries/master/data/are.geo.json",
} as const;

type PodPopupData = {
  location: string;
  treeId: string;
  online: boolean;
  statusTitle: string;
  lastOnline: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPodPopupData(tree: MapTree): PodPopupData {
  return {
    location: tree.location || tree.city || tree.name || tree.treeId,
    treeId: tree.treeId,
    online: tree.online,
    statusTitle: tree.online ? "Online" : "Offline",
    lastOnline: tree.lastOnline || "--",
  };
}

function buildPopupHtml(pod: PodPopupData): string {
  const statusColor = pod.online ? "#4ade80" : "#f97316";

  return `
    <div class="pod-card">
      <div class="pod-header">
        <div class="pod-title-wrap">
          <span class="pod-title">${escapeHtml(pod.location)}</span>
          <span class="pod-subtitle">${escapeHtml(pod.treeId)} • Live Tree</span>
        </div>
        <span class="pod-status" title="${escapeHtml(pod.statusTitle)}" style="background:${statusColor}"></span>
      </div>
      <div class="pod-stats">
        <div class="pod-stat"><span class="stat-label">Status</span><span class="stat-value" style="color:${statusColor}">${escapeHtml(pod.statusTitle)}</span></div>
        <div class="pod-stat"><span class="stat-label">Last Online</span><span class="stat-value">${escapeHtml(pod.lastOnline)}</span></div>
      </div>
      <button class="pod-action" data-tree="${escapeHtml(pod.treeId)}" type="button">View Dashboard →</button>
    </div>
  `;
}

function buildTreeMarkerIcon(imageUrl: string): L.DivIcon {
  return L.divIcon({
    className: "custom-marker-container",
    html: `
      <div class="marker-pulse"></div>
      <img src="${escapeHtml(imageUrl || "/Algaetree.png")}" class="custom-marker-icon" style="width:40px;height:40px;object-fit:contain;" alt="" />
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
}

function reconcileTrees(current: MapTree[], incoming: MapTree[]): MapTree[] {
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

const MAP_ASSET_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CachedMapAsset = {
  timestamp: number;
  data: unknown;
};

function getMapAssetCacheKey(url: string): string {
  return `map-asset-cache:${url}`;
}

function readCachedMapAsset(url: string): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getMapAssetCacheKey(url));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedMapAsset;
    if (!parsed?.timestamp || !parsed?.data) return null;
    if (Date.now() - parsed.timestamp > MAP_ASSET_TTL_MS) {
      localStorage.removeItem(getMapAssetCacheKey(url));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCachedMapAsset(url: string, data: unknown): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedMapAsset = { timestamp: Date.now(), data };
    localStorage.setItem(getMapAssetCacheKey(url), JSON.stringify(payload));
  } catch {
    // Ignore quota and serialization failures; network fetch still works.
  }
}

export default function NetworkMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const flyToTreeRef = useRef<
    ((t: { treeId: string; lat: number; lng: number }) => void) | null
  >(null);
  const [assignedTrees, setAssignedTrees] = useState<MapTree[]>([]);
  const [treesLoaded, setTreesLoaded] = useState(false);
  const [selectedTreeId, setSelectedTreeId] = useState("");

  // Fetch the AlgaeTrees assigned to the logged-in user for the dropdown.
  useEffect(() => {
    let active = true;
    const loadTrees = async () => {
      try {
        const res = await fetch("/api/algaetrees", { cache: "no-store" });
        if (!res.ok || !active) return;
        const data = await res.json();
        const allTrees = (data.trees ?? []) as {
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
        }[];
        // Only show trees with valid coordinates on the map dropdown.
        const mapped = allTrees.filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lng) && (t.lat || t.lng));
        if (active) setAssignedTrees((current) => reconcileTrees(current, mapped));
      } catch {
        // Dropdown stays empty on failure; map still works.
      } finally {
        if (active) setTreesLoaded(true);
      }
    };
    void loadTrees();
    const refreshId = setInterval(() => void loadTrees(), 10000);
    return () => {
      active = false;
      clearInterval(refreshId);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [22.5937, 78.9629],
      zoom: 5,
      minZoom: 4,
      maxZoom: 20,
      zoomAnimation: true,
      zoomAnimationThreshold: 20,
      zoomControl: false,
      attributionControl: false,
      wheelPxPerZoomLevel: 80,
    });

    mapRef.current = map;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // CARTO basemaps support up to z=20 with the @2x retina suffix `{r}`.
    const DARK_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    const LIGHT_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    const SATELLITE_URL =
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    const SATELLITE_LABELS_URL =
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png";

    // Zoom threshold above which satellite imagery takes over.
    const SAT_ZOOM_THRESHOLD = 12;

    const getTheme = (): "light" | "dark" =>
      (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light";

    const tileOpts: L.TileLayerOptions = {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
      maxNativeZoom: 19,
    };

    let tileLayer = L.tileLayer(
      getTheme() === "light" ? LIGHT_URL : DARK_URL,
      tileOpts
    ).addTo(map);

    // Preloaded satellite layer (added but kept hidden until threshold crossed).
    const satelliteLayer = L.tileLayer(SATELLITE_URL, {
      attribution:
        "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      maxZoom: 20,
      maxNativeZoom: 19,
      opacity: 0,
      className: "fade-tile-layer",
    }).addTo(map);

    const satelliteLabels = L.tileLayer(SATELLITE_LABELS_URL, {
      attribution: "",
      subdomains: "abcd",
      maxZoom: 20,
      maxNativeZoom: 19,
      opacity: 0,
      pane: "shadowPane",
      className: "fade-tile-layer",
    }).addTo(map);

    // Tag the base tile container too so its opacity transitions smoothly.
    tileLayer.getContainer()?.classList.add("fade-tile-layer");

    let satActive = false;
    const updateLayerByZoom = () => {
      const z = map.getZoom();
      const shouldSat = z >= SAT_ZOOM_THRESHOLD;
      if (shouldSat === satActive) return;
      satActive = shouldSat;
      if (shouldSat) {
        satelliteLayer.setOpacity(1);
        satelliteLabels.setOpacity(1);
        tileLayer.setOpacity(0);
      } else {
        satelliteLayer.setOpacity(0);
        satelliteLabels.setOpacity(0);
        tileLayer.setOpacity(1);
      }
    };
    map.on("zoomend", updateLayerByZoom);
    updateLayerByZoom();

    const swapTiles = () => {
      const next = getTheme() === "light" ? LIGHT_URL : DARK_URL;
      const wasOpacity = satActive ? 0 : 1;
      map.removeLayer(tileLayer);
      tileLayer = L.tileLayer(next, { ...tileOpts, opacity: wasOpacity }).addTo(map);
      tileLayer.getContainer()?.classList.add("fade-tile-layer");
      // keep satellite stacked above base
      satelliteLayer.bringToFront();
      satelliteLabels.bringToFront();
    };

    const themeObserver = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.attributeName === "data-theme") {
          swapTiles();
          break;
        }
      }
    });
    themeObserver.observe(document.documentElement, { attributes: true });

    // Highlighted-country outlines. Bounds are aggregated for dynamic centering.
    const highlightedBounds = L.latLngBounds([]);
    let initialFitDone = false;
    let cancelled = false;
    const abortController = new AbortController();

    const fitToHighlights = (animate = true) => {
      if (cancelled) return;
      if (highlightedBounds.isValid()) {
        map.fitBounds(highlightedBounds, {
          padding: [60, 60],
          animate,
          maxZoom: 6,
        });
      }
    };

    const addCountryOutline = (url: string) => {
      const renderOutline = (data: unknown) => {
        // The component may have unmounted while the fetch was in flight; if so the map's
        // container has been torn down and Leaflet's `addTo` would crash on `appendChild`.
        if (cancelled) return;
        const layer = L.geoJSON(data as GeoJSON.GeoJsonObject, {
          style: {
            color: "#22c55e",
            weight: 2,
            opacity: 0.8,
            fillColor: "#22c55e",
            fillOpacity: 0.05,
          },
        }).addTo(map);
        highlightedBounds.extend(layer.getBounds());
        if (!initialFitDone) {
          initialFitDone = true;
          fitToHighlights(false);
        } else {
          fitToHighlights(true);
        }
      };

      const cached = readCachedMapAsset(url);
      if (cached) {
        renderOutline(cached);
        return;
      }

      fetch(url, { signal: abortController.signal })
        .then((r) => r.json())
        .then((data) => {
          writeCachedMapAsset(url, data);
          renderOutline(data);
        })
        .catch((err) => {
          if ((err as Error)?.name === "AbortError") return;
          console.error("GeoJSON load failed:", err);
        });
    };

    addCountryOutline(COUNTRY_GEOJSON_URLS.India);
    addCountryOutline(COUNTRY_GEOJSON_URLS.UAE);

    // Recenter custom control — fits the map to highlighted countries.
    const RecenterControl = L.Control.extend({
      options: { position: "bottomright" as L.ControlPosition },
      onAdd: () => {
        const btn = L.DomUtil.create("button", "leaflet-bar map-recenter-btn");
        btn.type = "button";
        btn.title = "Recenter";
        btn.setAttribute("aria-label", "Recenter map");
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
          </svg>
        `;
        L.DomEvent.disableClickPropagation(btn);
        L.DomEvent.on(btn, "click", (e) => {
          L.DomEvent.stop(e);
          fitToHighlights(true);
        });
        return btn;
      },
    });
    map.addControl(new RecenterControl());

    let zoomSequenceId = 0;

    const runSequentialZoom = (lat: number, lng: number, onDone: () => void) => {
      zoomSequenceId += 1;
      const currentSequence = zoomSequenceId;

      const currentZoom = map.getZoom();
      const steps = [
        Math.min(12, Math.max(currentZoom + 3, 10)),
        16,
        20,
      ];

      const nextStep = (index: number) => {
        if (currentSequence !== zoomSequenceId) return;

        if (index >= steps.length) {
          onDone();
          return;
        }

        map.flyTo([lat, lng], steps[index], {
          animate: true,
          duration: index === steps.length - 1 ? 0.38 : 0.3,
          easeLinearity: 0.35,
          noMoveStart: true,
        });

        const handleMoveEnd = () => {
          map.off("moveend", handleMoveEnd);
          if (currentSequence !== zoomSequenceId) return;
          nextStep(index + 1);
        };

        map.on("moveend", handleMoveEnd);
      };

      nextStep(0);
    };

    const handleContainerClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest(".pod-action") as HTMLButtonElement | null;
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      const treeId = button.getAttribute("data-tree");
      if (treeId) window.location.href = `/dashboard?tree=${encodeURIComponent(treeId)}`;
    };

    // Allow the dropdown (rendered outside this effect) to drive the map.
    flyToTreeRef.current = (t) => {
      map.closePopup();
      const marker = markersRef.current[t.treeId];
      const currentZoom = map.getZoom();
      if (currentZoom >= 16) {
        map.flyTo([t.lat, t.lng], currentZoom, {
          animate: true,
          duration: 0.45,
          easeLinearity: 0.35,
          noMoveStart: true,
        });
        const handleMoveEnd = () => {
          map.off("moveend", handleMoveEnd);
          marker?.openPopup();
        };
        map.on("moveend", handleMoveEnd);
        return;
      }
      runSequentialZoom(t.lat, t.lng, () => marker?.openPopup());
    };

    containerRef.current.addEventListener("click", handleContainerClick);

    return () => {
      cancelled = true;
      abortController.abort();
      themeObserver.disconnect();
      map.off("zoomend", updateLayerByZoom);
      containerRef.current?.removeEventListener("click", handleContainerClick);
      markersRef.current = {};
      flyToTreeRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // Draw markers dynamically from DB-backed tree metadata.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !treesLoaded) return;

    const currentIds = new Set(assignedTrees.map((t) => t.treeId));
    Object.entries(markersRef.current).forEach(([treeId, marker]) => {
      if (!currentIds.has(treeId)) {
        map.removeLayer(marker);
        delete markersRef.current[treeId];
      }
    });

    const bounds = L.latLngBounds([]);
    assignedTrees.forEach((tree) => {
      bounds.extend([tree.lat, tree.lng]);
      const popup = buildPopupHtml(buildPodPopupData(tree));
      const icon = buildTreeMarkerIcon(tree.imageUrl);
      let marker = markersRef.current[tree.treeId];
      if (!marker) {
        marker = L.marker([tree.lat, tree.lng], { icon }).addTo(map);
        marker.bindPopup(popup, { closeButton: false, offset: [0, -10] });
        marker.on("click", () => {
          const activeMarker = markersRef.current[tree.treeId];
          if (!activeMarker) return;
          map.closePopup();
          const currentZoom = map.getZoom();
          map.flyTo([tree.lat, tree.lng], Math.max(currentZoom, 16), {
            animate: true,
            duration: 0.45,
            easeLinearity: 0.35,
            noMoveStart: true,
          });
          const handleMoveEnd = () => {
            map.off("moveend", handleMoveEnd);
            activeMarker.openPopup();
          };
          map.on("moveend", handleMoveEnd);
        });
        markersRef.current[tree.treeId] = marker;
      } else {
        marker.setLatLng([tree.lat, tree.lng]);
        marker.setIcon(icon);
        marker.setPopupContent(popup);
        if (!map.hasLayer(marker)) marker.addTo(map);
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [90, 90], animate: true, maxZoom: 7 });
    }
  }, [assignedTrees, treesLoaded]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {assignedTrees.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1200,
          }}
        >
          <TreeSelect
            options={assignedTrees}
            value={selectedTreeId}
            onChange={(id) => {
              setSelectedTreeId(id);
              const t = assignedTrees.find((x) => x.treeId === id);
              if (t) flyToTreeRef.current?.(t);
            }}
          />
        </div>
      )}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
