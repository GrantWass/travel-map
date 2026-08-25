import { NextResponse } from "next/server";

interface NominatimResult {
  display_name?: unknown;
  lat?: unknown;
  lon?: unknown;
  type?: unknown;
  addresstype?: unknown;
  address?: {
    country_code?: unknown;
  };
}

const CITY_LIKE_TYPES = new Set([
  "city",
  "town",
  "village",
  "suburb",
  "hamlet",
  "municipality",
  "borough",
]);

// ── Google Places provider (optional) ────────────────────────────────────────
//
// When GOOGLE_PLACES_API_KEY is configured, searches go through Google's
// Autocomplete (New) endpoint first and fall back to Nominatim on any failure.
// Billing note: autocomplete keystrokes are bundled into a free session via the
// session token; coordinates are resolved separately by /api/places/details
// (one Essentials call per selection). If Google rejects a request due to
// quota/billing, we disable it for the rest of the day and serve Nominatim,
// guaranteeing no surprise charges.

const GOOGLE_DISABLED_KEY = "google-places-disabled-until";
declare global {
  // eslint-disable-next-line no-var
  var __googlePlacesDisabledUntil: number | undefined;
}

function isGoogleEnabled(): boolean {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return false;
  }
  const disabledUntil = globalThis.__googlePlacesDisabledUntil ?? 0;
  return Date.now() >= disabledUntil;
}

function disableGoogleForRestOfDay() {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  globalThis.__googlePlacesDisabledUntil = endOfDay.getTime();
}

interface GoogleAutocompleteSuggestion {
  placeId?: unknown;
  text?: { text?: unknown };
  structuredFormat?: {
    mainText?: { text?: unknown };
    secondaryText?: { text?: unknown };
  };
}

async function searchGooglePlaces(
  query: string,
  mode: string,
  nearLat: number | null,
  nearLon: number | null,
  sessionToken: string | null,
): Promise<Array<{ label: string; address: string; placeId: string; needsDetails: true }> | null> {
  try {
    const body: Record<string, unknown> = {
      input: query,
      languageCode: "en",
      regionCode: "us",
    };

    if (sessionToken) {
      body.sessionToken = sessionToken;
    }

    if (mode === "address" && nearLat !== null && nearLon !== null) {
      body.locationBias = {
        circle: {
          center: { latitude: nearLat, longitude: nearLon },
          radius: 50_000,
        },
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4_000);

    try {
      const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        // Quota exhausted, billing issue, or outage — stop trying Google today.
        if (response.status === 429 || response.status === 403 || response.status >= 500) {
          disableGoogleForRestOfDay();
        }
        return null;
      }

      const payload = (await response.json()) as { suggestions?: GoogleAutocompleteSuggestion[] };
      const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];

      const results = suggestions
        .map((suggestion) => {
          const placeId = typeof suggestion.placeId === "string" ? suggestion.placeId : null;
          const mainText =
            suggestion.structuredFormat?.mainText?.text != null &&
            typeof suggestion.structuredFormat.mainText.text === "string"
              ? suggestion.structuredFormat.mainText.text
              : null;
          const secondaryText =
            suggestion.structuredFormat?.secondaryText?.text != null &&
            typeof suggestion.structuredFormat.secondaryText.text === "string"
              ? suggestion.structuredFormat.secondaryText.text
              : null;

          if (!placeId || !mainText) {
            return null;
          }

          return {
            label: mainText,
            address: secondaryText ?? mainText,
            placeId,
            needsDetails: true as const,
          };
        })
        .filter(
          (item): item is { label: string; address: string; placeId: string; needsDetails: true } =>
            Boolean(item),
        );

      return results.slice(0, 6);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return null;
  }
}

// ── Nominatim provider ───────────────────────────────────────────────────────

const COUNTY_LIKE_TYPES = new Set(["county"]);

function isCountyLike(value: string): boolean {
  return COUNTY_LIKE_TYPES.has(value) || /\b(county|parish)\b/i.test(value);
}

