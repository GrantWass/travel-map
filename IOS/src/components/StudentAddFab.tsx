import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/constants/theme";

interface StudentAddFabProps {
  visible: boolean;
  onAddTrip: () => void;
  onAddPopUp: () => void;
}

export function StudentAddFab({ visible, onAddTrip, onAddPopUp }: StudentAddFabProps) {
  const [open, setOpen] = useState(false);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      {open ? (
        <View style={styles.menu}>
          <Pressable
            onPress={() => {
              setOpen(false);
              onAddTrip();
            }}
            style={styles.menuButton}
          >
            <Text style={styles.menuButtonText}>Add Trip</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setOpen(false);
              onAddPopUp();
            }}
            style={styles.menuButton}
          >
            <Text style={styles.menuButtonText}>Add Pop-Up</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Text style={styles.fabText}>{open ? "x" : "+"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: "center",
    gap: 8,
  },
  menu: {
    gap: 8,
  },
  menuButton: {
    backgroundColor: colors.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  menuButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 8,
  },
  fabPressed: {
    opacity: 0.9,
  },
  fabText: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 28,
    fontWeight: "500",
  },
});
