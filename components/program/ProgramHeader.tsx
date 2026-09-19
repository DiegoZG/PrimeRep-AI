import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function ProgramHeader({ title, subtitle, onBack, backDisabled = false, action }: { title: string; subtitle?: string; onBack: () => void; backDisabled?: boolean; action?: React.ReactNode }) {
  const colors = Colors[useColorScheme() ?? "light"];
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Back from ${title}`} accessibilityState={{ disabled: backDisabled }} disabled={backDisabled} onPress={onBack} style={[styles.action, { opacity: backDisabled ? 0.35 : 1 }]}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>
      <View style={styles.copy}>
        <ThemedText numberOfLines={1} style={styles.title}>{title}</ThemedText>
        {subtitle ? <ThemedText numberOfLines={1} style={[styles.subtitle, { color: colors.placeholder }]}>{subtitle}</ThemedText> : null}
      </View>
      <View style={styles.action}>{action}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  action: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  title: { fontSize: 22, fontWeight: "800", fontFamily: Fonts.sans },
  subtitle: { marginTop: 2, fontSize: 12 },
});
