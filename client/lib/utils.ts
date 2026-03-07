import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { TripDuration } from './api-types'

const TRIP_DURATION_LABELS: Record<TripDuration, string> = {
  "day trip": "Day Trip",
  "overnight trip": "Overnight Trip",
  "multiday trip": "Multi-Day Trip",
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function initialsFromName(value: string): string {
    const initials = value
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("")
        .slice(0, 2);
    return initials || "TR";
}

export function formatTripDate(value: string): string {
    const trimmed = value.trim();
    const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(trimmed);
    if (!match) {
        return value;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || month < 1 || month > 12) {
        return value;
    }

    const date = new Date(Date.UTC(year, month - 1, 1));
    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
}

export function formatPopupTimeRange(startIso: string, endIso: string): string {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Time unavailable";

    const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };
    const startTime = start.toLocaleTimeString("en-US", timeOpts);
    const endTime = end.toLocaleTimeString("en-US", timeOpts);

    const now = new Date();
    const isToday = start.toDateString() === now.toDateString();
    if (isToday) return `Today · ${startTime} – ${endTime}`;

    const dateStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${dateStr} · ${startTime} – ${endTime}`;
}

export function formatTripDuration(value: string | null | undefined): string {
  if (!value) {
    return "Duration Flexible"
  }

  const normalized = value.trim().toLowerCase() as TripDuration
  if (normalized in TRIP_DURATION_LABELS) {
    return TRIP_DURATION_LABELS[normalized]
  }

  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function getLocationKey(lat: number, lng: number): string {
    return `${lat.toFixed(6)}:${lng.toFixed(6)}`;
}

export function getTripTimestamp(dateValue: string): number {
    const timestamp = Date.parse(dateValue);
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function toDisplayDate(dateValue: string | null | undefined): string {
  if (!dateValue) {
    return "No date";
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}