"use client";

import { useCallback, useRef, useState } from "react";

import { getDeferredTripIds, getTripsBatch, type MapBounds } from "@/lib/api-client";
import { fetchPublicTripsLightweight, hydrateTripChildrenOnly } from "@/stores/trip-search-store";
import { useTripMapStore } from "@/stores/trip-map-store";
import type { Trip } from "@/lib/api-types";

const CACHE_TTL_MS = 60_000;
const viewportCache = new Map<string, { trips: Trip[]; expiresAt: number }>();

function boundsKey(bounds: MapBounds): string {
  return [bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng]
    .map((value) => value.toFixed(1))
    .join(":");
}

async function fetchViewportTrips(bounds: MapBounds): Promise<Trip[]> {
  const key = boundsKey(bounds);
  const cached = viewportCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.trips;

  const [publicTrips, deferredIds] = await Promise.all([
    fetchPublicTripsLightweight(bounds),
    getDeferredTripIds(bounds).catch(() => [] as number[]),
  ]);
  const [children, deferredTrips] = await Promise.all([
    hydrateTripChildrenOnly(publicTrips.map((trip) => trip.trip_id)),
    getTripsBatch(deferredIds),
  ]);
  const childrenByTripId = new Map(children.map((entry) => [entry.trip_id, entry]));
  const hydratedPublic = publicTrips.map((trip) => ({ ...trip, ...childrenByTripId.get(trip.trip_id) }));
  const trips = [...hydratedPublic, ...deferredTrips];
  viewportCache.set(key, { trips, expiresAt: Date.now() + CACHE_TTL_MS });
  return trips;
}

export function useMapViewportTrips() {
  const mergeTrips = useTripMapStore((state) => state.mergeTrips);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestRef = useRef(0);

  const loadBounds = useCallback(async (bounds: MapBounds) => {
    const requestId = ++activeRequestRef.current;
    setIsRefreshing(true);
    setError(null);
    try {
      const trips = await fetchViewportTrips(bounds);
      if (requestId === activeRequestRef.current) mergeTrips(trips);
    } catch {
      if (requestId === activeRequestRef.current) setError("Could not load this area. Try again.");
    } finally {
      if (requestId === activeRequestRef.current) setIsRefreshing(false);
    }
  }, [mergeTrips]);

  return { loadBounds, isRefreshing, error };
}
