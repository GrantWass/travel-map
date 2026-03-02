import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createProfileSetup, uploadImageFromUri } from "@/src/api/client";
import { colors } from "@/src/constants/theme";
import { useDebouncedValue } from "@/src/hooks/use-debounced-value";
import { useAuth } from "@/src/hooks/use-auth";
import { searchUniversities } from "@/src/services/university-service";

type AccountType = "student" | "traveler";

export default function ProfileSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountType?: string }>();
  const { userId, refreshMyProfile } = useAuth();

  const accountType: AccountType = params.accountType === "student" ? "student" : "traveler";

  const [bio, setBio] = useState("");
  const [college, setCollege] = useState("");
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [isCollegeMenuOpen, setIsCollegeMenuOpen] = useState(false);
  const [collegeResults, setCollegeResults] = useState<string[]>([]);
  const [isSearchingColleges, setIsSearchingColleges] = useState(false);
  const [collegeSearchError, setCollegeSearchError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const debouncedCollege = useDebouncedValue(college, 300);

  const headingText = useMemo(
    () => (accountType === "student" ? "Set up your student profile" : "Set up your traveler profile"),
    [accountType],
  );

  useEffect(() => {
    if (accountType !== "student") {
      setCollegeResults([]);
      setCollegeSearchError("");
      setIsSearchingColleges(false);
      return;
    }

    if (debouncedCollege.trim().length < 2) {
      setCollegeResults([]);
      setCollegeSearchError("");
      setIsSearchingColleges(false);
      return;
    }

    let cancelled = false;

    async function runSearch() {
      setIsSearchingColleges(true);
      setCollegeSearchError("");

      try {
        const schools = await searchUniversities(debouncedCollege);
        if (cancelled) {
          return;
        }
        setCollegeResults(schools);
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

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [accountType, debouncedCollege]);

  async function handlePickProfileImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo permission is required to upload a profile image.");
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

  async function handleSubmit() {
    setError("");
    setIsSaving(true);

    try {
      const uploadedImageUrl = profileImageUri
        ? await uploadImageFromUri(profileImageUri, "profiles")
        : undefined;

      await createProfileSetup({
        account_type: accountType,
        bio: bio.trim() || undefined,
        college: accountType === "student" ? college.trim() || undefined : undefined,
        profile_image_url: uploadedImageUrl,
      });

      if (userId) {
        await refreshMyProfile(userId);
      }

      router.replace("/map");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Could not save profile setup right now. Please try again.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>{headingText}</Text>
          <Text style={styles.subheading}>
            Add a few details so your profile is ready before you jump in.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile Picture</Text>
            <View style={styles.imageRow}>
              <View style={styles.imageAvatar}>
                {profileImageUri ? (
                  <Image source={{ uri: profileImageUri }} style={styles.imagePreview} />
                ) : (
                  <Text style={styles.imagePlaceholder}>TR</Text>
                )}
              </View>
              <Pressable onPress={handlePickProfileImage} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Upload Photo</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder={
                accountType === "student"
                  ? "Example: Journalism major who spends weekends finding underrated food spots."
                  : "Example: I travel for hiking, architecture, and great local coffee."
              }
              multiline
              numberOfLines={4}
              style={styles.bioInput}
            />
          </View>

          {accountType === "student" ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>College</Text>
              <TextInput
                value={college}
                onChangeText={(value) => {
                  setCollege(value);
                  setIsCollegeMenuOpen(true);
                }}
                onFocus={() => setIsCollegeMenuOpen(true)}
                onBlur={() => {
                  setTimeout(() => setIsCollegeMenuOpen(false), 120);
                }}
                placeholder="Search your university"
                style={styles.input}
              />

              {isCollegeMenuOpen ? (
                <View style={styles.collegeMenu}>
                  {isSearchingColleges ? (
                    <View style={styles.collegeMenuStatus}>
                      <ActivityIndicator size="small" color={colors.primaryDark} />
                      <Text style={styles.collegeMenuStatusText}>Searching universities...</Text>
                    </View>
                  ) : collegeSearchError ? (
                    <Text style={styles.errorText}>{collegeSearchError}</Text>
                  ) : collegeResults.length > 0 ? (
                    collegeResults.map((school) => (
                      <Pressable
                        key={school}
                        onPress={() => {
                          setCollege(school);
                          setIsCollegeMenuOpen(false);
                        }}
                        style={styles.collegeOption}
                      >
                        <Text style={styles.collegeOptionText}>{school}</Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.collegeMenuStatusText}>No matching universities</Text>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={() => {
              void handleSubmit();
            }}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && !isSaving && styles.submitButtonPressed,
              isSaving && styles.submitButtonDisabled,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Save and continue</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  heading: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  subheading: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -6,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.mutedText,
    textTransform: "uppercase",
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  imageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  imageAvatar: {
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
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    color: colors.mutedText,
    fontSize: 18,
    fontWeight: "700",
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
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  bioInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 108,
    textAlignVertical: "top",
    color: colors.text,
  },
  collegeMenu: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  collegeMenuStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  collegeMenuStatusText: {
    color: colors.mutedText,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  collegeOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f2eadf",
  },
  collegeOptionText: {
    color: colors.text,
    fontSize: 13,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "600",
  },
  submitButton: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  submitButtonPressed: {
    opacity: 0.9,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
