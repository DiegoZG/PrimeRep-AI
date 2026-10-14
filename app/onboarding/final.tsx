import { Stack, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedButton } from "@/components/animated-button";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

const OnboardingFinalScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const insets = useSafeAreaInsets();

  return (
    <>
      <ScrollView
        testID="onboarding-final-scroll"
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(24, insets.bottom) },
        ]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <ThemedText
          type="title"
          style={styles.title}
          testID="onboarding-final-title"
        >
          Ready to start?
        </ThemedText>
        <ThemedText type="subtitle" style={styles.subtitle}>
          Create your account to begin your fitness journey
        </ThemedText>

        <AnimatedButton
          accessibilityRole="button"
          accessibilityLabel="Create account"
          testID="onboarding-final-create-account"
          onPress={() => router.push("/signup")}
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primaryButton },
          ]}
        >
          <Text style={styles.primaryButtonText}>Create account</Text>
        </AnimatedButton>

        <AnimatedButton
          accessibilityRole="button"
          accessibilityLabel="I already have an account"
          testID="onboarding-final-login"
          onPress={() => router.push("/login")}
          style={styles.secondaryButton}
        >
          <ThemedText style={styles.secondaryButtonText}>
            I already have an account
          </ThemedText>
        </AnimatedButton>
      </ScrollView>
      <Stack.Screen options={{ headerRight: () => null }} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  title: {
    width: "100%",
    lineHeight: 40,
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    width: "100%",
    marginBottom: 48,
    textAlign: "center",
    opacity: 0.7,
  },
  primaryButton: {
    width: "100%",
    minHeight: 56,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  secondaryButton: {
    width: "100%",
    minHeight: 44,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
});

export default OnboardingFinalScreen;
