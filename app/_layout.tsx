import { OfflineScreen } from "@/components/offline-screen";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthContext, AuthProvider } from "@/utils/authContext";
import { EquipmentProvider } from "@/utils/equipmentContext";
import { EquipmentWeightsProvider } from "@/utils/equipmentWeightsContext";
import { OnboardingProvider } from "@/utils/onboardingContext";
import { WorkoutWeekProvider } from "@/utils/workoutWeekContext";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useContext } from "react";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";

export const unstable_settings = {
  anchor: "(tabs)",
};

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}

function RootLayoutNav() {
  const {
    isBootstrapping,
    isLoggedIn,
    hasCompletedOnboarding,
    bootstrapError,
  } = useContext(AuthContext);

  if (isBootstrapping) {
    return <Splash />;
  }

  // Show offline screen if there's a bootstrap error (tokens still valid, just can't connect)
  if (bootstrapError) {
    return <OfflineScreen />;
  }

  const shouldShowOnboarding = !isLoggedIn || !hasCompletedOnboarding;

  return (
    <>
      {/* Maestro E2E marker: signals auth state has resolved. */}
      <View testID="auth-loaded" accessible={true} accessibilityLabel="auth-loaded" style={{ position: "absolute", width: 1, height: 1 }} />
      <Stack
        screenOptions={{
          animation: "slide_from_right",
          animationDuration: 250,
          headerShown: false,
        }}
      >
        <Stack.Protected guard={!shouldShowOnboarding}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="explore/category"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="explore/favorites"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="workout/today" options={{ headerShown: false }} />
          <Stack.Screen name="workout/active" options={{ headerShown: false }} />
          <Stack.Screen name="workout/summary" options={{ headerShown: false }} />
          <Stack.Screen
            name="exercises/[id]"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="workouts/[workoutDayId]"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen
            name="settings/dumbbells"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="settings/plates"
            options={{ headerShown: false }}
          />
        </Stack.Protected>

        <Stack.Protected guard={shouldShowOnboarding}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <OnboardingProvider>
          <EquipmentWeightsProvider>
            <EquipmentProvider>
              <WorkoutWeekProvider>
                <RootLayoutNav />
              </WorkoutWeekProvider>
            </EquipmentProvider>
          </EquipmentWeightsProvider>
        </OnboardingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
