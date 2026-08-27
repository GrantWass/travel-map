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
    groupIndex: number;
    itemIndex: number;
}

function hasValidCoordinates(
    item: { latitude?: number | null; longitude?: number | null },
): item is { latitude: number; longitude: number } {
    return typeof item.latitude === "number"
        && typeof item.longitude === "number"
        && Number.isFinite(item.latitude)
        && Number.isFinite(item.longitude)
        && item.latitude >= -90
        && item.latitude <= 90
        && item.longitude >= -180
        && item.longitude <= 180;
}

function collectPoints(plan: SharedPlan): MapPoint[] {
    const points: MapPoint[] = [];
    for (let gi = 0; gi < plan.groups.length; gi++) {
        const group = plan.groups[gi];
        for (let ai = 0; ai < group.activities.length; ai++) {
            const item = group.activities[ai];
            if (hasValidCoordinates(item)) {
                points.push({
                    kind: "activity",
                    title: item.title || "Untitled activity",
                    latitude: item.latitude,
                    longitude: item.longitude,
                    thumbnailUrl: item.thumbnail_url,
                    groupIndex: gi,
                    itemIndex: ai,
                });
            }
        }
        for (let li = 0; li < group.lodgings.length; li++) {
            const item = group.lodgings[li];
            if (hasValidCoordinates(item)) {
                points.push({
                    kind: "lodging",
                    title: item.title || "Untitled stay",
                    latitude: item.latitude,
                    longitude: item.longitude,
                    thumbnailUrl: item.thumbnail_url,
                    groupIndex: gi,
                    itemIndex: li,
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
        L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY ?? ""}`, {
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

            marker.on("mouseover", function (this: L.Marker) {
                const el = this.getElement();
                const visual = el?.firstElementChild as HTMLElement | null;
                if (visual) {
                    visual.style.transition = "transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)";
                    visual.style.transform = "scale(1.2)";
                    this.setZIndexOffset(1000);
                }
            });
            marker.on("mouseout", function (this: L.Marker) {
                const el = this.getElement();
                const visual = el?.firstElementChild as HTMLElement | null;
                if (visual) {
                    visual.style.transform = "scale(1)";
                    this.setZIndexOffset(0);
                }
            });

            const cardId = `shared-stop-${point.groupIndex}-${point.kind}-${point.itemIndex}`;
            marker.on("click", function () {
                const card = document.getElementById(cardId);
                if (card) {
                    card.scrollIntoView({ behavior: "smooth", block: "center" });
                    card.classList.remove("shared-stop-highlight");
                    void card.offsetWidth;
                    card.classList.add("shared-stop-highlight");
                    card.addEventListener("animationend", () => card.classList.remove("shared-stop-highlight"), { once: true });
                }
            });

            bounds.push([point.latitude, point.longitude]);
        }

        if (bounds.length > 0) {
            const fitBounds = L.latLngBounds(bounds);
            if (fitBounds.isValid()) {
                map.fitBounds(fitBounds, { padding: [40, 40], maxZoom: 14 });
            }
        }

        const resizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }));
        resizeObserver.observe(container);
        const animationFrame = window.requestAnimationFrame(() => map.invalidateSize({ pan: false }));

        mapRef.current = map;
        return () => {
            window.cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
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
