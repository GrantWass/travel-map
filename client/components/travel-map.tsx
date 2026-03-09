"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { CircleUser, MapPin, Notebook, Search, X, Users } from "lucide-react";

import PlansSidebarPanel from "@/components/plans-sidebar-panel";
import SearchSidebarPanel from "@/components/search-sidebar-panel";
import SidebarPanel from "@/components/sidebar-panel";
import SignupRequiredModal from "@/components/signup-required-modal";
import StudentAddMenu from "@/components/student-add-menu";
import UserProfileModal from "@/components/user-profile-modal";
import FriendsModal from "@/components/friends-modal";
import BrandNameButton from "@/components/brand-name-button";
import OwnerFilterSlider from "@/components/owner-filter-slider";
import { buildSignupHref, getInviteTokenFromSearch, getStoredInviteToken, persistInviteToken } from "@/lib/auth-navigation";
import { toUserProfileFromApi, createTripComment, deleteTrip, getUnreadCommentCounts, getSavedPlans, getTrip, getTripComments, getUserProfile, markTripCommentsRead, toggleSavedActivity as toggleSavedActivityApi, toggleSavedLodging as toggleSavedLodgingApi } from "@/lib/api-client";
import type { TripActivity, Trip, TripLodging, User } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { deriveSelectedLocationContext, deriveTripMapPanels, useTripMapStore } from "@/stores/trip-map-store";
import { useAuthStore } from "@/stores/auth-store";
import { useFriendsStore } from "@/stores/friends-store";
import { filterTripsByDuration, filterTripsByOwner, getFriendIds, useTripSearchStore } from "@/stores/trip-search-store";

const MapView = dynamic(() => import("@/components/map-view"), {
    ssr: false,
    loading: () => (
        <div className="flex h-full w-full items-center justify-center bg-background">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
    ),
});

interface ProfileState {
    profile: User;
    expandFrom: "top-right" | "left";
    canManageTrips: boolean;
    canEditProfile: boolean;
}

type SignupPromptIntent = "add-trip" | "friends" | "plans" | "profile" | "save-to-plans" | "comment";

const SIGNUP_PROMPT_COPY: Record<SignupPromptIntent, { title: string; description: string }> = {
    "add-trip": {
        title: "Create an account to add trips",
        description: "Sign up or sign in to add trips and pop-up events to the map.",
    },
    friends: {
        title: "Create an account to use friends",
        description: "Sign up or sign in to invite friends and manage friend requests.",
    },
    plans: {
        title: "Create an account to open plans",
        description: "Sign up or sign in to save places and access your plans panel.",
    },
    profile: {
        title: "Create an account to view profiles",
        description: "Sign up or sign in to open traveler profiles and your account settings.",
    },
    "save-to-plans": {
        title: "Create an account to save to plans",
        description: "Sign up or sign in to save activities and lodgings for later.",
    },
    comment: {
        title: "Create an account to comment",
        description: "Sign up or sign in to join the conversation on this trip.",
    },
};

const REVIEW_PANEL_WIDTH = "min(483px, 100vw)";

interface TravelMapProps {
    initialPublicTrips?: Trip[];
}

