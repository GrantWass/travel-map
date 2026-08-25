import { Suspense } from "react";

import MapPageClient from "@/components/map-page-client";
import type { Trip } from "@/lib/api-types";

const MAP_PAGE_FALLBACK = (
  <div className="flex h-dvh w-full items-center justify-center bg-background">
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

async function fetchInitialPublicTrips(): Promise<Trip[]> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";
  const params = new URLSearchParams();
  params.set("include_children", "false");
  params.set("public_only", "true");

  try {
    const response = await fetch(`${apiBaseUrl}/trips?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { trips?: Trip[] };
    return Array.isArray(payload.trips) ? payload.trips : [];
  } catch {
    return [];
  }
}

async function fetchInitialDeferredTripIds(): Promise<number[]> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";

  try {
    const response = await fetch(`${apiBaseUrl}/trips/deferred-ids`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { trip_ids?: number[] };
    return Array.isArray(payload.trip_ids) ? payload.trip_ids : [];
  } catch {
    return [];
  }
}

async function MapPageData() {
  // Fetch both in parallel so neither blocks the other.
  const [initialPublicTrips, initialDeferredTripIds] = await Promise.all([
    fetchInitialPublicTrips(),
    fetchInitialDeferredTripIds(),
  ]);
  return (
    <MapPageClient
      initialPublicTrips={initialPublicTrips}
      initialDeferredTripIds={initialDeferredTripIds}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={MAP_PAGE_FALLBACK}>
      <MapPageData />
    </Suspense>
  );
}
