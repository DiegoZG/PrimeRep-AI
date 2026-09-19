import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProgramHeader } from "@/components/program";
import { ScreenState } from "@/components/screen-state";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWorkoutWeek } from "@/hooks/use-workout-week";
import type { ActiveProgramState, ProgramDetail } from "@/interfaces/programs";
import { archiveProgram, cancelScheduledProgram, cloneProgram, deactivateProgram, getActiveProgram, getProgram } from "@/services/programService";
import { HttpError } from "@/services/httpClient";
import { mapApiWeekPlan } from "@/services/workoutWeekService";
import { AuthContext } from "@/utils/authContext";
import { EquipmentContext } from "@/utils/equipmentContext";
import { useProgramDraft } from "@/utils/programDraftContext";
import { PROGRAM_GOAL_LABELS, PROGRAM_LEVEL_LABELS, formatProgramMeta, todayIso } from "@/utils/programDisplay";

export default function ProgramDetailScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { token, user } = useContext(AuthContext);
  const { items: equipment } = useContext(EquipmentContext);
  const { loadProgram } = useProgramDraft();
  const { currentWeekStart, installWeekPlan, syncCurrentWeek } = useWorkoutWeek();
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [programOwnerKey, setProgramOwnerKey] = useState<string | null>(null);
  const [activePrograms, setActivePrograms] = useState<ActiveProgramState>({ current: null, scheduled: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const mutationRef = useRef(0);
  const mountedRef = useRef(true);
  const focusedRef = useRef(false);
  const accountRef = useRef(`${user?.id ?? "guest"}:${token ?? "anonymous"}`);
  accountRef.current = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const accountKey = accountRef.current;
  const requestKey = `${accountKey}:${templateId ?? "missing"}`;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mutationRef.current += 1;
    };
  }, []);

  const load = useCallback(async () => {
    if (!token || !templateId) {
      setProgram(null);
      setActivePrograms({ current: null, scheduled: null });
      setProgramOwnerKey(requestKey);
      setLoading(false);
      setError("Sign in again to view this program.");
      return;
    }
    const requestId = ++requestRef.current;
    const account = accountKey;
    setProgram(null);
    setActivePrograms({ current: null, scheduled: null });
    setProgramOwnerKey(null);
    setLoading(true);
    setBusy(false);
    setError(null);
    try {
      const [detail, current] = await Promise.all([getProgram(token, templateId), getActiveProgram(token, todayIso())]);
      if (requestRef.current !== requestId || accountRef.current !== account) return;
      setProgram({
        ...detail,
        isActive: current.current?.templateId === detail.id,
        isScheduled: current.scheduled?.templateId === detail.id,
      });
      setActivePrograms(current);
      setProgramOwnerKey(requestKey);
    } catch (loadError) {
      if (requestRef.current !== requestId || accountRef.current !== account) return;
      console.warn("Program couldn't load", loadError);
      setProgram(null);
      setActivePrograms({ current: null, scheduled: null });
      setProgramOwnerKey(requestKey);
      setError("This program couldn’t load. Check your connection and try again.");
    } finally {
      if (requestRef.current === requestId && accountRef.current === account) setLoading(false);
    }
  }, [accountKey, requestKey, templateId, token]);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    void syncCurrentWeek();
    void load();
    return () => {
      focusedRef.current = false;
      requestRef.current += 1;
      mutationRef.current += 1;
    };
  }, [load, syncCurrentWeek]));

  const edit = () => {
    if (!program) return;
    loadProgram(program);
    router.push("/programs/builder");
  };

  const customize = async () => {
    if (!token || !program || busy) return;
    setBusy(true);
    setError(null);
    const account = accountRef.current;
    const mutationId = ++mutationRef.current;
    const isCurrent = () => mountedRef.current && focusedRef.current && accountRef.current === account && mutationRef.current === mutationId;
    try {
      const copy = await cloneProgram(token, program.id);
      if (!isCurrent()) return;
      loadProgram(copy);
      router.push("/programs/builder");
    } catch (cloneError) {
      if (!isCurrent()) return;
      console.warn("Program couldn't be copied", cloneError);
      setError("The program couldn’t be copied. Try again.");
    } finally { if (isCurrent()) setBusy(false); }
  };

  const archive = () => {
    if (!token || !program) return;
    Alert.alert("Archive program?", "Its scheduled workouts and completed history stay intact.", [
      { text: "Cancel", style: "cancel" },
      { text: "Archive", style: "destructive", onPress: async () => {
        setBusy(true);
        const account = accountRef.current;
        const mutationId = ++mutationRef.current;
        const isCurrent = () => mountedRef.current && focusedRef.current && accountRef.current === account && mutationRef.current === mutationId;
        try {
          await archiveProgram(token, program.id);
          if (isCurrent()) router.replace("/programs");
        } catch (archiveError) {
          if (!isCurrent()) return;
          if (archiveError instanceof HttpError && archiveError.status === 409) {
            setError("Stop using or replace this active or scheduled program before archiving it.");
          } else {
            setError("The program couldn’t be archived. Try again.");
          }
        } finally { if (isCurrent()) setBusy(false); }
      } },
    ]);
  };

  const deactivate = () => {
    if (!token) return;
    const message = activePrograms.scheduled
      ? "PrimeRep will rebuild only your unfinished workouts from your training preferences. This also cancels the program scheduled to start next week."
      : "PrimeRep will rebuild only your unfinished workouts from your training preferences.";
    Alert.alert("Stop using this program?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Stop program", style: "destructive", onPress: async () => {
        setBusy(true);
        const account = accountRef.current;
        const mutationId = ++mutationRef.current;
        const isCurrent = () => mountedRef.current && focusedRef.current && accountRef.current === account && mutationRef.current === mutationId;
        try {
          const response = await deactivateProgram(token, {
            weekStart: currentWeekStart,
            effectiveDate: todayIso(),
          });
          if (!isCurrent()) return;
          installWeekPlan(mapApiWeekPlan(response));
          setActivePrograms({ current: null, scheduled: null });
          setProgram((current) => current ? { ...current, isActive: false, isScheduled: false } : current);
        } catch { if (isCurrent()) setError("The active program couldn’t be stopped. Try again."); }
        finally { if (isCurrent()) setBusy(false); }
      } },
    ]);
  };

  const cancelScheduled = () => {
    if (!token) return;
    Alert.alert("Cancel next week’s program?", "Your current program and this week’s workouts will stay unchanged.", [
      { text: "Keep it", style: "cancel" },
      { text: "Cancel scheduled program", style: "destructive", onPress: async () => {
        setBusy(true);
        setError(null);
        const account = accountRef.current;
        const mutationId = ++mutationRef.current;
        const isCurrent = () => mountedRef.current && focusedRef.current && accountRef.current === account && mutationRef.current === mutationId;
        try {
          await cancelScheduledProgram(token, todayIso());
          if (!isCurrent()) return;
          setActivePrograms((current) => ({ ...current, scheduled: null }));
          setProgram((current) => current ? { ...current, isScheduled: false } : current);
        } catch {
          if (isCurrent()) setError("The scheduled program couldn’t be canceled. Try again.");
        } finally {
          if (isCurrent()) setBusy(false);
        }
      } },
    ]);
  };

  if (loading || programOwnerKey !== requestKey) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ProgramHeader title="Program" onBack={() => router.back()} /><ScreenState colors={colors} kind="loading" title="Loading program…" testID="program-detail-loading" /></SafeAreaView>;
  if (error && !program) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ProgramHeader title="Program" onBack={() => router.back()} /><ScreenState colors={colors} kind="error" title="Program unavailable" message={error} actionLabel="Retry" onAction={() => void load()} testID="program-detail-error" /></SafeAreaView>;
  if (!program) return null;
  const isActive = activePrograms.current?.templateId === program.id || program.isActive;
  const isScheduled = activePrograms.scheduled?.templateId === program.id || program.isScheduled;
  const equipmentNames = program.equipmentIds.map((id) => equipment.find((item) => item.id === id)?.name ?? id.replace(/_/g, " "));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ProgramHeader title={program.name} subtitle={program.scope === "system" ? "PrimeRep program" : "Your program"} onBack={() => router.back()} backDisabled={busy} action={program.scope === "private" ? <Pressable testID="program-edit" accessibilityRole="button" accessibilityLabel={`Edit ${program.name}`} accessibilityState={{ disabled: busy }} disabled={busy} onPress={edit} style={[styles.iconAction, { opacity: busy ? 0.35 : 1 }]}><Ionicons name="create-outline" size={24} color={colors.primaryButton} /></Pressable> : undefined} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.cadence}>{Array.from({ length: 7 }, (_, index) => <View key={index} style={[styles.mark, { backgroundColor: index < program.frequency ? colors.primaryButton : colors.inputBorder }]} />)}</View>
          <ThemedText style={styles.name}>{program.name}</ThemedText>
          <ThemedText style={[styles.description, { color: colors.placeholder }]}>{program.description}</ThemedText>
          <View style={styles.metaRow}><Meta icon="calendar-outline" text={formatProgramMeta(program.frequency, program.durationMinutes)} /><Meta icon="fitness-outline" text={PROGRAM_GOAL_LABELS[program.goal]} /><Meta icon="speedometer-outline" text={PROGRAM_LEVEL_LABELS[program.level]} /></View>
          {isActive ? <View testID="program-active-badge" style={styles.activeBadge}><Ionicons name="checkmark-circle" size={18} color="#168A3D" /><ThemedText style={styles.activeText}>Current program</ThemedText></View> : null}
          {isScheduled ? <View testID="program-scheduled-badge" style={styles.scheduledBadge}><Ionicons name="calendar-outline" size={18} color={colors.primaryButton} /><ThemedText style={{ color: colors.primaryButton, fontWeight: "800" }}>Starts next week</ThemedText></View> : null}
        </View>

        {error ? <ThemedText accessibilityRole="alert" style={styles.inlineError}>{error}</ThemedText> : null}
        <ThemedText style={styles.sectionTitle}>Weekly plan</ThemedText>
        {program.days.map((day, dayIndex) => (
          <View testID={`program-day-${day.id}`} key={day.id} style={[styles.day, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}>
            <View style={styles.dayHeader}><View style={[styles.dayNumber, { backgroundColor: colors.primaryButton }]}><ThemedText style={styles.dayNumberText}>{dayIndex + 1}</ThemedText></View><ThemedText style={styles.dayTitle}>{day.title}</ThemedText><ThemedText style={[styles.count, { color: colors.placeholder }]}>{day.exercises.length} exercises</ThemedText></View>
            {day.exercises.map((item) => <View key={item.id} style={[styles.exercise, { borderTopColor: colors.inputBorder }]}><View style={styles.exerciseCopy}><ThemedText style={styles.exerciseName}>{item.exercise.name}</ThemedText><ThemedText style={[styles.prescription, { color: colors.placeholder }]}>{item.sets} × {item.repsMin === item.repsMax ? item.repsMin : `${item.repsMin}–${item.repsMax}`} · {item.restSeconds}s rest</ThemedText></View><ThemedText style={[styles.block, { color: colors.primaryButton }]}>{item.blockType}</ThemedText></View>)}
          </View>
        ))}
        <ThemedText style={styles.sectionTitle}>Equipment</ThemedText>
        <ThemedText style={[styles.equipment, { color: colors.placeholder }]}>{equipmentNames.length ? equipmentNames.join(", ") : "Bodyweight — no equipment required"}</ThemedText>

        <View style={styles.actions}>
          {isActive && activePrograms.current?.requiresReview ? <Pressable testID="program-review-equipment" accessibilityRole="button" accessibilityLabel={`Review equipment for ${program.name}`} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => router.push({ pathname: "/programs/activate", params: { templateId: program.id, applyMode: "now", review: "equipment" } })} style={[styles.primary, { backgroundColor: colors.primaryButton, opacity: busy ? 0.55 : 1 }]}><ThemedText style={styles.primaryText}>Review equipment</ThemedText></Pressable> : null}
          {isScheduled && activePrograms.scheduled?.requiresReview ? <Pressable testID="program-review-scheduled-equipment" accessibilityRole="button" accessibilityLabel={`Review scheduled equipment for ${program.name}`} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => router.push({ pathname: "/programs/activate", params: { templateId: program.id, applyMode: "next-week", review: "equipment" } })} style={[styles.primary, { backgroundColor: colors.primaryButton, opacity: busy ? 0.55 : 1 }]}><ThemedText style={styles.primaryText}>Review next week’s equipment</ThemedText></Pressable> : null}
          {isActive ? <Pressable testID="program-deactivate" accessibilityRole="button" accessibilityLabel="Stop using this program" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={deactivate} style={[styles.secondary, { borderColor: "#D92D20" }]}><ThemedText style={styles.danger}>Stop using program</ThemedText></Pressable> : null}
          {isScheduled ? <Pressable testID="program-cancel-scheduled" accessibilityRole="button" accessibilityLabel="Cancel scheduled program" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={cancelScheduled} style={[styles.secondary, { borderColor: "#D92D20" }]}><ThemedText style={styles.danger}>Cancel next week</ThemedText></Pressable> : null}
          {!isActive && !isScheduled ? <Pressable testID="program-activate" accessibilityRole="button" accessibilityLabel={`Use ${program.name}`} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => router.push({ pathname: "/programs/activate", params: { templateId: program.id } })} style={[styles.primary, { backgroundColor: colors.primaryButton }]}><ThemedText style={styles.primaryText}>Use this program</ThemedText></Pressable> : null}
          {program.scope === "system" ? <Pressable testID="program-customize" accessibilityRole="button" accessibilityLabel={`Customize ${program.name}`} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void customize()} style={[styles.secondary, { borderColor: colors.inputBorder }]}><ThemedText style={{ color: colors.primaryButton, fontWeight: "800" }}>{busy ? "Creating copy…" : "Customize"}</ThemedText></Pressable> : <Pressable testID="program-archive" accessibilityRole="button" accessibilityLabel={`Archive ${program.name}`} accessibilityState={{ disabled: busy || isActive || isScheduled, busy }} disabled={busy || isActive || isScheduled} onPress={archive} style={[styles.secondary, { borderColor: colors.inputBorder, opacity: busy || isActive || isScheduled ? 0.45 : 1 }]}><ThemedText style={{ color: colors.placeholder, fontWeight: "700" }}>Archive program</ThemedText></Pressable>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) { return <View style={styles.meta}><Ionicons name={icon} size={16} color="#6A4FF5" /><ThemedText style={styles.metaText}>{text}</ThemedText></View>; }

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 22, paddingBottom: 50 }, iconAction: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  hero: { paddingVertical: 10 }, cadence: { flexDirection: "row", gap: 7, marginBottom: 22 }, mark: { flex: 1, height: 7, borderRadius: 4 }, name: { fontSize: 31, lineHeight: 36, fontWeight: "900", fontFamily: Fonts.sans }, description: { marginTop: 10, fontSize: 16, lineHeight: 23 },
  metaRow: { marginTop: 20, gap: 10 }, meta: { flexDirection: "row", alignItems: "center", gap: 9 }, metaText: { fontSize: 14, fontWeight: "600" }, activeBadge: { marginTop: 18, minHeight: 40, alignSelf: "flex-start", paddingHorizontal: 13, borderRadius: 14, backgroundColor: "rgba(39,196,92,0.13)", flexDirection: "row", alignItems: "center", gap: 7 }, activeText: { color: "#168A3D", fontWeight: "800" },
  scheduledBadge: { marginTop: 10, minHeight: 40, alignSelf: "flex-start", paddingHorizontal: 13, borderRadius: 14, backgroundColor: "rgba(106,79,245,0.12)", flexDirection: "row", alignItems: "center", gap: 7 },
  inlineError: { marginVertical: 10, color: "#D92D20" }, sectionTitle: { marginTop: 28, marginBottom: 12, fontSize: 20, fontWeight: "800" },
  day: { borderWidth: 1, borderRadius: 20, marginBottom: 12, overflow: "hidden" }, dayHeader: { minHeight: 62, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 }, dayNumber: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" }, dayNumberText: { color: "#FFF", fontWeight: "800" }, dayTitle: { flex: 1, fontSize: 16, fontWeight: "800" }, count: { fontSize: 12 },
  exercise: { minHeight: 62, borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }, exerciseCopy: { flex: 1 }, exerciseName: { fontWeight: "700" }, prescription: { marginTop: 3, fontSize: 12 }, block: { fontSize: 11, textTransform: "capitalize", fontWeight: "800" }, equipment: { fontSize: 15, lineHeight: 22, textTransform: "capitalize" },
  actions: { marginTop: 28, gap: 10 }, primary: { minHeight: 54, borderRadius: 17, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#FFF", fontSize: 16, fontWeight: "800" }, secondary: { minHeight: 52, borderWidth: 1, borderRadius: 17, alignItems: "center", justifyContent: "center" }, danger: { color: "#D92D20", fontWeight: "800" },
});
