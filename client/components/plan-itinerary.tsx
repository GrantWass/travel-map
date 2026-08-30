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
const HOUR_HEIGHT = 64;

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
  const [selectedHour, selectedMinute] = selectedTime.split(":").map(Number);
  const selectedTimeTop = (((selectedHour * 60 + selectedMinute) - earliestScheduledHour * 60) / 60) * HOUR_HEIGHT;
  const timedItemsByDay = useMemo(() => {
    const days = new Map<string, Draft[]>();
    drafts.forEach((item) => {
      if (!item.dayDate || item.scheduleType !== "time") return;
      days.set(item.dayDate, [...(days.get(item.dayDate) ?? []), item]);
    });
    days.forEach((items) => items.sort((left, right) => (left.startTime ?? "09:00").localeCompare(right.startTime ?? "09:00")));
    return days;
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
  }

  function addFreeform() {
    const title = newTitle.trim();
    if (!title) return;
    setDrafts((current) => [...current, {
      key: nextKey(), dayDate: selectedDay, sourceType: null, sourceId: null, title,
      scheduleType: "time", startTime: selectedTime,
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
            className="fixed inset-x-2 bottom-[max(5.25rem,env(safe-area-inset-bottom))] top-2 z-[1900] flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:bottom-5 md:left-auto md:right-5 md:top-5 md:w-[min(760px,calc(100vw-2.5rem))]"
          >
            <div ref={dialogRef} className="contents">
              <header className="flex flex-shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><CalendarDays className="h-4.5 w-4.5 text-primary" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{collectionName}</p><p className="text-xs text-muted-foreground">Weekly itinerary</p></div>
                <button type="button" onClick={() => { const today = new Date(); setWeekStart(startOfWeek(today)); setSelectedDay(isoDay(today)); }} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">Today</button>
                <button type="button" onClick={() => shiftWeek(-1)} aria-label="Previous week" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => shiftWeek(1)} aria-label="Next week" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
                <p className="hidden min-w-40 text-right text-sm font-semibold text-foreground sm:block">{weekLabel}</p>
                <button type="button" onClick={closePanel} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close itinerary panel"><X className="h-4 w-4" /></button>
              </header>

              {loading ? (
                <div className="flex min-h-0 flex-1 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-background/40">
                    <div className="min-w-[650px]">
                      <div className="sticky top-0 z-30 grid grid-cols-[54px_repeat(7,minmax(84px,1fr))] border-b border-border bg-card/95 backdrop-blur">
                        <span />
                        {weekDays.map((date) => {
                          const iso = isoDay(date);
                          const isToday = iso === isoDay(new Date());
                          return <button key={iso} type="button" onClick={() => setSelectedDay(iso)} className={cn("flex flex-col items-center border-l border-border/60 py-2 text-muted-foreground hover:bg-secondary/60", selectedDay === iso && "bg-primary/5 text-primary")}><span className="text-[10px] font-semibold uppercase tracking-wide">{date.toLocaleDateString("en-US", { weekday: "short" })}</span><span className={cn("mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", isToday && "bg-primary text-primary-foreground")}>{date.getDate()}</span></button>;
                        })}
                        <span className="flex items-center justify-end border-t border-border/60 pr-2 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Night</span>
                        {weekDays.map((date) => {
                          const iso = isoDay(date);
                          const stays = staysByDay.get(iso) ?? [];
                          return <div key={`night-${iso}`} className="relative min-h-10 border-l border-t border-border/60 bg-emerald-500/[0.04] p-1"><button type="button" onClick={() => { setSelectedDay(iso); setSelectedDraftKey(null); }} className="absolute inset-0" aria-label={`Select night of ${formatDay(iso)}`} />{stays.map((item) => { const source = sourceMap.get(sourceKey(item.sourceType, item.sourceId) ?? ""); return <button key={item.key} type="button" onClick={() => { setSelectedDay(iso); setSelectedDraftKey(item.key); }} className="relative block w-full truncate rounded-md bg-emerald-500 px-1.5 py-1 text-left text-[10px] font-medium text-white shadow-sm" title={source?.title ?? item.title ?? "Stay"}>{source?.title ?? item.title}</button>; })}</div>;
                        })}
                      </div>

                      <div className="grid grid-cols-[54px_repeat(7,minmax(84px,1fr))]">
                        <div className="relative" style={{ height: hourRows.length * HOUR_HEIGHT }}>
                          {hourRows.map((hour, index) => <span key={hour} className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: index * HOUR_HEIGHT }}>{formatHour(hour)}</span>)}
                        </div>
                        {weekDays.map((date) => {
                          const iso = isoDay(date);
                          const items = timedItemsByDay.get(iso) ?? [];
                          const isToday = iso === isoDay(new Date());
                          const now = new Date();
                          const nowMinutes = now.getHours() * 60 + now.getMinutes() - earliestScheduledHour * 60;
                          return (
                            <div
                              key={`timeline-${iso}`}
                              className={cn("relative border-l border-border/60", selectedDay === iso && "bg-primary/[0.025]")}
                              style={{ height: hourRows.length * HOUR_HEIGHT }}
                              onClick={(event) => {
                                const bounds = event.currentTarget.getBoundingClientRect();
                                const rawMinutes = ((event.clientY - bounds.top) / HOUR_HEIGHT) * 60;
                                const roundedMinutes = Math.max(0, Math.min((hourRows.length * 60) - 15, Math.round(rawMinutes / 15) * 15));
                                const totalMinutes = earliestScheduledHour * 60 + roundedMinutes;
                                setSelectedDay(iso);
                                setSelectedTime(`${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`);
                                setSelectedDraftKey(null);
                              }}
                            >
                              {hourRows.map((hour, index) => <span key={hour} className="pointer-events-none absolute inset-x-0 border-t border-border/50" style={{ top: index * HOUR_HEIGHT }} />)}
                              {selectedDay === iso && selectedTimeTop >= 0 && <span className="pointer-events-none absolute inset-x-1 z-10 border-t-2 border-primary/60" style={{ top: selectedTimeTop }}><span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-primary" /></span>}
                              {isToday && nowMinutes >= 0 && nowMinutes <= hourRows.length * 60 && <span className="pointer-events-none absolute inset-x-0 z-20 border-t border-red-500" style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}><span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" /></span>}
                              {items.map((item) => {
                                const source = sourceMap.get(sourceKey(item.sourceType, item.sourceId) ?? "");
                                const [hour, minute] = (item.startTime ?? "09:00").split(":").map(Number);
                                const top = (((hour * 60 + minute) - earliestScheduledHour * 60) / 60) * HOUR_HEIGHT;
                                const isFlight = item.sourceType === "flight";
                                return <button key={item.key} type="button" onClick={(event) => { event.stopPropagation(); setSelectedDay(iso); setSelectedTime(item.startTime ?? "09:00"); setSelectedDraftKey(item.key); }} className={cn("absolute left-1 right-1 z-10 overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left shadow-sm transition hover:brightness-95", isFlight ? "border-sky-600 bg-sky-500/90 text-white" : "border-primary bg-primary/90 text-primary-foreground", selectedDraftKey === item.key && "ring-2 ring-foreground/40 ring-offset-1")} style={{ top: Math.max(0, top), minHeight: 42 }} title={`${formatTime(item.startTime)} ${source?.title ?? item.title ?? "Item"}`}><span className="block truncate text-[10px] font-semibold">{source?.title ?? item.title}</span><span className="block text-[9px] opacity-85">{formatTime(item.startTime)}</span></button>;
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <section className="flex-shrink-0 border-t border-border bg-card px-4 py-3">
                    <div className="mb-2 flex min-w-0 items-center gap-2">
                      <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-foreground">Add to {selectedDay ? formatDay(selectedDay) : "your itinerary"}</p><p className="text-[10px] text-muted-foreground">{formatTime(selectedTime)} · choose an activity, flight, or stay</p></div>
                      {selectedDraft && <div className="flex items-center gap-1.5 rounded-lg bg-primary/5 px-2 py-1"><input type="date" value={selectedDraft.dayDate ?? ""} onChange={(event) => setDrafts((current) => current.map((item) => item.key === selectedDraft.key ? { ...item, dayDate: event.target.value || null } : item))} aria-label="Scheduled date" className="w-[116px] bg-transparent text-[10px]" />{selectedDraft.scheduleType === "time" && <input type="time" value={selectedDraft.startTime ?? ""} onChange={(event) => setDrafts((current) => current.map((item) => item.key === selectedDraft.key ? { ...item, startTime: event.target.value || null } : item))} aria-label="Scheduled time" className="w-[74px] bg-transparent text-[10px]" />}<button type="button" onClick={() => { setDrafts((current) => current.filter((item) => item.key !== selectedDraft.key)); setSelectedDraftKey(null); }} aria-label="Remove selected itinerary item" className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-3.5 w-3.5" /></button></div>}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {availableSources.map((source) => <button key={`${source.sourceType}-${source.sourceId}`} type="button" onClick={() => addSource(source)} className="flex max-w-44 flex-shrink-0 items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2 text-left shadow-xs hover:border-primary/30 hover:bg-primary/5"><span className={cn("flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg", source.scheduleType === "night" ? "bg-emerald-500/10 text-emerald-600" : source.sourceType === "flight" ? "bg-sky-500/10 text-sky-600" : "bg-primary/10 text-primary")}>{source.scheduleType === "night" ? <BedDouble className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}</span><span className="min-w-0"><span className="block truncate text-xs font-medium text-foreground">{source.title}</span><span className="block text-[9px] text-muted-foreground">{source.scheduleType === "night" ? "Overnight" : source.defaultTime ? formatTime(source.defaultTime) : formatTime(selectedTime)}</span></span></button>)}
                      {availableSources.length === 0 && <p className="py-2 text-xs text-muted-foreground">Everything is already on your itinerary.</p>}
                    </div>
                    <form onSubmit={(event) => { event.preventDefault(); addFreeform(); }} className="mt-2 flex min-w-0 gap-2"><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Add a meal, walk, reservation…" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary" /><button type="submit" disabled={!newTitle.trim()} className="flex-shrink-0 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40">Add</button></form>
                    {error && <div role="alert" className="mt-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive">{error}</div>}
                  </section>

                  <footer className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-card px-4 py-2.5"><span className="text-xs text-muted-foreground">{isDirty ? "Unsaved changes" : `${scheduledCount} items scheduled`}</span><div className="flex items-center gap-2">{isDirty && <button type="button" onClick={() => setDrafts(savedDrafts)} className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">Reset</button>}<button type="button" onClick={() => void save()} disabled={saving || !isDirty} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm disabled:opacity-40">{saving && <Loader2 className="h-3 w-3 animate-spin" />}Save itinerary</button></div></footer>
                </>
              )}
            </div>
          </aside>
        </>,
        document.body,
      )}
    </>
  );
}
