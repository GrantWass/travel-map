import { create } from "zustand";

import { getTrips } from "@/lib/api-client";
import type { TripActivity, TripLodging, Trip } from "@/lib/api-types";
import type { SavedActivityEntry, SavedLodgingEntry } from "@/lib/client-types";
import { getLocationKey, getTripTimestamp } from "@/lib/utils";

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
    loadTrips: () => Promise<void>;
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
    getSavedActivityIdSet: () => Set<number>;
    getSavedLodgingIdSet: () => Set<number>;
    getSavedActivities: () => SavedActivityEntry[];
    getSavedLodgings: () => SavedLodgingEntry[];
    getTripsAtSelectedLocation: () => Trip[];
    getSelectedTripLocationIndex: () => number;
    getMapPanels: () => TripMapPanels;
}

export interface TripMapPanels {
    showSidebar: boolean;
    showFullScreen: boolean;
    showSearchPanel: boolean;
    showPlansPanel: boolean;
    showTopLeftControls: boolean;
    showAnyLeftSidebar: boolean;
}

export const useTripMapStore = create<TripMapStoreState>((set, get) => ({
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
    loadTrips: async () => {
        set({ isLoadingTrips: true });

        try {
            const apiTrips = await getTrips();
            const now = new Date();

            set({
                trips: apiTrips
                    .filter((trip): trip is Trip => Boolean(trip))
                    .filter((trip) => !(trip.event_end && trip.event_start) || (trip.event_end !== null && new Date(trip.event_end) > now)),
            });
        } catch {
            set({ trips: [] });
        } finally {
            set({ isLoadingTrips: false });
        }
    },
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
    getSavedActivityIdSet: () => {
        return new Set(get().savedActivityIds);
    },
    getSavedLodgingIdSet: () => {
        return new Set(get().savedLodgingIds);
    },
    getSavedActivities: () => {
        const state = get();
        const savedActivityIds = new Set(state.savedActivityIds);

        return state.trips.flatMap((trip) =>
            trip.activities
                .filter((activity) => savedActivityIds.has(activity.activity_id))
                .map((activity) => ({
                    tripId: trip.trip_id,
                    tripTitle: trip.title || "",
                    tripThumbnail: trip.thumbnail_url,
                    activity,
                })),
        );
    },
    getSavedLodgings: () => {
        const state = get();
        const savedLodgingIds = new Set(state.savedLodgingIds);

        return state.trips.flatMap((trip) =>
            trip.lodgings
                .filter((lodging) => savedLodgingIds.has(lodging.lodge_id))
                .map((lodging) => ({
                    tripId: trip.trip_id,
                    tripTitle: trip.title || "",
                    tripThumbnail: trip.thumbnail_url,
                    lodging,
                })),
        );
    },
    getTripsAtSelectedLocation: () => {
        const state = get();
        if (!state.selectedTrip) {
            return [];
        }

        const selectedLocationKey = getLocationKey(state.selectedTrip.latitude, state.selectedTrip.longitude);

        return state.trips
            .filter((trip) => getLocationKey(trip.latitude, trip.longitude) === selectedLocationKey)
            .sort((left, right) => {
                if (!left.date || !right.date) {
                    return 0;
                }

                return getTripTimestamp(right.date) - getTripTimestamp(left.date);
            });
    },
    getSelectedTripLocationIndex: () => {
        const state = get();
        if (!state.selectedTrip) {
            return -1;
        }

        const selectedLocationKey = getLocationKey(state.selectedTrip.latitude, state.selectedTrip.longitude);
        const tripsAtSelectedLocation = state.trips
            .filter((trip) => getLocationKey(trip.latitude, trip.longitude) === selectedLocationKey)
            .sort((left, right) => {
                if (!left.date || !right.date) {
                    return 0;
                }

                return getTripTimestamp(right.date) - getTripTimestamp(left.date);
            });

        return tripsAtSelectedLocation.findIndex((trip) => trip.trip_id === state.selectedTrip?.trip_id);
    },
    getMapPanels: () => {
        const state = get();

        const showSidebar = !!state.selectedTrip && !state.fullScreenTrip;
        const showFullScreen = !!state.fullScreenTrip;
        const showSearchPanel = state.searchPanelOpen && !showSidebar && !showFullScreen;
        const showPlansPanel = state.plansPanelOpen && !showSidebar && !showFullScreen && !showSearchPanel;
        const showTopLeftControls = !showSidebar && !showFullScreen && !showSearchPanel && !showPlansPanel;
        const showAnyLeftSidebar = showSidebar || showFullScreen || showSearchPanel || showPlansPanel;

        return {
            showSidebar,
            showFullScreen,
            showSearchPanel,
            showPlansPanel,
            showTopLeftControls,
            showAnyLeftSidebar,
        };
    },
}));
