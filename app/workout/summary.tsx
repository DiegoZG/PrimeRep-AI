import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface WorkoutSummaryPayload {
  workoutName: string;
  durationSeconds: number;
  setsCompleted: number;
  totalSets: number;
  totalVolumeKg: number;
  weightUnit?: "KG" | "LB";
  prExerciseNames: string[];
}

const LB_PER_KG = 2.2046226218;

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function parsePayload(raw: string | undefined): WorkoutSummaryPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      workoutName: typeof parsed.workoutName === "string" ? parsed.workoutName : "Workout",
      durationSeconds: Number(parsed.durationSeconds) || 0,
      setsCompleted: Number(parsed.setsCompleted) || 0,
      totalSets: Number(parsed.totalSets) || 0,
      totalVolumeKg: Number(parsed.totalVolumeKg) || 0,
      weightUnit: parsed.weightUnit === "LB" || parsed.weightUnit === "KG" ? parsed.weightUnit : "KG",
      prExerciseNames: Array.isArray(parsed.prExerciseNames) ? parsed.prExerciseNames : [],
    };
  } catch (err) {
    console.warn("Failed to parse workout summary payload:", err);
    return null;
  }
}

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: typeof Colors.light;
}

function StatCard({ icon, label, value, colors }: StatCardProps) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        backgroundColor: colors.inputBackground,
        padding: 16,
        alignItems: "center",
      }}
    >
      <Ionicons name={icon} size={20} color={colors.primaryButton} style={{ marginBottom: 8 }} />
      <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>
        {value}
      </ThemedText>
      <ThemedText style={{ fontSize: 12, color: colors.placeholder, marginTop: 2 }}>
        {label}
      </ThemedText>
    </View>
  );
}

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { payload } = useLocalSearchParams<{ payload?: string }>();

  const summary = useMemo(() => parsePayload(payload), [payload]);

  const handleShare = () => {
    Alert.alert("Share Workout", "Sharing is coming soon!");
  };

  const handleDone = () => {
    // Pop back to the tabs root rather than pushing a new screen, so the
    // workout flow doesn't linger in the back stack.
    if (router.canDismiss()) {
      router.dismissAll();
    } else {
      router.replace("/(tabs)");
    }
  };

  if (!summary) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <ThemedText>Workout summary unavailable.</ThemedText>
          <Pressable onPress={handleDone} style={{ marginTop: 16 }}>
            <ThemedText style={{ color: colors.primaryButton }}>Back to Home</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40, flexGrow: 1 }}>
        {/* Celebration header */}
        <View style={{ alignItems: "center", marginTop: 12, marginBottom: 32 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: `${colors.primaryButton}18`,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="checkmark-circle" size={40} color={colors.primaryButton} />
          </View>
          <ThemedText type="title" style={{ fontSize: 26, textAlign: "center" }}>
            Workout Complete!
          </ThemedText>
          <ThemedText style={{ fontSize: 15, color: colors.placeholder, marginTop: 6 }}>
            {summary.workoutName}
          </ThemedText>
        </View>

        {/* Stat grid */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <StatCard
            icon="time-outline"
            label="Duration"
            value={formatDuration(summary.durationSeconds)}
            colors={colors}
          />
          <StatCard
            icon="checkmark-done-outline"
            label="Sets"
            value={`${summary.setsCompleted}/${summary.totalSets}`}
            colors={colors}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <StatCard
            icon="barbell-outline"
            label="Total Volume"
            value={
              summary.weightUnit === "LB"
                ? `${Math.round(summary.totalVolumeKg * LB_PER_KG).toLocaleString()} lb`
                : `${Math.round(summary.totalVolumeKg).toLocaleString()} kg`
            }
            colors={colors}
          />
          <StatCard
            icon="trophy-outline"
            label="PRs"
            value={`${summary.prExerciseNames.length}`}
            colors={colors}
          />
        </View>

        {/* PR list */}
        {summary.prExerciseNames.length > 0 && (
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              backgroundColor: colors.inputBackground,
              padding: 16,
              marginTop: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 }}>
              <Ionicons name="trophy" size={18} color="#F5A623" />
              <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>
                New Personal Records
              </ThemedText>
            </View>
            {summary.prExerciseNames.map((name) => (
              <ThemedText key={name} style={{ fontSize: 14, marginBottom: 4, color: colors.text }}>
                • {name}
              </ThemedText>
            ))}
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* Actions */}
        <View style={{ gap: 12, marginTop: 32 }}>
          <Pressable
            onPress={handleShare}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.inputBorder,
            }}
          >
            <Ionicons name="share-outline" size={18} color={colors.text} />
            <ThemedText style={{ fontSize: 15, fontWeight: "600", fontFamily: Fonts.sans }}>
              Share Workout
            </ThemedText>
          </Pressable>

          <Pressable
            testID="summary-done"
            onPress={handleDone}
            style={{
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: "center",
              backgroundColor: colors.primaryButton,
            }}
          >
            <ThemedText style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
              Done
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
