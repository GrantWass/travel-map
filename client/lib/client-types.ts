import type { TripLodging, TripActivity } from "@/lib/api-types";

export interface PlaceCenter {
  label: string;
  latitude: number;
  longitude: number;
}

export interface PlaceOption extends PlaceCenter {
  address: string;
}

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
