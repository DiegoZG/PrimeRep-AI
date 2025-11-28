import { Link } from "expo-router";
import React from "react";
import { Text, View } from "react-native";

const OnboardingFirstScreen = () => {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Onboarding Screen 1</Text>
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
    </View>
  );
};

export default OnboardingFirstScreen;
