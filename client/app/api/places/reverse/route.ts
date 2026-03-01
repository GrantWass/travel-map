import { NextResponse } from "next/server";

interface ReverseResponse {
  display_name?: unknown;
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
  const lat = toNumber(searchParams.get("lat"));
  const lon = toNumber(searchParams.get("lon"));

  if (lat === null || lon === null) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: `${lat}`,
      lon: `${lon}`,
      zoom: "18",
      addressdetails: "1",
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      cache: "no-store",
      headers: {
        "User-Agent": "travel-map/1.0",
      },
    });

    if (!response.ok) {
      throw new Error("Reverse lookup failed");
    }

    const payload = (await response.json()) as ReverseResponse;
    const label = typeof payload.display_name === "string" ? payload.display_name : null;

    if (!label) {
      throw new Error("No label found");
    }

    const normalizedLabel = removeZipCodeSegments(label);
    if (!normalizedLabel) {
      throw new Error("No normalized label found");
    }

    return NextResponse.json({
      place: {
        label: normalizedLabel,
        address: normalizedLabel,
        latitude: lat,
        longitude: lon,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not resolve this pin to an address." }, { status: 502 });
  }
}
