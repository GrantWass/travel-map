import { create } from "zustand";

import type { TripActivity, TripLodging, Trip } from "@/lib/api-types";
import type { SavedActivityEntry, SavedLodgingEntry } from "@/lib/client-types";
import type { SavedPlanItem } from "@/lib/api-client";
import { getLocationKey, getTripTimestamp } from "@/lib/utils";
import {
    fetchDeferredTripsWithChildren,
    fetchPublicTripsLightweight,
    hydrateTripChildrenOnly,
} from "@/stores/trip-search-store";
import { getDeferredTripIds } from "@/lib/api-client";

interface TripMapStoreState {
    trips: Trip[];
    selectedTrip: Trip | null;
    fullScreenTrip: Trip | null;
    selectedActivity: TripActivity | null;
    selectedLodging: TripLodging | null;
    searchQuery: string;
    searchPanelOpen: boolean;
    plansPanelOpen: boolean;
    lastViewedPanelType: "search" | "trip" | "plans" | null;
    lastViewedTrip: Trip | null;
    savedActivityIds: number[];
    savedLodgingIds: number[];
    savedItems: SavedPlanItem[];
    collections: string[];
    isLoadingTrips: boolean;
    isLoadingTripById: boolean;
    loadTrips: (initialPublicTrips?: Trip[]) => Promise<void>;
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
    setSavedItems: (items: SavedPlanItem[]) => void;
    setCollections: (collections: string[]) => void;
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
    getSelectedLocationContext: () => SelectedLocationContext;
}

export interface TripMapPanels {
    showSidebar: boolean;
    showFullScreen: boolean;
    showSearchPanel: boolean;
    showPlansPanel: boolean;
    showTopLeftControls: boolean;
    showAnyLeftSidebar: boolean;
}

export interface SelectedLocationContext {
    trips: Trip[];
    selectedIndex: number;
    hasPrevious: boolean;
    hasNext: boolean;
}

export interface TripMapPanelInputs {
    selectedTrip: Trip | null;
    fullScreenTrip: Trip | null;
    searchPanelOpen: boolean;
    plansPanelOpen: boolean;
}

let activeLoadTripsPromise: Promise<void> | null = null;

export function deriveTripMapPanels(inputs: TripMapPanelInputs): TripMapPanels {
    const showSidebar = !!inputs.selectedTrip && !inputs.fullScreenTrip;
    const showFullScreen = !!inputs.fullScreenTrip;
    const showSearchPanel = inputs.searchPanelOpen && !showSidebar && !showFullScreen;
    const showPlansPanel = inputs.plansPanelOpen && !showSidebar && !showFullScreen && !showSearchPanel;
    const showTopLeftControls = !showSidebar && !showFullScreen && !showSearchPanel && !showPlansPanel;
    const showAnyLeftSidebar = showSidebar || showFullScreen || showSearchPanel || showPlansPanel;

    return { showSidebar, showFullScreen, showSearchPanel, showPlansPanel, showTopLeftControls, showAnyLeftSidebar };
}

function getTripsAtLocation(trips: Trip[], selectedTrip: Trip | null): Trip[] {
    if (!selectedTrip) {
        return [];
    }

    const selectedLocationKey = getLocationKey(selectedTrip.latitude, selectedTrip.longitude);

    return trips
        .filter((trip) => getLocationKey(trip.latitude, trip.longitude) === selectedLocationKey)
        .sort((left, right) => {
            if (!left.date || !right.date) {
                return 0;
            }

            return getTripTimestamp(right.date) - getTripTimestamp(left.date);
        });
}

