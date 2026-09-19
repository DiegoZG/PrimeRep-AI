import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProgramHeader } from "@/components/program";
import { ScreenState } from "@/components/screen-state";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWorkoutWeek } from "@/hooks/use-workout-week";
import type { ActivationPreview, ActiveProgramState, ProgramActivationResponse, ProgramApplyMode, ProgramDetail } from "@/interfaces/programs";
import { activateProgram, createProgramOperationId, getActiveProgram, getProgram, previewProgramActivation } from "@/services/programService";
import { mapApiWeekPlan } from "@/services/workoutWeekService";
import { AuthContext } from "@/utils/authContext";
import { EquipmentContext } from "@/utils/equipmentContext";
import { localDateIso, nextLocalMondayIso } from "@/utils/localDate";
import { WEEKDAY_LABELS, todayIso } from "@/utils/programDisplay";

function defaultWeekdays(count: number) {
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, index) => Math.round(index * 6 / (count - 1)));
}

export default function ActivateProgramScreen() {
  const { templateId, applyMode: routeApplyMode, review } = useLocalSearchParams<{ templateId: string; applyMode?: ProgramApplyMode; review?: string }>();
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { token, user } = useContext(AuthContext);
  const { items: equipment } = useContext(EquipmentContext);
  const { weekPlan, currentWeekStart, installWeekPlan, refreshWeek, syncCurrentWeek } = useWorkoutWeek();
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [activePrograms, setActivePrograms] = useState<ActiveProgramState>({ current: null, scheduled: null });
  const [programOwnerKey, setProgramOwnerKey] = useState<string | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [applyMode, setApplyMode] = useState<ProgramApplyMode>(routeApplyMode === "next-week" ? "next-week" : "now");
  const [preview, setPreview] = useState<ActivationPreview | null>(null);
  const [substitutions, setSubstitutions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const previewRequestRef = useRef(0);
  const activationRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const activationOperationRef = useRef<{ inputKey: string; id: string } | null>(null);
  const automaticPreviewKeyRef = useRef<string | null>(null);
  const accountRef = useRef(`${user?.id ?? "guest"}:${token ?? "anonymous"}`);
  accountRef.current = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const accountKey = accountRef.current;
  const requestKey = `${accountKey}:${templateId ?? "missing"}`;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      previewRequestRef.current += 1;
      activationRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    void syncCurrentWeek();
  }, [syncCurrentWeek]);

  useEffect(() => {
    setProgram(null);
    setActivePrograms({ current: null, scheduled: null });
    setProgramOwnerKey(null);
    setPreview(null);
    setSubstitutions({});
    setPreviewFailed(false);
    activationOperationRef.current = null;
    previewRequestRef.current += 1;
    if (!token || !templateId) {
      setProgramOwnerKey(requestKey);
      setError("Sign in again to use this program.");
      setLoading(false);
      return;
    }
    const requestId = ++requestRef.current;
    const account = accountKey;
    setLoading(true);
    setError(null);
    Promise.all([getProgram(token, templateId), getActiveProgram(token, todayIso())]).then(([detail, activeState]) => {
      if (!mountedRef.current || requestRef.current !== requestId || accountRef.current !== account) return;
      setProgram(detail);
      setActivePrograms(activeState);
      setProgramOwnerKey(requestKey);
      const fromWeek = weekPlan?.workouts.map((workout) => {
        const date = new Date(`${workout.date}T00:00:00`);
        return (date.getDay() + 6) % 7;
      }).filter((value, index, all) => all.indexOf(value) === index).slice(0, detail.frequency);
      setWeekdays(fromWeek?.length === detail.frequency ? fromWeek.sort() : defaultWeekdays(detail.frequency));
    }).catch((loadError) => {
      if (!mountedRef.current || requestRef.current !== requestId || accountRef.current !== account) return;
      console.warn("Activation program couldn't load", loadError);
      setProgram(null);
      setActivePrograms({ current: null, scheduled: null });
      setProgramOwnerKey(requestKey);
      setError("This program couldn’t load. Try again.");
    }).finally(() => {
      if (mountedRef.current && requestRef.current === requestId && accountRef.current === account) setLoading(false);
    });
  }, [accountKey, requestKey, templateId, token, weekPlan?.workouts]);

  const effectiveDate = applyMode === "next-week" ? nextLocalMondayIso() : localDateIso();
  const displayedWeekStart = currentWeekStart;
  const previewInputKey = `${requestKey}:${program?.version ?? "loading"}:${displayedWeekStart}:${effectiveDate}:${applyMode}:${weekdays.join(",")}`;
  const previewInputKeyRef = useRef(previewInputKey);
  previewInputKeyRef.current = previewInputKey;
  const submissionInputKey = `${previewInputKey}:${Object.entries(substitutions).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join(";")}`;
  const submissionInputKeyRef = useRef(submissionInputKey);
  submissionInputKeyRef.current = submissionInputKey;

  useEffect(() => {
    previewRequestRef.current += 1;
    setPreview(null);
    setSubstitutions({});
    setPreviewFailed(false);
    setPreviewing(false);
    setError(null);
  }, [previewInputKey]);

  useEffect(() => {
    if (activationOperationRef.current?.inputKey !== submissionInputKey) {
      activationOperationRef.current = null;
    }
    setActivating(false);
  }, [submissionInputKey]);

  const toggleDay = (index: number) => {
    if (!program) return;
    setWeekdays((current) => current.includes(index) ? current.filter((item) => item !== index) : current.length < program.frequency ? [...current, index].sort() : current);
  };

  const buildPreview = useCallback(async () => {
    if (!token || !program || previewing || weekdays.length !== program.frequency) return;
    const previewRequestId = ++previewRequestRef.current;
    const inputKey = previewInputKey;
    setPreviewing(true);
    setPreview(null);
    setSubstitutions({});
    setPreviewFailed(false);
    setError(null);
    const account = accountRef.current;
    const isCurrent = () => mountedRef.current && accountRef.current === account && previewRequestRef.current === previewRequestId && previewInputKeyRef.current === inputKey;
    try {
      const result = await previewProgramActivation(token, program.id, { weekStart: displayedWeekStart, effectiveDate, weekdays, applyMode });
      if (!isCurrent()) return;
      const nextSubstitutions: Record<string, string> = {};
      result.equipmentConflicts.forEach((conflict) => {
        const suggestedId = conflict.suggestedExercise?.id ?? conflict.suggestedExerciseId;
        if (suggestedId) nextSubstitutions[conflict.templateExerciseId] = suggestedId;
      });
      setSubstitutions(nextSubstitutions);
      setPreview(result);
    } catch (previewError) {
      if (!isCurrent()) return;
      console.warn("Activation preview couldn't load", previewError);
      setPreview(null);
      setSubstitutions({});
      setPreviewFailed(true);
      setError("The schedule preview couldn’t load. Check your connection and try again.");
    } finally { if (isCurrent()) setPreviewing(false); }
  }, [applyMode, displayedWeekStart, effectiveDate, previewInputKey, previewing, program, token, weekdays]);

  useEffect(() => {
    if (
      review !== "equipment" ||
      !program ||
      preview ||
      previewing ||
      weekdays.length !== program.frequency ||
      automaticPreviewKeyRef.current === previewInputKey
    ) return;
    automaticPreviewKeyRef.current = previewInputKey;
    void buildPreview();
  }, [buildPreview, preview, previewInputKey, previewing, program, review, weekdays.length]);

  const submit = async () => {
    if (!token || !program || !preview || activating) return;
    const unresolved = preview.equipmentConflicts.some((conflict) => !substitutions[conflict.templateExerciseId]);
    if (unresolved) { setError("Choose a replacement for every unavailable exercise."); return; }
    setActivating(true);
    setError(null);
    const account = accountRef.current;
    const inputKey = submissionInputKey;
    const activationRequestId = ++activationRequestRef.current;
    const isCurrent = () => mountedRef.current && accountRef.current === account && activationRequestRef.current === activationRequestId && submissionInputKeyRef.current === inputKey;
    const operation = activationOperationRef.current?.inputKey === inputKey
      ? activationOperationRef.current
      : { inputKey, id: createProgramOperationId() };
    activationOperationRef.current = operation;

    let response: ProgramActivationResponse;
    try {
      response = await activateProgram(token, program.id, {
        weekStart: displayedWeekStart,
        effectiveDate,
        weekdays,
        templateVersion: program.version,
        substitutions,
        applyMode,
        clientOperationId: operation.id,
      });
    } catch (activationError) {
      if (!isCurrent()) return;
      console.warn("Program couldn't be activated", activationError);
      setError("The program wasn’t activated. Your current schedule is unchanged; try again.");
      setActivating(false);
      return;
    }

    if (!isCurrent()) return;
    activationOperationRef.current = null;
    const responsePlan = mapApiWeekPlan(response.weekPlan);

    if (applyMode === "now") {
      if (responsePlan.weekStart === displayedWeekStart) {
        installWeekPlan(responsePlan);
      } else {
        void refreshWeek({ weekStart: displayedWeekStart });
      }
    }

    setActivating(false);
    router.replace("/(tabs)");
  };

  const findExerciseName = useCallback((id: string) => {
    for (const day of program?.days ?? []) for (const item of day.exercises) if (item.exerciseId === id) return item.exercise.name;
    for (const conflict of preview?.equipmentConflicts ?? []) {
      if (conflict.suggestedExercise?.id === id) return conflict.suggestedExercise.name;
      const item = conflict.alternatives.find((exercise) => exercise.id === id);
      if (item) return item.name;
    }
    return id.replace(/_/g, " ");
  }, [preview, program]);

  const scheduledDateSummary = useMemo(() => preview?.scheduleImpact.scheduledDates.map((date) => new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })).join(", "), [preview]);
  const unresolvedEquipmentConflicts = preview?.equipmentConflicts.filter((conflict) => !substitutions[conflict.templateExerciseId]) ?? [];

  if (loading || programOwnerKey !== requestKey) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ProgramHeader title="Use program" onBack={() => router.back()} /><ScreenState colors={colors} kind="loading" title="Loading schedule…" testID="activation-loading" /></SafeAreaView>;
  if (!program) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ProgramHeader title="Use program" onBack={() => router.back()} /><ScreenState colors={colors} kind="error" title="Program unavailable" message={error ?? undefined} actionLabel="Go back" onAction={() => router.back()} /></SafeAreaView>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ProgramHeader title="Use this program" subtitle={program.name} onBack={() => router.back()} backDisabled={activating} />
      <ScrollView contentContainerStyle={styles.content}>
        {activePrograms.current?.templateId === program.id ? <View testID="activation-current-program" style={[styles.programStatus, { borderColor: colors.inputBorder }]}><Ionicons name="checkmark-circle-outline" size={20} color="#168A3D" /><ThemedText style={styles.flex}>This is your current program.</ThemedText></View> : null}
        {activePrograms.scheduled?.templateId === program.id ? <View testID="activation-scheduled-program" style={[styles.programStatus, { borderColor: colors.inputBorder }]}><Ionicons name="calendar-outline" size={20} color={colors.primaryButton} /><ThemedText style={styles.flex}>This program starts next week.</ThemedText></View> : null}
        <ThemedText style={styles.title}>Choose your training days</ThemedText><ThemedText style={[styles.copy, { color: colors.placeholder }]}>Pick exactly {program.frequency}. Program days follow this order every week.</ThemedText>
        <View style={styles.weekRow}>{WEEKDAY_LABELS.map((label, index) => { const selected = weekdays.includes(index); const disabled = previewing || activating; return <Pressable key={label} testID={`activation-weekday-${index}`} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => toggleDay(index)} style={[styles.weekday, { borderColor: selected ? colors.primaryButton : colors.inputBorder, backgroundColor: selected ? colors.primaryButton : colors.inputBackground, opacity: disabled ? 0.55 : 1 }]}><ThemedText style={{ color: selected ? "#FFF" : colors.text, fontSize: 11, fontWeight: "800" }}>{label.slice(0, 1)}</ThemedText></Pressable>; })}</View>
        <View style={styles.modeRow}>{(["now", "next-week"] as ProgramApplyMode[]).map((mode) => { const disabled = previewing || activating; return <Pressable key={mode} testID={`activation-mode-${mode}`} accessibilityRole="button" accessibilityState={{ selected: applyMode === mode, disabled }} disabled={disabled} onPress={() => setApplyMode(mode)} style={[styles.mode, { borderColor: applyMode === mode ? colors.primaryButton : colors.inputBorder, backgroundColor: applyMode === mode ? "rgba(106,79,245,0.1)" : colors.inputBackground, opacity: disabled ? 0.55 : 1 }]}><ThemedText style={{ color: applyMode === mode ? colors.primaryButton : colors.text, fontWeight: "800" }}>{mode === "now" ? "Start now" : "Start next week"}</ThemedText><ThemedText style={[styles.modeCopy, { color: colors.placeholder }]}>{mode === "now" ? "Replace unfinished workouts" : "Keep this week as it is"}</ThemedText></Pressable>; })}</View>
        {!preview ? <Pressable testID={previewFailed ? "activation-preview-retry" : "activation-preview"} accessibilityRole="button" accessibilityLabel={previewFailed ? "Retry program schedule review" : "Review program schedule"} accessibilityState={{ disabled: previewing || weekdays.length !== program.frequency, busy: previewing }} disabled={previewing || weekdays.length !== program.frequency} onPress={() => void buildPreview()} style={[styles.primary, { backgroundColor: colors.primaryButton, opacity: weekdays.length !== program.frequency || previewing ? 0.45 : 1 }]}><ThemedText style={styles.primaryText}>{previewing ? "Building preview…" : previewFailed ? "Retry schedule review" : "Review schedule"}</ThemedText></Pressable> : (
          <View testID="activation-review">
            <ThemedText style={styles.section}>Schedule review</ThemedText>
            <View style={[styles.impact, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}><Ionicons name="calendar-outline" size={22} color={colors.primaryButton} /><View style={styles.flex}><ThemedText testID="activation-target-week" style={styles.impactTitle}>{applyMode === "next-week" ? `Week of ${new Date(`${effectiveDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "This week"}</ThemedText><ThemedText style={[styles.impactCopy, { color: colors.placeholder }]}>{scheduledDateSummary || "Upcoming selected days"}</ThemedText><ThemedText style={[styles.impactCopy, { color: colors.placeholder }]}>{preview.scheduleImpact.preservedWorkoutDayIds.length} existing workouts stay unchanged · {preview.scheduleImpact.replacedWorkoutDayIds.length} unfinished workouts replaced</ThemedText></View></View>
            {preview.equipmentConflicts.length ? <><ThemedText style={styles.section}>Equipment replacements</ThemedText><ThemedText style={[styles.copy, { color: colors.placeholder }]}>Review each change before activating.</ThemedText></> : <View style={styles.compatible}><Ionicons name="checkmark-circle" size={21} color="#168A3D" /><ThemedText style={styles.compatibleText}>Your equipment supports every exercise.</ThemedText></View>}
            {preview.equipmentConflicts.map((conflict, index) => {
              const suggestedId = conflict.suggestedExercise?.id ?? conflict.suggestedExerciseId;
              const choices = [
                ...(conflict.suggestedExercise ? [conflict.suggestedExercise] : []),
                ...conflict.alternatives,
              ].filter((exercise, choiceIndex, all) => all.findIndex((item) => item.id === exercise.id) === choiceIndex);
              return <View testID={`activation-conflict-${index + 1}`} key={conflict.templateExerciseId} style={[styles.conflict, { borderColor: colors.inputBorder }]}><ThemedText style={styles.conflictTitle}>{findExerciseName(conflict.originalExerciseId)}</ThemedText><ThemedText style={[styles.missing, { color: colors.placeholder }]}>Missing: {conflict.missingEquipmentIds.map((id) => equipment.find((item) => item.id === id)?.name ?? id.replace(/_/g, " ")).join(", ")}</ThemedText>{choices.length === 0 ? <View testID={`activation-unresolved-${conflict.templateExerciseId}`} style={styles.unresolved}><Ionicons name="information-circle-outline" size={18} color="#C2410C" /><ThemedText style={styles.unresolvedText}>No compatible replacement is available from your saved equipment.</ThemedText></View> : <View style={styles.choices}>{choices.map((exercise) => { const selected = substitutions[conflict.templateExerciseId] === exercise.id; const usedInDay = preview.equipmentConflicts.some((other) => other.templateDayId === conflict.templateDayId && other.templateExerciseId !== conflict.templateExerciseId && substitutions[other.templateExerciseId] === exercise.id); const disabled = activating || usedInDay; const replacementTestId = exercise.id === suggestedId ? `activation-suggested-${conflict.templateExerciseId}-${exercise.id}` : `activation-alternative-${conflict.templateExerciseId}-${exercise.id}`; return <Pressable key={exercise.id} testID={replacementTestId} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} accessibilityLabel={`Use ${exercise.name}${usedInDay ? ", already selected in this workout" : ""}`} disabled={disabled} onPress={() => setSubstitutions((current) => ({ ...current, [conflict.templateExerciseId]: exercise.id }))} style={[styles.replacement, { borderColor: selected ? colors.primaryButton : colors.inputBorder, backgroundColor: selected ? "rgba(106,79,245,0.09)" : colors.inputBackground, opacity: disabled && !selected ? 0.4 : 1 }]}><Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? colors.primaryButton : colors.placeholder} /><ThemedText style={styles.flex}>{exercise.name}</ThemedText>{exercise.id === suggestedId ? <ThemedText style={[styles.suggested, { color: colors.primaryButton }]}>Suggested</ThemedText> : null}</Pressable>; })}</View>}</View>;
            })}
            {unresolvedEquipmentConflicts.length ? <ThemedText testID="activation-unresolved-summary" accessibilityRole="alert" style={styles.unresolvedSummary}>Resolve every equipment conflict before activating this program.</ThemedText> : null}
            <Pressable testID="activation-confirm" accessibilityRole="button" accessibilityLabel={`Activate ${program.name}`} accessibilityState={{ disabled: activating || unresolvedEquipmentConflicts.length > 0, busy: activating }} disabled={activating || unresolvedEquipmentConflicts.length > 0} onPress={() => void submit()} style={[styles.primary, { backgroundColor: colors.primaryButton, opacity: activating || unresolvedEquipmentConflicts.length ? 0.45 : 1 }]}><ThemedText style={styles.primaryText}>{activating ? "Activating…" : "Activate program"}</ThemedText></Pressable>
          </View>
        )}
        {error ? <ThemedText testID="activation-error" accessibilityRole="alert" style={styles.error}>{error}</ThemedText> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, flex: { flex: 1 }, content: { padding: 22, paddingBottom: 54 }, title: { fontSize: 25, fontWeight: "900" }, copy: { marginTop: 7, fontSize: 14, lineHeight: 20 }, weekRow: { marginTop: 20, flexDirection: "row", justifyContent: "space-between" }, weekday: { width: 42, height: 46, borderWidth: 1, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  programStatus: { minHeight: 48, marginBottom: 16, borderWidth: 1, borderRadius: 15, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  modeRow: { marginTop: 20, flexDirection: "row", gap: 10 }, mode: { flex: 1, minHeight: 78, borderWidth: 1, borderRadius: 17, padding: 13 }, modeCopy: { marginTop: 5, fontSize: 11, lineHeight: 15 }, primary: { minHeight: 56, marginTop: 24, borderRadius: 18, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#FFF", fontSize: 17, fontWeight: "900" }, section: { marginTop: 28, marginBottom: 10, fontSize: 20, fontWeight: "900" },
  impact: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", gap: 12 }, impactTitle: { fontWeight: "800" }, impactCopy: { marginTop: 4, fontSize: 12, lineHeight: 17 }, compatible: { minHeight: 52, marginTop: 21, paddingHorizontal: 13, borderRadius: 16, backgroundColor: "rgba(39,196,92,0.12)", flexDirection: "row", alignItems: "center", gap: 9 }, compatibleText: { color: "#168A3D", fontWeight: "800" }, conflict: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 11 }, conflictTitle: { fontSize: 16, fontWeight: "900" }, missing: { marginTop: 4, fontSize: 12, textTransform: "capitalize" }, choices: { marginTop: 12, gap: 8 }, unresolved: { marginTop: 12, padding: 11, borderRadius: 12, backgroundColor: "rgba(194,65,12,0.12)", flexDirection: "row", gap: 8 }, unresolvedText: { flex: 1, color: "#C2410C", fontSize: 12, fontWeight: "700", lineHeight: 17 }, unresolvedSummary: { marginTop: 16, color: "#C2410C", fontWeight: "700", lineHeight: 19 }, replacement: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9 }, suggested: { fontSize: 11, fontWeight: "800" }, error: { marginTop: 14, color: "#D92D20", lineHeight: 20 },
});
