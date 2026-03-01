import { create } from "zustand";

import type { TripActivity, TripLodging, Trip } from "@/lib/api-types";

interface TripMapStoreState {
    trips: Trip[];
    selectedTrip: Trip | null;
    fullScreenTrip: Trip | null;
    selectedActivity: TripActivity | null;
    selectedLodging: TripLodging | null;
    searchQuery: string;
    searchPanelOpen: boolean;
    plansPanelOpen: boolean;
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
    setSearchQuery: (value: string) => void;
    openSearchPanel: () => void;
    closeSearchPanel: () => void;
    togglePlansPanel: () => void;
    closePlansPanel: () => void;
    showTripInFullScreen: (trip: Trip) => void;
    showFullScreenTripInSidebar: () => void;
    previewTripAtLocation: (trip: Trip) => void;
    setSavedActivityIds: (ids: number[]) => void;
    setSavedLodgingIds: (ids: number[]) => void;
    toggleSavedActivityId: (id: number) => void;
    toggleSavedLodgingId: (id: number) => void;
    removeSavedActivityId: (id: number) => void;
    removeSavedLodgingId: (id: number) => void;
    setIsLoadingTrips: (isLoading: boolean ) => void;
    setIsLoadingTripById: (isLoading: boolean) => void;
}

export const useTripMapStore = create<TripMapStoreState>((set) => ({
    trips: [],
    selectedTrip: null,
    fullScreenTrip: null,
    selectedActivity: null,
    selectedLodging: null,
    searchQuery: "",
    searchPanelOpen: false,
    plansPanelOpen: false,
    savedActivityIds: [],
    savedLodgingIds: [],
    isLoadingTrips: true,
    isLoadingTripById: false,
    setTrips: (trips) => set({ trips }),
    upsertTrip: (trip) =>
        set((state) => {
            const index = state.trips.findIndex((item) => item.trip_id === trip.trip_id);
            if (index === -1) {
                return { trips: [trip, ...state.trips] };
            }

            const nextTrips = [...state.trips];
            nextTrips[index] = trip;
            return {
                trips: nextTrips,
                selectedTrip:
                    state.selectedTrip?.trip_id === trip.trip_id ? trip : state.selectedTrip,
                fullScreenTrip:
                    state.fullScreenTrip?.trip_id === trip.trip_id ? trip : state.fullScreenTrip,
            };
        }),
    removeTripById: (tripId) =>
        set((state) => ({
            trips: state.trips.filter((trip) => trip.trip_id !== tripId),
            selectedTrip:
                state.selectedTrip?.trip_id === tripId ? null : state.selectedTrip,
            fullScreenTrip:
                state.fullScreenTrip?.trip_id === tripId ? null : state.fullScreenTrip,
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
    clearSelections: () =>
        set({
            selectedTrip: null,
            fullScreenTrip: null,
            selectedActivity: null,
            selectedLodging: null,
        }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    openSearchPanel: () =>
        set({
            searchPanelOpen: true,
            plansPanelOpen: false,
            selectedTrip: null,
            fullScreenTrip: null,
            selectedActivity: null,
            selectedLodging: null,
        }),
    closeSearchPanel: () => set({ searchPanelOpen: false, searchQuery: "" }),
    togglePlansPanel: () =>
        set((state) => {
            const nextPlansPanelOpen = !state.plansPanelOpen;
            if (!nextPlansPanelOpen) {
                return { plansPanelOpen: false };
            }

            return {
                plansPanelOpen: true,
                searchPanelOpen: false,
                searchQuery: "",
                selectedTrip: null,
                fullScreenTrip: null,
                selectedActivity: null,
                selectedLodging: null,
            };
        }),
    closePlansPanel: () => set({ plansPanelOpen: false }),
    showTripInFullScreen: (trip) =>
        set({
            selectedTrip: null,
            fullScreenTrip: trip,
            selectedActivity: null,
            selectedLodging: null,
            searchPanelOpen: false,
            searchQuery: "",
            plansPanelOpen: false,
        }),
    showFullScreenTripInSidebar: () =>
        set((state) => ({
            selectedTrip: state.fullScreenTrip,
            fullScreenTrip: null,
            selectedActivity: null,
            selectedLodging: null,
        })),
    previewTripAtLocation: (trip) =>
        set({
            isLoadingTripById: false,
            selectedTrip: trip,
            fullScreenTrip: null,
            selectedActivity: null,
            selectedLodging: null,
        }),
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
