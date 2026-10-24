import { OfflineScreen } from "@/components/offline-screen";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthContext, AuthProvider } from "@/utils/authContext";
import { ActiveWorkoutProvider } from "@/utils/activeWorkoutContext";
import { EquipmentProvider } from "@/utils/equipmentContext";
import { EquipmentWeightsProvider } from "@/utils/equipmentWeightsContext";
import { OnboardingContext, OnboardingProvider } from "@/utils/onboardingContext";
import { NotificationsProvider } from "@/utils/notificationsContext";
import { WorkoutWeekProvider } from "@/utils/workoutWeekContext";
import { ProgramDraftProvider } from "@/utils/programDraftContext";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import React, { useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { getActiveSession } from "@/services/workoutLoggingService";
import { loadActiveWorkout } from "@/utils/activeWorkoutStore";
import { getCoachItem, markCoachItemRead } from "@/services/coachService";
import { HttpError } from "@/services/httpClient";
import { coachTargetHref, isCoachTarget } from "@/utils/coachNavigation";
import { AppearanceProvider } from "@/utils/appearanceContext";
import { ProfileProvider } from "@/utils/profileContext";
import { HealthReadSync } from "@/utils/healthReadSync";
import { HealthExportSync } from "@/utils/healthExportSync";

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

type PendingCoachNotification = {
  response: Notifications.NotificationResponse;
  itemId: string | null;
  ownerUserId: string | null;
  attempt: number;
  malformed: boolean;
  navigated: boolean;
  resolvedItemId: string | null;
};

function coachNotificationIntent(
  response: Notifications.NotificationResponse | null,
  ownerUserId: string | null,
): PendingCoachNotification | null {
  const data = response?.notification.request.content.data;
  if (!response || data?.type !== "coach_item") return null;
  const valid =
    data.version === 1 &&
    typeof data.coachItemId === "string" &&
    data.coachItemId.trim().length > 0;
  return {
    response,
    itemId: valid ? data.coachItemId as string : null,
    ownerUserId,
    attempt: 0,
    malformed: !valid,
    navigated: false,
    resolvedItemId: null,
  };
}

function RootLayoutNav() {
  const {
    isBootstrapping,
    isLoggedIn,
    hasCompletedOnboarding,
    bootstrapError,
    offlineSession,
    token,
    user,
  } = useContext(AuthContext);
  const { isRestoring: isRestoringOnboarding } = useContext(OnboardingContext);
  const router = useRouter();
  const segments = useSegments();
  const routePath = segments.join("/");
  const isPublicRecoveryRoute =
    routePath.includes("forgot-password") ||
    routePath.includes("reset-password") ||
    routePath.includes("legal/");
  const attemptedResumeForIdentity = useRef<string | null>(null);
  const resumeRequestIdRef = useRef(0);
  const authIdentity = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const authIdentityRef = useRef(authIdentity);
  authIdentityRef.current = authIdentity;
  const authUserIdRef = useRef(user?.id ?? null);
  authUserIdRef.current = user?.id ?? null;
  const [resumeRevision, setResumeRevision] = useState(0);
  const [pendingCoachNotification, setPendingCoachNotification] =
    useState<PendingCoachNotification | null>(() =>
      Platform.OS === "web" ? null : coachNotificationIntent(Notifications.getLastNotificationResponse(), null),
    );
  const pendingCoachNotificationRef = useRef(pendingCoachNotification);
  pendingCoachNotificationRef.current = pendingCoachNotification;
  const notificationProcessingKeysRef = useRef(new Set<string>());
  const notificationRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationBlockedIdentityRef = useRef<string | null>(
    pendingCoachNotification ? "*" : null,
  );

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const intent = coachNotificationIntent(response, authUserIdRef.current);
        if (!intent) return;
        if (notificationRetryTimerRef.current) clearTimeout(notificationRetryTimerRef.current);
        notificationBlockedIdentityRef.current = "*";
        pendingCoachNotificationRef.current = intent;
        setPendingCoachNotification(intent);
      },
    );
    return () => {
      subscription.remove();
      if (notificationRetryTimerRef.current) clearTimeout(notificationRetryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (
      !pendingCoachNotification ||
      isBootstrapping ||
      !isLoggedIn ||
      !hasCompletedOnboarding ||
      !token ||
      !user
    ) return;

    if (pendingCoachNotification.ownerUserId === null) {
      const claimed = { ...pendingCoachNotification, ownerUserId: user.id };
      notificationBlockedIdentityRef.current = authIdentity;
      pendingCoachNotificationRef.current = claimed;
      setPendingCoachNotification(claimed);
      return;
    }

    const requestIdentity = authIdentity;
    const responseIdentifier = pendingCoachNotification.response.notification.request.identifier;
    const processingKey = `${requestIdentity}:${responseIdentifier}:${pendingCoachNotification.navigated ? "read" : "resolve"}:${pendingCoachNotification.attempt}`;
    if (notificationProcessingKeysRef.current.has(processingKey)) return;
    notificationProcessingKeysRef.current.add(processingKey);
    notificationBlockedIdentityRef.current = requestIdentity;

    const clearHandledIntent = () => {
      if (
        authIdentityRef.current !== requestIdentity ||
        pendingCoachNotificationRef.current !== pendingCoachNotification
      ) return;
      if (notificationRetryTimerRef.current) {
        clearTimeout(notificationRetryTimerRef.current);
        notificationRetryTimerRef.current = null;
      }
      try {
        const latestResponse = Notifications.getLastNotificationResponse();
        if (latestResponse?.notification.request.identifier === responseIdentifier) {
          Notifications.clearLastNotificationResponse();
        }
      } catch (error) {
        if (__DEV__) console.warn("Could not clear handled notification response", error);
      }
      attemptedResumeForIdentity.current = requestIdentity;
      notificationBlockedIdentityRef.current = null;
      pendingCoachNotificationRef.current = null;
      setPendingCoachNotification(null);
    };

    if (pendingCoachNotification.ownerUserId !== user.id) {
      router.replace("/(tabs)/feed");
      clearHandledIntent();
      notificationProcessingKeysRef.current.delete(processingKey);
      return;
    }

    if (pendingCoachNotification.malformed) {
      router.replace("/(tabs)/feed");
      clearHandledIntent();
      notificationProcessingKeysRef.current.delete(processingKey);
      return;
    }

    void (async () => {
      try {
        if (!pendingCoachNotification.navigated) {
          const item = await getCoachItem(token, pendingCoachNotification.itemId!);
          if (authIdentityRef.current !== requestIdentity || pendingCoachNotificationRef.current !== pendingCoachNotification) return;
          if (!isCoachTarget(item.target)) {
            router.replace("/(tabs)/feed");
            clearHandledIntent();
            return;
          }
          const href = coachTargetHref(item.target) ?? "/(tabs)/feed";
          router.replace(href);
          const navigatedIntent: PendingCoachNotification = {
            ...pendingCoachNotification,
            navigated: true,
            resolvedItemId: item.id,
            attempt: 0,
          };
          pendingCoachNotificationRef.current = navigatedIntent;
          setPendingCoachNotification(navigatedIntent);
          return;
        }

        await markCoachItemRead(token, pendingCoachNotification.resolvedItemId!, "primaryAction");
        if (authIdentityRef.current !== requestIdentity || pendingCoachNotificationRef.current !== pendingCoachNotification) return;
        clearHandledIntent();
      } catch (error) {
        if (authIdentityRef.current !== requestIdentity || pendingCoachNotificationRef.current !== pendingCoachNotification) return;
        const isTerminal =
          error instanceof HttpError &&
          error.status !== undefined &&
          [400, 401, 403, 404, 410, 422].includes(error.status);
        if (isTerminal) {
          if (!pendingCoachNotification.navigated) {
            router.replace("/(tabs)/feed");
          }
          clearHandledIntent();
          return;
        }
        const retryDelay = Math.min(30000, 1000 * (2 ** pendingCoachNotification.attempt));
        notificationRetryTimerRef.current = setTimeout(() => {
          if (
            authIdentityRef.current !== requestIdentity ||
            pendingCoachNotificationRef.current !== pendingCoachNotification
          ) return;
          const retry = { ...pendingCoachNotification, attempt: pendingCoachNotification.attempt + 1 };
          pendingCoachNotificationRef.current = retry;
          setPendingCoachNotification(retry);
        }, retryDelay);
      } finally {
        notificationProcessingKeysRef.current.delete(processingKey);
      }
    })();
  }, [
    authIdentity,
    hasCompletedOnboarding,
    isBootstrapping,
    isLoggedIn,
    pendingCoachNotification,
    router,
    token,
    user,
  ]);

  useEffect(() => {
    if (!isLoggedIn || !user) attemptedResumeForIdentity.current = null;
  }, [isLoggedIn, user]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        attemptedResumeForIdentity.current = null;
        setResumeRevision((revision) => revision + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (
      isBootstrapping ||
      (bootstrapError && !offlineSession) ||
      !isLoggedIn ||
      !hasCompletedOnboarding ||
      (!token && !offlineSession) ||
      !user ||
      (!offlineSession && pendingCoachNotification) ||
      (!offlineSession && notificationBlockedIdentityRef.current === "*") ||
      (!offlineSession && notificationBlockedIdentityRef.current === authIdentity) ||
      attemptedResumeForIdentity.current === authIdentity ||
      segments.join("/").includes("active") ||
      segments.join("/").includes("reset-password") ||
      segments.join("/").includes("forgot-password") ||
      segments.join("/").includes("legal/")
    ) {
      return;
    }

    attemptedResumeForIdentity.current = authIdentity;
    let cancelled = false;
    const requestId = ++resumeRequestIdRef.current;
    const requestAuthIdentity = authIdentity;
    void (async () => {
      // The server wins when it is reachable. A locally-created, unsynced
      // session remains resumable while offline.
      const [serverActive, localActive] = await Promise.all([
        token ? getActiveSession(token).catch(() => null) : Promise.resolve(null),
        loadActiveWorkout(user.id).catch(() => null),
      ]);
      const sessionId = serverActive?.id ?? localActive?.serverSessionId;
      const workoutDayId = serverActive?.workoutDayId ?? localActive?.workoutDayId;
      if (!cancelled && resumeRequestIdRef.current === requestId && authIdentityRef.current === requestAuthIdentity && (sessionId || workoutDayId)) {
        router.replace({ pathname: "/workout/active", params: sessionId ? { sessionId } : { workoutDayId: workoutDayId! } });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    authIdentity,
    isBootstrapping,
    bootstrapError,
    offlineSession,
    isLoggedIn,
    hasCompletedOnboarding,
    token,
    user,
    router,
    segments,
    resumeRevision,
    pendingCoachNotification,
  ]);

  if (isBootstrapping || (!isLoggedIn && isRestoringOnboarding)) {
    return <Splash />;
  }

  // Show offline screen if there's a bootstrap error (tokens still valid, just can't connect)
  if (bootstrapError && !offlineSession && !isPublicRecoveryRoute) {
    return <OfflineScreen />;
  }

  const shouldShowOnboarding = !isLoggedIn || !hasCompletedOnboarding;

  return (
    <>
      {/* Maestro E2E marker: signals auth state has resolved. */}
      <View testID="auth-loaded" accessible={true} accessibilityLabel="auth-loaded" style={{ position: "absolute", width: 1, height: 1 }} />
      {pendingCoachNotification ? (
        <View
          testID={pendingCoachNotification.attempt > 0
            ? "coach-notification-routing-retry"
            : pendingCoachNotification.navigated
              ? "coach-notification-routing-read"
              : "coach-notification-routing"}
          accessible={true}
          accessibilityLabel={pendingCoachNotification.attempt > 0
            ? "Retrying Coach notification"
            : pendingCoachNotification.navigated
              ? "Saving Coach notification read status"
              : "Opening Coach notification"}
          style={{ position: "absolute", width: 1, height: 1 }}
        />
      ) : null}
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
          <Stack.Screen name="programs/index" options={{ headerShown: false }} />
          <Stack.Screen name="programs/[templateId]" options={{ headerShown: false }} />
          <Stack.Screen name="programs/builder" options={{ headerShown: false }} />
          <Stack.Screen name="programs/day" options={{ headerShown: false }} />
          <Stack.Screen name="programs/exercise-picker" options={{ headerShown: false }} />
          <Stack.Screen name="programs/custom-exercise" options={{ headerShown: false }} />
          <Stack.Screen name="programs/activate" options={{ headerShown: false }} />
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
          <Stack.Screen name="settings/admin-feature-flag-users" options={{ headerShown: false }} />
          <Stack.Screen name="settings/admin-feature-flags" options={{ headerShown: false }} />
          <Stack.Screen name="settings/help" options={{ headerShown: false }} />
          <Stack.Screen name="settings/export" options={{ headerShown: false }} />
          <Stack.Screen name="profile/edit" options={{ headerShown: false }} />
          <Stack.Screen name="profile/achievements" options={{ headerShown: false }} />
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
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="legal/terms" options={{ headerShown: false }} />
        <Stack.Screen name="legal/privacy" options={{ headerShown: false }} />
      </Stack>
      {offlineSession && !routePath.includes("workout/active") && !isPublicRecoveryRoute ? (
        <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}>
          <OfflineScreen />
        </View>
      ) : null}
      <StatusBar style="auto" />
    </>
  );
}

function ThemedRootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <HealthReadSync />
          <HealthExportSync />
          <ProfileProvider>
          <NotificationsProvider>
            <OnboardingProvider>
              <EquipmentWeightsProvider>
                <EquipmentProvider>
                  <WorkoutWeekProvider>
                    <ProgramDraftProvider>
                      <ActiveWorkoutProvider>
                        <RootLayoutNav />
                      </ActiveWorkoutProvider>
                    </ProgramDraftProvider>
                  </WorkoutWeekProvider>
                </EquipmentProvider>
              </EquipmentWeightsProvider>
            </OnboardingProvider>
          </NotificationsProvider>
          </ProfileProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <AppearanceProvider>
      <ThemedRootLayout />
    </AppearanceProvider>
  );
}
