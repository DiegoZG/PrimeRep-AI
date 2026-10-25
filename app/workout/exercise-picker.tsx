import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ExerciseRow } from "@/components/explore";
import { CatalogPageFooter } from "@/components/exercises/CatalogPageFooter";
import { ScreenState } from "@/components/screen-state";
import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useExercisePages } from "@/hooks/use-exercise-pages";
import { useWorkoutWeek } from "@/hooks/use-workout-week";
import type { Exercise } from "@/interfaces/exercises";
import { AuthContext } from "@/utils/authContext";
import { useActiveWorkout } from "@/utils/activeWorkoutContext";
import { loadActiveWorkout } from "@/utils/activeWorkoutStore";
import { isReferenceOnlyExercise } from "@/utils/exerciseTracking";
import { localDateIso } from "@/utils/localDate";
import { workoutPlanningError } from "@/utils/workoutPlanning";

export default function WorkoutExercisePickerScreen() {
  const { workoutDayId, weekStart } = useLocalSearchParams<{ workoutDayId: string; weekStart: string }>();
  const router = useRouter(), colors = Colors[useColorScheme() ?? "light"];
  const { user, token } = useContext(AuthContext);
  const { weekPlan, getWorkoutById, refreshWeek, addExercise, planningRefreshRequired } = useWorkoutWeek();
  const { activeWorkout } = useActiveWorkout();
  const workout = weekPlan?.weekStart === weekStart ? getWorkoutById(workoutDayId) : null;
  const owner = `${user?.id ?? "guest"}:${token ?? "anonymous"}:${workoutDayId}:${weekStart}`;
  const ownerRef = useRef(owner), epoch = useRef(0), mounted = useRef(true), pending = useRef(false);
  if (ownerRef.current !== owner) { ownerRef.current = owner; epoch.current += 1; }
  const [busy, setBusy] = useState(false), [query, setQuery] = useState(""), [debounced, setDebounced] = useState("");
  const [localStatus, setLocalStatus] = useState<{ owner: string; started: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pages = useExercisePages(debounced);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; epoch.current += 1; }; }, []);
  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 250); return () => clearTimeout(timer); }, [query]);
  useEffect(() => { pending.current = false; setBusy(false); setMessage(null); }, [owner]);
  useEffect(() => { if (token && weekStart && weekPlan?.weekStart !== weekStart) void refreshWeek({ weekStart }); }, [token, weekStart, weekPlan?.weekStart, refreshWeek]);
  useFocusEffect(useCallback(() => {
    let cancelled = false; const requestEpoch = epoch.current;
    setLocalStatus(null);
    if (user?.id) void loadActiveWorkout(user.id).then((local) => { if (!cancelled && mounted.current && ownerRef.current === owner && epoch.current === requestEpoch) setLocalStatus({ owner, started: local?.workoutDayId === workoutDayId }); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id, owner, workoutDayId]));
  const existing = useMemo(() => new Set(workout?.blocks.flatMap((block) => block.items.map((item) => item.exercise.id)) ?? []), [workout]);
  const locked = !workout || !user || localStatus?.owner !== owner || localStatus.started || workout.planningEditable === false || Boolean(workout.programActivationId) || workout.date < localDateIso() || activeWorkout?.workoutDayId === workoutDayId;

  const choose = (exercise: Exercise) => {
    if (locked || busy || pending.current || planningRefreshRequired || existing.has(exercise.id) || isReferenceOnlyExercise(exercise) || !workout) return;
    pending.current = true; setBusy(true); setMessage(null);
    const requestEpoch = epoch.current;
    const isCurrent = () => mounted.current && ownerRef.current === owner && epoch.current === requestEpoch;
    const params = { workoutDayId, exerciseId: exercise.id, expectedExerciseIds: workout.blocks.flatMap((block) => block.items.map((item) => item.exercise.id)), weekStart, effectiveDate: localDateIso(), allowOverBudget: false };
    const release = () => { if (isCurrent()) { pending.current = false; setBusy(false); } };
    let confirming = false;
    const submit = async (allowOverBudget: boolean) => {
      try {
        const result = await addExercise({ ...params, allowOverBudget });
        if (!isCurrent()) return;
        if (!result) { setMessage("Refresh to confirm the latest workout before adding another exercise."); release(); return; }
        release(); router.back();
        if (result.orderPreservationFailed) Alert.alert("Exercise added", "Your exercise was added, but your previous order could not be saved. Review the exercise order before starting.");
      } catch (error) {
        if (!isCurrent()) return;
        const detail = (error as { payload?: { detail?: { code?: string; estimatedMinutes?: number; timeBudgetMinutes?: number } } })?.payload?.detail;
        if (!allowOverBudget && detail?.code === "workout_time_budget_exceeded") {
          Alert.alert("Add beyond your time budget?", `This plan is estimated at about ${detail.estimatedMinutes} minutes, above your ${detail.timeBudgetMinutes}-minute budget. Add the exercise and keep all existing exercises?`, [
            { text: "Cancel", style: "cancel", onPress: release },
            { text: "Add anyway", onPress: () => { if (isCurrent() && !confirming) { confirming = true; void submit(true); } } },
          ], { cancelable: false });
          return;
        }
        setMessage(workoutPlanningError(error)); release();
      }
    };
    void submit(false);
  };

  return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
    <View style={styles.backBar}><Pressable testID="workout-exercise-picker-back" accessibilityRole="button" accessibilityLabel="Back from Add exercise" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color={colors.text} /></Pressable></View>
    <ScrollView testID="workout-exercise-picker-scroll" style={styles.container} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={styles.heading}><ThemedText accessibilityRole="header" style={styles.title}>Add exercise</ThemedText><ThemedText style={{ color: colors.icon }}>{workout?.title ?? "Your workout"}</ThemedText><ThemedText style={{ color: colors.icon }}>Added to this workout only: 3 sets, 8–12 reps, 90s rest. You can edit targets after starting.</ThemedText></View>
      <View style={[styles.searchWrap, { borderColor: colors.inputBorder }]}><Ionicons name="search" size={20} color={colors.icon} /><TextInput testID="workout-exercise-search" accessibilityLabel="Search exercises" value={query} onChangeText={setQuery} placeholder="Search by exercise name" placeholderTextColor={colors.icon} style={[styles.search, { color: colors.text }]} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear exercise search" onPress={() => setQuery("")} style={styles.back}><Ionicons name="close-circle" size={20} color={colors.icon} /></Pressable> : null}</View>
      {locked && <ThemedText accessibilityRole="alert" style={{ color: colors.icon }}>Exercises can be added to an unstarted generated workout. Started, past and program workouts keep their plan.</ThemedText>}
      {message && <ThemedText testID="workout-exercise-add-message" accessibilityRole="alert">{message}</ThemedText>}
      {planningRefreshRequired && !busy && <Pressable testID="workout-exercise-refresh" accessibilityRole="button" accessibilityLabel="Refresh workout plan" onPress={() => void refreshWeek({ weekStart })} style={styles.action}><ThemedText>Refresh workout plan</ThemedText></Pressable>}
      {pages.loading ? <ScreenState colors={colors} kind="loading" title="Loading exercises…" /> : pages.error && !pages.items.length ? <ScreenState colors={colors} kind="error" title="Exercises unavailable" message={pages.error} actionLabel="Retry" onAction={pages.refresh} /> : <>
        {pages.items.map((exercise) => {
          const referenceOnly = isReferenceOnlyExercise(exercise), selected = existing.has(exercise.id);
          return <View key={exercise.id} style={styles.row}><ExerciseRow {...exercise} isFavorite={false} canFavorite={false} showFavoriteControl={false} isPressDisabled={locked || busy || planningRefreshRequired || selected || referenceOnly} disabledReason={referenceOnly ? "Reference only — tracking not supported" : selected ? "already added" : "workout unavailable or updating"} onPress={() => choose(exercise)} />{referenceOnly && <ThemedText style={{ color: colors.icon }}>Reference only — tracking not supported</ThemedText>}</View>;
        })}
        {!pages.items.length && <ScreenState colors={colors} kind="empty" title="No exercises found" message="Try another exercise name." />}
        <CatalogPageFooter colors={colors} loading={pages.loadingMore} error={pages.error} hasMore={pages.hasMore} onLoad={pages.loadMore} testID="workout-exercise-load-more" />
      </>}
      {busy && <ThemedText accessibilityLiveRegion="polite">Adding exercise…</ThemedText>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ container: { flex: 1 }, backBar: { paddingHorizontal: 16, paddingVertical: 4, alignItems: "flex-start" }, back: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }, content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 }, heading: { gap: 6 }, title: { fontSize: 24, fontWeight: "700" }, searchWrap: { minHeight: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }, search: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: 12 }, row: { gap: 6 }, action: { minHeight: 48, paddingVertical: 12, justifyContent: "center" } });
