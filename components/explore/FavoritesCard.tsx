import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface FavoritesCardProps {
  count: number;
  onPress: () => void;
}

export function FavoritesCard({ count, onPress }: FavoritesCardProps) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  return (
    <Pressable
      testID="explore-favorites"
      accessibilityRole="button"
      accessibilityLabel={`Open favorites, ${count} ${count === 1 ? "exercise" : "exercises"}`}
      onPress={onPress}
      style={({ pressed }) => [styles.container, {
        backgroundColor: colors.inputBackground,
        borderColor: colors.inputBorder,
        opacity: pressed ? 0.78 : 1,
      }]}
    >
      <Ionicons name="heart" size={24} color={scheme === "dark" ? "#F27C90" : "#C9334A"} />
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Favorites</Text>
        <Text style={[styles.count, { color: colors.icon }]}>
          {count} {count === 1 ? "exercise" : "exercises"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 76, borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  textContainer: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: "700", fontFamily: Fonts.sans },
  count: { marginTop: 3, fontSize: 14, fontWeight: "500", fontFamily: Fonts.sans },
});
