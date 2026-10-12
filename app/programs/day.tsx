import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, TouchableWithoutFeedback, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
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
  const { width, fontScale } = useWindowDimensions();
  const dark = colors.background === Colors.dark.background;
  const danger = dark ? "#FF8B82" : "#B42318";
  const fieldWidth = fontScale >= 2 ? "100%" : width < 400 || fontScale > 1.2 ? "48%" : "23%";
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

  if (!day) return <SafeAreaView testID="program-day-safe-area" style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}><DayHeader colors={colors} fontScale={fontScale} onBack={() => router.back()} /><ScrollView contentContainerStyle={styles.content}><EmptyDay colors={colors} title="Workout day unavailable" message="Return to the program builder and choose a workout day." actionLabel="Back to builder" onAction={() => router.back()} /></ScrollView></SafeAreaView>;

  return (
    <SafeAreaView testID="program-day-safe-area" style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <DayHeader colors={colors} fontScale={fontScale} onBack={() => router.back()} onDone={finishEditing} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView testID="program-day-scroll" contentContainerStyle={styles.content} keyboardShouldPersistTaps="always" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }} showsVerticalScrollIndicator={false}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }}>
        <ThemedText testID="program-day-editor-title" style={styles.title}>Workout day</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.icon }]}>{day.exercises.length} {day.exercises.length === 1 ? "exercise" : "exercises"}</ThemedText>
        <ThemedText style={styles.label}>Workout name</ThemedText>
        <TextInput testID="program-day-title" accessibilityLabel="Workout day name" value={day.title} onChangeText={(title) => updateDay(day.localId, { title })} placeholder="Upper body" placeholderTextColor={colors.icon} style={[styles.titleInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]} />

        <View style={[styles.sectionRow, fontScale >= 2 && styles.stackedSection]}><ThemedText style={styles.sectionTitle}>Exercises</ThemedText><Pressable testID="program-day-add-exercise" accessibilityRole="button" accessibilityLabel="Add exercise" onPress={() => { Keyboard.dismiss(); router.push({ pathname: "/programs/exercise-picker", params: { dayId: day.localId } }); }} style={({ pressed }) => [styles.add, { borderColor: colors.inputBorder, backgroundColor: pressed ? dark ? "#2C2C2C" : "#F5F5F5" : colors.inputBackground }]}><Ionicons name="add" size={20} color={colors.text} /><ThemedText style={[styles.addText, { color: colors.text }]}>Add</ThemedText></Pressable></View>
        {day.exercises.length === 0 ? <EmptyDay colors={colors} title="Add the first exercise" message="Each workout day needs at least one exercise." actionLabel="Choose exercise" onAction={() => router.push({ pathname: "/programs/exercise-picker", params: { dayId: day.localId } })} testID="program-day-empty" /> : null}
        {day.exercises.map((item, index) => (
          <View testID={`program-exercise-${index + 1}`} key={item.localId} style={[styles.exerciseCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}>
            <View style={[styles.exerciseHeader, fontScale > 1.2 && styles.stackedHeader]}><View style={[styles.initials, { borderColor: colors.inputBorder, backgroundColor: colors.background }]}><ThemedText style={[styles.initialsText, { color: colors.text }]}>{item.exercise.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase()}</ThemedText></View><View style={[styles.exerciseCopy, fontScale > 1.2 && styles.stackedCopy]}><ThemedText style={styles.exerciseName}>{item.exercise.name}</ThemedText><ThemedText style={[styles.muscle, { color: colors.icon }]}>{item.exercise.primaryMuscle}</ThemedText></View><Pressable testID={`program-exercise-remove-${index + 1}`} accessibilityRole="button" accessibilityLabel={`Remove ${item.exercise.name}`} onPress={() => removeExercise(day.localId, item.localId)} style={({ pressed }) => [styles.iconButton, fontScale > 1.2 && styles.stackedRemove, { backgroundColor: pressed ? dark ? "#2C2C2C" : "#F5F5F5" : undefined }]}><Ionicons name="trash-outline" size={21} color={danger} /></Pressable></View>
            <View style={styles.inputGrid}>
              {(Object.keys(PRESCRIPTION_LIMITS) as PrescriptionKey[]).map((key) => <NumberField key={key} label={PRESCRIPTION_LIMITS[key].label} value={valuesFor(item)[key]} onChange={(value) => updatePrescriptionDraft(item, key, value)} onCommit={() => commitPrescription(item)} testID={`program-exercise-${key === "sets" ? "sets" : key === "repsMin" ? "reps-min" : key === "repsMax" ? "reps-max" : "rest"}-${index + 1}`} colors={colors} width={fieldWidth} />)}
            </View>
            {prescriptionError?.itemId === item.localId ? <ThemedText testID={`program-prescription-error-${index + 1}`} accessibilityRole="alert" style={[styles.prescriptionError, { color: danger }]}>{prescriptionError.message}</ThemedText> : null}
            <View style={styles.blockRow}>{["main", "accessory"].map((blockType) => <Pressable key={blockType} testID={`program-exercise-block-${index + 1}-${blockType}`} accessibilityRole="button" accessibilityState={{ selected: item.blockType === blockType }} onPress={() => updateExercise(day.localId, item.localId, { blockType })} style={({ pressed }) => [styles.blockChip, fontScale >= 2 && styles.fullBlock, { borderColor: item.blockType === blockType ? colors.icon : colors.inputBorder, backgroundColor: item.blockType === blockType || pressed ? dark ? "#2C2C2C" : "#F5F5F5" : colors.background }]}>{item.blockType === blockType ? <Ionicons name="checkmark" size={17} color={colors.text} /> : null}<ThemedText style={[styles.blockLabel, { color: colors.text }]}>{blockType === "main" ? "Main" : "Accessory"}</ThemedText></Pressable>)}</View>
            <ThemedText style={[styles.cueLabel, { color: colors.icon }]}>Training cue (optional)</ThemedText>
            <TextInput testID={`program-exercise-cue-${index + 1}`} accessibilityLabel={`Training cue for ${item.exercise.name}`} value={item.cue ?? ""} onChangeText={(cue) => updateExercise(day.localId, item.localId, { cue })} placeholder="Optional setup cue" placeholderTextColor={colors.icon} style={[styles.cue, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.background }]} />
            <View style={[styles.orderRow, { borderTopColor: colors.inputBorder }]}><OrderButton icon="arrow-up" label={`Move ${item.exercise.name} up`} disabled={index === 0} onPress={() => moveExercise(day.localId, item.localId, -1)} colors={colors} testID={`program-exercise-up-${index + 1}`} /><OrderButton icon="arrow-down" label={`Move ${item.exercise.name} down`} disabled={index === day.exercises.length - 1} onPress={() => moveExercise(day.localId, item.localId, 1)} colors={colors} testID={`program-exercise-down-${index + 1}`} /></View>
          </View>
        ))}
        </View>
        </TouchableWithoutFeedback>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DayHeader({ colors, fontScale, onBack, onDone }: { colors: typeof Colors.light; fontScale: number; onBack: () => void; onDone?: () => void }) { return <View testID="program-day-header" style={styles.header} onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }}><Pressable testID="program-day-back" accessibilityRole="button" accessibilityLabel="Back from Workout day" onPress={() => { Keyboard.dismiss(); onBack(); }} style={styles.iconButton}><Ionicons name="arrow-back" size={24} color={colors.text} /></Pressable><TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}><View style={styles.headerCopy}>{fontScale < 2 ? <ThemedText style={styles.headerTitle}>Workout day</ThemedText> : null}</View></TouchableWithoutFeedback>{onDone ? <Pressable testID="program-day-done" accessibilityRole="button" accessibilityLabel="Finish editing workout day" onPress={() => { Keyboard.dismiss(); onDone(); }} style={({ pressed }) => [styles.done, { backgroundColor: colors.primaryButton, transform: [{ scale: pressed ? 0.99 : 1 }] }]}><ThemedText style={styles.doneText}>Done</ThemedText></Pressable> : <View style={styles.iconButton} />}</View>; }
