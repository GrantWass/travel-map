"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ImagePlus, MapPin, Sparkles, Timer } from "lucide-react";

import ImageCropModal from "@/components/image-crop-modal";
import {
  READABLE_INPUT_CLASS,
  READABLE_TEXTAREA_CLASS,
  StopEditorSection,
  StopPreviewList,
  TagEditor,
  VisibilitySelect,
} from "@/components/trip-form-fields";
import PlacePicker from "@/components/place-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildSignupHref, getInviteTokenFromSearch, getStoredInviteToken } from "@/lib/auth-navigation";
import { ApiError, addTripCollaborator, createTrip, getTripFull, searchUsers, updateTrip, uploadImage } from "@/lib/api-client";
import type { PlaceOption } from "@/lib/client-types";
import { BANNER_PLACEHOLDER } from "@/lib/trip-constants";
import type { TripCollaborator, TripDuration, TripVisibility } from "@/lib/api-types";
import { formatTripDuration } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { hasStopContent, makeStopDraft, type StopDraft } from "@/app/trips/stop-draft";

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

function makeStopDraftFromChild(
  child: {
    title?: string | null;
    description?: string | null;
    cost?: string | number | null;
    thumbnail_url?: string | null;
    link_url?: string | null;
    latitude?: string | number | null;
    longitude?: string | number | null;
    address?: string | null;
  },
  locationLabel: string,
): StopDraft {
  return {
    id: crypto.randomUUID(),
    title: child.title || "",
    notes: child.description || "",
    cost: child.cost != null ? String(child.cost) : "",
    linkUrl: child.link_url || "",
    imageUrl: child.thumbnail_url || "",
    imageName: child.thumbnail_url ? "Existing image" : "",
    imageError: "",
    isProcessingImage: false,
    location:
      child.latitude != null && child.longitude != null
        ? {
            label: locationLabel,
            address: child.address || "",
            latitude: Number(child.latitude),
            longitude: Number(child.longitude),
          }
        : null,
  };
}

const MONTH_LABELS = ["January","February","March","April","May","June","July","August","September","October","November","December"] as const;
const TRIP_DURATION_OPTIONS: Array<{ value: TripDuration; label: string; hint: string }> = [
  { value: "day trip", label: "Day Trip", hint: "In and out in one day" },
  { value: "overnight trip", label: "Overnight", hint: "One night away" },
  { value: "multiday trip", label: "Multi-Day", hint: "A longer getaway" },
];
const TRIP_DRAFT_VERSION = 1;

interface TripDraft {
  version: number;
  title: string;
  description: string;
  coverImage: string;
  coverImageName: string;
  tripLocation: PlaceOption | null;
  cost: string;
  duration: TripDuration;
  dateMonth: string;
  dateYear: string;
  visibility: TripVisibility;
  selectedTags: string[];
  lodgings: StopDraft[];
  activities: StopDraft[];
  collaborators: TripCollaborator[];
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
  const status = useAuthStore((state) => state.status);
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

  const [cropFile, setCropFile] = useState<File | null>(null);
  const cropCallbackRef = useState<((file: File) => void) | null>(null);

  function requestCrop(file: File, callback: (cropped: File) => void) {
    cropCallbackRef[1](() => callback);
    setCropFile(file);
  }

  function handleCropComplete(croppedFile: File) {
    cropCallbackRef[0]?.(croppedFile);
    cropCallbackRef[1](null);
    setCropFile(null);
  }

  function handleCropCancel() {
    cropCallbackRef[1](null);
    setCropFile(null);
  }

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

  const [lodgings, setLodgings] = useState<StopDraft[]>([]);
  const [activities, setActivities] = useState<StopDraft[]>([]);
  const [draftStatus, setDraftStatus] = useState<"restored" | "saving" | "saved" | null>(null);
  const [optionalDetailsOpen, setOptionalDetailsOpen] = useState(false);
  const hasRestoredDraftRef = useRef(false);
  const draftKey = userId ? `travel-map:trip-draft:v${TRIP_DRAFT_VERSION}:${userId}` : null;
  const previewLodgings = lodgings.filter(hasStopContent);
  const previewActivities = activities.filter(hasStopContent);

