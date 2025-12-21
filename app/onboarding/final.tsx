import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text } from "react-native";

import { AnimatedButton } from "@/components/animated-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

const OnboardingFinalScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Ready to start?
      </ThemedText>
      <ThemedText type="subtitle" style={styles.subtitle}>
        Create your account to begin your fitness journey
      </ThemedText>

      <AnimatedButton
        onPress={() => router.push("/signup")}
        style={[
          styles.primaryButton,
          { backgroundColor: colors.primaryButton },
        ]}
      >
        <Text style={styles.primaryButtonText}>Create account</Text>
      </AnimatedButton>

      <AnimatedButton
        onPress={() => router.push("/login")}
        style={styles.secondaryButton}
      >
        <ThemedText type="link" style={styles.secondaryButtonText}>
          I already have an account
        </ThemedText>
      </AnimatedButton>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    marginBottom: 48,
    textAlign: "center",
    opacity: 0.7,
  },
  primaryButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    width: "100%",
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
  },
});

export default OnboardingFinalScreen;
