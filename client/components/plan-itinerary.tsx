"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  X,
} from "lucide-react";

import {
  getPlanItinerary,
  savePlanItinerary,
  type PlanItinerarySourceType,
} from "@/lib/api-client";
import { useDialogAccessibility } from "@/hooks/use-dialog-accessibility";
import { cn } from "@/lib/utils";

export interface PlanItinerarySource {
  sourceType: PlanItinerarySourceType;
  sourceId: number;
  title: string;
  detail?: string | null;
  scheduleType: "time" | "night";
  defaultTime?: string;
}

interface Draft {
  key: string;
  dayDate: string | null;
  sourceType: PlanItinerarySourceType | null;
  sourceId: number | null;
  title: string | null;
  scheduleType: "time" | "night";
  startTime: string | null;
}

interface PlanItineraryProps {
  collectionName: string;
  sources: PlanItinerarySource[];
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function isoDay(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function formatDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function sourceKey(type: PlanItinerarySourceType | null, id: number | null) {
  return type && id ? `${type}-${id}` : null;
}

export default function PlanItinerary({ collectionName, sources }: PlanItineraryProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<Draft[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(() => isoDay(new Date()));
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const loadedCollection = useRef<string | null>(null);
  const temporaryId = useRef(0);
  const closePanel = useCallback(() => setOpen(false), []);
  const dialogRef = useDialogAccessibility(open, closePanel);

  useEffect(() => {
    if (!open || loadedCollection.current === collectionName) return;
    loadedCollection.current = collectionName;
    setLoading(true);
    setError(null);
    getPlanItinerary(collectionName)
      .then((items) => {
        const mapped = items.map((item) => ({
          key: `db-${item.plan_itinerary_item_id}`,
          dayDate: item.day_date,
          sourceType: item.source_type,
          sourceId: item.source_id,
          title: item.title,
          scheduleType: item.schedule_type,
          startTime: item.start_time?.slice(0, 5) ?? null,
        }));
        setDrafts(mapped);
        setSavedDrafts(mapped);
        const firstDay = mapped.find((item) => item.dayDate)?.dayDate;
        if (firstDay) {
          setWeekStart(startOfWeek(parseIsoDay(firstDay)));
          setSelectedDay(firstDay);
        }
      })
      .catch(() => {
        loadedCollection.current = null;
        setError("Could not load this itinerary.");
      })
      .finally(() => setLoading(false));
  }, [collectionName, open]);

  const sourceMap = useMemo(
    () => new Map(sources.map((source) => [`${source.sourceType}-${source.sourceId}`, source])),
    [sources],
  );
  const usedSources = new Set(drafts.map((item) => sourceKey(item.sourceType, item.sourceId)).filter(Boolean));
  const availableSources = sources.filter((source) => {
    if (source.scheduleType === "night") {
      return !drafts.some((item) =>
        item.sourceType === source.sourceType && item.sourceId === source.sourceId && item.dayDate === selectedDay
      );
    }
    return !usedSources.has(`${source.sourceType}-${source.sourceId}`);
  });
  const selectedItems = drafts
    .filter((item) => item.dayDate === selectedDay && item.scheduleType === "time")
    .toSorted((left, right) => (left.startTime ?? "23:59").localeCompare(right.startTime ?? "23:59"));
  const selectedNights = drafts.filter((item) => item.dayDate === selectedDay && item.scheduleType === "night");
  const scheduledCount = drafts.filter((item) => item.dayDate).length;
  const isDirty = JSON.stringify(drafts) !== JSON.stringify(savedDrafts);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return date;
    }),
    [weekStart],
  );
  const daysWithItems = new Set(drafts.map((item) => item.dayDate).filter(Boolean));

  function nextKey() {
    temporaryId.current += 1;
    return `tmp-${temporaryId.current}`;
  }

  function addSource(source: PlanItinerarySource) {
    setDrafts((current) => [...current, {
      key: nextKey(),
      dayDate: selectedDay,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      title: source.title,
      scheduleType: source.scheduleType,
      startTime: source.scheduleType === "time" ? source.defaultTime ?? "09:00" : null,
    }]);
  }

