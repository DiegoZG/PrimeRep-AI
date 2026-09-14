import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProgramHeader } from "@/components/program";
import { ScreenState } from "@/components/screen-state";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useProgramDraft } from "@/utils/programDraftContext";

type PrescriptionKey = "sets" | "repsMin" | "repsMax" | "restSeconds";
type PrescriptionDraft = Record<PrescriptionKey, string>;

const PRESCRIPTION_LIMITS: Record<PrescriptionKey, { label: string; min: number; max: number }> = {
  sets: { label: "Sets", min: 1, max: 20 },
  repsMin: { label: "Min reps", min: 1, max: 100 },
  repsMax: { label: "Max reps", min: 1, max: 100 },
  restSeconds: { label: "Rest sec", min: 0, max: 900 },
};

export default function ProgramDayEditorScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { draft, updateDay, updateExercise, removeExercise, moveExercise } = useProgramDraft();
  const day = draft.days.find((item) => item.localId === dayId);
  const [prescriptionDrafts, setPrescriptionDrafts] = useState<Record<string, PrescriptionDraft>>({});
  const [prescriptionError, setPrescriptionError] = useState<{ itemId: string; message: string } | null>(null);

  const valuesFor = (item: NonNullable<typeof day>["exercises"][number]): PrescriptionDraft => prescriptionDrafts[item.localId] ?? {
    sets: String(item.sets),
    repsMin: String(item.repsMin),
    repsMax: String(item.repsMax),
    restSeconds: String(item.restSeconds),
  };

  const updatePrescriptionDraft = (item: NonNullable<typeof day>["exercises"][number], key: PrescriptionKey, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setPrescriptionDrafts((current) => ({ ...current, [item.localId]: { ...valuesFor(item), ...current[item.localId], [key]: value } }));
    setPrescriptionError((current) => current?.itemId === item.localId ? null : current);
  };

  const parsePrescription = (item: NonNullable<typeof day>["exercises"][number]): Record<PrescriptionKey, number> | null => {
    const values = valuesFor(item);
    const parsed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number.parseInt(value, 10)])) as Record<PrescriptionKey, number>;
    for (const key of Object.keys(PRESCRIPTION_LIMITS) as PrescriptionKey[]) {
      const limits = PRESCRIPTION_LIMITS[key];
      if (!Number.isFinite(parsed[key]) || parsed[key] < limits.min || parsed[key] > limits.max) {
        setPrescriptionError({ itemId: item.localId, message: `${limits.label} must be between ${limits.min} and ${limits.max}.` });
        return null;
      }
    }
    if (parsed.repsMin > parsed.repsMax) {
      setPrescriptionError({ itemId: item.localId, message: "Minimum reps cannot exceed maximum reps." });
      return null;
    }
    return parsed;
  };

  const commitPrescription = (item: NonNullable<typeof day>["exercises"][number]) => {
    const parsed = parsePrescription(item);
    if (!parsed) return false;
    updateExercise(dayId, item.localId, parsed);
    setPrescriptionDrafts((current) => ({ ...current, [item.localId]: {
      sets: String(parsed.sets),
      repsMin: String(parsed.repsMin),
      repsMax: String(parsed.repsMax),
      restSeconds: String(parsed.restSeconds),
    } }));
    return true;
  };

  const finishEditing = () => {
    if (!day) return;
    for (const item of day.exercises) if (!commitPrescription(item)) return;
    router.back();
  };

  if (!day) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ProgramHeader title="Workout day" onBack={() => router.back()} /><ScreenState colors={colors} kind="empty" title="Workout day unavailable" message="Return to the program builder and choose a workout day." actionLabel="Back to builder" onAction={() => router.back()} /></SafeAreaView>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ProgramHeader title="Workout day" subtitle={`${day.exercises.length} ${day.exercises.length === 1 ? "exercise" : "exercises"}`} onBack={() => router.back()} action={<Pressable testID="program-day-done" accessibilityRole="button" accessibilityLabel="Finish editing workout day" onPress={finishEditing} style={styles.done}><ThemedText style={{ color: colors.primaryButton, fontWeight: "900" }}>Done</ThemedText></Pressable>} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText style={styles.label}>Workout name</ThemedText>
        <TextInput testID="program-day-title" accessibilityLabel="Workout day name" value={day.title} onChangeText={(title) => updateDay(day.localId, { title })} placeholder="Upper body" placeholderTextColor={colors.placeholder} style={[styles.titleInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]} />

        <View style={styles.sectionRow}><ThemedText style={styles.sectionTitle}>Exercises</ThemedText><Pressable testID="program-day-add-exercise" accessibilityRole="button" accessibilityLabel="Add exercise" onPress={() => router.push({ pathname: "/programs/exercise-picker", params: { dayId: day.localId } })} style={[styles.add, { backgroundColor: colors.primaryButton }]}><Ionicons name="add" size={20} color="#FFF" /><ThemedText style={styles.addText}>Add</ThemedText></Pressable></View>
        {day.exercises.length === 0 ? <ScreenState colors={colors} kind="empty" title="Add the first exercise" message="Each workout day needs at least one exercise." actionLabel="Choose exercise" onAction={() => router.push({ pathname: "/programs/exercise-picker", params: { dayId: day.localId } })} testID="program-day-empty" /> : null}
        {day.exercises.map((item, index) => (
          <View testID={`program-exercise-${index + 1}`} key={item.localId} style={[styles.exerciseCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}>
            <View style={styles.exerciseHeader}><View style={[styles.initials, { backgroundColor: "rgba(0,212,255,0.11)" }]}><ThemedText style={styles.initialsText}>{item.exercise.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase()}</ThemedText></View><View style={styles.flex}><ThemedText style={styles.exerciseName}>{item.exercise.name}</ThemedText><ThemedText style={[styles.muscle, { color: colors.placeholder }]}>{item.exercise.primaryMuscle}</ThemedText></View><Pressable testID={`program-exercise-remove-${index + 1}`} accessibilityRole="button" accessibilityLabel={`Remove ${item.exercise.name}`} onPress={() => removeExercise(day.localId, item.localId)} style={styles.iconButton}><Ionicons name="trash-outline" size={21} color="#D92D20" /></Pressable></View>
            <View style={styles.inputGrid}>
              {(Object.keys(PRESCRIPTION_LIMITS) as PrescriptionKey[]).map((key) => <NumberField key={key} label={PRESCRIPTION_LIMITS[key].label} value={valuesFor(item)[key]} onChange={(value) => updatePrescriptionDraft(item, key, value)} onCommit={() => commitPrescription(item)} testID={`program-exercise-${key === "sets" ? "sets" : key === "repsMin" ? "reps-min" : key === "repsMax" ? "reps-max" : "rest"}-${index + 1}`} colors={colors} />)}
            </View>
            {prescriptionError?.itemId === item.localId ? <ThemedText testID={`program-prescription-error-${index + 1}`} accessibilityRole="alert" style={styles.prescriptionError}>{prescriptionError.message}</ThemedText> : null}
            <View style={styles.blockRow}>{["main", "accessory"].map((blockType) => <Pressable key={blockType} testID={`program-exercise-block-${index + 1}-${blockType}`} accessibilityRole="button" accessibilityState={{ selected: item.blockType === blockType }} onPress={() => updateExercise(day.localId, item.localId, { blockType })} style={[styles.blockChip, { borderColor: item.blockType === blockType ? colors.primaryButton : colors.inputBorder, backgroundColor: item.blockType === blockType ? "rgba(106,79,245,0.1)" : colors.background }]}><ThemedText style={{ color: item.blockType === blockType ? colors.primaryButton : colors.placeholder, fontSize: 12, fontWeight: "800", textTransform: "capitalize" }}>{blockType}</ThemedText></Pressable>)}</View>
            <TextInput testID={`program-exercise-cue-${index + 1}`} accessibilityLabel={`Training cue for ${item.exercise.name}`} value={item.cue ?? ""} onChangeText={(cue) => updateExercise(day.localId, item.localId, { cue })} placeholder="Optional setup cue" placeholderTextColor={colors.placeholder} style={[styles.cue, { color: colors.text, borderColor: colors.inputBorder }]} />
            <View style={[styles.orderRow, { borderTopColor: colors.inputBorder }]}><OrderButton icon="arrow-up" label={`Move ${item.exercise.name} up`} disabled={index === 0} onPress={() => moveExercise(day.localId, item.localId, -1)} colors={colors} testID={`program-exercise-up-${index + 1}`} /><OrderButton icon="arrow-down" label={`Move ${item.exercise.name} down`} disabled={index === day.exercises.length - 1} onPress={() => moveExercise(day.localId, item.localId, 1)} colors={colors} testID={`program-exercise-down-${index + 1}`} /></View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function NumberField({ label, value, onChange, onCommit, testID, colors }: { label: string; value: string; onChange: (value: string) => void; onCommit: () => void; testID: string; colors: typeof Colors.light }) { return <View style={styles.numberField}><ThemedText style={[styles.numberLabel, { color: colors.placeholder }]}>{label}</ThemedText><TextInput testID={testID} accessibilityLabel={label} keyboardType="number-pad" value={value} onChangeText={onChange} onBlur={onCommit} onSubmitEditing={onCommit} style={[styles.numberInput, { color: colors.text, borderColor: colors.inputBorder }]} /></View>; }
function OrderButton({ icon, label, disabled, onPress, colors, testID }: { icon: "arrow-up" | "arrow-down"; label: string; disabled: boolean; onPress: () => void; colors: typeof Colors.light; testID: string }) { return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.orderButton, { opacity: disabled ? 0.3 : 1 }]}><Ionicons name={icon} size={20} color={colors.text} /></Pressable>; }

const styles = StyleSheet.create({
  container: { flex: 1 }, flex: { flex: 1 }, done: { width: 54, height: 44, alignItems: "center", justifyContent: "center" }, content: { padding: 21, paddingBottom: 50 }, label: { fontSize: 14, fontWeight: "800", marginBottom: 8 }, titleInput: { minHeight: 54, borderWidth: 1, borderRadius: 17, paddingHorizontal: 15, fontSize: 17, fontWeight: "700" },
  sectionRow: { minHeight: 70, marginTop: 15, flexDirection: "row", alignItems: "center" }, sectionTitle: { flex: 1, fontSize: 21, fontWeight: "900" }, add: { minHeight: 44, borderRadius: 15, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 5 }, addText: { color: "#FFF", fontWeight: "800" },
  exerciseCard: { borderWidth: 1, borderRadius: 20, marginBottom: 13, overflow: "hidden" }, exerciseHeader: { minHeight: 70, padding: 13, flexDirection: "row", alignItems: "center", gap: 11 }, initials: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" }, initialsText: { color: "#009FC4", fontWeight: "900" }, exerciseName: { fontSize: 16, fontWeight: "800" }, muscle: { marginTop: 2, fontSize: 12, textTransform: "capitalize" }, iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  inputGrid: { paddingHorizontal: 13, flexDirection: "row", gap: 7 }, numberField: { flex: 1 }, numberLabel: { fontSize: 10, marginBottom: 5 }, numberInput: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, textAlign: "center", fontWeight: "700" }, prescriptionError: { marginHorizontal: 13, marginTop: 9, color: "#D92D20", fontSize: 12, lineHeight: 17 }, blockRow: { padding: 13, flexDirection: "row", gap: 7 }, blockChip: { minHeight: 38, flex: 1, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" }, cue: { marginHorizontal: 13, minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }, orderRow: { marginTop: 13, minHeight: 48, borderTopWidth: 1, flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 7 }, orderButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