export default function TravelMap({ initialPublicTrips }: TravelMapProps) {
    const router = useRouter();
    const pathname = usePathname();
    const userId = useAuthStore((state) => state.user?.user_id ?? null);
    const isStudent = Boolean(useAuthStore((state) => state.user?.verified));
    const myProfile = useAuthStore((state) => state.myProfile);
    const refreshMyProfile = useAuthStore((state) => state.refreshMyProfile);

    const trips = useTripMapStore((state) => state.trips);
    const acceptedFriendships = useFriendsStore((s) => s.accepted);
    const friendsLoaded = useFriendsStore((s) => s.loaded);
    const refreshFriends = useFriendsStore((s) => s.refresh);
    const selectedTrip = useTripMapStore((state) => state.selectedTrip);
    const fullScreenTrip = useTripMapStore((state) => state.fullScreenTrip);
    const searchPanelOpen = useTripMapStore((state) => state.searchPanelOpen);
    const plansPanelOpen = useTripMapStore((state) => state.plansPanelOpen);
    const searchQuery = useTripMapStore((state) => state.searchQuery);
    const isLoadingTrips = useTripMapStore((state) => state.isLoadingTrips);
    const isLoadingTripById = useTripMapStore((state) => state.isLoadingTripById);
    const loadTrips = useTripMapStore((state) => state.loadTrips);
    const upsertTrip = useTripMapStore((state) => state.upsertTrip);
    const removeTripById = useTripMapStore((state) => state.removeTripById);
    const setSelectedTrip = useTripMapStore((state) => state.setSelectedTrip);
    const clearSelections = useTripMapStore((state) => state.clearSelections);
    const setSearchQuery = useTripMapStore((state) => state.setSearchQuery);
    const openSearchPanel = useTripMapStore((state) => state.openSearchPanel);
    const closeSearchPanel = useTripMapStore((state) => state.closeSearchPanel);
    const togglePlansPanel = useTripMapStore((state) => state.togglePlansPanel);
    const closePlansPanel = useTripMapStore((state) => state.closePlansPanel);
    const previewTripAtLocation = useTripMapStore((state) => state.previewTripAtLocation);
    const setSavedActivityIds = useTripMapStore((state) => state.setSavedActivityIds);
    const setSavedLodgingIds = useTripMapStore((state) => state.setSavedLodgingIds);
    const toggleSavedActivityId = useTripMapStore((state) => state.toggleSavedActivityId);
    const toggleSavedLodgingId = useTripMapStore((state) => state.toggleSavedLodgingId);
    const removeSavedActivityId = useTripMapStore((state) => state.removeSavedActivityId);
    const removeSavedLodgingId = useTripMapStore((state) => state.removeSavedLodgingId);
    const setIsLoadingTripById = useTripMapStore((state) => state.setIsLoadingTripById);
    const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);
    const [mapContextMenu, setMapContextMenu] = useState<{ x: number; y: number; lat: number; lng: number } | null>(null);

    const [profileState, setProfileState] = useState<ProfileState | null>(null);
    const [friendsOpen, setFriendsOpen] = useState(false);
    const [signupPromptIntent, setSignupPromptIntent] = useState<SignupPromptIntent | null>(null);
    const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
    const [commentError, setCommentError] = useState<string | null>(null);
    const ownerFilter = useTripSearchStore((state) => state.ownerFilter);
    const setOwnerFilter = useTripSearchStore((state) => state.setOwnerFilter);
    const tripTypeFilter = useTripSearchStore((state) => state.tripTypeFilter);
    const [deletingTripId, setDeletingTripId] = useState<number | null>(null);
    const [profileCacheByUser, setProfileCacheByUser] = useState<Record<number, User>>({});
    const [notifiedTripIds, setNotifiedTripIds] = useState<Set<number>>(new Set());
    const activeTripRequestIdRef = useRef(0);
    const profileOpenRequestIdRef = useRef(0);

    const closeProfileModal = useCallback(() => {
        // Invalidate in-flight profile requests so late responses cannot reopen the modal.
        profileOpenRequestIdRef.current += 1;
        setProfileState(null);
    }, []);

    const applySavedPlans = useCallback((plans: Awaited<ReturnType<typeof getSavedPlans>>) => {
        setSavedActivityIds(plans.saved_activity_ids);
        setSavedLodgingIds(plans.saved_lodging_ids);
    }, [setSavedActivityIds, setSavedLodgingIds]);

    const tripLookup = useMemo(() => {
        return new Map(trips.map((trip) => [trip.trip_id, trip]));
    }, [trips]);

    const getSavedActivities = useTripMapStore((state) => state.getSavedActivities);
    const savedActivities = getSavedActivities();

    const getSavedLodgings = useTripMapStore((state) => state.getSavedLodgings);
    const savedLodgings = getSavedLodgings();

    const selectedLocationContext = useMemo(
        () => deriveSelectedLocationContext(trips, selectedTrip),
        [trips, selectedTrip],
    );

    const mapPanels = useMemo(
        () =>
            deriveTripMapPanels({
                selectedTrip,
                fullScreenTrip,
                searchPanelOpen,
                plansPanelOpen,
            }),
        [selectedTrip, fullScreenTrip, searchPanelOpen, plansPanelOpen],
    );

    const openSignupPrompt = useCallback((intent: SignupPromptIntent) => {
        setSignupPromptIntent(intent);
    }, []);

    const handleContinueToSignup = useCallback(() => {
        const search = new URLSearchParams(window.location.search);
        const inviteToken = getInviteTokenFromSearch(search) ?? getStoredInviteToken();
        const nextPath = `${window.location.pathname}${window.location.search}`;

        persistInviteToken(inviteToken);
        router.push(
            buildSignupHref({
                nextPath,
                inviteToken,
                prompt: signupPromptIntent ?? undefined,
            }),
        );
    }, [router, signupPromptIntent]);

    useEffect(() => {
        const inviteToken = getInviteTokenFromSearch(new URLSearchParams(window.location.search));
        if (inviteToken) {
            persistInviteToken(inviteToken);
        }
    }, []);

    const requireAuth = useCallback(
        (intent: SignupPromptIntent, action: () => void) => {
            if (userId === null) {
                openSignupPrompt(intent);
                return;
            }

            action();
        },
        [openSignupPrompt, userId],
    );

    const handleToggleSavedActivity = useCallback((_tripId: number, activity: TripActivity) => {
        if (userId === null) {
            openSignupPrompt("save-to-plans");
            return;
        }

        toggleSavedActivityId(activity.activity_id);
        void toggleSavedActivityApi(activity.activity_id).then((plans) => {
            applySavedPlans(plans);
        });
    }, [applySavedPlans, openSignupPrompt, toggleSavedActivityId, userId]);

    const handleToggleSavedLodging = useCallback((_tripId: number, lodging: TripLodging) => {
        if (userId === null) {
            openSignupPrompt("save-to-plans");
            return;
        }

        toggleSavedLodgingId(lodging.lodge_id);
        void toggleSavedLodgingApi(lodging.lodge_id).then((plans) => {
            applySavedPlans(plans);
        });
    }, [applySavedPlans, openSignupPrompt, toggleSavedLodgingId, userId]);

    useEffect(() => {
        void loadTrips(initialPublicTrips);
    }, [initialPublicTrips, loadTrips]);

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
        if (userId === null || friendsLoaded) {
            return;
        }

        void refreshFriends().catch(() => {
            // Ignore friendship preload failures; friends modal and retries can recover.
        });
    }, [userId, friendsLoaded, refreshFriends]);

    useEffect(() => {
        if (userId === null || ownerFilter !== "friends") {
            return;
        }

        void refreshFriends().catch(() => {
            // Ignore refresh failures and keep existing friend state.
        });
    }, [userId, ownerFilter, refreshFriends]);

    useEffect(() => {
        if (!myProfile?.user?.user_id) {
            return;
        }

        const cached = toUserProfileFromApi(myProfile);
        setProfileCacheByUser((current) => ({ ...current, [cached.user_id]: cached }));
    }, [myProfile]);

    // ── Notification helpers ─────────────────────────────────────────────────

    const fetchNotifications = useCallback(async () => {
        if (userId === null) return;
        try {
            const { unread_count_by_trip } = await getUnreadCommentCounts();
            const ids = new Set(
                Object.entries(unread_count_by_trip)
                    .filter(([, count]) => count > 0)
                    .map(([id]) => Number(id)),
            );
            setNotifiedTripIds(ids);
        } catch {
            // Ignore notification fetch failures.
        }
    }, [userId]);

    useEffect(() => {
        if (userId === null) {
            setNotifiedTripIds(new Set());
            return;
        }
        void fetchNotifications();
    }, [userId, fetchNotifications]);

    // Clear notification when user views their own trip.
    useEffect(() => {
        if (!selectedTrip || userId === null) return;
        if (selectedTrip.owner_user_id !== userId) return;

        // Use functional update to read current state — avoids stale closure bug.
        setNotifiedTripIds((prev) => {
            if (!prev.has(selectedTrip.trip_id)) return prev;
            const next = new Set(prev);
            next.delete(selectedTrip.trip_id);
            // Fire-and-forget: sync the read marker to the server.
            // Don't refetch afterward — the server mark-read uses a global timestamp
            // that would clear all other trips' local dots incorrectly.
            void markTripCommentsRead().catch(() => undefined);
            return next;
        });
    }, [selectedTrip?.trip_id, userId]);

    // ────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        setCommentError(null);
    }, [selectedTrip?.trip_id]);

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
                // TODO: See if trip is already in store with full details to avoid unnecessary fetch.
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


    const handleShowPreviousTripAtLocation = useCallback(() => {
        if (!selectedLocationContext.hasPrevious) {
            return;
        }

        const previousTrip = selectedLocationContext.trips[selectedLocationContext.selectedIndex - 1];
        if (!previousTrip) {
            return;
        }

        activeTripRequestIdRef.current += 1;
        previewTripAtLocation(previousTrip);
    }, [previewTripAtLocation, selectedLocationContext]);

    const handleShowNextTripAtLocation = useCallback(() => {
        if (!selectedLocationContext.hasNext) {
            return;
        }

        const nextTrip = selectedLocationContext.trips[selectedLocationContext.selectedIndex + 1];
        if (!nextTrip) {
            return;
        }

        activeTripRequestIdRef.current += 1;
        previewTripAtLocation(nextTrip);
    }, [previewTripAtLocation, selectedLocationContext]);

    const openProfile = useCallback(
        async (targetUserId: number, expandFrom: "top-right" | "left") => {
            const requestId = profileOpenRequestIdRef.current + 1;
            profileOpenRequestIdRef.current = requestId;
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
                    if (profileOpenRequestIdRef.current !== requestId) {
                        return;
                    }
                    if (!refreshedOwnProfile) {
                        return;
                    }

                    const mappedOwnProfile = toUserProfileFromApi(refreshedOwnProfile);
                    setProfileCacheByUser((current) => ({ ...current, [mappedOwnProfile.user_id]: mappedOwnProfile }));
                    setProfileState({
                        profile: mappedOwnProfile,
                        expandFrom,
                        canManageTrips,
                        canEditProfile,
                    });
                    return;
                }

                const profileResponse = await getUserProfile(targetUserId);
                if (profileOpenRequestIdRef.current !== requestId) {
                    return;
                }
                const mappedProfile = toUserProfileFromApi(profileResponse);

                setProfileCacheByUser((current) => ({ ...current, [mappedProfile.user_id]: mappedProfile }));
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
                    if (!current || current.profile.user_id !== userId) {
                        return current;
                    }

                    return {
                        ...current,
                        profile: {
                            ...current.profile,
                            trips: (current.profile.trips ?? []).filter((trip) => trip.trip_id !== tripId),
                        },
                    };
                });

                const refreshedOwnProfile = await refreshMyProfile(userId);
                if (refreshedOwnProfile) {
                    const mappedOwnProfile = toUserProfileFromApi(refreshedOwnProfile);
                    setProfileCacheByUser((current) => ({ ...current, [mappedOwnProfile.user_id]: mappedOwnProfile }));
                    setProfileState((current) => {
                        if (!current || current.profile.user_id !== mappedOwnProfile.user_id) {
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

        const handleLoadComments = useCallback(async () => {
            if (!selectedTrip) {
                return;
            }

            try {
                const comments = await getTripComments(selectedTrip.trip_id);
                upsertTrip({ ...selectedTrip, comments });
                setCommentError(null);
            } catch {
                setCommentError("Could not load comments right now.");
            }
        }, [selectedTrip, upsertTrip]);

        const handleCreateComment = useCallback(
            async (body: string) => {
                if (!selectedTrip) {
                    return;
                }
                if (userId === null) {
                    openSignupPrompt("comment");
                    return;
                }

                setIsCommentSubmitting(true);
                setCommentError(null);
                try {
                    const createdComment = await createTripComment(selectedTrip.trip_id, body);
                    upsertTrip({
                        ...selectedTrip,
                        comments: [createdComment, ...(selectedTrip.comments ?? [])],
                    });
                } catch {
                    setCommentError("Could not post comment right now.");
                } finally {
                    setIsCommentSubmitting(false);
                }
            },
            [openSignupPrompt, selectedTrip, upsertTrip, userId],
        );

    const topLeftControlsWidthClass = "w-[min(506px,calc(100vw-2rem))]";

    const friendIds = useMemo(() => getFriendIds(acceptedFriendships, userId), [acceptedFriendships, userId]);

    const filteredTrips = useMemo(
        () => filterTripsByDuration(filterTripsByOwner(trips, ownerFilter, userId, friendIds), tripTypeFilter),
        [trips, ownerFilter, userId, friendIds, tripTypeFilter],
    );

    return (
        <div className="relative h-screen w-screen overflow-hidden">
            {mapPanels.showTopLeftControls && (
                <>
                    <div className={`absolute left-4 top-3 z-[1000] hidden sm:block ${topLeftControlsWidthClass}`}>
                        <div className="flex items-center gap-2">
                            <div data-spotlight="explore" className="flex h-12 flex-1 items-center gap-2 rounded-full border border-border px-5 shadow-sm bg-secondary/40 backdrop-blur-sm">
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
                                data-spotlight="plans"
                                type="button"
                                onClick={() => requireAuth("plans", togglePlansPanel)}
                                className={cn(
                                    "flex h-12 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-medium shadow-sm bg-secondary/40 backdrop-blur-sm transition-colors",
                                    mapPanels.showPlansPanel
                                        ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                                        : "border-border text-foreground hover:bg-secondary/60",
                                )}
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
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-border shadow-sm bg-secondary/40 backdrop-blur-sm transition-colors hover:bg-secondary/60"
                            aria-label="Open search"
                        >
                            <Search className="h-5 w-5 text-foreground" />
                        </button>
                        <button
                            type="button"
                            onClick={() => requireAuth("plans", togglePlansPanel)}
                            className={cn(
                                "flex h-11 w-11 items-center justify-center rounded-full border shadow-sm bg-secondary/40 backdrop-blur-sm transition-colors",
                                mapPanels.showPlansPanel
                                    ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                                    : "border-border text-foreground hover:bg-secondary/60",
                            )}
                            aria-label="Open plans"
                            title="Plans"
                        >
                            <Notebook className="h-5 w-5" />
                        </button>
                    </div>
                </>
            )}

            <div className={`absolute right-4 top-4 z-[1000] items-center gap-2 ${mapPanels.showAnyLeftSidebar ? "hidden sm:flex" : "flex"}`}>
                <div className="hidden h-11 items-center gap-2 rounded-full border border-border px-5 shadow-sm bg-secondary/40 backdrop-blur-sm sm:flex">
                    <MapPin className="h-5 w-5 text-primary" />
                    <BrandNameButton
                        className="text-lg text-foreground"
                        popupClassName="w-56"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        data-spotlight="friends"
                        type="button"
                        aria-label="Open friends"
                        onClick={() => requireAuth("friends", () => setFriendsOpen(true))}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-border shadow-sm bg-secondary/40 backdrop-blur-sm transition-colors hover:bg-secondary/60"
                    >
                        <Users className="h-6 w-6 text-foreground" />
                    </button>

                    <button
                        data-spotlight="profile"
                        onClick={() => {
                            requireAuth("profile", () => {
                                if (userId === null) {
                                    return;
                                }

                                void openProfile(userId, "top-right");
                            });
                        }}
                        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-border shadow-sm bg-secondary/40 backdrop-blur-sm transition-colors hover:bg-secondary/60"
                        aria-label="Open profile"
                    >
                        <CircleUser className="h-6 w-6 text-foreground" />
                        {notifiedTripIds.size > 0 && (
                            <span className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-red-500 border-2 border-card" />
                        )}
                    </button>
                </div>
            </div>

            <div className="flex h-full w-full">
                <div
                    className="h-full flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{
                        width:
                                mapPanels.showSidebar || mapPanels.showSearchPanel || mapPanels.showPlansPanel ? REVIEW_PANEL_WIDTH : 0,
                    }}
                >
                            {mapPanels.showSidebar && selectedTrip && (
                        <SidebarPanel
                            review={selectedTrip}
                            onClose={() => void openTripById(null)}
                            onOpenAuthorProfile={(profileUserId) => {
                                requireAuth("profile", () => {
                                    void openProfile(profileUserId, "left");
                                });
                            }}
                            onExpandImage={setExpandedImage}
                            onToggleSavedActivity={handleToggleSavedActivity}
                            onToggleSavedLodging={handleToggleSavedLodging}
                            onEditTrip={
                                userId !== null && isStudent && selectedTrip.owner_user_id === userId
                                    ? () => {
                                          const isPopup = Boolean(selectedTrip.event_start && selectedTrip.event_end);
                                          const base = `/trips?edit=${selectedTrip.trip_id}&returnTo=${encodeURIComponent(pathname || "/")}`;
                                          router.push(isPopup ? `${base}&mode=popup` : base);
                                      }
                                    : undefined
                            }
                            locationTripCount={selectedLocationContext.trips.length}
                            locationTripPosition={selectedLocationContext.selectedIndex >= 0 ? selectedLocationContext.selectedIndex + 1 : 1}
                            onShowPreviousTripAtLocation={handleShowPreviousTripAtLocation}
                            onShowNextTripAtLocation={handleShowNextTripAtLocation}
                            canShowPreviousTripAtLocation={selectedLocationContext.hasPrevious}
                            canShowNextTripAtLocation={selectedLocationContext.hasNext}
                            comments={selectedTrip.comments ?? []}
                            isAuthenticated={userId !== null}
                            isCommentSubmitting={isCommentSubmitting}
                            commentError={commentError}
                            onCommentSubmit={handleCreateComment}
                            onLoadComments={() => {
                                void handleLoadComments();
                            }}
                            onRequireSignInToComment={() => {
                                openSignupPrompt("comment");
                            }}
                        />
                    )}
                    {mapPanels.showSearchPanel && (
                        <SearchSidebarPanel
                            query={searchQuery}
                            trips={trips}
                            ownerFilter={ownerFilter}
                            onOwnerFilterChange={setOwnerFilter}
                            currentUserId={userId}
                            friendIds={friendIds}
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
                    {mapPanels.showPlansPanel && (
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
                                if (userId === null) {
                                    openSignupPrompt("save-to-plans");
                                    return;
                                }

                                removeSavedActivityId(activityId);
                                void toggleSavedActivityApi(activityId).then((plans) => {
                                    applySavedPlans(plans);
                                });
                            }}
                            onToggleSavedLodging={(lodgingId) => {
                                if (userId === null) {
                                    openSignupPrompt("save-to-plans");
                                    return;
                                }

                                removeSavedLodgingId(lodgingId);
                                void toggleSavedLodgingApi(lodgingId).then((plans) => {
                                    applySavedPlans(plans);
                                });
                            }}
                        />
                    )}
                </div>

                <div data-spotlight="map" className="relative h-full min-w-0 flex-1">
                    <MapView
                        visibleTrips={filteredTrips}
                        onSelectTripById={(tripId) => {
                            void openTripById(tripId);
                        }}
                        onRightClick={isStudent ? (lat, lng, x, y) => {
                            setMapContextMenu({ lat, lng, x, y });
                        } : undefined}
                    />
                    {/* Floating owner filter control (bottom-center) */}
                    <div data-spotlight="owner-filter" className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] hidden md:flex transition-opacity duration-200 ${mapPanels.showSearchPanel ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                        <div className="shadow-md backdrop-blur-sm rounded-full">
                            <OwnerFilterSlider value={ownerFilter} onChange={setOwnerFilter} />
                        </div>
                    </div>
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

            {mapContextMenu && (
                <>
                    <div
                        className="fixed inset-0 z-[1500]"
                        onClick={() => setMapContextMenu(null)}
                        onContextMenu={(e) => { e.preventDefault(); setMapContextMenu(null); }}
                    />
                    <div
                        className="fixed z-[1501] min-w-[200px] overflow-hidden rounded-lg border border-border bg-card shadow-lg"
                        style={{ left: mapContextMenu.x, top: mapContextMenu.y }}
                    >
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
                            onClick={() => {
                                setMapContextMenu(null);
                                router.push(`/trips?lat=${mapContextMenu.lat}&lng=${mapContextMenu.lng}&returnTo=${encodeURIComponent(pathname || "/")}`);
                            }}
                        >
                            <MapPin className="h-4 w-4 text-primary" />
                            Create trip at this location
                        </button>
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
                            onClick={() => {
                                setMapContextMenu(null);
                                router.push(`/trips?mode=popup&lat=${mapContextMenu.lat}&lng=${mapContextMenu.lng}&returnTo=${encodeURIComponent(pathname || "/")}`);
                            }}
                        >
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            Create popup at this location
                        </button>
                    </div>
                </>
            )}

            {profileState && (
                <UserProfileModal
                    key={`${profileState.profile.user_id}-${profileState.expandFrom}`}
                    profile={profileState.profile}
                    expandFrom={profileState.expandFrom}
                    canManageTrips={profileState.canManageTrips}
                    canEditProfile={profileState.canEditProfile}
                    deletingTripId={deletingTripId}
                    notifiedTripIds={profileState.canEditProfile ? notifiedTripIds : undefined}
                    onDeleteTrip={(tripId) => {
                        void handleDeleteTrip(tripId);
                    }}
                    onSelectTrip={(tripId) => {
                        void openTripById(tripId);
                    }}
                    onAddTrip={() => {
                        requireAuth("add-trip", () => {
                            const returnTo = pathname || "/";
                            router.push(`/trips?returnTo=${encodeURIComponent(returnTo)}`);
                        });
                    }}
                    onEditTrip={(tripId) => {
                        const returnTo = pathname || "/";
                        // Check if the trip is a popup by looking it up in the store.
                        const trip = trips.find((t) => t.trip_id === tripId);
                        const isPopup = Boolean(trip?.event_start && trip?.event_end);
                        const base = `/trips?edit=${tripId}&returnTo=${encodeURIComponent(returnTo)}`;
                        router.push(isPopup ? `${base}&mode=popup` : base);
                    }}
                    onClose={closeProfileModal}
                />
            )}

            {friendsOpen && (
                <FriendsModal
                    onClose={() => setFriendsOpen(false)}
                    onSelectTrip={(tripId) => {
                        void openTripById(tripId);
                    }}
                />
            )}

            <SignupRequiredModal
                open={signupPromptIntent !== null}
                title={signupPromptIntent ? SIGNUP_PROMPT_COPY[signupPromptIntent].title : undefined}
                description={signupPromptIntent ? SIGNUP_PROMPT_COPY[signupPromptIntent].description : undefined}
                onClose={() => setSignupPromptIntent(null)}
                onConfirm={handleContinueToSignup}
            />

            <StudentAddMenu
                visible={(isStudent || userId === null) && !mapPanels.showAnyLeftSidebar}
                onAddTrip={() => {
                    requireAuth("add-trip", () => {
                        const returnTo = pathname || "/";
                        router.push(`/trips?returnTo=${encodeURIComponent(returnTo)}`);
                    });
                }}
                onAddPopUp={() => {
                    requireAuth("add-trip", () => {
                        const returnTo = pathname || "/";
                        router.push(`/trips?mode=popup&returnTo=${encodeURIComponent(returnTo)}`);
                    });
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
