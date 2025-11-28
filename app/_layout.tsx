import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthContext, AuthProvider } from "@/utils/authContext";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useContext } from "react";
import "react-native-reanimated";

export const unstable_settings = {
  anchor: "(tabs)",
};

const shouldCreateAccount = false;

function RootLayoutNav() {
  const { isLoggedIn, hasCompletedOnboarding } = useContext(AuthContext);
  console.log({ isLoggedIn });

  return (
    <>
      <Stack>
        <Stack.Protected guard={isLoggedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!isLoggedIn && hasCompletedOnboarding}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Protected guard={shouldCreateAccount}>
            <Stack.Screen name="signup" />
          </Stack.Protected>
        </Stack.Protected>

        <Stack.Protected guard={!hasCompletedOnboarding}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
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
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
