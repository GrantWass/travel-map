import type { Trip, TripActivity, TripLodging } from "@/lib/api-types";
import L from "leaflet";

const MARKER_FALLBACK_IMAGE = "/images/nyc.jpg";
const MAP_MARKER_TITLE_MAX_CHARS = 20;

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function truncateTripMarkerTitle(value: string, maxLength: number): string {
    const trimmed = value.trim();
    if (!trimmed) {
        return "Untitled trip";
    }
    if (trimmed.length <= maxLength) {
        return trimmed;
    }
    return `${trimmed.slice(0, Math.max(maxLength - 3, 1)).trimEnd()}...`;
}

export function createTripIcon(trip: Trip, isActive: boolean): L.DivIcon {
    const size = isActive ? 80 : 64;
    const safeAltTitle = escapeHtml(trip.title);
    const safeLabelTitle = escapeHtml(truncateTripMarkerTitle(trip.title, MAP_MARKER_TITLE_MAX_CHARS));
    const imageUrl = trip.thumbnail_url || MARKER_FALLBACK_IMAGE;
    const popupBadge = trip.event_end && trip.event_start
        ? `<div style="
            position:absolute;top:4px;right:4px;
            width:24px;height:24px;border-radius:50%;
            background:#d97706;border:2px solid white;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 1px 4px rgba(0,0,0,0.35);
            "><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>`
        : "";
    return L.divIcon({
        className: "photo-marker",
        html: `
    <div style="width:${size}px;height:${size}px;position:relative;cursor:pointer;">
        <div style="
        position:relative;
        width:100%;height:100%;border-radius:12px;overflow:hidden;
        border:${isActive ? "3px solid #d4a055" : "2px solid rgba(255,255,255,0.3)"};
        box-shadow:0 4px 20px rgba(0,0,0,0.5);
        ">
        <img
            src="${imageUrl}"
            alt="${safeAltTitle}"
            style="display:block;width:100%;height:100%;object-fit:cover;"
            onerror="this.onerror=null;this.src='${MARKER_FALLBACK_IMAGE}';"
        />
        <div style="
            position:absolute;left:0;right:0;bottom:0;padding:4px 6px;
            background:linear-gradient(transparent, rgba(0,0,0,0.85));
            color:white;font-size:10px;font-weight:600;font-family:system-ui,sans-serif;
        ">${safeLabelTitle}</div>
        </div>
        ${popupBadge}
    </div>
    `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}

export function createActivityIcon(activity: TripActivity, isActive: boolean): L.DivIcon {
    const size = isActive ? 70 : 50;
    const safeTitle = escapeHtml(activity.title || "Activity");
    const imageUrl = activity.thumbnail_url || MARKER_FALLBACK_IMAGE;
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
}

export function createLodgingIcon(lodging: TripLodging, isActive: boolean): L.DivIcon {
    const size = isActive ? 70 : 50;
    const roofHeight = Math.round(size * 0.34);
    const bodyHeight = size - roofHeight;
    const safeTitle = escapeHtml(lodging.title || "Lodging");
    const imageUrl = lodging.thumbnail_url || MARKER_FALLBACK_IMAGE;
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
}