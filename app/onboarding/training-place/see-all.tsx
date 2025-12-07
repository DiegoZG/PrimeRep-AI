import { useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function SeeAllScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          {params.category || "Equipment"}
        </Text>
        <Text style={[styles.description, { color: colors.placeholder }]}>
          This screen will be implemented later.
        </Text>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    textAlign: "center",
  },
});
