"use client";

import { useCallback, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { MapActivity, MapLodging, MapTrip } from "@/lib/trip-models";

interface MapViewProps {
    trips: MapTrip[];
    selectedTrip: MapTrip | null;
    fullScreenTrip: MapTrip | null;
    selectedActivity: MapActivity | null;
    selectedLodging: MapLodging | null;
    onSelectTripById: (tripId: number | null) => void;
    onSelectActivity: (activity: MapActivity | null) => void;
    onSelectLodging: (lodging: MapLodging | null) => void;
}

const MARKER_FALLBACK_IMAGE = "/images/nyc.jpg";
const STORED_MAP_VIEW_KEY = "travel-map:view:v1";
const SELECTED_REVIEW_ZOOM = 16;
const DETAIL_ZOOM = 13;
const INITIAL_USER_ZOOM = 12;
const FULL_SCREEN_MAX_ZOOM = 12;

let hasAutoCenteredOnUser = false;

interface StoredMapView {
    lat: number;
    lng: number;
    zoom: number;
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function readStoredMapView(): StoredMapView | null {
    if (typeof window === "undefined") {
        return null;
    }

    const raw = window.sessionStorage.getItem(STORED_MAP_VIEW_KEY);
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as Partial<StoredMapView>;
        const lat = Number(parsed.lat);
        const lng = Number(parsed.lng);
        const zoom = Number(parsed.zoom);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) {
            return null;
        }
        return { lat, lng, zoom };
    } catch {
        return null;
    }
}

function persistMapView(map: L.Map) {
    if (typeof window === "undefined") {
        return;
    }

    const center = map.getCenter();
    const payload: StoredMapView = {
        lat: center.lat,
        lng: center.lng,
        zoom: map.getZoom(),
    };
    window.sessionStorage.setItem(STORED_MAP_VIEW_KEY, JSON.stringify(payload));
}

function getLocationKey(lat: number, lng: number): string {
    return `${lat.toFixed(6)}:${lng.toFixed(6)}`;
}

