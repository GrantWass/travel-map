import type { PlaceCenter, PlaceOption } from "@/src/types/places";

type SearchMode = "city" | "address";

const CITY_LIKE_TYPES = new Set([
  "city",
  "town",
  "village",
  "suburb",
  "hamlet",
  "municipality",
  "borough",
]);

const COUNTY_LIKE_TYPES = new Set(["county"]);

interface NominatimSearchResult {
  display_name?: unknown;
  lat?: unknown;
  lon?: unknown;
  type?: unknown;
  addresstype?: unknown;
  address?: {
    country_code?: unknown;
  };
}

interface NominatimReverseResult {
  display_name?: unknown;
}

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
    .filter((segment) => segment.length > 0)
    .join(", ");
}

function asPlaceOption(item: NominatimSearchResult): (PlaceOption & { type: string; addresstype: string }) | null {
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
    lat === null ||
    lon === null ||
    Number.isNaN(lat) ||
    Number.isNaN(lon) ||
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
    address: normalizedLabel,
    latitude: lat,
    longitude: lon,
    type,
    addresstype,
  };
}

export async function searchPlaces(
  query: string,
  mode: SearchMode,
  cityContext: PlaceCenter | null,
): Promise<PlaceOption[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmed,
    format: "jsonv2",
    limit: mode === "city" ? "12" : "8",
    addressdetails: "1",
    countrycodes: "us",
  });

  if (mode === "address" && cityContext) {
    const lonOffset = 0.35;
    const latOffset = 0.25;

    params.set(
      "viewbox",
      `${cityContext.longitude - lonOffset},${cityContext.latitude + latOffset},${cityContext.longitude + lonOffset},${cityContext.latitude - latOffset}`,
    );
    params.set("bounded", "1");
  }

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      "User-Agent": "travel-map-ios/1.0",
      "Accept-Language": "en-US",
    },
  });
  if (!response.ok) {
    throw new Error("Could not load places right now.");
  }

  const raw = (await response.json()) as NominatimSearchResult[];
  const basePlaces = raw
    .map(asPlaceOption)
    .filter((place): place is PlaceOption & { type: string; addresstype: string } => Boolean(place));

  const filtered =
    mode === "city"
      ? basePlaces.filter((place) => CITY_LIKE_TYPES.has(place.addresstype) || CITY_LIKE_TYPES.has(place.type))
      : basePlaces;

  const finalPlaces = mode === "city" && filtered.length > 0 ? filtered : basePlaces;

  return finalPlaces.slice(0, mode === "city" ? 8 : 6).map((place) => ({
    label: place.label,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
  }));
}

export async function reverseGeocode(lat: number, lon: number): Promise<PlaceOption> {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lon),
    zoom: "18",
    addressdetails: "1",
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: {
      "User-Agent": "travel-map-ios/1.0",
      "Accept-Language": "en-US",
    },
  });
  if (!response.ok) {
    throw new Error("Could not resolve this pin to an address.");
  }

  const payload = (await response.json()) as NominatimReverseResult;
  const rawLabel = typeof payload.display_name === "string" ? payload.display_name : null;
  const label = rawLabel ? removeZipCodeSegments(rawLabel) : null;

  if (!label) {
    throw new Error("Could not resolve this pin to an address.");
  }

  return {
    label,
    address: label,
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lon.toFixed(6)),
  };
}
