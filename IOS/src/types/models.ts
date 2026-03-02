import type { TripActivity, TripLodging, UserProfileResponse } from "@/src/types/api";
import { PLACEHOLDER_TRIP_IMAGE } from "@/src/constants/trip";
import { toDisplayDate } from "@/src/utils/date";

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
    university: profile.user.college || "-",
    bio: profile.user.bio || "Traveler sharing experiences from the road.",
    image_url: profile.user.profile_image_url,
    trips: profile.trips.map((trip) => ({
      id: trip.trip_id,
      title: trip.title,
      thumbnail: trip.thumbnail_url || PLACEHOLDER_TRIP_IMAGE,
      date: toDisplayDate(trip.date),
    })),
  };
}
