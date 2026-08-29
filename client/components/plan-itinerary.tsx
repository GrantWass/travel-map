"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  CalendarDays,
  ChevronDown,
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
  const [cursor, setCursor] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const loadedCollection = useRef<string | null>(null);
  const temporaryId = useRef(0);

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
          const [year, month] = firstDay.split("-").map(Number);
          setCursor({ year, month: month - 1 });
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

  const calendarCells = useMemo(() => {
    const leading = new Date(cursor.year, cursor.month, 1).getDay();
    const count = new Date(cursor.year, cursor.month + 1, 0).getDate();
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: count }, (_, index) => new Date(cursor.year, cursor.month, index + 1)),
    ];
  }, [cursor]);
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

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          Itinerary{scheduledCount ? ` (${scheduledCount})` : ""}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="min-w-0 max-w-full overflow-hidden border-t border-border p-3">
          <div className="flex min-w-0 flex-col gap-3">
          {loading ? <Loader2 className="mx-auto my-4 h-5 w-5 animate-spin text-muted-foreground" /> : (
            <>
              <div className="rounded-xl border border-border p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <button type="button" onClick={() => setCursor((value) => { const date = new Date(value.year, value.month - 1, 1); return { year: date.getFullYear(), month: date.getMonth() }; })} aria-label="Previous month" className="rounded-full p-1 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="text-xs font-semibold">{monthLabel}</span>
                  <button type="button" onClick={() => setCursor((value) => { const date = new Date(value.year, value.month + 1, 1); return { year: date.getFullYear(), month: date.getMonth() }; })} aria-label="Next month" className="rounded-full p-1 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></button>
                </div>
                <div className="grid min-w-0 grid-cols-7 text-center">
                  {WEEKDAYS.map((day, index) => <span key={`${day}-${index}`} className="py-1 text-[10px] text-muted-foreground">{day}</span>)}
                  {calendarCells.map((date, index) => date ? (
                    <button key={isoDay(date)} type="button" onClick={() => setSelectedDay(isoDay(date))} className={cn("relative mx-auto h-8 w-8 rounded-full text-xs hover:bg-secondary", selectedDay === isoDay(date) && "bg-primary text-primary-foreground hover:bg-primary")}>
                      {date.getDate()}
                      {daysWithItems.has(isoDay(date)) && <span className={cn("absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary", selectedDay === isoDay(date) && "bg-primary-foreground")} />}
                    </button>
                  ) : <span key={`empty-${index}`} />)}
                </div>
              </div>

              <p className="text-xs font-semibold text-muted-foreground">{selectedDay ? formatDay(selectedDay) : "Choose a day to start planning"}</p>
              {selectedItems.map((item) => {
                const source = sourceMap.get(sourceKey(item.sourceType, item.sourceId) ?? "");
                return (
                  <div key={item.key} className="flex items-center gap-2 rounded-lg bg-secondary/50 px-2.5 py-2">
                    <input
                      type="time"
                      value={item.startTime ?? ""}
                      onChange={(event) => setDrafts((current) => current.map((draft) => draft.key === item.key ? { ...draft, startTime: event.target.value || null } : draft))}
                      aria-label={`Time for ${source?.title ?? item.title ?? "item"}`}
                      className="w-[76px] rounded-md border border-border bg-card px-1.5 py-1 text-[11px] text-foreground"
                    />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{source?.title ?? item.title}</p>{source?.detail && <p className="truncate text-[10px] text-muted-foreground">{source.detail}</p>}</div>
                    <button type="button" onClick={() => setDrafts((current) => current.filter((draft) => draft.key !== item.key))} aria-label="Remove from itinerary" className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                  </div>
                );
              })}
              {selectedNights.length > 0 && (
                <div className="mt-1 flex flex-col gap-1.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"><BedDouble className="h-3 w-3" />Overnight</p>
                  {selectedNights.map((item) => {
                    const source = sourceMap.get(sourceKey(item.sourceType, item.sourceId) ?? "");
                    return (
                      <div key={item.key} className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2">
                        <BedDouble className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                        <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{source?.title ?? item.title}</p>{source?.detail && <p className="truncate text-[10px] text-muted-foreground">{source.detail}</p>}</div>
                        <button type="button" onClick={() => setDrafts((current) => current.filter((draft) => draft.key !== item.key))} aria-label="Remove overnight stay" className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="rounded-xl border border-dashed border-border p-2.5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Add to {selectedDay ? formatDay(selectedDay) : "unscheduled"}</p>
                <div className="flex max-h-28 flex-col gap-1 overflow-y-auto">
                  {availableSources.map((source) => (
                    <button key={`${source.sourceType}-${source.sourceId}`} type="button" onClick={() => addSource(source)} className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary">
                      {source.scheduleType === "night" ? <BedDouble className="h-3 w-3 flex-shrink-0 text-emerald-600" /> : <Plus className="h-3 w-3 flex-shrink-0 text-primary" />}<span className="min-w-0 flex-1 truncate">{source.title}</span><span className="flex-shrink-0 text-[10px] text-muted-foreground">{source.scheduleType === "night" ? "night" : source.defaultTime || "9:00 AM"}</span>
                    </button>
                  ))}
                  {availableSources.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">All plan items are included.</p>}
                </div>
                <form onSubmit={(event) => { event.preventDefault(); addFreeform(); }} className="mt-2 flex gap-1.5">
                  <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Add anything else…" className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-2 py-1.5 text-xs outline-none focus:border-primary" />
                  <button type="submit" disabled={!newTitle.trim()} className="rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:opacity-40">Add</button>
                </form>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
              {isDirty && <div className="flex justify-end gap-2"><button type="button" onClick={() => setDrafts(savedDrafts)} className="px-2 py-1.5 text-xs text-muted-foreground">Reset</button><button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">{saving && <Loader2 className="h-3 w-3 animate-spin" />}Save itinerary</button></div>}
            </>
          )}
          </div>
        </div>
      )}
    </section>
  );
}
