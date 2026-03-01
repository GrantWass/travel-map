"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { CircleUser, MapPin, Notebook, Search } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import FullScreenReview from "@/components/full-screen-review";
import PlansSidebarPanel from "@/components/plans-sidebar-panel";
import SearchSidebarPanel from "@/components/search-sidebar-panel";
import SidebarPanel from "@/components/sidebar-panel";
import StudentAddMenu from "@/components/student-add-menu";
import UserProfileModal, { type UserProfile } from "@/components/user-profile-modal";
import { deleteTrip, getSavedPlans, getTrip, getTrips, getUserProfile, toggleSavedActivity as toggleSavedActivityApi, toggleSavedLodging as toggleSavedLodgingApi } from "@/lib/api-client";
import type { UserProfileResponse } from "@/lib/api-types";
import type { MapActivity, MapLodging, MapTrip, ModalProfile, SavedActivityEntry, SavedLodgingEntry } from "@/lib/trip-models";
import { toMapTrip, toModalProfile } from "@/lib/trip-models";

const MapView = dynamic(() => import("@/components/map-view"), {
    ssr: false,
    loading: () => (
        <div className="flex h-full w-full items-center justify-center bg-background">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
    ),
});

interface ProfileState {
    profile: UserProfile;
    expandFrom: "top-right" | "left";
    canManageTrips: boolean;
}

const REVIEW_PANEL_WIDTH = "min(483px, 100vw)";

function getLocationKey(lat: number, lng: number): string {
    return `${lat.toFixed(6)}:${lng.toFixed(6)}`;
}

