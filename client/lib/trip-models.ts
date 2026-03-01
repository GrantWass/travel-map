import type { Trip, TripActivity, UserProfileResponse } from "@/lib/api-types";

export interface MapActivity {
  id: number;
  title: string;
  description: string;
  image: string;
  address: string;
  lat: number;
  lng: number;
}

export interface MapLodging {
  id: number;
  title: string;
  description: string;
  image: string;
  address: string;
  lat: number;
  lng: number;
}

export interface SavedActivityEntry {
  tripId: number;
  tripTitle: string;
  tripThumbnail: string;
  activity: MapActivity;
}

export interface SavedLodgingEntry {
  tripId: number;
  tripTitle: string;
  tripThumbnail: string;
  lodging: MapLodging;
}

export interface MapTrip {
  id: number;
  title: string;
  thumbnail: string;
  author: string;
  date: string;
  lat: number;
  lng: number;
  summary: string;
  description: string;
  ownerUserId: number;
  ownerVerified: boolean;
  ownerCollege: string;
  ownerBio: string;
  tags: string[];
  cost: number | null;
  lodgings: MapLodging[];
  activities: MapActivity[];
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

function toDisplayDate(dateValue: string | null | undefined): string {
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


function firstSentence(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "No summary yet.";
  }

  const periodIndex = normalized.indexOf(".");
  if (periodIndex > 0) {
    return normalized.slice(0, periodIndex + 1);
  }

  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177)}...`;
}

function toActivity(activity: TripActivity): MapActivity | null {
  if (activity.latitude === null || activity.longitude === null) {
    return null;
  }

  return {
    id: activity.activity_id,
    title: activity.title || "Untitled activity",
    description: activity.description || "No description yet.",
    image: activity.thumbnail_url || PLACEHOLDER_IMAGE,
    address: activity.address || activity.location || "Location not provided",
    lat: activity.latitude,
    lng: activity.longitude,
  };
}

function toLodging(lodging: Trip["lodgings"][number]): MapLodging | null {
  if (lodging.latitude === null || lodging.longitude === null) {
    return null;
  }

  return {
    id: lodging.lodge_id,
    title: lodging.title || "Untitled lodging",
    description: lodging.description || "No description yet.",
    image: lodging.thumbnail_url || PLACEHOLDER_IMAGE,
    address: lodging.address || "Location not provided",
    lat: lodging.latitude,
    lng: lodging.longitude,
  };
}

export function toMapTrip(trip: Trip): MapTrip | null {
  if (trip.latitude === null || trip.longitude === null) {
    return null;
  }

  const description = (trip.description || "").trim();
  const lodgings = (trip.lodgings || [])
    .map(toLodging)
    .filter((item): item is MapLodging => item !== null);
  const activities = trip.activities
    .map(toActivity)
    .filter((activity): activity is MapActivity => activity !== null);

  return {
    id: trip.trip_id,
    title: trip.title,
    thumbnail: trip.thumbnail_url || PLACEHOLDER_IMAGE,
    author: trip.owner.name || "Unknown traveler",
    date: toDisplayDate(trip.date),
    lat: trip.latitude,
    lng: trip.longitude,
    summary: firstSentence(description || trip.title),
    description: description || "No trip description yet.",
    ownerUserId: trip.owner_user_id,
    ownerVerified: trip.owner.verified,
    ownerCollege: trip.owner.college || "—",
    ownerBio: trip.owner.bio || "Traveler sharing experiences from the road.",
    tags: trip.tags ?? [],
    cost: trip.cost ?? null,
    lodgings,
    activities,
  };
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
