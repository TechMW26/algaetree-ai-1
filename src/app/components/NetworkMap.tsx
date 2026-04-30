"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
  { id: 1, lat: 28.6139, lng: 77.2090, location: "New Delhi", efficiency: "98%", aqi: 158, health: "Optimal", maintenance: "14d" },
  { id: 2, lat: 19.0760, lng: 72.8777, location: "Mumbai", efficiency: "94%", aqi: 112, health: "Good", maintenance: "21d" },
  { id: 3, lat: 12.9716, lng: 77.5946, location: "Bangalore", efficiency: "99%", aqi: 45, health: "Excellent", maintenance: "28d" },
  { id: 4, lat: 22.5726, lng: 88.3639, location: "Kolkata", efficiency: "92%", aqi: 145, health: "Warning", maintenance: "3d" },
  { id: 5, lat: 13.0827, lng: 80.2707, location: "Chennai", efficiency: "96%", aqi: 65, health: "Good", maintenance: "18d" },
  { id: 6, lat: 26.9124, lng: 75.7873, location: "Jaipur", efficiency: "97%", aqi: 98, health: "Optimal", maintenance: "10d" },
  { id: 7, lat: 23.2576751, lng: 77.4251403, location: "Bhopal", efficiency: "96%", aqi: 88, health: "Optimal", maintenance: "12d" },
  { id: 8, lat: 17.3850, lng: 78.4867, location: "Hyderabad", efficiency: "95%", aqi: 82, health: "Good", maintenance: "16d" },
  { id: 9, lat: 18.5204, lng: 73.8567, location: "Pune", efficiency: "97%", aqi: 76, health: "Optimal", maintenance: "19d" },
  { id: 10, lat: 23.0225, lng: 72.5714, location: "Ahmedabad", efficiency: "93%", aqi: 124, health: "Warning", maintenance: "6d" },
  { id: 11, lat: 26.8467, lng: 80.9462, location: "Lucknow", efficiency: "94%", aqi: 168, health: "Warning", maintenance: "4d" },
  { id: 12, lat: 21.1458, lng: 79.0882, location: "Nagpur", efficiency: "96%", aqi: 92, health: "Good", maintenance: "15d" },
  { id: 13, lat: 25.5941, lng: 85.1376, location: "Patna", efficiency: "91%", aqi: 175, health: "Warning", maintenance: "2d" },
  { id: 14, lat: 30.7333, lng: 76.7794, location: "Chandigarh", efficiency: "98%", aqi: 102, health: "Optimal", maintenance: "22d" },
  { id: 15, lat: 8.5241, lng: 76.9366, location: "Thiruvananthapuram", efficiency: "99%", aqi: 38, health: "Excellent", maintenance: "30d" },
  { id: 16, lat: 26.1445, lng: 91.7362, location: "Guwahati", efficiency: "95%", aqi: 71, health: "Good", maintenance: "17d" },
  { id: 17, lat: 20.2961, lng: 85.8245, location: "Bhubaneswar", efficiency: "97%", aqi: 68, health: "Optimal", maintenance: "20d" },
  { id: 18, lat: 31.1048, lng: 77.1734, location: "Shimla", efficiency: "99%", aqi: 32, health: "Excellent", maintenance: "26d" },
  { id: 19, lat: 15.2993, lng: 74.1240, location: "Goa", efficiency: "98%", aqi: 48, health: "Excellent", maintenance: "24d" },
  { id: 20, lat: 34.0837, lng: 74.7973, location: "Srinagar", efficiency: "97%", aqi: 55, health: "Optimal", maintenance: "23d" },
  // Dubai (UAE)
  { id: 21, lat: 25.2048, lng: 55.2708, location: "Dubai — Downtown", efficiency: "98%", aqi: 84, health: "Optimal", maintenance: "19d" },
  { id: 22, lat: 25.1124, lng: 55.1390, location: "Dubai — Marina", efficiency: "97%", aqi: 78, health: "Optimal", maintenance: "21d" },
  { id: 23, lat: 25.2697, lng: 55.3094, location: "Dubai — Deira", efficiency: "95%", aqi: 96, health: "Good", maintenance: "14d" },
  { id: 24, lat: 25.0657, lng: 55.1713, location: "Dubai — Jebel Ali", efficiency: "94%", aqi: 108, health: "Good", maintenance: "11d" },
];

// High-detail India boundary (datameet/maps) — follows official India border (incl. J&K, Ladakh).
const INDIA_GEOJSON_URL =
  "https://raw.githubusercontent.com/datameet/maps/master/Country/india-composite.geojson";

// geoBoundaries gbOpen ADM0 metadata endpoint — returns JSON with `gjDownloadURL` to the
// high-resolution country boundary GeoJSON.
const GEO_BOUNDARIES_API = (iso3: string) =>
  `https://www.geoboundaries.org/api/current/gbOpen/${iso3}/ADM0/`;

export default function NetworkMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [22.5937, 78.9629],
      zoom: 5,
      minZoom: 4,
      maxZoom: 20,
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

    const fitToHighlights = (animate = true) => {
      if (highlightedBounds.isValid()) {
        map.fitBounds(highlightedBounds, {
          padding: [60, 60],
          animate,
          maxZoom: 6,
        });
      }
    };

    const addCountryOutline = (url: string) => {
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
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
        .catch((err) => console.error("GeoJSON load failed:", err));
    };

    // Resolve a geoBoundaries ISO3 code to its high-resolution GeoJSON URL, then add it.
    const addGeoBoundariesOutline = (iso3: string) => {
      fetch(GEO_BOUNDARIES_API(iso3))
        .then((r) => r.json())
        .then((meta) => {
          const url: string | undefined = meta?.gjDownloadURL;
          if (!url) throw new Error(`No gjDownloadURL for ${iso3}`);
          return addCountryOutline(url);
        })
        .catch((err) => console.error("geoBoundaries load failed:", iso3, err));
    };

    addCountryOutline(INDIA_GEOJSON_URL);
    addGeoBoundariesOutline("ARE");

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
        <img src="/Algaetree.png" class="custom-marker-icon" style="width:40px;height:40px;object-fit:contain;" alt="" />
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20],
    });

    PODS.forEach((pod) => {
      const marker = L.marker([pod.lat, pod.lng], { icon: algaeIcon }).addTo(map);

      const aqiColor = pod.aqi > 100 ? "#f97316" : "#22c55e";
      const popupHtml = `
        <div class="pod-card">
          <div class="pod-header">
            <div class="pod-title-wrap">
              <span class="pod-title">${pod.location}</span>
              <span class="pod-subtitle">AlgaePod #${pod.id}</span>
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

      marker.on("mouseover", function () {
        marker.openPopup();
      });
      marker.on("click", () => {
        router.push(`/dashboard?pod=${pod.id}`);
      });
    });

    // Delegate click on the popup CTA
    map.on("popupopen", (e) => {
      const el = (e.popup.getElement() as HTMLElement | null)?.querySelector(
        ".pod-action"
      ) as HTMLElement | null;
      if (!el) return;
      el.onclick = () => {
        const id = el.getAttribute("data-pod");
        router.push(`/dashboard?pod=${id ?? ""}`);
      };
    });

    return () => {
      themeObserver.disconnect();
      map.off("zoomend", updateLayerByZoom);
      map.remove();
    };
  }, [router]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
