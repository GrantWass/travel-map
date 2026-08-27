"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { X, Calendar, FolderOpen, Notebook, ChevronLeft, ChevronRight, User, BedDouble, Timer, Pencil, MessageCircle, SendHorizontal, Heart, Share2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTripMapStore } from "@/stores/trip-map-store";
import { useAuthStore } from "@/stores/auth-store";
import type { TripActivity, TripComment, TripLodging, Trip } from "@/lib/api-types";
import { formatTripDate, formatTripDuration, shareOrCopyUrl } from "@/lib/utils";
import { DEFAULT_FALLBACK_IMAGE } from "@/lib/trip-constants";
import TripItinerary from "@/components/trip-itinerary";
import StopItemCard, { ACTIVITY_CARD_CONFIG, LODGING_CARD_CONFIG, StopSection } from "@/components/stop-item-card";
import UserAvatar from "@/components/user-avatar";

function SafeImage({ src, alt, fallback, ...props }: { src: string; alt: string; fallback?: ReactNode } & Omit<React.ComponentProps<typeof Image>, "src" | "alt">) {
    const [failed, setFailed] = useState(false);
    if (failed) {
        if (fallback) return <>{fallback}</>;
        return <div className="flex h-full w-full items-center justify-center bg-secondary text-muted-foreground"><User className="h-5 w-5" /></div>;
    }
    return <Image src={src} alt={alt} quality={75} onError={() => setFailed(true)} {...props} />;
}

function ContentScroller({ children, mobile }: { children: ReactNode; mobile?: boolean }) {
    if (mobile) return <>{children}</>;
    return <ScrollArea className="flex-1 min-h-0">{children}</ScrollArea>;
}

interface SidebarPanelProps {
    review: Trip;
    collections: string[];
    onClose: () => void;
    onOpenAuthorProfile: (userId: number) => void;
    onExpandImage: (image: { src: string; alt: string }) => void;
    onToggleSavedActivity: (tripId: number, activity: TripActivity, collectionName?: string | null) => void;
    onToggleSavedLodging: (tripId: number, lodging: TripLodging, collectionName?: string | null) => void;
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
    mobileSheetMode?: boolean;
}


