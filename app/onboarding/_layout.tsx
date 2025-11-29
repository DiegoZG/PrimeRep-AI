import { Stack, useRouter } from "expo-router";
import { Text, TouchableOpacity } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { OnboardingProvider } from "@/utils/onboardingContext";

export default function OnboardingLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          headerTitle: "Welcome",
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: "600",
            color: colors.text,
          },
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          animation: "slide_from_right",
          animationDuration: 250,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/onboarding/final")}
              style={{ marginRight: 16 }}
            >
              <Text style={{ color: colors.electricBlue, fontSize: 16 }}>
                Skip
              </Text>
            </TouchableOpacity>
          ),
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerTitle: "First name",
          }}
        />
        <Stack.Screen
          name="welcome"
          options={{
            headerTitle: "Welcome",
          }}
        />
      </Stack>
    </OnboardingProvider>
  );
}
