import { OfflineScreen } from "@/components/offline-screen";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthContext, AuthProvider } from "@/utils/authContext";
import { EquipmentProvider } from "@/utils/equipmentContext";
import { OnboardingProvider } from "@/utils/onboardingContext";
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
      <Stack
        screenOptions={{
          animation: "slide_from_right",
          animationDuration: 250,
          headerShown: false,
        }}
      >
        <Stack.Protected guard={!shouldShowOnboarding}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
          <EquipmentProvider>
            <RootLayoutNav />
          </EquipmentProvider>
        </OnboardingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
