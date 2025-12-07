import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TrainingPlaceLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

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
        name="equipment"
        options={{
          headerTitle: "Equipment (8/9)",
        }}
      />
      <Stack.Screen
        name="edit-dumbbells"
        options={{
          headerTitle: "Dumbbells",
        }}
      />
      <Stack.Screen
        name="edit-plates"
        options={{
          headerTitle: "Plates",
        }}
      />
      <Stack.Screen
        name="see-all"
        options={{
          headerTitle: "",
        }}
      />
      <Stack.Screen
        name="search-equipment"
        options={{
          headerTitle: "Search Equipment",
        }}
      />
    </Stack>
  );
}
