import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiError, createTrip, uploadImageFromUri } from "@/src/api/client";
import { PlacePicker } from "@/src/components/PlacePicker";
import { AVAILABLE_TAGS, BANNER_PLACEHOLDER } from "@/src/constants/trip";
import { colors } from "@/src/constants/theme";
import { useAuth } from "@/src/hooks/use-auth";
import { useTripStore } from "@/src/stores/trip-store";
import type { TripDuration, TripVisibility } from "@/src/types/api";
import type { PlaceOption } from "@/src/types/places";
import { toEventIso, toLocalDatetimeInput } from "@/src/utils/date";
import { clean } from "@/src/utils/string";

interface StopDraft {
  id: string;
  title: string;
  notes: string;
  cost: string;
  imageUrl: string;
  imageError: string;
  isProcessingImage: boolean;
  location: PlaceOption | null;
}

function makeStopDraft(): StopDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    notes: "",
    cost: "",
    imageUrl: "",
    imageError: "",
    isProcessingImage: false,
    location: null,
  };
}

function hasStopContent(stop: StopDraft): boolean {
  return Boolean(
    stop.title.trim() ||
      stop.notes.trim() ||
      stop.cost.trim() ||
      stop.imageUrl ||
      stop.location,
  );
}

export default function TripComposeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; returnTo?: string }>();
  const isPopupMode = params.mode === "popup";
  const returnTo = typeof params.returnTo === "string" && params.returnTo.startsWith("/")
    ? params.returnTo
    : "/map";

  function buildSelectTripDestination(tripId: number): string {
    const [pathPart, queryPart] = returnTo.split("?");
    const path = pathPart || "/map";
    const query = new URLSearchParams(queryPart || "");
    query.set("selectTrip", String(tripId));
    query.set("selectAt", String(Date.now()));
    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
  }

  const { isStudent } = useAuth();
  const upsertTrip = useTripStore((state) => state.upsertTrip);

  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [isUploadingCoverImage, setIsUploadingCoverImage] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [tripLocation, setTripLocation] = useState<PlaceOption | null>(null);
  const [cost, setCost] = useState("");
  const [duration, setDuration] = useState<TripDuration>("multiday trip");
  const [date, setDate] = useState("");
  const [visibility, setVisibility] = useState<TripVisibility>("public");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");

  const [eventStart, setEventStart] = useState(() =>
    isPopupMode ? toLocalDatetimeInput(new Date()) : "",
  );
  const [eventEnd, setEventEnd] = useState(() => {
    if (!isPopupMode) {
      return "";
    }

    const end = new Date();
    end.setHours(end.getHours() + 2);
    return toLocalDatetimeInput(end);
  });

  const [lodgings, setLodgings] = useState<StopDraft[]>([]);
  const [activities, setActivities] = useState<StopDraft[]>([]);

  const previewLodgings = useMemo(() => lodgings.filter(hasStopContent), [lodgings]);
  const previewActivities = useMemo(() => activities.filter(hasStopContent), [activities]);

  if (!isStudent) {
    return (
      <SafeAreaView style={styles.lockedScreen}>
        <Text style={styles.lockedTitle}>Student account required</Text>
        <Text style={styles.lockedSubtitle}>
          Trip creation is currently available to student accounts only.
        </Text>
        <Pressable onPress={() => router.replace("/map")} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Back to Map</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
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
    const draft = makeStopDraft();
    if (kind === "lodging") {
      setLodgings((current) => [...current, draft]);
      return;
    }

    setActivities((current) => [...current, draft]);
  }

  function updateStop(kind: "lodging" | "activity", id: string, patch: Partial<StopDraft>) {
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

  async function chooseImageUri(): Promise<string | null> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo permission is required to upload images.");
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
    });

    if (result.canceled || !result.assets[0]) {
      return null;
    }

    return result.assets[0].uri;
  }

  async function handleStopImageUpload(kind: "lodging" | "activity", id: string) {
    const uri = await chooseImageUri();
    if (!uri) {
      return;
    }

    updateStop(kind, id, {
      imageError: "",
      isProcessingImage: true,
    });

    try {
      const folder = kind === "lodging" ? "trips/lodging" : "trips/activity";
      const imageUrl = await uploadImageFromUri(uri, folder);
      updateStop(kind, id, {
        imageUrl,
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

  async function handleCoverImageUpload() {
    const uri = await chooseImageUri();
    if (!uri) {
      return;
    }

    setIsUploadingCoverImage(true);
    setError("");

    try {
      const imageUrl = await uploadImageFromUri(uri, "trips/cover");
      setCoverImage(imageUrl);
    } catch {
      setCoverImage("");
      setError("Could not upload cover image. Please try again.");
    } finally {
      setIsUploadingCoverImage(false);
    }
  }

  async function handleCreateTrip() {
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
      setError("Set valid start and end times before posting.");
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

    try {
      const newTrip = await createTrip({
        title: title.trim(),
        thumbnail_url: clean(coverImage),
        description: clean(description),
        latitude: tripLocation ? `${tripLocation.latitude}` : undefined,
        longitude: tripLocation ? `${tripLocation.longitude}` : undefined,
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
                  address: stop.location?.address,
                  location: stop.location?.label,
                  latitude: stop.location ? `${stop.location.latitude}` : undefined,
                  longitude: stop.location ? `${stop.location.longitude}` : undefined,
                  cost: clean(stop.cost),
                  thumbnail_url: clean(stop.imageUrl),
                })),
            }),
      });

      upsertTrip(newTrip);
      router.replace(buildSelectTripDestination(newTrip.trip_id));
    } catch (createError) {
      if (createError instanceof ApiError) {
        setError(createError.message);
      } else {
        setError(
          isPopupMode
            ? "Could not post this pop-up right now. Please try again."
            : "Could not post this trip right now. Please try again.",
        );
      }
    } finally {
      setIsSavingTrip(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>{isPopupMode ? "Pop-Up Composer" : "Trip Composer"}</Text>
          <Text style={styles.headerTitle}>
            {isPopupMode ? "Post a pop-up event" : "Craft your next post"}
          </Text>
        </View>

        <Pressable onPress={() => router.replace(returnTo)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Back to Map</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.modeSwitchRow}>
          <Pressable
            onPress={() => router.replace(`/trip-compose?mode=trip&returnTo=${encodeURIComponent(returnTo)}`)}
            style={[styles.modeButton, !isPopupMode && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, !isPopupMode && styles.modeButtonTextActive]}>Trip</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace(`/trip-compose?mode=popup&returnTo=${encodeURIComponent(returnTo)}`)}
            style={[styles.modeButton, isPopupMode && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, isPopupMode && styles.modeButtonTextActive]}>Pop-Up</Text>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Cover Image</Text>
          <View style={styles.coverRow}>
            <Pressable onPress={() => void handleCoverImageUpload()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>
                {isUploadingCoverImage ? "Uploading..." : "Upload cover image"}
              </Text>
            </Pressable>
            <Text style={styles.helperText}>
              {coverImage ? "Cover selected." : "No cover yet."}
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={isPopupMode ? "Name this pop-up..." : "Title your trip..."}
            style={styles.titleInput}
          />

          <PlacePicker
            label="Location"
            placeholder="Search city or suburb"
            value={tripLocation}
            onChange={setTripLocation}
            mode="city"
            allowMapPin
          />

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={
              isPopupMode
                ? "What's happening? Give people a reason to show up..."
                : "Tell the story: what you did, what surprised you, and what someone should know before visiting..."
            }
            multiline
            numberOfLines={isPopupMode ? 4 : 6}
            style={styles.textarea}
          />
        </View>

        {isPopupMode ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Event Timing</Text>
            <TextInput
              value={eventStart}
              onChangeText={setEventStart}
              placeholder="YYYY-MM-DDTHH:MM"
              style={styles.input}
            />
            <TextInput
              value={eventEnd}
              onChangeText={setEventEnd}
              placeholder="YYYY-MM-DDTHH:MM"
              style={styles.input}
            />
            <TextInput
              value={cost}
              onChangeText={setCost}
              placeholder="Cost (optional)"
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <View style={styles.inlineRow}>
              {(["public", "private", "friends"] as TripVisibility[]).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setVisibility(value)}
                  style={[styles.pill, visibility === value && styles.pillActive]}
                >
                  <Text style={[styles.pillText, visibility === value && styles.pillTextActive]}>
                    {value}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Trip Details</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="Date (YYYY-MM)"
              style={styles.input}
            />
            <TextInput
              value={cost}
              onChangeText={setCost}
              placeholder="Cost (optional)"
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <View style={styles.inlineRow}>
              {(["multiday trip", "day trip", "overnight trip"] as TripDuration[]).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setDuration(value)}
                  style={[styles.pill, duration === value && styles.pillActive]}
                >
                  <Text style={[styles.pillText, duration === value && styles.pillTextActive]}>
                    {value}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.inlineRow}>
              {(["public", "private", "friends"] as TripVisibility[]).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setVisibility(value)}
                  style={[styles.pill, visibility === value && styles.pillActive]}
                >
                  <Text style={[styles.pillText, visibility === value && styles.pillTextActive]}>
                    {value}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tagsWrap}>
            {AVAILABLE_TAGS.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={[styles.tagChip, selected && styles.tagChipActive]}
                >
                  <Text style={[styles.tagChipText, selected && styles.tagChipTextActive]}>{tag}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.customTagRow}>
            <TextInput
              value={customTagInput}
              onChangeText={setCustomTagInput}
              placeholder="Other..."
              style={styles.customTagInput}
            />
            <Pressable onPress={addCustomTag} style={styles.customTagAddButton}>
              <Text style={styles.customTagAddButtonText}>Add</Text>
            </Pressable>
          </View>
        </View>

        {!isPopupMode ? (
          <>
            <View style={styles.sectionCard}>
              <View style={styles.stopHeader}>
                <Text style={styles.sectionTitle}>Places you stayed</Text>
                <Pressable onPress={() => addStop("lodging")} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Add stay</Text>
                </Pressable>
              </View>

              {lodgings.length === 0 ? (
                <Text style={styles.helperText}>Add hotels, campgrounds, or anywhere you stayed.</Text>
              ) : null}

              {lodgings.map((stop, index) => (
                <View key={stop.id} style={styles.stopCard}>
                  <View style={styles.stopTitleRow}>
                    <Text style={styles.stopTitle}>Stay #{index + 1}</Text>
                    <Pressable onPress={() => removeStop("lodging", stop.id)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>

                  <TextInput
                    value={stop.title}
                    onChangeText={(value) => updateStop("lodging", stop.id, { title: value })}
                    placeholder="Name this stay"
                    style={styles.input}
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

                  <TextInput
                    value={stop.notes}
                    onChangeText={(value) => updateStop("lodging", stop.id, { notes: value })}
                    placeholder="What made this place good (or bad)?"
                    multiline
                    numberOfLines={3}
                    style={styles.textareaSmall}
                  />

                  <TextInput
                    value={stop.cost}
                    onChangeText={(value) => updateStop("lodging", stop.id, { cost: value })}
                    placeholder="Cost (optional)"
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />

                  <View style={styles.stopImageRow}>
                    <Pressable
                      onPress={() => {
                        void handleStopImageUpload("lodging", stop.id);
                      }}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {stop.imageUrl ? "Change photo" : "Add photo"}
                      </Text>
                    </Pressable>
                    {stop.isProcessingImage ? <ActivityIndicator size="small" color={colors.primaryDark} /> : null}
                  </View>

                  {stop.imageError ? <Text style={styles.errorText}>{stop.imageError}</Text> : null}
                  {stop.imageUrl ? (
                    <Image source={{ uri: stop.imageUrl }} style={styles.stopPreviewImage} />
                  ) : null}
                </View>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.stopHeader}>
                <Text style={styles.sectionTitle}>Things you did</Text>
                <Pressable onPress={() => addStop("activity")} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Add activity</Text>
                </Pressable>
              </View>

              {activities.length === 0 ? (
                <Text style={styles.helperText}>Add museums, hikes, restaurants, or events.</Text>
              ) : null}

              {activities.map((stop, index) => (
                <View key={stop.id} style={styles.stopCard}>
                  <View style={styles.stopTitleRow}>
                    <Text style={styles.stopTitle}>Activity #{index + 1}</Text>
                    <Pressable onPress={() => removeStop("activity", stop.id)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>

                  <TextInput
                    value={stop.title}
                    onChangeText={(value) => updateStop("activity", stop.id, { title: value })}
                    placeholder="Name this activity"
                    style={styles.input}
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

                  <TextInput
                    value={stop.notes}
                    onChangeText={(value) => updateStop("activity", stop.id, { notes: value })}
                    placeholder="What should people know before going?"
                    multiline
                    numberOfLines={3}
                    style={styles.textareaSmall}
                  />

                  <TextInput
                    value={stop.cost}
                    onChangeText={(value) => updateStop("activity", stop.id, { cost: value })}
                    placeholder="Cost (optional)"
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />

                  <View style={styles.stopImageRow}>
                    <Pressable
                      onPress={() => {
                        void handleStopImageUpload("activity", stop.id);
                      }}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {stop.imageUrl ? "Change photo" : "Add photo"}
                      </Text>
                    </Pressable>
                    {stop.isProcessingImage ? <ActivityIndicator size="small" color={colors.primaryDark} /> : null}
                  </View>

                  {stop.imageError ? <Text style={styles.errorText}>{stop.imageError}</Text> : null}
                  {stop.imageUrl ? (
                    <Image source={{ uri: stop.imageUrl }} style={styles.stopPreviewImage} />
                  ) : null}
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Live Preview</Text>
          <Image source={{ uri: coverImage || BANNER_PLACEHOLDER }} style={styles.previewBanner} />
          <Text style={styles.previewTitle}>{title || (isPopupMode ? "Your pop-up title" : "Your trip title")}</Text>
          <Text style={styles.previewLocation}>{tripLocation?.label || "Pick a primary location"}</Text>
          <Text style={styles.previewDescription}>
            {description || (isPopupMode ? "Your pop-up description appears here." : "Your trip story preview appears here as you write.")}
          </Text>
          {!isPopupMode ? (
            <Text style={styles.previewMeta}>
              Stays: {previewLodgings.length} | Activities: {previewActivities.length}
            </Text>
          ) : null}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={() => {
            void handleCreateTrip();
          }}
          disabled={isSavingTrip}
          style={[styles.primaryButton, isSavingTrip && styles.primaryButtonDisabled]}
        >
          {isSavingTrip ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>{isPopupMode ? "Post Pop-Up" : "Post Trip"}</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  lockedScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  lockedTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  lockedSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLabel: {
    color: colors.mutedText,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    fontWeight: "700",
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 2,
  },
  scrollContent: {
    padding: 12,
    gap: 12,
    paddingBottom: 24,
  },
  modeSwitchRow: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  modeButtonActive: {
    backgroundColor: colors.primarySoft,
  },
  modeButtonText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
  },
  modeButtonTextActive: {
    color: colors.primaryDark,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 10,
    gap: 8,
  },
  sectionTitle: {
    color: colors.mutedText,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  coverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  helperText: {
    flex: 1,
    color: colors.mutedText,
    fontSize: 11,
  },
  titleInput: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    paddingBottom: 8,
  },
  textarea: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    minHeight: 100,
    textAlignVertical: "top",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  textareaSmall: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    minHeight: 80,
    textAlignVertical: "top",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
  },
  inlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pillText: {
    color: colors.text,
    fontSize: 11,
    textTransform: "capitalize",
  },
  pillTextActive: {
    color: colors.primaryDark,
    fontWeight: "700",
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  tagChipText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  tagChipTextActive: {
    color: colors.primaryDark,
  },
  customTagRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  customTagInput: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 12,
  },
  customTagAddButton: {
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  customTagAddButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  stopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stopCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    padding: 10,
    gap: 8,
  },
  stopTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stopTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  removeText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "700",
  },
  stopImageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stopPreviewImage: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    backgroundColor: "#e8dfcf",
  },
  previewCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    padding: 10,
    gap: 6,
  },
  previewLabel: {
    color: colors.mutedText,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  previewBanner: {
    width: "100%",
    height: 170,
    borderRadius: 10,
    backgroundColor: "#e8dfcf",
  },
  previewTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  previewLocation: {
    color: colors.mutedText,
    fontSize: 12,
  },
  previewDescription: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  previewMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "600",
  },
});
