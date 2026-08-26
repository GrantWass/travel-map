"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowDown,
    ArrowUp,
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Plus,
    X,
} from "lucide-react";

import { getTripItinerary, saveTripItinerary } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ItineraryActivity {
    activity_id: number;
    title?: string | null;
    address?: string | null;
    thumbnail_url?: string | null;
}

interface TripItineraryProps {
    tripId: number;
    activities: ItineraryActivity[];
    canEdit: boolean;
}

interface Draft {
    key: string;
    day_date: string | null;
    activity_id: number | null;
    title: string | null;
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function isoDay(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseIsoDay(value: string): Date {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function formatDayHeading(value: string): string {
    return parseIsoDay(value).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
    });
}

export default function TripItinerary({ tripId, activities, canEdit }: TripItineraryProps) {
    const [open, setOpen] = useState(false);
    const [loadState, setLoadState] = useState<"idle" | "loading" | "ready">("idle");
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [savedDrafts, setSavedDrafts] = useState<Draft[]>([]);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [cursor, setCursor] = useState(() => {
        const today = new Date();
        return { year: today.getFullYear(), month: today.getMonth() };
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newEntryTitle, setNewEntryTitle] = useState("");
    const [dragKey, setDragKey] = useState<string | null>(null);

    const loadedTripRef = useRef<number | null>(null);
    const tmpIdRef = useRef(0);

    useEffect(() => {
        // Editors load on expand; viewers must load immediately so we can
        // hide the section entirely when the creator never built an itinerary.
        const shouldLoad = canEdit ? open : true;
        if (!shouldLoad || loadedTripRef.current === tripId) return;
        loadedTripRef.current = tripId;
        setLoadState("loading");
        getTripItinerary(tripId)
            .then((items) => {
                const mapped = items.map((item) => ({
                    key: `db-${item.itinerary_item_id}`,
                    day_date: item.day_date,
                    activity_id: item.activity_id,
                    title: item.title,
                }));
                setDrafts(mapped);
                setSavedDrafts(mapped);
                const firstScheduled = items.find((item) => item.day_date)?.day_date;
                if (firstScheduled) {
                    const d = parseIsoDay(firstScheduled);
                    setCursor({ year: d.getFullYear(), month: d.getMonth() });
                }
                setLoadState("ready");
            })
            .catch(() => {
                setError("Could not load the itinerary.");
                setLoadState("ready");
            });
    }, [open, tripId, canEdit]);

    const activityById = useMemo(() => {
        const map = new Map<number, ItineraryActivity>();
        activities.forEach((activity) => map.set(activity.activity_id, activity));
        return map;
    }, [activities]);

    const countsByDay = useMemo(() => {
        const counts = new Map<string, number>();
        drafts.forEach((draft) => {
            if (draft.day_date) {
                counts.set(draft.day_date, (counts.get(draft.day_date) ?? 0) + 1);
            }
        });
        return counts;
    }, [drafts]);

    const isDirty = useMemo(
        () => JSON.stringify(drafts) !== JSON.stringify(savedDrafts),
        [drafts, savedDrafts],
    );

    const scheduledKeys = useMemo(
        () => new Set(drafts.filter((d) => d.activity_id != null).map((d) => d.activity_id)),
        [drafts],
    );
    const unscheduledActivities = activities.filter((a) => !scheduledKeys.has(a.activity_id));
    const unscheduledEntries = drafts.filter((d) => !d.day_date);
    const dayItems = drafts.filter((d) => d.day_date === selectedDay);
    const scheduledCount = drafts.filter((d) => d.day_date).length;

    function makeTmpKey(): string {
        tmpIdRef.current += 1;
        return `tmp-${tmpIdRef.current}`;
    }

    function assignDay(key: string, day: string | null) {
        setDrafts((prev) => {
            const item = prev.find((entry) => entry.key === key);
            if (!item) return prev;
            const without = prev.filter((entry) => entry.key !== key);
            if (day === null) return [...without, { ...item, day_date: null }];
            const insertAt = without.map((e) => e.day_date).lastIndexOf(day) + 1;
            const next = [...without];
            next.splice(insertAt, 0, { ...item, day_date: day });
            return next;
        });
        setSelectedDay(day);
    }

    function addItemToDay(item: { activity_id: number | null; title: string | null }, day: string | null) {
        const draft: Draft = {
            key: makeTmpKey(),
            day_date: day,
            activity_id: item.activity_id,
            title: item.title,
        };
        setDrafts((prev) => {
            if (day === null) return [...prev, draft];
            const insertAt = prev.map((e) => e.day_date).lastIndexOf(day) + 1;
            const next = [...prev];
            next.splice(insertAt, 0, draft);
            return next;
        });
        setSelectedDay(day);
    }

    function removeItem(key: string) {
        setDrafts((prev) => prev.filter((entry) => entry.key !== key));
    }

    function moveWithinDay(key: string, direction: -1 | 1) {
        setDrafts((prev) => {
            const item = prev.find((entry) => entry.key === key);
            if (!item?.day_date) return prev;
            const dayIndexes = prev
                .map((entry, index) => (entry.day_date === item.day_date ? index : -1))
                .filter((index) => index >= 0);
            const position = dayIndexes.indexOf(prev.indexOf(item));
            const swapWith = dayIndexes[position + direction];
            if (swapWith === undefined) return prev;
            const next = [...prev];
            const itemIndex = prev.indexOf(item);
            [next[itemIndex], next[swapWith]] = [next[swapWith], next[itemIndex]];
            return next;
        });
    }

    async function handleSave() {
        setSaving(true);
        setError(null);
        try {
            const items = await saveTripItinerary(
                tripId,
                drafts.map((draft) => ({
                    day_date: draft.day_date,
                    activity_id: draft.activity_id,
                    title: draft.title,
                })),
            );
            const mapped = items.map((item) => ({
                key: `db-${item.itinerary_item_id}`,
                day_date: item.day_date,
                activity_id: item.activity_id,
                title: item.title,
            }));
            setDrafts(mapped);
            setSavedDrafts(mapped);
        } catch {
            setError("Could not save the itinerary. Try again.");
        } finally {
            setSaving(false);
        }
    }

    function handleAddCustomEntry() {
        const title = newEntryTitle.trim();
        if (!title) return;
        addItemToDay({ activity_id: null, title }, selectedDay);
        setNewEntryTitle("");
    }

    function shiftMonth(delta: number) {
        setCursor((prev) => {
            const next = new Date(prev.year, prev.month + delta, 1);
            return { year: next.getFullYear(), month: next.getMonth() };
        });
    }

    const calendarCells = useMemo(() => {
        const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay();
        const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
        const cells: (Date | null)[] = Array.from({ length: firstWeekday }, () => null);
        for (let day = 1; day <= daysInMonth; day += 1) {
            cells.push(new Date(cursor.year, cursor.month, day));
        }
        return cells;
    }, [cursor]);

    const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    });

