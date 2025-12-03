import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function FitnessExperienceLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerTitle: "Fitness Experience (3/9)",
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
