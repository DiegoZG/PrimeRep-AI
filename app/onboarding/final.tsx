import { AuthContext } from "@/utils/authContext";
import React, { useContext } from "react";
import { Text, TouchableOpacity } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const OnboardingFinalScreen = () => {
  const { completeOnboarding } = useContext(AuthContext);
  return (
    <ThemedView
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <ThemedText type="title">OnboardingFinalScreen</ThemedText>
      <TouchableOpacity
        onPress={completeOnboarding}
        style={{
          backgroundColor: "#007AFF",
          paddingHorizontal: 32,
          paddingVertical: 12,
          borderRadius: 8,
          minWidth: 200,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
          Complete onboarding
        </Text>
      </TouchableOpacity>
    </ThemedView>
  );
};

export default OnboardingFinalScreen;
