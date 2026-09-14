import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProgramHeader } from "@/components/program";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { ProgramGoal, ProgramLevel } from "@/interfaces/programs";
import { createProgram, updateProgram } from "@/services/programService";
import { HttpError } from "@/services/httpClient";
import { AuthContext } from "@/utils/authContext";
import { useProgramDraft } from "@/utils/programDraftContext";
import { PROGRAM_GOAL_LABELS, PROGRAM_LEVEL_LABELS } from "@/utils/programDisplay";

export default function ProgramBuilderScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { token, user } = useContext(AuthContext);
  const { draft, updateMetadata, addDay, removeDay, moveDay, toPayload, loadProgram } = useProgramDraft();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aliasesText, setAliasesText] = useState(draft.aliases.join(", "));
  const isEditing = Boolean(draft.templateId);
  const accountRef = useRef(`${user?.id ?? "guest"}:${token ?? "anonymous"}`);
  accountRef.current = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const mountedRef = useRef(true);
  const mutationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mutationRef.current += 1;
    };
  }, []);

  const validation = useMemo(() => {
    if (draft.name.trim().length < 2) return "Give your program a name.";
    if (draft.description.trim().length < 10) return "Add a short description so the plan is clear.";
    if (draft.days.length < 1) return "Add at least one workout day.";
    if (draft.days.some((day) => !day.title.trim())) return "Every workout day needs a name.";
    if (draft.days.some((day) => day.exercises.length < 1)) return "Add at least one exercise to every workout day.";
    if (draft.days.some((day) => day.exercises.some((item) => item.sets < 1 || item.sets > 20))) return "Sets must be between 1 and 20.";
    if (draft.days.some((day) => day.exercises.some((item) => item.repsMin < 1 || item.repsMax > 100))) return "Reps must be between 1 and 100.";
    if (draft.days.some((day) => day.exercises.some((item) => item.repsMin > item.repsMax))) return "Minimum reps cannot exceed maximum reps.";
    if (draft.days.some((day) => day.exercises.some((item) => item.restSeconds < 0 || item.restSeconds > 900))) return "Rest must be between 0 and 900 seconds.";
    return null;
  }, [draft]);

  const save = async () => {
    if (!token || !user || saving) return;
    if (validation) { setError(validation); return; }
    setSaving(true);
    setError(null);
    const account = accountRef.current;
    const mutationId = ++mutationRef.current;
    const isCurrent = () => mountedRef.current && accountRef.current === account && mutationRef.current === mutationId;
    try {
      const payload = { ...toPayload(), aliases: aliasesText.split(",").map((item) => item.trim()).filter(Boolean) };
      const saved = draft.templateId
        ? await updateProgram(token, draft.templateId, payload)
        : await createProgram(token, payload);
      if (!isCurrent()) return;
      loadProgram({
        ...saved,
        isActive: draft.isActive,
        isScheduled: draft.isScheduled,
      });
      if (draft.isActive || draft.isScheduled) {
        Alert.alert("Update scheduled workouts?", "Choose when the new version should change unfinished workouts.", [
          { text: "Next week", onPress: () => router.replace({ pathname: "/programs/activate", params: { templateId: saved.id, applyMode: "next-week" } }) },
          { text: "Apply now", onPress: () => router.replace({ pathname: "/programs/activate", params: { templateId: saved.id, applyMode: "now" } }) },
        ]);
      } else {
        router.replace({ pathname: "/programs/[templateId]", params: { templateId: saved.id } });
      }
    } catch (saveError) {
      if (!isCurrent()) return;
      if (saveError instanceof HttpError && saveError.status === 409) setError("This program changed elsewhere. Return to its details and reopen Edit.");
      else setError("Your program couldn’t be saved. Check your connection and try again.");
    } finally { if (isCurrent()) setSaving(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ProgramHeader title={isEditing ? "Edit program" : "Build program"} subtitle="Repeats every week" onBack={() => router.back()} backDisabled={saving} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <FieldLabel text="Program name" />
          <TextInput testID="program-name-input" accessibilityLabel="Program name" value={draft.name} onChangeText={(name) => { updateMetadata({ name }); setError(null); }} placeholder="My strength plan" placeholderTextColor={colors.placeholder} style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]} />
          <FieldLabel text="What is this program for?" />
          <TextInput testID="program-description-input" accessibilityLabel="Program description" value={draft.description} onChangeText={(description) => { updateMetadata({ description }); setError(null); }} placeholder="A clear description of the plan" placeholderTextColor={colors.placeholder} multiline style={[styles.input, styles.description, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]} />
          <FieldLabel text="Search aliases (optional)" />
          <TextInput testID="program-aliases-input" accessibilityLabel="Program search aliases" value={aliasesText} onChangeText={setAliasesText} placeholder="push pull legs, ppl" placeholderTextColor={colors.placeholder} style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]} />
          <ThemedText style={[styles.helper, { color: colors.placeholder }]}>Separate alternate names with commas.</ThemedText>

          <FieldLabel text="Goal" />
          <View style={styles.wrap}>{(Object.keys(PROGRAM_GOAL_LABELS) as ProgramGoal[]).map((goal) => <Choice key={goal} testID={`program-goal-${goal}`} label={PROGRAM_GOAL_LABELS[goal]} selected={draft.goal === goal} onPress={() => updateMetadata({ goal })} colors={colors} />)}</View>
          <FieldLabel text="Experience" />
          <View style={styles.wrap}>{(Object.keys(PROGRAM_LEVEL_LABELS) as ProgramLevel[]).map((level) => <Choice key={level} testID={`program-level-${level}`} label={PROGRAM_LEVEL_LABELS[level]} selected={draft.level === level} onPress={() => updateMetadata({ level })} colors={colors} />)}</View>
          <FieldLabel text="Workout duration" />
          <View style={styles.wrap}>{[25, 35, 45, 60].map((duration) => <Choice key={duration} testID={`program-duration-${duration}`} label={`${duration} min`} selected={draft.durationMinutes === duration} onPress={() => updateMetadata({ durationMinutes: duration })} colors={colors} />)}</View>

          <View style={styles.daysTitle}><View style={styles.flex}><ThemedText style={styles.sectionTitle}>Workout days</ThemedText><ThemedText style={[styles.helper, { color: colors.placeholder }]}>{draft.days.length}/7 days · drag-free ordering</ThemedText></View><Pressable testID="program-add-day" accessibilityRole="button" accessibilityLabel="Add workout day" accessibilityState={{ disabled: draft.days.length >= 7 }} disabled={draft.days.length >= 7} onPress={() => { addDay(); setError(null); }} style={[styles.addDay, { backgroundColor: colors.primaryButton, opacity: draft.days.length >= 7 ? 0.4 : 1 }]}><Ionicons name="add" size={22} color="#FFF" /></Pressable></View>
          {draft.days.map((day, index) => (
            <View testID={`program-builder-day-${index + 1}`} key={day.localId} style={[styles.dayCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}>
              <Pressable testID={`program-builder-day-open-${index + 1}`} accessibilityRole="button" accessibilityLabel={`Edit ${day.title}`} onPress={() => router.push({ pathname: "/programs/day", params: { dayId: day.localId } })} style={styles.dayMain}>
                <View style={[styles.dayNumber, { backgroundColor: "rgba(106,79,245,0.12)" }]}><ThemedText style={{ color: colors.primaryButton, fontWeight: "900" }}>{index + 1}</ThemedText></View>
                <View style={styles.flex}><ThemedText style={styles.dayName}>{day.title}</ThemedText><ThemedText style={[styles.helper, { color: colors.placeholder }]}>{day.exercises.length} {day.exercises.length === 1 ? "exercise" : "exercises"}</ThemedText></View>
                <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
              </Pressable>
              <View style={[styles.dayActions, { borderTopColor: colors.inputBorder }]}>
                <MoveButton label={`Move ${day.title} up`} icon="arrow-up" disabled={index === 0} onPress={() => moveDay(day.localId, -1)} colors={colors} testID={`program-day-up-${index + 1}`} />
                <MoveButton label={`Move ${day.title} down`} icon="arrow-down" disabled={index === draft.days.length - 1} onPress={() => moveDay(day.localId, 1)} colors={colors} testID={`program-day-down-${index + 1}`} />
                <Pressable testID={`program-day-remove-${index + 1}`} accessibilityRole="button" accessibilityLabel={`Remove ${day.title}`} onPress={() => removeDay(day.localId)} style={styles.move}><Ionicons name="trash-outline" size={20} color="#D92D20" /></Pressable>
              </View>
            </View>
          ))}
          {error ? <ThemedText testID="program-builder-error" accessibilityRole="alert" style={styles.error}>{error}</ThemedText> : null}
          <Pressable testID="program-save" accessibilityRole="button" accessibilityLabel={isEditing ? "Save program changes" : "Create program"} accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} onPress={() => void save()} style={[styles.save, { backgroundColor: colors.primaryButton, opacity: saving ? 0.65 : 1 }]}><ThemedText style={styles.saveText}>{saving ? "Saving…" : isEditing ? "Save changes" : "Create program"}</ThemedText></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ text }: { text: string }) { return <ThemedText style={styles.label}>{text}</ThemedText>; }