export function deriveSelectedLocationContext(trips: Trip[], selectedTrip: Trip | null): SelectedLocationContext {
    const tripsAtSelectedLocation = getTripsAtLocation(trips, selectedTrip);
    const selectedIndex = selectedTrip
        ? tripsAtSelectedLocation.findIndex((trip) => trip.trip_id === selectedTrip.trip_id)
        : -1;

    return {
        trips: tripsAtSelectedLocation,
        selectedIndex,
        hasPrevious: selectedIndex > 0,
        hasNext: selectedIndex >= 0 && selectedIndex < tripsAtSelectedLocation.length - 1,
    };
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
    lastViewedPanelType: null,
    lastViewedTrip: null,
    savedActivityIds: [],
    savedLodgingIds: [],
    savedItems: [],
    collections: [],
    isLoadingTrips: true,
    isLoadingTripById: false,
    loadTrips: async (initialPublicTrips?: Trip[]) => {
        if (activeLoadTripsPromise) {
            return activeLoadTripsPromise;
        }

        activeLoadTripsPromise = (async () => {
            set({ isLoadingTrips: true });

            // Kick off deferred visibility lookup immediately; do not block first render on it.
            const deferredTripIdsPromise = getDeferredTripIds().catch(() => [] as number[]);

            try {
                // Load public trips first for fastest render.
                const publicTrips = initialPublicTrips ?? await fetchPublicTripsLightweight();
                set({ trips: publicTrips, isLoadingTrips: false });

                // Background hydration should never clear the already rendered public set.
                try {
                    const publicTripIds = publicTrips.map((trip) => trip.trip_id);
                    const deferredTripIds = await deferredTripIdsPromise;
                    const [publicChildren, deferredTrips] = await Promise.all([
                        hydrateTripChildrenOnly(publicTripIds),
                        fetchDeferredTripsWithChildren(deferredTripIds),
                    ]);

                    set((state) => {
                        const publicChildrenByTripId = new Map(publicChildren.map((entry) => [entry.trip_id, entry]));
                        const hydratedPublicTrips = publicTrips.map((trip) => {
                            const children = publicChildrenByTripId.get(trip.trip_id);
                            if (!children) {
                                return trip;
                            }

                            return {
                                ...trip,
                                tags: children.tags,
                                lodgings: children.lodgings,
                                activities: children.activities,
                                comments: children.comments,
                                collaborators: children.collaborators,
                            };
                        });

                        const updatedTrips = [...hydratedPublicTrips, ...deferredTrips].sort(
                            (left, right) => right.trip_id - left.trip_id,
                        );
                        const hydratedMap = new Map(updatedTrips.map((trip) => [trip.trip_id, trip]));

                        return {
                            trips: updatedTrips,
                            selectedTrip: state.selectedTrip && hydratedMap.has(state.selectedTrip.trip_id)
                                ? hydratedMap.get(state.selectedTrip.trip_id)!
                                : state.selectedTrip,
                            fullScreenTrip: state.fullScreenTrip && hydratedMap.has(state.fullScreenTrip.trip_id)
                                ? hydratedMap.get(state.fullScreenTrip.trip_id)!
                                : state.fullScreenTrip,
                        };
                    });
                } catch (error) {
                    console.error("Failed to hydrate trip children/deferred trips:", error);
                }
            } catch (error) {
                console.error("Failed to load trips:", error);
                set({ trips: [], isLoadingTrips: false });
            }
        })();

        try {
            await activeLoadTripsPromise;
        } finally {
            activeLoadTripsPromise = null;
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
    setSelectedTrip: (selectedTrip) =>
        set(
            selectedTrip
                ? { selectedTrip, lastViewedPanelType: "trip", lastViewedTrip: selectedTrip }
                : { selectedTrip },
        ),
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
            lastViewedPanelType: "search",
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
                lastViewedPanelType: "plans",
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
            lastViewedPanelType: "trip",
            lastViewedTrip: trip,
        }),
    setSavedActivityIds: (savedActivityIds) => set({ savedActivityIds }),
    setSavedLodgingIds: (savedLodgingIds) => set({ savedLodgingIds }),
    setSavedItems: (savedItems) => set({ savedItems }),
    setCollections: (collections) => set({ collections }),
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
    getSavedActivityIdSet: () => new Set(get().savedActivityIds),
    getSavedLodgingIdSet: () => new Set(get().savedLodgingIds),
    getSavedActivities: () => {
        const state = get();
        const savedActivityIds = new Set(state.savedActivityIds);
        const collectionByActivityId = new Map(
            state.savedItems
                .filter((item) => item.item_type === "activity")
                .map((item) => [item.item_id, item.collection_name]),
        );

        return state.trips.flatMap((trip) =>
            trip.activities
                .filter((activity) => savedActivityIds.has(activity.activity_id))
                .map((activity) => ({
                    tripId: trip.trip_id,
                    tripTitle: trip.title || "",
                    tripThumbnail: trip.thumbnail_url,
                    activity,
                    collectionName: collectionByActivityId.get(activity.activity_id) ?? null,
                })),
        );
    },
    getSavedLodgings: () => {
        const state = get();
        const savedLodgingIds = new Set(state.savedLodgingIds);
        const collectionByLodgingId = new Map(
            state.savedItems
                .filter((item) => item.item_type === "lodging")
                .map((item) => [item.item_id, item.collection_name]),
        );

        return state.trips.flatMap((trip) =>
            trip.lodgings
                .filter((lodging) => savedLodgingIds.has(lodging.lodge_id))
                .map((lodging) => ({
                    tripId: trip.trip_id,
                    tripTitle: trip.title || "",
                    tripThumbnail: trip.thumbnail_url,
                    lodging,
                    collectionName: collectionByLodgingId.get(lodging.lodge_id) ?? null,
                })),
        );
    },
    getTripsAtSelectedLocation: () => getTripsAtLocation(get().trips, get().selectedTrip),
    getSelectedTripLocationIndex: () => {
        const state = get();
        if (!state.selectedTrip) {
            return -1;
        }

        const tripsAtSelectedLocation = getTripsAtLocation(state.trips, state.selectedTrip);

        return tripsAtSelectedLocation.findIndex((trip) => trip.trip_id === state.selectedTrip?.trip_id);
    },
    getSelectedLocationContext: () => deriveSelectedLocationContext(get().trips, get().selectedTrip)
}));
