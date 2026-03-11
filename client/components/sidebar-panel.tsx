"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { X, MapPin, Calendar, Notebook, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, User, BedDouble, Timer, Expand, Pencil, MessageCircle, SendHorizontal, Heart } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTripMapStore } from "@/stores/trip-map-store";
import type { TripActivity, TripComment, TripLodging, Trip } from "@/lib/api-types";
import { formatTripDate, formatPopupTimeRange, formatTripDuration } from "@/lib/utils";
import { DEFAULT_FALLBACK_IMAGE } from "@/lib/trip-constants";

interface SidebarPanelProps {
    review: Trip;
    onClose: () => void;
    onOpenAuthorProfile: (userId: number) => void;
    onExpandImage: (image: { src: string; alt: string }) => void;
    onToggleSavedActivity: (tripId: number, activity: TripActivity) => void;
    onToggleSavedLodging: (tripId: number, lodging: TripLodging) => void;
    onEditTrip?: () => void;
    locationTripCount: number;
    locationTripPosition: number;
    onShowPreviousTripAtLocation: () => void;
    onShowNextTripAtLocation: () => void;
    canShowPreviousTripAtLocation: boolean;
    canShowNextTripAtLocation: boolean;
    comments: TripComment[];
    isLiked: boolean;
    isLikeSubmitting: boolean;
    likeError: string | null;
    onToggleLike: () => void;
    isAuthenticated: boolean;
    isCommentSubmitting: boolean;
    commentError: string | null;
    onCommentSubmit: (body: string) => Promise<void>;
    onLoadComments: () => void;
    onRequireSignInToComment: () => void;
}

function formatCost(cost: number | null | undefined): string | null {
    if (cost == null) return null;
    if (cost <= 0) return "Free";
    return cost % 1 === 0 ? `$${cost}/person` : `$${cost.toFixed(2)}/person`;
}

function formatAddress(address: string | null | undefined): string | null {
    if (!address) return null;
    const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
    const cleaned = parts
        .map((part) => {
            // "NY 10118" → "NY"
            const stateZip = part.match(/^([A-Z]{2})\s+\d{5}(-\d{4})?$/i);
            if (stateZip) return stateZip[1].toUpperCase();
            return part;
        })
        .filter((part) => {
            if (/^(USA|United States(?: of America)?|US)$/i.test(part)) return false;
            if (/^\d{5}(-\d{4})?$/.test(part)) return false;
            return true;
        });
    return cleaned.slice(0, 3).join(", ") || null;
}

