import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
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
  const { fontScale } = useWindowDimensions();
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

  if (loading || programOwnerKey !== requestKey) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}><DetailHeader title="Program" colors={colors} fontScale={fontScale} onBack={() => router.back()} /><DetailState colors={colors} kind="loading" title="Loading program…" testID="program-detail-loading" /></SafeAreaView>;
  if (error && !program) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}><DetailHeader title="Program" colors={colors} fontScale={fontScale} onBack={() => router.back()} /><DetailState colors={colors} kind="error" title="Program unavailable" message={error} onRetry={() => void load()} testID="program-detail-error" /></SafeAreaView>;
  if (!program) return null;
  const isActive = activePrograms.current?.templateId === program.id || program.isActive;
  const isScheduled = activePrograms.scheduled?.templateId === program.id || program.isScheduled;
  const equipmentNames = program.equipmentIds.map((id) => equipment.find((item) => item.id === id)?.name ?? id.replace(/_/g, " "));
  const dark = colors === Colors.dark;
  const activeColor = dark ? "#6EDB91" : "#127536";
  const scheduledColor = dark ? "#B4A5FF" : "#583BD0";
  const dangerColor = dark ? "#FF8B82" : "#B42318";
  const pressedSurface = dark ? colors.inputBackground : "#F5F5F5";
  const primaryStyle = ({ pressed }: { pressed: boolean }) => [styles.primary, { backgroundColor: busy ? colors.inputBackground : colors.primaryButton, borderColor: busy ? colors.inputBorder : colors.primaryButton }, pressed && !busy ? styles.primaryPressed : null];
  const secondaryStyle = ({ pressed }: { pressed: boolean }) => [styles.secondary, { borderColor: colors.inputBorder, backgroundColor: pressed && !busy ? pressedSurface : colors.background }];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <DetailHeader title={program.name} colors={colors} fontScale={fontScale} onBack={() => router.back()} backDisabled={busy} action={program.scope === "private" ? <Pressable testID="program-edit" accessibilityRole="button" accessibilityLabel={`Edit ${program.name}`} accessibilityState={{ disabled: busy }} disabled={busy} onPress={edit} style={({ pressed }) => [styles.iconAction, { backgroundColor: pressed && !busy ? pressedSurface : colors.background }]}><Ionicons name="create-outline" size={24} color={busy ? colors.icon : colors.text} /></Pressable> : undefined} />
      <ScrollView testID="program-detail-scroll" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.cadence} accessible={false}>{Array.from({ length: 7 }, (_, index) => <View key={index} style={[styles.mark, { backgroundColor: index < program.frequency ? colors.icon : colors.background, borderColor: colors.inputBorder }]} />)}</View>
          <ThemedText style={styles.name}>{program.name}</ThemedText>
          <ThemedText testID="program-detail-source" style={[styles.source, { color: colors.icon }]}>{program.scope === "system" ? "PrimeRep program" : "Your program"}</ThemedText>
          <ThemedText style={[styles.description, { color: colors.icon }]}>{program.description}</ThemedText>
          <View style={styles.metaRow}><Meta colors={colors} icon="calendar-outline" text={formatProgramMeta(program.frequency, program.durationMinutes)} /><Meta colors={colors} icon="fitness-outline" text={PROGRAM_GOAL_LABELS[program.goal]} /><Meta colors={colors} icon="speedometer-outline" text={PROGRAM_LEVEL_LABELS[program.level]} /></View>
          {isActive ? <View testID="program-active-badge" style={styles.activeBadge}><Ionicons name="checkmark-circle" size={18} color={activeColor} /><ThemedText style={[styles.badgeText, { color: activeColor }]}>Current program</ThemedText></View> : null}
          {isScheduled ? <View testID="program-scheduled-badge" style={styles.scheduledBadge}><Ionicons name="calendar-outline" size={18} color={scheduledColor} /><ThemedText style={[styles.badgeText, { color: scheduledColor }]}>Starts next week</ThemedText></View> : null}
        </View>

        {error ? <ThemedText accessibilityRole="alert" style={[styles.inlineError, { color: dangerColor }]}>{error}</ThemedText> : null}
        <ThemedText style={styles.sectionTitle}>Weekly plan</ThemedText>
        {program.days.map((day, dayIndex) => (
          <View testID={`program-day-${day.id}`} key={day.id} style={[styles.day, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}>
            <View style={styles.dayHeader}><View style={[styles.dayNumber, { borderColor: colors.inputBorder, backgroundColor: colors.background }]}><ThemedText style={styles.dayNumberText}>{dayIndex + 1}</ThemedText></View><View style={styles.dayCopy}><ThemedText style={styles.dayTitle}>{day.title}</ThemedText><ThemedText style={[styles.count, { color: colors.icon }]}>{day.exercises.length} exercises</ThemedText></View></View>
            {day.exercises.map((item) => <View key={item.id} style={[styles.exercise, fontScale >= 1.4 ? styles.exerciseStacked : null, { borderTopColor: colors.inputBorder }]}><View style={styles.exerciseCopy}><ThemedText style={styles.exerciseName}>{item.exercise.name}</ThemedText><ThemedText style={[styles.prescription, { color: colors.icon }]}>{item.sets} × {item.repsMin === item.repsMax ? item.repsMin : `${item.repsMin}–${item.repsMax}`} · {item.restSeconds}s rest</ThemedText></View><ThemedText style={[styles.block, { color: colors.icon }]}>{item.blockType}</ThemedText></View>)}
          </View>
        ))}
        <ThemedText style={styles.sectionTitle}>Equipment</ThemedText>
        <ThemedText style={[styles.equipment, { color: colors.icon }]}>{equipmentNames.length ? equipmentNames.join(", ") : "Bodyweight — no equipment required"}</ThemedText>

        <View style={styles.actions}>
          {isActive && activePrograms.current?.requiresReview ? <Pressable testID="program-review-equipment" accessibilityRole="button" accessibilityLabel={`Review equipment for ${program.name}`} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => router.push({ pathname: "/programs/activate", params: { templateId: program.id, applyMode: "now", review: "equipment" } })} style={primaryStyle}><ThemedText style={[styles.primaryText, busy ? { color: colors.icon } : null]}>Review equipment</ThemedText></Pressable> : null}
          {isScheduled && activePrograms.scheduled?.requiresReview ? <Pressable testID="program-review-scheduled-equipment" accessibilityRole="button" accessibilityLabel={`Review scheduled equipment for ${program.name}`} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => router.push({ pathname: "/programs/activate", params: { templateId: program.id, applyMode: "next-week", review: "equipment" } })} style={primaryStyle}><ThemedText style={[styles.primaryText, busy ? { color: colors.icon } : null]}>Review next week’s equipment</ThemedText></Pressable> : null}
          {isActive ? <Pressable testID="program-deactivate" accessibilityRole="button" accessibilityLabel="Stop using this program" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={deactivate} style={secondaryStyle}><ThemedText style={[styles.secondaryText, { color: busy ? colors.icon : dangerColor }]}>Stop using program</ThemedText></Pressable> : null}
          {isScheduled ? <Pressable testID="program-cancel-scheduled" accessibilityRole="button" accessibilityLabel="Cancel scheduled program" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={cancelScheduled} style={secondaryStyle}><ThemedText style={[styles.secondaryText, { color: busy ? colors.icon : dangerColor }]}>Cancel next week</ThemedText></Pressable> : null}
          {!isActive && !isScheduled ? <Pressable testID="program-activate" accessibilityRole="button" accessibilityLabel={`Use ${program.name}`} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => router.push({ pathname: "/programs/activate", params: { templateId: program.id } })} style={primaryStyle}><ThemedText style={[styles.primaryText, busy ? { color: colors.icon } : null]}>Use this program</ThemedText></Pressable> : null}
          {program.scope === "system" ? <Pressable testID="program-customize" accessibilityRole="button" accessibilityLabel={`Customize ${program.name}`} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void customize()} style={secondaryStyle}><ThemedText style={[styles.secondaryText, { color: busy ? colors.icon : colors.text }]}>{busy ? "Creating copy…" : "Customize"}</ThemedText></Pressable> : <Pressable testID="program-archive" accessibilityRole="button" accessibilityLabel={`Archive ${program.name}`} accessibilityState={{ disabled: busy || isActive || isScheduled, busy }} disabled={busy || isActive || isScheduled} onPress={archive} style={({ pressed }) => [styles.secondary, { borderColor: colors.inputBorder, backgroundColor: pressed && !busy && !isActive && !isScheduled ? pressedSurface : colors.background }]}><ThemedText style={[styles.secondaryText, { color: busy || isActive || isScheduled ? colors.icon : dangerColor }]}>Archive program</ThemedText></Pressable>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailHeader({ title, colors, fontScale, onBack, backDisabled = false, action }: { title: string; colors: typeof Colors.light; fontScale: number; onBack: () => void; backDisabled?: boolean; action?: React.ReactNode }) {
  return <View testID="program-detail-header" style={styles.header}><Pressable testID="program-detail-back" accessibilityRole="button" accessibilityLabel={`Back from ${title}`} accessibilityState={{ disabled: backDisabled }} disabled={backDisabled} onPress={onBack} style={({ pressed }) => [styles.iconAction, { backgroundColor: pressed && !backDisabled ? colors.inputBackground : colors.background }]}><Ionicons name="arrow-back" size={24} color={backDisabled ? colors.icon : colors.text} /></Pressable><View style={styles.headerCopy}>{fontScale < 2 ? <ThemedText style={styles.headerTitle}>Program</ThemedText> : null}</View><View style={styles.iconAction}>{action}</View></View>;
}

