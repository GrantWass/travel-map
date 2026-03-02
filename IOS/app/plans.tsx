import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  toggleSavedActivity,
  toggleSavedLodging,
} from "@/src/api/client";
import { colors } from "@/src/constants/theme";
import { useTripStore } from "@/src/stores/trip-store";
import type { SavedActivityEntry, SavedLodgingEntry } from "@/src/types/models";

export default function PlansScreen() {
  const router = useRouter();
  const trips = useTripStore((state) => state.trips);
  const savedActivityIds = useTripStore((state) => state.savedActivityIds);
  const savedLodgingIds = useTripStore((state) => state.savedLodgingIds);

  const setSavedActivityIds = useTripStore((state) => state.setSavedActivityIds);
  const setSavedLodgingIds = useTripStore((state) => state.setSavedLodgingIds);
  const removeSavedActivityId = useTripStore((state) => state.removeSavedActivityId);
  const removeSavedLodgingId = useTripStore((state) => state.removeSavedLodgingId);

  const savedActivityIdSet = useMemo(() => new Set(savedActivityIds), [savedActivityIds]);
  const savedLodgingIdSet = useMemo(() => new Set(savedLodgingIds), [savedLodgingIds]);

  const savedActivities = useMemo<SavedActivityEntry[]>(() => {
    return trips.flatMap((trip) =>
      trip.activities
        .filter((activity) => savedActivityIdSet.has(activity.activity_id))
        .map((activity) => ({
          tripId: trip.trip_id,
          tripTitle: trip.title,
          tripThumbnail: trip.thumbnail_url,
          activity,
        })),
    );
  }, [savedActivityIdSet, trips]);

  const savedLodgings = useMemo<SavedLodgingEntry[]>(() => {
    return trips.flatMap((trip) =>
      trip.lodgings
        .filter((lodging) => savedLodgingIdSet.has(lodging.lodge_id))
        .map((lodging) => ({
          tripId: trip.trip_id,
          tripTitle: trip.title,
          tripThumbnail: trip.thumbnail_url,
          lodging,
        })),
    );
  }, [savedLodgingIdSet, trips]);

  const totalCount = savedActivities.length + savedLodgings.length;

  function openTrip(tripId: number) {
    router.replace(`/map?selectTrip=${tripId}&selectAt=${Date.now()}`);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.dragHandle} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleBlock}>
          <Text style={styles.headerTitle}>Plans</Text>
          <Text style={styles.headerSubtitle}>{totalCount} saved items</Text>
        </View>
        {totalCount === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptySubtitle}>
              Select an activity or lodging in a trip, then tap save.
            </Text>
          </View>
        ) : (
          <>
            {savedActivities.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Activities ({savedActivities.length})</Text>
                {savedActivities.map((entry) => (
                  <View key={entry.activity.activity_id} style={styles.itemRow}>
                    <Pressable
                      onPress={() => {
                        openTrip(entry.tripId);
                      }}
                      style={styles.itemBody}
                    >
                      <Image
                        source={{ uri: entry.activity.thumbnail_url || entry.tripThumbnail }}
                        style={styles.itemImage}
                      />
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemTitle}>{entry.activity.title || "Activity"}</Text>
                        <Text style={styles.itemSubtitle}>{entry.tripTitle}</Text>
                        <Text style={styles.itemMeta}>{entry.activity.address || "No address"}</Text>
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        removeSavedActivityId(entry.activity.activity_id);
                        toggleSavedActivity(entry.activity.activity_id)
                          .then((plans) => {
                            setSavedActivityIds(plans.saved_activity_ids);
                            setSavedLodgingIds(plans.saved_lodging_ids);
                          })
                          .catch(() => {
                            // keep optimistic state
                          });
                      }}
                      style={styles.removeButton}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {savedLodgings.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Places Stayed ({savedLodgings.length})</Text>
                {savedLodgings.map((entry) => (
                  <View key={entry.lodging.lodge_id} style={styles.itemRow}>
                    <Pressable
                      onPress={() => {
                        openTrip(entry.tripId);
                      }}
                      style={styles.itemBody}
                    >
                      <Image
                        source={{ uri: entry.lodging.thumbnail_url || entry.tripThumbnail }}
                        style={styles.itemImage}
                      />
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemTitle}>{entry.lodging.title || "Lodging"}</Text>
                        <Text style={styles.itemSubtitle}>{entry.tripTitle}</Text>
                        <Text style={styles.itemMeta}>{entry.lodging.address || "No address"}</Text>
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        removeSavedLodgingId(entry.lodging.lodge_id);
                        toggleSavedLodging(entry.lodging.lodge_id)
                          .then((plans) => {
                            setSavedActivityIds(plans.saved_activity_ids);
                            setSavedLodgingIds(plans.saved_lodging_ids);
                          })
                          .catch(() => {
                            // keep optimistic state
                          });
                      }}
                      style={styles.removeButton}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  titleBlock: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    marginTop: 2,
    color: colors.mutedText,
    fontSize: 12,
  },
  scrollContent: {
    padding: 12,
    gap: 16,
    paddingBottom: 32,
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    alignItems: "center",
    padding: 14,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  emptySubtitle: {
    marginTop: 4,
    color: colors.mutedText,
    fontSize: 12,
    textAlign: "center",
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 10,
    gap: 8,
  },
  sectionTitle: {
    color: colors.mutedText,
    fontSize: 12,
    textTransform: "uppercase",
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  itemBody: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flex: 1,
  },
  itemImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#e9e2d7",
  },
  itemCopy: {
    flex: 1,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  itemSubtitle: {
    marginTop: 1,
    color: colors.mutedText,
    fontSize: 11,
  },
  itemMeta: {
    marginTop: 1,
    color: colors.mutedText,
    fontSize: 11,
  },
  removeButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeButtonText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "700",
  },
});
