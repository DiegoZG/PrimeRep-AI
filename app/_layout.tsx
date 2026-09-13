import { OfflineScreen } from "@/components/offline-screen";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthContext, AuthProvider } from "@/utils/authContext";
import { ActiveWorkoutProvider } from "@/utils/activeWorkoutContext";
import { EquipmentProvider } from "@/utils/equipmentContext";
import { EquipmentWeightsProvider } from "@/utils/equipmentWeightsContext";
import { OnboardingContext, OnboardingProvider } from "@/utils/onboardingContext";
import { NotificationsProvider } from "@/utils/notificationsContext";
import { WorkoutWeekProvider } from "@/utils/workoutWeekContext";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import "react-native-reanimated";
import { getActiveSession } from "@/services/workoutLoggingService";
import { loadActiveWorkout } from "@/utils/activeWorkoutStore";

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
    token,
    user,
  } = useContext(AuthContext);
  const { isRestoring: isRestoringOnboarding } = useContext(OnboardingContext);
  const router = useRouter();
  const segments = useSegments();
  const attemptedResumeForUser = useRef<string | null>(null);
  const [resumeRevision, setResumeRevision] = useState(0);

  useEffect(() => {
    if (!isLoggedIn || !user) attemptedResumeForUser.current = null;
  }, [isLoggedIn, user]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        attemptedResumeForUser.current = null;
        setResumeRevision((revision) => revision + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (
      isBootstrapping ||
      bootstrapError ||
      !isLoggedIn ||
      !hasCompletedOnboarding ||
      !token ||
      !user ||
      attemptedResumeForUser.current === user.id ||
      segments.join("/").includes("active")
    ) {
      return;
    }

    attemptedResumeForUser.current = user.id;
    void (async () => {
      // The server wins when it is reachable. A locally-created, unsynced
      // session remains resumable while offline.
      const [serverActive, localActive] = await Promise.all([
        getActiveSession(token).catch(() => null),
        loadActiveWorkout(user.id).catch(() => null),
      ]);
      const sessionId = serverActive?.id ?? localActive?.serverSessionId;
      const workoutDayId = serverActive?.workoutDayId ?? localActive?.workoutDayId;
      if (sessionId || workoutDayId) {
        router.replace({ pathname: "/workout/active", params: sessionId ? { sessionId } : { workoutDayId: workoutDayId! } });
      }
    })();
  }, [
    isBootstrapping,
    bootstrapError,
    isLoggedIn,
    hasCompletedOnboarding,
    token,
    user,
    router,
    segments,
    resumeRevision,
  ]);

  if (isBootstrapping || (!isLoggedIn && isRestoringOnboarding)) {
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
          <Stack.Screen name="workout/history" options={{ headerShown: false }} />
          <Stack.Screen name="workout/history/[sessionId]" options={{ headerShown: false }} />
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
            name="settings/training-preferences"
            options={{ headerShown: false }}
          />
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
        <NotificationsProvider>
          <OnboardingProvider>
            <EquipmentWeightsProvider>
              <EquipmentProvider>
                <WorkoutWeekProvider>
                  <ActiveWorkoutProvider>
                    <RootLayoutNav />
                  </ActiveWorkoutProvider>
                </WorkoutWeekProvider>
              </EquipmentProvider>
            </EquipmentWeightsProvider>
          </OnboardingProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
