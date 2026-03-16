"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { useTripMapStore } from "@/stores/trip-map-store";
import type { TripActivity, TripLodging, Trip } from "@/lib/api-types";
import { createTripIcon, createClusterIcon, createActivityIcon, createLodgingIcon } from "@/components/map-icons";

interface MapViewProps {
    onSelectTripById: (tripId: number | null) => void;
    visibleTrips?: Trip[];
    onRightClick?: (lat: number, lng: number, clientX: number, clientY: number) => void;
    collectionActivities?: TripActivity[];
    collectionLodgings?: TripLodging[];
}

const STORED_MAP_VIEW_KEY = "travel-map:view:v1";
const DETAIL_ZOOM = 15;
const INITIAL_USER_ZOOM = 12;
const CITY_LEVEL_ZOOM = 12;
const TRIP_MAX_ZOOM = 15;

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

function clearMarkers(markers: L.Marker[]) {
    markers.forEach((marker) => marker.remove());
}

function getTripPoints(trip: Trip): [number, number][] {
    const points: [number, number][] = [[trip.latitude, trip.longitude]];

    for (const activity of trip.activities) {
        if (hasCoordinates(activity)) {
            points.push([activity.latitude, activity.longitude]);
        }
    }

    for (const lodging of trip.lodgings) {
        if (hasCoordinates(lodging)) {
            points.push([lodging.latitude, lodging.longitude]);
        }
    }

    return points;
}

function focusMapOnTrip(map: L.Map, trip: Trip) {
    const bounds = L.latLngBounds(getTripPoints(trip));
    if (!bounds.isValid()) {
        return;
    }

    map.flyToBounds(bounds, { padding: [100, 56], maxZoom: TRIP_MAX_ZOOM, duration: 1.1 });
}

