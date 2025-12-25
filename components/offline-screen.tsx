import React, { useContext } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthContext } from "@/utils/authContext";

export function OfflineScreen() {
  const { retryBootstrap, bootstrapError } = useContext(AuthContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        {bootstrapError === "network"
          ? "No Internet Connection"
          : "Server Error"}
      </ThemedText>
      <ThemedText type="default" style={styles.message}>
        {bootstrapError === "network"
          ? "Please check your connection and try again."
          : "Something went wrong. Please try again."}
      </ThemedText>
      <Pressable
        onPress={retryBootstrap}
        style={[styles.retryButton, { backgroundColor: colors.primaryButton }]}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    marginBottom: 16,
    textAlign: "center",
  },
  message: {
    marginBottom: 32,
    textAlign: "center",
    opacity: 0.7,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

