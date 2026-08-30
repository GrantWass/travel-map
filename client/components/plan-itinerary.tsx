"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoveVertical,
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
  endTime: string | null;
}

interface PlanItineraryProps {
  collectionName: string;
  sources: PlanItinerarySource[];
}

const HOUR_HEIGHT = 44;

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

function timeToMinutes(value: string | null, fallback = 9 * 60) {
  if (!value) return fallback;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(value: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 45, value));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function daysInclusive(start: string, end: string) {
  return Math.round((parseIsoDay(end).getTime() - parseIsoDay(start).getTime()) / 86_400_000) + 1;
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
  const [startDate, setStartDate] = useState(() => isoDay(new Date()));
  const [endDate, setEndDate] = useState(() => isoDay(addDays(new Date(), 6)));
  const [savedStartDate, setSavedStartDate] = useState(startDate);
  const [savedEndDate, setSavedEndDate] = useState(endDate);
  const [showWeekTimeline, setShowWeekTimeline] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dragMoved = useRef(false);
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
      .then((itinerary) => {
        const mapped = itinerary.items.map((item) => ({
          key: `db-${item.plan_itinerary_item_id}`,
          dayDate: item.day_date,
          sourceType: item.source_type,
          sourceId: item.source_id,
          title: item.title,
          scheduleType: item.schedule_type,
          startTime: item.start_time?.slice(0, 5) ?? null,
          endTime: item.end_time?.slice(0, 5) ?? null,
        }));
        const firstScheduledDay = mapped.find((item) => item.dayDate)?.dayDate;
        const lastScheduledDay = [...mapped].reverse().find((item) => item.dayDate)?.dayDate;
        const nextStart = itinerary.start_date ?? firstScheduledDay ?? isoDay(new Date());
        const nextEnd = itinerary.end_date ?? lastScheduledDay ?? isoDay(addDays(parseIsoDay(nextStart), 6));
        setStartDate(nextStart);
        setEndDate(nextEnd);
        setSavedStartDate(nextStart);
        setSavedEndDate(nextEnd);
        setDrafts(mapped);
        setSavedDrafts(mapped);
        setWeekStart(daysInclusive(nextStart, nextEnd) <= 7 ? parseIsoDay(nextStart) : startOfWeek(parseIsoDay(nextStart)));
        setSelectedDay(firstScheduledDay ?? nextStart);
        setShowWeekTimeline(daysInclusive(nextStart, nextEnd) <= 7);
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
  const isDirty = JSON.stringify(drafts) !== JSON.stringify(savedDrafts)
    || startDate !== savedStartDate || endDate !== savedEndDate;
  const tripLength = startDate && endDate && endDate >= startDate ? daysInclusive(startDate, endDate) : 0;
  const isLongTrip = tripLength > 7;

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return date;
    }),
    [weekStart],
  );
  const tripWeeks = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return [];
    const weeks: Array<{ start: Date; end: Date; itemCount: number }> = [];
    let cursor = startOfWeek(parseIsoDay(startDate));
    const tripEnd = parseIsoDay(endDate);
    while (cursor <= tripEnd) {
      const rawEnd = addDays(cursor, 6);
      const visibleStart = cursor < parseIsoDay(startDate) ? parseIsoDay(startDate) : cursor;
      const visibleEnd = rawEnd > tripEnd ? tripEnd : rawEnd;
      const rangeStart = isoDay(visibleStart);
      const rangeEnd = isoDay(visibleEnd);
      weeks.push({
        start: new Date(cursor),
        end: rawEnd,
        itemCount: drafts.filter((item) => item.dayDate && item.dayDate >= rangeStart && item.dayDate <= rangeEnd).length,
      });
      cursor = addDays(cursor, 7);
    }
    return weeks;
  }, [drafts, endDate, startDate]);
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
      endTime: source.scheduleType === "time" ? minutesToTime(timeToMinutes(source.defaultTime ?? selectedTime) + 60) : null,
    }]);
  }

  function addFreeform() {
    const title = newTitle.trim();
    if (!title) return;
    setDrafts((current) => [...current, {
      key: nextKey(), dayDate: selectedDay, sourceType: null, sourceId: null, title,
      scheduleType: "time", startTime: selectedTime,
      endTime: minutesToTime(timeToMinutes(selectedTime) + 60),
    }]);
    setNewTitle("");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!startDate || !endDate || endDate < startDate) {
        setDateError("Choose an end date on or after the start date.");
        return;
      }
      setDateError(null);
      const itinerary = await savePlanItinerary(collectionName, drafts.map((item) => ({
        day_date: item.dayDate,
        source_type: item.sourceType,
        source_id: item.sourceId,
        title: item.title,
        schedule_type: item.scheduleType,
        start_time: item.startTime,
        end_time: item.endTime,
      })), startDate, endDate);
      const mapped = itinerary.items.map((item) => ({
        key: `db-${item.plan_itinerary_item_id}`,
        dayDate: item.day_date,
        sourceType: item.source_type,
        sourceId: item.source_id,
        title: item.title,
        scheduleType: item.schedule_type,
        startTime: item.start_time?.slice(0, 5) ?? null,
        endTime: item.end_time?.slice(0, 5) ?? null,
      }));
      setDrafts(mapped);
      setSavedDrafts(mapped);
      setSavedStartDate(itinerary.start_date ?? startDate);
      setSavedEndDate(itinerary.end_date ?? endDate);
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

  function updateTripDates(nextStart: string, nextEnd: string) {
    setStartDate(nextStart);
    setEndDate(nextEnd);
    if (!nextStart || !nextEnd || nextEnd < nextStart) {
      setDateError("Choose an end date on or after the start date.");
      return;
    }
    setDateError(null);
    setWeekStart(daysInclusive(nextStart, nextEnd) <= 7 ? parseIsoDay(nextStart) : startOfWeek(parseIsoDay(nextStart)));
    setSelectedDay(nextStart);
    setShowWeekTimeline(daysInclusive(nextStart, nextEnd) <= 7);
  }

  function resizeTime(item: Draft, edge: "start" | "end", event: ReactPointerEvent<HTMLElement>) {
    if (item.scheduleType !== "time") return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const originY = event.clientY;
    const originalStart = timeToMinutes(item.startTime);
    const originalEnd = timeToMinutes(item.endTime, Math.min(originalStart + 60, 23 * 60 + 45));
    const onMove = (moveEvent: PointerEvent) => {
      const delta = Math.round((((moveEvent.clientY - originY) / HOUR_HEIGHT) * 60) / 15) * 15;
      setDrafts((current) => current.map((draft) => {
        if (draft.key !== item.key) return draft;
        if (edge === "start") {
          return { ...draft, startTime: minutesToTime(Math.min(originalEnd - 15, Math.max(0, originalStart + delta))) };
        }
        return { ...draft, endTime: minutesToTime(Math.max(originalStart + 15, Math.min(23 * 60 + 45, originalEnd + delta))) };
      }));
    };
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  function moveTime(item: Draft, event: ReactPointerEvent<HTMLElement>) {
    if (item.scheduleType !== "time") return;
    event.preventDefault();
    const originX = event.clientX;
    const originY = event.clientY;
    const duration = Math.max(15, timeToMinutes(item.endTime, timeToMinutes(item.startTime) + 60) - timeToMinutes(item.startTime));
    let moved = false;
    dragMoved.current = false;

    const onMove = (moveEvent: PointerEvent) => {
      if (!moved && Math.hypot(moveEvent.clientX - originX, moveEvent.clientY - originY) < 4) return;
      moved = true;
      dragMoved.current = true;
      setDraggingKey(item.key);
      const hovered = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY) as HTMLElement | null;
      const column = hovered?.closest<HTMLElement>("[data-itinerary-day]");
      const nextDay = column?.dataset.itineraryDay;
      if (!column || !nextDay || !isTripDay(nextDay)) return;
      const bounds = column.getBoundingClientRect();
      const rawMinutes = earliestScheduledHour * 60 + ((moveEvent.clientY - bounds.top) / HOUR_HEIGHT) * 60;
      const nextStart = Math.max(earliestScheduledHour * 60, Math.min(23 * 60 + 45 - duration, Math.round(rawMinutes / 15) * 15));
      setDrafts((current) => current.map((draft) => draft.key === item.key ? {
        ...draft,
        dayDate: nextDay,
        startTime: minutesToTime(nextStart),
        endTime: minutesToTime(nextStart + duration),
      } : draft));
      setSelectedDay(nextDay);
      setSelectedTime(minutesToTime(nextStart));
    };
    const onUp = () => {
      setDraggingKey(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function nudgeTime(item: Draft, edge: "start" | "end", direction: -1 | 1) {
    const start = timeToMinutes(item.startTime);
    const end = timeToMinutes(item.endTime, Math.min(start + 60, 23 * 60 + 45));
    setDrafts((current) => current.map((draft) => {
      if (draft.key !== item.key) return draft;
      return edge === "start"
        ? { ...draft, startTime: minutesToTime(Math.min(end - 15, Math.max(0, start + direction * 15))) }
        : { ...draft, endTime: minutesToTime(Math.max(start + 15, Math.min(23 * 60 + 45, end + direction * 15))) };
    }));
  }

  function isTripDay(value: string) {
    return Boolean(startDate && endDate && value >= startDate && value <= endDate);
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
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{collectionName}</p><p className="text-xs text-muted-foreground">{isLongTrip && !showWeekTimeline ? `${tripLength}-day trip · choose a week` : weekLabel}</p></div>
                {isLongTrip && showWeekTimeline && <button type="button" onClick={() => setShowWeekTimeline(false)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">All weeks</button>}
                {isLongTrip && showWeekTimeline && <>
                  <button type="button" onClick={() => shiftWeek(-1)} aria-label="Previous week" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" onClick={() => shiftWeek(1)} aria-label="Next week" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
                </>}
                <button type="button" onClick={closePanel} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close itinerary panel"><X className="h-4 w-4" /></button>
              </header>

              <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-card px-4 py-2">
                <label className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Start<input type="date" value={startDate} onChange={(event) => updateTripDates(event.target.value, endDate)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-foreground" /></label>
                <span className="text-muted-foreground">–</span>
                <label className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">End<input type="date" value={endDate} min={startDate} onChange={(event) => updateTripDates(startDate, event.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-foreground" /></label>
                {tripLength > 0 && <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-medium text-muted-foreground">{tripLength} {tripLength === 1 ? "day" : "days"}</span>}
                {dateError && <span role="alert" className="text-xs text-destructive">{dateError}</span>}
              </div>

              {loading ? (
                <div className="flex min-h-0 flex-1 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  {isLongTrip && !showWeekTimeline ? (
                    <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-background/40 p-4">
                      <div className="mx-auto max-w-2xl">
                        <div className="mb-4"><h3 className="text-base font-semibold text-foreground">Plan one week at a time</h3><p className="mt-1 text-xs text-muted-foreground">Choose a week to add activities and fine-tune start and end times.</p></div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {tripWeeks.map((week, index) => {
                            const visibleStart = week.start < parseIsoDay(startDate) ? parseIsoDay(startDate) : week.start;
                            const visibleEnd = week.end > parseIsoDay(endDate) ? parseIsoDay(endDate) : week.end;
                            return <button key={isoDay(week.start)} type="button" onClick={() => { setWeekStart(week.start); setSelectedDay(isoDay(visibleStart)); setShowWeekTimeline(true); }} className="group rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/35 hover:shadow-md"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Week {index + 1}</span><span className="mt-1 block text-sm font-semibold text-foreground">{visibleStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {visibleEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span><span className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>{week.itemCount ? `${week.itemCount} scheduled` : "Nothing scheduled yet"}</span><ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span></button>;
                          })}
                        </div>
                      </div>
                    </div>
                  ) : <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-background/40">
                    <div className="min-w-[650px]">
                      <div className="sticky top-0 z-30 grid grid-cols-[54px_repeat(7,minmax(84px,1fr))] border-b border-border bg-card/95 backdrop-blur">
                        <span />
                        {weekDays.map((date) => {
                          const iso = isoDay(date);
                          const isToday = iso === isoDay(new Date());
                          const inTrip = isTripDay(iso);
                          return <button key={iso} type="button" disabled={!inTrip} onClick={() => setSelectedDay(iso)} className={cn("flex flex-col items-center border-l border-border/60 py-2 text-muted-foreground hover:bg-secondary/60", selectedDay === iso && "bg-primary/5 text-primary", !inTrip && "cursor-not-allowed bg-secondary/30 opacity-35 hover:bg-secondary/30")}><span className="text-[10px] font-semibold uppercase tracking-wide">{date.toLocaleDateString("en-US", { weekday: "short" })}</span><span className={cn("mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", isToday && inTrip && "bg-primary text-primary-foreground")}>{date.getDate()}</span></button>;
                        })}
                        <span className="flex items-center justify-end border-t border-border/60 pr-2 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Night</span>
                        {weekDays.map((date) => {
                          const iso = isoDay(date);
                          const inTrip = isTripDay(iso);
                          const stays = inTrip ? staysByDay.get(iso) ?? [] : [];
                          return <div key={`night-${iso}`} className={cn("relative min-h-10 border-l border-t border-border/60 bg-emerald-500/[0.04] p-1", !inTrip && "bg-secondary/30 opacity-35")}><button type="button" disabled={!inTrip} onClick={() => { setSelectedDay(iso); setSelectedDraftKey(null); }} className="absolute inset-0" aria-label={`Select night of ${formatDay(iso)}`} />{stays.map((item) => { const source = sourceMap.get(sourceKey(item.sourceType, item.sourceId) ?? ""); return <button key={item.key} type="button" onClick={() => { setSelectedDay(iso); setSelectedDraftKey(item.key); }} className="relative block w-full truncate rounded-md bg-emerald-500 px-1.5 py-1 text-left text-[10px] font-medium text-white shadow-sm" title={source?.title ?? item.title ?? "Stay"}>{source?.title ?? item.title}</button>; })}</div>;
                        })}
                      </div>

                      <div className="grid grid-cols-[54px_repeat(7,minmax(84px,1fr))]">
                        <div className="relative" style={{ height: hourRows.length * HOUR_HEIGHT }}>
                          {hourRows.map((hour, index) => <span key={hour} className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: index * HOUR_HEIGHT }}>{formatHour(hour)}</span>)}
                        </div>
                        {weekDays.map((date) => {
                          const iso = isoDay(date);
                          const inTrip = isTripDay(iso);
                          const items = inTrip ? timedItemsByDay.get(iso) ?? [] : [];
                          const isToday = iso === isoDay(new Date());
                          const now = new Date();
                          const nowMinutes = now.getHours() * 60 + now.getMinutes() - earliestScheduledHour * 60;
                          return (
                            <div
                              key={`timeline-${iso}`}
                              data-itinerary-day={iso}
                              className={cn("relative border-l border-border/60", selectedDay === iso && "bg-primary/[0.025]", !inTrip && "cursor-not-allowed bg-secondary/30 opacity-35")}
                              style={{ height: hourRows.length * HOUR_HEIGHT }}
                              onClick={(event) => {
                                if (!inTrip) return;
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
                              {inTrip && selectedDay === iso && selectedTimeTop >= 0 && <span className="pointer-events-none absolute inset-x-1 z-10 border-t-2 border-primary/60" style={{ top: selectedTimeTop }}><span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-primary" /></span>}
                              {inTrip && isToday && nowMinutes >= 0 && nowMinutes <= hourRows.length * 60 && <span className="pointer-events-none absolute inset-x-0 z-20 border-t border-red-500" style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}><span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" /></span>}
                              {items.map((item) => {
                                const source = sourceMap.get(sourceKey(item.sourceType, item.sourceId) ?? "");
                                const [hour, minute] = (item.startTime ?? "09:00").split(":").map(Number);
                                const top = (((hour * 60 + minute) - earliestScheduledHour * 60) / 60) * HOUR_HEIGHT;
                                const durationMinutes = Math.max(15, timeToMinutes(item.endTime, hour * 60 + minute + 60) - (hour * 60 + minute));
                                const height = Math.max(26, (durationMinutes / 60) * HOUR_HEIGHT);
                                const isFlight = item.sourceType === "flight";
                                return <button key={item.key} type="button" onPointerDown={(event) => moveTime(item, event)} onClick={(event) => { event.stopPropagation(); if (dragMoved.current) { dragMoved.current = false; return; } setSelectedDay(iso); setSelectedTime(item.startTime ?? "09:00"); setSelectedDraftKey(item.key); }} className={cn("absolute left-1 right-1 z-10 cursor-grab touch-none overflow-visible rounded-md border-l-[3px] px-1.5 py-1 text-left shadow-sm transition hover:brightness-95 active:cursor-grabbing", isFlight ? "border-sky-600 bg-sky-500/90 text-white" : "border-primary bg-primary/90 text-primary-foreground", selectedDraftKey === item.key && "ring-2 ring-foreground/40 ring-offset-1", draggingKey === item.key && "z-30 scale-[1.02] opacity-80 shadow-lg")} style={{ top: Math.max(0, top), height }} title={`Drag to reschedule · ${formatTime(item.startTime)}–${formatTime(item.endTime)} ${source?.title ?? item.title ?? "Item"}`}>
                                  <span role="slider" tabIndex={0} aria-label={`Adjust start time for ${source?.title ?? item.title ?? "activity"}`} aria-valuemin={0} aria-valuemax={timeToMinutes(item.endTime) - 15} aria-valuenow={timeToMinutes(item.startTime)} aria-valuetext={formatTime(item.startTime)} onPointerDown={(event) => resizeTime(item, "start", event)} onKeyDown={(event) => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); event.stopPropagation(); nudgeTime(item, "start", event.key === "ArrowUp" ? -1 : 1); } }} className="absolute inset-x-1 -top-1.5 flex h-3 cursor-ns-resize touch-none items-center justify-center rounded-full bg-black/15 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"><MoveVertical className="h-2.5 w-2.5" /></span>
                                  <span className="block truncate text-[10px] font-semibold">{source?.title ?? item.title}</span><span className="block text-[9px] opacity-85">{formatTime(item.startTime)}–{formatTime(item.endTime)}</span>
                                  <span role="slider" tabIndex={0} aria-label={`Adjust end time for ${source?.title ?? item.title ?? "activity"}`} aria-valuemin={timeToMinutes(item.startTime) + 15} aria-valuemax={23 * 60 + 45} aria-valuenow={timeToMinutes(item.endTime, timeToMinutes(item.startTime) + 60)} aria-valuetext={formatTime(item.endTime)} onPointerDown={(event) => resizeTime(item, "end", event)} onKeyDown={(event) => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); event.stopPropagation(); nudgeTime(item, "end", event.key === "ArrowUp" ? -1 : 1); } }} className="absolute inset-x-1 -bottom-1.5 flex h-3 cursor-ns-resize touch-none items-center justify-center rounded-full bg-black/15 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"><MoveVertical className="h-2.5 w-2.5" /></span>
                                </button>;
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>}

                  {(!isLongTrip || showWeekTimeline) && <section className="flex-shrink-0 border-t border-border bg-card px-4 py-3">
                    <div className="mb-2 flex min-w-0 items-center gap-2">
                      <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-foreground">Add to {selectedDay ? formatDay(selectedDay) : "your itinerary"}</p><p className="text-[10px] text-muted-foreground">{formatTime(selectedTime)} · choose an activity, flight, or stay</p></div>
                      {selectedDraft && <div className="flex items-center gap-1.5 rounded-lg bg-primary/5 px-2 py-1"><input type="date" min={startDate} max={endDate} value={selectedDraft.dayDate ?? ""} onChange={(event) => setDrafts((current) => current.map((item) => item.key === selectedDraft.key ? { ...item, dayDate: event.target.value || null } : item))} aria-label="Scheduled date" className="w-[116px] bg-transparent text-[10px]" />{selectedDraft.scheduleType === "time" && <><input type="time" step={900} value={selectedDraft.startTime ?? ""} onChange={(event) => setDrafts((current) => current.map((item) => item.key === selectedDraft.key ? { ...item, startTime: event.target.value || null } : item))} aria-label="Activity start time" className="w-[74px] bg-transparent text-[10px]" /><span className="text-[10px] text-muted-foreground">to</span><input type="time" step={900} value={selectedDraft.endTime ?? ""} onChange={(event) => setDrafts((current) => current.map((item) => item.key === selectedDraft.key ? { ...item, endTime: event.target.value || null } : item))} aria-label="Activity end time" className="w-[74px] bg-transparent text-[10px]" /></>}<button type="button" onClick={() => { setDrafts((current) => current.filter((item) => item.key !== selectedDraft.key)); setSelectedDraftKey(null); }} aria-label="Remove selected itinerary item" className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-3.5 w-3.5" /></button></div>}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {availableSources.map((source) => <button key={`${source.sourceType}-${source.sourceId}`} type="button" onClick={() => addSource(source)} className="flex max-w-44 flex-shrink-0 items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2 text-left shadow-xs hover:border-primary/30 hover:bg-primary/5"><span className={cn("flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg", source.scheduleType === "night" ? "bg-emerald-500/10 text-emerald-600" : source.sourceType === "flight" ? "bg-sky-500/10 text-sky-600" : "bg-primary/10 text-primary")}>{source.scheduleType === "night" ? <BedDouble className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}</span><span className="min-w-0"><span className="block truncate text-xs font-medium text-foreground">{source.title}</span><span className="block text-[9px] text-muted-foreground">{source.scheduleType === "night" ? "Overnight" : source.defaultTime ? formatTime(source.defaultTime) : formatTime(selectedTime)}</span></span></button>)}
                      {availableSources.length === 0 && <p className="py-2 text-xs text-muted-foreground">Everything is already on your itinerary.</p>}
                    </div>
                    <form onSubmit={(event) => { event.preventDefault(); addFreeform(); }} className="mt-2 flex min-w-0 gap-2"><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Add a meal, walk, reservation…" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary" /><button type="submit" disabled={!newTitle.trim()} className="flex-shrink-0 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40">Add</button></form>
                    {(error || dateError) && <div role="alert" className="mt-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive">{error || dateError}</div>}
                  </section>}

                  <footer className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-card px-4 py-2.5"><span className="text-xs text-muted-foreground">{isDirty ? "Unsaved changes" : `${scheduledCount} items scheduled`}</span><div className="flex items-center gap-2">{isDirty && <button type="button" onClick={() => { setDrafts(savedDrafts); updateTripDates(savedStartDate, savedEndDate); }} className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">Reset</button>}<button type="button" onClick={() => void save()} disabled={saving || !isDirty || Boolean(dateError)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm disabled:opacity-40">{saving && <Loader2 className="h-3 w-3 animate-spin" />}Save itinerary</button></div></footer>
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
