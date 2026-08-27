"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, X, DollarSign, User, Tag, MapPin, BedDouble, Timer, ChevronDown, CalendarRange, ArrowUpDown } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import type { Trip } from "@/lib/api-types";
import { DEFAULT_FALLBACK_IMAGE } from "@/lib/trip-constants";
import { formatAddress, formatTripDate, formatTripDuration } from "@/lib/utils";
import { buildSearchResults, getAvailableTags, MAX_COST, TRIP_DURATION_OPTIONS, useTripSearchStore, type SearchResultSort } from "@/stores/trip-search-store";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

interface SearchSidebarPanelProps {
    query: string;
    trips: Trip[];
    onQueryChange: (value: string) => void;
    onClose: () => void;
    onSelectTrip: (tripId: number) => void;
    ownerFilter?: "all" | "friends" | "you";
    currentUserId?: number | null;
    friendIds?: number[];
    autoFocus?: boolean;
}

export default function SearchSidebarPanel({ query, trips, onQueryChange, onClose, onSelectTrip, ownerFilter = "all", currentUserId = null, friendIds = [], autoFocus = true }: SearchSidebarPanelProps) {
    const selectedTags = useTripSearchStore((state) => state.selectedTags);
    const maxCost = useTripSearchStore((state) => state.maxCost);
    const tripTypeFilter = useTripSearchStore((state) => state.tripTypeFilter);
    const dateFrom = useTripSearchStore((state) => state.dateFrom);
    const dateTo = useTripSearchStore((state) => state.dateTo);
    const toggleTag = useTripSearchStore((state) => state.toggleTag);
    const setMaxCost = useTripSearchStore((state) => state.setMaxCost);
    const toggleTripType = useTripSearchStore((state) => state.toggleTripType);
    const setDateFrom = useTripSearchStore((state) => state.setDateFrom);
    const setDateTo = useTripSearchStore((state) => state.setDateTo);
    const clearFilters = useTripSearchStore((state) => state.clearFilters);
    const syncTagsWithAvailability = useTripSearchStore((state) => state.syncTagsWithAvailability);

    // Month/year selects are split so the filter works in every browser
    // (<input type="month"> is unsupported in Firefox/Safari).
    const [fromMonth, fromYear] = dateFrom ? dateFrom.split("-") : ["", ""];
    const [toMonth, toYear] = dateTo ? dateTo.split("-") : ["", ""];
    const availableYears = useMemo(
        () => Array.from({ length: 11 }, (_, i) => new Date().getFullYear() + 5 - i),
        [],
    );

    function setFromPart(month: string, year: string) {
        setDateFrom(month && year ? `${year}-${month}` : "");
    }

    const [sort, setSort] = useState<SearchResultSort>("recommended");

    const availableTags = useMemo(() => getAvailableTags(trips), [trips]);

    const searchInputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (autoFocus) {
            searchInputRef.current?.focus({ preventScroll: true });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                tripTypeFilter,
                dateFrom,
                dateTo,
                sort,
            }),
        [trips, query, ownerFilter, currentUserId, friendIds, selectedTags, maxCost, tripTypeFilter, dateFrom, dateTo, sort],
    );

    const [filtersOpen, setFiltersOpen] = useState(false);

    const hasDateFilter = Boolean(dateFrom || dateTo);
    const hasActiveFilters = selectedTags.length > 0 || maxCost < MAX_COST || tripTypeFilter.length > 0 || hasDateFilter;
    const noFiltersOrQuery = query.trim() === "" && !hasActiveFilters;

    return (
        <div className="app-panel flex h-full w-full flex-col">
            {/* Header with embedded search input */}
            <div className="flex h-14 flex-shrink-0 items-center gap-2 border-b border-border/40 px-4 bg-card/80 backdrop-blur-sm">
                <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <input
                    ref={searchInputRef}
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Search trips, activities, or places"
                    className="h-full flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    aria-label="Search trips"
                />
                {searchResults.length > 0 && (
                    <span className="flex-shrink-0 rounded-full bg-coral/10 px-2 py-0.5 text-xs font-medium text-coral">
                        {searchResults.length}
                    </span>
                )}
                <button
                    onClick={onClose}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary/60 text-foreground transition-all duration-200 hover:bg-secondary hover:shadow-sm"
                    aria-label="Close search panel"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            <ScrollArea className="flex-1 min-h-0">
                <div className="flex flex-col px-4 pb-4 pt-2">
                    {/* Filters */}
                    <div className="flex flex-col gap-0">
                        <button
                            type="button"
                            onClick={() => setFiltersOpen((o) => !o)}
                            className="group -mx-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-md px-2 py-3 transition-colors hover:bg-secondary/50 mb-2"
                        >
                            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                Filters
                                {hasActiveFilters && !filtersOpen && (
                                    <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                        {selectedTags.length + (maxCost < MAX_COST ? 1 : 0) + (tripTypeFilter.length > 0 ? 1 : 0) + (hasDateFilter ? 1 : 0)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {hasActiveFilters && filtersOpen && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => { e.stopPropagation(); clearFilters(); }}
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); clearFilters(); } }}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        Clear all
                                    </span>
                                )}
                                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-hover:text-foreground ${filtersOpen ? "rotate-180" : ""}`} />
                            </div>
                        </button>

                        {filtersOpen && (
                            <>
                                {/* Tags */}
                                <div className="flex flex-col gap-2 mt-0 mb-4">
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
                                                    className={`inline-flex min-w-0 max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-all duration-200 ${
                                                        active
                                                            ? "border-primary/40 bg-primary/10 text-primary shadow-xs"
                                                            : "border-border bg-secondary/40 text-foreground hover:bg-secondary hover:shadow-xs"
                                                    }`}
                                                >
                                                    <span className="truncate">{tag}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Trip Type / Duration */}
                                <div className="flex flex-col gap-2 mt-0 mb-4">
                                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                        <Timer className="h-3 w-3" />
                                        Trip Type
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {TRIP_DURATION_OPTIONS.map(({ value, label }) => {
                                            const active = tripTypeFilter.includes(value);
                                            return (
                                                <button
                                                    key={value}
                                                    onClick={() => toggleTripType(value)}
                                                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all duration-200 ${
                                                        active
                                                            ? "border-coral/40 bg-coral/10 text-coral shadow-xs"
                                                            : "border-border bg-secondary/40 text-foreground hover:bg-secondary hover:shadow-xs"
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Cost */}
                                <div className="flex flex-col gap-2 mt-0 mb-4">
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
                                        step={5}
                                        value={[maxCost]}
                                        onValueChange={([val]) => setMaxCost(val ?? MAX_COST)}
                                    />
                                </div>

                                {/* Date */}
                                <div className="flex flex-col gap-2 mt-0 mb-4">
                                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                        <CalendarRange className="h-3 w-3" />
                                        Date
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex gap-1">
                                            <select
                                                value={fromMonth}
                                                onChange={(e) => setFromPart(e.target.value, fromYear)}
                                                className="h-9 w-full rounded-md border border-input bg-background px-1 text-xs text-foreground outline-none"
                                                aria-label="From month"
                                            >
                                                <option value="">Month</option>
                                                {MONTH_LABELS.map((name, i) => (
                                                    <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={fromYear}
                                                onChange={(e) => setFromPart(fromMonth, e.target.value)}
                                                className="h-9 w-full rounded-md border border-input bg-background px-1 text-xs text-foreground outline-none"
                                                aria-label="From year"
                                            >
                                                <option value="">Year</option>
                                                {availableYears.map((year) => (
                                                    <option key={year} value={String(year)}>{year}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex gap-1">
                                            <select
                                                value={toMonth}
                                                onChange={(e) => {
                                                    const month = e.target.value;
                                                    setDateTo(month && toYear ? `${toYear}-${month}` : "");
                                                }}
                                                className="h-9 w-full rounded-md border border-input bg-background px-1 text-xs text-foreground outline-none"
                                                aria-label="To month"
                                            >
                                                <option value="">Month</option>
                                                {MONTH_LABELS.map((name, i) => (
                                                    <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={toYear}
                                                onChange={(e) => {
                                                    const year = e.target.value;
                                                    setDateTo(toMonth && year ? `${year}-${toMonth}` : "");
                                                }}
                                                className="h-9 w-full rounded-md border border-input bg-background px-1 text-xs text-foreground outline-none"
                                                aria-label="To year"
                                            >
                                                <option value="">Year</option>
                                                {availableYears.map((year) => (
                                                    <option key={year} value={String(year)}>{year}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-border mb-4" />

                    {/* Sort + results */}
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Results</span>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <ArrowUpDown className="h-3 w-3" />
                            <select
                                value={sort}
                                onChange={(e) => setSort(e.target.value as SearchResultSort)}
                                className="rounded-md border border-input bg-background px-1.5 py-1 text-xs text-foreground outline-none"
                                aria-label="Sort results"
                            >
                                <option value="recommended">Recommended</option>
                                <option value="recent">Most recent</option>
                                <option value="liked">Most liked</option>
                            </select>
                        </label>
                    </div>
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
                                            className="flex w-full items-center gap-3 rounded-lg bg-secondary/40 p-3 text-left transition-all duration-200 hover:bg-secondary/70 hover:shadow-sm active:bg-secondary"
                                        >
                                            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                                                <Image src={trip.thumbnail_url || DEFAULT_FALLBACK_IMAGE} alt={trip.title} fill sizes="48px" priority className="object-cover" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-foreground">{trip.title}</p>
                                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <User className="h-3 w-3 flex-shrink-0" />
                                                    <span className="truncate">{trip.owner?.name}</span>
                                                </p>
                                                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    {trip.date ? (
                                                        <>
                                                            <CalendarRange className="h-3 w-3 flex-shrink-0" />
                                                            <span>{formatTripDate(trip.date)}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Timer className="h-3 w-3 flex-shrink-0" />
                                                            <span>{formatTripDuration(trip.duration)}</span>
                                                        </>
                                                    )}
                                                </div>
                                                {(trip.cost !== null || trip.tags.length > 0) && (
                                                    <div className="mt-0.5 flex items-center gap-2">
                                                        {trip.cost !== null && (
                                                            <span className="text-xs text-muted-foreground">
                                                                {trip.cost <= 0 ? "Free" : `$${trip.cost}/person`}
                                                            </span>
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
                                            <div className="ml-4 flex flex-col gap-1 border-l-2 border-primary/15 pl-3">
                                                {matchedActivities.map((activity) => (
                                                    <button
                                                        key={`activity-${activity.activity_id}`}
                                                        type="button"
                                                        onClick={() => onSelectTrip(trip.trip_id)}
                                                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-all duration-200 hover:bg-secondary/50 hover:shadow-xs"
                                                    >
                                                        <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-md">
                                                            <Image src={activity.thumbnail_url || DEFAULT_FALLBACK_IMAGE} alt={activity.title || "Activity"} fill sizes="36px" loading="lazy" className="object-cover" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-xs font-medium text-foreground">{activity.title}</p>
                                                            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                                                <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                                                                <span className="truncate">{formatAddress(activity.address, 2, { fromEnd: true })}</span>
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                                {matchedLodgings.map((lodging) => (
                                                    <button
                                                        key={`lodging-${lodging.lodge_id}`}
                                                        type="button"
                                                        onClick={() => onSelectTrip(trip.trip_id)}
                                                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-all duration-200 hover:bg-secondary/50 hover:shadow-xs"
                                                    >
                                                        <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-md">
                                                            <Image src={lodging.thumbnail_url || DEFAULT_FALLBACK_IMAGE} alt={lodging.title || "Lodging"} fill sizes="36px" loading="lazy" className="object-cover" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-xs font-medium text-foreground">{lodging.title}</p>
                                                            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                                                <BedDouble className="h-2.5 w-2.5 flex-shrink-0" />
                                                                <span className="truncate">{formatAddress(lodging.address, 2, { fromEnd: true })}</span>
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
