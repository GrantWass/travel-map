"use client";

import Image from "next/image";
import { useEffect, useMemo } from "react";
import { Search, SlidersHorizontal, X, DollarSign, User, Tag, MapPin, BedDouble } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import type { Trip } from "@/lib/api-types";
import { DEFAULT_FALLBACK_IMAGE } from "@/lib/trip-constants";
import { buildSearchResults, getAvailableTags, MAX_COST, useTripSearchStore } from "@/stores/trip-search-store";

interface SearchSidebarPanelProps {
    query: string;
    trips: Trip[];
    onQueryChange: (value: string) => void;
    onClose: () => void;
    onSelectTrip: (tripId: number) => void;
    ownerFilter?: "all" | "friends" | "you";
    onOwnerFilterChange?: (value: "all" | "friends" | "you") => void;
    currentUserId?: number | null;
    friendIds?: number[];
}

export default function SearchSidebarPanel({ query, trips, onQueryChange, onClose, onSelectTrip, ownerFilter = "all", onOwnerFilterChange, currentUserId = null, friendIds = [] }: SearchSidebarPanelProps) {
    const selectedTags = useTripSearchStore((state) => state.selectedTags);
    const maxCost = useTripSearchStore((state) => state.maxCost);
    const toggleTag = useTripSearchStore((state) => state.toggleTag);
    const setMaxCost = useTripSearchStore((state) => state.setMaxCost);
    const clearFilters = useTripSearchStore((state) => state.clearFilters);
    const syncTagsWithAvailability = useTripSearchStore((state) => state.syncTagsWithAvailability);

    const availableTags = useMemo(() => getAvailableTags(trips), [trips]);

    useEffect(() => {
        syncTagsWithAvailability(availableTags);
    }, [availableTags, syncTagsWithAvailability]);

    const searchResults = useMemo(
        () =>
            buildSearchResults({
                trips,
                query,
                ownerFilter,
                currentUserId,
                friendIds,
                selectedTags,
                maxCost,
            }),
        [trips, query, ownerFilter, currentUserId, friendIds, selectedTags, maxCost],
    );

    const hasActiveFilters = selectedTags.length > 0 || maxCost < MAX_COST;
    const noFiltersOrQuery = query.trim() === "" && !hasActiveFilters;

    return (
        <div className="flex h-full w-full flex-col border-r border-border bg-card">
            {/* Header with embedded search input */}
            <div className="flex h-14 flex-shrink-0 items-center gap-2 border-b border-border px-4">
                <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <input
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Search trips, activities, or places"
                    className="h-full flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    aria-label="Search trips"
                />
                {searchResults.length > 0 && (
                    <span className="flex-shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {searchResults.length}
                    </span>
                )}
                <button
                    onClick={onClose}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary/60 text-foreground transition-colors hover:bg-secondary"
                    aria-label="Close search panel"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            {/* Owner filter — prominent in the search panel */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-2 py-1">
                    <button
                        type="button"
                        onClick={() => onOwnerFilterChange?.("all")}
                        className={`h-8 rounded-md px-3 text-sm font-medium ${ownerFilter === "all" ? "border border-primary/40 bg-primary/10 text-primary" : "border border-border bg-transparent text-foreground"}`}
                    >
                        All
                    </button>
                    <button
                        type="button"
                        onClick={() => onOwnerFilterChange?.("friends")}
                        className={`h-8 rounded-md px-3 text-sm font-medium ${ownerFilter === "friends" ? "border border-primary/40 bg-primary/10 text-primary" : "border border-border bg-transparent text-foreground"}`}
                    >
                        Friends
                    </button>
                    <button
                        type="button"
                        onClick={() => onOwnerFilterChange?.("you")}
                        className={`h-8 rounded-md px-3 text-sm font-medium ${ownerFilter === "you" ? "border border-primary/40 bg-primary/10 text-primary" : "border border-border bg-transparent text-foreground"}`}
                    >
                        You
                    </button>
                </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
                <div className="flex flex-col gap-5 p-4">
                    {/* Filters */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                Filters
                            </div>
                            {hasActiveFilters && (
                                <button
                                    onClick={() => {
                                        clearFilters();
                                    }}
                                    className="text-xs text-primary hover:underline"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        {/* Tags */}
                        <div className="flex flex-col gap-2">
                            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <Tag className="h-3 w-3" />
                                Tags
                            </p>
                            <div className="flex flex-wrap items-start gap-1.5 pr-1">
                                {availableTags.map((tag) => {
                                    const active = selectedTags.includes(tag);
                                    return (
                                        <button
                                            key={tag}
                                            onClick={() => toggleTag(tag)}
                                            title={tag}
                                            className={`inline-flex min-w-0 max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-colors ${
                                                active
                                                    ? "border-primary/40 bg-primary/10 text-primary"
                                                    : "border-border bg-secondary/40 text-foreground hover:bg-secondary"
                                            }`}
                                        >
                                            <span className="truncate">{tag}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Cost */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <DollarSign className="h-3 w-3" />
                                    Max Cost / Person
                                </p>
                                <span className="text-xs font-semibold text-foreground">
                                    {maxCost >= MAX_COST ? "No limit" : `$${maxCost}`}
                                </span>
                            </div>
                            <Slider
                                min={0}
                                max={MAX_COST}
                                step={25}
                                value={[maxCost]}
                                onValueChange={([val]) => setMaxCost(val ?? MAX_COST)}
                            />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-border" />

                    {/* Results */}
                    <div className="flex flex-col gap-3">
                        {noFiltersOrQuery ? (
                            <div className="flex flex-col items-center gap-2 py-6 text-center">
                                <Search className="h-8 w-8 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">
                                    Type to search by title, username, activity, or place.
                                </p>
                            </div>
                        ) : searchResults.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-6 text-center">
                                <p className="text-sm font-medium text-foreground">No trips found</p>
                                <p className="text-xs text-muted-foreground">Try adjusting your filters.</p>
                            </div>
                        ) : (
                            searchResults.map(({ trip, matchedActivities, matchedLodgings }) => {
                                const hasSubItems = matchedActivities.length > 0 || matchedLodgings.length > 0;
                                return (
                                    <div key={trip.trip_id} className="flex flex-col gap-1">
                                        {/* Trip row */}
                                        <button
                                            type="button"
                                            onClick={() => onSelectTrip(trip.trip_id)}
                                            className="flex w-full items-center gap-3 rounded-lg bg-secondary/40 p-3 text-left transition-colors hover:bg-secondary/70 active:bg-secondary"
                                        >
                                            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                                                <Image src={trip.thumbnail_url} alt={trip.title} fill className="object-cover" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-foreground">{trip.title}</p>
                                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <User className="h-3 w-3 flex-shrink-0" />
                                                    <span className="truncate">{trip.owner?.name}</span>
                                                </p>
                                                {(trip.cost !== null || trip.tags.length > 0) && (
                                                    <div className="mt-0.5 flex items-center gap-2">
                                                        {trip.cost !== null && (
                                                            <span className="text-xs text-muted-foreground">${trip.cost}/person</span>
                                                        )}
                                                        {trip.tags.length > 0 && (
                                                            <span className="truncate text-xs capitalize text-muted-foreground">
                                                                {trip.tags.slice(0, 2).join(", ")}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </button>

                                        {/* Sub-items */}
                                        {hasSubItems && (
                                            <div className="ml-4 flex flex-col gap-1 border-l-2 border-border pl-3">
                                                {matchedActivities.map((activity) => (
                                                    <button
                                                        key={`activity-${activity.activity_id}`}
                                                        type="button"
                                                        onClick={() => onSelectTrip(trip.trip_id)}
                                                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-secondary/50"
                                                    >
                                                        <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-md">
                                                            <Image src={activity.thumbnail_url || DEFAULT_FALLBACK_IMAGE} alt={activity.title || "Activity"} fill className="object-cover" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-xs font-medium text-foreground">{activity.title}</p>
                                                            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                                                <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                                                                <span className="truncate">{activity.address}</span>
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                                {matchedLodgings.map((lodging) => (
                                                    <button
                                                        key={`lodging-${lodging.lodge_id}`}
                                                        type="button"
                                                        onClick={() => onSelectTrip(trip.trip_id)}
                                                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-secondary/50"
                                                    >
                                                        <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-md">
                                                            <Image src={lodging.thumbnail_url || DEFAULT_FALLBACK_IMAGE} alt={lodging.title || "Lodging"} fill className="object-cover" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-xs font-medium text-foreground">{lodging.title}</p>
                                                            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                                                <BedDouble className="h-2.5 w-2.5 flex-shrink-0" />
                                                                <span className="truncate">{lodging.address}</span>
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