function removeCountySegments(label: string): string {
  return label
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && !/\b(county|parish)\b/i.test(segment))
    .join(", ");
}

function removeZipCodeSegments(label: string): string {
  return label
    .split(",")
    .map((segment) =>
      segment
        .replace(/\b\d{5}(?:-\d{4})?\b/g, "")
        .replace(/\s{2,}/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join(", ");
}

function toNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

async function searchNominatim(
  query: string,
  mode: string,
  nearLat: number | null,
  nearLon: number | null,
) {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: mode === "city" ? "12" : "8",
    addressdetails: "1",
    countrycodes: "us",
  });

  if (mode === "address" && nearLat !== null && nearLon !== null) {
    const lonOffset = 0.35;
    const latOffset = 0.25;
    const left = nearLon - lonOffset;
    const right = nearLon + lonOffset;
    const top = nearLat + latOffset;
    const bottom = nearLat - latOffset;

    params.set("viewbox", `${left},${top},${right},${bottom}`);
    params.set("bounded", "1");
  }

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    cache: "no-store",
    headers: {
      "User-Agent": "travel-map/1.0",
    },
  });

  if (!response.ok) {
    throw new Error("Place search failed");
  }

  const raw = (await response.json()) as NominatimResult[];

  const basePlaces = raw
    .map((item) => {
      const label = typeof item.display_name === "string" ? item.display_name : null;
      const lat = typeof item.lat === "string" ? Number(item.lat) : null;
      const lon = typeof item.lon === "string" ? Number(item.lon) : null;
      const type = typeof item.type === "string" ? item.type : "";
      const addresstype = typeof item.addresstype === "string" ? item.addresstype : "";
      const countryCode =
        item.address && typeof item.address.country_code === "string"
          ? item.address.country_code.toLowerCase()
          : "";

      if (
        !label ||
        Number.isNaN(lat) ||
        Number.isNaN(lon) ||
        lat === null ||
        lon === null ||
        countryCode !== "us" ||
        isCountyLike(type) ||
        isCountyLike(addresstype)
      ) {
        return null;
      }

      const normalizedLabel = removeZipCodeSegments(removeCountySegments(label));
      if (!normalizedLabel) {
        return null;
      }

      return {
        label: normalizedLabel,
        latitude: lat,
        longitude: lon,
        address: normalizedLabel,
        type,
        addresstype,
      };
    })
    .filter(
      (place): place is {
        label: string;
        latitude: number;
        longitude: number;
        address: string;
        type: string;
        addresstype: string;
      } => Boolean(place),
    );

  let places = basePlaces;
  if (mode === "city") {
    const filtered = basePlaces.filter(
      (place) => CITY_LIKE_TYPES.has(place.addresstype) || CITY_LIKE_TYPES.has(place.type),
    );
    places = filtered.length > 0 ? filtered : basePlaces;
  }

  return places.slice(0, mode === "city" ? 8 : 6).map((place) => ({
    label: place.label,
    latitude: place.latitude,
    longitude: place.longitude,
    address: place.address,
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const mode = searchParams.get("mode") === "city" ? "city" : "address";
  const nearLat = toNumber(searchParams.get("near_lat"));
  const nearLon = toNumber(searchParams.get("near_lon"));
  const sessionToken = searchParams.get("session_token");

  if (query.length < 2) {
    return NextResponse.json({ places: [] });
  }

  const cacheHeaders = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };

  // Primary: Google Places autocomplete (when configured and healthy).
  if (isGoogleEnabled()) {
    const googleResults = await searchGooglePlaces(query, mode, nearLat, nearLon, sessionToken);
    if (googleResults !== null) {
      return NextResponse.json({ places: googleResults, source: "google" }, { headers: cacheHeaders });
    }
    // fall through to Nominatim
  }

  try {
    const places = await searchNominatim(query, mode, nearLat, nearLon);
    return NextResponse.json({ places, source: "nominatim" }, { headers: cacheHeaders });
  } catch {
    return NextResponse.json({ error: "Could not load places right now." }, { status: 502 });
  }
}
