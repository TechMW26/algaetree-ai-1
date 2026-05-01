"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLiveData, type LiveData } from "../hooks/useLiveData";

type Pod = {
  id: number;
  treeId: string;
  lat: number;
  lng: number;
  fallbackLocation: string;
  country: "India" | "UAE";
};

const COUNTRY_GEOJSON_URLS = {
  India: "https://raw.githubusercontent.com/datameet/maps/master/Country/india-composite.geojson",
  UAE: "https://raw.githubusercontent.com/mledoze/countries/master/data/are.geo.json",
} as const;

const PODS: Pod[] = [
  {
    id: 1,
    treeId: "AT00A0001",
    lat: 23.258690000000000,
    lng: 77.430980000000000,
    fallbackLocation: "Swami Vivekananda Theme Park",
    country: "India",
  },
  {
    id: 2,
    treeId: "AT00A0002",
    lat: 23.258690000000000,
    lng: 77.431160000000000,
    fallbackLocation: "Swami Vivekananda Theme Park",
    country: "India",
  },
];

type PodPopupData = {
  id: number;
  location: string;
  treeId: string;
  efficiencyText: string;
  aqiValue: number | null;
  healthText: string;
  maintenanceText: string;
  online: boolean;
  statusTitle: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getHealthText(data: LiveData): string {
  if (!data.networkUp) return "Offline";
  if (data.error || data.sensorHealth < 70) return "Attention";
  if (data.sensorHealth < 90) return "Stable";
  return "Optimal";
}

function buildPodPopupData(pod: Pod, data: LiveData): PodPopupData {
  const isLoading = data.location === "Loading..." && data.activeTreeId === pod.treeId;
  const hasRequestedTree = data.activeTreeId === pod.treeId;

  if (!hasRequestedTree && !isLoading) {
    return {
      id: pod.id,
      location: pod.fallbackLocation,
      treeId: pod.treeId,
      efficiencyText: "--",
      aqiValue: null,
      healthText: "No Data",
      maintenanceText: "--",
      online: false,
      statusTitle: "No live data",
    };
  }

  return {
    id: pod.id,
    location: data.location === "Loading..." ? pod.fallbackLocation : data.location,
    treeId: pod.treeId,
    efficiencyText: `${Math.max(0, Math.round(data.efficiency))}%`,
    aqiValue: Math.max(0, Math.round(data.aqi)),
    healthText: getHealthText(data),
    maintenanceText: `${Math.max(0, Math.round(data.maint))}d`,
    online: isLoading ? true : data.networkUp,
    statusTitle: isLoading ? "Loading live data" : data.networkUp ? "Online" : "Offline",
  };
}

function buildPopupHtml(pod: PodPopupData): string {
  const aqiColor = pod.aqiValue !== null && pod.aqiValue > 100 ? "#f97316" : "#22c55e";
  const statusColor = pod.online ? "#4ade80" : "#f97316";
  const aqiText = pod.aqiValue === null ? "--" : String(pod.aqiValue);

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
        <div class="pod-stat"><span class="stat-label">Efficiency</span><span class="stat-value" style="color:#22c55e">${pod.efficiencyText}</span></div>
        <div class="pod-stat"><span class="stat-label">AQI</span><span class="stat-value" style="color:${aqiColor}">${aqiText}</span></div>
        <div class="pod-stat"><span class="stat-label">Health</span><span class="stat-value">${escapeHtml(pod.healthText)}</span></div>
        <div class="pod-stat"><span class="stat-label">Next Maint.</span><span class="stat-value">${pod.maintenanceText}</span></div>
      </div>
      <button class="pod-action" data-pod="${pod.id}" type="button">View Dashboard →</button>
    </div>
  `;
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
  const markersRef = useRef<Record<number, L.Marker>>({});
  const treeOne = useLiveData("AT00A0001");
  const treeTwo = useLiveData("AT00A0002");
  const livePodDataRef = useRef<Record<number, PodPopupData>>({
    1: buildPodPopupData(PODS[0], treeOne),
    2: buildPodPopupData(PODS[1], treeTwo),
  });

  livePodDataRef.current = {
    1: buildPodPopupData(PODS[0], treeOne),
    2: buildPodPopupData(PODS[1], treeTwo),
  };

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
      preferCanvas: true,
      wheelPxPerZoomLevel: 80,
    });

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

    const countriesWithTrees = Array.from(new Set(PODS.map((pod) => pod.country)));
    countriesWithTrees.forEach((country) => {
      addCountryOutline(COUNTRY_GEOJSON_URLS[country]);
    });

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

    const algaeIcon = L.divIcon({
      className: "custom-marker-container",
      html: `
        <div class="marker-pulse"></div>
        <img src="/Ai Main_00.png" class="custom-marker-icon" style="width:40px;height:40px;object-fit:contain;" alt="" />
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20],
    });

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

    PODS.forEach((pod) => {
      const marker = L.marker([pod.lat, pod.lng], { icon: algaeIcon }).addTo(map);

      marker.bindPopup(buildPopupHtml(livePodDataRef.current[pod.id]), {
        closeButton: false,
        offset: [0, -10],
      });
      markersRef.current[pod.id] = marker;

      marker.on("click", () => {
        map.closePopup();
        const currentZoom = map.getZoom();

        // If already zoomed in, do not zoom out and back in.
        // Just glide to the new pod and keep current zoom level.
        if (currentZoom >= 16) {
          map.flyTo([pod.lat, pod.lng], currentZoom, {
            animate: true,
            duration: 0.45,
            easeLinearity: 0.35,
            noMoveStart: true,
          });

          const handleMoveEnd = () => {
            map.off("moveend", handleMoveEnd);
            marker.openPopup();
          };
          map.on("moveend", handleMoveEnd);
          return;
        }

        runSequentialZoom(pod.lat, pod.lng, () => {
          marker.openPopup();
        });
      });
    });

    const handleContainerClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest(".pod-action") as HTMLButtonElement | null;
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      const id = button.getAttribute("data-pod");
      window.location.href = `/dashboard?pod=${id ?? ""}`;
    };

    containerRef.current.addEventListener("click", handleContainerClick);

    return () => {
      cancelled = true;
      abortController.abort();
      themeObserver.disconnect();
      map.off("zoomend", updateLayerByZoom);
      containerRef.current?.removeEventListener("click", handleContainerClick);
      markersRef.current = {};
      map.remove();
    };
  }, []);

  useEffect(() => {
    Object.values(livePodDataRef.current).forEach((pod) => {
      const marker = markersRef.current[pod.id];
      if (!marker) return;
      marker.setPopupContent(buildPopupHtml(pod));
    });
  });

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