function EmptyDay({ colors, title, message, actionLabel, onAction, testID }: { colors: typeof Colors.light; title: string; message: string; actionLabel: string; onAction: () => void; testID?: string }) { const dark = colors.background === Colors.dark.background; return <View testID={testID} style={styles.empty}><Ionicons name="barbell-outline" size={28} color={colors.icon} /><ThemedText style={styles.emptyTitle}>{title}</ThemedText><ThemedText style={[styles.emptyMessage, { color: colors.icon }]}>{message}</ThemedText><Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={() => { Keyboard.dismiss(); onAction(); }} style={({ pressed }) => [styles.emptyAction, { borderColor: colors.inputBorder, backgroundColor: pressed ? dark ? "#2C2C2C" : "#F5F5F5" : colors.inputBackground }]}><ThemedText style={styles.addText}>{actionLabel}</ThemedText></Pressable></View>; }
function NumberField({ label, value, onChange, onCommit, testID, colors, width }: { label: string; value: string; onChange: (value: string) => void; onCommit: () => void; testID: string; colors: typeof Colors.light; width: "23%" | "48%" | "100%" }) { return <View style={[styles.numberField, { width }]}><ThemedText style={[styles.numberLabel, { color: colors.icon }]}>{label}</ThemedText><TextInput testID={testID} accessibilityLabel={label} keyboardType="number-pad" value={value} onChangeText={onChange} onBlur={onCommit} onSubmitEditing={onCommit} style={[styles.numberInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.background }]} /></View>; }
function OrderButton({ icon, label, disabled, onPress, colors, testID }: { icon: "arrow-up" | "arrow-down"; label: string; disabled: boolean; onPress: () => void; colors: typeof Colors.light; testID: string }) { const dark = colors.background === Colors.dark.background; return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.orderButton, { backgroundColor: pressed && !disabled ? dark ? "#2C2C2C" : "#F5F5F5" : undefined }]}><Ionicons name={icon} size={20} color={disabled ? colors.icon : colors.text} /></Pressable>; }

