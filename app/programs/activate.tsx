import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
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
  const { fontScale } = useWindowDimensions();
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

  const dark = colors.background === Colors.dark.background;
  const selectedColor = dark ? "#B4A5FF" : "#583BD0";
  const successColor = dark ? "#6EDB91" : "#127536";
  const warningColor = dark ? "#FDBA74" : "#9A3412";
  const errorColor = dark ? "#FF8B82" : "#B42318";
  const selectedBackground = dark ? "#292929" : "#F5F5F5";
  const primaryStyle = (disabled: boolean) => ({ pressed }: { pressed: boolean }) => [styles.primary, { backgroundColor: disabled ? colors.inputBackground : colors.primaryButton, borderColor: disabled ? colors.inputBorder : colors.primaryButton, transform: [{ scale: pressed && !disabled ? 0.99 : 1 }] }];

  if (loading || programOwnerKey !== requestKey) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}><ActivationHeader colors={colors} fontScale={fontScale} onBack={() => router.back()} /><ActivationState colors={colors} loading title="Loading schedule…" testID="activation-loading" /></SafeAreaView>;
  if (!program) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}><ActivationHeader colors={colors} fontScale={fontScale} onBack={() => router.back()} /><ActivationState colors={colors} title="Program unavailable" message={error ?? undefined} onBack={() => router.back()} /></SafeAreaView>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <ActivationHeader colors={colors} fontScale={fontScale} onBack={() => router.back()} loaded backDisabled={activating} />
      <ScrollView testID="activation-scroll" contentContainerStyle={styles.content}>
        <ThemedText testID="activation-program-name" accessibilityRole="header" style={styles.programName}>{program.name}</ThemedText>
        {activePrograms.current?.templateId === program.id ? <View testID="activation-current-program" style={[styles.programStatus, { borderColor: colors.inputBorder }]}><Ionicons name="checkmark-circle-outline" size={20} color={successColor} /><ThemedText style={[styles.flex, { color: successColor }]}>This is your current program.</ThemedText></View> : null}
        {activePrograms.scheduled?.templateId === program.id ? <View testID="activation-scheduled-program" style={[styles.programStatus, { borderColor: colors.inputBorder }]}><Ionicons name="calendar-outline" size={20} color={selectedColor} /><ThemedText style={[styles.flex, { color: selectedColor }]}>This program starts next week.</ThemedText></View> : null}
        <ThemedText style={styles.title}>Choose your training days</ThemedText><ThemedText style={[styles.copy, { color: colors.icon }]}>Pick exactly {program.frequency}. Program days follow this order every week.</ThemedText>
        <View style={[styles.weekRow, { gap: fontScale >= 1.4 ? 8 : 3 }]}>{WEEKDAY_LABELS.map((label, index) => { const selected = weekdays.includes(index); const disabled = previewing || activating; return <Pressable key={label} testID={`activation-weekday-${index}`} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => toggleDay(index)} style={({ pressed }) => [styles.weekday, { flexBasis: fontScale >= 1.4 ? Math.ceil(44 * fontScale) : 44, borderColor: selected ? selectedColor : colors.inputBorder, backgroundColor: selected || pressed && !disabled ? selectedBackground : colors.inputBackground }]}><ThemedText style={[styles.weekdayText, { color: disabled ? colors.icon : colors.text }]}>{label.slice(0, 3)}</ThemedText><View style={styles.weekdayIndicator}>{selected ? <Ionicons name="checkmark" size={16} color={selectedColor} /> : null}</View></Pressable>; })}</View>
        <View style={[styles.modeRow, fontScale >= 1.4 && styles.stackedModes]}>{(["now", "next-week"] as ProgramApplyMode[]).map((mode) => { const disabled = previewing || activating; const selected = applyMode === mode; return <Pressable key={mode} testID={`activation-mode-${mode}`} accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => setApplyMode(mode)} style={({ pressed }) => [styles.mode, { borderColor: selected ? selectedColor : colors.inputBorder, backgroundColor: selected || pressed && !disabled ? selectedBackground : colors.inputBackground }]}><View style={styles.modeHeader}><ThemedText style={[styles.modeTitle, { color: disabled ? colors.icon : colors.text }]}>{mode === "now" ? "Start now" : "Start next week"}</ThemedText><Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? selectedColor : colors.icon} /></View><ThemedText style={[styles.modeCopy, { color: colors.icon }]}>{mode === "now" ? "Replace unfinished workouts" : "Keep this week as it is"}</ThemedText></Pressable>; })}</View>
        {!preview ? <Pressable testID={previewFailed ? "activation-preview-retry" : "activation-preview"} accessibilityRole="button" accessibilityLabel={previewFailed ? "Retry program schedule review" : "Review program schedule"} accessibilityState={{ disabled: previewing || weekdays.length !== program.frequency, busy: previewing }} disabled={previewing || weekdays.length !== program.frequency} onPress={() => void buildPreview()} style={primaryStyle(weekdays.length !== program.frequency || previewing)}><ThemedText style={[styles.primaryText, { color: weekdays.length !== program.frequency || previewing ? colors.icon : "#FFF" }]}>{previewing ? "Building preview…" : previewFailed ? "Retry schedule review" : "Review schedule"}</ThemedText></Pressable> : (
          <View testID="activation-review">
            <ThemedText style={styles.section}>Schedule review</ThemedText>
            <View style={[styles.impact, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}><Ionicons name="calendar-outline" size={22} color={colors.icon} /><View style={styles.flex}><ThemedText testID="activation-target-week" style={styles.impactTitle}>{applyMode === "next-week" ? `Week of ${new Date(`${effectiveDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "This week"}</ThemedText><ThemedText style={[styles.impactCopy, { color: colors.icon }]}>{scheduledDateSummary || "Upcoming selected days"}</ThemedText><ThemedText style={[styles.impactCopy, { color: colors.icon }]}>{preview.scheduleImpact.preservedWorkoutDayIds.length} existing workouts stay unchanged · {preview.scheduleImpact.replacedWorkoutDayIds.length} unfinished workouts replaced</ThemedText></View></View>
            {preview.equipmentConflicts.length ? <><ThemedText style={styles.section}>Equipment replacements</ThemedText><ThemedText style={[styles.copy, { color: colors.icon }]}>Review each change before activating.</ThemedText></> : <View style={[styles.compatible, { borderColor: colors.inputBorder }]}><Ionicons name="checkmark-circle" size={21} color={successColor} /><ThemedText style={[styles.compatibleText, { color: successColor }]}>Your equipment supports every exercise.</ThemedText></View>}
            {preview.equipmentConflicts.map((conflict, index) => {
              const suggestedId = conflict.suggestedExercise?.id ?? conflict.suggestedExerciseId;
              const choices = [
                ...(conflict.suggestedExercise ? [conflict.suggestedExercise] : []),
                ...conflict.alternatives,
              ].filter((exercise, choiceIndex, all) => all.findIndex((item) => item.id === exercise.id) === choiceIndex);
              return <View testID={`activation-conflict-${index + 1}`} key={conflict.templateExerciseId} style={[styles.conflict, { borderColor: colors.inputBorder }]}><ThemedText style={styles.conflictTitle}>{findExerciseName(conflict.originalExerciseId)}</ThemedText><ThemedText style={[styles.missing, { color: warningColor }]}>Missing: {conflict.missingEquipmentIds.map((id) => equipment.find((item) => item.id === id)?.name ?? id.replace(/_/g, " ")).join(", ")}</ThemedText>{choices.length === 0 ? <View testID={`activation-unresolved-${conflict.templateExerciseId}`} style={styles.unresolved}><Ionicons name="information-circle-outline" size={18} color={warningColor} /><ThemedText style={[styles.unresolvedText, { color: warningColor }]}>No compatible replacement is available from your saved equipment.</ThemedText></View> : <View style={styles.choices}>{choices.map((exercise) => { const selected = substitutions[conflict.templateExerciseId] === exercise.id; const usedInDay = preview.equipmentConflicts.some((other) => other.templateDayId === conflict.templateDayId && other.templateExerciseId !== conflict.templateExerciseId && substitutions[other.templateExerciseId] === exercise.id); const disabled = activating || usedInDay; const replacementTestId = exercise.id === suggestedId ? `activation-suggested-${conflict.templateExerciseId}-${exercise.id}` : `activation-alternative-${conflict.templateExerciseId}-${exercise.id}`; return <Pressable key={exercise.id} testID={replacementTestId} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} accessibilityLabel={`Use ${exercise.name}${usedInDay ? ", already selected in this workout" : ""}`} disabled={disabled} onPress={() => setSubstitutions((current) => ({ ...current, [conflict.templateExerciseId]: exercise.id }))} style={({ pressed }) => [styles.replacement, { borderColor: selected ? selectedColor : colors.inputBorder, backgroundColor: selected || pressed && !disabled ? selectedBackground : colors.inputBackground }]}><Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? selectedColor : colors.icon} /><View style={styles.flex}><ThemedText style={{ color: disabled ? colors.icon : colors.text }}>{exercise.name}</ThemedText>{exercise.id === suggestedId ? <ThemedText style={[styles.suggested, { color: colors.icon }]}>Suggested</ThemedText> : null}</View></Pressable>; })}</View>}</View>;
            })}
            {unresolvedEquipmentConflicts.length ? <ThemedText testID="activation-unresolved-summary" accessibilityRole="alert" style={[styles.unresolvedSummary, { color: warningColor }]}>Resolve every equipment conflict before activating this program.</ThemedText> : null}
            <Pressable testID="activation-confirm" accessibilityRole="button" accessibilityLabel={`Activate ${program.name}`} accessibilityState={{ disabled: activating || unresolvedEquipmentConflicts.length > 0, busy: activating }} disabled={activating || unresolvedEquipmentConflicts.length > 0} onPress={() => void submit()} style={primaryStyle(activating || unresolvedEquipmentConflicts.length > 0)}><ThemedText style={[styles.primaryText, { color: activating || unresolvedEquipmentConflicts.length ? colors.icon : "#FFF" }]}>{activating ? "Activating…" : "Activate program"}</ThemedText></Pressable>
          </View>
        )}
        {error ? <ThemedText testID="activation-error" accessibilityRole="alert" style={[styles.error, { color: errorColor }]}>{error}</ThemedText> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActivationHeader({ colors, fontScale, onBack, loaded = false, backDisabled = false }: { colors: typeof Colors.light | typeof Colors.dark; fontScale: number; onBack: () => void; loaded?: boolean; backDisabled?: boolean }) {
  return <View style={styles.header}><Pressable testID="activation-back" accessibilityRole="button" accessibilityLabel={`Back from ${loaded ? "Use this program" : "Use program"}`} accessibilityState={{ disabled: backDisabled }} disabled={backDisabled} onPress={onBack} style={({ pressed }) => [styles.headerAction, { backgroundColor: pressed && !backDisabled ? colors.inputBackground : colors.background }]}><Ionicons name="arrow-back" size={24} color={backDisabled ? colors.icon : colors.text} /></Pressable><View style={styles.headerCopy}>{fontScale < 2 ? <ThemedText style={styles.headerTitle}>Use program</ThemedText> : null}</View><View style={styles.headerAction} /></View>;
}

function ActivationState({ colors, loading = false, title, message, testID, onBack }: { colors: typeof Colors.light | typeof Colors.dark; loading?: boolean; title: string; message?: string; testID?: string; onBack?: () => void }) {
  return <ScrollView testID={testID} contentContainerStyle={styles.state}><View style={styles.stateIcon}>{loading ? <ActivityIndicator color={colors.icon} /> : <Ionicons name="cloud-offline-outline" size={42} color={colors.background === Colors.dark.background ? "#FF8B82" : "#B42318"} />}</View><ThemedText style={styles.stateTitle}>{title}</ThemedText>{message ? <ThemedText style={[styles.stateCopy, { color: colors.icon }]}>{message}</ThemedText> : null}{onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={({ pressed }) => [styles.stateAction, { borderColor: colors.inputBorder, backgroundColor: pressed ? colors.inputBackground : colors.background }]}><ThemedText style={styles.stateActionText}>Go back</ThemedText></Pressable> : null}</ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, flex: { flex: 1, minWidth: 0 }, content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28 },
  header: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center" }, headerAction: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" }, headerCopy: { flex: 1, paddingHorizontal: 8, alignItems: "center" }, headerTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  programName: { fontSize: 27, fontWeight: "900", marginBottom: 20 }, title: { fontSize: 25, fontWeight: "900" }, copy: { marginTop: 7, fontSize: 15 },
  weekRow: { marginTop: 18, flexDirection: "row", flexWrap: "wrap" }, weekday: { flexGrow: 1, minWidth: 44, minHeight: 44, paddingHorizontal: 4, paddingVertical: 7, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 3 }, weekdayText: { fontSize: 13, fontWeight: "700" }, weekdayIndicator: { height: 16, justifyContent: "center" },
  programStatus: { minHeight: 48, marginBottom: 16, borderWidth: 1, borderRadius: 15, padding: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  modeRow: { marginTop: 20, flexDirection: "row", gap: 10 }, stackedModes: { flexDirection: "column" }, mode: { flex: 1, minHeight: 78, borderWidth: 1, borderRadius: 16, padding: 14 }, modeHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 }, modeTitle: { flex: 1, fontSize: 17, fontWeight: "800" }, modeCopy: { marginTop: 7, fontSize: 14 },
  primary: { minHeight: 54, marginTop: 24, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderRadius: 17, alignItems: "center", justifyContent: "center" }, primaryText: { fontSize: 17, fontWeight: "800", textAlign: "center" }, section: { marginTop: 28, marginBottom: 10, fontSize: 20, fontWeight: "900" },
  impact: { borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: "row", gap: 12 }, impactTitle: { fontWeight: "800" }, impactCopy: { marginTop: 6, fontSize: 14 }, compatible: { minHeight: 52, marginTop: 20, padding: 14, borderWidth: 1, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 9 }, compatibleText: { flex: 1, fontWeight: "700" },
  conflict: { borderWidth: 1, borderRadius: 18, padding: 16, marginTop: 12 }, conflictTitle: { fontSize: 17, fontWeight: "800" }, missing: { marginTop: 6, fontSize: 14, textTransform: "capitalize" }, choices: { marginTop: 12, gap: 8 }, unresolved: { marginTop: 12, flexDirection: "row", gap: 8 }, unresolvedText: { flex: 1, fontSize: 14, fontWeight: "600" }, unresolvedSummary: { marginTop: 16, fontWeight: "700" }, replacement: { minHeight: 50, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 9 }, suggested: { marginTop: 4, fontSize: 14, fontWeight: "600" }, error: { marginTop: 14 },
  state: { flexGrow: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 12 }, stateIcon: { minHeight: 44, justifyContent: "center" }, stateTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" }, stateCopy: { textAlign: "center" }, stateAction: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderRadius: 14 }, stateActionText: { fontWeight: "700", textAlign: "center" },
});