function Choice({ label, selected, onPress, colors, testID }: { label: string; selected: boolean; onPress: () => void; colors: typeof Colors.light; testID: string }) { return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label} onPress={onPress} style={[styles.choice, { borderColor: selected ? colors.primaryButton : colors.inputBorder, backgroundColor: selected ? "rgba(106,79,245,0.11)" : colors.inputBackground }]}><ThemedText style={{ color: selected ? colors.primaryButton : colors.text, fontWeight: "700" }}>{label}</ThemedText></Pressable>; }
function MoveButton({ label, icon, disabled, onPress, colors, testID }: { label: string; icon: "arrow-up" | "arrow-down"; disabled: boolean; onPress: () => void; colors: typeof Colors.light; testID: string }) { return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.move, { opacity: disabled ? 0.3 : 1 }]}><Ionicons name={icon} size={20} color={colors.text} /></Pressable>; }

const styles = StyleSheet.create({
  container: { flex: 1 }, flex: { flex: 1 }, content: { padding: 22, paddingBottom: 52 }, label: { marginTop: 19, marginBottom: 8, fontSize: 15, fontWeight: "800" },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, fontSize: 16 }, description: { minHeight: 96, paddingTop: 14, textAlignVertical: "top" }, wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, choice: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 15, alignItems: "center", justifyContent: "center" },
  daysTitle: { marginTop: 31, marginBottom: 12, flexDirection: "row", alignItems: "center" }, sectionTitle: { fontSize: 21, fontWeight: "900" }, helper: { marginTop: 3, fontSize: 12 }, addDay: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dayCard: { borderWidth: 1, borderRadius: 19, marginBottom: 11, overflow: "hidden" }, dayMain: { minHeight: 75, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 }, dayNumber: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" }, dayName: { fontSize: 16, fontWeight: "800" }, dayActions: { minHeight: 48, borderTopWidth: 1, flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 6 }, move: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  error: { color: "#D92D20", marginTop: 12, lineHeight: 20 }, save: { minHeight: 56, marginTop: 22, borderRadius: 18, alignItems: "center", justifyContent: "center" }, saveText: { color: "#FFF", fontSize: 17, fontWeight: "900" },
});