export default function MapView({
    onSelectTripById,
    visibleTrips,
    onRightClick,
    collectionActivities,
    collectionLodgings,
}: MapViewProps) {
    const storeTrips = useTripMapStore((state) => state.trips);
    const trips = visibleTrips ?? storeTrips;
    const selectedTrip = useTripMapStore((state) => state.selectedTrip);
    const fullScreenTrip = useTripMapStore((state) => state.fullScreenTrip);
    const selectedActivity = useTripMapStore((state) => state.selectedActivity);
    const selectedLodging = useTripMapStore((state) => state.selectedLodging);
    const setSelectedActivity = useTripMapStore((state) => state.setSelectedActivity);
    const setSelectedLodging = useTripMapStore((state) => state.setSelectedLodging);

    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const onRightClickRef = useRef(onRightClick);
    useEffect(() => { onRightClickRef.current = onRightClick; }, [onRightClick]);
    const onSelectTripByIdRef = useRef(onSelectTripById);
    useEffect(() => { onSelectTripByIdRef.current = onSelectTripById; }, [onSelectTripById]);
    const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
    const tripMarkersRef = useRef<L.Marker[]>([]);
    const detailMarkersRef = useRef<L.Marker[]>([]);
    const collectionMarkersRef = useRef<L.Marker[]>([]);
    const lastFocusedLocationKeyRef = useRef<string | null>(null);
    const lastFocusedDetailKeyRef = useRef<string | null>(null);
    const lastFocusedTripCoordsRef = useRef<[number, number] | null>(null);
    const selectedTripRef = useRef<Trip | null>(null);
    const deselectedByZoomRef = useRef(false);
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
            minZoom: 5,
            maxBounds: usBounds,
            maxBoundsViscosity: 1.0,
            zoomControl: false,
            attributionControl: false,
        });

        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
            maxZoom: 19,
            minZoom: 5,
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
        map.on("contextmenu", (e: L.LeafletMouseEvent) => {
            onRightClickRef.current?.(
                e.latlng.lat,
                e.latlng.lng,
                e.originalEvent.clientX,
                e.originalEvent.clientY,
            );
        });

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

        // Remove previous cluster group and markers.
        if (clusterGroupRef.current) {
            map.removeLayer(clusterGroupRef.current);
            clusterGroupRef.current = null;
        }
        clearMarkers(tripMarkersRef.current);
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

        // Use a cluster group in overview mode so dense areas don't overlap.
        const clusterGroup = (L as unknown as { markerClusterGroup: (opts: object) => L.MarkerClusterGroup })
            .markerClusterGroup({
                showCoverageOnHover: false,
                maxClusterRadius: 40,
                disableClusteringAtZoom: 11,
                iconCreateFunction: (cluster: L.MarkerCluster) => {
                    const childMarkers = cluster.getAllChildMarkers();
                    const clusterTrips = childMarkers
                        .map((m: L.Marker) => (m as unknown as { _trip: Trip })._trip)
                        .filter(Boolean);
                    // Pick the highest-priority trip; fall back to most recent date.
                    const best = clusterTrips.reduce((a: Trip, b: Trip) => {
                        const sa = a.priority_score ?? -1;
                        const sb = b.priority_score ?? -1;
                        if (sb !== sa) return sb > sa ? b : a;
                        return getTripTimestamp(b.date) > getTripTimestamp(a.date) ? b : a;
                    });
                    return createClusterIcon(best, cluster.getChildCount());
                },
            });
        clusterGroupRef.current = clusterGroup;

        const selectedLocationKey = selectedTrip ? getLocationKey(selectedTrip.latitude, selectedTrip.longitude) : null;
        for (const trip of mostRecentTrips) {
            const tripLocationKey = getLocationKey(trip.latitude, trip.longitude);
            const isActive = selectedLocationKey !== null && selectedLocationKey === tripLocationKey;
            const marker = L.marker([trip.latitude, trip.longitude], {
                icon: createTripIcon(trip, isActive),
            });
            (marker as unknown as { _trip: Trip })._trip = trip;
            marker.on("click", () => {
                    const currentTrip = selectedTripRef.current;
                    const currentMap = mapRef.current;
                    if (currentTrip && currentTrip.trip_id === trip.trip_id && currentMap) {
                        // Same trip clicked while already selected — clear any detail selection
                        // and re-zoom to the full trip bounds without a refetch.
                        setSelectedActivity(null);
                        setSelectedLodging(null);
                        lastFocusedDetailKeyRef.current = null;
                        lastFocusedLocationKeyRef.current = null;
                        focusMapOnTrip(currentMap, currentTrip);
                    } else {
                        onSelectTripById(trip.trip_id);
                    }
                });
            clusterGroup.addLayer(marker);
            tripMarkersRef.current.push(marker);
        }

        map.addLayer(clusterGroup);
    }, [trips, selectedTrip, fullScreenTrip, onSelectTripById, setSelectedActivity, setSelectedLodging]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) {
            return;
        }

        clearMarkers(detailMarkersRef.current);
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
        setSelectedActivity,
        setSelectedLodging,
    ]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || fullScreenTrip) {
            return;
        }

        if (!selectedTrip) {
            if (deselectedByZoomRef.current) {
                // User zoomed out past the threshold — stay at current zoom.
                deselectedByZoomRef.current = false;
            } else {
                // Panel closed manually — fly back to city level.
                if (lastFocusedTripCoordsRef.current) {
                    map.flyTo(lastFocusedTripCoordsRef.current, CITY_LEVEL_ZOOM, { duration: 1.0 });
                }
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

        focusMapOnTrip(map, selectedTrip);
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
        if (!map) return;

        collectionMarkersRef.current.forEach((m) => m.remove());
        collectionMarkersRef.current = [];

        const activities = collectionActivities ?? [];
        const lodgings = collectionLodgings ?? [];
        if (activities.length === 0 && lodgings.length === 0) return;

        const points: [number, number][] = [];

        for (const activity of activities) {
            if (!hasCoordinates(activity)) continue;
            const marker = L.marker([activity.latitude, activity.longitude], {
                icon: createActivityIcon(activity, false),
            }).addTo(map);
            collectionMarkersRef.current.push(marker);
            points.push([activity.latitude, activity.longitude]);
        }

        for (const lodging of lodgings) {
            if (!hasCoordinates(lodging)) continue;
            const marker = L.marker([lodging.latitude, lodging.longitude], {
                icon: createLodgingIcon(lodging, false),
            }).addTo(map);
            collectionMarkersRef.current.push(marker);
            points.push([lodging.latitude, lodging.longitude]);
        }

        if (points.length > 0) {
            const bounds = L.latLngBounds(points);
            if (bounds.isValid()) {
                map.flyToBounds(bounds, { padding: [80, 80], maxZoom: TRIP_MAX_ZOOM, duration: 1.1 });
            }
        }
    }, [collectionActivities, collectionLodgings]);

    // Auto-deselect when the user zooms out far enough that the selected trip
    // no longer makes sense at the current scale.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !selectedTrip) return;

        const points = getTripPoints(selectedTrip);
        const bounds = L.latLngBounds(points.length > 1 ? points : [[selectedTrip.latitude, selectedTrip.longitude]]);

        // The zoom level that would naturally fit this trip. Cap at TRIP_MAX_ZOOM
        // so a single-point trip (which would return maxZoom) doesn't set an
        // absurdly high threshold.
        const fitZoom = Math.min(
            map.getBoundsZoom(bounds, false, L.point(100, 56)),
            TRIP_MAX_ZOOM,
        );

        function onZoomEnd() {
            // Don't interfere when the user is viewing fullscreen trip detail.
            if (fullScreenTripRef.current) return;
            const currentZoom = mapRef.current?.getZoom() ?? Infinity;
            if (currentZoom < fitZoom - 4) {
                deselectedByZoomRef.current = true;
                onSelectTripByIdRef.current(null);
            }
        }

        map.on("zoomend", onZoomEnd);
        return () => { map.off("zoomend", onZoomEnd); };
    }, [selectedTrip]);

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