export default function SidebarPanel({
    review,
    collections,
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
    mobileSheetMode,
}: SidebarPanelProps) {
    const selectedActivity = useTripMapStore((state) => state.selectedActivity);
    const selectedLodging = useTripMapStore((state) => state.selectedLodging);
    const setSelectedActivity = useTripMapStore((state) => state.setSelectedActivity);
    const setSelectedLodging = useTripMapStore((state) => state.setSelectedLodging);
    const savedActivityIds = new Set(useTripMapStore((state) => state.savedActivityIds));
    const savedLodgingIds = new Set(useTripMapStore((state) => state.savedLodgingIds));
    const userId = useAuthStore((state) => state.user?.user_id ?? null);
    const isTripOwner = userId !== null && review.owner_user_id === userId;
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
    const [showCollectionPicker, setShowCollectionPicker] = useState(false);

    function handleFabClick() {
        if (fabSaved) {
            // Already saved — toggle off immediately
            if (fabActivity) onToggleSavedActivity(review.trip_id, fabActivity);
            else if (fabLodging) onToggleSavedLodging(review.trip_id, fabLodging);
        } else {
            // Not saved — show collection picker if there are collections, else save directly
            if (collections.length > 0) {
                setShowCollectionPicker((v) => !v);
            } else {
                if (fabActivity) onToggleSavedActivity(review.trip_id, fabActivity, null);
                else if (fabLodging) onToggleSavedLodging(review.trip_id, fabLodging, null);
            }
        }
    }

    function handleSaveToCollection(collectionName: string | null) {
        if (fabActivity) onToggleSavedActivity(review.trip_id, fabActivity, collectionName);
        else if (fabLodging) onToggleSavedLodging(review.trip_id, fabLodging, collectionName);
        setShowCollectionPicker(false);
    }

    const [shareLabel, setShareLabel] = useState("Share this trip");

    async function handleShareTrip() {
        const url = `${window.location.origin}/?trip=${review.trip_id}`;
        const result = await shareOrCopyUrl(url, review.title);
        if (result === "copied") {
            setShareLabel("Link copied!");
            window.setTimeout(() => setShareLabel("Share this trip"), 2000);
        }
    }

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
        <div className={cn("relative flex flex-col bg-card", !mobileSheetMode && "h-full w-full border-r border-border/50")}>
            {/* Header image */}
            <div className="relative h-56 flex-shrink-0">
                <SafeImage src={review.thumbnail_url || DEFAULT_FALLBACK_IMAGE} alt={review.title} fill sizes="(max-width: 640px) 100vw, 483px" priority className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                {locationTripCount > 1 && (
                    <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/50 p-1 text-white backdrop-blur-md shadow-lg">
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
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 backdrop-blur-md text-white shadow-lg transition-all duration-200 hover:bg-black/70 hover:scale-105"
                            aria-label="Edit trip"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <button
                        onClick={() => void handleShareTrip()}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 backdrop-blur-md text-white shadow-lg transition-all duration-200 hover:bg-black/70 hover:scale-105"
                        aria-label="Share trip"
                        title={shareLabel}
                    >
                        <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 backdrop-blur-md text-white shadow-lg transition-all duration-200 hover:bg-black/70 hover:scale-105"
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
            <ContentScroller mobile={mobileSheetMode}>
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
                        {review.date && (
                            <span className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatTripDate(review.date)}
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-coral/10 px-2 py-0.5 text-xs font-medium text-coral">
                            <Timer className="h-3 w-3" />
                            {formatTripDuration(review.duration)}
                        </span>
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
                                        className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/30 px-2.5 py-1 text-xs text-foreground/85 transition-all duration-200 hover:bg-secondary hover:shadow-sm"
                                    >
                                        <UserAvatar
                                            name={collaborator.name}
                                            image={collaborator.profile_image_url}
                                            size={18}
                                        />
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
                            {review.tags.map((tag, idx) => {
                                const warmClasses = ["bg-primary/8 text-primary border-l-2 border-primary", "bg-coral/8 text-coral border-l-2 border-coral", "bg-amber-100/60 text-amber-700 border-l-2 border-amber-400", "bg-emerald-50 text-emerald-700 border-l-2 border-emerald-400"];
                                return (
                                    <span
                                        key={tag}
                                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${warmClasses[idx % warmClasses.length]}`}
                                    >
                                        {tag}
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    {/* Places Stayed */}
                    <StopSection
                        title={
                            <>
                                <BedDouble className="h-3.5 w-3.5" />
                                Places Stayed
                            </>
                        }
                        emptyMessage="No places stayed were added for this trip."
                    >
                        {review.lodgings.map((lodging) => (
                            <StopItemCard
                                key={lodging.lodge_id}
                                item={lodging}
                                thumbnailUrl={lodging.thumbnail_url}
                                isExpanded={selectedLodgingId === lodging.lodge_id}
                                onSelect={() =>
                                    setSelectedLodging(selectedLodgingId === lodging.lodge_id ? null : lodging)
                                }
                                onExpandImage={() => onExpandImage({ src: lodging.thumbnail_url!, alt: lodging.title || "Lodging" })}
                                config={LODGING_CARD_CONFIG}
                            />
                        ))}
                    </StopSection>

                    {/* Activities */}
                    <StopSection title="Activities" emptyMessage="No activities were added for this trip.">
                        {review.activities.map((activity) => (
                            <StopItemCard
                                key={activity.activity_id}
                                item={activity}
                                thumbnailUrl={activity.thumbnail_url}
                                isExpanded={selectedActivityId === activity.activity_id}
                                onSelect={() =>
                                    setSelectedActivity(selectedActivityId === activity.activity_id ? null : activity)
                                }
                                onExpandImage={() => onExpandImage({ src: activity.thumbnail_url!, alt: activity.title || "Activity" })}
                                config={ACTIVITY_CARD_CONFIG}
                            />
                        ))}
                    </StopSection>

                    {/* Itinerary (optional day-by-day planner; creator-only editing) */}
                    <TripItinerary
                        tripId={review.trip_id}
                        activities={review.activities}
                        canEdit={isTripOwner}
                    />

                    <div className="flex flex-col gap-3 border-t border-border/40 pt-4">
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
                                        "h-7 px-2 text-xs transition-all duration-200",
                                        isLiked ? "text-coral hover:text-coral/80" : "text-muted-foreground hover:text-coral",
                                    )}
                                >
                                    <Heart className={cn("mr-1 h-3.5 w-3.5 transition-transform duration-200", isLiked ? "fill-current scale-110" : "")} />
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
                            <div className="rounded-2xl border border-border/50 bg-secondary/20 p-2 shadow-xs">
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
                            <div className="rounded-2xl border border-dashed border-border/50 p-3">
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
                                    const createdAtLabel = comment.created_at
                                        ? new Date(comment.created_at).toLocaleString()
                                        : "";

                                    return (
                                        <div key={comment.comment_id} className="rounded-2xl border border-border/40 border-l-2 border-l-primary/15 bg-background p-3">
                                            <div className="mb-1.5 flex items-center gap-2">
                                                <UserAvatar
                                                    name={authorName}
                                                    image={comment.user_profile_image_url}
                                                    size={24}
                                                />
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
            </ContentScroller>

            {/* Floating save FAB — appears when an activity or lodging is expanded */}
            {fabVisible && (
                <div className="absolute bottom-5 right-5 flex flex-col items-end gap-2">
                    {/* Collection picker popover */}
                    {showCollectionPicker && !fabSaved && (
                        <div className="rounded-2xl border border-border/50 bg-card py-1.5 shadow-lg">
                            <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Save to collection
                            </p>
                            <button
                                type="button"
                                onClick={() => handleSaveToCollection(null)}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary"
                            >
                                No collection
                            </button>
                            {collections.map((col) => (
                                <button
                                    key={col}
                                    type="button"
                                    onClick={() => handleSaveToCollection(col)}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary"
                                >
                                    <FolderOpen className="h-3.5 w-3.5 text-primary" />
                                    {col}
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleFabClick}
                        className={cn(
                            "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition-all duration-200",
                            fabSaved
                                ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-primary/25 hover:shadow-xl hover:scale-[1.02]"
                                : "border border-border bg-card text-foreground shadow-md hover:shadow-lg hover:bg-secondary",
                        )}
                    >
                        <Notebook className="h-4 w-4" />
                        {fabSaved ? "Saved" : "Save to Plans"}
                    </button>
                </div>
            )}
        </div>
    );
}
