import type {
  AddActivityPayload,
  AddLodgingPayload,
  CreateTripPayload,
  SessionResponse,
  Trip,
  UserProfileResponse,
} from "@/lib/api-types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
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

export async function getTrips(): Promise<Trip[]> {
  const data = await requestJson<{ trips: Trip[] }>("/trips", { method: "GET" });
  return data.trips;
}

export async function getTrip(tripId: number): Promise<Trip> {
  const data = await requestJson<{ trip: Trip }>(`/trips/${tripId}`, { method: "GET" });
  return data.trip;
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

export async function uploadImage(file: File, folder = "trips"): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const response = await fetch(`${API_BASE_URL}/uploads/images`, {
    method: "POST",
    credentials: "include",
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

export async function addTripLodging(tripId: number, payload: AddLodgingPayload) {
  return requestJson<{ message: string }>(`/trips/${tripId}/lodgings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addTripActivity(tripId: number, payload: AddActivityPayload) {
  return requestJson<{ message: string }>(`/trips/${tripId}/activities`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteTrip(tripId: number) {
  return requestJson<{ message: string }>(`/trips/${tripId}`, {
    method: "DELETE",
  });
}

export async function getUserProfile(userId: number): Promise<UserProfileResponse> {
  return requestJson<UserProfileResponse>(`/users/${userId}/profile`, { method: "GET" });
}

export interface SavedPlans {
  saved_activity_ids: number[];
  saved_lodging_ids: number[];
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

export { ApiError };
