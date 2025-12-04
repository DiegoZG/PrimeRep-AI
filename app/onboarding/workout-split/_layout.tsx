import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function WorkoutSplitLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerTitle: "Workout Split (6/9)",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginLeft: 5 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="custom"
        options={{
          headerTitle: "Custom Split (6/9)",
        }}
      />
      <Stack.Screen
        name="add-workout-modal"
        options={{
          presentation: "modal",
          headerTitle: "",
          headerShown: false,
        }}
      />
    </Stack>
  );
}
