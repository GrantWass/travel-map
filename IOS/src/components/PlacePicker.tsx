import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "@/src/constants/theme";
import { useDebouncedValue } from "@/src/hooks/use-debounced-value";
import { searchPlaces } from "@/src/services/place-service";
import type { PlaceCenter, PlaceOption } from "@/src/types/places";
import { PinMapModal } from "@/src/components/PinMapModal";

type PlaceSearchMode = "city" | "address";

interface PlacePickerProps {
  label: string;
  placeholder?: string;
  value: PlaceOption | null;
  onChange: (value: PlaceOption | null) => void;
  mode?: PlaceSearchMode;
  cityContext?: PlaceCenter | null;
  allowMapPin?: boolean;
}

export function PlacePicker({
  label,
  placeholder = "Search for a place",
  value,
  onChange,
  mode = "address",
  cityContext = null,
  allowMapPin = false,
}: PlacePickerProps) {
  const [query, setQuery] = useState(value?.label || "");
  const [results, setResults] = useState<PlaceOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    setQuery(value?.label || "");
  }, [value?.label]);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;

    async function runSearch() {
      setIsLoading(true);
      try {
        const places = await searchPlaces(debouncedQuery, mode, cityContext);
        if (cancelled) {
          return;
        }

        setResults(places);
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [cityContext, debouncedQuery, mode]);

  const showSuggestions = useMemo(
    () => isOpen && (isLoading || results.length > 0 || query.trim().length >= 2),
    [isLoading, isOpen, query, results.length],
  );

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          value={query}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 120);
          }}
          onChangeText={(nextQuery) => {
            setQuery(nextQuery);
            if (value) {
              onChange(null);
            }
          }}
          placeholder={placeholder}
          style={styles.input}
        />
        {value ? (
          <Pressable
            onPress={() => {
              setQuery("");
              onChange(null);
            }}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>x</Text>
          </Pressable>
        ) : null}
      </View>

      {showSuggestions ? (
        <View style={styles.suggestionsCard}>
          {isLoading ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={colors.primaryDark} />
              <Text style={styles.statusText}>Searching places...</Text>
            </View>
          ) : results.length > 0 ? (
            results.map((result) => (
              <Pressable
                key={`${result.label}-${result.latitude}-${result.longitude}`}
                onPress={() => {
                  onChange(result);
                  setQuery(result.label);
                  setIsOpen(false);
                }}
                style={styles.suggestionRow}
              >
                <Text style={styles.suggestionText}>{result.label}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.statusText}>No places found.</Text>
          )}
        </View>
      ) : null}

      <View style={styles.footerRow}>
        {value ? (
          <Text style={styles.footerLabel} numberOfLines={2}>
            Selected: {value.label}
          </Text>
        ) : (
          <Text style={styles.footerLabel}>
            {mode === "city" && allowMapPin
              ? "Search a city, or drop a pin for a precise location."
              : mode === "city"
                ? "Pick a broad area like a city or suburb."
                : "Search an address or drop a pin on the map."}
          </Text>
        )}

        {allowMapPin ? (
          <Pressable onPress={() => setMapPickerOpen(true)} style={styles.pinButton}>
            <Text style={styles.pinButtonText}>Drop pin on map</Text>
          </Pressable>
        ) : null}
      </View>

      <PinMapModal
        open={mapPickerOpen}
        cityContext={cityContext}
        initialValue={value}
        onClose={() => setMapPickerOpen(false)}
        onConfirm={(place) => {
          onChange(place);
          setQuery(place.label);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    color: colors.mutedText,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  inputShell: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: colors.primarySoft,
  },
  clearButtonText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "700",
  },
  suggestionsCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  statusText: {
    color: colors.mutedText,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  suggestionRow: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f2eadf",
  },
  suggestionText: {
    color: colors.text,
    fontSize: 12,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  footerLabel: {
    flex: 1,
    color: colors.mutedText,
    fontSize: 11,
  },
  pinButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pinButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "600",
  },
});
