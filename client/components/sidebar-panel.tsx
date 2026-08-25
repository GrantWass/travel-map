"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { X, MapPin, Calendar, ExternalLink, FolderOpen, Notebook, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, User, BedDouble, Timer, Expand, Pencil, MessageCircle, SendHorizontal, Heart, Share2 } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTripMapStore } from "@/stores/trip-map-store";
import type { TripActivity, TripComment, TripLodging, Trip } from "@/lib/api-types";
import { formatTripDate, formatTripDuration } from "@/lib/utils";
import { DEFAULT_FALLBACK_IMAGE } from "@/lib/trip-constants";
import TripItinerary from "@/components/trip-itinerary";

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

interface StopItem {
    title?: string | null;
    description?: string | null;
    address?: string | null;
    link_url?: string | null;
    cost?: number | string | null;
}

interface StopCardConfig {
    label: string;
    aspectRatio: number;
    icon: ReactNode;
    fallbackIcon: ReactNode;
    showAddressPill: boolean;
    unexpandedHoverClass: string;
    noImageBorderClass: string;
}

const LODGING_CARD_CONFIG: StopCardConfig = {
    label: "Lodging",
    aspectRatio: 4 / 3,
    icon: null,
    fallbackIcon: <BedDouble className="h-5 w-5 text-muted-foreground/60" />,
    showAddressPill: false,
    unexpandedHoverClass: "bg-secondary/30 hover:bg-secondary/50",
    noImageBorderClass: "border-border bg-secondary/30",
};

const ACTIVITY_CARD_CONFIG: StopCardConfig = {
    label: "Activity",
    aspectRatio: 16 / 9,
    icon: null,
    fallbackIcon: <MapPin className="h-5 w-5 text-muted-foreground/60" />,
    showAddressPill: true,
    unexpandedHoverClass: "bg-secondary/40 hover:bg-secondary/70",
    noImageBorderClass: "border-border bg-secondary/40",
};

