"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useTripMapStore } from "@/stores/trip-map-store";
import type { TripActivity, TripLodging, Trip } from "@/lib/api-types";
import { createTripIcon, createActivityIcon, createLodgingIcon } from "@/components/map-icons";

interface MapViewProps {
    onSelectTripById: (tripId: number | null) => void;
}

const STORED_MAP_VIEW_KEY = "travel-map:view:v1";
const DETAIL_ZOOM = 16;
const INITIAL_USER_ZOOM = 12;
const CITY_LEVEL_ZOOM = 12;
const TRIP_MAX_ZOOM = 16;

let hasAutoCenteredOnUser = false;

interface StoredMapView {
    lat: number;
    lng: number;
    zoom: number;
}

function hasCoordinates(
    value: Pick<TripActivity, "latitude" | "longitude"> | Pick<TripLodging, "latitude" | "longitude">,
): value is { latitude: number; longitude: number } {
    return typeof value.latitude === "number" && typeof value.longitude === "number";
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

function getTripTimestamp(dateValue: string | null | undefined): number {
    const timestamp = Date.parse(dateValue ?? "");
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getMostRecentTripsByLocation(trips: Trip[]): Trip[] {
    const mostRecentByLocation = new Map<string, Trip>();

    for (const trip of trips) {
        const key = getLocationKey(trip.latitude, trip.longitude);
        const current = mostRecentByLocation.get(key);
        if (!current || getTripTimestamp(trip.date) > getTripTimestamp(current.date)) {
            mostRecentByLocation.set(key, trip);
        }
    }

    return Array.from(mostRecentByLocation.values());
}

export default function MapView({
    onSelectTripById,
}: MapViewProps) {
    const trips = useTripMapStore((state) => state.trips);
    const selectedTrip = useTripMapStore((state) => state.selectedTrip);
    const fullScreenTrip = useTripMapStore((state) => state.fullScreenTrip);
    const selectedActivity = useTripMapStore((state) => state.selectedActivity);
    const selectedLodging = useTripMapStore((state) => state.selectedLodging);
    const setSelectedActivity = useTripMapStore((state) => state.setSelectedActivity);
    const setSelectedLodging = useTripMapStore((state) => state.setSelectedLodging);

    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const tripMarkersRef = useRef<L.Marker[]>([]);
    const detailMarkersRef = useRef<L.Marker[]>([]);
    const lastFocusedLocationKeyRef = useRef<string | null>(null);
    const lastFocusedDetailKeyRef = useRef<string | null>(null);
    const lastFocusedTripCoordsRef = useRef<[number, number] | null>(null);
    const selectedTripRef = useRef<Trip | null>(null);
    const fullScreenTripRef = useRef<Trip | null>(null);
    const selectedActivityRef = useRef<TripActivity | null>(null);
    const selectedLodgingRef = useRef<TripLodging | null>(null);
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

    useEffect(() => {
        const map = mapRef.current;
        if (!map) {
            return;
        }

        tripMarkersRef.current.forEach((marker) => marker.remove());
        tripMarkersRef.current = [];

        const mostRecentTrips = getMostRecentTripsByLocation(trips);
        if (fullScreenTrip) {
            const fullScreenKey = getLocationKey(fullScreenTrip.latitude, fullScreenTrip.longitude);
            const representative =
                mostRecentTrips.find((trip) => getLocationKey(trip.latitude, trip.longitude) === fullScreenKey) ?? fullScreenTrip;
            const marker = L.marker([representative.latitude, representative.longitude], {
                icon: createTripIcon(representative, true),
            }).addTo(map);
            tripMarkersRef.current.push(marker);
            return;
        }

        const selectedLocationKey = selectedTrip ? getLocationKey(selectedTrip.latitude, selectedTrip.longitude) : null;
        for (const trip of mostRecentTrips) {
            const tripLocationKey = getLocationKey(trip.latitude, trip.longitude);
            const isActive = selectedLocationKey !== null && selectedLocationKey === tripLocationKey;
            const marker = L.marker([trip.latitude, trip.longitude], {
                icon: createTripIcon(trip, isActive),
            })
                .addTo(map)
                .on("click", () => {
                    const currentTrip = selectedTripRef.current;
                    const currentMap = mapRef.current;
                    if (currentTrip && currentTrip.trip_id === trip.trip_id && currentMap) {
                        // Same trip clicked while already selected — clear any detail selection
                        // and re-zoom to the full trip bounds without a refetch.
                        setSelectedActivity(null);
                        setSelectedLodging(null);
                        lastFocusedDetailKeyRef.current = null;
                        lastFocusedLocationKeyRef.current = null;
                        const points: [number, number][] = [[currentTrip.latitude, currentTrip.longitude]];
                        for (const a of currentTrip.activities) {
                            if (hasCoordinates(a)) points.push([a.latitude, a.longitude]);
                        }
                        for (const l of currentTrip.lodgings) {
                            if (hasCoordinates(l)) points.push([l.latitude, l.longitude]);
                        }
                        const bounds = L.latLngBounds(points);
                        if (bounds.isValid()) {
                            currentMap.flyToBounds(bounds, { padding: [56, 56], maxZoom: TRIP_MAX_ZOOM, duration: 1.1 });
                        }
                    } else {
                        onSelectTripById(trip.trip_id);
                    }
                });
            tripMarkersRef.current.push(marker);
        }
    }, [trips, selectedTrip, fullScreenTrip, createTripIcon, onSelectTripById, setSelectedActivity, setSelectedLodging]);

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

        const tripLocationKey = getLocationKey(focusTrip.latitude, focusTrip.longitude);

        for (const activity of focusTrip.activities) {
            if (!hasCoordinates(activity)) continue;
            if (getLocationKey(activity.latitude, activity.longitude) === tripLocationKey) continue;
            const marker = L.marker([activity.latitude, activity.longitude], {
                icon: createActivityIcon(activity, selectedActivity?.activity_id === activity.activity_id),
            })
                .addTo(map)
                .on("click", () => {
                    setSelectedActivity(activity);
                    setSelectedLodging(null);
                    map.flyTo([activity.latitude, activity.longitude], DETAIL_ZOOM, { duration: 0.9 });
                });
            detailMarkersRef.current.push(marker);
        }

        for (const lodging of focusTrip.lodgings) {
            if (!hasCoordinates(lodging)) continue;
            if (getLocationKey(lodging.latitude, lodging.longitude) === tripLocationKey) continue;
            const marker = L.marker([lodging.latitude, lodging.longitude], {
                icon: createLodgingIcon(lodging, selectedLodging?.lodge_id === lodging.lodge_id),
            })
                .addTo(map)
                .on("click", () => {
                    setSelectedActivity(null);
                    setSelectedLodging(lodging);
                    map.flyTo([lodging.latitude, lodging.longitude], DETAIL_ZOOM, { duration: 0.9 });
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
        setSelectedActivity,
        setSelectedLodging,
    ]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || fullScreenTrip) {
            return;
        }

        if (!selectedTrip) {
            // Zoom back to city level when the panel closes.
            if (lastFocusedTripCoordsRef.current) {
                map.flyTo(lastFocusedTripCoordsRef.current, CITY_LEVEL_ZOOM, { duration: 1.0 });
            }
            lastFocusedLocationKeyRef.current = null;
            return;
        }

        // Include activity + lodging count in the key so the zoom re-fires once the
        // full trip data loads (the cached trip may arrive first with empty arrays).
        const focusKey = `${selectedTrip.trip_id}:${selectedTrip.activities.length}:${selectedTrip.lodgings.length}`;
        if (lastFocusedLocationKeyRef.current === focusKey) {
            return;
        }

        lastFocusedLocationKeyRef.current = focusKey;
        lastFocusedTripCoordsRef.current = [selectedTrip.latitude, selectedTrip.longitude];

        // Collect all activity/lodging coordinates (same logic the full-screen view used).
        const points: [number, number][] = [[selectedTrip.latitude, selectedTrip.longitude]];
        for (const activity of selectedTrip.activities) {
            if (hasCoordinates(activity)) {
                points.push([activity.latitude, activity.longitude]);
            }
        }
        for (const lodging of selectedTrip.lodgings) {
            if (hasCoordinates(lodging)) {
                points.push([lodging.latitude, lodging.longitude]);
            }
        }

        const bounds = L.latLngBounds(points);
        if (!bounds.isValid()) {
            return;
        }

        // Always use flyToBounds — Leaflet picks the zoom from the bounding box.
        // TRIP_MAX_ZOOM caps the zoom for single-location trips (degenerate bounds → max cap).
        map.flyToBounds(bounds, { padding: [56, 56], maxZoom: TRIP_MAX_ZOOM, duration: 1.1 });
    }, [selectedTrip, fullScreenTrip]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) {
            return;
        }

        if (selectedActivity) {
            const key = `activity:${selectedActivity.activity_id}`;
            if (lastFocusedDetailKeyRef.current !== key) {
                lastFocusedDetailKeyRef.current = key;
                if (hasCoordinates(selectedActivity)) {
                    map.flyTo([selectedActivity.latitude, selectedActivity.longitude], DETAIL_ZOOM, { duration: 0.8 });
                }
            }
            return;
        }

        if (selectedLodging) {
            const key = `lodging:${selectedLodging.lodge_id}`;
            if (lastFocusedDetailKeyRef.current !== key) {
                lastFocusedDetailKeyRef.current = key;
                if (hasCoordinates(selectedLodging)) {
                    map.flyTo([selectedLodging.latitude, selectedLodging.longitude], DETAIL_ZOOM, { duration: 0.8 });
                }
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
