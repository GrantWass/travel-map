export type TripVisibility = "public" | "private" | "friends";
export type TripDuration = "multiday trip" | "day trip" | "overnight trip";

export interface SessionUser {
  user_id: number;
  name: string | null;
  email: string;
  bio: string | null;
  verified: boolean;
  college: string | null;
  profile_image_url: string | null;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: SessionUser;
}

export interface TripOwner {
  user_id: number;
  name: string | null;
  bio: string | null;
  verified: boolean;
  college: string | null;
  profile_image_url: string | null;
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
  thumbnail_url: string | null;
  title: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  cost: number | null;
  duration: string | null;
  date: string | null;
  visibility: TripVisibility;
  owner_user_id: number;
  owner: TripOwner;
  tags: string[];
  lodgings: TripLodging[];
  activities: TripActivity[];
  comments: TripComment[];
}

export interface UserTripEntry {
  trip_id: number;
  title: string;
  thumbnail_url: string | null;
  date: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface UserProfileResponse {
  user: SessionUser;
  trips: UserTripEntry[];
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
