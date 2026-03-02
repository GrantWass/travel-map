import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ApiError,
  deleteTrip,
  getUserProfile,
  updateProfileSettings,
  uploadImageFromUri,
} from "@/src/api/client";
import { colors } from "@/src/constants/theme";
import { useDebouncedValue } from "@/src/hooks/use-debounced-value";
import { useAuth } from "@/src/hooks/use-auth";
import { searchUniversities } from "@/src/services/university-service";
import { useTripStore } from "@/src/stores/trip-store";
import type { UserProfileResponse } from "@/src/types/api";
import { toDisplayDate } from "@/src/utils/date";
import { initialsFromName } from "@/src/utils/string";

const DEFAULT_BIO = "Traveler sharing experiences from the road.";

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string }>();
  const targetUserId = Number(params.userId ?? "");

  const { userId, isStudent, refreshMyProfile, refreshSession, signOut } = useAuth();
  const removeTripById = useTripStore((state) => state.removeTripById);

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [collegeInput, setCollegeInput] = useState("");
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [deletingTripId, setDeletingTripId] = useState<number | null>(null);
  const [collegeResults, setCollegeResults] = useState<string[]>([]);
  const [isCollegeMenuOpen, setIsCollegeMenuOpen] = useState(false);
  const [isSearchingColleges, setIsSearchingColleges] = useState(false);
  const [collegeSearchError, setCollegeSearchError] = useState("");

  const debouncedCollege = useDebouncedValue(collegeInput, 300);

  const isOwnProfile = userId !== null && userId === targetUserId;
  const canManageTrips = isOwnProfile && isStudent;
  const canEditProfile = isOwnProfile;

  const currentName = profile?.user.name || "Traveler";
  const currentBio = profile?.user.bio || "";
  const currentCollege = profile?.user.college || "-";
  const currentImageUrl = profile?.user.profile_image_url || null;

  const hasSchool = currentCollege.trim() !== "" && currentCollege !== "-";

  const avatarText = useMemo(
    () => initialsFromName(currentName || "Traveler"),
    [currentName],
  );

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
        if (mounted) {
          setProfile(null);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        const response = await getUserProfile(targetUserId);
        if (!mounted) {
          return;
        }
        setProfile(response);
        setNameInput(response.user.name || "");
        setBioInput(response.user.bio || "");
      } catch {
        if (mounted) {
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [targetUserId]);

  useEffect(() => {
    if (!settingsOpen || hasSchool || debouncedCollege.trim().length < 2) {
      setCollegeResults([]);
      setCollegeSearchError("");
      setIsSearchingColleges(false);
      return;
    }

    let cancelled = false;

    async function runCollegeSearch() {
      setIsSearchingColleges(true);
      setCollegeSearchError("");
      try {
        const results = await searchUniversities(debouncedCollege);
        if (cancelled) {
          return;
        }
        setCollegeResults(results);
      } catch (searchError) {
        if (cancelled) {
          return;
        }

        setCollegeResults([]);
        const message =
          searchError instanceof Error ? searchError.message : "Could not fetch universities right now.";
        setCollegeSearchError(message);
      } finally {
        if (!cancelled) {
          setIsSearchingColleges(false);
        }
      }
    }

    void runCollegeSearch();

    return () => {
      cancelled = true;
    };
  }, [debouncedCollege, hasSchool, settingsOpen]);

  async function handlePickProfileImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setSettingsError("Photo permission is required to upload a profile image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    setProfileImageUri(result.assets[0].uri);
  }

  async function handleSaveSettings() {
    if (!profile) {
      return;
    }

    setSettingsError("");
    setSettingsSuccess("");
    setIsSavingSettings(true);

    try {
      const payload: {
        name?: string;
        bio?: string;
        college?: string;
        profile_image_url?: string;
      } = {};

      const trimmedName = nameInput.trim();
      if (!trimmedName) {
        setSettingsError("Username is required.");
        return;
      }

      if (trimmedName !== (profile.user.name || "").trim()) {
        payload.name = trimmedName;
      }

      const trimmedBio = bioInput.trim();
      if (trimmedBio !== (profile.user.bio || "").trim()) {
        payload.bio = trimmedBio;
      }

      if (!hasSchool) {
        const trimmedCollege = collegeInput.trim();
        if (trimmedCollege) {
          payload.college = trimmedCollege;
        }
      }

      if (profileImageUri) {
        payload.profile_image_url = await uploadImageFromUri(profileImageUri, "profiles");
      }

      if (!payload.name && payload.bio === undefined && !payload.college && !payload.profile_image_url) {
        setSettingsSuccess("No changes to save.");
        return;
      }

      await updateProfileSettings(payload);
      await refreshSession();

      if (isOwnProfile && userId) {
        await refreshMyProfile(userId);
      }

      const refreshedProfile = await getUserProfile(targetUserId);
      setProfile(refreshedProfile);
      setNameInput(refreshedProfile.user.name || "");
      setBioInput(refreshedProfile.user.bio || "");
      setCollegeInput("");
      setProfileImageUri(null);
      setSettingsSuccess("Profile updated.");
    } catch (error) {
      if (error instanceof ApiError) {
        setSettingsError(error.message);
      } else {
        setSettingsError("Could not update profile right now.");
      }
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleDeleteTrip(tripId: number) {
    if (!canManageTrips) {
      return;
    }

    setDeletingTripId(tripId);
    try {
      await deleteTrip(tripId);
      removeTripById(tripId);

      const refreshedProfile = await getUserProfile(targetUserId);
      setProfile(refreshedProfile);
      if (isOwnProfile && userId) {
        await refreshMyProfile(userId);
      }
    } catch {
      // ignore failure
    } finally {
      setDeletingTripId(null);
    }
  }

  function handleOpenTrip(tripId: number) {
    router.replace(`/map?selectTrip=${tripId}&selectAt=${Date.now()}`);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Text style={styles.emptyText}>Profile not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.dragHandle} />

      {isOwnProfile ? (
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Close</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setSettingsOpen((current) => !current);
              setSettingsError("");
              setSettingsSuccess("");
            }}
            style={styles.headerButton}
          >
            <Text style={styles.headerButtonText}>{settingsOpen ? "Done" : "Settings"}</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {settingsOpen && canEditProfile ? (
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>Profile Settings</Text>

            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your name"
              style={styles.input}
            />

            <TextInput
              value={bioInput}
              onChangeText={setBioInput}
              placeholder="Tell people what kind of trips and experiences you enjoy."
              multiline
              numberOfLines={4}
              style={styles.bioInput}
            />

            <View style={styles.imageSettingsRow}>
              <Pressable onPress={handlePickProfileImage} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Change Photo</Text>
              </Pressable>
              {profileImageUri ? <Text style={styles.helperText}>New photo selected.</Text> : null}
            </View>

            {!hasSchool ? (
              <View style={styles.collegeBlock}>
                <TextInput
                  value={collegeInput}
                  onChangeText={(value) => {
                    setCollegeInput(value);
                    setIsCollegeMenuOpen(true);
                  }}
                  onFocus={() => setIsCollegeMenuOpen(true)}
                  onBlur={() => {
                    setTimeout(() => setIsCollegeMenuOpen(false), 120);
                  }}
                  placeholder="Search your school"
                  style={styles.input}
                />

                {isCollegeMenuOpen ? (
                  <View style={styles.collegeMenu}>
                    {isSearchingColleges ? (
                      <Text style={styles.helperText}>Searching schools...</Text>
                    ) : collegeSearchError ? (
                      <Text style={styles.errorText}>{collegeSearchError}</Text>
                    ) : collegeResults.length > 0 ? (
                      collegeResults.map((school) => (
                        <Pressable
                          key={school}
                          onPress={() => {
                            setCollegeInput(school);
                            setIsCollegeMenuOpen(false);
                          }}
                          style={styles.collegeOption}
                        >
                          <Text style={styles.collegeOptionText}>{school}</Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.helperText}>No schools found.</Text>
                    )}
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={styles.helperText}>School is already set to {currentCollege}.</Text>
            )}

            <View style={styles.settingsActionsRow}>
              <Pressable
                onPress={() => {
                  void handleSaveSettings();
                }}
                disabled={isSavingSettings}
                style={styles.primaryButton}
              >
                {isSavingSettings ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save Changes</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  void signOut();
                }}
                style={styles.dangerButton}
              >
                <Text style={styles.dangerButtonText}>Logout</Text>
              </Pressable>
            </View>

            {settingsError ? <Text style={styles.errorText}>{settingsError}</Text> : null}
            {settingsSuccess ? <Text style={styles.successText}>{settingsSuccess}</Text> : null}
          </View>
        ) : null}

        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            {profileImageUri || currentImageUrl ? (
              <Image source={{ uri: profileImageUri || (currentImageUrl as string) }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{avatarText}</Text>
            )}
          </View>

          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{currentName}</Text>
            <Text style={styles.profileEmail}>{profile.user.email}</Text>
            <Text style={styles.profileSchool}>{currentCollege}</Text>
          </View>
        </View>

        <Text style={styles.profileBio}>{currentBio.trim() || DEFAULT_BIO}</Text>

        {canManageTrips || profile.trips.length > 0 ? (
          <Text style={styles.sectionTitle}>Trips</Text>
        ) : null}

        {canManageTrips ? (
          <Pressable
            onPress={() => router.push("/trip-compose?mode=trip&returnTo=/map")}
            style={styles.addTripButton}
          >
            <Text style={styles.addTripButtonText}>Add Trip</Text>
          </Pressable>
        ) : null}

        {profile.trips.length > 0 ? (
          <View style={styles.tripGrid}>
            {profile.trips.map((trip) => (
              <View key={trip.trip_id} style={styles.tripCard}>
                <Pressable
                  onPress={() => {
                    handleOpenTrip(trip.trip_id);
                  }}
                >
                  <Image source={{ uri: trip.thumbnail_url || undefined }} style={styles.tripImage} />
                  <View style={styles.tripCopy}>
                    <Text numberOfLines={1} style={styles.tripTitle}>
                      {trip.title}
                    </Text>
                    <Text style={styles.tripDate}>{toDisplayDate(trip.date)}</Text>
                  </View>
                </Pressable>

                {canManageTrips ? (
                  <Pressable
                    onPress={() => {
                      void handleDeleteTrip(trip.trip_id);
                    }}
                    disabled={deletingTripId === trip.trip_id}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteButtonText}>
                      {deletingTripId === trip.trip_id ? "..." : "Delete"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No trips posted yet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  scrollContent: {
    padding: 12,
    gap: 12,
    paddingBottom: 24,
  },
  settingsCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
    gap: 8,
  },
  settingsTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  bioInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 90,
    textAlignVertical: "top",
    color: colors.text,
  },
  imageSettingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    fontSize: 12,
    fontWeight: "600",
  },
  collegeBlock: {
    gap: 6,
  },
  collegeMenu: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  collegeOption: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: "#f3eadf",
  },
  collegeOptionText: {
    color: colors.text,
    fontSize: 12,
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 12,
  },
  settingsActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  dangerButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  dangerButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "600",
  },
  successText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "600",
  },
  profileHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: colors.mutedText,
    fontSize: 20,
    fontWeight: "700",
  },
  profileCopy: {
    flex: 1,
    gap: 1,
  },
  profileName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  profileEmail: {
    color: colors.mutedText,
    fontSize: 12,
  },
  profileSchool: {
    color: colors.mutedText,
    fontSize: 12,
  },
  profileBio: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    color: colors.mutedText,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 12,
    fontWeight: "700",
  },
  addTripButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  addTripButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },
  tripGrid: {
    gap: 10,
  },
  tripCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  tripImage: {
    width: "100%",
    height: 150,
    backgroundColor: "#e8dfcf",
  },
  tripCopy: {
    padding: 10,
  },
  tripTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  tripDate: {
    marginTop: 2,
    color: colors.mutedText,
    fontSize: 12,
  },
  deleteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.62)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 13,
  },
});