function StopItemCard({
    id,
    item,
    thumbnailUrl,
    isExpanded,
    onSelect,
    onExpandImage,
    config,
}: {
    id: number;
    item: StopItem;
    thumbnailUrl: string | null;
    isExpanded: boolean;
    onSelect: () => void;
    onExpandImage: () => void;
    config: StopCardConfig;
}) {
    const hasImage = Boolean(thumbnailUrl);
    const costLabel = formatCost(typeof item.cost === "number" ? item.cost : Number(item.cost));
    const addressLabel = formatAddress(item.address);

    const toggle = () => onSelect();

    if (!hasImage) {
        return (
            <div className={cn("w-full rounded-xl border text-left", config.noImageBorderClass)}>
                <div className="flex items-center gap-3 p-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-muted">
                        {config.fallbackIcon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground break-words">{item.title}</p>
                        {addressLabel && !config.showAddressPill && (
                            <p className="text-xs text-muted-foreground break-words whitespace-normal">{addressLabel}</p>
                        )}
                        {addressLabel && config.showAddressPill && (
                            <span className="mt-0.5 flex w-full items-start gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                                <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                <span className="min-w-0 break-words">{addressLabel}</span>
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={toggle}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle();
                }
            }}
            className={cn(
                "w-full cursor-pointer rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                isExpanded
                    ? "border-primary bg-primary/8 shadow-sm shadow-primary/10"
                    : "border-border " + config.unexpandedHoverClass,
            )}
        >
            {isExpanded ? (
                <div className="flex flex-col gap-3 p-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    </div>
                    <div className="group relative overflow-hidden rounded-lg">
                        <AspectRatio ratio={config.aspectRatio} className="bg-muted">
                            <Image
                                src={thumbnailUrl!}
                                alt={item.title || config.label}
                                fill
                                sizes="350px"
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                        </AspectRatio>
                        {costLabel && (
                            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                                {costLabel}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onExpandImage();
                            }}
                            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                            aria-label={`Expand ${item.title || config.label} image`}
                        >
                            <Expand className="h-3 w-3" />
                            Expand
                        </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {config.showAddressPill ? (
                            <div className="flex min-w-0 items-start justify-between gap-2">
                                <h3 className="min-w-0 flex-1 text-base font-semibold text-foreground break-words">
                                    {item.title}
                                </h3>
                                {addressLabel && (
                                    <span className="inline-flex max-w-[60%] flex-shrink-0 items-start gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground break-words whitespace-normal">
                                        <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                        <span className="min-w-0 break-words whitespace-normal">{addressLabel}</span>
                                    </span>
                                )}
                            </div>
                        ) : (
                            <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                        )}
                        {!config.showAddressPill && addressLabel && (
                            <p className="text-xs text-muted-foreground break-words whitespace-normal">{addressLabel}</p>
                        )}
                        {item.description && (
                            <p className="text-sm leading-relaxed text-foreground/70">{item.description}</p>
                        )}
                        {item.link_url && (
                            <a
                                href={item.link_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex w-fit items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-secondary/70"
                            >
                                <ExternalLink className="h-3 w-3" />
                                Website
                            </a>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3 p-3">
                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                        <Image src={thumbnailUrl!} alt={item.title || config.label} fill sizes="48px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground break-words">{item.title}</p>
                        {addressLabel && !config.showAddressPill && (
                            <p className="text-xs text-muted-foreground break-words whitespace-normal">{addressLabel}</p>
                        )}
                        {addressLabel && config.showAddressPill && (
                            <span className="mt-0.5 flex w-full items-start gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                                <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                <span className="min-w-0 break-words">{addressLabel}</span>
                            </span>
                        )}
                    </div>
                    <ChevronDown className={cn("h-4 w-4 flex-shrink-0 text-muted-foreground", config.showAddressPill && "self-center")} />
                </div>
            )}
        </div>
    );
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

        if (typeof navigator.share === "function") {
            try {
                await navigator.share({ title: review.title, url });
                return;
            } catch {
                // User dismissed the share sheet — fall through.
                return;
            }
        }

        try {
            await navigator.clipboard.writeText(url);
            setShareLabel("Link copied!");
            window.setTimeout(() => setShareLabel("Share this trip"), 2000);
        } catch {
            // Clipboard unavailable — do nothing.
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
        <div className={cn("relative flex flex-col bg-card", !mobileSheetMode && "h-full w-full border-r border-border")}>
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
                        onClick={() => void handleShareTrip()}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white transition-colors hover:bg-black/60"
                        aria-label="Share trip"
                        title={shareLabel}
                    >
                        <Share2 className="h-3.5 w-3.5" />
                    </button>
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
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground/80">
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

                    {/* Places Stayed */}
                    <div className="flex flex-col gap-3">
                            <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                <BedDouble className="h-3.5 w-3.5" />
                                Places Stayed
                            </h3>
                            {review.lodgings.length > 0 ? (
                                review.lodgings.map((lodging) => (
                                    <StopItemCard
                                        key={lodging.lodge_id}
                                        id={lodging.lodge_id}
                                        item={lodging}
                                        thumbnailUrl={lodging.thumbnail_url}
                                        isExpanded={selectedLodgingId === lodging.lodge_id}
                                        onSelect={() =>
                                            setSelectedLodging(selectedLodgingId === lodging.lodge_id ? null : lodging)
                                        }
                                        onExpandImage={() => onExpandImage({ src: lodging.thumbnail_url!, alt: lodging.title || "Lodging" })}
                                        config={LODGING_CARD_CONFIG}
                                    />
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">No places stayed were added for this trip.</p>
                            )}
                    </div>

                    {/* Activities */}
                    <div className="flex flex-col gap-3">
                            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                Activities
                            </h3>
                            {review.activities.length > 0 ? (
                                review.activities.map((activity) => (
                                    <StopItemCard
                                        key={activity.activity_id}
                                        id={activity.activity_id}
                                        item={activity}
                                        thumbnailUrl={activity.thumbnail_url}
                                        isExpanded={selectedActivityId === activity.activity_id}
                                        onSelect={() =>
                                            setSelectedActivity(selectedActivityId === activity.activity_id ? null : activity)
                                        }
                                        onExpandImage={() => onExpandImage({ src: activity.thumbnail_url!, alt: activity.title || "Activity" })}
                                        config={ACTIVITY_CARD_CONFIG}
                                    />
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">No activities were added for this trip.</p>
                            )}
                        </div>

                    {/* Itinerary (optional day-by-day planner) */}
                    <TripItinerary
                        tripId={review.trip_id}
                        activities={review.activities}
                        canEdit={Boolean(onEditTrip)}
                    />

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
            </ContentScroller>

            {/* Floating save FAB — appears when an activity or lodging is expanded */}
            {fabVisible && (
                <div className="absolute bottom-5 right-5 flex flex-col items-end gap-2">
                    {/* Collection picker popover */}
                    {showCollectionPicker && !fabSaved && (
                        <div className="rounded-xl border border-border bg-card py-1.5 shadow-lg">
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
                            "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition-colors",
                            fabSaved
                                ? "bg-primary text-primary-foreground hover:opacity-90"
                                : "border border-border bg-card text-foreground hover:bg-secondary",
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
