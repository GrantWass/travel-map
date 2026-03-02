"use client";

import Image from "next/image";
import { X, ArrowRight, MapPin, Calendar, Notebook, ChevronLeft, ChevronRight, User, BedDouble, Timer } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTripMapStore } from "@/stores/trip-map-store";
import type { TripActivity, TripLodging, Trip } from "@/lib/api-types";
import { formatTripDate, formatPopupTimeRange } from "@/lib/utils";
import { DEFAULT_FALLBACK_IMAGE } from "@/lib/trip-constants";

interface SidebarPanelProps {
    review: Trip;
    onClose: () => void;
    onViewFull: (trip: Trip) => void;
    onOpenAuthorProfile: (userId: number) => void;
    onToggleSavedActivity: (tripId: number, activity: TripActivity) => void;
    onToggleSavedLodging: (tripId: number, lodging: TripLodging) => void;
    locationTripCount: number;
    locationTripPosition: number;
    onShowPreviousTripAtLocation: () => void;
    onShowNextTripAtLocation: () => void;
    canShowPreviousTripAtLocation: boolean;
    canShowNextTripAtLocation: boolean;
}

export default function SidebarPanel({
    review,
    onClose,
    onViewFull,
    onOpenAuthorProfile,
    onToggleSavedActivity,
    onToggleSavedLodging,
    locationTripCount,
    locationTripPosition,
    onShowPreviousTripAtLocation,
    onShowNextTripAtLocation,
    canShowPreviousTripAtLocation,
    canShowNextTripAtLocation,
}: SidebarPanelProps) {
    const selectedActivity = useTripMapStore((state) => state.selectedActivity);
    const selectedLodging = useTripMapStore((state) => state.selectedLodging);
    const setSelectedActivity = useTripMapStore((state) => state.setSelectedActivity);
    const setSelectedLodging = useTripMapStore((state) => state.setSelectedLodging);
    const savedActivityIds = new Set(useTripMapStore((state) => state.savedActivityIds));
    const savedLodgingIds = new Set(useTripMapStore((state) => state.savedLodgingIds));
    const selectedActivityId = selectedActivity?.activity_id ?? null;
    const selectedLodgingId = selectedLodging?.lodge_id ?? null;

    const fabActivity = review.activities.find((a) => a.activity_id === selectedActivityId) ?? null;
    const fabLodging = !fabActivity ? (review.lodgings.find((l) => l.lodge_id === selectedLodgingId) ?? null) : null;

    const fabSaved = fabActivity
        ? savedActivityIds.has(fabActivity.activity_id)
        : fabLodging
          ? savedLodgingIds.has(fabLodging.lodge_id)
          : false;

    const fabVisible = fabActivity !== null || fabLodging !== null;

    function handleFabClick() {
        if (fabActivity) {
            onToggleSavedActivity(review.trip_id, fabActivity);
        } else if (fabLodging) {
            onToggleSavedLodging(review.trip_id, fabLodging);
        }
    }

    return (
        <div className="relative flex h-full w-full flex-col bg-card border-r border-border">
            {/* Header image */}
            <div className="relative h-56 flex-shrink-0">
                <Image src={review.thumbnail_url} alt={review.title} fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {locationTripCount > 1 && (
                    <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/45 p-1 text-white backdrop-blur-sm">
                        <button
                            type="button"
                            onClick={onShowPreviousTripAtLocation}
                            disabled={!canShowPreviousTripAtLocation}
                            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:cursor-default disabled:opacity-40"
                            aria-label="Show previous trip at this location"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="px-1 text-xs font-medium">
                            {locationTripPosition}/{locationTripCount}
                        </span>
                        <button
                            type="button"
                            onClick={onShowNextTripAtLocation}
                            disabled={!canShowNextTripAtLocation}
                            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:cursor-default disabled:opacity-40"
                            aria-label="Show next trip at this location"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                )}
                <button
                    onClick={onClose}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white transition-colors hover:bg-black/60"
                    aria-label="Close panel"
                >
                    <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-4 left-5 right-5">
                    <h2 className="text-2xl font-semibold tracking-tight text-white text-balance">{review.title}</h2>
                </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="flex flex-col gap-5 p-5 pb-20">
                    {/* Meta */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <button
                            onClick={() => onOpenAuthorProfile(review.owner_user_id)}
                            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                        >
                            <User className="h-3.5 w-3.5" />
                            {review.owner.name || "Unknown traveler"}
                        </button>
                        {review.event_start && review.event_end ? (
                            <span className="flex items-center gap-1.5 font-medium text-amber-700">
                                <Timer className="h-3.5 w-3.5" />
                                {formatPopupTimeRange(review.event_start, review.event_end)}
                            </span>
                        ) : (
                            (review.date && 
                            <span className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatTripDate(review.date)}
                            </span>
                            )
                        )}
                    </div>

                    {/* Summary */}
                    <p className="text-sm leading-relaxed text-foreground/80">{review.description}</p>

                    {/* Stays preview — hidden for pop-up events */}
                    {!(review.event_end && review.event_start) && <div className="flex flex-col gap-3">
                        <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                            <BedDouble className="h-3.5 w-3.5" />
                            Places Stayed
                        </h3>
                        {review.lodgings.length > 0 ? (
                            review.lodgings.map((lodging) => (
                                <button
                                    type="button"
                                    key={lodging.lodge_id}
                                    onClick={() => setSelectedLodging(selectedLodgingId === lodging.lodge_id ? null : lodging)}
                                    className={cn(
                                        "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors",
                                        selectedLodgingId === lodging.lodge_id
                                            ? "bg-primary/10 ring-1 ring-primary/30"
                                            : "bg-secondary/40 hover:bg-secondary/60",
                                    )}
                                >
                                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                                        <Image src={lodging.thumbnail_url || DEFAULT_FALLBACK_IMAGE} alt={lodging.title || "Lodging"} fill className="object-cover" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-foreground break-words">{lodging.title}</p>
                                        <p className="text-xs text-muted-foreground break-words whitespace-normal">
                                            {lodging.address}
                                        </p>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">No places stayed were added for this trip.</p>
                        )}
                    </div>}

                    {/* Activities preview — hidden for pop-up events */}
                    {!(review.event_end && review.event_start) && <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                            Activities
                        </h3>
                        {review.activities.length > 0 ? (
                            review.activities.map((activity) => (
                                <button
                                    key={activity.activity_id}
                                    type="button"
                                    onClick={() =>
                                        setSelectedActivity(selectedActivityId === activity.activity_id ? null : activity)
                                    }
                                    className={cn(
                                        "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors",
                                        selectedActivityId === activity.activity_id
                                            ? "bg-primary/10 ring-1 ring-primary/30"
                                            : "bg-secondary/60 hover:bg-secondary",
                                    )}
                                >
                                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                                        <Image src={activity.thumbnail_url || DEFAULT_FALLBACK_IMAGE} alt={activity.title || "Activity"} fill className="object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground break-words">
                                            {activity.title}
                                        </p>
                                        <p className="flex items-start gap-1 text-xs text-muted-foreground break-words whitespace-normal">
                                            <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                            <span className="min-w-0">{activity.address}</span>
                                        </p>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">No activities were added for this trip.</p>
                        )}
                    </div>}

                    {!(review.event_end && review.event_start) && (
                        <button
                            onClick={() => onViewFull(review)}
                            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                        >
                            View Full Review
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </ScrollArea>

            {/* Floating save FAB — appears when an activity or lodging is selected */}
            {fabVisible && (
                <button
                    type="button"
                    onClick={handleFabClick}
                    className={cn(
                        "absolute bottom-5 right-5 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition-colors",
                        fabSaved
                            ? "bg-primary text-primary-foreground hover:opacity-90"
                            : "border border-border bg-card text-foreground hover:bg-secondary",
                    )}
                >
                    <Notebook className="h-4 w-4" />
                    {fabSaved ? "Saved" : "Save to Plans"}
                </button>
            )}
        </div>
    );
}
