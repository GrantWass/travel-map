import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "@/src/constants/theme";
import { formatPopupTimeRange, toDisplayDate } from "@/src/utils/date";
import type { Trip, TripActivity, TripLodging } from "@/src/types/api";

interface TripDetailCardProps {
  trip: Trip;
  selectedActivityId: number | null;
  selectedLodgingId: number | null;
  locationTripCount: number;
  locationTripPosition: number;
  canShowPreviousTripAtLocation: boolean;
  canShowNextTripAtLocation: boolean;
  onShowPreviousTripAtLocation: () => void;
  onShowNextTripAtLocation: () => void;
  onClose: () => void;
  onSelectActivity: (activity: TripActivity | null) => void;
  onSelectLodging: (lodging: TripLodging | null) => void;
  onToggleSavedActivity: (activity: TripActivity) => void;
  onToggleSavedLodging: (lodging: TripLodging) => void;
  savedActivityIds: ReadonlySet<number>;
  savedLodgingIds: ReadonlySet<number>;
  onViewFull: () => void;
  onOpenAuthorProfile: (userId: number) => void;
}

function ListItem({
  title,
  subtitle,
  selected,
  imageUrl,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  imageUrl: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.listItem, selected && styles.listItemSelected]}
    >
      <Image
        source={{ uri: imageUrl || undefined }}
        style={styles.listImage}
        resizeMode="cover"
      />
      <View style={styles.listCopy}>
        <Text numberOfLines={1} style={styles.listTitle}>
          {title}
        </Text>
        <Text numberOfLines={2} style={styles.listSubtitle}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

