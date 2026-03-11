"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ImagePlus, MapPin, Plus, Sparkles, Timer, Trash2 } from "lucide-react";

import PlacePicker from "@/components/place-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildSignupHref, getInviteTokenFromSearch, getStoredInviteToken } from "@/lib/auth-navigation";
import { ApiError, addTripCollaborator, createTrip, getTripFull, searchUsers, updateTrip, uploadImage } from "@/lib/api-client";
import type { PlaceOption } from "@/lib/client-types";
import { AVAILABLE_TAGS, BANNER_PLACEHOLDER } from "@/lib/trip-constants";
import type { TripCollaborator, TripDuration, TripVisibility } from "@/lib/api-types";
import { formatTripDuration } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

interface StopDraft {
  id: string;
  title: string;
  notes: string;
  cost: string;
  imageUrl: string;
  imageName: string;
  imageError: string;
  isProcessingImage: boolean;
  location: PlaceOption | null;
}

function clean(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function formatPreviewDate(value: string): string {
  if (!value) {
    return "No date yet";
  }

  const monthInputMatch = /^(\d{4})-(\d{2})$/.exec(value);
  if (!monthInputMatch) {
    return value;
  }

  const [, year, month] = monthInputMatch;
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    return value;
  }

  return new Date(Number(year), monthIndex, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function toLocalDatetimeInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatEventTimePreview(start: string, end: string): string {
  if (!start || !end) return "No time set yet";

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "Invalid time";

  const now = new Date();
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };
  const startTime = startDate.toLocaleTimeString("en-US", timeOpts);
  const endTime = endDate.toLocaleTimeString("en-US", timeOpts);

  const isToday = startDate.toDateString() === now.toDateString();
  if (isToday) return `Today · ${startTime} – ${endTime}`;

  const dateStr = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${dateStr} · ${startTime} – ${endTime}`;
}

function toEventIso(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function makeStopDraft(): StopDraft {
  return {
    id: crypto.randomUUID(),
    title: "",
    notes: "",
    cost: "",
    imageUrl: "",
    imageName: "",
    imageError: "",
    isProcessingImage: false,
    location: null,
  };
}

const READABLE_INPUT_CLASS = "bg-white text-stone-900 placeholder:text-stone-500";
const READABLE_TEXTAREA_CLASS = "bg-white text-stone-900 placeholder:text-stone-500";
const MONTH_LABELS = ["January","February","March","April","May","June","July","August","September","October","November","December"] as const;
const TRIP_DURATION_OPTIONS: Array<{ value: TripDuration; label: string; hint: string }> = [
  { value: "day trip", label: "Day Trip", hint: "In and out in one day" },
  { value: "overnight trip", label: "Overnight", hint: "One night away" },
  { value: "multiday trip", label: "Multi-Day", hint: "A longer getaway" },
];

function hasStopContent(stop: StopDraft): boolean {
  return Boolean(
    stop.title.trim() ||
      stop.notes.trim() ||
      stop.cost.trim() ||
      stop.imageUrl ||
      stop.location,
  );
}

export default function TripsPage() {
  return (
    <Suspense fallback={<main className="h-screen bg-[linear-gradient(180deg,#f7efe2_0%,#f4f4ef_55%,#eef3f6_100%)]" />}>
      <TripsPageContent />
    </Suspense>
  );
}

function TripsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";
  const editTripIdParam = searchParams.get("edit");
  const editTripId = editTripIdParam ? Number(editTripIdParam) : null;
  const isEditMode = Boolean(editTripId && Number.isFinite(editTripId) && editTripId > 0);
  // In edit mode, popup-mode is determined by the fetched trip (overridden in effect below).
  const [isPopupMode, setIsPopupMode] = useState(!isEditMode && searchParams.get("mode") === "popup");
  const status = useAuthStore((state) => state.status);
  const isStudent = Boolean(useAuthStore((state) => state.user?.verified));
  const userId = useAuthStore((state) => state.user?.user_id ?? null);

  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [isLoadingEditTrip, setIsLoadingEditTrip] = useState(isEditMode);
  const [editLoadError, setEditLoadError] = useState("");
  const [collaborators, setCollaborators] = useState<TripCollaborator[]>([]);
  const [collaboratorQuery, setCollaboratorQuery] = useState("");
  const [collaboratorResults, setCollaboratorResults] = useState<Array<{ user_id: number; name: string; profile_image_url?: string; bio?: string }>>([]);
  const [isSearchingCollaborators, setIsSearchingCollaborators] = useState(false);
  const [collaboratorError, setCollaboratorError] = useState("");
  const [addingCollaboratorUserId, setAddingCollaboratorUserId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [coverImageName, setCoverImageName] = useState("");
  const [coverImageError, setCoverImageError] = useState("");
  const prefillLat = !isEditMode ? searchParams.get("lat") : null;
  const prefillLng = !isEditMode ? searchParams.get("lng") : null;
  const [tripLocation, setTripLocation] = useState<PlaceOption | null>(null);
  const [cost, setCost] = useState("");
  const [duration, setDuration] = useState<TripDuration>("multiday trip");
  const [dateMonth, setDateMonth] = useState("");
  const [dateYear, setDateYear] = useState("");
  const date = dateYear && dateMonth ? `${dateYear}-${dateMonth}` : "";
  const [visibility, setVisibility] = useState<TripVisibility>("public");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");

  // Popup-specific state
  const [eventStart, setEventStart] = useState(() => {
    if (!isPopupMode) return "";
    return toLocalDatetimeInput(new Date());
  });
  const [eventEnd, setEventEnd] = useState(() => {
    if (!isPopupMode) return "";
    const end = new Date();
    end.setHours(end.getHours() + 2);
    return toLocalDatetimeInput(end);
  });

  const [lodgings, setLodgings] = useState<StopDraft[]>([]);
  const [activities, setActivities] = useState<StopDraft[]>([]);
  const previewLodgings = lodgings.filter(hasStopContent);
  const previewActivities = activities.filter(hasStopContent);

  useEffect(() => {
    if (status === "unauthenticated") {
      const inviteToken = getInviteTokenFromSearch(new URLSearchParams(window.location.search)) ?? getStoredInviteToken();
      const nextPath = `${window.location.pathname}${window.location.search}`;
      router.replace(buildSignupHref({ nextPath, inviteToken }));
    }
    if (status === "authenticated" && !isStudent) {
      router.replace("/");
    }
  }, [isStudent, router, status]);

  useEffect(() => {
    if (!prefillLat || !prefillLng) return;
    const lat = Number(prefillLat);
    const lng = Number(prefillLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    fetch(`/api/places/reverse?lat=${lat}&lon=${lng}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => {
        if (payload?.place) {
          setTripLocation(payload.place as PlaceOption);
        } else {
          throw new Error("no place");
        }
      })
      .catch(() => {
        setTripLocation({
          label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          latitude: lat,
          longitude: lng,
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When editing, fetch the existing trip and pre-populate the form.
  useEffect(() => {
    if (!isEditMode || !editTripId || status !== "authenticated") return;

    setIsLoadingEditTrip(true);
    setEditLoadError("");

    getTripFull(editTripId)
      .then((trip) => {
        if (userId !== null && trip.owner_user_id !== userId) {
          setEditLoadError("You don't have permission to edit this trip.");
          return;
        }

        const isPopup = Boolean(trip.event_start && trip.event_end);
        setIsPopupMode(isPopup);

        setTitle(trip.title);
        setDescription(trip.description || "");
        setCoverImage(trip.thumbnail_url || "");
        setTripLocation({
          label: "Current location",
          address: "Current location",
          latitude: trip.latitude,
          longitude: trip.longitude,
        });
        setCost(trip.cost != null ? String(trip.cost) : "");
        setDuration((trip.duration as TripDuration) || "multiday trip");
        const [tripYear, tripMonth] = (trip.date || "").split("-");
        setDateYear(tripYear ?? "");
        setDateMonth(tripMonth ?? "");
        setVisibility(trip.visibility);
        setSelectedTags(trip.tags);
        setCollaborators(trip.collaborators || []);

        if (isPopup && trip.event_start && trip.event_end) {
          setEventStart(toLocalDatetimeInput(new Date(trip.event_start)));
          setEventEnd(toLocalDatetimeInput(new Date(trip.event_end)));
        }

        setLodgings(
          trip.lodgings.map((lodging) => ({
            id: crypto.randomUUID(),
            title: lodging.title || "",
            notes: lodging.description || "",
            cost: lodging.cost != null ? String(lodging.cost) : "",
            imageUrl: lodging.thumbnail_url || "",
            imageName: lodging.thumbnail_url ? "Existing image" : "",
            imageError: "",
            isProcessingImage: false,
            location:
              lodging.latitude != null && lodging.longitude != null
                ? {
                    label: lodging.address || lodging.title || "",
                    address: lodging.address || "",
                    latitude: lodging.latitude,
                    longitude: lodging.longitude,
                  }
                : null,
          })),
        );

        setActivities(
          trip.activities.map((activity) => ({
            id: crypto.randomUUID(),
            title: activity.title || "",
            notes: activity.description || "",
            cost: activity.cost != null ? String(activity.cost) : "",
            imageUrl: activity.thumbnail_url || "",
            imageName: activity.thumbnail_url ? "Existing image" : "",
            imageError: "",
            isProcessingImage: false,
            location:
              activity.latitude != null && activity.longitude != null
                ? {
                    label: activity.location || activity.address || activity.title || "",
                    address: activity.address || "",
                    latitude: activity.latitude,
                    longitude: activity.longitude,
                  }
                : null,
          })),
        );
      })
      .catch(() => {
        setEditLoadError("Could not load trip for editing. Please try again.");
      })
      .finally(() => {
        setIsLoadingEditTrip(false);
      });
    // Only run once when editTripId and auth status are ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, editTripId, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const q = collaboratorQuery.trim();
    if (!q) {
      setCollaboratorResults([]);
      setIsSearchingCollaborators(false);
      return;
    }

    setCollaboratorError("");
    setIsSearchingCollaborators(true);
    const timeoutId = window.setTimeout(() => {
      void searchUsers(q)
        .then((response) => {
          setCollaboratorResults(response.users);
        })
        .catch(() => {
          setCollaboratorError("Could not search users right now.");
          setCollaboratorResults([]);
        })
        .finally(() => {
          setIsSearchingCollaborators(false);
        });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [collaboratorQuery, status]);

  function toDraftCollaborator(
    candidate: { user_id: number; name: string; profile_image_url?: string; bio?: string } | undefined,
    collaboratorUserId: number,
  ): TripCollaborator {
    return {
      user_id: collaboratorUserId,
      name: candidate?.name ?? null,
      bio: candidate?.bio ?? null,
      verified: false,
      college: null,
      profile_image_url: candidate?.profile_image_url ?? null,
    };
  }

  async function handleAddCollaborator(collaboratorUserId: number) {
    setCollaboratorError("");
    setAddingCollaboratorUserId(collaboratorUserId);
    const candidate = collaboratorResults.find((item) => item.user_id === collaboratorUserId);

    try {
      if (!isEditMode || !editTripId) {
        setCollaborators((current) => {
          if (current.some((item) => item.user_id === collaboratorUserId)) {
            return current;
          }
          return [...current, toDraftCollaborator(candidate, collaboratorUserId)];
        });
      } else {
        const response = await addTripCollaborator(editTripId, collaboratorUserId);
        setCollaborators((current) => {
          if (current.some((item) => item.user_id === response.collaborator.user_id)) {
            return current;
          }
          return [...current, response.collaborator];
        });
      }
    } catch (addError) {
      if (addError instanceof ApiError) {
        setCollaboratorError(addError.message);
      } else {
        setCollaboratorError("Could not add collaborator right now.");
      }
    } finally {
      setAddingCollaboratorUserId(null);
    }
  }

  const filteredCollaboratorResults = collaboratorResults.filter((candidate) => {
    if (candidate.user_id === userId) {
      return false;
    }
    if (collaborators.some((item) => item.user_id === candidate.user_id)) {
      return false;
    }
    return true;
  });

  if (status !== "authenticated" || !isStudent) {
    return null;
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }
      return [...current, tag];
    });
  }

  function addCustomTag() {
    const tag = customTagInput.trim().toLowerCase();
    if (!tag || selectedTags.includes(tag)) {
      setCustomTagInput("");
      return;
    }
    setSelectedTags((current) => [...current, tag]);
    setCustomTagInput("");
  }

  function addStop(kind: "lodging" | "activity") {
    const stop = makeStopDraft();

    const scrollToNewStop = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const target = document.getElementById(`stop-${kind}-${stop.id}`);
          if (!target) {
            return;
          }
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      });
    };

    if (kind === "lodging") {
      setLodgings((current) => [...current, stop]);
      scrollToNewStop();
      return;
    }
    setActivities((current) => [...current, stop]);
    scrollToNewStop();
  }

  function updateStop(
    kind: "lodging" | "activity",
    id: string,
    patch: Partial<StopDraft>,
  ) {
    if (kind === "lodging") {
      setLodgings((current) => current.map((stop) => (stop.id === id ? { ...stop, ...patch } : stop)));
      return;
    }

    setActivities((current) => current.map((stop) => (stop.id === id ? { ...stop, ...patch } : stop)));
  }

  function removeStop(kind: "lodging" | "activity", id: string) {
    if (kind === "lodging") {
      setLodgings((current) => current.filter((stop) => stop.id !== id));
      return;
    }

    setActivities((current) => current.filter((stop) => stop.id !== id));
  }

  async function handleStopImageUpload(kind: "lodging" | "activity", id: string, file?: File) {
    if (!file) {
      updateStop(kind, id, {
        imageUrl: "",
        imageName: "",
        imageError: "",
        isProcessingImage: false,
      });
      return;
    }

    updateStop(kind, id, {
      imageError: "",
      isProcessingImage: true,
    });

    try {
      const imageUrl = await uploadImage(file, kind === "lodging" ? "trips/lodging" : "trips/activity");
      updateStop(kind, id, {
        imageUrl,
        imageName: file.name,
        imageError: "",
        isProcessingImage: false,
      });
    } catch {
      updateStop(kind, id, {
        imageError: "Could not upload this image. Please try again.",
        isProcessingImage: false,
      });
      setError("Could not upload one of the stop images. Please try again.");
    }
  }

  async function handleCoverImageUpload(file?: File) {
    if (!file) {
      setCoverImage("");
      setCoverImageName("");
      setCoverImageError("");
      return;
    }

    setIsUploadingImage(true);
    setCoverImageError("");

    try {
      const imageUrl = await uploadImage(file, "trips/cover");
      setCoverImage(imageUrl);
      setCoverImageName(file.name);
    } catch {
      setCoverImage("");
      setCoverImageName("");
      setCoverImageError("Could not upload cover image. Please try again.");
      setError("Could not upload cover image. Please try again.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleSubmitTrip() {
    setError("");

    if (!title.trim()) {
      setError(isPopupMode ? "Add a pop-up title before posting." : "Add a trip title before posting.");
      return;
    }

    if (!tripLocation) {
      setError(isPopupMode ? "Choose a location before posting." : "Choose a trip location before posting.");
      return;
    }

    if (isPopupMode && (!eventStart || !eventEnd)) {
      setError("Set a start and end time before posting.");
      return;
    }

    const normalizedEventStart = isPopupMode ? toEventIso(eventStart) : null;
    const normalizedEventEnd = isPopupMode ? toEventIso(eventEnd) : null;
    if (isPopupMode && (!normalizedEventStart || !normalizedEventEnd)) {
      setError("Set a valid start and end time before posting.");
      return;
    }
    if (
      isPopupMode &&
      normalizedEventStart &&
      normalizedEventEnd &&
      new Date(normalizedEventEnd) <= new Date(normalizedEventStart)
    ) {
      setError("End time must be after start time.");
      return;
    }

    setIsSavingTrip(true);

    const tripPayload = {
      title: title.trim(),
      thumbnail_url: clean(coverImage),
      description: clean(description),
      latitude: `${tripLocation.latitude}`,
      longitude: `${tripLocation.longitude}`,
      cost: clean(cost),
      visibility,
      tags: selectedTags,
      ...(isPopupMode
        ? {
            event_start: normalizedEventStart ?? undefined,
            event_end: normalizedEventEnd ?? undefined,
          }
        : {
            duration,
            date: clean(date),
            lodgings: lodgings
              .filter(hasStopContent)
              .map((stop) => ({
                title: clean(stop.title),
                description: clean(stop.notes),
                address: stop.location?.address,
                latitude: stop.location ? `${stop.location.latitude}` : undefined,
                longitude: stop.location ? `${stop.location.longitude}` : undefined,
                cost: clean(stop.cost),
                thumbnail_url: clean(stop.imageUrl),
              })),
            activities: activities
              .filter(hasStopContent)
              .map((stop) => ({
                title: clean(stop.title),
                description: clean(stop.notes),
                location: stop.location?.label,
                address: stop.location?.address,
                latitude: stop.location ? `${stop.location.latitude}` : undefined,
                longitude: stop.location ? `${stop.location.longitude}` : undefined,
                cost: clean(stop.cost),
                thumbnail_url: clean(stop.imageUrl),
              })),
          }),
    };

    try {
      const savedTrip = isEditMode && editTripId
        ? await updateTrip(editTripId, tripPayload)
        : await createTrip(tripPayload);

      if (!isEditMode && collaborators.length > 0) {
        const collaboratorIds = collaborators
          .map((collaborator) => collaborator.user_id)
          .filter((collaboratorId) => collaboratorId !== userId);

        if (collaboratorIds.length > 0) {
          await Promise.allSettled(
            collaboratorIds.map((collaboratorId) => addTripCollaborator(savedTrip.trip_id, collaboratorId)),
          );
        }
      }

      const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/";
      const [pathnamePart, queryPart] = safeReturnTo.split("?");
      const destinationPath = pathnamePart || "/";
      const destinationParams = new URLSearchParams(queryPart || "");
      destinationParams.set("selectTrip", String(savedTrip.trip_id));
      const destinationQuery = destinationParams.toString();
      router.push(destinationQuery ? `${destinationPath}?${destinationQuery}` : destinationPath);
      return;
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setError(submitError.message);
      } else {
        setError(isPopupMode ? "Could not post this pop-up right now. Please try again." : "Could not post this trip right now. Please try again.");
      }
    } finally {
      setIsSavingTrip(false);
    }
  }

  return (
    <main className="h-screen overflow-y-auto bg-[linear-gradient(180deg,#f7efe2_0%,#f4f4ef_55%,#eef3f6_100%)] px-4 py-6 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 lg:flex-row">
        <section className="w-full rounded-3xl border border-stone-200/80 bg-white/85 p-5 shadow-xl shadow-stone-200/30 backdrop-blur-sm md:p-7 lg:w-2/3">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              {isEditMode ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">{isPopupMode ? "Pop-Up Editor" : "Trip Editor"}</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">{isPopupMode ? "Edit your pop-up" : "Edit your trip"}</h1>
                </>
              ) : isPopupMode ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">Pop-Up Composer</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">Post a pop-up event</h1>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">Trip Composer</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">Craft your next post</h1>
                </>
              )}
            </div>
            <Link href={returnTo}>
              <Button variant="outline" className="rounded-full">
                Back to Map
              </Button>
            </Link>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Cover Image</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100">
                  <ImagePlus className="h-4 w-4 text-amber-700" />
                  {isUploadingImage ? "Uploading..." : "Upload cover image"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploadingImage}
                    className="sr-only"
                    onChange={(event) => {
                      void handleCoverImageUpload(event.target.files?.[0]);
                    }}
                  />
                </label>
                <div className="space-y-1 text-sm text-stone-500">
                  <p>
                    {isUploadingImage
                      ? "Uploading cover image..."
                      : coverImage
                        ? "Cover selected. Preview updates live."
                        : "No cover yet. Add one to set the tone."}
                  </p>
                  {coverImageName ? <p className="text-xs text-stone-500">Selected: {coverImageName}</p> : null}
                  {coverImageError ? <p className="text-xs font-medium text-red-600">{coverImageError}</p> : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={isPopupMode ? "Name this pop-up..." : "Title your trip..."}
                className="w-full border-b border-stone-200 bg-transparent pb-3 text-4xl font-semibold tracking-tight text-stone-900 outline-none placeholder:text-stone-300"
              />

              <PlacePicker
                label="Location"
                placeholder="Search city or suburb..."
                value={tripLocation}
                onChange={setTripLocation}
                mode="city"
                allowMapPin
              />

              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={isPopupMode ? 4 : 7}
                placeholder={
                  isPopupMode
                    ? "What's happening? Give people a reason to show up..."
                    : "Tell the story: what you did, what surprised you, and what someone should know before visiting..."
                }
                className={`resize-none rounded-2xl border-stone-200 text-base leading-relaxed ${READABLE_TEXTAREA_CLASS}`}
              />
            </div>

            {isPopupMode ? (
              /* Popup mode: start/end times + cost + visibility + tags */
              <div className="grid gap-4 rounded-2xl border border-stone-200 bg-stone-50/70 p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Start Time</label>
                  <Input
                    type="datetime-local"
                    value={eventStart}
                    onChange={(event) => setEventStart(event.target.value)}
                    className={READABLE_INPUT_CLASS}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">End Time</label>
                  <Input
                    type="datetime-local"
                    value={eventEnd}
                    onChange={(event) => setEventEnd(event.target.value)}
                    className={READABLE_INPUT_CLASS}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Cost (per person)</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={cost}
                    onChange={(event) => setCost(event.target.value.replace(/\D/g, ""))}
                    placeholder="Free, or enter amount"
                    className={READABLE_INPUT_CLASS}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Visibility</label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-stone-900"
                    value={visibility}
                    onChange={(event) => setVisibility(event.target.value as TripVisibility)}
                  >
                    <option value="public">public</option>
                    <option value="private">private</option>
                    <option value="friends">friends</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_TAGS.map((tag) => {
                      const selected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
                            selected
                              ? "border-amber-600 bg-amber-600 text-white"
                              : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                    {selectedTags
                      .filter((tag) => !(AVAILABLE_TAGS as readonly string[]).includes(tag))
                      .map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className="flex items-center gap-1 rounded-full border border-amber-600 bg-amber-600 px-3 py-1.5 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-amber-700"
                        >
                          {tag}
                          <span className="text-white/70">×</span>
                        </button>
                      ))}
                    <div className="flex items-center gap-1">
                      <input
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomTag();
                          }
                        }}
                        placeholder="Other..."
                        className="w-24 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 outline-none focus:border-amber-500"
                      />
                      {customTagInput.trim() && (
                        <button
                          type="button"
                          onClick={addCustomTag}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-600 bg-amber-600 text-white hover:bg-amber-700"
                          aria-label="Add custom tag"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Trip mode: date + cost + duration + visibility + tags */
              <div className="grid gap-4 rounded-2xl border border-stone-200 bg-stone-50/70 p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Date</label>
                  <div className="flex gap-2">
                    <select
                      value={dateMonth}
                      onChange={(e) => setDateMonth(e.target.value)}
                      className="h-9 flex-1 rounded-md border border-stone-300 bg-white px-2 text-sm text-stone-900 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Month</option>
                      {MONTH_LABELS.map((name, i) => (
                        <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>
                      ))}
                    </select>
                    <select
                      value={dateYear}
                      onChange={(e) => setDateYear(e.target.value)}
                      className="h-9 w-28 rounded-md border border-stone-300 bg-white px-2 text-sm text-stone-900 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Year</option>
                      {Array.from({ length: 16 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                        <option key={year} value={String(year)}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Cost (per person)</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={cost}
                    onChange={(event) => setCost(event.target.value.replace(/\D/g, ""))}
                    placeholder="1450"
                    className={READABLE_INPUT_CLASS}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Duration</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Trip duration">
                    {TRIP_DURATION_OPTIONS.map((option) => {
                      const selected = duration === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setDuration(option.value)}
                          className={`rounded-lg border px-3 py-2 text-left transition-all ${
                            selected
                              ? "border-amber-600 bg-amber-50 shadow-sm shadow-amber-100"
                              : "border-stone-300 bg-white hover:border-stone-400"
                          }`}
                        >
                          <p className={`text-sm font-semibold ${selected ? "text-amber-900" : "text-stone-800"}`}>
                            {option.label}
                          </p>
                          <p className={`text-xs ${selected ? "text-amber-700" : "text-stone-500"}`}>
                            {option.hint}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Visibility</label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-stone-900"
                    value={visibility}
                    onChange={(event) => setVisibility(event.target.value as TripVisibility)}
                  >
                    <option value="public">public</option>
                    <option value="private">private</option>
                    <option value="friends">friends</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_TAGS.map((tag) => {
                      const selected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
                            selected
                              ? "border-amber-600 bg-amber-600 text-white"
                              : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                    {selectedTags
                      .filter((tag) => !(AVAILABLE_TAGS as readonly string[]).includes(tag))
                      .map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className="flex items-center gap-1 rounded-full border border-amber-600 bg-amber-600 px-3 py-1.5 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-amber-700"
                        >
                          {tag}
                          <span className="text-white/70">×</span>
                        </button>
                      ))}
                    <div className="flex items-center gap-1">
                      <input
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomTag();
                          }
                        }}
                        placeholder="Other..."
                        className="w-24 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 outline-none focus:border-amber-500"
                      />
                      {customTagInput.trim() && (
                        <button
                          type="button"
                          onClick={addCustomTag}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-600 bg-amber-600 text-white hover:bg-amber-700"
                          aria-label="Add custom tag"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isPopupMode && (
              <>
                <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-stone-900">Places you stayed</h2>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => addStop("lodging")}>
                      <Plus className="mr-1 h-4 w-4" />
                      Add stay
                    </Button>
                  </div>

                  {lodgings.length === 0 ? (
                    <p className="text-sm text-stone-500">Add hotels, campgrounds, or anywhere you stayed.</p>
                  ) : null}

                  <div className="space-y-4">
                    {lodgings.map((stop, index) => (
                      <div id={`stop-lodging-${stop.id}`} key={stop.id} className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold text-stone-700">Stay #{index + 1}</p>
                          <button
                            type="button"
                            onClick={() => removeStop("lodging", stop.id)}
                            className="rounded-full p-1 text-stone-400 transition-colors hover:bg-white hover:text-stone-700"
                            aria-label="Remove stay"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid gap-3">
                          <Input
                            value={stop.title}
                            onChange={(event) => updateStop("lodging", stop.id, { title: event.target.value })}
                            placeholder="Name this stay"
                            className={READABLE_INPUT_CLASS}
                          />

                          <PlacePicker
                            label="Location"
                            placeholder="Search an address"
                            value={stop.location}
                            onChange={(location) => updateStop("lodging", stop.id, { location })}
                            mode="address"
                            cityContext={tripLocation}
                            allowMapPin
                          />

                          <Textarea
                            value={stop.notes}
                            rows={3}
                            onChange={(event) => updateStop("lodging", stop.id, { notes: event.target.value })}
                            placeholder="What made this place good (or bad)?"
                            className={`resize-none ${READABLE_TEXTAREA_CLASS}`}
                          />

                          <div className="grid gap-3 sm:grid-cols-2">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={stop.cost}
                              onChange={(event) => updateStop("lodging", stop.id, { cost: event.target.value.replace(/\D/g, "") })}
                              placeholder="Cost per person (optional)"
                              className={READABLE_INPUT_CLASS}
                            />
                            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100">
                              <ImagePlus className="h-4 w-4 text-amber-700" />
                              {stop.imageUrl ? "Change photo" : "Add photo"}
                              <input
                                type="file"
                                accept="image/*"
                                disabled={stop.isProcessingImage}
                                className="sr-only"
                                onChange={(event) => {
                                  setError("");
                                  void handleStopImageUpload("lodging", stop.id, event.target.files?.[0]);
                                }}
                              />
                            </label>
                          </div>
                          {stop.isProcessingImage ? (
                            <p className="text-xs text-stone-500">Uploading image...</p>
                          ) : stop.imageUrl ? (
                            <p className="text-xs text-emerald-700">Photo uploaded.</p>
                          ) : (
                            <p className="text-xs text-stone-500">No photo selected.</p>
                          )}
                          {stop.imageError ? <p className="text-xs font-medium text-red-600">{stop.imageError}</p> : null}
                          {stop.imageUrl ? (
                            <div className="rounded-lg border border-stone-200 bg-white p-2">
                              <div className="flex items-center gap-3">
                                <Image
                                  src={stop.imageUrl}
                                  alt={stop.title ? `${stop.title} preview` : "Stay photo preview"}
                                  width={80}
                                  height={80}
                                  className="h-20 w-20 rounded-md border border-stone-200 object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium text-stone-700">
                                    {stop.imageName || "Selected image"}
                                  </p>
                                  <p className="text-xs text-stone-500">Preview shown as it will appear in this post.</p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-full"
                                  onClick={() =>
                                    updateStop("lodging", stop.id, {
                                      imageUrl: "",
                                      imageName: "",
                                      imageError: "",
                                      isProcessingImage: false,
                                    })
                                  }
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-stone-900">Things you did</h2>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => addStop("activity")}>
                      <Plus className="mr-1 h-4 w-4" />
                      Add activity
                    </Button>
                  </div>

                  {activities.length === 0 ? (
                    <p className="text-sm text-stone-500">Add museums, hikes, restaurants, or events.</p>
                  ) : null}

                  <div className="space-y-4">
                    {activities.map((stop, index) => (
                      <div id={`stop-activity-${stop.id}`} key={stop.id} className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold text-stone-700">Activity #{index + 1}</p>
                          <button
                            type="button"
                            onClick={() => removeStop("activity", stop.id)}
                            className="rounded-full p-1 text-stone-400 transition-colors hover:bg-white hover:text-stone-700"
                            aria-label="Remove activity"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid gap-3">
                          <Input
                            value={stop.title}
                            onChange={(event) => updateStop("activity", stop.id, { title: event.target.value })}
                            placeholder="Name this activity"
                            className={READABLE_INPUT_CLASS}
                          />

                          <PlacePicker
                            label="Location"
                            placeholder="Search an address"
                            value={stop.location}
                            onChange={(location) => updateStop("activity", stop.id, { location })}
                            mode="address"
                            cityContext={tripLocation}
                            allowMapPin
                          />

                          <Textarea
                            value={stop.notes}
                            rows={3}
                            onChange={(event) => updateStop("activity", stop.id, { notes: event.target.value })}
                            placeholder="What should people know before going?"
                            className={`resize-none ${READABLE_TEXTAREA_CLASS}`}
                          />

                          <div className="grid gap-3 sm:grid-cols-2">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={stop.cost}
                              onChange={(event) => updateStop("activity", stop.id, { cost: event.target.value.replace(/\D/g, "") })}
                              placeholder="Cost per person (optional)"
                              className={READABLE_INPUT_CLASS}
                            />
                            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100">
                              <ImagePlus className="h-4 w-4 text-amber-700" />
                              {stop.imageUrl ? "Change photo" : "Add photo"}
                              <input
                                type="file"
                                accept="image/*"
                                disabled={stop.isProcessingImage}
                                className="sr-only"
                                onChange={(event) => {
                                  setError("");
                                  void handleStopImageUpload("activity", stop.id, event.target.files?.[0]);
                                }}
                              />
                            </label>
                          </div>
                          {stop.isProcessingImage ? (
                            <p className="text-xs text-stone-500">Uploading image...</p>
                          ) : stop.imageUrl ? (
                            <p className="text-xs text-emerald-700">Photo uploaded.</p>
                          ) : (
                            <p className="text-xs text-stone-500">No photo selected.</p>
                          )}
                          {stop.imageError ? <p className="text-xs font-medium text-red-600">{stop.imageError}</p> : null}
                          {stop.imageUrl ? (
                            <div className="rounded-lg border border-stone-200 bg-white p-2">
                              <div className="flex items-center gap-3">
                                <Image
                                  src={stop.imageUrl}
                                  alt={stop.title ? `${stop.title} preview` : "Activity photo preview"}
                                  width={80}
                                  height={80}
                                  className="h-20 w-20 rounded-md border border-stone-200 object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium text-stone-700">
                                    {stop.imageName || "Selected image"}
                                  </p>
                                  <p className="text-xs text-stone-500">Preview shown as it will appear in this post.</p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-full"
                                  onClick={() =>
                                    updateStop("activity", stop.id, {
                                      imageUrl: "",
                                      imageName: "",
                                      imageError: "",
                                      isProcessingImage: false,
                                    })
                                  }
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!isLoadingEditTrip && !editLoadError && (
              <div className="space-y-3 rounded-xl border border-stone-200/80 bg-stone-50/70 p-3.5">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-600">Collaborators</h2>
                  <p className="mt-1 text-xs text-stone-500">
                    {isEditMode
                      ? "Collaborators can edit this trip."
                      : "Choose collaborators now. They will be added when you post this trip."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {collaborators.length > 0 ? (
                    collaborators.map((collaborator) => (
                      <div
                        key={collaborator.user_id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-stone-700"
                      >
                        <span className="h-5 w-5 overflow-hidden rounded-full bg-stone-200">
                          {collaborator.profile_image_url ? (
                            <Image
                              src={collaborator.profile_image_url}
                              alt={collaborator.name || "Collaborator"}
                              width={20}
                              height={20}
                              className="h-5 w-5 object-cover"
                            />
                          ) : null}
                        </span>
                        <span>{collaborator.name || `User #${collaborator.user_id}`}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-stone-500">No collaborators yet.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Input
                    value={collaboratorQuery}
                    onChange={(event) => setCollaboratorQuery(event.target.value)}
                    placeholder="Search users"
                    className={`${READABLE_INPUT_CLASS} h-9 text-sm`}
                  />
                  {isSearchingCollaborators && <p className="text-xs text-stone-500">Searching...</p>}
                  {collaboratorError && <p className="text-xs font-medium text-red-600">{collaboratorError}</p>}

                  {filteredCollaboratorResults.length > 0 && (
                    <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-stone-200/80 bg-white/70 p-1.5">
                      {filteredCollaboratorResults.map((candidate) => (
                        <div
                          key={candidate.user_id}
                          className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-stone-800">{candidate.name || `User #${candidate.user_id}`}</p>
                            {candidate.bio ? <p className="truncate text-xs text-stone-500">{candidate.bio}</p> : null}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full px-3 text-xs"
                            disabled={addingCollaboratorUserId === candidate.user_id}
                            onClick={() => {
                              void handleAddCollaborator(candidate.user_id);
                            }}
                          >
                            {addingCollaboratorUserId === candidate.user_id ? "Adding..." : "Add"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {editLoadError ? <p className="text-sm font-medium text-red-600">{editLoadError}</p> : null}
            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

            <div className="flex flex-wrap gap-3">
              {isLoadingEditTrip ? (
                <p className="text-sm text-stone-500">Loading trip data...</p>
              ) : (
                <Button
                  type="button"
                  className="rounded-full bg-amber-600 px-6 hover:bg-amber-700"
                  onClick={() => void handleSubmitTrip()}
                  disabled={isSavingTrip || Boolean(editLoadError)}
                >
                  {isSavingTrip
                    ? "Saving..."
                    : isEditMode
                      ? "Save Changes"
                      : isPopupMode
                        ? "Post Pop-Up"
                        : "Post Trip"}
                </Button>
              )}
            </div>
          </div>
        </section>

        <aside className="w-full lg:w-1/3 lg:self-start">
          <div className="rounded-3xl border border-stone-200/80 bg-white/90 p-4 shadow-xl shadow-stone-200/30 backdrop-blur-sm lg:sticky lg:top-0">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              <Sparkles className="h-3.5 w-3.5" />
              Live Preview
            </p>

            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
              <div
                className="relative h-56 w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${coverImage || BANNER_PLACEHOLDER})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                {isPopupMode && (
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-amber-500/90 px-2.5 py-1 text-white backdrop-blur-sm">
                    <Timer className="h-3 w-3" />
                    <span className="text-xs font-semibold">Pop-Up</span>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/80">
                    {isPopupMode ? formatEventTimePreview(eventStart, eventEnd) : formatPreviewDate(date)}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold leading-tight">{title || (isPopupMode ? "Your pop-up title" : "Your trip title")}</h2>
                  <p className="mt-2 flex items-center gap-1 text-sm text-white/85">
                    <MapPin className="h-3.5 w-3.5" />
                    {tripLocation?.label || "Pick a primary location"}
                  </p>
                  {!isPopupMode && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                        <Timer className="h-3 w-3" />
                        {formatTripDuration(duration)}
                      </span>
                      {cost && (
                        <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                          ${cost}/person
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 p-4">
                <p className="text-sm leading-relaxed text-stone-700">
                  {description || (isPopupMode ? "Your pop-up description appears here." : "Your trip story preview appears here as you write.")}
                </p>

                <div className="flex flex-wrap gap-2">
                  {selectedTags.length > 0 ? (
                    selectedTags.map((tag) => (
                      <span key={tag} className="rounded-full bg-stone-900 px-2.5 py-1 text-[11px] font-medium text-white">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-stone-500">No tags yet.</span>
                  )}
                </div>

                {!isPopupMode && (
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-semibold text-stone-800">Stays ({previewLodgings.length})</p>
                      {previewLodgings.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {previewLodgings.map((stop) => (
                            <article key={stop.id} className="rounded-xl border border-stone-200 bg-white p-2">
                              <div className="flex items-start gap-3">
                                <Image
                                  src={stop.imageUrl || BANNER_PLACEHOLDER}
                                  alt={stop.title ? `${stop.title} preview` : "Stay preview"}
                                  width={64}
                                  height={64}
                                  className="h-16 w-16 rounded-md border border-stone-200 object-cover"
                                />
                                <div className="min-w-0 flex-1 space-y-1">
                                  <p className="truncate text-sm font-semibold text-stone-800">
                                    {stop.title || "Untitled stay"}
                                  </p>
                                  <p className="truncate text-xs text-stone-500">
                                    {stop.location?.label || stop.location?.address || "Location not set"}
                                  </p>
                                  <p className="max-h-10 overflow-hidden text-xs leading-relaxed text-stone-600">
                                    {stop.notes || "No stay notes yet."}
                                  </p>
                                  <p className="text-xs text-stone-500">{stop.cost ? `Cost/person: $${stop.cost}` : "No cost added"}</p>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-stone-500">No stays added.</p>
                      )}
                    </div>

                    <div>
                      <p className="font-semibold text-stone-800">Activities ({previewActivities.length})</p>
                      {previewActivities.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {previewActivities.map((stop) => (
                            <article key={stop.id} className="rounded-xl border border-stone-200 bg-white p-2">
                              <div className="flex items-start gap-3">
                                <Image
                                  src={stop.imageUrl || BANNER_PLACEHOLDER}
                                  alt={stop.title ? `${stop.title} preview` : "Activity preview"}
                                  width={64}
                                  height={64}
                                  className="h-16 w-16 rounded-md border border-stone-200 object-cover"
                                />
                                <div className="min-w-0 flex-1 space-y-1">
                                  <p className="truncate text-sm font-semibold text-stone-800">
                                    {stop.title || "Untitled activity"}
                                  </p>
                                  <p className="truncate text-xs text-stone-500">
                                    {stop.location?.label || stop.location?.address || "Location not set"}
                                  </p>
                                  <p className="max-h-10 overflow-hidden text-xs leading-relaxed text-stone-600">
                                    {stop.notes || "No activity notes yet."}
                                  </p>
                                  <p className="text-xs text-stone-500">{stop.cost ? `Cost/person: $${stop.cost}` : "No cost added"}</p>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-stone-500">No activities added.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
