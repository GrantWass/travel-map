"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X, DollarSign, User, Tag, MapPin, BedDouble } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import type { MapActivity, MapLodging, MapTrip } from "@/lib/trip-models";

const MAX_COST = 500;

interface SearchResult {
    trip: MapTrip;
    matchedActivities: MapActivity[];
    matchedLodgings: MapLodging[];
}

interface SearchSidebarPanelProps {
    query: string;
    trips: MapTrip[];
    onQueryChange: (value: string) => void;
    onClose: () => void;
    onSelectTrip: (tripId: number) => void;
}

export default function SearchSidebarPanel({ query, trips, onQueryChange, onClose, onSelectTrip }: SearchSidebarPanelProps) {
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [maxCost, setMaxCost] = useState(MAX_COST);

    const availableTags = useMemo(() => {
        const counts = new Map<string, number>();
        for (const trip of trips) {
            for (const tag of trip.tags) {
                counts.set(tag, (counts.get(tag) ?? 0) + 1);
            }
        }
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([tag]) => tag);
    }, [trips]);

    const searchResults = useMemo<SearchResult[]>(() => {
        const q = query.trim().toLowerCase();
        const results: SearchResult[] = [];

        for (const trip of trips) {
            // Tag filter (always applied)
            if (selectedTags.length > 0 && !selectedTags.every((tag) => trip.tags.includes(tag))) continue;
            // Cost filter (always applied)
            if (maxCost < MAX_COST && trip.cost !== null && trip.cost > maxCost) continue;

            // No text query — include all passing-filter trips with no sub-items highlighted
            if (!q) {
                results.push({ trip, matchedActivities: [], matchedLodgings: [] });
                continue;
            }

            const tripMatches =
                trip.title.toLowerCase().includes(q) || trip.author.toLowerCase().includes(q);

            const matchedActivities = trip.activities.filter(
                (a) =>
                    a.title.toLowerCase().includes(q) ||
                    a.address.toLowerCase().includes(q) ||
                    a.description.toLowerCase().includes(q),
            );

            const matchedLodgings = trip.lodgings.filter(
                (l) =>
                    l.title.toLowerCase().includes(q) ||
                    l.address.toLowerCase().includes(q) ||
                    l.description.toLowerCase().includes(q),
            );

            if (tripMatches || matchedActivities.length > 0 || matchedLodgings.length > 0) {
                results.push({ trip, matchedActivities, matchedLodgings });
            }
        }

        return results;
    }, [trips, query, selectedTags, maxCost]);

    function toggleTag(tag: string) {
        setSelectedTags((current) =>
            current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
        );
    }

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
                                        setSelectedTags([]);
                                        setMaxCost(MAX_COST);
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
                            <div className="flex flex-wrap gap-1.5">
                                {availableTags.map((tag) => {
                                    const active = selectedTags.includes(tag);
                                    return (
                                        <button
                                            key={tag}
                                            onClick={() => toggleTag(tag)}
                                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-colors ${
                                                active
                                                    ? "border-primary/40 bg-primary/10 text-primary"
                                                    : "border-border bg-secondary/40 text-foreground hover:bg-secondary"
                                            }`}
                                        >
                                            {tag}
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
                                    Max Cost
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
                                    <div key={trip.id} className="flex flex-col gap-1">
                                        {/* Trip row */}
                                        <button
                                            type="button"
                                            onClick={() => onSelectTrip(trip.id)}
                                            className="flex w-full items-center gap-3 rounded-lg bg-secondary/40 p-3 text-left transition-colors hover:bg-secondary/70 active:bg-secondary"
                                        >
                                            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                                                <Image src={trip.thumbnail} alt={trip.title} fill className="object-cover" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-foreground">{trip.title}</p>
                                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <User className="h-3 w-3 flex-shrink-0" />
                                                    <span className="truncate">{trip.author}</span>
                                                </p>
                                                {(trip.cost !== null || trip.tags.length > 0) && (
                                                    <div className="mt-0.5 flex items-center gap-2">
                                                        {trip.cost !== null && (
                                                            <span className="text-xs text-muted-foreground">${trip.cost}</span>
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
                                                        key={`activity-${activity.id}`}
                                                        type="button"
                                                        onClick={() => onSelectTrip(trip.id)}
                                                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-secondary/50"
                                                    >
                                                        <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-md">
                                                            <Image src={activity.image} alt={activity.title} fill className="object-cover" />
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
                                                        key={`lodging-${lodging.id}`}
                                                        type="button"
                                                        onClick={() => onSelectTrip(trip.id)}
                                                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-secondary/50"
                                                    >
                                                        <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-md">
                                                            <Image src={lodging.image} alt={lodging.title} fill className="object-cover" />
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
