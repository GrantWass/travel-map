"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { CircleUser, MapPin, Notebook, Search, X } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import FullScreenReview from "@/components/full-screen-review";
import PlansSidebarPanel from "@/components/plans-sidebar-panel";
import SearchSidebarPanel from "@/components/search-sidebar-panel";
import SidebarPanel from "@/components/sidebar-panel";
import StudentAddMenu from "@/components/student-add-menu";
import UserProfileModal, { type UserProfile } from "@/components/user-profile-modal";
import BrandNameButton from "@/components/brand-name-button";
import { deleteTrip, getSavedPlans, getTrip, getTrips, getUserProfile, toggleSavedActivity as toggleSavedActivityApi, toggleSavedLodging as toggleSavedLodgingApi } from "@/lib/api-client";
import type { UserProfileResponse, TripActivity, Trip, TripLodging } from "@/lib/api-types";
import type { ModalProfile, SavedActivityEntry, SavedLodgingEntry } from "@/lib/trip-models";
import { toModalProfile } from "@/lib/trip-models";
import { useTripMapStore } from "@/stores/trip-map-store";

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
    canEditProfile: boolean;
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

    const trips = useTripMapStore((state) => state.trips);
    const selectedTrip = useTripMapStore((state) => state.selectedTrip);
    const fullScreenTrip = useTripMapStore((state) => state.fullScreenTrip);
    const searchQuery = useTripMapStore((state) => state.searchQuery);
    const searchPanelOpen = useTripMapStore((state) => state.searchPanelOpen);
    const plansPanelOpen = useTripMapStore((state) => state.plansPanelOpen);
    const savedActivityIds = useTripMapStore((state) => state.savedActivityIds);
    const savedLodgingIds = useTripMapStore((state) => state.savedLodgingIds);
    const isLoadingTrips = useTripMapStore((state) => state.isLoadingTrips);
    const isLoadingTripById = useTripMapStore((state) => state.isLoadingTripById);
    const setTrips = useTripMapStore((state) => state.setTrips);
    const upsertTrip = useTripMapStore((state) => state.upsertTrip);
    const removeTripById = useTripMapStore((state) => state.removeTripById);
    const setSelectedTrip = useTripMapStore((state) => state.setSelectedTrip);
    const clearSelections = useTripMapStore((state) => state.clearSelections);
    const setSearchQuery = useTripMapStore((state) => state.setSearchQuery);
    const openSearchPanel = useTripMapStore((state) => state.openSearchPanel);
    const closeSearchPanel = useTripMapStore((state) => state.closeSearchPanel);
    const togglePlansPanel = useTripMapStore((state) => state.togglePlansPanel);
    const closePlansPanel = useTripMapStore((state) => state.closePlansPanel);
    const showTripInFullScreen = useTripMapStore((state) => state.showTripInFullScreen);
    const showFullScreenTripInSidebar = useTripMapStore((state) => state.showFullScreenTripInSidebar);
    const previewTripAtLocation = useTripMapStore((state) => state.previewTripAtLocation);
    const setSavedActivityIds = useTripMapStore((state) => state.setSavedActivityIds);
    const setSavedLodgingIds = useTripMapStore((state) => state.setSavedLodgingIds);
    const toggleSavedActivityId = useTripMapStore((state) => state.toggleSavedActivityId);
    const toggleSavedLodgingId = useTripMapStore((state) => state.toggleSavedLodgingId);
    const removeSavedActivityId = useTripMapStore((state) => state.removeSavedActivityId);
    const removeSavedLodgingId = useTripMapStore((state) => state.removeSavedLodgingId);
    const setIsLoadingTrips = useTripMapStore((state) => state.setIsLoadingTrips);
    const setIsLoadingTripById = useTripMapStore((state) => state.setIsLoadingTripById);
    const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);

    const [profileState, setProfileState] = useState<ProfileState | null>(null);
    const [deletingTripId, setDeletingTripId] = useState<number | null>(null);
    const [profileCacheByUser, setProfileCacheByUser] = useState<Record<number, UserProfile>>({});
    const activeTripRequestIdRef = useRef(0);

    const applySavedPlans = useCallback((plans: Awaited<ReturnType<typeof getSavedPlans>>) => {
        setSavedActivityIds(plans.saved_activity_ids);
        setSavedLodgingIds(plans.saved_lodging_ids);
    }, [setSavedActivityIds, setSavedLodgingIds]);

    const tripLookup = useMemo(() => {
        return new Map(trips.map((trip) => [trip.trip_id, trip]));
    }, [trips]);

    const savedActivityIdSet = useMemo(() => new Set(savedActivityIds), [savedActivityIds]);
    const savedLodgingIdSet = useMemo(() => new Set(savedLodgingIds), [savedLodgingIds]);

    const savedActivities = useMemo<SavedActivityEntry[]>(() => {
        return trips.flatMap((trip) =>
            trip.activities
                .filter((activity) => savedActivityIdSet.has(activity.activity_id))
                .map((activity) => ({
                    tripId: trip.trip_id,
                    tripTitle: trip.title || "",
                    tripThumbnail: trip.thumbnail_url,
                    activity,
                })),
        );
    }, [trips, savedActivityIdSet]);

    const savedLodgings = useMemo<SavedLodgingEntry[]>(() => {
        return trips.flatMap((trip) =>
            trip.lodgings
                .filter((lodging) => savedLodgingIdSet.has(lodging.lodge_id))
                .map((lodging) => ({
                    tripId: trip.trip_id,
                    tripTitle: trip.title || "",
                    tripThumbnail: trip.thumbnail_url,
                    lodging,
                })),
        );
    }, [trips, savedLodgingIdSet]);

    const handleToggleSavedActivity = useCallback((_tripId: number, activity: TripActivity) => {
        const id = activity.activity_id;
        toggleSavedActivityId(id);
        void toggleSavedActivityApi(id).then((plans) => {
            applySavedPlans(plans);
        });
    }, [applySavedPlans, toggleSavedActivityId]);

    const handleToggleSavedLodging = useCallback((_tripId: number, lodging: TripLodging) => {
        const id = lodging.lodge_id;
        toggleSavedLodgingId(id);
        void toggleSavedLodgingApi(id).then((plans) => {
            applySavedPlans(plans);
        });
    }, [applySavedPlans, toggleSavedLodgingId]);

    useEffect(() => {
        let isMounted = true;

        async function loadTrips() {
            try {
                const apiTrips = await getTrips();
                if (!isMounted) {
                    return;
                }

                const now = new Date();
                setTrips(
                    apiTrips
                        .filter((trip): trip is Trip => Boolean(trip))
                        .filter((trip) => !(trip.event_end && trip.event_start) || (trip.event_end !== null && new Date(trip.event_end) > now)),
                );
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
                applySavedPlans(plans);
            })
            .catch(() => {
                // Not authenticated or fetch failed — leave state empty.
            });
    }, [applySavedPlans, userId]);

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
                clearSelections();
                closePlansPanel();
                setIsLoadingTripById(false);
                return;
            }

            const cached = tripLookup.get(tripId);
            if (cached) {
                setSelectedTrip(cached);
            }

            setIsLoadingTripById(true);
            try {
                const trip = await getTrip(tripId);
                if (!trip) {
                    return;
                }

                // Don't open expired popups.
                const is_popup = trip.event_end && trip.event_start;
                if (is_popup && trip.event_end !== null && trip.event_end !== undefined && new Date(trip.event_end) <= new Date()) {
                    return;
                }

                upsertTrip(trip);
                if (requestId !== activeTripRequestIdRef.current) {
                    return;
                }

                clearSelections();
                setSelectedTrip(trip);
                closeSearchPanel();
                closePlansPanel();
            } catch {
                // If trip fetch fails, keep any cached view state.
            } finally {
                if (requestId === activeTripRequestIdRef.current) {
                    setIsLoadingTripById(false);
                }
            }
        },
        [clearSelections, closePlansPanel, setIsLoadingTripById, tripLookup, upsertTrip, setSelectedTrip, closeSearchPanel],
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

    const handleViewFull = useCallback((trip: Trip) => {
        const isPopup = trip.event_end && trip.event_start
        if (isPopup) {
            return;
        }

        showTripInFullScreen(trip);
    }, [showTripInFullScreen]);

    const handleBack = useCallback(() => {
        showFullScreenTripInSidebar();
    }, [showFullScreenTripInSidebar]);

    const tripsAtSelectedLocation = useMemo(() => {
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
    }, [trips, selectedTrip]);

    const selectedTripLocationIndex = useMemo(() => {
        if (!selectedTrip) {
            return -1;
        }

        return tripsAtSelectedLocation.findIndex((trip) => trip.trip_id === selectedTrip.trip_id);
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
        previewTripAtLocation(previousTrip);
    }, [previewTripAtLocation, selectedTripLocationIndex, tripsAtSelectedLocation]);

    const handleShowNextTripAtLocation = useCallback(() => {
        if (selectedTripLocationIndex < 0 || selectedTripLocationIndex >= tripsAtSelectedLocation.length - 1) {
            return;
        }

        const nextTrip = tripsAtSelectedLocation[selectedTripLocationIndex + 1];
        if (!nextTrip) {
            return;
        }

        activeTripRequestIdRef.current += 1;
        previewTripAtLocation(nextTrip);
    }, [previewTripAtLocation, selectedTripLocationIndex, tripsAtSelectedLocation]);

    const openProfile = useCallback(
        async (targetUserId: number, expandFrom: "top-right" | "left") => {
            const canManageTrips = userId !== null && targetUserId === userId && isStudent;
            const canEditProfile = userId !== null && targetUserId === userId;

            if (userId !== null && targetUserId === userId && myProfile) {
                setProfileState({
                    profile: toUserProfileFromApi(myProfile),
                    expandFrom,
                    canManageTrips,
                    canEditProfile,
                });
            }

            const cachedProfile = profileCacheByUser[targetUserId];
            if (cachedProfile) {
                setProfileState({
                    profile: cachedProfile,
                    expandFrom,
                    canManageTrips,
                    canEditProfile,
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
                        canEditProfile,
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
                    canEditProfile,
                });
            } catch {
                // Ignore profile lookup failures for now.
            }
        },
        [isStudent, myProfile, profileCacheByUser, refreshMyProfile, userId],
    );

    const handleDeleteTrip = useCallback(
        async (tripId: number) => {
            if (userId === null) {
                return;
            }

            setDeletingTripId(tripId);
            try {
                await deleteTrip(tripId);

                removeTripById(tripId);

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
        [refreshMyProfile, removeTripById, userId],
    );

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
                <>
                    <div className={`absolute left-4 top-3 z-[1000] hidden sm:block ${topLeftControlsWidthClass}`}>
                        <div className="flex items-center gap-2">
                            <div className="flex h-12 flex-1 items-center gap-2 rounded-full border border-border bg-card/95 px-5 shadow-sm backdrop-blur-sm">
                                <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={openSearchPanel}
                                    placeholder="Search trips, places, or keywords"
                                    className="h-full w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                                    aria-label="Search trips"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={togglePlansPanel}
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
                    <div className="absolute left-4 top-4 z-[1000] flex items-center gap-2 sm:hidden">
                        <button
                            type="button"
                            onClick={openSearchPanel}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-card"
                            aria-label="Open search"
                        >
                            <Search className="h-5 w-5 text-foreground" />
                        </button>
                        <button
                            type="button"
                            onClick={togglePlansPanel}
                            className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm transition-colors ${
                                showPlansPanel
                                    ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                                    : "border-border bg-card/90 text-foreground hover:bg-card"
                            }`}
                            aria-label="Open plans"
                            title="Plans"
                        >
                            <Notebook className="h-5 w-5" />
                        </button>
                    </div>
                </>
            )}

            <div className={`absolute right-4 top-4 z-[1000] items-center gap-2 ${showAnyLeftSidebar ? "hidden sm:flex" : "flex"}`}>
                <div className="hidden items-center gap-2 rounded-full border border-border bg-card/90 px-5 py-2.5 shadow-sm backdrop-blur-sm sm:flex">
                    <MapPin className="h-5 w-5 text-primary" />
                    <BrandNameButton
                        className="text-lg text-foreground"
                        popupClassName="w-56"
                    />
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
                            onBack={handleBack}
                            onOpenAuthorProfile={(profileUserId) => {
                                void openProfile(profileUserId, "left");
                            }}
                            onExpandImage={setExpandedImage}
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
                            onQueryChange={setSearchQuery}
                            onClose={() => {
                                closeSearchPanel();
                            }}
                            onSelectTrip={(tripId) => {
                                closeSearchPanel();
                                void openTripById(tripId);
                            }}
                        />
                    )}
                    {showPlansPanel && (
                        <PlansSidebarPanel
                            savedActivities={savedActivities}
                            savedLodgings={savedLodgings}
                            onClose={() => {
                                closePlansPanel();
                            }}
                            onOpenTrip={(tripId) => {
                                closePlansPanel();
                                void openTripById(tripId);
                            }}
                            onToggleSavedActivity={(activityId) => {
                                removeSavedActivityId(activityId);
                                void toggleSavedActivityApi(activityId).then((plans) => {
                                    applySavedPlans(plans);
                                });
                            }}
                            onToggleSavedLodging={(lodgingId) => {
                                removeSavedLodgingId(lodgingId);
                                void toggleSavedLodgingApi(lodgingId).then((plans) => {
                                    applySavedPlans(plans);
                                });
                            }}
                        />
                    )}
                </div>

                <div className="relative h-full min-w-0 flex-1">
                    <MapView
                        onSelectTripById={(tripId) => {
                            void openTripById(tripId);
                        }}
                    />
                    {expandedImage && (
                        <div
                            className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 p-10 backdrop-blur-sm"
                            onClick={() => setExpandedImage(null)}
                        >
                            <div
                                className="relative flex max-h-full max-w-full flex-col overflow-hidden rounded-xl border border-white/15 bg-zinc-950 shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    type="button"
                                    onClick={() => setExpandedImage(null)}
                                    className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                                    aria-label="Close image"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                                <div className="relative h-[60vh] w-[min(700px,80vw)]">
                                    <Image
                                        src={expandedImage.src}
                                        alt={expandedImage.alt}
                                        fill
                                        className="object-contain"
                                        sizes="700px"
                                    />
                                </div>
                                <p className="border-t border-white/15 px-4 py-3 text-sm text-white/85">
                                    {expandedImage.alt}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {profileState && (
                <UserProfileModal
                    key={`${profileState.profile.userId}-${profileState.expandFrom}`}
                    profile={profileState.profile}
                    expandFrom={profileState.expandFrom}
                    canManageTrips={profileState.canManageTrips}
                    canEditProfile={profileState.canEditProfile}
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
                    const returnTo = pathname || "/";
                    router.push(`/trips?mode=popup&returnTo=${encodeURIComponent(returnTo)}`);
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
