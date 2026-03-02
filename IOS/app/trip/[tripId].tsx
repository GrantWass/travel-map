import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getTrip,
  toggleSavedActivity,
  toggleSavedLodging,
} from "@/src/api/client";
import { colors } from "@/src/constants/theme";
import { useTripStore } from "@/src/stores/trip-store";
import type { Trip, TripActivity, TripLodging } from "@/src/types/api";
import { formatPopupTimeRange, toDisplayDate } from "@/src/utils/date";

export default function TripFullScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = Number(params.tripId ?? "");

  const trips = useTripStore((state) => state.trips);
  const setSelectedTrip = useTripStore((state) => state.setSelectedTrip);
  const upsertTrip = useTripStore((state) => state.upsertTrip);
  const savedActivityIds = useTripStore((state) => state.savedActivityIds);
  const savedLodgingIds = useTripStore((state) => state.savedLodgingIds);
  const setSavedActivityIds = useTripStore((state) => state.setSavedActivityIds);
  const setSavedLodgingIds = useTripStore((state) => state.setSavedLodgingIds);

  const [trip, setTrip] = useState<Trip | null>(() =>
    trips.find((item) => item.trip_id === tripId) ?? null,
  );
  const [isLoading, setIsLoading] = useState(!trip);

  const savedActivityIdSet = useMemo(() => new Set(savedActivityIds), [savedActivityIds]);
  const savedLodgingIdSet = useMemo(() => new Set(savedLodgingIds), [savedLodgingIds]);

  useEffect(() => {
    if (!Number.isFinite(tripId) || tripId <= 0) {
      return;
    }

    let mounted = true;

    async function loadTrip() {
      setIsLoading(true);
      try {
        const loaded = await getTrip(tripId);
        if (!mounted) {
          return;
        }
        setTrip(loaded);
        upsertTrip(loaded);
      } catch {
        // Keep cached trip when fetch fails.
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadTrip();

    return () => {
      mounted = false;
    };
  }, [tripId, upsertTrip]);

  if (isLoading && !trip) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Text style={styles.notFoundText}>Trip not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isPopup = Boolean(trip.event_start && trip.event_end);

  async function toggleActivity(activity: TripActivity) {
    try {
      const plans = await toggleSavedActivity(activity.activity_id);
      setSavedActivityIds(plans.saved_activity_ids);
      setSavedLodgingIds(plans.saved_lodging_ids);
    } catch {
      // keep current plans state
    }
  }

  async function toggleLodging(lodging: TripLodging) {
    try {
      const plans = await toggleSavedLodging(lodging.lodge_id);
      setSavedActivityIds(plans.saved_activity_ids);
      setSavedLodgingIds(plans.saved_lodging_ids);
    } catch {
      // keep current plans state
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => {
            setSelectedTrip(trip);
            router.back();
          }}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push(`/profile/${trip.owner_user_id}`)}
          style={styles.authorButton}
        >
          <Text style={styles.authorButtonText}>@{trip.owner.name || "traveler"}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Image source={{ uri: trip.thumbnail_url }} style={styles.banner} />

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{trip.title}</Text>
          <Text style={styles.metaText}>
            {isPopup
              ? formatPopupTimeRange(trip.event_start, trip.event_end)
              : toDisplayDate(trip.date)}
          </Text>
        </View>

        <Text style={styles.description}>{trip.description || "No trip description yet."}</Text>

        {!isPopup ? (
          <>
            <Text style={styles.sectionTitle}>Places Stayed</Text>
            {trip.lodgings.length > 0 ? (
              trip.lodgings.map((lodging) => (
                <View key={lodging.lodge_id} style={styles.itemCard}>
                  <Image source={{ uri: lodging.thumbnail_url || trip.thumbnail_url }} style={styles.itemImage} />
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemTitle}>{lodging.title || "Untitled stay"}</Text>
                    <Text style={styles.itemSubtitle}>{lodging.address || "No address"}</Text>
                    <Text style={styles.itemDescription}>{lodging.description || "No notes"}</Text>
                    <Pressable onPress={() => void toggleLodging(lodging)} style={styles.saveButton}>
                      <Text style={styles.saveButtonText}>
                        {savedLodgingIdSet.has(lodging.lodge_id)
                          ? "Saved to Plans"
                          : "Save to Plans"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No places stayed were added for this trip.</Text>
            )}

            <Text style={styles.sectionTitle}>Activities</Text>
            {trip.activities.length > 0 ? (
              trip.activities.map((activity) => (
                <View key={activity.activity_id} style={styles.itemCard}>
                  <Image source={{ uri: activity.thumbnail_url || trip.thumbnail_url }} style={styles.itemImage} />
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemTitle}>{activity.title || "Untitled activity"}</Text>
                    <Text style={styles.itemSubtitle}>{activity.address || "No address"}</Text>
                    <Text style={styles.itemDescription}>{activity.description || "No notes"}</Text>
                    <Pressable onPress={() => void toggleActivity(activity)} style={styles.saveButton}>
                      <Text style={styles.saveButtonText}>
                        {savedActivityIdSet.has(activity.activity_id)
                          ? "Saved to Plans"
                          : "Save to Plans"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No activities were added for this trip.</Text>
            )}
          </>
        ) : (
          <Text style={styles.emptyText}>Pop-up events do not include lodging/activity lists.</Text>
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
  notFoundText: {
    color: colors.mutedText,
    fontSize: 14,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  authorButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  authorButtonText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 24,
    gap: 12,
  },
  banner: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    backgroundColor: "#e8dfcf",
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  metaText: {
    color: colors.mutedText,
    fontSize: 12,
  },
  description: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    marginTop: 4,
    color: colors.mutedText,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  itemCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  itemImage: {
    width: "100%",
    height: 180,
    backgroundColor: "#e8dfcf",
  },
  itemCopy: {
    padding: 10,
    gap: 4,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  itemSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
  },
  itemDescription: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  saveButton: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
  },
  saveButtonText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 13,
  },
});
