"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { SharedPlan } from "@/lib/api-client";
import { createActivityIcon, createLodgingIcon } from "@/components/map-icons";

interface MapPoint {
    kind: "activity" | "lodging";
    title: string;
    latitude: number;
    longitude: number;
    thumbnailUrl?: string | null;
}

function collectPoints(plan: SharedPlan): MapPoint[] {
    const points: MapPoint[] = [];
    for (const group of plan.groups) {
        for (const item of group.activities) {
            if (typeof item.latitude === "number" && typeof item.longitude === "number") {
                points.push({
                    kind: "activity",
                    title: item.title || "Untitled activity",
                    latitude: item.latitude,
                    longitude: item.longitude,
                    thumbnailUrl: item.thumbnail_url,
                });
            }
        }
        for (const item of group.lodgings) {
            if (typeof item.latitude === "number" && typeof item.longitude === "number") {
                points.push({
                    kind: "lodging",
                    title: item.title || "Untitled lodging",
                    latitude: item.latitude,
                    longitude: item.longitude,
                    thumbnailUrl: item.thumbnail_url,
                });
            }
        }
    }
    return points;
}

export default function SharedPlanMap({ plan }: { plan: SharedPlan }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    // Points are computed once; keeps the effect free of re-render churn.
    const pointsRef = useRef<MapPoint[] | null>(null);
    if (pointsRef.current === null) {
        pointsRef.current = collectPoints(plan);
    }

    useEffect(() => {
        const container = containerRef.current;
        if (!container || mapRef.current) return;

        const map = L.map(container, {
            center: [39.5, -98.35],
            zoom: 4,
            zoomControl: true,
            scrollWheelZoom: false,
            attributionControl: false,
        });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
            subdomains: "abcd",
            maxZoom: 19,
        }).addTo(map);

        const points = pointsRef.current ?? [];
        const bounds: [number, number][] = [];
        for (const point of points) {
            const marker = L.marker([point.latitude, point.longitude], {
                icon:
                    point.kind === "activity"
                        ? createActivityIcon(
                              { activity_id: 0, trip_id: 0, address: null, thumbnail_url: point.thumbnailUrl ?? null, title: point.title, location: null, description: null, latitude: point.latitude, longitude: point.longitude, cost: null },
                              false,
                          )
                        : createLodgingIcon(
                              { lodge_id: 0, trip_id: 0, address: null, thumbnail_url: point.thumbnailUrl ?? null, title: point.title, description: null, latitude: point.latitude, longitude: point.longitude, cost: null },
                              false,
                          ),
            }).addTo(map);
            marker.bindPopup(`<strong>${point.title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</strong>`);
            bounds.push([point.latitude, point.longitude]);
        }

        if (bounds.length > 0) {
            const fitBounds = L.latLngBounds(bounds);
            if (fitBounds.isValid()) {
                map.fitBounds(fitBounds, { padding: [40, 40], maxZoom: 14 });
            }
        }

        mapRef.current = map;
        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className="h-64 w-full overflow-hidden rounded-xl border border-stone-200 sm:h-72"
        />
    );
}
