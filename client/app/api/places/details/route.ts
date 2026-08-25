import { NextResponse } from "next/server";

// Resolves a Google Places autocomplete selection to coordinates.
// One call per actual user selection — billed under Place Details Essentials
// (10k free/month). The session token ties this to the earlier autocomplete
// keystrokes so they bill as one session.

interface GooglePlaceDetails {
  id?: unknown;
  formattedAddress?: unknown;
  location?: {
    latitude?: unknown;
    longitude?: unknown;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("place_id")?.trim() ?? "";
  const sessionToken = searchParams.get("session_token");

  if (!placeId || !process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: "place lookup unavailable" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
    "X-Goog-FieldMask": "id,formattedAddress,location",
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4_000);

  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      method: "GET",
      headers,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "place lookup failed" }, { status: 502 });
    }

    const payload = (await response.json()) as GooglePlaceDetails;
    const latitude =
      payload.location && typeof payload.location.latitude === "number"
        ? payload.location.latitude
        : null;
    const longitude =
      payload.location && typeof payload.location.longitude === "number"
        ? payload.location.longitude
        : null;
    const formattedAddress =
      typeof payload.formattedAddress === "string" ? payload.formattedAddress : null;

    if (latitude === null || longitude === null) {
      return NextResponse.json({ error: "place has no location" }, { status: 502 });
    }

    return NextResponse.json(
      {
        label: formattedAddress ?? placeId,
        address: formattedAddress ?? "",
        latitude,
        longitude,
      },
      // Place coordinates are effectively immutable — cache hard at the edge.
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch {
    return NextResponse.json({ error: "place lookup failed" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