    const todayIso = isoDay(new Date());

    function dropOnDay(day: string | null) {
        if (!canEdit || !dragKey) return;
        if (dragKey.startsWith("pool-")) {
            const activityId = Number(dragKey.slice(5));
            addItemToDay({ activity_id: activityId, title: null }, day);
        } else {
            assignDay(dragKey, day);
        }
        setDragKey(null);
    }

    function ItemChip({
        draft,
        index,
        total,
    }: {
        draft: Draft;
        index: number;
        total: number;
    }) {
        const activity = draft.activity_id != null ? activityById.get(draft.activity_id) : undefined;
        const label = activity?.title ?? draft.title ?? "Untitled";
        return (
            <div
                draggable={canEdit}
                onDragStart={() => setDragKey(draft.key)}
                onDragEnd={() => setDragKey(null)}
                className={cn(
                    "group flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2 py-1.5",
                    canEdit && "cursor-grab active:cursor-grabbing hover:bg-secondary/70",
                )}
            >
                {activity?.thumbnail_url ? (
                    <Image
                        src={activity.thumbnail_url}
                        alt=""
                        width={28}
                        height={28}
                        sizes="28px"
                        className="h-7 w-7 flex-shrink-0 rounded-md object-cover"
                    />
                ) : (
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{label}</p>
                    {activity?.address && (
                        <p className="truncate text-[10px] text-muted-foreground">{activity.address}</p>
                    )}
                </div>
                {canEdit && (
                    <div className="flex flex-shrink-0 items-center">
                        <button
                            type="button"
                            onClick={() => moveWithinDay(draft.key, -1)}
                            disabled={index === 0}
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            aria-label="Move earlier"
                        >
                            <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                            type="button"
                            onClick={() => moveWithinDay(draft.key, 1)}
                            disabled={index === total - 1}
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            aria-label="Move later"
                        >
                            <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                            type="button"
                            onClick={() => removeItem(draft.key)}
                            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                            aria-label="Remove from itinerary"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Viewers see nothing when the trip creator never built an itinerary.
    if (!canEdit && loadState === "ready" && drafts.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center justify-between text-left"
            >
                <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Itinerary{scheduledCount > 0 ? ` (${scheduledCount})` : ""}
                </h3>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                loadState === "loading" ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {/* Mini month calendar */}
                        <div className="rounded-xl border border-border bg-card p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => shiftMonth(-1)}
                                    className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                    aria-label="Previous month"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <p className="text-sm font-semibold text-foreground">{monthLabel}</p>
                                <button
                                    type="button"
                                    onClick={() => shiftMonth(1)}
                                    className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                    aria-label="Next month"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-7 gap-y-0.5 text-center">
                                {WEEKDAY_LABELS.map((label, i) => (
                                    <span key={`${label}-${i}`} className="py-1 text-[10px] font-medium uppercase text-muted-foreground/70">
                                        {label}
                                    </span>
                                ))}
                                {calendarCells.map((date, i) => {
                                    if (!date) return <span key={`empty-${i}`} />;
                                    const iso = isoDay(date);
                                    const count = countsByDay.get(iso) ?? 0;
                                    return (
                                        <button
                                            key={iso}
                                            type="button"
                                            onClick={() => setSelectedDay(iso)}
                                            onDragOver={(event) => {
                                                if (canEdit && dragKey) event.preventDefault();
                                            }}
                                            onDrop={(event) => {
                                                event.preventDefault();
                                                dropOnDay(iso);
                                            }}
                                            className={cn(
                                                "relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full text-xs transition-colors",
                                                selectedDay === iso
                                                    ? "bg-primary font-semibold text-primary-foreground"
                                                    : count > 0
                                                      ? "font-medium text-foreground hover:bg-secondary"
                                                      : "text-muted-foreground hover:bg-secondary",
                                                iso === todayIso && selectedDay !== iso && "ring-1 ring-inset ring-primary/40",
                                            )}
                                        >
                                            {date.getDate()}
                                            {count > 0 && (
                                                <span
                                                    className={cn(
                                                        "absolute bottom-0.5 h-1 w-1 rounded-full",
                                                        selectedDay === iso ? "bg-primary-foreground" : "bg-primary",
                                                    )}
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Selected day */}
                        <div
                            className="flex flex-col gap-2"
                            onDragOver={(event) => {
                                if (canEdit && dragKey && selectedDay) event.preventDefault();
                            }}
                            onDrop={(event) => {
                                event.preventDefault();
                                dropOnDay(selectedDay);
                            }}
                        >
                            {selectedDay ? (
                                <>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                        {formatDayHeading(selectedDay)}
                                    </p>
                                    {dayItems.length > 0 ? (
                                        dayItems.map((draft, index) => (
                                            <ItemChip key={draft.key} draft={draft} index={index} total={dayItems.length} />
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            Nothing planned this day{canEdit ? " — drag an activity onto the calendar or use + below." : "."}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Pick a day on the calendar to see what&apos;s planned.
                                </p>
                            )}
                        </div>

                        {/* Editor: unscheduled pool + freeform entries */}
                        {canEdit && (
                            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-3">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                    Not scheduled yet
                                </p>
                                {unscheduledActivities.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {unscheduledActivities.map((activity) => (
                                            <span
                                                key={activity.activity_id}
                                                draggable
                                                onDragStart={() => {
                                                    const existing = drafts.find(
                                                        (entry) => entry.activity_id === activity.activity_id,
                                                    );
                                                    setDragKey(existing ? existing.key : `pool-${activity.activity_id}`);
                                                }}
                                                onDragEnd={() => setDragKey(null)}
                                                className="inline-flex max-w-full cursor-grab items-center gap-1 rounded-full border border-border bg-secondary/50 px-2 py-1 text-xs text-foreground/85 active:cursor-grabbing"
                                            >
                                                <span className="truncate">{activity.title || "Untitled"}</span>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        addItemToDay({ activity_id: activity.activity_id, title: null }, selectedDay)
                                                    }
                                                    className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                                                    aria-label={`Add ${activity.title || "activity"} to selected day`}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {unscheduledEntries.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {unscheduledEntries.map((draft) => (
                                            <span
                                                key={draft.key}
                                                draggable
                                                onDragStart={() => setDragKey(draft.key)}
                                                onDragEnd={() => setDragKey(null)}
                                                className="inline-flex cursor-grab items-center gap-1 rounded-full border border-border bg-secondary/50 px-2 py-1 text-xs text-foreground/85 active:cursor-grabbing"
                                            >
                                                <span className="truncate">{draft.title}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(draft.key)}
                                                    className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                                                    aria-label="Remove entry"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {unscheduledActivities.length === 0 && unscheduledEntries.length === 0 && (
                                    <p className="text-xs text-muted-foreground">Everything is scheduled. Nice.</p>
                                )}

                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        handleAddCustomEntry();
                                    }}
                                    className="flex items-center gap-1.5"
                                >
                                    <input
                                        value={newEntryTitle}
                                        onChange={(event) => setNewEntryTitle(event.target.value)}
                                        placeholder='Add anything — "Sunset walk"…'
                                        className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground/60 focus:border-primary/60"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newEntryTitle.trim()}
                                        className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-40"
                                    >
                                        Add
                                    </button>
                                </form>
                            </div>
                        )}

                        {error && <p className="text-xs text-destructive">{error}</p>}

                        {canEdit && isDirty && (
                            <div className="sticky bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-card via-card to-transparent pb-1 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setDrafts(savedDrafts)}
                                    className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleSave()}
                                    disabled={saving}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                                >
                                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                                    Save itinerary
                                </button>
                            </div>
                        )}
                    </div>
                )
            )}
        </div>
    );
}