const styles = StyleSheet.create({
  container: { flex: 1 }, flex: { flex: 1 }, header: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 }, headerCopy: { flex: 1, minWidth: 0, alignItems: "center" }, headerTitle: { fontSize: 17, fontWeight: "700" }, done: { minWidth: 64, minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 13, alignItems: "center", justifyContent: "center", maxWidth: "75%" }, doneText: { color: "#FFF", fontSize: 16, fontWeight: "700" }, content: { padding: 21, paddingBottom: 32 }, title: { fontSize: 28, fontWeight: "800" }, subtitle: { fontSize: 14, marginTop: 4, marginBottom: 24 }, label: { fontSize: 14, fontWeight: "700", marginBottom: 8 }, titleInput: { minHeight: 54, borderWidth: 1, borderRadius: 17, paddingHorizontal: 15, paddingVertical: 14, fontSize: 17, fontWeight: "700" },
  sectionRow: { minHeight: 70, marginTop: 15, marginBottom: 4, flexDirection: "row", alignItems: "center", gap: 12 }, stackedSection: { flexDirection: "column", alignItems: "stretch", paddingVertical: 16 }, sectionTitle: { flex: 1, fontSize: 21, fontWeight: "800" }, add: { minHeight: 44, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }, addText: { fontWeight: "700" },
  exerciseCard: { borderWidth: 1, borderRadius: 20, marginBottom: 13, overflow: "hidden" }, exerciseHeader: { minHeight: 70, padding: 13, flexDirection: "row", alignItems: "center", gap: 11 }, stackedHeader: { flexDirection: "column", alignItems: "stretch" }, exerciseCopy: { flex: 1, minWidth: 0 }, stackedCopy: { flex: 0 }, stackedRemove: { alignSelf: "flex-end" }, initials: { minWidth: 44, minHeight: 44, borderWidth: 1, padding: 10, borderRadius: 13, alignSelf: "flex-start", alignItems: "center", justifyContent: "center" }, initialsText: { fontSize: 16, fontWeight: "700" }, exerciseName: { fontSize: 17, fontWeight: "700" }, muscle: { marginTop: 3, fontSize: 13, textTransform: "capitalize" }, iconButton: { width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  inputGrid: { paddingHorizontal: 13, flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }, numberField: { minWidth: 0 }, numberLabel: { fontSize: 14, marginBottom: 6 }, numberInput: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 12, textAlign: "center", fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] }, prescriptionError: { marginHorizontal: 13, marginTop: 9, fontSize: 14 }, blockRow: { padding: 13, flexDirection: "row", flexWrap: "wrap", gap: 8 }, blockChip: { minHeight: 44, flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, fullBlock: { flex: undefined, width: "100%" }, blockLabel: { fontSize: 14, fontWeight: "700", flexShrink: 1 }, cueLabel: { fontSize: 14, marginHorizontal: 13, marginBottom: 6 }, cue: { marginHorizontal: 13, minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14, fontSize: 16 }, orderRow: { marginTop: 13, minHeight: 56, borderTopWidth: 1, flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 7, paddingVertical: 6, gap: 8 }, orderButton: { width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" }, empty: { paddingVertical: 28, alignItems: "center", gap: 12 }, emptyTitle: { fontSize: 19, fontWeight: "700", textAlign: "center" }, emptyMessage: { fontSize: 14, textAlign: "center" }, emptyAction: { minHeight: 44, borderWidth: 1, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 12, alignItems: "center", justifyContent: "center", maxWidth: "100%" },
});
