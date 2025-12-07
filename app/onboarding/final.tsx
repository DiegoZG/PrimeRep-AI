import { AuthContext } from "@/utils/authContext";
import React, { useContext, useEffect } from "react";
import { Text, TouchableOpacity } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { OnboardingContext } from "@/utils/onboardingContext";

const OnboardingFinalScreen = () => {
  const { completeOnboarding } = useContext(AuthContext);
  const { data } = useContext(OnboardingContext);

  useEffect(() => {
    console.log("First Name:", data.firstName);
    console.log("Reason:", data.reason);
    console.log("Age:", data.age);
    console.log("Body Stats", {
      weight: data.weight,
      unit: data.weightUnit,
      age: data.age,
      gender: data.gender,
    });
    console.log("Experience Level:", data.experienceLevel);
    console.log("1RM", {
      squat: data.backSquat1RM,
      deadlift: data.deadlift1RM,
      bench: data.benchPress1RM,
    });
    console.log("fitness goal", data.fitnessGoal);
    console.log("training frequency", data.workoutFrequency);
    console.log("workout split", data.workoutSplit);
    console.log("variety level", data.varietyLevel);
    console.log("training place", data.trainingPlace);
    console.log("customWorkouts", data.customWorkouts);
  }, [data.firstName, data.reason]);
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