function DetailState({ colors, kind, title, message, onRetry, testID }: { colors: typeof Colors.light; kind: "loading" | "error"; title: string; message?: string; onRetry?: () => void; testID: string }) {
  return <ScrollView contentContainerStyle={styles.stateContent}><View testID={testID} style={styles.state} accessibilityLabel={kind === "loading" ? title : undefined}>{kind === "loading" ? <ActivityIndicator color={colors.icon} /> : <Ionicons name="cloud-offline-outline" size={32} color={colors === Colors.dark ? "#FF8B82" : "#B42318"} />}<ThemedText style={styles.stateTitle}>{title}</ThemedText>{message ? <ThemedText style={[styles.stateMessage, { color: colors.icon }]}>{message}</ThemedText> : null}{onRetry ? <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={onRetry} style={({ pressed }) => [styles.secondary, { backgroundColor: pressed ? colors.inputBackground : colors.background, borderColor: colors.inputBorder }]}><Ionicons name="refresh-outline" size={20} color={colors.text} /><ThemedText style={[styles.secondaryText, { color: colors.text }]}>Retry</ThemedText></Pressable> : null}</View></ScrollView>;
}

function Meta({ colors, icon, text }: { colors: typeof Colors.light; icon: keyof typeof Ionicons.glyphMap; text: string }) { return <View style={styles.meta}><Ionicons name={icon} size={18} color={colors.icon} /><ThemedText style={[styles.metaText, { color: colors.icon }]}>{text}</ThemedText></View>; }

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28 },
  header: { minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }, headerCopy: { flex: 1, alignItems: "center" }, headerTitle: { fontSize: 20, fontWeight: "700" }, iconAction: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  hero: { paddingVertical: 10 }, cadence: { flexDirection: "row", gap: 7, marginBottom: 18 }, mark: { flex: 1, height: 7, borderWidth: 1, borderRadius: 4 }, name: { fontSize: 30, fontWeight: "800", fontFamily: Fonts.sans }, source: { marginTop: 7, fontSize: 13, fontWeight: "600" }, description: { marginTop: 12, fontSize: 16 },
  metaRow: { marginTop: 20, gap: 12 }, meta: { flexDirection: "row", alignItems: "center", gap: 9 }, metaText: { flex: 1, fontSize: 14, fontWeight: "600" }, activeBadge: { marginTop: 18, minHeight: 36, maxWidth: "100%", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: "rgba(39,196,92,0.14)", flexDirection: "row", alignItems: "center", gap: 7 }, badgeText: { flexShrink: 1, fontSize: 14, fontWeight: "700" },
  scheduledBadge: { marginTop: 10, minHeight: 36, maxWidth: "100%", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: "rgba(106,79,245,0.12)", flexDirection: "row", alignItems: "center", gap: 7 },
  inlineError: { marginVertical: 10 }, sectionTitle: { marginTop: 26, marginBottom: 12, fontSize: 20, fontWeight: "800" },
  day: { borderWidth: 1, borderRadius: 18, marginBottom: 12, overflow: "hidden" }, dayHeader: { minHeight: 68, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "flex-start", gap: 12 }, dayNumber: { minWidth: 34, minHeight: 34, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" }, dayNumberText: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }, dayCopy: { flex: 1, gap: 4 }, dayTitle: { fontSize: 16, fontWeight: "800" }, count: { fontSize: 12 },
  exercise: { minHeight: 64, borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 }, exerciseStacked: { flexDirection: "column", alignItems: "stretch" }, exerciseCopy: { flex: 1 }, exerciseName: { fontWeight: "700" }, prescription: { marginTop: 4, fontSize: 12 }, block: { flexShrink: 1, fontSize: 11, textTransform: "capitalize", fontWeight: "700" }, equipment: { fontSize: 15, textTransform: "capitalize" },
  actions: { marginTop: 26, gap: 10 }, primary: { minHeight: 54, paddingHorizontal: 18, paddingVertical: 14, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center" }, primaryPressed: { transform: [{ scale: 0.99 }] }, primaryText: { color: "#FFF", fontSize: 16, fontWeight: "800", textAlign: "center" }, secondary: { minHeight: 52, paddingHorizontal: 18, paddingVertical: 14, borderWidth: 1, borderRadius: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }, secondaryText: { flexShrink: 1, fontSize: 16, fontWeight: "700", textAlign: "center" },
  stateContent: { flexGrow: 1, padding: 22, justifyContent: "center" }, state: { alignItems: "stretch", gap: 16 }, stateTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" }, stateMessage: { fontSize: 15, textAlign: "center" },
});
