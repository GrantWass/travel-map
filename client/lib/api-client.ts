import type {
  AddActivityPayload,
  AddLodgingPayload,
  CreateTripPayload,
  UpdateTripPayload,
  SessionResponse,
  User,
  Trip,
  UserProfileResponse,
} from "@/lib/api-types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";
const AUTH_TOKEN_KEY = "travel-map.auth-token.v1";

function readAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!token) {
      window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
      return;
    }

    window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // Ignore storage failures.
  }
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const authToken = readAuthToken();
  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
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
  return requestJson<{ message: string; user: User }>("/profile/update", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getTrips(): Promise<Trip[]> {
  const data = await requestJson<{ trips: Trip[] }>("/trips", { method: "GET" });
  return data.trips;
}

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=1200&q=80";

export async function getTrip(tripId: number): Promise<Trip> {
  const data = await requestJson<{ trip: Trip }>(`/trips/${tripId}`, { method: "GET" });

  const trip = {
    ...data.trip,
    description: data.trip.description || "No trip description yet.",
    thumbnail_url: data.trip.thumbnail_url || PLACEHOLDER_IMAGE,
  };
  return trip;

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

export async function updateTrip(tripId: number, payload: UpdateTripPayload): Promise<Trip> {
  const data = await requestJson<{ trip: Trip }>(`/trips/${tripId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return data.trip;
}

export async function getTripRaw(tripId: number): Promise<Trip> {
  const data = await requestJson<{ trip: Trip }>(`/trips/${tripId}`, { method: "GET" });
  return data.trip;
}

export async function uploadImage(file: File, folder = "trips"): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const headers = new Headers();
  const authToken = readAuthToken();
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(`${API_BASE_URL}/uploads/images`, {
    method: "POST",
    credentials: "include",
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

export async function markOnboardingComplete(stepIds: string[]): Promise<void> {
  await requestJson<{ message: string }>("/users/me/onboarding", {
    method: "PATCH",
    body: JSON.stringify({ completed_step_ids: stepIds }),
  });
}

export async function getUserProfile(userId: number): Promise<UserProfileResponse> {
  return requestJson<UserProfileResponse>(`/users/${userId}/profile`, { method: "GET" });
}

export async function createSmsInvite(phoneNumber: string) {
  return requestJson<{ message: string; invite: any }>("/sms-invites", {
    method: "POST",
    body: JSON.stringify({ phone_number: phoneNumber }),
  });
}

export async function claimSmsInvite(inviteToken: string) {
  return requestJson<{ message: string; invite: any }>("/sms-invites/claim", {
    method: "POST",
    body: JSON.stringify({ invite_token: inviteToken }),
  });
}

export async function createFriendRequest(addresseeId: number) {
  return requestJson<{ message: string; friendship: any }>("/friendships", {
    method: "POST",
    body: JSON.stringify({ addressee_id: addresseeId }),
  });
}

export async function respondFriendRequest(friendshipId: number, status: "accepted" | "declined" | "pending") {
  return requestJson<{ message: string; friendship: any }>(`/friendships/${friendshipId}/respond`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export async function getFriendships() {
  return requestJson<{ incoming: any[]; outgoing: any[]; accepted: any[] }>("/friendships", { method: "GET" });
}

export async function searchUsers(q: string) {
  const params = new URLSearchParams();
  params.set("q", q);
  return requestJson<{ users: { user_id: number; name: string; profile_image_url?: string; bio?: string }[] }>(`/users/search?${params.toString()}`, { method: "GET" });
}

export function toUserProfileFromApi(profileResponse: UserProfileResponse): User {
  const initials = profileResponse.user.name || ""
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  const user = {
      user_id: profileResponse.user.user_id,
      name: profileResponse.user.name || "Traveler", 
      email: profileResponse.user.email,
      bio: profileResponse.user.bio || "Traveler sharing experiences from the road.",
      verified: profileResponse.user.verified,
      college: profileResponse.user.college || "—",
      profile_image_url: profileResponse.user.profile_image_url,
      trips: profileResponse.trips || null,
      initials: initials,
  };

  return user;
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
