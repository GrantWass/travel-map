import { create } from "zustand";

import { getPublicTrips, getTripChildrenBatch, getTripsBatch } from "@/lib/api-client";
import type { FriendshipRecord, Trip, TripActivity, TripLodging, TripDuration } from "@/lib/api-types";

export const MAX_COST = 500;
export const MAX_VISIBLE_TAGS = 15;

export const TRIP_DURATION_OPTIONS: { value: TripDuration; label: string }[] = [
  { value: "day trip", label: "Day Trip" },
  { value: "overnight trip", label: "Overnight" },
  { value: "multiday trip", label: "Multi-Day" },
];

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
  tripTypeFilter: TripDuration[];
  dateFrom: string;
  dateTo: string;
  setOwnerFilter: (value: OwnerFilter) => void;
  toggleTag: (tag: string) => void;
  setMaxCost: (value: number) => void;
  toggleTripType: (type: TripDuration) => void;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  clearFilters: () => void;
  syncTagsWithAvailability: (availableTags: string[]) => void;
}

export const useTripSearchStore = create<TripSearchState>((set) => ({
  ownerFilter: "all",
  selectedTags: [],
  maxCost: MAX_COST,
  tripTypeFilter: [],
  dateFrom: "",
  dateTo: "",
  setOwnerFilter: (ownerFilter) => set({ ownerFilter }),
  toggleTag: (tag) =>
    set((state) => ({
      selectedTags: state.selectedTags.includes(tag)
        ? state.selectedTags.filter((value) => value !== tag)
        : [...state.selectedTags, tag],
    })),
  setMaxCost: (maxCost) => set({ maxCost }),
  toggleTripType: (type) =>
    set((state) => ({
      tripTypeFilter: state.tripTypeFilter.includes(type)
        ? state.tripTypeFilter.filter((t) => t !== type)
        : [...state.tripTypeFilter, type],
    })),
  setDateFrom: (dateFrom) => set({ dateFrom }),
  setDateTo: (dateTo) => set({ dateTo }),
  clearFilters: () =>
    set({
      selectedTags: [],
      maxCost: MAX_COST,
      tripTypeFilter: [],
      dateFrom: "",
      dateTo: "",
    }),
  syncTagsWithAvailability: (availableTags) =>
    set((state) => ({
      selectedTags: state.selectedTags.filter((tag) => availableTags.includes(tag)),
    })),
}));

function normalizeMonthValue(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return null;
  }
  return `${match[1]}-${match[2]}`;
}

function getTripMonthValue(trip: Trip): string | null {
  const fromDate = normalizeMonthValue((trip.date ?? "").slice(0, 7));
  if (fromDate) {
    return fromDate;
  }

  const eventStart = normalizeMonthValue((trip.event_start ?? "").slice(0, 7));
  return eventStart;
}

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

export function filterTripsByDuration(trips: Trip[], tripTypeFilter: TripDuration[]): Trip[] {
  if (tripTypeFilter.length === 0) return trips;
  return trips.filter((trip) => {
    if (!trip.duration) return false;
    const duration = trip.duration.trim().toLowerCase();
    return tripTypeFilter.some((f) => f === duration);
  });
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
  tripTypeFilter?: TripDuration[];
  dateFrom?: string;
  dateTo?: string;
}

export function buildSearchResults({
  trips,
  query,
  ownerFilter,
  currentUserId,
  friendIds,
  selectedTags,
  maxCost,
  tripTypeFilter = [],
  dateFrom = "",
  dateTo = "",
}: BuildSearchResultsArgs): SearchResult[] {
  const textQuery = query.trim().toLowerCase();
  const fromMonth = normalizeMonthValue(dateFrom);
  const toMonth = normalizeMonthValue(dateTo);
  const ownerFilteredTrips = filterTripsByDuration(
    filterTripsByOwner(trips, ownerFilter, currentUserId, friendIds),
    tripTypeFilter,
  );

  const results: SearchResult[] = [];
  const seenTripIds = new Set<number>();

  for (const trip of ownerFilteredTrips) {
    if (seenTripIds.has(trip.trip_id)) continue;
    seenTripIds.add(trip.trip_id);
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

    if (fromMonth || toMonth) {
      const tripMonth = getTripMonthValue(trip);
      if (!tripMonth) {
        continue;
      }
      if (fromMonth && tripMonth < fromMonth) {
        continue;
      }
      if (toMonth && tripMonth > toMonth) {
        continue;
      }
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
