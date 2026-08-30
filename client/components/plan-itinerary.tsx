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

function formatHour(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return `${hour % 12} ${hour < 12 ? "AM" : "PM"}`;
}

function formatTime(value: string | null) {
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number);
  return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${hour < 12 ? "a" : "p"}`;
}

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
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [selectedDraftKey, setSelectedDraftKey] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
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
  const selectedDraft = drafts.find((item) => item.key === selectedDraftKey) ?? null;
  const earliestScheduledHour = drafts.reduce((earliest, item) => {
    if (item.scheduleType !== "time" || !item.startTime) return earliest;
    return Math.min(earliest, Number(item.startTime.slice(0, 2)));
  }, 6);
  const hourRows = Array.from({ length: 24 - earliestScheduledHour }, (_, index) => earliestScheduledHour + index);
  const timedItemsBySlot = useMemo(() => {
    const slots = new Map<string, Draft[]>();
    drafts.forEach((item) => {
      if (!item.dayDate || item.scheduleType !== "time") return;
      const hour = Number(item.startTime?.slice(0, 2) ?? 9);
      const key = `${item.dayDate}-${hour}`;
      slots.set(key, [...(slots.get(key) ?? []), item]);
    });
    return slots;
  }, [drafts]);
  const staysByDay = useMemo(() => {
    const days = new Map<string, Draft[]>();
    drafts.forEach((item) => {
      if (!item.dayDate || item.scheduleType !== "night") return;
      days.set(item.dayDate, [...(days.get(item.dayDate) ?? []), item]);
    });
    return days;
  }, [drafts]);
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
      startTime: source.scheduleType === "time" ? source.defaultTime ?? selectedTime : null,
    }]);
    setAddMenuOpen(false);
  }

  function addFreeform() {
    const title = newTitle.trim();
    if (!title) return;
    setDrafts((current) => [...current, {
      key: nextKey(), dayDate: selectedDay, sourceType: null, sourceId: null, title,
      scheduleType: "time", startTime: selectedTime,
    }]);
    setNewTitle("");
    setAddMenuOpen(false);
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
                  <div className="sticky top-0 z-20 flex items-center gap-2 rounded-xl border border-border bg-card/95 p-2.5 shadow-sm backdrop-blur">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">{selectedDay ? formatDay(selectedDay) : "Choose a day"}</p>
                      <p className="text-[10px] text-muted-foreground">Selected time · {formatTime(selectedTime)}</p>
                    </div>
                    <button type="button" onClick={() => setAddMenuOpen((value) => !value)} className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="h-3 w-3" />Add plans</button>
                  </div>

                  {addMenuOpen && (
                    <section className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 p-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Add to {selectedDay ? formatDay(selectedDay) : "this day"} at {formatTime(selectedTime)}</p>
                      <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
                        {availableSources.map((source) => <button key={`${source.sourceType}-${source.sourceId}`} type="button" onClick={() => addSource(source)} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-card"><span className={cn("flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md", source.scheduleType === "night" ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary")}>{source.scheduleType === "night" ? <BedDouble className="h-3 w-3" /> : <Plus className="h-3 w-3" />}</span><span className="min-w-0 flex-1 truncate">{source.title}</span><span className="flex-shrink-0 text-[10px] text-muted-foreground">{source.scheduleType === "night" ? "overnight" : source.defaultTime || formatTime(selectedTime)}</span></button>)}
                        {availableSources.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">Everything is already included for this day.</p>}
                      </div>
                      <form onSubmit={(event) => { event.preventDefault(); addFreeform(); }} className="mt-2 flex min-w-0 gap-2"><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Add a meal, walk, reservation…" className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 py-2 text-xs outline-none focus:border-primary" /><button type="submit" disabled={!newTitle.trim()} className="flex-shrink-0 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40">Add</button></form>
                    </section>
                  )}

                  <div className="overflow-hidden rounded-2xl border border-border bg-background/60">
                    <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                      <button type="button" onClick={() => shiftWeek(-1)} aria-label="Previous week" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
                      <span className="text-sm font-semibold">{weekLabel}</span>
                      <button type="button" onClick={() => shiftWeek(1)} aria-label="Next week" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                    <div className="grid min-w-0 grid-cols-[38px_repeat(7,minmax(0,1fr))] text-center">
                      <span className="border-b border-r border-border" />
                      {weekDays.map((date) => (
                        <button key={isoDay(date)} type="button" onClick={() => setSelectedDay(isoDay(date))} className={cn("relative flex flex-col items-center border-b border-r border-border py-2 text-[10px] font-semibold text-muted-foreground transition-colors last:border-r-0 hover:bg-secondary", selectedDay === isoDay(date) && "bg-primary/10 text-primary")}>
                          <span>{WEEKDAYS[date.getDay()]}</span>
                          <span className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs", selectedDay === isoDay(date) && "bg-primary text-primary-foreground")}>{date.getDate()}</span>
                          {daysWithItems.has(isoDay(date)) && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />}
                        </button>
                      ))}

                      <span className="flex items-center justify-center border-b border-r border-border bg-emerald-500/5 text-[9px] font-semibold uppercase text-emerald-700">Night</span>
                      {weekDays.map((date) => {
                        const iso = isoDay(date);
                        const stays = staysByDay.get(iso) ?? [];
                        return <div key={`night-${iso}`} className={cn("relative min-h-11 min-w-0 border-b border-r border-border bg-emerald-500/5 p-1 text-left last:border-r-0 hover:bg-emerald-500/10", selectedDay === iso && "ring-1 ring-inset ring-emerald-500/30")}><button type="button" onClick={() => { setSelectedDay(iso); setSelectedDraftKey(null); }} className="absolute inset-0" aria-label={`Select night of ${formatDay(iso)}`} />{stays.map((item) => { const source = sourceMap.get(sourceKey(item.sourceType, item.sourceId) ?? ""); return <button key={item.key} type="button" onClick={() => { setSelectedDay(iso); setSelectedDraftKey(item.key); }} className="relative mb-0.5 block w-full truncate rounded bg-emerald-600 px-1 py-0.5 text-left text-[9px] font-medium text-white" title={source?.title ?? item.title ?? "Stay"}>{source?.title ?? item.title}</button>; })}</div>;
                      })}

                      {hourRows.map((hour) => (
                        <div key={`hour-${hour}`} className="contents">
                          <span className="flex min-h-12 items-start justify-center border-b border-r border-border pt-1 text-[8px] font-medium text-muted-foreground">{formatHour(hour)}</span>
                          {weekDays.map((date) => {
                            const iso = isoDay(date);
                            const items = timedItemsBySlot.get(`${iso}-${hour}`) ?? [];
                            return <div key={`${iso}-${hour}`} className={cn("relative min-h-12 min-w-0 border-b border-r border-border p-0.5 text-left last:border-r-0 hover:bg-primary/5", selectedDay === iso && selectedTime.startsWith(`${String(hour).padStart(2, "0")}:`) && "bg-primary/5 ring-1 ring-inset ring-primary/20")}><button type="button" onClick={() => { setSelectedDay(iso); setSelectedTime(`${String(hour).padStart(2, "0")}:00`); setSelectedDraftKey(null); }} className="absolute inset-0" aria-label={`Select ${formatDay(iso)} at ${formatHour(hour)}`} />{items.map((item) => { const source = sourceMap.get(sourceKey(item.sourceType, item.sourceId) ?? ""); return <button key={item.key} type="button" onClick={() => { setSelectedDay(iso); setSelectedTime(item.startTime ?? `${String(hour).padStart(2, "0")}:00`); setSelectedDraftKey(item.key); }} className={cn("relative mb-0.5 block w-full truncate rounded bg-primary px-1 py-0.5 text-left text-[9px] font-medium text-primary-foreground", selectedDraftKey === item.key && "ring-2 ring-primary ring-offset-1")} title={`${formatTime(item.startTime)} ${source?.title ?? item.title ?? "Item"}`}>{formatTime(item.startTime)} {source?.title ?? item.title}</button>; })}</div>;
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedDraft && (
                    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5">
                      <span className="min-w-0 basis-full truncate text-xs font-medium">{sourceMap.get(sourceKey(selectedDraft.sourceType, selectedDraft.sourceId) ?? "")?.title ?? selectedDraft.title}</span>
                      <input type="date" value={selectedDraft.dayDate ?? ""} onChange={(event) => setDrafts((current) => current.map((item) => item.key === selectedDraft.key ? { ...item, dayDate: event.target.value || null } : item))} aria-label="Scheduled date" className="w-[118px] rounded-md border border-border bg-card px-1.5 py-1 text-[10px]" />
                      {selectedDraft.scheduleType === "time" && <input type="time" value={selectedDraft.startTime ?? ""} onChange={(event) => setDrafts((current) => current.map((item) => item.key === selectedDraft.key ? { ...item, startTime: event.target.value || null } : item))} aria-label="Scheduled time" className="w-[76px] rounded-md border border-border bg-card px-1 py-1 text-[10px]" />}
                      <button type="button" onClick={() => { setDrafts((current) => current.filter((item) => item.key !== selectedDraft.key)); setSelectedDraftKey(null); }} aria-label="Remove selected itinerary item" className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )}

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
