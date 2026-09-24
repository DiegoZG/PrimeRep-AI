import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "./themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Achievement } from "@/services/profileService";

export function ProfileAvatar({ uri, name, size = 76 }: { uri: string | null; name: string; size?: number }) {
  const colors = Colors[useColorScheme() ?? "light"];
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const initials = name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "P";
  return <View accessibilityLabel={`${name || "Your"} profile photo`} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${colors.primaryButton}18`, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
    {uri && !failed ? <Image source={{ uri }} cachePolicy="none" contentFit="cover" onError={() => setFailed(true)} style={{ width: size, height: size }} /> : <ThemedText style={{ color: colors.primaryButton, fontSize: size * 0.34, lineHeight: size * 0.55, fontWeight: "700" }}>{initials}</ThemedText>}
  </View>;
}

export function ProfilePage({ title, onBack, children, action, testID }: { title: string; onBack: () => void; children: ReactNode; action?: ReactNode; testID?: string }) {
  const colors = Colors[useColorScheme() ?? "light"];
  return <SafeAreaView testID={testID} edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={[profileStyles.header, { borderBottomColor: colors.inputBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={`Back from ${title}`} testID="profile-page-back" style={profileStyles.iconButton}><Ionicons name="arrow-back" size={26} color={colors.text} /></Pressable>
      <ThemedText accessibilityRole="header" style={{ flex: 1, fontSize: 22, lineHeight: 29, fontWeight: "700" }}>{title}</ThemedText>
      {action}
    </View>
    {children}
  </SafeAreaView>;
}

export function ProfileScroll({ children }: { children: ReactNode }) {
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={profileStyles.pageContent}>{children}</ScrollView>;
}

export function AchievementRow({ item }: { item: Achievement }) {
  const colors = Colors[useColorScheme() ?? "light"];
  const earned = Boolean(item.earned_at);
  const progress = Math.min(item.progress, item.threshold);
  return <View testID={`achievement-${item.id}`} accessibilityLabel={`${item.title}. ${earned ? `Earned ${new Date(item.earned_at!).toLocaleDateString()}` : `${progress} of ${item.threshold}`}. ${item.description}`} style={[profileStyles.achievement, { borderBottomColor: colors.inputBorder }]}>
    <View style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 3, borderColor: earned ? colors.primaryButton : colors.inputBorder, alignItems: "center", justifyContent: "center" }}><Ionicons name={earned ? "checkmark" : item.kind === "consistency" ? "flame-outline" : "barbell-outline"} size={20} color={earned ? colors.primaryButton : colors.icon} /></View>
    <View style={{ flex: 1, gap: 4 }}>
      <ThemedText style={{ fontWeight: "600" }}>{item.title}</ThemedText>
      <ThemedText style={{ fontSize: 13, lineHeight: 19, color: colors.icon }}>{earned ? `Earned ${new Date(item.earned_at!).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : `${progress} of ${item.threshold}`}</ThemedText>
      {!earned ? <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: item.threshold, now: progress }} style={{ height: 5, borderRadius: 3, backgroundColor: colors.inputBorder, overflow: "hidden" }}><View style={{ height: 5, width: `${Math.min(100, progress / item.threshold * 100)}%`, backgroundColor: colors.primaryButton }} /></View> : null}
    </View>
  </View>;
}

export const profileStyles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  pageContent: { padding: 22, paddingBottom: 36, gap: 22, maxWidth: 720, width: "100%", alignSelf: "center" },
  section: { paddingVertical: 22, borderTopWidth: StyleSheet.hairlineWidth, gap: 14 },
  sectionHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  heading: { fontSize: 18, lineHeight: 25, fontWeight: "700", flexShrink: 1 },
  link: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: 4 },
  achievement: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  error: { color: "#E5484D", fontSize: 14, lineHeight: 21 },
  muted: { fontSize: 14, lineHeight: 21 },
});
