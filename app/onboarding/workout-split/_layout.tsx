import { Stack } from "expo-router";

export default function WorkoutSplitLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerTitle: "Workout Split (6/9)",
        }}
      />
      <Stack.Screen
        name="custom"
        options={{
          headerTitle: "Custom Split (6/9)",
        }}
      />
    </Stack>
  );
}