export default function SidebarPanel({
    review,
    onClose,
    onOpenAuthorProfile,
    onExpandImage,
    onToggleSavedActivity,
    onToggleSavedLodging,
    onEditTrip,
    locationTripCount,
    locationTripPosition,
    onShowPreviousTripAtLocation,
    onShowNextTripAtLocation,
    canShowPreviousTripAtLocation,
    canShowNextTripAtLocation,
    comments,
    isLiked,
    isLikeSubmitting,
    likeError,
    onToggleLike,
    isAuthenticated,
    isCommentSubmitting,
    commentError,
    onCommentSubmit,
    onLoadComments,
    onRequireSignInToComment,
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

    const isPopupEvent = Boolean(review.event_start && review.event_end);
    const [commentInput, setCommentInput] = useState("");
    const [commentInputError, setCommentInputError] = useState<string | null>(null);

    const sortedComments = useMemo(
        () =>
            [...comments].sort((left, right) => {
                const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
                const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
                return rightTime - leftTime;
            }),
        [comments],
    );

    async function handleCommentSubmit() {
        if (!isAuthenticated) {
            onRequireSignInToComment();
            return;
        }

        const body = commentInput.trim();
        if (!body) {
            setCommentInputError("Write a comment before posting.");
            return;
        }

        setCommentInputError(null);
        await onCommentSubmit(body);
        setCommentInput("");
    }

    return (
        <div className="relative flex h-full w-full flex-col bg-card border-r border-border">
            {/* Header image */}
            <div className="relative h-56 flex-shrink-0">
                <Image src={review.thumbnail_url || DEFAULT_FALLBACK_IMAGE} alt={review.title} fill sizes="400px" className="object-cover" priority />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
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
                <div className="absolute right-3 top-3 flex items-center gap-1.5">
                    {onEditTrip && (
                        <button
                            onClick={onEditTrip}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white transition-colors hover:bg-black/60"
                            aria-label="Edit trip"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white transition-colors hover:bg-black/60"
                        aria-label="Close panel"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="absolute bottom-4 left-5 right-5">
                    <h1 className="text-balance text-2xl font-bold tracking-tight text-white">{review.title}</h1>
                </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="flex flex-col gap-5 p-5 pb-20">
                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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
                            review.date && (
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {formatTripDate(review.date)}
                                </span>
                            )
                        )}
                        {!isPopupEvent && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground/80">
                                <Timer className="h-3 w-3" />
                                {formatTripDuration(review.duration)}
                            </span>
                        )}
                    </div>

                    {review.collaborators.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Collaborators</p>
                            <div className="flex flex-wrap gap-2">
                                {review.collaborators.map((collaborator) => (
                                    <button
                                        key={collaborator.user_id}
                                        type="button"
                                        onClick={() => onOpenAuthorProfile(collaborator.user_id)}
                                        className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/30 px-2.5 py-1 text-xs text-foreground/85 transition-colors hover:bg-secondary"
                                    >
                                        {collaborator.profile_image_url ? (
                                            <Image
                                                src={collaborator.profile_image_url}
                                                alt={collaborator.name || "Collaborator"}
                                                width={18}
                                                height={18}
                                                className="h-[18px] w-[18px] rounded-full object-cover"
                                            />
                                        ) : (
                                            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                                {(collaborator.name || "?").slice(0, 1).toUpperCase()}
                                            </span>
                                        )}
                                        <span>{collaborator.name || `User #${collaborator.user_id}`}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {review.description && (
                        <p className="text-sm leading-relaxed text-foreground/80">{review.description}</p>
                    )}

                    {/* Tags */}
                    {review.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {review.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Places Stayed — hidden for pop-up events */}
                    {!isPopupEvent && (
                        <div className="flex flex-col gap-3">
                            <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                <BedDouble className="h-3.5 w-3.5" />
                                Places Stayed
                            </h3>
                            {review.lodgings.length > 0 ? (
                                review.lodgings.map((lodging) => {
                                    const hasImage = Boolean(lodging.thumbnail_url);
                                    const isExpanded = hasImage && selectedLodgingId === lodging.lodge_id;
                                    const lodgingCostLabel = formatCost(lodging.cost);
                                    return hasImage ? (
                                        <div
                                            key={lodging.lodge_id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setSelectedLodging(isExpanded ? null : lodging)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    setSelectedLodging(isExpanded ? null : lodging);
                                                }
                                            }}
                                            className={cn(
                                                "w-full cursor-pointer rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                                                isExpanded
                                                    ? "border-primary bg-primary/8 shadow-sm shadow-primary/10"
                                                    : "border-border bg-secondary/30 hover:bg-secondary/50",
                                            )}
                                        >
                                            {isExpanded ? (
                                                <div className="flex flex-col gap-3 p-3">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm font-medium text-foreground">{lodging.title}</p>
                                                        <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                                    </div>
                                                    <div className="group relative overflow-hidden rounded-lg">
                                                        <AspectRatio ratio={4 / 3} className="bg-muted">
                                                            <Image
                                                                src={lodging.thumbnail_url!}
                                                                alt={lodging.title || "Lodging"}
                                                                fill
                                                                sizes="350px"
                                                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                                                            />
                                                        </AspectRatio>
                                                        {lodgingCostLabel && (
                                                            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                                                                {lodgingCostLabel}
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onExpandImage({ src: lodging.thumbnail_url!, alt: lodging.title || "Lodging" });
                                                            }}
                                                            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                                                            aria-label={`Expand ${lodging.title} image`}
                                                        >
                                                            <Expand className="h-3 w-3" />
                                                            Expand
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        <h3 className="text-base font-semibold text-foreground">{lodging.title}</h3>
                                                        {formatAddress(lodging.address) && (
                                                            <p className="text-xs text-muted-foreground break-words whitespace-normal">{formatAddress(lodging.address)}</p>
                                                        )}
                                                        {lodging.description && (
                                                            <p className="text-sm leading-relaxed text-foreground/70">{lodging.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3 p-3">
                                                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                                                        <Image src={lodging.thumbnail_url!} alt={lodging.title || "Lodging"} fill sizes="48px" className="object-cover" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-foreground break-words">{lodging.title}</p>
                                                        <p className="text-xs text-muted-foreground break-words whitespace-normal">{formatAddress(lodging.address)}</p>
                                                    </div>
                                                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div
                                            key={lodging.lodge_id}
                                            className="w-full rounded-xl border border-border bg-secondary/30 text-left"
                                        >
                                            <div className="flex items-center gap-3 p-3">
                                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-muted">
                                                    <BedDouble className="h-5 w-5 text-muted-foreground/60" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-foreground break-words">{lodging.title}</p>
                                                    <p className="text-xs text-muted-foreground break-words whitespace-normal">{formatAddress(lodging.address)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-sm text-muted-foreground">No places stayed were added for this trip.</p>
                            )}
                        </div>
                    )}

                    {/* Activities — hidden for pop-up events */}
                    {!isPopupEvent && (
                        <div className="flex flex-col gap-3">
                            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                Activities
                            </h3>
                            {review.activities.length > 0 ? (
                                review.activities.map((activity) => {
                                    const hasImage = Boolean(activity.thumbnail_url);
                                    const isExpanded = hasImage && selectedActivityId === activity.activity_id;
                                    const activityCostLabel = formatCost(activity.cost);
                                    return hasImage ? (
                                        <div
                                            key={activity.activity_id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setSelectedActivity(isExpanded ? null : activity)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    setSelectedActivity(isExpanded ? null : activity);
                                                }
                                            }}
                                            className={cn(
                                                "w-full cursor-pointer rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                                                isExpanded
                                                    ? "border-primary bg-primary/8 shadow-sm shadow-primary/10"
                                                    : "border-border bg-secondary/40 hover:bg-secondary/70",
                                            )}
                                        >
                                            {isExpanded ? (
                                                <div className="flex flex-col gap-3 p-3">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm font-medium text-foreground">{activity.title}</p>
                                                        <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                                    </div>
                                                    <div className="group relative overflow-hidden rounded-lg">
                                                        <AspectRatio ratio={16 / 9} className="bg-muted">
                                                            <Image
                                                                src={activity.thumbnail_url!}
                                                                alt={activity.title || "Activity"}
                                                                fill
                                                                sizes="350px"
                                                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                                                            />
                                                        </AspectRatio>
                                                        {activityCostLabel && (
                                                            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                                                                {activityCostLabel}
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onExpandImage({ src: activity.thumbnail_url!, alt: activity.title || "Activity" });
                                                            }}
                                                            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                                                            aria-label={`Expand ${activity.title || "Activity"} image`}
                                                        >
                                                            <Expand className="h-3 w-3" />
                                                            Expand
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex min-w-0 items-start justify-between gap-2">
                                                            <h3 className="min-w-0 flex-1 text-base font-semibold text-foreground break-words">
                                                                {activity.title}
                                                            </h3>
                                                            {formatAddress(activity.address) && (
                                                                <span className="inline-flex max-w-[60%] flex-shrink-0 items-start gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground break-words whitespace-normal">
                                                                    <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                                                    <span className="min-w-0 break-words whitespace-normal">{formatAddress(activity.address)}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        {activity.description && (
                                                            <p className="text-sm leading-relaxed text-foreground/70">{activity.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3 p-3">
                                                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                                                        <Image src={activity.thumbnail_url!} alt={activity.title || "Activity"} fill sizes="48px" className="object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-foreground break-words">{activity.title}</p>
                                                        {formatAddress(activity.address) && (
                                                            <span className="mt-0.5 flex w-full items-start gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                                                                <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                                                <span className="min-w-0 break-words">{formatAddress(activity.address)}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <ChevronDown className="h-4 w-4 flex-shrink-0 self-center text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div
                                            key={activity.activity_id}
                                            className="w-full rounded-xl border border-border bg-secondary/40 text-left"
                                        >
                                            <div className="flex items-center gap-3 p-3">
                                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-muted">
                                                    <MapPin className="h-5 w-5 text-muted-foreground/60" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground break-words">{activity.title}</p>
                                                    {formatAddress(activity.address) && (
                                                        <p className="text-xs text-muted-foreground break-words whitespace-normal">{formatAddress(activity.address)}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-sm text-muted-foreground">No activities were added for this trip.</p>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col gap-3 border-t border-border pt-4">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                <MessageCircle className="h-3.5 w-3.5" />
                                Comments ({sortedComments.length})
                            </h3>
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={onToggleLike}
                                    disabled={isLikeSubmitting}
                                    className={cn(
                                        "h-7 px-2 text-xs text-muted-foreground",
                                        isLiked ? "text-foreground" : "hover:text-foreground",
                                    )}
                                >
                                    <Heart className={cn("mr-1 h-3.5 w-3.5", isLiked ? "fill-current" : "")} />
                                    {review.like_count}
                                </Button>
                                <button
                                    type="button"
                                    onClick={onLoadComments}
                                    className="text-xs font-medium text-primary transition-opacity hover:opacity-80"
                                >
                                    Refresh
                                </button>
                            </div>
                        </div>

                        {likeError && <p className="text-xs text-destructive">{likeError}</p>}

                        {isAuthenticated ? (
                            <div className="rounded-xl border border-border bg-secondary/40 p-2">
                                <textarea
                                    value={commentInput}
                                    onChange={(event) => {
                                        setCommentInput(event.target.value);
                                        if (commentInputError) {
                                            setCommentInputError(null);
                                        }
                                    }}
                                    placeholder="Share a tip or thought about this trip"
                                    rows={3}
                                    className="w-full resize-none rounded-md bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                                    disabled={isCommentSubmitting}
                                    maxLength={1200}
                                />
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">{commentInput.trim().length}/1200</span>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => void handleCommentSubmit()}
                                        disabled={isCommentSubmitting}
                                    >
                                        <SendHorizontal className="mr-1.5 h-3.5 w-3.5" />
                                        {isCommentSubmitting ? "Posting..." : "Post"}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-border p-3">
                                <p className="text-sm text-muted-foreground">Sign up or sign in to leave a comment.</p>
                                <Button type="button" size="sm" className="mt-2" onClick={onRequireSignInToComment}>
                                    Sign up to comment
                                </Button>
                            </div>
                        )}

                        {(commentInputError || commentError) && (
                            <p className="text-xs text-destructive">{commentInputError ?? commentError}</p>
                        )}

                        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                            {sortedComments.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No comments yet. Be the first to add one.</p>
                            ) : (
                                sortedComments.map((comment) => {
                                    const authorName = comment.user_name || "Traveler";
                                    const initials = authorName
                                        .split(" ")
                                        .filter(Boolean)
                                        .map((part) => part[0])
                                        .join("")
                                        .slice(0, 2)
                                        .toUpperCase() || "?";
                                    const createdAtLabel = comment.created_at
                                        ? new Date(comment.created_at).toLocaleString()
                                        : "";

                                    return (
                                        <div key={comment.comment_id} className="rounded-xl border border-border bg-background p-3">
                                            <div className="mb-1.5 flex items-center gap-2">
                                                {comment.user_profile_image_url ? (
                                                    <Image
                                                        src={comment.user_profile_image_url}
                                                        alt={`${authorName} avatar`}
                                                        width={24}
                                                        height={24}
                                                        className="h-6 w-6 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                                        {initials}
                                                    </div>
                                                )}
                                                <span className="text-xs font-medium text-foreground">{authorName}</span>
                                                {createdAtLabel && (
                                                    <span className="text-[11px] text-muted-foreground">· {createdAtLabel}</span>
                                                )}
                                            </div>
                                            <p className="whitespace-pre-wrap break-words text-sm text-foreground/85">{comment.body}</p>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            {/* Floating save FAB — appears when an activity or lodging is expanded */}
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
