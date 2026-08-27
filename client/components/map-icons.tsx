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

function sanitizeImageUrl(raw: string): string {
    // Encode unsafe characters while preserving valid URL structure.
    const trimmed = raw.trim();
    if (!trimmed) {
        return "";
    }
    try {
        return encodeURI(trimmed);
    } catch {
        return "";
    }
}

const MARKER_THUMB_WIDTH = 128;

// Hosts allowed through the Next image optimizer (mirrors next.config.mjs).
const OPTIMIZER_HOST_SUFFIXES = ["amazonaws.com", "images.unsplash.com", "placehold.co"];

// Markers render at 50-80px, so serve a small optimized variant instead of the
// full-size stored image when possible; other hosts fall back to the raw URL.
function markerImageUrl(raw: string): string {
    const url = sanitizeImageUrl(raw);
    if (!url || url.startsWith("/")) {
        return url;
    }
    try {
        const hostname = new URL(url).hostname;
        const isOptimizable = OPTIMIZER_HOST_SUFFIXES.some(
            (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
        );
        if (!isOptimizable) {
            return url;
        }
        // q must stay within next.config images.qualities (default [75]) or the
        // optimizer rejects the request with a 400.
        return `/_next/image?url=${encodeURIComponent(url)}&w=${MARKER_THUMB_WIDTH}&q=75`;
    } catch {
        return url;
    }
}

const MARKER_IMG_ATTRS = `loading="lazy" decoding="async" onerror="this.style.display='none'"`;

// Amber glyph fallbacks (matching MARKER_POPUP_BADGE_COLOR) used anywhere a
// marker would show a photo but none is available.
function activityGlyphSvg(px: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${px}" height="${px}" aria-hidden="true">
                <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" fill="${MARKER_POPUP_BADGE_COLOR}"></path>
                <circle cx="12" cy="10" r="3" fill="${MARKER_PRIMARY_COLOR}"></circle>
            </svg>`;
}

function lodgingGlyphSvg(px: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${px}" height="${px}" aria-hidden="true">
                <path d="M12 2.8 3.2 9.9a1.6 1.6 0 0 0-.6 1.25V19.4c0 .88.72 1.6 1.6 1.6h15.6c.88 0 1.6-.72 1.6-1.6v-8.25c0-.49-.22-.95-.6-1.25Z" fill="${MARKER_POPUP_BADGE_COLOR}"></path>
                <path d="M10.1 21v-5.1c0-.61.49-1.1 1.1-1.1h1.6c.61 0 1.1.49 1.1 1.1V21Z" fill="${MARKER_PRIMARY_COLOR}"></path>
                <rect x="15.4" y="13.4" width="2.4" height="2.4" rx="0.4" fill="${MARKER_PRIMARY_COLOR}"></rect>
                <rect x="6.2" y="13.4" width="2.4" height="2.4" rx="0.4" fill="${MARKER_PRIMARY_COLOR}"></rect>
            </svg>`;
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
    const imageUrl = markerImageUrl(trip.thumbnail_url || "");
    const hasImage = imageUrl.length > 0;
        const size = hasImage ? (isActive ? 80 : 64) : (isActive ? 56 : 44);
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
        display:flex;align-items:center;justify-content:center;
        ">
        ${hasImage ? `<img
            src="${imageUrl}"
            alt="${safeAltTitle}"
            ${MARKER_IMG_ATTRS}
            style="display:block;width:100%;height:100%;object-fit:cover;"
        />
        <div style="
            position:absolute;left:0;right:0;bottom:0;padding:4px 6px;
            background:${MARKER_GRADIENT_OVERLAY};
            color:${MARKER_PRIMARY_COLOR};font-size:10px;font-weight:600;font-family:system-ui,sans-serif;
        ">${safeLabelTitle}</div>` : activityGlyphSvg(Math.max(Math.round(size * 0.62), 14))}
        </div>
    </div>
    `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}

const CLUSTER_SIZE = 72;

export function createClusterIcon(trip: Trip, count: number): L.DivIcon {
    const safeAltTitle = escapeHtml(trip.title);
    const safeLabelTitle = escapeHtml(truncateTripMarkerTitle(trip.title, MAP_MARKER_TITLE_MAX_CHARS));
    const imageUrl = markerImageUrl(trip.thumbnail_url || "");
    const hasImage = imageUrl.length > 0;
    const size = CLUSTER_SIZE;

    const countBadge = `<div style="
        position:absolute;top:-6px;right:-6px;
        min-width:20px;height:20px;padding:0 5px;border-radius:10px;
        background:${MARKER_POPUP_BADGE_COLOR};border:2px solid ${MARKER_PRIMARY_COLOR};
        display:flex;align-items:center;justify-content:center;
        font-size:10px;font-weight:700;color:${MARKER_PRIMARY_COLOR};font-family:system-ui,sans-serif;
        box-shadow:0 1px 4px ${MARKER_SHADOW};line-height:1;box-sizing:border-box;
    ">${count}</div>`;

    return L.divIcon({
        className: "cluster-photo-marker",
        html: `
<div style="width:${size}px;height:${size}px;position:relative;cursor:pointer;">
    <div style="
        position:relative;width:100%;height:100%;border-radius:12px;overflow:hidden;
        border:2.5px solid ${MARKER_POPUP_BADGE_COLOR};
        box-shadow:0 4px 20px ${MARKER_SHADOW};
        background:${MARKER_PRIMARY_COLOR};
    ">
        ${hasImage
            ? `<img src="${imageUrl}" alt="${safeAltTitle}" ${MARKER_IMG_ATTRS} style="display:block;width:100%;height:100%;object-fit:cover;" />
               <div style="
                   position:absolute;left:0;right:0;bottom:0;padding:4px 6px;
                   background:${MARKER_GRADIENT_OVERLAY};
                   color:${MARKER_PRIMARY_COLOR};font-size:10px;font-weight:600;font-family:system-ui,sans-serif;
               ">${safeLabelTitle}</div>`
            : `<div style="
                   display:flex;align-items:center;justify-content:center;
                   width:100%;height:100%;padding:4px;
                   color:#6b7280;font-size:10px;font-weight:600;font-family:system-ui,sans-serif;
                   text-align:center;
               ">${safeLabelTitle}</div>`
        }
    </div>
    ${countBadge}
</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}

export function createActivityIcon(activity: TripActivity, isActive: boolean): L.DivIcon {
    const safeTitle = escapeHtml(activity.title || "Activity");
    const imageUrl = markerImageUrl(activity.thumbnail_url || "");
    const hasImage = imageUrl.length > 0;
    const size = hasImage ? ( isActive ? 80 : 64) : ( isActive ? 54 : 42);

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
        ${MARKER_IMG_ATTRS}
        style="width:100%;height:100%;object-fit:cover;"
        />` : `<div style="
        position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        display:flex;align-items:center;justify-content:center;
        " aria-hidden="true">
            ${activityGlyphSvg(Math.max(Math.round(size * 0.62), 14))}
        </div>`}
    </div>
    `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}

export function createLodgingIcon(lodging: TripLodging, isActive: boolean): L.DivIcon {
    const imageUrl = markerImageUrl(lodging.thumbnail_url || "");
    const hasImage = imageUrl.length > 0;
    const size = hasImage ? ( isActive ? 80 : 64) : ( isActive ? 54 : 42);
    const safeTitle = escapeHtml(lodging.title || "Stay");
    const borderColor = isActive ? MARKER_ACTIVE_BORDER_COLOR : MARKER_PRIMARY_COLOR;
    const iconPx = Math.max(Math.round(size * 0.62), 14);

    const houseGlyph = lodgingGlyphSvg(iconPx);

    // No photo: clean circular badge with an amber house glyph, matching the
    // activity pin's style.
    if (!hasImage) {
        return L.divIcon({
            className: "lodging-marker",
            html: `
    <div style="
        width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;
        border:${isActive ? `3px solid ${borderColor}` : `2px solid ${borderColor}`};
        box-shadow:0 2px 12px ${MARKER_SHADOW};cursor:pointer;background:${MARKER_PRIMARY_COLOR};
        position:relative;display:flex;align-items:center;justify-content:center;
    " aria-hidden="true">${houseGlyph}</div>
    `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
    }

    const roofHeight = Math.round(size * 0.34);
    const roofHalfWidth = Math.round(size / 2);
    const roofBorderWidth = isActive ? 3 : 2;
    const roofInnerHeight = Math.max(roofHeight - roofBorderWidth, 1);
    const roofInnerWidth = Math.max((roofHalfWidth - roofBorderWidth) * 2, 2);
    const bodyWidth = Math.round(size * 0.78);
    const bodyHeight = size - roofHeight;
    const bodyTop = Math.max(roofHeight - roofBorderWidth, 0);
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
        border-bottom:${roofHeight}px solid ${borderColor};
        filter:drop-shadow(0 3px 8px ${MARKER_SHADOW});
        "></div>
        <div style="
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
        "></div>
        <div style="
        position:absolute;
        top:${bodyTop}px;
        left:3px;
        width:${roofConnectorLength}px;
        height:${roofBorderWidth}px;
        background:${borderColor};
        border-top-left-radius:999px;
        "></div>
        <div style="
        position:absolute;
        top:${bodyTop}px;
        right:3px;
        width:${roofConnectorLength}px;
        height:${roofBorderWidth}px;
        background:${borderColor};
        border-top-right-radius:999px;
        "></div>
        <div style="
        position:absolute;top:${bodyTop}px;left:50%;transform:translateX(-50%);
        width:${bodyWidth}px;height:${bodyHeight}px;
        border-radius:0 0 10px 10px;overflow:hidden;
        border:${isActive ? `3px solid ${borderColor}` : `2px solid ${borderColor}`};
        border-top:0;
        background-image:url('${imageUrl}');
        background-size:${size}px ${size}px;
        background-position:center -${bodyTop}px;
        background-repeat:no-repeat;
        "></div>
    </div>
    `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}
