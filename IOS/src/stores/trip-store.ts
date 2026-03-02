import { create } from "zustand";

import type { Trip, TripActivity, TripLodging } from "@/src/types/api";

interface TripStoreState {
  trips: Trip[];
  selectedTrip: Trip | null;
  selectedActivity: TripActivity | null;
  selectedLodging: TripLodging | null;
  savedActivityIds: number[];
  savedLodgingIds: number[];
  isLoadingTrips: boolean;
  isLoadingTripById: boolean;
  setTrips: (trips: Trip[]) => void;
  upsertTrip: (trip: Trip) => void;
  removeTripById: (tripId: number) => void;
  setSelectedTrip: (trip: Trip | null) => void;
  setSelectedActivity: (activity: TripActivity | null) => void;
  setSelectedLodging: (lodging: TripLodging | null) => void;
  clearSelections: () => void;
  setSavedActivityIds: (ids: number[]) => void;
  setSavedLodgingIds: (ids: number[]) => void;
  toggleSavedActivityId: (id: number) => void;
  toggleSavedLodgingId: (id: number) => void;
  removeSavedActivityId: (id: number) => void;
  removeSavedLodgingId: (id: number) => void;
  setIsLoadingTrips: (isLoading: boolean) => void;
  setIsLoadingTripById: (isLoading: boolean) => void;
}

export const useTripStore = create<TripStoreState>((set) => ({
  trips: [],
  selectedTrip: null,
  selectedActivity: null,
  selectedLodging: null,
  savedActivityIds: [],
  savedLodgingIds: [],
  isLoadingTrips: true,
  isLoadingTripById: false,
  setTrips: (trips) => set({ trips }),
  upsertTrip: (trip) =>
    set((state) => {
      const index = state.trips.findIndex((item) => item.trip_id === trip.trip_id);
      if (index < 0) {
        return { trips: [trip, ...state.trips] };
      }

      const nextTrips = [...state.trips];
      nextTrips[index] = trip;
      return {
        trips: nextTrips,
        selectedTrip: state.selectedTrip?.trip_id === trip.trip_id ? trip : state.selectedTrip,
      };
    }),
  removeTripById: (tripId) =>
    set((state) => ({
      trips: state.trips.filter((trip) => trip.trip_id !== tripId),
      selectedTrip: state.selectedTrip?.trip_id === tripId ? null : state.selectedTrip,
      selectedActivity: null,
      selectedLodging: null,
    })),
  setSelectedTrip: (selectedTrip) => set({ selectedTrip }),
  setSelectedActivity: (selectedActivity) =>
    set((state) => ({
      selectedActivity,
      selectedLodging: selectedActivity ? null : state.selectedLodging,
    })),
  setSelectedLodging: (selectedLodging) =>
    set((state) => ({
      selectedLodging,
      selectedActivity: selectedLodging ? null : state.selectedActivity,
    })),
  clearSelections: () => set({ selectedTrip: null, selectedActivity: null, selectedLodging: null }),
  setSavedActivityIds: (savedActivityIds) => set({ savedActivityIds }),
  setSavedLodgingIds: (savedLodgingIds) => set({ savedLodgingIds }),
  toggleSavedActivityId: (id) =>
    set((state) => ({
      savedActivityIds: state.savedActivityIds.includes(id)
        ? state.savedActivityIds.filter((savedId) => savedId !== id)
        : [id, ...state.savedActivityIds],
    })),
  toggleSavedLodgingId: (id) =>
    set((state) => ({
      savedLodgingIds: state.savedLodgingIds.includes(id)
        ? state.savedLodgingIds.filter((savedId) => savedId !== id)
        : [id, ...state.savedLodgingIds],
    })),
  removeSavedActivityId: (id) =>
    set((state) => ({
      savedActivityIds: state.savedActivityIds.filter((savedId) => savedId !== id),
    })),
  removeSavedLodgingId: (id) =>
    set((state) => ({
      savedLodgingIds: state.savedLodgingIds.filter((savedId) => savedId !== id),
    })),
  setIsLoadingTrips: (isLoadingTrips) => set({ isLoadingTrips }),
  setIsLoadingTripById: (isLoadingTripById) => set({ isLoadingTripById }),
}));
