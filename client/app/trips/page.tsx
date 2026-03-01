"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ImagePlus, MapPin, Plus, Sparkles, Trash2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import PlacePicker from "@/components/place-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, createTrip, uploadImage } from "@/lib/api-client";
import type { PlaceOption } from "@/lib/place-types";
import { AVAILABLE_TAGS, BANNER_PLACEHOLDER } from "@/lib/trip-constants";
import type { TripDuration, TripVisibility } from "@/lib/api-types";

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
  const { status, isStudent } = useAuth();

  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [coverImageName, setCoverImageName] = useState("");
  const [coverImageError, setCoverImageError] = useState("");
  const [tripLocation, setTripLocation] = useState<PlaceOption | null>(null);
  const [cost, setCost] = useState("");
  const [duration, setDuration] = useState<TripDuration>("multiday trip");
  const [date, setDate] = useState("");
  const [visibility, setVisibility] = useState<TripVisibility>("public");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");

  const [lodgings, setLodgings] = useState<StopDraft[]>([]);
  const [activities, setActivities] = useState<StopDraft[]>([]);
  const previewLodgings = lodgings.filter(hasStopContent);
  const previewActivities = activities.filter(hasStopContent);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signup");
    }
    if (status === "authenticated" && !isStudent) {
      router.replace("/");
    }
  }, [isStudent, router, status]);

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
    if (kind === "lodging") {
      setLodgings((current) => [...current, stop]);
      return;
    }
    setActivities((current) => [...current, stop]);
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

  async function handleCreateTrip() {
    setError("");

    if (!title.trim()) {
      setError("Add a trip title before posting.");
      return;
    }

    if (!tripLocation) {
      setError("Choose a trip location before posting.");
      return;
    }

    setIsSavingTrip(true);

    try {
      const newTrip = await createTrip({
        title: title.trim(),
        thumbnail_url: clean(coverImage),
        description: clean(description),
        latitude: `${tripLocation.latitude}`,
        longitude: `${tripLocation.longitude}`,
        cost: clean(cost),
        duration,
        date: clean(date),
        visibility,
        tags: selectedTags,
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
      });

      const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/";
      const [pathnamePart, queryPart] = safeReturnTo.split("?");
      const destinationPath = pathnamePart || "/";
      const destinationParams = new URLSearchParams(queryPart || "");
      destinationParams.set("selectTrip", String(newTrip.trip_id));
      const destinationQuery = destinationParams.toString();
      router.push(destinationQuery ? `${destinationPath}?${destinationQuery}` : destinationPath);
      return;
    } catch (createError) {
      if (createError instanceof ApiError) {
        setError(createError.message);
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
        <section className="w-full rounded-3xl border border-stone-200/80 bg-white/85 p-5 shadow-xl shadow-stone-200/30 backdrop-blur-sm md:p-7 lg:w-2/3">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">Trip Composer</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">Craft your next post</h1>
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
                placeholder="Title your trip..."
                className="w-full border-b border-stone-200 bg-transparent pb-3 text-4xl font-semibold tracking-tight text-stone-900 outline-none placeholder:text-stone-300"
              />

              <PlacePicker
                label="Trip location"
                placeholder="Search city or suburb..."
                value={tripLocation}
                onChange={setTripLocation}
                mode="city"
                allowMapPin
              />

              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={7}
                placeholder="Tell the story: what you did, what surprised you, and what someone should know before visiting..."
                className={`resize-none rounded-2xl border-stone-200 text-base leading-relaxed ${READABLE_TEXTAREA_CLASS}`}
              />
            </div>

            <div className="grid gap-4 rounded-2xl border border-stone-200 bg-stone-50/70 p-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Date</label>
                <Input
                  type="month"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className={READABLE_INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Cost</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                  placeholder="1450"
                  className={READABLE_INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Duration</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-stone-900"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value as TripDuration)}
                >
                  <option value="multiday trip">multiday trip</option>
                  <option value="day trip">day trip</option>
                  <option value="overnight trip">overnight trip</option>
                </select>
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
                  <div key={stop.id} className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
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
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={stop.cost}
                          onChange={(event) => updateStop("lodging", stop.id, { cost: event.target.value })}
                          placeholder="Cost (optional)"
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
                            <img
                              src={stop.imageUrl}
                              alt={stop.title ? `${stop.title} preview` : "Stay photo preview"}
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
                  <div key={stop.id} className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
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
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={stop.cost}
                          onChange={(event) => updateStop("activity", stop.id, { cost: event.target.value })}
                          placeholder="Cost (optional)"
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
                            <img
                              src={stop.imageUrl}
                              alt={stop.title ? `${stop.title} preview` : "Activity photo preview"}
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

            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                className="rounded-full bg-amber-600 px-6 hover:bg-amber-700"
                onClick={() => void handleCreateTrip()}
                disabled={isSavingTrip}
              >
                {isSavingTrip ? "Posting..." : "Post Trip"}
              </Button>
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
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/80">{formatPreviewDate(date)}</p>
                  <h2 className="mt-1 text-2xl font-semibold leading-tight">{title || "Your trip title"}</h2>
                  <p className="mt-2 flex items-center gap-1 text-sm text-white/85">
                    <MapPin className="h-3.5 w-3.5" />
                    {tripLocation?.label || "Pick a primary location"}
                  </p>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <p className="text-sm leading-relaxed text-stone-700">
                  {description || "Your trip story preview appears here as you write."}
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

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-semibold text-stone-800">Stays ({previewLodgings.length})</p>
                    {previewLodgings.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {previewLodgings.map((stop) => (
                          <article key={stop.id} className="rounded-xl border border-stone-200 bg-white p-2">
                            <div className="flex items-start gap-3">
                              <img
                                src={stop.imageUrl || BANNER_PLACEHOLDER}
                                alt={stop.title ? `${stop.title} preview` : "Stay preview"}
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
                                <p className="text-xs text-stone-500">{stop.cost ? `Cost: ${stop.cost}` : "No cost added"}</p>
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
                              <img
                                src={stop.imageUrl || BANNER_PLACEHOLDER}
                                alt={stop.title ? `${stop.title} preview` : "Activity preview"}
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
                                <p className="text-xs text-stone-500">{stop.cost ? `Cost: ${stop.cost}` : "No cost added"}</p>
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
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
