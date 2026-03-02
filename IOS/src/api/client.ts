import { PLACEHOLDER_TRIP_IMAGE } from "@/src/constants/trip";
import { toDisplayDate } from "@/src/utils/date";
import { readAuthToken } from "@/src/api/auth-token";
import type {
  CreateTripPayload,
  SavedPlans,
  SessionResponse,
  SessionUser,
  Trip,
  UserProfileResponse,
} from "@/src/types/api";

const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:5001";
export const API_BASE_URL = rawApiBaseUrl.endsWith("/")
  ? rawApiBaseUrl.slice(0, -1)
  : rawApiBaseUrl;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function normalizeHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = normalizeHeaders(init);
  const authToken = await readAuthToken();
  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.message === "string"
          ? payload.message
          : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export async function createUser(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<{ auth_token?: string; user_id: number }> {
  return requestJson<{ auth_token?: string; user_id: number }>("/create-user", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<{ auth_token?: string; user: SessionUser }> {
  return requestJson<{ auth_token?: string; user: SessionUser }>("/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSession(): Promise<SessionResponse> {
  try {
    return await requestJson<SessionResponse>("/me", { method: "GET" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { authenticated: false };
    }
    throw error;
  }
}

export async function logoutSession(): Promise<void> {
  await requestJson<{ message: string }>("/logout", { method: "POST" });
}

export async function createProfileSetup(payload: {
  account_type: "student" | "traveler";
  bio?: string;
  college?: string;
  profile_image_url?: string;
}) {
  return requestJson<{ message: string }>("/profile/setup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProfileSettings(payload: {
  name?: string;
  bio?: string;
  college?: string;
  profile_image_url?: string;
}) {
  return requestJson<{ message: string; user: SessionUser }>("/profile/update", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getTrips(): Promise<Trip[]> {
  const data = await requestJson<{ trips: Trip[] }>("/trips", { method: "GET" });
  return data.trips;
}

export async function getTrip(tripId: number): Promise<Trip> {
  const data = await requestJson<{ trip: Trip }>(`/trips/${tripId}`, { method: "GET" });
  return {
    ...data.trip,
    date: toDisplayDate(data.trip.date),
    description: data.trip.description || "No trip description yet.",
    thumbnail_url: data.trip.thumbnail_url || PLACEHOLDER_TRIP_IMAGE,
  };
}

export async function getMyTrips(): Promise<Trip[]> {
  const data = await requestJson<{ trips: Trip[] }>("/users/me/trips", { method: "GET" });
  return data.trips;
}

export async function createTrip(payload: CreateTripPayload): Promise<Trip> {
  const data = await requestJson<{ trip: Trip }>("/trips", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.trip;
}

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  return "image/jpeg";
}

function guessFilename(uri: string): string {
  const parts = uri.split("/");
  const candidate = parts[parts.length - 1];
  if (candidate && candidate.includes(".")) {
    return candidate;
  }
  return `upload-${Date.now()}.jpg`;
}

export async function uploadImageFromUri(uri: string, folder = "trips"): Promise<string> {
  const authToken = await readAuthToken();
  const formData = new FormData();
  formData.append("folder", folder);
  formData.append("file", {
    uri,
    name: guessFilename(uri),
    type: guessMimeType(uri),
  } as any);

  const headers = new Headers();
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(`${API_BASE_URL}/uploads/images`, {
    method: "POST",
    headers,
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.message === "string"
          ? payload.message
          : `Upload failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  if (typeof payload?.url !== "string" || !payload.url.trim()) {
    throw new ApiError("Upload response did not include image URL", 500);
  }

  return payload.url;
}

export async function deleteTrip(tripId: number): Promise<void> {
  await requestJson<{ message: string }>(`/trips/${tripId}`, { method: "DELETE" });
}

export async function getUserProfile(userId: number): Promise<UserProfileResponse> {
  return requestJson<UserProfileResponse>(`/users/${userId}/profile`, { method: "GET" });
}

export async function getSavedPlans(): Promise<SavedPlans> {
  return requestJson<SavedPlans>("/users/me/plans", { method: "GET" });
}

export async function toggleSavedActivity(activityId: number): Promise<SavedPlans> {
  return requestJson<SavedPlans>(`/users/me/plans/activities/${activityId}`, { method: "POST" });
}

export async function toggleSavedLodging(lodgeId: number): Promise<SavedPlans> {
  return requestJson<SavedPlans>(`/users/me/plans/lodgings/${lodgeId}`, { method: "POST" });
}
