import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";

type ScreenStateProps = {
  colors: typeof Colors.light;
  kind: "loading" | "empty" | "error";
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

export function ScreenState({ colors, kind, title, message, actionLabel, onAction, testID }: ScreenStateProps) {
  if (kind === "loading") {
    return (
      <View testID={testID} style={styles.container} accessibilityLabel={title ?? "Loading"}>
        <ActivityIndicator color={colors.primaryButton} />
        {title ? <ThemedText style={[styles.message, { color: colors.placeholder }]}>{title}</ThemedText> : null}
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.container}>
      <Ionicons
        name={kind === "error" ? "cloud-offline-outline" : "barbell-outline"}
        size={32}
        color={kind === "error" ? "#FF3B30" : colors.primaryButton}
      />
      {title ? <ThemedText type="defaultSemiBold" style={styles.title}>{title}</ThemedText> : null}
      {message ? <ThemedText style={[styles.message, { color: colors.placeholder }]}>{message}</ThemedText> : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={[styles.action, { backgroundColor: colors.primaryButton }]}
        >
          <ThemedText style={styles.actionText}>{actionLabel}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 40 },
  title: { marginTop: 12, fontSize: 18, textAlign: "center" },
  message: { marginTop: 8, fontSize: 14, lineHeight: 20, textAlign: "center" },
  action: { minHeight: 44, marginTop: 18, paddingHorizontal: 22, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionText: { color: "#FFFFFF", fontWeight: "700" },
});
