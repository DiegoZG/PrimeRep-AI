import { Stack } from "expo-router";

export default function TrainingPlaceLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackVisible: true,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerTitle: "Training Place (8/9)",
        }}
      />
    </Stack>
  );
}
