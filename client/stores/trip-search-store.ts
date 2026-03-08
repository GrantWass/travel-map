import { create } from "zustand";

import { getPublicTrips, getTripChildrenBatch, getTripsBatch } from "@/lib/api-client";
import type { FriendshipRecord, Trip, TripActivity, TripLodging } from "@/lib/api-types";

export const MAX_COST = 500;
export const MAX_VISIBLE_TAGS = 15;

export type OwnerFilter = "all" | "friends" | "you";

export interface SearchResult {
  trip: Trip;
  matchedActivities: TripActivity[];
  matchedLodgings: TripLodging[];
}

interface TripSearchState {
  ownerFilter: OwnerFilter;
  selectedTags: string[];
  maxCost: number;
  setOwnerFilter: (value: OwnerFilter) => void;
  toggleTag: (tag: string) => void;
  setMaxCost: (value: number) => void;
  clearFilters: () => void;
  syncTagsWithAvailability: (availableTags: string[]) => void;
}

export const useTripSearchStore = create<TripSearchState>((set) => ({
  ownerFilter: "all",
  selectedTags: [],
  maxCost: MAX_COST,
  setOwnerFilter: (ownerFilter) => set({ ownerFilter }),
  toggleTag: (tag) =>
    set((state) => ({
      selectedTags: state.selectedTags.includes(tag)
        ? state.selectedTags.filter((value) => value !== tag)
        : [...state.selectedTags, tag],
    })),
  setMaxCost: (maxCost) => set({ maxCost }),
  clearFilters: () => set({ selectedTags: [], maxCost: MAX_COST }),
  syncTagsWithAvailability: (availableTags) =>
    set((state) => ({
      selectedTags: state.selectedTags.filter((tag) => availableTags.includes(tag)),
    })),
}));

export async function hydrateTripsWithChildren(tripIds: number[]): Promise<Trip[]> {
  if (tripIds.length === 0) {
    return [];
  }
  return getTripsBatch(tripIds);
}

export async function hydrateTripChildrenOnly(tripIds: number[]) {
  return getTripChildrenBatch(tripIds);
}

export async function fetchDeferredTripsWithChildren(tripIds: number[]): Promise<Trip[]> {
  if (tripIds.length === 0) {
    return [];
  }
  return getTripsBatch(tripIds);
}

export async function fetchPublicTripsLightweight(): Promise<Trip[]> {
  const apiTrips = await getPublicTrips();
  const now = new Date();

  return apiTrips
    .filter((trip): trip is Trip => Boolean(trip))
    .filter(
      (trip) =>
        !(trip.event_end && trip.event_start) ||
        (trip.event_end !== null && new Date(trip.event_end) > now),
    );
}

export function getFriendIds(
  acceptedFriendships: FriendshipRecord[],
  currentUserId: number | null,
): number[] {
  if (currentUserId === null) {
    return [];
  }

  return acceptedFriendships.map((friendship) =>
    friendship.requester_id === currentUserId
      ? friendship.addressee_id
      : friendship.requester_id,
  );
}

export function getAvailableTags(trips: Trip[]): string[] {
  const counts = new Map<string, number>();

  for (const trip of trips) {
    for (const rawTag of trip.tags) {
      const normalized = rawTag.trim().toLowerCase();
      if (!normalized) {
        continue;
      }
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, MAX_VISIBLE_TAGS)
    .map(([tag]) => tag);
}

export function filterTripsByOwner(
  trips: Trip[],
  ownerFilter: OwnerFilter,
  currentUserId: number | null,
  friendIds: number[],
): Trip[] {
  if (ownerFilter === "all") {
    return trips;
  }

  if (ownerFilter === "you") {
    return trips.filter((trip) => {
      const ownerId = trip.owner_user_id ?? trip.owner?.user_id ?? null;
      return currentUserId !== null && ownerId === currentUserId;
    });
  }

  return trips.filter((trip) => {
    const ownerId = trip.owner_user_id ?? trip.owner?.user_id ?? null;
    return ownerId !== null && friendIds.includes(ownerId);
  });
}

interface BuildSearchResultsArgs {
  trips: Trip[];
  query: string;
  ownerFilter: OwnerFilter;
  currentUserId: number | null;
  friendIds: number[];
  selectedTags: string[];
  maxCost: number;
}

export function buildSearchResults({
  trips,
  query,
  ownerFilter,
  currentUserId,
  friendIds,
  selectedTags,
  maxCost,
}: BuildSearchResultsArgs): SearchResult[] {
  const textQuery = query.trim().toLowerCase();
  const ownerFilteredTrips = filterTripsByOwner(
    trips,
    ownerFilter,
    currentUserId,
    friendIds,
  );

  const results: SearchResult[] = [];

  for (const trip of ownerFilteredTrips) {
    const normalizedTripTags = new Set(
      trip.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
    );

    if (
      selectedTags.length > 0 &&
      !selectedTags.every((tag) => normalizedTripTags.has(tag))
    ) {
      continue;
    }

    if (maxCost < MAX_COST && trip.cost !== null && trip.cost > maxCost) {
      continue;
    }

    if (!textQuery) {
      results.push({ trip, matchedActivities: [], matchedLodgings: [] });
      continue;
    }

    const tripMatches =
      trip.title.toLowerCase().includes(textQuery) ||
      trip.owner?.name?.toLowerCase().includes(textQuery);

    const matchedActivities = trip.activities.filter(
      (activity) =>
        activity?.title?.toLowerCase().includes(textQuery) ||
        activity?.address?.toLowerCase().includes(textQuery) ||
        activity?.description?.toLowerCase().includes(textQuery),
    );

    const matchedLodgings = trip.lodgings.filter(
      (lodging) =>
        lodging?.title?.toLowerCase().includes(textQuery) ||
        lodging?.address?.toLowerCase().includes(textQuery) ||
        lodging?.description?.toLowerCase().includes(textQuery),
    );

    if (tripMatches || matchedActivities.length > 0 || matchedLodgings.length > 0) {
      results.push({ trip, matchedActivities, matchedLodgings });
    }
  }

  return results.sort((left, right) => {
    const rightScore = right.trip.priority_score ?? 0;
    const leftScore = left.trip.priority_score ?? 0;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    return right.trip.trip_id - left.trip.trip_id;
  });
}
