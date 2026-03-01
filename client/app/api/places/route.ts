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
    .filter((segment) => segment.length > 0)
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const mode = searchParams.get("mode") === "city" ? "city" : "address";
  const nearLat = toNumber(searchParams.get("near_lat"));
  const nearLon = toNumber(searchParams.get("near_lon"));

  if (query.length < 2) {
    return NextResponse.json({ places: [] });
  }

  try {
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

    return NextResponse.json({
      places: places.slice(0, mode === "city" ? 8 : 6).map((place) => ({
        label: place.label,
        latitude: place.latitude,
        longitude: place.longitude,
        address: place.address,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Could not load places right now." }, { status: 502 });
  }
}
