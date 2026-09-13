import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getSession, type SessionResponse } from "@/services/workoutLoggingService";
import { AuthContext } from "@/utils/authContext";
import { formatWeightInput, fromKg, loadWeightUnit, type WeightUnit } from "@/utils/weightUnits";

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`;
}

function StatCard({ icon, label, value, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; colors: typeof Colors.light }) {
  return (
    <View style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, padding: 16, alignItems: "center" }}>
      <Ionicons name={icon} size={20} color={colors.primaryButton} style={{ marginBottom: 8 }} />
      <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>{value}</ThemedText>
      <ThemedText style={{ fontSize: 12, color: colors.placeholder, marginTop: 2 }}>{label}</ThemedText>
    </View>
  );
}

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const { token } = useContext(AuthContext);
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const colors = Colors[useColorScheme() ?? "light"];
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [unit, setUnit] = useState<WeightUnit>("LB");
  const [error, setError] = useState(false);

  useEffect(() => { void loadWeightUnit().then(setUnit); }, []);
  useEffect(() => {
    if (!token || !sessionId) { setError(true); return; }
    let cancelled = false;
    void getSession(token, sessionId).then((result) => {
      if (!cancelled) setSession(result);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [token, sessionId]);

  const exerciseNames = useMemo(() => new Map(
    (session?.workoutSnapshot?.exerciseBlocks ?? [])
      .flatMap((block) => block.items)
      .map((item) => [String(item.exercise.id), item.exercise.name])
  ), [session?.workoutSnapshot]);
  const logsByExercise = useMemo(() => {
    const groups = new Map<string, SessionResponse["setLogs"]>();
    session?.setLogs.forEach((set) => groups.set(set.exerciseId, [...(groups.get(set.exerciseId) ?? []), set]));
    return Array.from(groups.entries()).map(([exerciseId, logs]) => [exerciseId, logs.sort((left, right) => left.setNumber - right.setNumber)] as const);
  }, [session?.setLogs]);

  const handleDone = () => router.replace("/(tabs)");
  if (!session && !error) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primaryButton} /></View></SafeAreaView>;
  }
  if (!session || session.status !== "completed") {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}><ThemedText>Workout summary unavailable.</ThemedText><Pressable onPress={handleDone} style={{ marginTop: 16 }}><ThemedText style={{ color: colors.primaryButton }}>Back to Home</ThemedText></Pressable></View></SafeAreaView>;
  }
  const volume = unit === "LB" ? fromKg(session.summary.totalVolumeKg, unit) : session.summary.totalVolumeKg;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40, flexGrow: 1 }}>
        <View style={{ alignItems: "center", marginTop: 12, marginBottom: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: `${colors.primaryButton}18`, alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Ionicons name="checkmark-circle" size={40} color={colors.primaryButton} /></View>
          <ThemedText type="title" style={{ fontSize: 26, textAlign: "center" }}>Workout Complete!</ThemedText>
          <ThemedText style={{ fontSize: 15, color: colors.placeholder, marginTop: 6 }}>{session.summary.title}</ThemedText>
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <StatCard icon="time-outline" label="Duration" value={formatDuration(session.summary.durationSeconds)} colors={colors} />
          <StatCard icon="checkmark-done-outline" label="Sets" value={String(session.summary.completedSetCount)} colors={colors} />
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <StatCard icon="barbell-outline" label="Total Volume" value={`${Math.round(volume).toLocaleString()} ${unit.toLowerCase()}`} colors={colors} />
          <StatCard icon="chatbubble-ellipses-outline" label="Note" value={session.workoutNote ? "Saved" : "—"} colors={colors} />
        </View>
        {session.workoutNote ? <View style={{ marginTop: 18, borderRadius: 16, padding: 16, backgroundColor: colors.inputBackground }}><ThemedText type="defaultSemiBold">Workout note</ThemedText><ThemedText style={{ marginTop: 6, color: colors.placeholder }}>{session.workoutNote}</ThemedText></View> : null}
        <View style={{ marginTop: 22 }}>
          <ThemedText type="defaultSemiBold" style={{ fontSize: 18 }}>Logged sets</ThemedText>
          {logsByExercise.length === 0 ? (
            <ThemedText testID="summary-empty-sets" style={{ color: colors.placeholder, marginTop: 8 }}>No sets were logged for this workout.</ThemedText>
          ) : logsByExercise.map(([exerciseId, logs]) => (
            <View key={exerciseId} testID={`summary-exercise-${exerciseId}`} style={{ marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder }}>
              <ThemedText type="defaultSemiBold">{exerciseNames.get(String(exerciseId)) ?? exerciseId}</ThemedText>
              {logs.map((set, index) => {
                const displayWeight = set.weightKg == null ? "Bodyweight" : `${formatWeightInput(fromKg(set.weightKg, unit))} ${unit.toLowerCase()}`;
                return <ThemedText key={set.id} style={{ color: colors.placeholder, marginTop: 6 }}>Set {index + 1}: {displayWeight} × {set.reps}</ThemedText>;
              })}
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <Pressable testID={`summary-detail-${session.id}`} accessibilityRole="button" accessibilityLabel="Review or correct workout" onPress={() => router.push({ pathname: "/workout/history/[sessionId]", params: { sessionId: session.id } })} style={{ marginTop: 32, paddingVertical: 14, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: colors.inputBorder }}>
          <ThemedText style={{ color: colors.text, fontSize: 16, fontWeight: "600", fontFamily: Fonts.sans }}>Review or correct workout</ThemedText>
        </Pressable>
        <Pressable testID="summary-done" accessibilityRole="button" accessibilityLabel="Done with workout summary" onPress={handleDone} style={{ marginTop: 12, paddingVertical: 16, borderRadius: 14, alignItems: "center", backgroundColor: colors.primaryButton }}>
          <ThemedText style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600", fontFamily: Fonts.sans }}>Done</ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
