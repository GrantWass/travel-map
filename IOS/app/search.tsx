import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/src/constants/theme";
import { useTripStore } from "@/src/stores/trip-store";
import type { Trip, TripActivity, TripLodging } from "@/src/types/api";

const MAX_COST = 500;
const MAX_VISIBLE_TAGS = 15;

interface SearchResult {
  trip: Trip;
  matchedActivities: TripActivity[];
  matchedLodgings: TripLodging[];
}

export default function SearchScreen() {
  const router = useRouter();
  const trips = useTripStore((state) => state.trips);

  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [maxCost, setMaxCost] = useState(MAX_COST);

  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const trip of trips) {
      for (const rawTag of trip.tags) {
        const tag = rawTag.trim().toLowerCase();
        if (!tag) {
          continue;
        }
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_VISIBLE_TAGS)
      .map(([tag]) => tag);
  }, [trips]);

  useEffect(() => {
    setSelectedTags((current) => current.filter((tag) => availableTags.includes(tag)));
  }, [availableTags]);

  const searchResults = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    const results: SearchResult[] = [];

    for (const trip of trips) {
      const normalizedTripTags = new Set(
        trip.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
      );

      if (selectedTags.length > 0 && !selectedTags.every((tag) => normalizedTripTags.has(tag))) {
        continue;
      }

      if (maxCost < MAX_COST && trip.cost !== null && trip.cost > maxCost) {
        continue;
      }

      if (!q) {
        results.push({ trip, matchedActivities: [], matchedLodgings: [] });
        continue;
      }

      const tripMatches =
        trip.title.toLowerCase().includes(q) ||
        trip.owner?.name?.toLowerCase().includes(q);

      const matchedActivities = trip.activities.filter(
        (activity) =>
          activity?.title?.toLowerCase().includes(q) ||
          activity?.address?.toLowerCase().includes(q) ||
          activity?.description?.toLowerCase().includes(q),
      );

      const matchedLodgings = trip.lodgings.filter(
        (lodging) =>
          lodging?.title?.toLowerCase().includes(q) ||
          lodging?.address?.toLowerCase().includes(q) ||
          lodging?.description?.toLowerCase().includes(q),
      );

      if (tripMatches || matchedActivities.length > 0 || matchedLodgings.length > 0) {
        results.push({ trip, matchedActivities, matchedLodgings });
      }
    }

    return results;
  }, [maxCost, query, selectedTags, trips]);

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  function handleSelectTrip(tripId: number) {
    router.replace(`/map?selectTrip=${tripId}&selectAt=${Date.now()}`);
  }

  const hasActiveFilters = selectedTags.length > 0 || maxCost < MAX_COST;
  const noFiltersOrQuery = query.trim() === "" && !hasActiveFilters;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.dragHandle} />
      <View style={styles.header}>
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Search trips, activities, or places"
          style={styles.searchInput}
        />

        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Done</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.filterBlock}>
          <View style={styles.filterTitleRow}>
            <Text style={styles.filterTitle}>Filters</Text>
            {hasActiveFilters ? (
              <Pressable
                onPress={() => {
                  setSelectedTags([]);
                  setMaxCost(MAX_COST);
                }}
              >
                <Text style={styles.clearAllText}>Clear all</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.subFilterLabel}>Tags</Text>
          <View style={styles.tagsWrap}>
            {availableTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={[styles.tagChip, active && styles.tagChipActive]}
                >
                  <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                    {tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.costRow}>
            <Text style={styles.subFilterLabel}>Max Cost</Text>
            <Text style={styles.costValue}>
              {maxCost >= MAX_COST ? "No limit" : `$${maxCost}`}
            </Text>
          </View>
          <Slider
            minimumValue={0}
            maximumValue={MAX_COST}
            step={25}
            value={maxCost}
            onValueChange={setMaxCost}
            minimumTrackTintColor={colors.primaryDark}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
          />
        </View>

        {noFiltersOrQuery ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>Start searching</Text>
            <Text style={styles.emptyStateSubtitle}>
              Search by trip title, author, activity, or place.
            </Text>
          </View>
        ) : searchResults.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No trips found</Text>
            <Text style={styles.emptyStateSubtitle}>Try adjusting your filters.</Text>
          </View>
        ) : (
          <View style={styles.resultsList}>
            {searchResults.map(({ trip, matchedActivities, matchedLodgings }) => {
              const hasSubItems = matchedActivities.length > 0 || matchedLodgings.length > 0;

              return (
                <View key={trip.trip_id} style={styles.resultGroup}>
                  <Pressable
                    onPress={() => {
                      handleSelectTrip(trip.trip_id);
                    }}
                    style={styles.tripRow}
                  >
                    <Image source={{ uri: trip.thumbnail_url }} style={styles.tripRowImage} />
                    <View style={styles.tripRowCopy}>
                      <Text style={styles.tripRowTitle}>{trip.title}</Text>
                      <Text style={styles.tripRowSubtitle}>{trip.owner?.name || "Unknown traveler"}</Text>
                      {trip.cost !== null ? (
                        <Text style={styles.tripRowMeta}>${trip.cost}</Text>
                      ) : null}
                    </View>
                  </Pressable>

                  {hasSubItems ? (
                    <View style={styles.subItemsWrap}>
                      {matchedActivities.map((activity) => (
                        <Pressable
                          key={`activity-${activity.activity_id}`}
                          onPress={() => {
                            handleSelectTrip(trip.trip_id);
                          }}
                          style={styles.subItemRow}
                        >
                          <Image
                            source={{ uri: activity.thumbnail_url || trip.thumbnail_url }}
                            style={styles.subItemImage}
                          />
                          <View style={styles.subItemCopy}>
                            <Text style={styles.subItemTitle}>{activity.title || "Activity"}</Text>
                            <Text style={styles.subItemSubtitle}>{activity.address || "No address"}</Text>
                          </View>
                        </Pressable>
                      ))}

                      {matchedLodgings.map((lodging) => (
                        <Pressable
                          key={`lodging-${lodging.lodge_id}`}
                          onPress={() => {
                            handleSelectTrip(trip.trip_id);
                          }}
                          style={styles.subItemRow}
                        >
                          <Image
                            source={{ uri: lodging.thumbnail_url || trip.thumbnail_url }}
                            style={styles.subItemImage}
                          />
                          <View style={styles.subItemCopy}>
                            <Text style={styles.subItemTitle}>{lodging.title || "Lodging"}</Text>
                            <Text style={styles.subItemSubtitle}>{lodging.address || "No address"}</Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
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
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
  },
  closeButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  closeButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 24,
    gap: 12,
  },
  filterBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
    gap: 10,
  },
  filterTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  clearAllText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "600",
  },
  subFilterLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  tagChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  tagChipText: {
    color: colors.text,
    fontSize: 12,
    textTransform: "capitalize",
  },
  tagChipTextActive: {
    color: colors.primaryDark,
    fontWeight: "600",
  },
  costRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  costValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    padding: 14,
    alignItems: "center",
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyStateSubtitle: {
    marginTop: 4,
    color: colors.mutedText,
    fontSize: 12,
    textAlign: "center",
  },
  resultsList: {
    gap: 12,
  },
  resultGroup: {
    gap: 8,
  },
  tripRow: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    padding: 10,
  },
  tripRowImage: {
    width: 52,
    height: 52,
    borderRadius: 9,
    backgroundColor: "#e9e2d7",
  },
  tripRowCopy: {
    flex: 1,
    justifyContent: "center",
  },
  tripRowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  tripRowSubtitle: {
    marginTop: 2,
    color: colors.mutedText,
    fontSize: 12,
  },
  tripRowMeta: {
    marginTop: 2,
    color: colors.mutedText,
    fontSize: 12,
  },
  subItemsWrap: {
    marginLeft: 18,
    gap: 6,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: 10,
  },
  subItemRow: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  subItemImage: {
    width: 36,
    height: 36,
    borderRadius: 7,
    backgroundColor: "#e9e2d7",
  },
  subItemCopy: {
    flex: 1,
    justifyContent: "center",
  },
  subItemTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  subItemSubtitle: {
    marginTop: 2,
    color: colors.mutedText,
    fontSize: 11,
  },
});