  useEffect(() => {
    if (isEditMode || !draftKey || hasRestoredDraftRef.current) return;
    hasRestoredDraftRef.current = true;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as TripDraft;
      if (draft.version !== TRIP_DRAFT_VERSION) return;
      setTitle(draft.title || "");
      setDescription(draft.description || "");
      setCoverImage(draft.coverImage || "");
      setCoverImageName(draft.coverImageName || "");
      setTripLocation(draft.tripLocation || null);
      setCost(draft.cost || "");
      setDuration(draft.duration || "multiday trip");
      setDateMonth(draft.dateMonth || "");
      setDateYear(draft.dateYear || "");
      setVisibility(draft.visibility || "public");
      setSelectedTags(draft.selectedTags || []);
      setLodgings(draft.lodgings || []);
      setActivities(draft.activities || []);
      setCollaborators(draft.collaborators || []);
      setOptionalDetailsOpen(Boolean(draft.description || draft.cost || draft.dateMonth || draft.selectedTags?.length));
      setDraftStatus("restored");
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey, isEditMode]);

  useEffect(() => {
    if (isEditMode || !draftKey || !hasRestoredDraftRef.current) return;
    const hasContent = Boolean(title.trim() || description.trim() || tripLocation || lodgings.length || activities.length);
    if (!hasContent) return;
    setDraftStatus("saving");
    const timeout = window.setTimeout(() => {
      const draft: TripDraft = {
        version: TRIP_DRAFT_VERSION,
        title,
        description,
        coverImage,
        coverImageName,
        tripLocation,
        cost,
        duration,
        dateMonth,
        dateYear,
        visibility,
        selectedTags,
        lodgings,
        activities,
        collaborators,
      };
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      setDraftStatus("saved");
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [activities, collaborators, cost, coverImage, coverImageName, dateMonth, dateYear, description, draftKey, duration, isEditMode, lodgings, selectedTags, title, tripLocation, visibility]);

  useEffect(() => {
    if (status === "unauthenticated") {
      const inviteToken = getInviteTokenFromSearch(new URLSearchParams(window.location.search)) ?? getStoredInviteToken();
      const nextPath = `${window.location.pathname}${window.location.search}`;
      router.replace(buildSignupHref({ nextPath, inviteToken }));
    }
  }, [router, status]);

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
        const isOwner = userId !== null && trip.owner_user_id === userId;
        const isCollaborator = userId !== null && (trip.collaborators || []).some((collaborator) => collaborator.user_id === userId);

        if (userId !== null && !isOwner && !isCollaborator) {
          setEditLoadError("You don't have permission to edit this trip.");
          return;
        }

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
        setOptionalDetailsOpen(true);

        setLodgings(trip.lodgings.map((lodging) => makeStopDraftFromChild(lodging, lodging.address || lodging.title || "")));
        setActivities(trip.activities.map((activity) => makeStopDraftFromChild(activity, activity.location || activity.address || activity.title || "")));
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

  if (status !== "authenticated") {
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

    requestCrop(file, async (croppedFile) => {
      updateStop(kind, id, {
        imageError: "",
        isProcessingImage: true,
      });

      try {
        const imageUrl = await uploadImage(croppedFile, kind === "lodging" ? "trips/lodging" : "trips/activity");
        updateStop(kind, id, {
          imageUrl,
          imageName: croppedFile.name,
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
    });
  }

  async function handleCoverImageUpload(file?: File) {
    if (!file) {
      setCoverImage("");
      setCoverImageName("");
      setCoverImageError("");
      return;
    }

    requestCrop(file, async (croppedFile) => {
      setIsUploadingImage(true);
      setCoverImageError("");

      try {
        const imageUrl = await uploadImage(croppedFile, "trips/cover");
        setCoverImage(imageUrl);
        setCoverImageName(croppedFile.name);
      } catch {
        setCoverImage("");
        setCoverImageName("");
        setCoverImageError("Could not upload cover image. Please try again.");
        setError("Could not upload cover image. Please try again.");
      } finally {
        setIsUploadingImage(false);
      }
    });
  }

  async function handleSubmitTrip() {
    setError("");

    if (!title.trim()) {
      setError("Add a trip title before posting.");
      document.getElementById("trip-title")?.focus();
      return;
    }

    if (!tripLocation) {
      setError("Choose a trip location before posting.");
      document.getElementById("trip-location")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (isUploadingImage) {
      setError("Wait for the cover image to finish uploading.");
      document.getElementById("trip-cover-image")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!coverImage.trim()) {
      setCoverImageError("Add a cover image before posting.");
      setError("Add a cover image before posting.");
      document.getElementById("trip-cover-image")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setIsSavingTrip(true);

    const stopToPayload = (stop: StopDraft) => ({
      title: clean(stop.title),
      description: clean(stop.notes),
      address: stop.location?.address,
      link_url: clean(stop.linkUrl),
      latitude: stop.location ? `${stop.location.latitude}` : undefined,
      longitude: stop.location ? `${stop.location.longitude}` : undefined,
      cost: clean(stop.cost),
      thumbnail_url: clean(stop.imageUrl),
    });

    const tripPayload = {
      title: title.trim(),
      thumbnail_url: coverImage.trim(),
      description: clean(description),
      latitude: `${tripLocation.latitude}`,
      longitude: `${tripLocation.longitude}`,
      cost: clean(cost),
      visibility,
      tags: selectedTags,
      duration,
      date: clean(date),
      lodgings: lodgings.filter(hasStopContent).map(stopToPayload),
      activities: activities.filter(hasStopContent).map((stop) => ({
        ...stopToPayload(stop),
        location: stop.location?.label,
      })),
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
      destinationParams.set("trip", String(savedTrip.trip_id));
      const destinationQuery = destinationParams.toString();
      if (draftKey) window.localStorage.removeItem(draftKey);
      router.push(destinationQuery ? `${destinationPath}?${destinationQuery}` : destinationPath);
      return;
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setError(submitError.message);
      } else {
        setError("Could not post this trip right now. Please try again.");
      }
    } finally {
      setIsSavingTrip(false);
    }
  }

  return (
    <main className="h-screen overflow-y-auto bg-[linear-gradient(180deg,#f7efe2_0%,#f4f4ef_55%,#eef3f6_100%)] px-4 py-6 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 lg:flex-row">
        <section className="w-full rounded-3xl border border-border/80 bg-card/85 p-5 shadow-xl shadow-black/10 backdrop-blur-sm md:p-7 lg:w-2/3">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              {isEditMode ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Trip Editor</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Edit your trip</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Update the essentials first, then refine any optional details or itinerary items.</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">New trip</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Share an adventure</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Start with the three required details, then add as much itinerary detail as you want.</p>
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
            {draftStatus && !isEditMode ? (
              <div role="status" className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-primary">
                {draftStatus === "restored" ? "Your unfinished trip was restored." : draftStatus === "saving" ? "Saving draft…" : "Draft saved on this device."}
              </div>
            ) : null}

            <section className="rounded-2xl border border-border bg-card/70 p-4 md:p-5">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Trip essentials</h2>
                  <p className="text-xs text-muted-foreground">Title, primary location, and cover image are required.</p>
                </div>
              </div>
              <div className="grid gap-4">
              <label htmlFor="trip-title" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Trip title <span className="text-destructive">*</span>
              </label>
              <input
                id="trip-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Give your trip a title"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-2xl font-semibold tracking-tight text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground/60"
              />

              <div id="trip-location">
                <PlacePicker
                  label="Location *"
                  placeholder="Where did you go?"
                  value={tripLocation}
                  onChange={setTripLocation}
                  mode="city"
                  allowMapPin
                />
              </div>

              <div id="trip-cover-image" className={`rounded-2xl border bg-secondary/50 p-4 ${coverImageError ? "border-destructive/60" : "border-border"}`}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Cover Image <span className="text-destructive">*</span>
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {coverImage && (
                    <Image src={coverImage} alt="Trip cover preview" width={80} height={80} className="h-20 w-20 rounded-xl object-cover" />
                  )}
                  <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary">
                    <ImagePlus className="h-4 w-4 text-primary" />
                    {isUploadingImage ? "Uploading..." : coverImage ? "Change cover image" : "Upload cover image"}
                    <input
                      type="file"
                      accept="image/*"
                      required={!coverImage}
                      disabled={isUploadingImage}
                      className="sr-only"
                      onChange={(event) => void handleCoverImageUpload(event.target.files?.[0])}
                    />
                  </label>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{isUploadingImage ? "Uploading cover image..." : coverImage ? "Cover selected. Preview updates live." : "A cover image is required."}</p>
                    {coverImageName ? <p className="text-xs text-muted-foreground">Selected: {coverImageName}</p> : null}
                    {coverImageError ? <p className="text-xs font-medium text-destructive">{coverImageError}</p> : null}
                  </div>
                </div>
              </div>
              </div>
            </section>

            <details className="group rounded-2xl border border-border bg-secondary/40" open={optionalDetailsOpen} onToggle={(event) => setOptionalDetailsOpen(event.currentTarget.open)}>
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-foreground marker:hidden">
                <span className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-muted-foreground">2</span>
                  More trip details
                </span>
                <span className="text-xs font-normal text-muted-foreground">Optional · {optionalDetailsOpen ? "Hide" : "Show"}</span>
              </summary>
              <div className="space-y-4 border-t border-border/60 p-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Trip story</label>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    placeholder="Add a quick note, favorite moment, or advice"
                    className={`resize-none rounded-xl border-border text-base leading-relaxed ${READABLE_TEXTAREA_CLASS}`}
                  />
                </div>
            {/* Trip mode: date + cost + duration + visibility + tags */}
            <div className="grid gap-4 rounded-2xl border border-border bg-secondary/40 p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Date</label>
                  <div className="flex gap-2">
                    <select
                      value={dateMonth}
                      onChange={(e) => setDateMonth(e.target.value)}
                      className="h-9 flex-1 rounded-md border border-input bg-card px-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="">Month</option>
                      {MONTH_LABELS.map((name, i) => (
                        <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>
                      ))}
                    </select>
                    <select
                      value={dateYear}
                      onChange={(e) => setDateYear(e.target.value)}
                      className="h-9 w-28 rounded-md border border-input bg-card px-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="">Year</option>
                      {Array.from({ length: 16 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                        <option key={year} value={String(year)}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Cost (per person)</label>
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
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Duration</label>
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
                              ? "border-primary bg-primary/10 shadow-sm shadow-primary/15"
                              : "border-input bg-card hover:border-primary/50"
                          }`}
                        >
                          <p className={`text-sm font-semibold ${selected ? "text-primary" : "text-foreground"}`}>
                            {option.label}
                          </p>
                          <p className={`text-xs ${selected ? "text-primary" : "text-muted-foreground"}`}>
                            {option.hint}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Visibility</label>
                  <VisibilitySelect value={visibility} onChange={setVisibility} />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tags</p>
                  <TagEditor
                    selectedTags={selectedTags}
                    onToggle={toggleTag}
                    customTagInput={customTagInput}
                    onCustomTagInputChange={setCustomTagInput}
                    onAddCustomTag={addCustomTag}
                  />
                </div>
            </div>
              </div>
            </details>

            <div className="flex items-start gap-3 px-1">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-muted-foreground">3</span>
              <div>
                <h2 className="text-base font-semibold text-foreground">Build your itinerary</h2>
                <p className="text-xs text-muted-foreground">Add stays and activities now, or come back to them later.</p>
              </div>
            </div>

            <StopEditorSection
              kind="lodging"
              heading="Places you stayed"
              addLabel="Add stay"
              stops={lodgings}
              cityContext={tripLocation}
              onAdd={() => addStop("lodging")}
              onUpdate={(id, patch) => updateStop("lodging", id, patch)}
              onRemove={(id) => removeStop("lodging", id)}
              onImageUpload={(id, file) => {
                setError("");
                void handleStopImageUpload("lodging", id, file);
              }}
            />

            <StopEditorSection
              kind="activity"
              heading="Things you did"
              addLabel="Add activity"
              stops={activities}
              cityContext={tripLocation}
              onAdd={() => addStop("activity")}
              onUpdate={(id, patch) => updateStop("activity", id, patch)}
              onRemove={(id) => removeStop("activity", id)}
              onImageUpload={(id, file) => {
                setError("");
                void handleStopImageUpload("activity", id, file);
              }}
            />

          {!isLoadingEditTrip && !editLoadError && (
            <div className="space-y-3 rounded-xl border border-border/80 bg-secondary/40 p-3.5">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-muted-foreground">4</span>
                <div>
                <h2 className="text-sm font-semibold text-foreground">Collaborators <span className="font-normal text-muted-foreground">· Optional</span></h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isEditMode
                    ? "Collaborators can edit this trip."
                    : "Choose collaborators now. They will be added when you post this trip."}
                </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {collaborators.length > 0 ? (
                  collaborators.map((collaborator) => (
                    <div
                      key={collaborator.user_id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-1 text-[11px] font-medium text-foreground/80"
                    >
                      <span className="h-5 w-5 overflow-hidden rounded-full bg-muted">
                        {collaborator.profile_image_url ? (
                          <Image
                            src={collaborator.profile_image_url}
                            alt={collaborator.name || "Collaborator"}
                            width={20}
                            height={20}
                            sizes="20px"
                            className="h-5 w-5 object-cover"
                          />
                        ) : null}
                      </span>
                      <span>{collaborator.name || `User #${collaborator.user_id}`}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No collaborators yet.</p>
                )}
              </div>

              <div className="space-y-2">
                <Input
                  value={collaboratorQuery}
                  onChange={(event) => setCollaboratorQuery(event.target.value)}
                  placeholder="Search users"
                  className={`${READABLE_INPUT_CLASS} h-9 text-sm`}
                />
                {isSearchingCollaborators && <p className="text-xs text-muted-foreground">Searching...</p>}
                {collaboratorError && <p className="text-xs font-medium text-destructive">{collaboratorError}</p>}

                {filteredCollaboratorResults.length > 0 && (
                  <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-border/80 bg-card/70 p-1.5">
                    {filteredCollaboratorResults.map((candidate) => (
                      <div
                        key={candidate.user_id}
                        className="flex items-center justify-between gap-2 rounded-md bg-card px-2.5 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">{candidate.name || `User #${candidate.user_id}`}</p>
                          {candidate.bio ? <p className="truncate text-xs text-muted-foreground">{candidate.bio}</p> : null}
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

          {editLoadError ? <p className="text-sm font-medium text-destructive">{editLoadError}</p> : null}
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

          <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-lg backdrop-blur-xl">
            {isLoadingEditTrip ? (
              <p className="text-sm text-muted-foreground">Loading trip data...</p>
            ) : (
              <Button
                type="button"
                className="rounded-full bg-primary px-6 hover:bg-primary/90"
                onClick={() => void handleSubmitTrip()}
                disabled={isSavingTrip || Boolean(editLoadError)}
              >
                {isSavingTrip
                  ? "Saving..."
                  : isEditMode
                    ? "Save Changes"
                    : "Post Trip"}
              </Button>
            )}
            {!isLoadingEditTrip && (
              <p className="text-xs text-muted-foreground">
                {[Boolean(title.trim()), Boolean(tripLocation), Boolean(coverImage.trim())].filter(Boolean).length === 3
                  ? isEditMode ? "Ready to save" : "Ready to post"
                  : `${[Boolean(title.trim()), Boolean(tripLocation), Boolean(coverImage.trim())].filter(Boolean).length}/3 required details complete`}
              </p>
            )}
          </div>
          </div>
        </section>

        <aside className="w-full lg:w-1/3 lg:sticky lg:top-0 lg:self-start">
          <div className="rounded-3xl border border-border/80 bg-card/90 p-4 shadow-xl shadow-black/10 backdrop-blur-sm">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Live Preview
            </p>

            <div className="overflow-hidden rounded-2xl border border-border bg-secondary">
              <div
                className="relative h-56 w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${coverImage || BANNER_PLACEHOLDER})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <p className="text-xs uppercase tracking-widest text-white/80">
                    {formatPreviewDate(date)}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold leading-tight">{title || "Your trip title"}</h2>
                  <p className="mt-2 flex items-center gap-1 text-sm text-white/85">
                    <MapPin className="h-3.5 w-3.5" />
                    {tripLocation?.label || "Pick a primary location"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-card/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                      <Timer className="h-3 w-3" />
                      {formatTripDuration(duration)}
                    </span>
                    {cost && (
                      <span className="inline-flex items-center rounded-full bg-card/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                        ${cost}/person
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <p className="text-sm leading-relaxed text-foreground/80">
                  {description || "Your trip story preview appears here as you write."}
                </p>

                <div className="flex flex-wrap gap-2">
                  {selectedTags.length > 0 ? (
                    selectedTags.map((tag) => (
                      <span key={tag} className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-medium text-white">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No tags yet.</span>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  <StopPreviewList kind="lodging" stops={lodgings} />
                  <StopPreviewList kind="activity" stops={activities} />
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {cropFile && (
        <ImageCropModal
          file={cropFile}
          onCrop={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </main>
  );
}
