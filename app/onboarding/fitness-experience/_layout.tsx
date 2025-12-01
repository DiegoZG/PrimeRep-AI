import { Stack } from "expo-router";

export default function FitnessExperienceLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerTitle: "Fitness Experience (3/9)",
        }}
      />
      <Stack.Screen
        name="one-rep-max"
        options={{
          headerTitle: "Fitness Experience (3/9)",
        }}
      />
      <Stack.Screen
        name="calculator-modal"
        options={{
          presentation: "transparentModal",
          headerTitle: "",
          headerShown: false,
        }}
      />
    </Stack>
  );
}

