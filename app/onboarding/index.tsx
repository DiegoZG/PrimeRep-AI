import { Link } from "expo-router";
import React from "react";
import { Text } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const OnboardingFirstScreen = () => {
  return (
    <ThemedView
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <ThemedText type="title">Onboarding Screen 1</ThemedText>
      <Link
        asChild
        href="/onboarding/final"
        style={{
          backgroundColor: "lightblue",
          paddingHorizontal: 20,
          paddingVertical: 20,
          borderRadius: 50,
          marginTop: 20,
        }}
      >
        <Text style={{ color: "black", fontSize: 16, fontWeight: "600" }}>
          Continue
        </Text>
      </Link>
    </ThemedView>
  );
};

export default OnboardingFirstScreen;
