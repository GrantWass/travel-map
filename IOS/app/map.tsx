import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Region, type LatLng } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getSavedPlans,
  getTrip,
  getTrips,
  toggleSavedActivity,
  toggleSavedLodging,
} from "@/src/api/client";
import { StudentAddFab } from "@/src/components/StudentAddFab";
import { TripDetailCard } from "@/src/components/TripDetailCard";
import { TripMarkerView } from "@/src/components/TripMarkerView";
import { colors } from "@/src/constants/theme";
import { useAuth } from "@/src/hooks/use-auth";
import { useTripStore } from "@/src/stores/trip-store";
import type {
  SavedPlans,
  Trip,
  TripActivity,
  TripLodging,
} from "@/src/types/api";
import { getLocationKey, getMostRecentTripsByLocation, getTripTimestamp } from "@/src/utils/location";

const INITIAL_REGION: Region = {
  latitude: 39.5,
  longitude: -98.35,
  latitudeDelta: 24,
  longitudeDelta: 24,
};

const DETAIL_REGION_DELTA = {
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

export default function MapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ selectTrip?: string; selectAt?: string }>();
  const mapRef = useRef<MapView | null>(null);
  const consumedSelectTripRef = useRef<string | null>(null);

  const { userId, isStudent } = useAuth();

  const trips = useTripStore((state) => state.trips);
  const selectedTrip = useTripStore((state) => state.selectedTrip);
  const selectedActivity = useTripStore((state) => state.selectedActivity);
  const selectedLodging = useTripStore((state) => state.selectedLodging);
  const savedActivityIds = useTripStore((state) => state.savedActivityIds);
  const savedLodgingIds = useTripStore((state) => state.savedLodgingIds);
  const isLoadingTrips = useTripStore((state) => state.isLoadingTrips);
  const isLoadingTripById = useTripStore((state) => state.isLoadingTripById);

  const setTrips = useTripStore((state) => state.setTrips);
  const upsertTrip = useTripStore((state) => state.upsertTrip);
  const setSelectedTrip = useTripStore((state) => state.setSelectedTrip);
  const clearSelections = useTripStore((state) => state.clearSelections);
  const setSelectedActivity = useTripStore((state) => state.setSelectedActivity);
  const setSelectedLodging = useTripStore((state) => state.setSelectedLodging);
  const setSavedActivityIds = useTripStore((state) => state.setSavedActivityIds);
  const setSavedLodgingIds = useTripStore((state) => state.setSavedLodgingIds);
  const toggleSavedActivityId = useTripStore((state) => state.toggleSavedActivityId);
  const toggleSavedLodgingId = useTripStore((state) => state.toggleSavedLodgingId);
  const setIsLoadingTrips = useTripStore((state) => state.setIsLoadingTrips);
  const setIsLoadingTripById = useTripStore((state) => state.setIsLoadingTripById);

  const [region, setRegion] = useState<Region>(INITIAL_REGION);
  const [hasAutoCenteredOnUser, setHasAutoCenteredOnUser] = useState(false);

  const savedActivityIdSet = useMemo(() => new Set(savedActivityIds), [savedActivityIds]);
  const savedLodgingIdSet = useMemo(() => new Set(savedLodgingIds), [savedLodgingIds]);

  const tripLookup = useMemo(() => {
    return new Map(trips.map((trip) => [trip.trip_id, trip]));
  }, [trips]);

  const representativeTrips = useMemo(() => getMostRecentTripsByLocation(trips), [trips]);

  const applySavedPlans = useCallback(
    (plans: SavedPlans) => {
      setSavedActivityIds(plans.saved_activity_ids);
      setSavedLodgingIds(plans.saved_lodging_ids);
    },
    [setSavedActivityIds, setSavedLodgingIds],
  );

  const flyTo = useCallback((coords: LatLng) => {
    mapRef.current?.animateToRegion(
      {
        latitude: coords.latitude,
        longitude: coords.longitude,
        ...DETAIL_REGION_DELTA,
      },
      850,
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadTrips() {
      setIsLoadingTrips(true);
      try {
        const apiTrips = await getTrips();
        if (!mounted) {
          return;
        }

        const now = new Date();
        const visibleTrips = apiTrips
          .filter((trip): trip is Trip => Boolean(trip))
          .filter((trip) => {
            if (!(trip.event_end && trip.event_start)) {
              return true;
            }
            return new Date(trip.event_end) > now;
          });

        setTrips(visibleTrips);
      } catch {
        if (mounted) {
          setTrips([]);
        }
      } finally {
        if (mounted) {
          setIsLoadingTrips(false);
        }
      }
    }

    void loadTrips();

    return () => {
      mounted = false;
    };
  }, [setIsLoadingTrips, setTrips]);

  useEffect(() => {
    if (userId === null) {
      return;
    }

    getSavedPlans()
      .then((plans) => applySavedPlans(plans))
      .catch(() => {
        // Keep plans empty on failures.
      });
  }, [applySavedPlans, userId]);

  useEffect(() => {
    if (hasAutoCenteredOnUser) {
      return;
    }

    let cancelled = false;

    async function centerOnUser() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted || cancelled) {
          setHasAutoCenteredOnUser(true);
          return;
        }

        const position = await Location.getCurrentPositionAsync({});
        if (cancelled) {
          return;
        }

        const nextRegion = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 3,
          longitudeDelta: 3,
        };

        setRegion(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 950);
      } catch {
        // No-op when location fails.
      } finally {
        if (!cancelled) {
          setHasAutoCenteredOnUser(true);
        }
      }
    }

    void centerOnUser();

    return () => {
      cancelled = true;
    };
  }, [hasAutoCenteredOnUser]);

  const openTripById = useCallback(
    async (tripId: number | null) => {
      if (tripId === null) {
        clearSelections();
        setIsLoadingTripById(false);
        return;
      }

      const cached = tripLookup.get(tripId);
      if (cached) {
        setSelectedTrip(cached);
        flyTo({ latitude: cached.latitude, longitude: cached.longitude });
      }

      setIsLoadingTripById(true);

      try {
        const trip = await getTrip(tripId);
        if (trip.event_end && trip.event_start && new Date(trip.event_end) <= new Date()) {
          return;
        }

        upsertTrip(trip);
        setSelectedActivity(null);
        setSelectedLodging(null);
        setSelectedTrip(trip);
        flyTo({ latitude: trip.latitude, longitude: trip.longitude });
      } catch {
        // Keep cached state when fetch fails.
      } finally {
        setIsLoadingTripById(false);
      }
    },
    [
      clearSelections,
      flyTo,
      setIsLoadingTripById,
      setSelectedActivity,
      setSelectedLodging,
      setSelectedTrip,
      tripLookup,
      upsertTrip,
    ],
  );

  useEffect(() => {
    if (!params.selectTrip) {
      return;
    }

    const selectionKey = `${params.selectTrip}:${params.selectAt ?? ""}`;
    if (consumedSelectTripRef.current === selectionKey) {
      return;
    }

    consumedSelectTripRef.current = selectionKey;

    const id = Number(params.selectTrip);
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }

    void openTripById(id);
  }, [openTripById, params.selectAt, params.selectTrip]);

  const tripsAtSelectedLocation = useMemo(() => {
    if (!selectedTrip) {
      return [];
    }

    const selectedKey = getLocationKey(selectedTrip.latitude, selectedTrip.longitude);
    return trips
      .filter((trip) => getLocationKey(trip.latitude, trip.longitude) === selectedKey)
      .sort((left, right) => getTripTimestamp(right.date) - getTripTimestamp(left.date));
  }, [selectedTrip, trips]);

  const selectedTripLocationIndex = useMemo(() => {
    if (!selectedTrip) {
      return -1;
    }

    return tripsAtSelectedLocation.findIndex((trip) => trip.trip_id === selectedTrip.trip_id);
  }, [selectedTrip, tripsAtSelectedLocation]);

  const handleShowPreviousTripAtLocation = useCallback(() => {
    if (selectedTripLocationIndex <= 0) {
      return;
    }

    const previousTrip = tripsAtSelectedLocation[selectedTripLocationIndex - 1];
    if (!previousTrip) {
      return;
    }

    setSelectedActivity(null);
    setSelectedLodging(null);
    setSelectedTrip(previousTrip);
    flyTo({ latitude: previousTrip.latitude, longitude: previousTrip.longitude });
  }, [
    flyTo,
    selectedTripLocationIndex,
    setSelectedActivity,
    setSelectedLodging,
    setSelectedTrip,
    tripsAtSelectedLocation,
  ]);

  const handleShowNextTripAtLocation = useCallback(() => {
    if (selectedTripLocationIndex < 0 || selectedTripLocationIndex >= tripsAtSelectedLocation.length - 1) {
      return;
    }

    const nextTrip = tripsAtSelectedLocation[selectedTripLocationIndex + 1];
    if (!nextTrip) {
      return;
    }

    setSelectedActivity(null);
    setSelectedLodging(null);
    setSelectedTrip(nextTrip);
    flyTo({ latitude: nextTrip.latitude, longitude: nextTrip.longitude });
  }, [
    flyTo,
    selectedTripLocationIndex,
    setSelectedActivity,
    setSelectedLodging,
    setSelectedTrip,
    tripsAtSelectedLocation,
  ]);

  const handleToggleSavedActivity = useCallback(
    (activity: TripActivity) => {
      toggleSavedActivityId(activity.activity_id);
      toggleSavedActivity(activity.activity_id)
        .then((plans) => applySavedPlans(plans))
        .catch(() => {
          // ignore network failures for optimistic toggle.
        });
    },
    [applySavedPlans, toggleSavedActivityId],
  );

  const handleToggleSavedLodging = useCallback(
    (lodging: TripLodging) => {
      toggleSavedLodgingId(lodging.lodge_id);
      toggleSavedLodging(lodging.lodge_id)
        .then((plans) => applySavedPlans(plans))
        .catch(() => {
          // ignore network failures for optimistic toggle.
        });
    },
    [applySavedPlans, toggleSavedLodgingId],
  );

  useEffect(() => {
    if (
      typeof selectedActivity?.latitude !== "number" ||
      typeof selectedActivity?.longitude !== "number"
    ) {
      return;
    }

    flyTo({ latitude: selectedActivity.latitude, longitude: selectedActivity.longitude });
  }, [flyTo, selectedActivity?.activity_id, selectedActivity?.latitude, selectedActivity?.longitude]);

  useEffect(() => {
    if (
      typeof selectedLodging?.latitude !== "number" ||
      typeof selectedLodging?.longitude !== "number"
    ) {
      return;
    }

    flyTo({ latitude: selectedLodging.latitude, longitude: selectedLodging.longitude });
  }, [flyTo, selectedLodging?.lodge_id, selectedLodging?.latitude, selectedLodging?.longitude]);

  return (
    <View style={styles.container}>
      <MapView
        ref={(nextRef) => {
          mapRef.current = nextRef;
        }}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={(nextRegion) => setRegion(nextRegion)}
        scrollEnabled
        zoomEnabled
        pitchEnabled
        rotateEnabled
      >
        {representativeTrips.map((trip) => {
          const active =
            selectedTrip !== null &&
            getLocationKey(selectedTrip.latitude, selectedTrip.longitude) ===
              getLocationKey(trip.latitude, trip.longitude);

          return (
            <Marker
              key={`trip-${trip.trip_id}`}
              coordinate={{ latitude: trip.latitude, longitude: trip.longitude }}
              onPress={() => {
                void openTripById(trip.trip_id);
              }}
            >
              <TripMarkerView
                imageUrl={trip.thumbnail_url}
                title={trip.title}
                active={active}
                isPopup={Boolean(trip.event_end && trip.event_start)}
              />
            </Marker>
          );
        })}

        {selectedTrip?.activities
          .filter(
            (activity) =>
              typeof activity.latitude === "number" && typeof activity.longitude === "number",
          )
          .map((activity) => (
            <Marker
              key={`activity-${activity.activity_id}`}
              coordinate={{ latitude: activity.latitude as number, longitude: activity.longitude as number }}
              pinColor={
                selectedActivity?.activity_id === activity.activity_id
                  ? colors.primaryDark
                  : "#2d84c8"
              }
              onPress={() => {
                setSelectedActivity(
                  selectedActivity?.activity_id === activity.activity_id ? null : activity,
                );
                setSelectedLodging(null);
              }}
            />
          ))}

        {selectedTrip?.lodgings
          .filter(
            (lodging) =>
              typeof lodging.latitude === "number" && typeof lodging.longitude === "number",
          )
          .map((lodging) => (
            <Marker
              key={`lodging-${lodging.lodge_id}`}
              coordinate={{ latitude: lodging.latitude as number, longitude: lodging.longitude as number }}
              pinColor={
                selectedLodging?.lodge_id === lodging.lodge_id
                  ? colors.primaryDark
                  : "#4aa569"
              }
              onPress={() => {
                setSelectedLodging(
                  selectedLodging?.lodge_id === lodging.lodge_id ? null : lodging,
                );
                setSelectedActivity(null);
              }}
            />
          ))}
      </MapView>

      <SafeAreaView style={styles.topLeftArea} edges={["top"]} pointerEvents="box-none">
        <View pointerEvents="box-none" style={styles.topControls}>
          <Pressable onPress={() => router.push("/search")} style={styles.topButton}>
            <Ionicons name="search-outline" size={20} color={colors.text} />
          </Pressable>
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.topRightArea} edges={["top"]} pointerEvents="box-none">
        <View pointerEvents="box-none" style={styles.topControls}>
          <Pressable onPress={() => router.push("/plans")} style={styles.topButton}>
            <Ionicons name="bookmark-outline" size={20} color={colors.text} />
          </Pressable>

          {userId !== null ? (
            <Pressable
              onPress={() => router.push(`/profile/${userId}`)}
              style={styles.topButton}
            >
              <Ionicons name="person-outline" size={20} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>

      {selectedTrip ? (
        <TripDetailCard
          trip={selectedTrip}
          selectedActivityId={selectedActivity?.activity_id ?? null}
          selectedLodgingId={selectedLodging?.lodge_id ?? null}
          locationTripCount={tripsAtSelectedLocation.length}
          locationTripPosition={selectedTripLocationIndex >= 0 ? selectedTripLocationIndex + 1 : 1}
          canShowPreviousTripAtLocation={selectedTripLocationIndex > 0}
          canShowNextTripAtLocation={
            selectedTripLocationIndex >= 0 &&
            selectedTripLocationIndex < tripsAtSelectedLocation.length - 1
          }
          onShowPreviousTripAtLocation={handleShowPreviousTripAtLocation}
          onShowNextTripAtLocation={handleShowNextTripAtLocation}
          onClose={() => {
            void openTripById(null);
          }}
          onSelectActivity={setSelectedActivity}
          onSelectLodging={setSelectedLodging}
          onToggleSavedActivity={handleToggleSavedActivity}
          onToggleSavedLodging={handleToggleSavedLodging}
          savedActivityIds={savedActivityIdSet}
          savedLodgingIds={savedLodgingIdSet}
          onViewFull={() => router.push(`/trip/${selectedTrip.trip_id}`)}
          onOpenAuthorProfile={(authorUserId) => router.push(`/profile/${authorUserId}`)}
        />
      ) : null}

      <StudentAddFab
        visible={isStudent && !selectedTrip}
        onAddTrip={() => router.push("/trip-compose?mode=trip&returnTo=/map")}
        onAddPopUp={() => router.push("/trip-compose?mode=popup&returnTo=/map")}
      />

      {(isLoadingTrips || isLoadingTripById) && (
        <View style={styles.loadingBadge}>
          <ActivityIndicator size="small" color={colors.primaryDark} />
          <Text style={styles.loadingText}>Loading data...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.mapWater,
  },
  map: {
    flex: 1,
  },
  topLeftArea: {
    position: "absolute",
    top: 0,
    left: 0,
    paddingHorizontal: 12,
  },
  topRightArea: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  topControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  topButton: {
    width: 48,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingBadge: {
    position: "absolute",
    right: 12,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
});
