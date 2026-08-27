import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { TripDuration } from './api-types'

const TRIP_DURATION_LABELS: Record<TripDuration, string> = {
  "day trip": "Day Trip",
  "overnight trip": "Overnight Trip",
  "multiday trip": "Multi-Day Trip",
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function initialsFromName(value: string): string {
    const initials = value
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("")
        .slice(0, 2);
    return initials || "TR";
}

export function formatTripDate(value: string): string {
    const trimmed = value.trim();
    const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(trimmed);
    if (!match) {
        return value;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || month < 1 || month > 12) {
        return value;
    }

    const date = new Date(Date.UTC(year, month - 1, 1));
    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
}

export function formatTripDuration(value: string | null | undefined): string {
  if (!value) {
    return "Duration Flexible"
  }

  const normalized = value.trim().toLowerCase() as TripDuration
  if (normalized in TRIP_DURATION_LABELS) {
    return TRIP_DURATION_LABELS[normalized]
  }

  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function getLocationKey(lat: number, lng: number): string {
    return `${lat.toFixed(6)}:${lng.toFixed(6)}`;
}

/**
 * Cleans a raw address string by normalizing state+zip and removing US/country/zip-only parts.
 * `maxParts` controls how many comma-separated segments to keep.
 * `fromEnd` — when true, keeps the *last* N parts instead of the first N (useful for "City, ST" labels).
 */
export function formatAddress(
  address: string | null | undefined,
  maxParts = 3,
  { fromEnd = false } = {},
): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const cleaned = parts
    .map((part) => {
      const stateZip = part.match(/^([A-Z]{2})\s+\d{5}(-\d{4})?$/i);
      if (stateZip) return stateZip[1].toUpperCase();
      return part;
    })
    .filter((part) => {
      if (/^(USA|United States(?: of America)?|US)$/i.test(part)) return false;
      if (/^\d{5}(-\d{4})?$/.test(part)) return false;
      return true;
    });
  let displayParts = cleaned;

  // Google place labels often repeat a POI followed by its street, neighborhood,
  // city, region, and country. Keep the named place, but drop the street when the
  // first segment is clearly the destination rather than the street address.
  const looksLikeStreet = (part: string) =>
    /^\d+\s/.test(part) || /^(?:calle|street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|drive|dr\.?|lane|ln\.?|highway|hwy\.?|route|rue|via)\b/i.test(part);
  if (displayParts.length > maxParts && !looksLikeStreet(displayParts[0]) && looksLikeStreet(displayParts[1])) {
    displayParts = [displayParts[0], ...displayParts.slice(2)];
  }

  // Prefer the more specific locality when adjacent levels repeat it, e.g.
  // "Viejo San Juan, San Juan" becomes "Viejo San Juan".
  displayParts = displayParts.filter((part, index, all) => {
    const previous = all[index - 1];
    if (!previous) return true;
    const normalizedPart = part.toLocaleLowerCase();
    const normalizedPrevious = previous.toLocaleLowerCase();
    return normalizedPrevious !== normalizedPart && !normalizedPrevious.endsWith(` ${normalizedPart}`);
  });

  const slice = fromEnd ? displayParts.slice(-maxParts) : displayParts.slice(0, maxParts);
  return slice.join(", ") || null;
}

export function getTripTimestamp(dateValue: string): number {
    const timestamp = Date.parse(dateValue);
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function toDisplayDate(dateValue: string | null | undefined): string {
  if (!dateValue) {
    return "No date";
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

/**
 * Opens the native share sheet when available, otherwise copies to clipboard.
 * Returns "copied" so callers can flash a confirmation, or "dismissed" if the
 * user closed the sheet or the clipboard was unavailable.
 */
export async function shareOrCopyUrl(
  url: string,
  title: string,
): Promise<"shared" | "copied" | "dismissed"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch {
      // User dismissed the share sheet.
      return "dismissed";
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "dismissed";
  }
}
