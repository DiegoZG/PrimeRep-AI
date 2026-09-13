import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenState } from "@/components/screen-state";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWorkoutWeek } from "@/hooks/use-workout-week";
import { listCompletedSessions } from "@/services/workoutLoggingService";
import { useActiveWorkout } from "@/utils/activeWorkoutContext";
import { AuthContext } from "@/utils/authContext";

function localIsoDate() {
  const value = new Date();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

export default function CoachScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { token, user } = useContext(AuthContext);
  const { activeWorkout, refreshActiveWorkout } = useActiveWorkout();
  const { weekPlan, isLoading, error, refreshWeek, getSortedWorkouts } = useWorkoutWeek();
  const [completedWorkoutIds, setCompletedWorkoutIds] = useState<Set<string>>(new Set());
  const [completedOwnerId, setCompletedOwnerId] = useState<string | null>(null);
  const [isCompletedLoading, setIsCompletedLoading] = useState(true);
  const [completedError, setCompletedError] = useState(false);
  const [completedRevision, setCompletedRevision] = useState(0);
  const completedRequestIdRef = useRef(0);
  const completedRevisionRef = useRef(completedRevision);
  completedRevisionRef.current = completedRevision;
  const accountKey = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const accountKeyRef = useRef(accountKey);
  accountKeyRef.current = accountKey;

  useEffect(() => {
    setCompletedWorkoutIds(new Set());
    setCompletedOwnerId(null);
    setCompletedError(false);
    setIsCompletedLoading(Boolean(user && token));
  }, [accountKey, token, user]);

  useFocusEffect(useCallback(() => {
    void refreshActiveWorkout();
  }, [refreshActiveWorkout]));

  useFocusEffect(useCallback(() => {
    if (!token || !user) return;
    let cancelled = false;
    const requestId = ++completedRequestIdRef.current;
    const requestAccountKey = accountKey;
    const requestRevision = completedRevision;
    const isCurrentRequest = () => !cancelled && completedRequestIdRef.current === requestId && completedRevisionRef.current === requestRevision && accountKeyRef.current === requestAccountKey;

    setIsCompletedLoading(true);
    setCompletedError(false);
    void listCompletedSessions(token, 100)
      .then((response) => {
        if (!isCurrentRequest()) return;
        setCompletedWorkoutIds(new Set(response.items.map((session) => session.workoutDayId)));
        setCompletedOwnerId(user.id);
      })
      .catch(() => {
        if (!isCurrentRequest()) return;
        setCompletedError(true);
      })
      .finally(() => {
        if (isCurrentRequest()) setIsCompletedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountKey, completedRevision, token, user]));

  const sortedWorkouts = useMemo(() => getSortedWorkouts(), [getSortedWorkouts]);
  const nextWorkout = useMemo(() => {
    const today = localIsoDate();
    if (!user || completedOwnerId !== user.id) return null;
    return sortedWorkouts.find((workout) => workout.date >= today && !completedWorkoutIds.has(workout.workoutDayId)) ?? null;
  }, [completedOwnerId, completedWorkoutIds, sortedWorkouts, user]);

  const openWorkout = () => {
    if (activeWorkout) {
      router.push({ pathname: "/workout/active", params: activeWorkout.sessionId ? { sessionId: activeWorkout.sessionId } : { workoutDayId: activeWorkout.workoutDayId } });
    } else if (nextWorkout) {
      router.push({ pathname: "/workouts/[workoutDayId]", params: { workoutDayId: nextWorkout.workoutDayId, weekStart: weekPlan?.weekStart } });
    }
  };

  if ((isLoading && !weekPlan && !activeWorkout) || (isCompletedLoading && !activeWorkout)) {
    return <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}><ScreenState colors={colors} kind="loading" title="Preparing your next workout…" testID="coach-loading" /></SafeAreaView>;
  }
  if (error && !weekPlan && !activeWorkout) {
    return <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}><ScreenState colors={colors} kind="error" title="Coach couldn't load" message="Check your connection and try again." actionLabel="Retry" onAction={() => void refreshWeek({ force: false })} testID="coach-error" /></SafeAreaView>;
  }
  if (completedError && !activeWorkout) {
    return <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}><ScreenState colors={colors} kind="error" title="Coach couldn't confirm your next workout" message="Your workout history couldn't load, so no completed workout will be recommended again." actionLabel="Retry" onAction={() => setCompletedRevision((revision) => revision + 1)} testID="coach-error" /></SafeAreaView>;
  }

  const title = activeWorkout?.title ?? nextWorkout?.title;
  const exerciseCount = nextWorkout?.blocks.reduce((count, block) => count + block.items.length, 0) ?? 0;
  const description = activeWorkout
    ? `${activeWorkout.completedSets}${activeWorkout.totalSets ? ` of ${activeWorkout.totalSets}` : ""} sets complete. Pick up exactly where you left off.`
    : nextWorkout?.workoutIntent ?? (nextWorkout ? `${exerciseCount} exercises planned for a focused ${nextWorkout.durationMinutes}-minute session.` : "");

  return (
    <SafeAreaView testID="coach-screen" style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View><ThemedText type="title" style={styles.title}>Coach</ThemedText><ThemedText style={[styles.subtitle, { color: colors.placeholder }]}>Your next useful move</ThemedText></View>
          <View style={[styles.coachMark, { backgroundColor: `${colors.primaryButton}18` }]}><Ionicons name="sparkles" size={24} color={colors.primaryButton} /></View>
        </View>
        {!title ? (
          <ScreenState
            colors={colors}
            kind="empty"
            title={sortedWorkouts.length > 0 ? "Training is done for this week" : "No workout scheduled"}
            message={sortedWorkouts.length > 0 ? "No unfinished workouts remain this week. Make today a recovery day." : "Your next recommendation will appear when a workout is added to your week."}
            actionLabel="Refresh week"
            onAction={() => void refreshWeek({ force: false })}
            testID="coach-empty"
          />
        ) : (
          <Pressable testID={activeWorkout ? "coach-resume-workout" : "coach-open-workout"} accessibilityRole="button" accessibilityLabel={`${activeWorkout ? "Resume" : "Open"} ${title}`} onPress={openWorkout} style={[styles.focusCard, { backgroundColor: colors.primaryButton }]}>
            <View style={styles.cardTop}><ThemedText style={styles.cardLabel}>{activeWorkout ? "Continue training" : "Up next"}</ThemedText><Ionicons name="arrow-forward-circle" size={30} color="#FFFFFF" /></View>
            <ThemedText style={styles.cardTitle}>{title}</ThemedText>
            {!activeWorkout && nextWorkout ? <ThemedText style={styles.cardMeta}>{nextWorkout.date} · {nextWorkout.durationMinutes} min · {nextWorkout.dayType.replace(/_/g, " ")}</ThemedText> : null}
            <ThemedText style={styles.cardBody}>{description}</ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }, title: { fontSize: 32, fontWeight: "800", fontFamily: Fonts.sans }, subtitle: { fontSize: 15, marginTop: 3 }, coachMark: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" }, focusCard: { borderRadius: 22, padding: 22 }, cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, cardLabel: { color: "rgba(255,255,255,0.82)", fontSize: 14, fontWeight: "700" }, cardTitle: { color: "#FFFFFF", fontSize: 27, lineHeight: 33, fontWeight: "800", marginTop: 18 }, cardMeta: { color: "rgba(255,255,255,0.78)", fontSize: 14, marginTop: 6, textTransform: "capitalize" }, cardBody: { color: "#FFFFFF", fontSize: 16, lineHeight: 23, marginTop: 18 }, scopeNote: { marginTop: 20, borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: "row", gap: 10 }, scopeText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