  function addFreeform() {
    const title = newTitle.trim();
    if (!title) return;
    setDrafts((current) => [...current, {
      key: nextKey(), dayDate: selectedDay, sourceType: null, sourceId: null, title,
      scheduleType: "time", startTime: "09:00",
    }]);
    setNewTitle("");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const items = await savePlanItinerary(collectionName, drafts.map((item) => ({
        day_date: item.dayDate,
        source_type: item.sourceType,
        source_id: item.sourceId,
        title: item.title,
        schedule_type: item.scheduleType,
        start_time: item.startTime,
      })));
      const mapped = items.map((item) => ({
        key: `db-${item.plan_itinerary_item_id}`,
        dayDate: item.day_date,
        sourceType: item.source_type,
        sourceId: item.source_id,
        title: item.title,
        scheduleType: item.schedule_type,
        startTime: item.start_time?.slice(0, 5) ?? null,
      }));
      setDrafts(mapped);
      setSavedDrafts(mapped);
    } catch {
      setError("Could not save this itinerary.");
    } finally {
      setSaving(false);
    }
  }

  const weekEnd = weekDays[6];
  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${weekStart.toLocaleDateString("en-US", { month: "long" })} ${weekStart.getDate()}–${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
    : `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  function shiftWeek(direction: -1 | 1) {
    setWeekStart((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + direction * 7);
      return next;
    });
    setSelectedDay((current) => {
      const next = current ? parseIsoDay(current) : new Date(weekStart);
      next.setDate(next.getDate() + direction * 7);
      return isoDay(next);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-md"
        aria-label={`Open itinerary for ${collectionName}`}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        Itinerary{scheduledCount ? ` · ${scheduledCount}` : ""}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <button
            type="button"
            className="fixed inset-0 z-[1890] cursor-default bg-black/25 backdrop-blur-[1px] md:bg-black/10"
            onClick={closePanel}
            aria-label="Close itinerary"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`${collectionName} itinerary`}
            className="fixed inset-x-3 bottom-[max(5.75rem,env(safe-area-inset-bottom))] top-3 z-[1900] flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:bottom-5 md:left-auto md:right-5 md:top-5 md:w-[480px]"
          >
            <div ref={dialogRef} className="contents">
            <header className="flex flex-shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <CalendarDays className="h-4.5 w-4.5 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{collectionName}</p>
                <p className="text-xs text-muted-foreground">Build your day-by-day itinerary</p>
              </div>
              <button type="button" onClick={closePanel} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close itinerary panel">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              {loading ? (
                <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="flex min-w-0 flex-col gap-4">
                  <div className="rounded-2xl border border-border bg-background/60 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <button type="button" onClick={() => shiftWeek(-1)} aria-label="Previous week" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
                      <span className="text-sm font-semibold">{weekLabel}</span>
                      <button type="button" onClick={() => shiftWeek(1)} aria-label="Next week" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                    <div className="grid min-w-0 grid-cols-7 gap-y-1 text-center">
                      {WEEKDAYS.map((day, index) => <span key={`${day}-${index}`} className="py-1 text-[10px] font-semibold text-muted-foreground">{day}</span>)}
                      {weekDays.map((date) => (
                        <button key={isoDay(date)} type="button" onClick={() => setSelectedDay(isoDay(date))} className={cn("relative mx-auto h-9 w-9 rounded-full text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground", selectedDay === isoDay(date) && "bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground")}>
                          {date.getDate()}
                          {daysWithItems.has(isoDay(date)) && <span className={cn("absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary", selectedDay === isoDay(date) && "bg-primary-foreground")} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <section className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{selectedDay ? formatDay(selectedDay) : "Choose a day"}</p>
                        <p className="text-[11px] text-muted-foreground">Activities and flights are ordered by time.</p>
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-secondary px-2 py-1 text-[10px] font-medium text-muted-foreground">{selectedItems.length} scheduled</span>
                    </div>
                    {selectedItems.length === 0 && <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">No timed plans yet. Add one below.</div>}
                    {selectedItems.map((item) => {
                      const source = sourceMap.get(sourceKey(item.sourceType, item.sourceId) ?? "");
                      return (
                        <div key={item.key} className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2 shadow-xs">
                          <input type="time" value={item.startTime ?? ""} onChange={(event) => setDrafts((current) => current.map((draft) => draft.key === item.key ? { ...draft, startTime: event.target.value || null } : draft))} aria-label={`Time for ${source?.title ?? item.title ?? "item"}`} className="w-[86px] flex-shrink-0 rounded-lg border border-border bg-background px-1.5 py-1.5 text-xs text-foreground" />
                          <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{source?.title ?? item.title}</p>{source?.detail && <p className="truncate text-[10px] text-muted-foreground">{source.detail}</p>}</div>
                          <button type="button" onClick={() => setDrafts((current) => current.filter((draft) => draft.key !== item.key))} aria-label="Remove from itinerary" className="flex-shrink-0 rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-3 w-3" /></button>
                        </div>
                      );
                    })}
                  </section>

                  <section className="flex flex-col gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-700"><BedDouble className="h-3.5 w-3.5" />Night of {selectedDay ? formatDay(selectedDay).replace(/^\w+, /, "") : "selected day"}</p>
                    {selectedNights.length === 0 && <div className="rounded-xl border border-dashed border-emerald-500/25 bg-emerald-500/5 px-3 py-3 text-xs text-muted-foreground">No stay attached to this night.</div>}
                    {selectedNights.map((item) => {
                      const source = sourceMap.get(sourceKey(item.sourceType, item.sourceId) ?? "");
                      return <div key={item.key} className="flex min-w-0 items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5"><BedDouble className="h-4 w-4 flex-shrink-0 text-emerald-600" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{source?.title ?? item.title}</p>{source?.detail && <p className="truncate text-[10px] text-muted-foreground">{source.detail}</p>}</div><button type="button" onClick={() => setDrafts((current) => current.filter((draft) => draft.key !== item.key))} aria-label="Remove overnight stay" className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-3 w-3" /></button></div>;
                    })}
                  </section>

                  <section className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Add to this day</p>
                    <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
                      {availableSources.map((source) => <button key={`${source.sourceType}-${source.sourceId}`} type="button" onClick={() => addSource(source)} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-card"><span className={cn("flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md", source.scheduleType === "night" ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary")}>{source.scheduleType === "night" ? <BedDouble className="h-3 w-3" /> : <Plus className="h-3 w-3" />}</span><span className="min-w-0 flex-1 truncate">{source.title}</span><span className="flex-shrink-0 text-[10px] text-muted-foreground">{source.scheduleType === "night" ? "overnight" : source.defaultTime || "9:00 AM"}</span></button>)}
                      {availableSources.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">Everything is already included for this day.</p>}
                    </div>
                    <form onSubmit={(event) => { event.preventDefault(); addFreeform(); }} className="mt-2 flex min-w-0 gap-2"><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Add a meal, walk, reservation…" className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 py-2 text-xs outline-none focus:border-primary" /><button type="submit" disabled={!newTitle.trim()} className="flex-shrink-0 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40">Add</button></form>
                  </section>

                  {error && <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
                </div>
              )}
            </div>

            <footer className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-card px-4 py-3">
              <span className="text-xs text-muted-foreground">{isDirty ? "Unsaved changes" : `${scheduledCount} items scheduled`}</span>
              <div className="flex items-center gap-2">
                {isDirty && <button type="button" onClick={() => setDrafts(savedDrafts)} className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">Reset</button>}
                <button type="button" onClick={() => void save()} disabled={saving || !isDirty} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm disabled:opacity-40">{saving && <Loader2 className="h-3 w-3 animate-spin" />}Save itinerary</button>
              </div>
            </footer>
            </div>
          </aside>
        </>,
        document.body,
      )}
    </>
  );
}
