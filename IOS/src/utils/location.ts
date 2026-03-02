import type { Trip } from "@/src/types/api";

export function getLocationKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)}:${lng.toFixed(6)}`;
}

export function getTripTimestamp(dateValue: string | null | undefined): number {
  const timestamp = Date.parse(dateValue ?? "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function getMostRecentTripsByLocation(trips: Trip[]): Trip[] {
  const mostRecentByLocation = new Map<string, Trip>();

  for (const trip of trips) {
    const key = getLocationKey(trip.latitude, trip.longitude);
    const current = mostRecentByLocation.get(key);
    if (!current || getTripTimestamp(trip.date) > getTripTimestamp(current.date)) {
      mostRecentByLocation.set(key, trip);
    }
  }

  return Array.from(mostRecentByLocation.values());
}
