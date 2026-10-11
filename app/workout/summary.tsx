import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getSession, type SessionResponse } from "@/services/workoutLoggingService";
import { reconcileAppleHealthExport } from "@/services/health/exportSync";
import { PRIVACY_VERSION } from "@/constants/legal";
import { AuthContext } from "@/utils/authContext";
import { formatWeightInput, fromKg, loadWeightUnit, type WeightUnit } from "@/utils/weightUnits";

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`;
}

function StatCard({ id, icon, label, value, colors, singleColumn }: { id: string; icon: keyof typeof Ionicons.glyphMap; label: string; value: string; colors: typeof Colors.light; singleColumn: boolean }) {
  return (
    <View testID={`summary-stat-${id}`} accessible accessibilityLabel={`${label}: ${value}`} style={{ flexGrow: 1, flexBasis: singleColumn ? "100%" : "48%", borderRadius: 16, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons accessible={false} name={icon} size={20} color={colors.icon} />
        <ThemedText style={{ fontSize: 14, color: colors.icon, flexShrink: 1 }}>{label}</ThemedText>
      </View>
      <ThemedText type="defaultSemiBold" style={{ fontSize: 22, color: colors.text, marginTop: 8 }}>{value}</ThemedText>
    </View>
  );
}

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const { token, user } = useContext(AuthContext);
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const colors = Colors[useColorScheme() ?? "light"];
  const { width, fontScale } = useWindowDimensions();
  const [ownedSession, setOwnedSession] = useState<{ ownerId: string; sessionId: string; value: SessionResponse } | null>(null);
  const [unit, setUnit] = useState<WeightUnit>("LB");
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const session = ownedSession && ownedSession.ownerId === user?.id && ownedSession.sessionId === sessionId ? ownedSession.value : null;

  useFocusEffect(useCallback(() => {
    if (!token || !user?.id || !sessionId) { setError(true); return; }
    let cancelled = false;
    setError(false);
    setRefreshing(true);
    void loadWeightUnit().then((value) => { if (!cancelled) setUnit(value); });
    void getSession(token, sessionId).then((result) => {
      if (!cancelled) setOwnedSession({ ownerId: user.id, sessionId, value: result });
      if (!cancelled && result.status === 'completed' && user.privacy_accepted_version === PRIVACY_VERSION) void reconcileAppleHealthExport(token, user.id, () => !cancelled).catch(() => undefined);
    }).catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
  }, [token, user?.id, user?.privacy_accepted_version, sessionId]));

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
    return <SafeAreaView testID="summary-loading" style={{ flex: 1, backgroundColor: colors.background }}><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.icon} accessibilityLabel="Loading workout summary" /></View></SafeAreaView>;
  }
  if (!session || session.status !== "completed") {
    return <SafeAreaView testID="summary-unavailable" style={{ flex: 1, backgroundColor: colors.background }}><ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 }}><ThemedText style={{ textAlign: "center" }}>Workout summary unavailable.</ThemedText><Pressable testID="summary-unavailable-home" accessibilityRole="button" accessibilityLabel="Back to Home" onPress={handleDone} style={({ pressed }) => ({ marginTop: 16, minHeight: 44, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.inputBorder, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}><ThemedText style={{ color: colors.text, textAlign: "center" }}>Back to Home</ThemedText></Pressable></ScrollView></SafeAreaView>;
  }
  const volume = unit === "LB" ? fromKg(session.summary.totalVolumeKg, unit) : session.summary.totalVolumeKg;
  const metricValues = [formatDuration(session.summary.durationSeconds), String(session.summary.completedSetCount), `${Math.round(volume).toLocaleString()} ${unit.toLowerCase()}`, session.workoutNote ? "Saved" : "—"];
  const singleColumn = width < 360 || fontScale > 1.3 || metricValues.some((value) => value.length * 13 * fontScale > (width - 60) / 2 - 32);
  const handleShare = async () => {
    const names = Array.from(exerciseNames.values());
    try {
      await Share.share({
        title: session.summary.title,
        message: `${session.summary.title}\n${formatDuration(session.summary.durationSeconds)} · ${session.summary.completedSetCount} sets · ${Math.round(volume).toLocaleString()} ${unit.toLowerCase()} total volume${names.length ? `\n${names.join(", ")}` : ""}\n\nCompleted with PrimeRep.`,
      });
    } catch {
      Alert.alert("Couldn't Share Workout", "The share sheet could not open.", [
        { text: "Cancel", style: "cancel" },
        { text: "Try Again", onPress: () => void handleShare() },
      ]);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <ScrollView testID="summary-scroll" contentContainerStyle={{ padding: 24, paddingBottom: 40, flexGrow: 1 }}>
        {refreshing ? <ThemedText accessibilityLiveRegion="polite" style={{ color: colors.icon, textAlign: "center" }}>Refreshing workout…</ThemedText> : error ? <Pressable testID="summary-refresh-error" accessibilityRole="button" accessibilityLabel="Couldn’t refresh totals. Review the saved workout." onPress={() => router.push({ pathname: "/workout/history/[sessionId]", params: { sessionId: session.id } })} style={({ pressed }) => ({ minHeight: 44, paddingVertical: 12, justifyContent: "center", opacity: pressed ? 0.7 : 1 })}><ThemedText style={{ color: colors.background === "#fff" ? "#DC2626" : "#F87171", textAlign: "center" }}>Couldn’t refresh totals. Review the saved workout.</ThemedText></Pressable> : null}
        <View testID="summary-header" style={{ alignItems: "center", marginTop: 12, marginBottom: 24 }}>
          <Ionicons accessible={false} name="checkmark-circle-outline" size={36} color={colors.background === "#fff" ? "#15803D" : "#4ADE80"} style={{ marginBottom: 12 }} />
          <ThemedText type="title" style={{ fontSize: 26, textAlign: "center" }}>Workout Complete!</ThemedText>
          <ThemedText style={{ fontSize: 16, color: colors.icon, marginTop: 6, textAlign: "center" }}>{session.summary.title}</ThemedText>
        </View>
        <View testID="summary-metrics" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <StatCard id="duration" icon="time-outline" label="Duration" value={metricValues[0]} colors={colors} singleColumn={singleColumn} />
          <StatCard id="sets" icon="checkmark-done-outline" label="Sets" value={metricValues[1]} colors={colors} singleColumn={singleColumn} />
          <StatCard id="volume" icon="barbell-outline" label="Total Volume" value={metricValues[2]} colors={colors} singleColumn={singleColumn} />
          <StatCard id="note" icon="chatbubble-ellipses-outline" label="Note" value={metricValues[3]} colors={colors} singleColumn={singleColumn} />
        </View>
        {session.workoutNote ? <View testID="summary-note" style={{ marginTop: 18, borderRadius: 16, padding: 16, backgroundColor: colors.inputBackground }}><ThemedText type="defaultSemiBold">Workout note</ThemedText><ThemedText style={{ marginTop: 6, color: colors.text }}>{session.workoutNote}</ThemedText></View> : null}
        <View style={{ marginTop: 22 }}>
          <ThemedText type="defaultSemiBold" style={{ fontSize: 18 }}>Logged sets</ThemedText>
          {logsByExercise.length === 0 ? (
            <ThemedText testID="summary-empty-sets" style={{ color: colors.icon, marginTop: 8 }}>No sets were logged for this workout.</ThemedText>
          ) : logsByExercise.map(([exerciseId, logs]) => (
            <View key={exerciseId} testID={`summary-exercise-${exerciseId}`} style={{ marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder }}>
              <ThemedText type="defaultSemiBold">{exerciseNames.get(String(exerciseId)) ?? exerciseId}</ThemedText>
              {logs.map((set) => {
                const displayWeight = set.weightKg == null ? "Bodyweight" : `${formatWeightInput(fromKg(set.weightKg, unit))} ${unit.toLowerCase()}`;
                return <ThemedText key={set.id} style={{ color: colors.text, marginTop: 6 }}>Set {set.setNumber}: {displayWeight} × {set.reps}</ThemedText>;
              })}
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <Pressable testID="summary-share" accessibilityRole="button" accessibilityLabel="Share workout summary" onPress={() => void handleShare()} style={({ pressed }) => ({ marginTop: 28, minHeight: 48, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.inputBorder, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, backgroundColor: colors.inputBackground, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons accessible={false} name="share-outline" size={20} color={colors.icon} />
          <ThemedText style={{ color: colors.text, fontSize: 16, fontWeight: "600", fontFamily: Fonts.sans, flexShrink: 1, textAlign: "center" }}>Share workout</ThemedText>
        </Pressable>
        <Pressable testID={`summary-detail-${session.id}`} accessibilityRole="button" accessibilityLabel="Review or correct workout" onPress={() => router.push({ pathname: "/workout/history/[sessionId]", params: { sessionId: session.id } })} style={({ pressed }) => ({ marginTop: 12, minHeight: 48, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.inputBorder, opacity: pressed ? 0.7 : 1 })}>
          <ThemedText style={{ color: colors.text, fontSize: 16, fontWeight: "600", fontFamily: Fonts.sans, textAlign: "center" }}>Review or correct workout</ThemedText>
        </Pressable>
        <Pressable testID="summary-done" accessibilityRole="button" accessibilityLabel="Done with workout summary" onPress={handleDone} style={({ pressed }) => ({ marginTop: 12, minHeight: 52, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? "#5940D8" : colors.primaryButton })}>
          <ThemedText style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600", fontFamily: Fonts.sans, textAlign: "center" }}>Done</ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
