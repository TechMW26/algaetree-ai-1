"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Pod = {
  id: number;
  lat: number;
  lng: number;
  location: string;
  efficiency: string;
  aqi: number;
  health: string;
  maintenance: string;
};

const PODS: Pod[] = [
  {
    id: 1,
    lat: 23.258690000000000,
    lng: 77.430980000000000,
    location: "Bhopal",
    efficiency: "98%",
    aqi: 88,
    health: "Optimal",
    maintenance: "12d",
  },
  {
    id: 2,
    lat: 23.258690000000000,
    lng: 77.431160000000000,
    location: "Bhopal",
    efficiency: "97%",
    aqi: 90,
    health: "Optimal",
    maintenance: "14d",
  },
];

// High-detail India boundary (datameet/maps) — follows official India border (incl. J&K, Ladakh).
const INDIA_GEOJSON_URL =
  "https://raw.githubusercontent.com/datameet/maps/master/Country/india-composite.geojson";

// High-detail UAE boundary (mledoze/countries — ~448 vertices, CORS-friendly via raw.githubusercontent.com).
const UAE_GEOJSON_URL =
  "https://raw.githubusercontent.com/mledoze/countries/master/data/are.geo.json";

export default function NetworkMap() {
  const containerRef = useRef<HTMLDivElement>(null);

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
      preferCanvas: false,
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
      fetch(url, { signal: abortController.signal })
        .then((r) => r.json())
        .then((data) => {
          // The component may have unmounted while the fetch was in flight; if so the map's
          // container has been torn down and Leaflet's `addTo` would crash on `appendChild`.
          if (cancelled) return;
          const layer = L.geoJSON(data, {
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
        })
        .catch((err) => {
          if ((err as Error)?.name === "AbortError") return;
          console.error("GeoJSON load failed:", err);
        });
    };

    addCountryOutline(INDIA_GEOJSON_URL);
    addCountryOutline(UAE_GEOJSON_URL);

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

      const aqiColor = pod.aqi > 100 ? "#f97316" : "#22c55e";
      const popupHtml = `
        <div class="pod-card">
          <div class="pod-header">
            <div class="pod-title-wrap">
              <span class="pod-title">${pod.location}</span>
              <span class="pod-subtitle">${pod.id === 1 ? "AT001" : "AT002"} • Live Tree</span>
            </div>
            <span class="pod-status" title="Online"></span>
          </div>
          <div class="pod-stats">
            <div class="pod-stat"><span class="stat-label">Efficiency</span><span class="stat-value" style="color:#22c55e">${pod.efficiency}</span></div>
            <div class="pod-stat"><span class="stat-label">AQI</span><span class="stat-value" style="color:${aqiColor}">${pod.aqi}</span></div>
            <div class="pod-stat"><span class="stat-label">Health</span><span class="stat-value">${pod.health}</span></div>
            <div class="pod-stat"><span class="stat-label">Next Maint.</span><span class="stat-value">${pod.maintenance}</span></div>
          </div>
          <button class="pod-action" data-pod="${pod.id}" type="button">View Dashboard →</button>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        closeButton: false,
        offset: [0, -10],
      });

      marker.on("click", () => {
        map.closePopup();
        runSequentialZoom(pod.lat, pod.lng, () => {
          marker.openPopup();
        });
      });
    });

    // Delegate click on the popup CTA
    map.on("popupopen", (e) => {
      const popupElement = (e.popup.getElement() as HTMLElement | null);
      if (!popupElement) return;
      
      const button = popupElement.querySelector(".pod-action") as HTMLButtonElement | null;
      if (!button) return;
      
      // Remove any existing listeners to prevent duplicates
      button.replaceWith(button.cloneNode(true));
      const newButton = popupElement.querySelector(".pod-action") as HTMLButtonElement | null;
      
      if (newButton) {
        newButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const id = newButton.getAttribute("data-pod");
          // Use full navigation here to avoid intermittent client-transition blank screens.
          window.location.href = `/dashboard?pod=${id ?? ""}`;
        });
      }
    });

    return () => {
      cancelled = true;
      abortController.abort();
      themeObserver.disconnect();
      map.off("zoomend", updateLayerByZoom);
      map.remove();
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
