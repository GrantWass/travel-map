import type { Trip, TripActivity, TripLodging } from "@/lib/api-types";
import L from "leaflet";

const MAP_MARKER_TITLE_MAX_CHARS = 20;
const MARKER_ACTIVE_BORDER_COLOR = "#d4a055";
const MARKER_POPUP_BADGE_COLOR = "#d97706";
const MARKER_PRIMARY_COLOR = "white";
const MARKER_SECONDARY_COLOR = "gray";
const MARKER_SHADOW = "rgba(0,0,0,0.4)";
const MARKER_GRADIENT_OVERLAY = "linear-gradient(transparent, rgba(0,0,0,0.85))";

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

    const safeAltTitle = escapeHtml(trip.title);
    const safeLabelTitle = escapeHtml(truncateTripMarkerTitle(trip.title, MAP_MARKER_TITLE_MAX_CHARS));
    const imageUrl = trip.thumbnail_url?.trim() || "";
    const hasImage = imageUrl.length > 0;
        const size = hasImage ? (isActive ? 80 : 64) : (isActive ? 64 : 50);
    const popupBadge = trip.event_end && trip.event_start
        ? `<div style="
            position:absolute;top:4px;right:4px;
            width:24px;height:24px;border-radius:50%;
            background:${MARKER_POPUP_BADGE_COLOR};border:2px solid ${MARKER_PRIMARY_COLOR};
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 1px 4px ${MARKER_SHADOW};
            "><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${MARKER_PRIMARY_COLOR}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>`
        : "";
    return L.divIcon({
        className: "photo-marker",
        html: `
    <div style="width:${size}px;height:${size}px;position:relative;cursor:pointer;">
        <div style="
        position:relative;
        width:100%;height:100%;border-radius:12px;overflow:hidden;
        border:${isActive ? `3px solid ${MARKER_ACTIVE_BORDER_COLOR}` : `2px solid ${MARKER_PRIMARY_COLOR}`};
        box-shadow:0 4px 20px ${MARKER_SHADOW};
        background:${MARKER_PRIMARY_COLOR};
        ">
        ${hasImage ? `<img
            src="${imageUrl}"
            alt="${safeAltTitle}"
            style="display:block;width:100%;height:100%;object-fit:cover;"
        />
        <div style="
            position:absolute;left:0;right:0;bottom:0;padding:4px 6px;
            background:${MARKER_GRADIENT_OVERLAY};
            color:${MARKER_PRIMARY_COLOR};font-size:10px;font-weight:600;font-family:system-ui,sans-serif;
        ">${safeLabelTitle}</div>` : ""}
        </div>
        ${popupBadge}
    </div>
    `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}

export function createActivityIcon(activity: TripActivity, isActive: boolean): L.DivIcon {
    const safeTitle = escapeHtml(activity.title || "Activity");
    const imageUrl = activity.thumbnail_url?.trim() || "";
    const hasImage = imageUrl.length > 0;
    const size = hasImage ? ( isActive ? 80 : 64) : ( isActive ? 70 : 50);

    return L.divIcon({
        className: "activity-marker",
        html: `
    <div style="
        width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;
        border:${isActive ? `3px solid ${MARKER_ACTIVE_BORDER_COLOR}` : `2px solid ${MARKER_PRIMARY_COLOR}`};
        box-shadow:0 2px 12px ${MARKER_SHADOW};cursor:pointer;background:${MARKER_PRIMARY_COLOR};
        position:relative;
    ">
        ${hasImage ? `<img
        src="${imageUrl}"
        alt="${safeTitle}"
        style="width:100%;height:100%;object-fit:cover;"
        />` : `<div style="
        position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:${Math.max(Math.round(size * 0.78), 24)}px;
        height:${Math.max(Math.round(size * 0.78), 24)}px;
        display:flex;align-items:center;justify-content:center;
        border-radius:50%;
        border:${Math.max(Math.round(size * 0.04), 1)}px solid ${MARKER_SECONDARY_COLOR};
        background:${MARKER_PRIMARY_COLOR};
        " aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${Math.max(Math.round(size * 0.64), 14)}" height="${Math.max(Math.round(size * 0.64), 14)}" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="100" cy="40" r="12" stroke="#111" stroke-width="4"></circle>
                <line x1="100" y1="52" x2="100" y2="100" stroke="#111" stroke-width="4"></line>
                <line x1="100" y1="65" x2="70" y2="85" stroke="#111" stroke-width="4"></line>
                <line x1="100" y1="65" x2="130" y2="55" stroke="#111" stroke-width="4"></line>
                <line x1="100" y1="100" x2="70" y2="140" stroke="#111" stroke-width="4"></line>
                <line x1="100" y1="100" x2="130" y2="130" stroke="#111" stroke-width="4"></line>
                <line x1="50" y1="60" x2="65" y2="60" stroke="#6b7280" stroke-width="2"></line>
                <line x1="45" y1="80" x2="65" y2="80" stroke="#6b7280" stroke-width="2"></line>
                <line x1="50" y1="100" x2="70" y2="100" stroke="#6b7280" stroke-width="2"></line>
            </svg>
        </div>`}
    </div>
    `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}

export function createLodgingIcon(lodging: TripLodging, isActive: boolean): L.DivIcon {
    const imageUrl = lodging.thumbnail_url?.trim() || "";
    const hasImage = imageUrl.length > 0;
    const size = hasImage ? ( isActive ? 80 : 64) : ( isActive ? 70 : 50);
    const roofHeight = Math.round(size * 0.34);
    const roofHalfWidth = Math.round(size / 2);
    const roofBorderWidth = isActive ? 3 : 2;
    const roofInnerHeight = Math.max(roofHeight - roofBorderWidth, 1);
    const roofInnerWidth = Math.max((roofHalfWidth - roofBorderWidth) * 2, 2);
    const bodyWidth = Math.round(size * 0.78);
    const bodyHeight = size - roofHeight;
    const safeTitle = escapeHtml(lodging.title || "Lodging");
    const bodyTop = hasImage ? Math.max(roofHeight - roofBorderWidth, 0) : Math.max(roofHeight - 2, 0);
    const doorWidth = Math.max(Math.round(size * 0.16), 8);
    const doorHeight = Math.max(Math.round(bodyHeight * 0.45), 10);
    const windowSize = Math.max(Math.round(size * 0.16), 8);
    const houseBorderColor = isActive
        ? MARKER_ACTIVE_BORDER_COLOR
        : (hasImage ? MARKER_PRIMARY_COLOR : MARKER_SECONDARY_COLOR);
    const roofOverhang = Math.max(Math.floor((size - bodyWidth) / 2), 0);
    const roofConnectorLength = Math.max(roofOverhang, 1);

    return L.divIcon({
        className: "lodging-marker",
        html: `
    <div style="width:${size}px;height:${size}px;position:relative;cursor:pointer;">
        <div style="
        position:absolute;top:0;left:50%;transform:translateX(-50%);
        width:0;height:0;
        border-left:${roofHalfWidth}px solid transparent;
        border-right:${roofHalfWidth}px solid transparent;
        border-bottom:${roofHeight}px solid ${houseBorderColor};
        filter:drop-shadow(0 3px 8px ${MARKER_SHADOW});
        "></div>
        ${hasImage ? `<div style="
        position:absolute;
        top:${roofBorderWidth}px;
        left:50%;
        transform:translateX(-50%);
        width:${roofInnerWidth}px;
        height:${roofInnerHeight}px;
        background-image:url('${imageUrl}');
        background-size:${size}px ${size}px;
        background-position:center top;
        background-repeat:no-repeat;
        clip-path:polygon(50% 0%, 100% 100%, 0% 100%);
        "></div>` : ""}
        ${hasImage ? `<div style="
        position:absolute;
        top:${bodyTop}px;
        left:3px;
        width:${roofConnectorLength}px;
        height:${roofBorderWidth}px;
        background:${houseBorderColor};
        border-top-left-radius:999px;
        "></div>
        <div style="
        position:absolute;
        top:${bodyTop}px;
        right:3px;
        width:${roofConnectorLength}px;
        height:${roofBorderWidth}px;
        background:${houseBorderColor};
        border-top-right-radius:999px;
        "></div>` : ""}
        <div style="
        position:absolute;top:${bodyTop}px;left:50%;transform:translateX(-50%);
        width:${bodyWidth}px;height:${bodyHeight}px;
        border-radius:0 0 10px 10px;overflow:hidden;
        border:${isActive ? `3px solid ${houseBorderColor}` : `2px solid ${houseBorderColor}`};
        border-top:${hasImage ? "0" : (isActive ? `3px solid ${houseBorderColor}` : `2px solid ${houseBorderColor}`)};
        background:${hasImage ? `url('${imageUrl}')` : MARKER_PRIMARY_COLOR};
        background-size:${hasImage ? `${size}px ${size}px` : "auto"};
        background-position:${hasImage ? `center -${bodyTop}px` : "initial"};
        background-repeat:${hasImage ? "no-repeat" : "initial"};
        ">
        ${hasImage ? "" : `<div style="position:absolute;inset:0;">
            <div style="
                position:absolute;
                left:70%;bottom:0;
                transform:translateX(-50%);
                width:${doorWidth}px;height:${doorHeight}px;
                border-radius:3px 3px 0 0;
                background:${MARKER_SECONDARY_COLOR};
            " aria-hidden="true"></div>
            <div style="
                position:absolute;
                top:${Math.max(Math.round(bodyHeight * 0.3), 4)}px;
                left:${Math.max(Math.round(size * 0.12), 4)}px;
                width:${windowSize}px;height:${windowSize}px;
                border-radius:2px;
                background:${MARKER_SECONDARY_COLOR};
            " aria-hidden="true"></div>
        </div>`}
        </div>
    </div>
    `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}