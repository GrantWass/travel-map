import { Image, StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/constants/theme";

interface TripMarkerViewProps {
  imageUrl: string;
  title: string;
  active: boolean;
  isPopup: boolean;
}

export function TripMarkerView({ imageUrl, title, active, isPopup }: TripMarkerViewProps) {
  return (
    <View style={[styles.marker, active && styles.markerActive]}>
      <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
      <View style={styles.gradient} />
      <Text numberOfLines={1} style={styles.title}>
        {title || "Untitled"}
      </Text>
      {isPopup ? <View style={styles.popupBadge} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "#ddd",
  },
  markerActive: {
    borderColor: colors.primary,
    transform: [{ scale: 1.08 }],
  },
  image: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 28,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  title: {
    position: "absolute",
    left: 4,
    right: 4,
    bottom: 4,
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  popupBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: "#fff",
  },
});
