import type { Trip, TripLodging, TripActivity, UserProfileResponse } from "@/lib/api-types";

export interface SavedActivityEntry {
  tripId: number;
  tripTitle: string;
  tripThumbnail: string;
  activity: TripActivity;
}

export interface SavedLodgingEntry {
  tripId: number;
  tripTitle: string;
  tripThumbnail: string;
  lodging: TripLodging;
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