export function TripDetailCard({
  trip,
  selectedActivityId,
  selectedLodgingId,
  locationTripCount,
  locationTripPosition,
  canShowPreviousTripAtLocation,
  canShowNextTripAtLocation,
  onShowPreviousTripAtLocation,
  onShowNextTripAtLocation,
  onClose,
  onSelectActivity,
  onSelectLodging,
  onToggleSavedActivity,
  onToggleSavedLodging,
  savedActivityIds,
  savedLodgingIds,
  onViewFull,
  onOpenAuthorProfile,
}: TripDetailCardProps) {
  const selectedActivity = trip.activities.find(
    (activity) => activity.activity_id === selectedActivityId,
  );
  const selectedLodging = trip.lodgings.find(
    (lodging) => lodging.lodge_id === selectedLodgingId,
  );

  const popupRange = trip.event_start && trip.event_end
    ? formatPopupTimeRange(trip.event_start, trip.event_end)
    : null;

  const isPopup = Boolean(trip.event_start && trip.event_end);

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Image source={{ uri: trip.thumbnail_url }} style={styles.banner} resizeMode="cover" />
        <View style={styles.bannerOverlay} />

        <View style={styles.headerButtonsRow}>
          {locationTripCount > 1 ? (
            <View style={styles.locationNav}>
              <Pressable
                disabled={!canShowPreviousTripAtLocation}
                onPress={onShowPreviousTripAtLocation}
                style={({ pressed }) => [
                  styles.locationButton,
                  !canShowPreviousTripAtLocation && styles.locationButtonDisabled,
                  pressed && canShowPreviousTripAtLocation && styles.locationButtonPressed,
                ]}
              >
                <Text style={styles.locationButtonText}>{"<"}</Text>
              </Pressable>
              <Text style={styles.locationCountText}>
                {locationTripPosition}/{locationTripCount}
              </Text>
              <Pressable
                disabled={!canShowNextTripAtLocation}
                onPress={onShowNextTripAtLocation}
                style={({ pressed }) => [
                  styles.locationButton,
                  !canShowNextTripAtLocation && styles.locationButtonDisabled,
                  pressed && canShowNextTripAtLocation && styles.locationButtonPressed,
                ]}
              >
                <Text style={styles.locationButtonText}>{">"}</Text>
              </Pressable>
            </View>
          ) : (
            <View />
          )}

          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>x</Text>
          </Pressable>
        </View>

        <View style={styles.headerCopy}>
          <Text style={styles.title} numberOfLines={2}>
            {trip.title}
          </Text>
          <Pressable onPress={() => onOpenAuthorProfile(trip.owner_user_id)}>
            <Text style={styles.metaText}>by {trip.owner.name || "Unknown traveler"}</Text>
          </Pressable>
          <Text style={styles.metaText}>
            {popupRange || toDisplayDate(trip.date)}
          </Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <Text style={styles.description}>{trip.description || "No trip description yet."}</Text>

          {!isPopup ? (
            <>
              <Text style={styles.sectionTitle}>Places Stayed</Text>
              {trip.lodgings.length > 0 ? (
                trip.lodgings.map((lodging) => (
                  <ListItem
                    key={lodging.lodge_id}
                    title={lodging.title || "Untitled stay"}
                    subtitle={lodging.address || "No address"}
                    selected={selectedLodgingId === lodging.lodge_id}
                    imageUrl={lodging.thumbnail_url}
                    onPress={() => {
                      if (selectedLodgingId === lodging.lodge_id) {
                        onSelectLodging(null);
                        return;
                      }
                      onSelectLodging(lodging);
                    }}
                  />
                ))
              ) : (
                <Text style={styles.emptyText}>No places stayed were added for this trip.</Text>
              )}

              <Text style={styles.sectionTitle}>Activities</Text>
              {trip.activities.length > 0 ? (
                trip.activities.map((activity) => (
                  <ListItem
                    key={activity.activity_id}
                    title={activity.title || "Untitled activity"}
                    subtitle={activity.address || "No address"}
                    selected={selectedActivityId === activity.activity_id}
                    imageUrl={activity.thumbnail_url}
                    onPress={() => {
                      if (selectedActivityId === activity.activity_id) {
                        onSelectActivity(null);
                        return;
                      }
                      onSelectActivity(activity);
                    }}
                  />
                ))
              ) : (
                <Text style={styles.emptyText}>No activities were added for this trip.</Text>
              )}
            </>
          ) : (
            <Text style={styles.emptyText}>
              Pop-up events do not include lodging/activity lists.
            </Text>
          )}
        </ScrollView>

        {selectedActivity ? (
          <Pressable
            onPress={() => onToggleSavedActivity(selectedActivity)}
            style={styles.saveButton}
          >
            <Text style={styles.saveButtonText}>
              {savedActivityIds.has(selectedActivity.activity_id)
                ? "Saved to Plans"
                : "Save Activity"}
            </Text>
          </Pressable>
        ) : null}

        {!selectedActivity && selectedLodging ? (
          <Pressable
            onPress={() => onToggleSavedLodging(selectedLodging)}
            style={styles.saveButton}
          >
            <Text style={styles.saveButtonText}>
              {savedLodgingIds.has(selectedLodging.lodge_id)
                ? "Saved to Plans"
                : "Save Lodging"}
            </Text>
          </Pressable>
        ) : null}

        {!isPopup ? (
          <Pressable onPress={onViewFull} style={styles.fullButton}>
            <Text style={styles.fullButtonText}>View Full Review</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    maxHeight: "72%",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  banner: {
    width: "100%",
    height: 160,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    height: 160,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  headerButtonsRow: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  locationButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  locationButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  locationButtonDisabled: {
    opacity: 0.35,
  },
  locationButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  locationCountText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  headerCopy: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
  },
  title: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 22,
  },
  metaText: {
    color: "#f4f4f4",
    fontSize: 12,
    marginTop: 3,
  },
  content: {
    maxHeight: 300,
  },
  contentInner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingBottom: 18,
    gap: 10,
  },
  description: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    marginTop: 8,
    color: colors.mutedText,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  listItem: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 10,
    padding: 8,
    backgroundColor: "#f8f3ea",
    borderWidth: 1,
    borderColor: "#efe4d5",
  },
  listItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  listImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#e7ddce",
  },
  listCopy: {
    flex: 1,
    justifyContent: "center",
  },
  listTitle: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 13,
  },
  listSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 13,
  },
  saveButton: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  fullButton: {
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: "#fffaf2",
  },
  fullButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },
});