function getTripTimestamp(dateValue: string): number {
    const timestamp = Date.parse(dateValue);
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function toUserProfile(profile: ModalProfile): UserProfile {
    return {
        userId: profile.userId,
        name: profile.name,
        initials: profile.initials,
        email: profile.email,
        university: profile.university,
        bio: profile.bio,
        trips: profile.trips,
        image_url: profile.image_url,
    };
}

function toUserProfileFromApi(profileResponse: UserProfileResponse): UserProfile {
    return toUserProfile(toModalProfile(profileResponse));
}

export default function TravelMap() {
    const router = useRouter();
    const pathname = usePathname();
    const { userId, isStudent, myProfile, refreshMyProfile } = useAuth();

    const [trips, setTrips] = useState<MapTrip[]>([]);
    const [selectedTrip, setSelectedTrip] = useState<MapTrip | null>(null);
    const [fullScreenTrip, setFullScreenTrip] = useState<MapTrip | null>(null);
    const [selectedActivity, setSelectedActivity] = useState<MapActivity | null>(null);
    const [selectedLodging, setSelectedLodging] = useState<MapLodging | null>(null);
    const [profileState, setProfileState] = useState<ProfileState | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchPanelOpen, setSearchPanelOpen] = useState(false);
    const [plansPanelOpen, setPlansPanelOpen] = useState(false);
    const [savedActivityIds, setSavedActivityIds] = useState<number[]>([]);
    const [savedLodgingIds, setSavedLodgingIds] = useState<number[]>([]);

    const [isLoadingTrips, setIsLoadingTrips] = useState(true);
    const [isLoadingTripById, setIsLoadingTripById] = useState(false);
    const [deletingTripId, setDeletingTripId] = useState<number | null>(null);
    const [profileCacheByUser, setProfileCacheByUser] = useState<Record<number, UserProfile>>({});
    const activeTripRequestIdRef = useRef(0);

    const tripLookup = useMemo(() => {
        return new Map(trips.map((trip) => [trip.id, trip]));
    }, [trips]);

    const upsertTrip = useCallback((trip: MapTrip) => {
        setTrips((current) => {
            const index = current.findIndex((item) => item.id === trip.id);
            if (index === -1) {
                return [trip, ...current];
            }

            const next = [...current];
            next[index] = trip;
            return next;
        });
    }, []);

    const savedActivityIdSet = useMemo(() => new Set(savedActivityIds), [savedActivityIds]);
    const savedLodgingIdSet = useMemo(() => new Set(savedLodgingIds), [savedLodgingIds]);

    const savedActivities = useMemo<SavedActivityEntry[]>(() => {
        return trips.flatMap((trip) =>
            trip.activities
                .filter((activity) => savedActivityIdSet.has(activity.id))
                .map((activity) => ({
                    tripId: trip.id,
                    tripTitle: trip.title,
                    tripThumbnail: trip.thumbnail,
                    activity,
                })),
        );
    }, [trips, savedActivityIdSet]);

    const savedLodgings = useMemo<SavedLodgingEntry[]>(() => {
        return trips.flatMap((trip) =>
            trip.lodgings
                .filter((lodging) => savedLodgingIdSet.has(lodging.id))
                .map((lodging) => ({
                    tripId: trip.id,
                    tripTitle: trip.title,
                    tripThumbnail: trip.thumbnail,
                    lodging,
                })),
        );
    }, [trips, savedLodgingIdSet]);

    const handleToggleSavedActivity = useCallback((_tripId: number, activity: MapActivity) => {
        const id = activity.id;
        setSavedActivityIds((current) =>
            current.includes(id) ? current.filter((i) => i !== id) : [id, ...current],
        );
        void toggleSavedActivityApi(id).then((plans) => {
            setSavedActivityIds(plans.saved_activity_ids);
            setSavedLodgingIds(plans.saved_lodging_ids);
        });
    }, []);

    const handleToggleSavedLodging = useCallback((_tripId: number, lodging: MapLodging) => {
        const id = lodging.id;
        setSavedLodgingIds((current) =>
            current.includes(id) ? current.filter((i) => i !== id) : [id, ...current],
        );
        void toggleSavedLodgingApi(id).then((plans) => {
            setSavedActivityIds(plans.saved_activity_ids);
            setSavedLodgingIds(plans.saved_lodging_ids);
        });
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function loadTrips() {
            try {
                const apiTrips = await getTrips();
                if (!isMounted) {
                    return;
                }

                setTrips(apiTrips.map(toMapTrip).filter((trip): trip is MapTrip => Boolean(trip)));
            } catch {
                if (isMounted) {
                    setTrips([]);
                }
            } finally {
                if (isMounted) {
                    setIsLoadingTrips(false);
                }
            }
        }

        void loadTrips();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (userId === null) return;

        getSavedPlans()
            .then((plans) => {
                setSavedActivityIds(plans.saved_activity_ids);
                setSavedLodgingIds(plans.saved_lodging_ids);
            })
            .catch(() => {
                // Not authenticated or fetch failed — leave state empty.
            });
    }, [userId]);

    useEffect(() => {
        if (!myProfile?.user?.user_id) {
            return;
        }

        const cached = toUserProfileFromApi(myProfile);
        setProfileCacheByUser((current) => ({ ...current, [cached.userId]: cached }));
    }, [myProfile]);

    const openTripById = useCallback(
        async (tripId: number | null) => {
            const requestId = activeTripRequestIdRef.current + 1;
            activeTripRequestIdRef.current = requestId;

            if (tripId === null) {
                setSelectedTrip(null);
                setFullScreenTrip(null);
                setSelectedActivity(null);
                setSelectedLodging(null);
                setPlansPanelOpen(false);
                setIsLoadingTripById(false);
                return;
            }

            const cached = tripLookup.get(tripId);
            if (cached) {
                setSelectedTrip(cached);
            }

            setIsLoadingTripById(true);
            try {
                const apiTrip = await getTrip(tripId);
                const mappedTrip = toMapTrip(apiTrip);
                if (!mappedTrip) {
                    return;
                }

                upsertTrip(mappedTrip);
                if (requestId !== activeTripRequestIdRef.current) {
                    return;
                }

                setSelectedTrip(mappedTrip);
                setFullScreenTrip(null);
                setSelectedActivity(null);
                setSelectedLodging(null);
                setSearchPanelOpen(false);
                setSearchQuery("");
                setPlansPanelOpen(false);
            } catch {
                // If trip fetch fails, keep any cached view state.
            } finally {
                if (requestId === activeTripRequestIdRef.current) {
                    setIsLoadingTripById(false);
                }
            }
        },
        [tripLookup, upsertTrip],
    );

    // Keep a stable ref so the mount effect below can call openTripById
    // without listing it as a dependency (avoids re-running on every render).
    const openTripByIdRef = useRef(openTripById);
    useEffect(() => {
        openTripByIdRef.current = openTripById;
    }, [openTripById]);

    // On mount, check for a ?selectTrip=<id> param injected by the trip
    // creation page after a new trip is posted.
    useEffect(() => {
        const param = new URLSearchParams(window.location.search).get("selectTrip");
        if (!param) return;
        const tripId = Number(param);
        if (!Number.isFinite(tripId) || tripId <= 0) return;
        window.history.replaceState(null, "", window.location.pathname);
        void openTripByIdRef.current(tripId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleViewFull = useCallback((trip: MapTrip) => {
        setFullScreenTrip(trip);
        setSelectedTrip(null);
        setSelectedActivity(null);
        setSelectedLodging(null);
        setSearchPanelOpen(false);
        setSearchQuery("");
        setPlansPanelOpen(false);
    }, []);

    const handleBack = useCallback(() => {
        setSelectedTrip(fullScreenTrip);
        setFullScreenTrip(null);
        setSelectedActivity(null);
        setSelectedLodging(null);
    }, [fullScreenTrip]);

    const handleSelectActivity = useCallback((activity: MapActivity | null) => {
        setSelectedActivity(activity);
        if (activity) {
            setSelectedLodging(null);
        }
    }, []);

    const handleSelectLodging = useCallback((lodging: MapLodging | null) => {
        setSelectedLodging(lodging);
        if (lodging) {
            setSelectedActivity(null);
        }
    }, []);

    const tripsAtSelectedLocation = useMemo(() => {
        if (!selectedTrip) {
            return [];
        }

        const selectedLocationKey = getLocationKey(selectedTrip.lat, selectedTrip.lng);

        return trips
            .filter((trip) => getLocationKey(trip.lat, trip.lng) === selectedLocationKey)
            .sort((left, right) => getTripTimestamp(right.date) - getTripTimestamp(left.date));
    }, [trips, selectedTrip]);

    const selectedTripLocationIndex = useMemo(() => {
        if (!selectedTrip) {
            return -1;
        }

        return tripsAtSelectedLocation.findIndex((trip) => trip.id === selectedTrip.id);
    }, [selectedTrip, tripsAtSelectedLocation]);

    const handleShowPreviousTripAtLocation = useCallback(() => {
        if (selectedTripLocationIndex <= 0) {
            return;
        }

        const previousTrip = tripsAtSelectedLocation[selectedTripLocationIndex - 1];
        if (!previousTrip) {
            return;
        }

        activeTripRequestIdRef.current += 1;
        setIsLoadingTripById(false);
        setSelectedTrip(previousTrip);
        setFullScreenTrip(null);
        setSelectedActivity(null);
        setSelectedLodging(null);
    }, [selectedTripLocationIndex, tripsAtSelectedLocation]);

    const handleShowNextTripAtLocation = useCallback(() => {
        if (selectedTripLocationIndex < 0 || selectedTripLocationIndex >= tripsAtSelectedLocation.length - 1) {
            return;
        }

        const nextTrip = tripsAtSelectedLocation[selectedTripLocationIndex + 1];
        if (!nextTrip) {
            return;
        }

        activeTripRequestIdRef.current += 1;
        setIsLoadingTripById(false);
        setSelectedTrip(nextTrip);
        setFullScreenTrip(null);
        setSelectedActivity(null);
        setSelectedLodging(null);
    }, [selectedTripLocationIndex, tripsAtSelectedLocation]);

    const openProfile = useCallback(
        async (targetUserId: number, expandFrom: "top-right" | "left") => {
            const canManageTrips = userId !== null && targetUserId === userId;

            if (userId !== null && targetUserId === userId && myProfile) {
                setProfileState({
                    profile: toUserProfileFromApi(myProfile),
                    expandFrom,
                    canManageTrips,
                });
            }

            const cachedProfile = profileCacheByUser[targetUserId];
            if (cachedProfile) {
                setProfileState({
                    profile: cachedProfile,
                    expandFrom,
                    canManageTrips,
                });
            }

            try {
                if (userId !== null && targetUserId === userId) {
                    const refreshedOwnProfile = await refreshMyProfile(targetUserId);
                    if (!refreshedOwnProfile) {
                        return;
                    }

                    const mappedOwnProfile = toUserProfileFromApi(refreshedOwnProfile);
                    setProfileCacheByUser((current) => ({ ...current, [mappedOwnProfile.userId]: mappedOwnProfile }));
                    setProfileState({
                        profile: mappedOwnProfile,
                        expandFrom,
                        canManageTrips,
                    });
                    return;
                }

                const profileResponse = await getUserProfile(targetUserId);
                const mappedProfile = toUserProfileFromApi(profileResponse);

                setProfileCacheByUser((current) => ({ ...current, [mappedProfile.userId]: mappedProfile }));
                setProfileState({
                    profile: mappedProfile,
                    expandFrom,
                    canManageTrips,
                });
            } catch {
                // Ignore profile lookup failures for now.
            }
        },
        [myProfile, profileCacheByUser, refreshMyProfile, userId],
    );

    const handleDeleteTrip = useCallback(
        async (tripId: number) => {
            if (userId === null) {
                return;
            }

            setDeletingTripId(tripId);
            try {
                await deleteTrip(tripId);

                setTrips((current) => current.filter((trip) => trip.id !== tripId));
                setSelectedTrip((current) => (current?.id === tripId ? null : current));
                setFullScreenTrip((current) => (current?.id === tripId ? null : current));
                setSelectedActivity(null);
                setSelectedLodging(null);

                setProfileState((current) => {
                    if (!current || current.profile.userId !== userId) {
                        return current;
                    }

                    return {
                        ...current,
                        profile: {
                            ...current.profile,
                            trips: current.profile.trips.filter((trip) => trip.id !== tripId),
                        },
                    };
                });

                const refreshedOwnProfile = await refreshMyProfile(userId);
                if (refreshedOwnProfile) {
                    const mappedOwnProfile = toUserProfileFromApi(refreshedOwnProfile);
                    setProfileCacheByUser((current) => ({ ...current, [mappedOwnProfile.userId]: mappedOwnProfile }));
                    setProfileState((current) => {
                        if (!current || current.profile.userId !== mappedOwnProfile.userId) {
                            return current;
                        }

                        return {
                            ...current,
                            profile: mappedOwnProfile,
                        };
                    });
                }
            } catch {
                // Ignore delete failures for now.
            } finally {
                setDeletingTripId(null);
            }
        },
        [refreshMyProfile, userId],
    );

    const handleSearchChange = useCallback((value: string) => {
        setSearchQuery(value);
    }, []);

    const handleSearchFocus = useCallback(() => {
        setSearchPanelOpen(true);
        setPlansPanelOpen(false);
        setSelectedTrip(null);
        setFullScreenTrip(null);
        setSelectedActivity(null);
        setSelectedLodging(null);
    }, []);

    const handleTogglePlansPanel = useCallback(() => {
        setPlansPanelOpen((current) => {
            const next = !current;

            if (next) {
                setSearchPanelOpen(false);
                setSearchQuery("");
                setSelectedTrip(null);
                setFullScreenTrip(null);
                setSelectedActivity(null);
                setSelectedLodging(null);
            }

            return next;
        });
    }, []);

    const showSidebar = !!selectedTrip && !fullScreenTrip;
    const showFullScreen = !!fullScreenTrip;
    const showSearchPanel = searchPanelOpen && !showSidebar && !showFullScreen;
    const showPlansPanel = plansPanelOpen && !showSidebar && !showFullScreen && !showSearchPanel;
    const showTopLeftControls = !showSidebar && !showFullScreen && !showSearchPanel && !showPlansPanel;
    const showAnyLeftSidebar = showSidebar || showFullScreen || showSearchPanel || showPlansPanel;

    const topLeftControlsWidthClass = "w-[min(506px,calc(100vw-2rem))]";

    return (
        <div className="relative h-screen w-screen overflow-hidden">
            {showTopLeftControls && (
                <div className={`absolute left-4 top-3 z-[1000] ${topLeftControlsWidthClass}`}>
                    <div className="flex items-center gap-2">
                        <div className="flex h-12 flex-1 items-center gap-2 rounded-full border border-border bg-card/95 px-5 shadow-sm backdrop-blur-sm">
                            <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                            <input
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                onFocus={handleSearchFocus}
                                placeholder="Search trips, places, or keywords"
                                className="h-full w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                                aria-label="Search trips"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleTogglePlansPanel}
                            className={`flex h-12 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-medium shadow-sm backdrop-blur-sm transition-colors ${
                                showPlansPanel
                                    ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                                    : "border-border bg-card/95 text-foreground hover:bg-card"
                            }`}
                            aria-label="Open plans"
                            title="Plans"
                        >
                            <Notebook className="h-5 w-5" />
                            <span className="hidden sm:inline">Plans</span>
                        </button>
                    </div>
                </div>
            )}

            <div className="absolute right-4 top-4 z-[1000] flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-border bg-card/90 px-5 py-2.5 shadow-sm backdrop-blur-sm">
                    <MapPin className="h-5 w-5 text-primary" />
                    <span className="text-sm font-semibold tracking-tight text-foreground">Travel Map</span>
                </div>
                <button
                    onClick={() => {
                        if (userId !== null) {
                            void openProfile(userId, "top-right");
                        }
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-card"
                    aria-label="Open profile"
                >
                    <CircleUser className="h-6 w-6 text-foreground" />
                </button>
            </div>

            <div className="flex h-full w-full">
                <div
                    className="h-full flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{
                        width:
                            showSidebar || showFullScreen || showSearchPanel || showPlansPanel ? REVIEW_PANEL_WIDTH : 0,
                    }}
                >
                    {showSidebar && selectedTrip && (
                        <SidebarPanel
                            review={selectedTrip}
                            onClose={() => void openTripById(null)}
                            onViewFull={handleViewFull}
                            onOpenAuthorProfile={(profileUserId) => {
                                void openProfile(profileUserId, "left");
                            }}
                            savedActivityIds={savedActivityIdSet}
                            savedLodgingIds={savedLodgingIdSet}
                            onToggleSavedActivity={handleToggleSavedActivity}
                            onToggleSavedLodging={handleToggleSavedLodging}
                            selectedActivityId={selectedActivity?.id ?? null}
                            selectedLodgingId={selectedLodging?.id ?? null}
                            onSelectActivity={handleSelectActivity}
                            onSelectLodging={handleSelectLodging}
                            locationTripCount={tripsAtSelectedLocation.length}
                            locationTripPosition={selectedTripLocationIndex >= 0 ? selectedTripLocationIndex + 1 : 1}
                            onShowPreviousTripAtLocation={handleShowPreviousTripAtLocation}
                            onShowNextTripAtLocation={handleShowNextTripAtLocation}
                            canShowPreviousTripAtLocation={selectedTripLocationIndex > 0}
                            canShowNextTripAtLocation={
                                selectedTripLocationIndex >= 0 &&
                                selectedTripLocationIndex < tripsAtSelectedLocation.length - 1
                            }
                        />
                    )}
                    {showFullScreen && fullScreenTrip && (
                        <FullScreenReview
                            review={fullScreenTrip}
                            selectedActivity={selectedActivity}
                            selectedLodging={selectedLodging}
                            onBack={handleBack}
                            onSelectActivity={handleSelectActivity}
                            onSelectLodging={handleSelectLodging}
                            onOpenAuthorProfile={(profileUserId) => {
                                void openProfile(profileUserId, "left");
                            }}
                            savedActivityIds={savedActivityIdSet}
                            savedLodgingIds={savedLodgingIdSet}
                            onToggleSavedActivity={handleToggleSavedActivity}
                            onToggleSavedLodging={handleToggleSavedLodging}
                        />
                    )}
                    {showSearchPanel && (
                        <SearchSidebarPanel
                            query={searchQuery}
                            trips={trips}
                            onQueryChange={handleSearchChange}
                            onClose={() => {
                                setSearchPanelOpen(false);
                                setSearchQuery("");
                            }}
                            onSelectTrip={(tripId) => {
                                setSearchPanelOpen(false);
                                setSearchQuery("");
                                void openTripById(tripId);
                            }}
                        />
                    )}
                    {showPlansPanel && (
                        <PlansSidebarPanel
                            savedActivities={savedActivities}
                            savedLodgings={savedLodgings}
                            onClose={() => {
                                setPlansPanelOpen(false);
                            }}
                            onOpenTrip={(tripId) => {
                                setPlansPanelOpen(false);
                                void openTripById(tripId);
                            }}
                            onToggleSavedActivity={(activityId) => {
                                setSavedActivityIds((current) => current.filter((id) => id !== activityId));
                                void toggleSavedActivityApi(activityId).then((plans) => {
                                    setSavedActivityIds(plans.saved_activity_ids);
                                    setSavedLodgingIds(plans.saved_lodging_ids);
                                });
                            }}
                            onToggleSavedLodging={(lodgingId) => {
                                setSavedLodgingIds((current) => current.filter((id) => id !== lodgingId));
                                void toggleSavedLodgingApi(lodgingId).then((plans) => {
                                    setSavedActivityIds(plans.saved_activity_ids);
                                    setSavedLodgingIds(plans.saved_lodging_ids);
                                });
                            }}
                        />
                    )}
                </div>

                <div className="h-full min-w-0 flex-1">
                    <MapView
                        trips={trips}
                        selectedTrip={selectedTrip}
                        fullScreenTrip={fullScreenTrip}
                        selectedActivity={selectedActivity}
                        selectedLodging={selectedLodging}
                        onSelectTripById={(tripId) => {
                            void openTripById(tripId);
                        }}
                        onSelectActivity={handleSelectActivity}
                        onSelectLodging={handleSelectLodging}
                    />
                </div>
            </div>

            {profileState && (
                <UserProfileModal
                    key={`${profileState.profile.userId}-${profileState.expandFrom}`}
                    profile={profileState.profile}
                    expandFrom={profileState.expandFrom}
                    canManageTrips={profileState.canManageTrips}
                    deletingTripId={deletingTripId}
                    onDeleteTrip={(tripId) => {
                        void handleDeleteTrip(tripId);
                    }}
                    onSelectTrip={(tripId) => {
                        void openTripById(tripId);
                    }}
                    onAddTrip={() => {
                        const returnTo = pathname || "/";
                        router.push(`/trips?returnTo=${encodeURIComponent(returnTo)}`);
                    }}
                    onClose={() => setProfileState(null)}
                />
            )}

            <StudentAddMenu
                visible={isStudent && !showAnyLeftSidebar}
                onAddTrip={() => {
                    const returnTo = pathname || "/";
                    router.push(`/trips?returnTo=${encodeURIComponent(returnTo)}`);
                }}
                onAddPopUp={() => {
                    // Placeholder until pop-up feature is implemented.
                }}
            />

            {(isLoadingTrips || isLoadingTripById) && (
                <div className="pointer-events-none absolute bottom-4 right-4 z-[1000] rounded-full border border-border bg-card/95 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
                    Loading data...
                </div>
            )}
        </div>
    );
}
