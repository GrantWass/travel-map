export type TripVisibility = "public" | "private" | "friends";
export type TripDuration = "multiday trip" | "day trip" | "overnight trip";

export interface User {
  user_id: number;
  name: string | null;
  email: string;
  bio: string | null;
  verified: boolean;
  college: string | null;
  profile_image_url: string | null;
  trips: Trip[] | null;
  initials: string;
}
export interface SessionResponse {
  authenticated: boolean;
  user?: User;
}

export interface TripComment {
  comment_id: number;
  user_id: number;
  trip_id: number;
  body: string;
  created_at: string | null;
  user_name: string | null;
}

export interface TripLodging {
  lodge_id: number;
  trip_id: number;
  address: string | null;
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  cost: number | null;
}

export interface TripActivity {
  activity_id: number;
  trip_id: number;
  address: string | null;
  thumbnail_url: string | null;
  title: string | null;
  location: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  cost: number | null;
}

export interface Trip {
  trip_id: number;
  thumbnail_url: string;
  title: string;
  description: string | null;
  latitude: number;
  longitude: number;
  cost: number | null;
  duration: string | null;
  date: string | null;
  visibility: TripVisibility;
  owner_user_id: number;
  owner: User;
  tags: string[];
  lodgings: TripLodging[];
  activities: TripActivity[];
  comments: TripComment[];
  event_start?: string | null;
  event_end?: string | null;
}


export interface UserProfileResponse {
  user: User;
  trips: Trip[];
}

export interface CreateTripPayload {
  thumbnail_url?: string;
  title: string;
  description?: string;
  latitude?: string;
  longitude?: string;
  cost?: string;
  duration?: TripDuration;
  date?: string;
  visibility?: TripVisibility;
  tags?: string[];
  event_start?: string;
  event_end?: string;
  lodgings?: Array<{
    address?: string;
    thumbnail_url?: string;
    title?: string;
    description?: string;
    latitude?: string;
    longitude?: string;
    cost?: string;
  }>;
  activities?: Array<{
    address?: string;
    thumbnail_url?: string;
    title?: string;
    location?: string;
    description?: string;
    latitude?: string;
    longitude?: string;
    cost?: string;
  }>;
}

export type UpdateTripPayload = CreateTripPayload;

export interface AddLodgingPayload {
  address?: string;
  thumbnail_url?: string;
  title: string;
  description?: string;
  latitude?: string;
  longitude?: string;
  cost?: string;
}

export interface AddActivityPayload {
  address?: string;
  thumbnail_url?: string;
  title: string;
  location?: string;
  description?: string;
  latitude?: string;
  longitude?: string;
  cost?: string;
}
