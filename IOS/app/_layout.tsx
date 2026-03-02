import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/src/constants/theme";
import { AuthProvider } from "@/src/hooks/use-auth";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="profile-setup" />
            <Stack.Screen name="map" />
            <Stack.Screen name="search" options={{ presentation: "modal" }} />
            <Stack.Screen name="plans" options={{ presentation: "modal" }} />
            <Stack.Screen name="profile/[userId]" options={{ presentation: "modal" }} />
            <Stack.Screen name="trip/[tripId]" />
            <Stack.Screen name="trip-compose" />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
