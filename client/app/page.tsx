import MapPageClient from "@/components/map-page-client";
import type { Trip } from "@/lib/api-types";

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

export default async function Page() {
  const initialPublicTrips = await fetchInitialPublicTrips();
  return <MapPageClient initialPublicTrips={initialPublicTrips} />;
}