function getTripTimestamp(dateValue: string): number {
    const timestamp = Date.parse(dateValue);
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getMostRecentTripsByLocation(trips: MapTrip[]): MapTrip[] {
    const mostRecentByLocation = new Map<string, MapTrip>();

    for (const trip of trips) {
        const key = getLocationKey(trip.lat, trip.lng);
        const current = mostRecentByLocation.get(key);
        if (!current || getTripTimestamp(trip.date) > getTripTimestamp(current.date)) {
            mostRecentByLocation.set(key, trip);
        }
    }

    return Array.from(mostRecentByLocation.values());
}

export default function MapView({
    trips,
    selectedTrip,
    fullScreenTrip,
    selectedActivity,
    selectedLodging,
    onSelectTripById,
    onSelectActivity,
    onSelectLodging,
}: MapViewProps) {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const tripMarkersRef = useRef<L.Marker[]>([]);
    const detailMarkersRef = useRef<L.Marker[]>([]);
    const lastFocusedLocationKeyRef = useRef<string | null>(null);
    const lastFocusedDetailKeyRef = useRef<string | null>(null);
    const selectedTripRef = useRef<MapTrip | null>(null);
    const fullScreenTripRef = useRef<MapTrip | null>(null);
    const selectedActivityRef = useRef<MapActivity | null>(null);
    const selectedLodgingRef = useRef<MapLodging | null>(null);
    useEffect(() => {
        selectedTripRef.current = selectedTrip;
    }, [selectedTrip]);

    useEffect(() => {
        fullScreenTripRef.current = fullScreenTrip;
    }, [fullScreenTrip]);

    useEffect(() => {
        selectedActivityRef.current = selectedActivity;
    }, [selectedActivity]);

    useEffect(() => {
        selectedLodgingRef.current = selectedLodging;
    }, [selectedLodging]);

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) {
            return;
        }

        const usBounds = L.latLngBounds([13, -180], [76, -60]);
        const storedMapView = readStoredMapView();
        if (storedMapView) {
            hasAutoCenteredOnUser = true;
        }

        const map = L.map(mapContainerRef.current, {
            center: storedMapView ? [storedMapView.lat, storedMapView.lng] : [39.5, -98.35],
            zoom: storedMapView ? storedMapView.zoom : 5,
            minZoom: 4,
            maxBounds: usBounds,
            maxBoundsViscosity: 1.0,
            zoomControl: false,
            attributionControl: false,
        });

        // L.tileLayer("https://tile.jawg.io/jawg-sunny/{z}/{x}/{y}{r}.png?access-token={accessToken}", {
        //     maxZoom: 22,
        //     minZoom: 4,
        //     accessToken: process.env.NEXT_PUBLIC_JAWG_API_KEY ?? "",
        // } as L.TileLayerOptions & { accessToken: string }).addTo(map);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
            maxZoom: 19,
            minZoom: 4,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        }).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Locate / "home" button — positioned below the zoom control
        const locateControl = new L.Control({ position: "bottomright" });
        locateControl.onAdd = () => {
            const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
            const btn = L.DomUtil.create("a", "", container);
            btn.href = "#";
            btn.title = "Go to my location";
            btn.setAttribute("role", "button");
            btn.style.cssText =
                "display:flex!important;align-items:center;justify-content:center;width:30px!important;height:30px!important;line-height:30px;";
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`;
            L.DomEvent.on(btn, "click", (e) => {
                L.DomEvent.preventDefault(e);
                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition((pos) => {
                    map.flyTo([pos.coords.latitude, pos.coords.longitude], INITIAL_USER_ZOOM, {
                        duration: 1.2,
                    });
                });
            });
            L.DomEvent.disableClickPropagation(container);
            return container;
        };
        locateControl.addTo(map);

        mapRef.current = map;
        map.on("moveend", () => persistMapView(map));

        let cancelled = false;
        if (!hasAutoCenteredOnUser && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    if (cancelled || hasAutoCenteredOnUser) {
                        return;
                    }

                    if (
                        selectedTripRef.current !== null ||
                        fullScreenTripRef.current !== null ||
                        selectedActivityRef.current !== null ||
                        selectedLodgingRef.current !== null
                    ) {
                        hasAutoCenteredOnUser = true;
                        return;
                    }

                    hasAutoCenteredOnUser = true;
                    map.flyTo([position.coords.latitude, position.coords.longitude], INITIAL_USER_ZOOM, {
                        duration: 1.2,
                    });
                },
                () => {
                    hasAutoCenteredOnUser = true;
                },
            );
        }

        return () => {
            cancelled = true;
            map.remove();
            mapRef.current = null;
        };
    }, []);

    const createTripIcon = useCallback((trip: MapTrip, isActive: boolean): L.DivIcon => {
        const size = isActive ? 80 : 64;
        const safeTitle = escapeHtml(trip.title);
        const imageUrl = trip.thumbnail || MARKER_FALLBACK_IMAGE;
        return L.divIcon({
            className: "photo-marker",
            html: `
        <div style="
          width:${size}px;height:${size}px;border-radius:12px;overflow:hidden;
          border:${isActive ? "3px solid #d4a055" : "2px solid rgba(255,255,255,0.3)"};
          box-shadow:0 4px 20px rgba(0,0,0,0.5);position:relative;cursor:pointer;
        ">
          <img
            src="${imageUrl}"
            alt="${safeTitle}"
            style="width:100%;height:100%;object-fit:cover;"
            onerror="this.onerror=null;this.src='${MARKER_FALLBACK_IMAGE}';"
          />
          <div style="
            position:absolute;left:0;right:0;bottom:0;padding:4px 6px;
            background:linear-gradient(transparent, rgba(0,0,0,0.85));
            color:white;font-size:10px;font-weight:600;font-family:system-ui,sans-serif;
          ">${safeTitle}</div>
        </div>
      `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
    }, []);

    const createActivityIcon = useCallback((activity: MapActivity, isActive: boolean): L.DivIcon => {
        const size = isActive ? 80 : 65;
        const safeTitle = escapeHtml(activity.title);
        const imageUrl = activity.image || MARKER_FALLBACK_IMAGE;
        return L.divIcon({
            className: "activity-marker",
            html: `
        <div style="
          width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;
          border:${isActive ? "3px solid #d4a055" : "2px solid rgba(255,255,255,0.5)"};
          box-shadow:0 2px 12px rgba(0,0,0,0.4);cursor:pointer;
        ">
          <img
            src="${imageUrl}"
            alt="${safeTitle}"
            style="width:100%;height:100%;object-fit:cover;"
            onerror="this.onerror=null;this.src='${MARKER_FALLBACK_IMAGE}';"
          />
        </div>
      `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
    }, []);

    const createLodgingIcon = useCallback((lodging: MapLodging, isActive: boolean): L.DivIcon => {
        const size = isActive ? 80 : 65;
        const roofHeight = Math.round(size * 0.34);
        const bodyHeight = size - roofHeight;
        const safeTitle = escapeHtml(lodging.title);
        const imageUrl = lodging.image || MARKER_FALLBACK_IMAGE;
        return L.divIcon({
            className: "lodging-marker",
            html: `
        <div style="width:${size}px;height:${size}px;position:relative;cursor:pointer;">
          <div style="
            position:absolute;top:0;left:50%;transform:translateX(-50%);
            width:0;height:0;
            border-left:${Math.round(size / 2)}px solid transparent;
            border-right:${Math.round(size / 2)}px solid transparent;
            border-bottom:${roofHeight}px solid ${isActive ? "#d4a055" : "#fff"};
            filter:drop-shadow(0 3px 8px rgba(0,0,0,0.45));
          "></div>
          <div style="
            position:absolute;top:${Math.max(roofHeight - 2, 0)}px;left:50%;transform:translateX(-50%);
            width:${Math.round(size * 0.78)}px;height:${bodyHeight}px;
            border-radius:0 0 10px 10px;overflow:hidden;
            border:${isActive ? "3px solid #d4a055" : "2px solid #fff"};
            box-shadow:0 4px 14px rgba(0,0,0,0.45);background:#111;
          ">
            <img
              src="${imageUrl}"
              alt="${safeTitle}"
              style="width:100%;height:100%;object-fit:cover;"
              onerror="this.onerror=null;this.src='${MARKER_FALLBACK_IMAGE}';"
            />
          </div>
        </div>
      `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) {
            return;
        }

        tripMarkersRef.current.forEach((marker) => marker.remove());
        tripMarkersRef.current = [];

        const mostRecentTrips = getMostRecentTripsByLocation(trips);
        if (fullScreenTrip) {
            const fullScreenKey = getLocationKey(fullScreenTrip.lat, fullScreenTrip.lng);
            const representative =
                mostRecentTrips.find((trip) => getLocationKey(trip.lat, trip.lng) === fullScreenKey) ?? fullScreenTrip;
            const marker = L.marker([representative.lat, representative.lng], {
                icon: createTripIcon(representative, true),
            }).addTo(map);
            tripMarkersRef.current.push(marker);
            return;
        }

        const selectedLocationKey = selectedTrip ? getLocationKey(selectedTrip.lat, selectedTrip.lng) : null;
        for (const trip of mostRecentTrips) {
            const tripLocationKey = getLocationKey(trip.lat, trip.lng);
            const isActive = selectedLocationKey !== null && selectedLocationKey === tripLocationKey;
            const marker = L.marker([trip.lat, trip.lng], {
                icon: createTripIcon(trip, isActive),
            })
                .addTo(map)
                .on("click", () => onSelectTripById(trip.id));
            tripMarkersRef.current.push(marker);
        }
    }, [trips, selectedTrip, fullScreenTrip, createTripIcon, onSelectTripById]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) {
            return;
        }

        detailMarkersRef.current.forEach((marker) => marker.remove());
        detailMarkersRef.current = [];

        const focusTrip = fullScreenTrip ?? selectedTrip;
        if (!focusTrip) {
            return;
        }

        const tripLocationKey = getLocationKey(focusTrip.lat, focusTrip.lng);

        for (const activity of focusTrip.activities) {
            if (getLocationKey(activity.lat, activity.lng) === tripLocationKey) continue;
            const marker = L.marker([activity.lat, activity.lng], {
                icon: createActivityIcon(activity, selectedActivity?.id === activity.id),
            })
                .addTo(map)
                .on("click", () => {
                    onSelectActivity(activity);
                    onSelectLodging(null);
                    map.flyTo([activity.lat, activity.lng], DETAIL_ZOOM, { duration: 0.9 });
                });
            detailMarkersRef.current.push(marker);
        }

        for (const lodging of focusTrip.lodgings) {
            if (getLocationKey(lodging.lat, lodging.lng) === tripLocationKey) continue;
            const marker = L.marker([lodging.lat, lodging.lng], {
                icon: createLodgingIcon(lodging, selectedLodging?.id === lodging.id),
            })
                .addTo(map)
                .on("click", () => {
                    onSelectActivity(null);
                    onSelectLodging(lodging);
                    map.flyTo([lodging.lat, lodging.lng], DETAIL_ZOOM, { duration: 0.9 });
                });
            detailMarkersRef.current.push(marker);
        }
    }, [
        fullScreenTrip,
        selectedTrip,
        selectedActivity,
        selectedLodging,
        createActivityIcon,
        createLodgingIcon,
        onSelectActivity,
        onSelectLodging,
    ]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || fullScreenTrip) {
            return;
        }

        if (!selectedTrip) {
            lastFocusedLocationKeyRef.current = null;
            return;
        }

        const locationKey = getLocationKey(selectedTrip.lat, selectedTrip.lng);
        if (lastFocusedLocationKeyRef.current === locationKey) {
            return;
        }

        lastFocusedLocationKeyRef.current = locationKey;
        map.flyTo([selectedTrip.lat, selectedTrip.lng], SELECTED_REVIEW_ZOOM, { duration: 1.1 });
    }, [selectedTrip, fullScreenTrip]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !fullScreenTrip) {
            return;
        }

        const points: [number, number][] = [[fullScreenTrip.lat, fullScreenTrip.lng]];
        fullScreenTrip.activities.forEach((activity) => {
            points.push([activity.lat, activity.lng]);
        });
        fullScreenTrip.lodgings.forEach((lodging) => {
            points.push([lodging.lat, lodging.lng]);
        });

        const bounds = L.latLngBounds(points);
        if (!bounds.isValid()) {
            return;
        }

        map.flyToBounds(bounds, {
            padding: [56, 56],
            maxZoom: FULL_SCREEN_MAX_ZOOM,
            duration: 1.1,
        });

        // Force a closer re-focus when the user exits full-screen back to sidebar.
        lastFocusedLocationKeyRef.current = null;
    }, [fullScreenTrip]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) {
            return;
        }

        if (selectedActivity) {
            const key = `activity:${selectedActivity.id}`;
            if (lastFocusedDetailKeyRef.current !== key) {
                lastFocusedDetailKeyRef.current = key;
                map.flyTo([selectedActivity.lat, selectedActivity.lng], DETAIL_ZOOM, { duration: 0.8 });
            }
            return;
        }

        if (selectedLodging) {
            const key = `lodging:${selectedLodging.id}`;
            if (lastFocusedDetailKeyRef.current !== key) {
                lastFocusedDetailKeyRef.current = key;
                map.flyTo([selectedLodging.lat, selectedLodging.lng], DETAIL_ZOOM, { duration: 0.8 });
            }
            return;
        }

        lastFocusedDetailKeyRef.current = null;
    }, [selectedActivity, selectedLodging]);

    useEffect(() => {
        const map = mapRef.current;
        const container = mapContainerRef.current;
        if (!map || !container) {
            return;
        }

        const observer = new ResizeObserver(() => {
            map.invalidateSize({ animate: true });
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    return <div ref={mapContainerRef} className="h-full w-full" />;
}
