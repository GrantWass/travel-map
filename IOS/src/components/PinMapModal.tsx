import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";

import { colors } from "@/src/constants/theme";
import { reverseGeocode } from "@/src/services/place-service";
import type { PlaceCenter, PlaceOption } from "@/src/types/places";

interface PinMapModalProps {
  open: boolean;
  cityContext?: PlaceCenter | null;
  initialValue?: PlaceOption | null;
  onClose: () => void;
  onConfirm: (place: PlaceOption) => void;
}

const DEFAULT_REGION: Region = {
  latitude: 39.5,
  longitude: -98.35,
  latitudeDelta: 24,
  longitudeDelta: 24,
};

export function PinMapModal({
  open,
  cityContext = null,
  initialValue = null,
  onClose,
  onConfirm,
}: PinMapModalProps) {
  const [pendingPlace, setPendingPlace] = useState<PlaceOption | null>(initialValue);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPendingPlace(initialValue || null);
  }, [initialValue, open]);

  const initialRegion = useMemo<Region>(() => {
    if (initialValue) {
      return {
        latitude: initialValue.latitude,
        longitude: initialValue.longitude,
        latitudeDelta: 0.4,
        longitudeDelta: 0.4,
      };
    }

    if (cityContext) {
      return {
        latitude: cityContext.latitude,
        longitude: cityContext.longitude,
        latitudeDelta: 0.6,
        longitudeDelta: 0.6,
      };
    }

    return DEFAULT_REGION;
  }, [cityContext, initialValue]);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Drop a pin</Text>
              <Text style={styles.subtitle}>
                {cityContext ? `Centered near ${cityContext.label}` : "Tap anywhere to pin a location."}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>x</Text>
            </Pressable>
          </View>

          <MapView
            style={styles.map}
            initialRegion={initialRegion}
            onPress={(event) => {
              const lat = Number(event.nativeEvent.coordinate.latitude.toFixed(6));
              const lon = Number(event.nativeEvent.coordinate.longitude.toFixed(6));

              setIsResolvingAddress(true);

              reverseGeocode(lat, lon)
                .then((place) => {
                  setPendingPlace(place);
                })
                .catch(() => {
                  const fallback = `Pinned location (${lat}, ${lon})`;
                  setPendingPlace({
                    label: fallback,
                    address: fallback,
                    latitude: lat,
                    longitude: lon,
                  });
                })
                .finally(() => {
                  setIsResolvingAddress(false);
                });
            }}
          >
            {pendingPlace ? (
              <Marker
                coordinate={{
                  latitude: pendingPlace.latitude,
                  longitude: pendingPlace.longitude,
                }}
                pinColor={colors.primaryDark}
              />
            ) : null}
          </MapView>

          <View style={styles.footer}>
            {isResolvingAddress ? (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={colors.primaryDark} />
                <Text style={styles.statusText}>Resolving address...</Text>
              </View>
            ) : (
              <Text style={styles.statusText} numberOfLines={2}>
                {pendingPlace ? pendingPlace.label : "Tap on the map to drop a pin."}
              </Text>
            )}

            <View style={styles.actionsRow}>
              <Pressable onPress={onClose} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!pendingPlace || isResolvingAddress) {
                    return;
                  }
                  onConfirm(pendingPlace);
                  onClose();
                }}
                disabled={!pendingPlace || isResolvingAddress}
                style={[
                  styles.primaryButton,
                  (!pendingPlace || isResolvingAddress) && styles.primaryButtonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>Use this pin</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: "92%",
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
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 2,
    color: colors.mutedText,
    fontSize: 12,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  map: {
    width: "100%",
    height: 420,
  },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    color: colors.mutedText,
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
