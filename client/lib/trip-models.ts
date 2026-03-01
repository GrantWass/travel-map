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

export interface ProfileTripEntry {
  id: number;
  title: string;
  thumbnail: string;
  date: string;
}

export interface ModalProfile {
  userId: number;
  name: string;
  initials: string;
  email: string;
  university: string;
  bio: string;
  image_url: string | null;
  trips: ProfileTripEntry[];
}

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=1200&q=80";

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


export function toModalProfile(profile: UserProfileResponse): ModalProfile {
  const fullName = profile.user.name || "Traveler";
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    userId: profile.user.user_id,
    name: fullName,
    initials: initials || "TR",
    email: profile.user.email,
    university: profile.user.college || "—",
    bio: profile.user.bio || "Traveler sharing experiences from the road.",
    image_url: profile.user.profile_image_url,
    trips: profile.trips.map((trip) => ({
      id: trip.trip_id,
      title: trip.title,
      thumbnail: trip.thumbnail_url || PLACEHOLDER_IMAGE,
      date: toDisplayDate(trip.date),
    })),
  };
}
