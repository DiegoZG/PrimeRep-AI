import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProgramHeader } from "@/components/program";
import { ScreenState } from "@/components/screen-state";
import { ThemedText } from "@/components/themed-text";
import {
  EXERCISE_PRIMARY_MUSCLE_OPTIONS,
  EXERCISE_SECONDARY_MUSCLE_OPTIONS,
  EXERCISE_TYPE_OPTIONS,
} from "@/constants/exerciseTaxonomy";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { CustomExercisePayload, ExercisePrimaryMuscleValue, ExerciseSecondaryMuscleValue, ExerciseTypeValue } from "@/interfaces/programs";
import { createCustomExercise, getExerciseById, updateCustomExercise } from "@/services/exerciseService";
import { AuthContext } from "@/utils/authContext";
import { EquipmentContext } from "@/utils/equipmentContext";
import { useProgramDraft } from "@/utils/programDraftContext";

export default function CustomExerciseScreen() {
  const { dayId, exerciseId } = useLocalSearchParams<{ dayId?: string; exerciseId?: string }>();
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { token, user } = useContext(AuthContext);
  const { items: equipment } = useContext(EquipmentContext);
  const { addExercise } = useProgramDraft();
  const [name, setName] = useState("");
  const [exerciseType, setExerciseType] = useState<ExerciseTypeValue>("strength");
  const [primaryMuscle, setPrimaryMuscle] = useState<ExercisePrimaryMuscleValue>("chest");
  const [secondaryMuscles, setSecondaryMuscles] = useState<ExerciseSecondaryMuscleValue[]>([]);
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(exerciseId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(exerciseId);
  const accountKey = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const requestKey = `${accountKey}:${exerciseId ?? "new"}`;
  const requestRef = useRef(0);
  const mutationRef = useRef(0);
  const mountedRef = useRef(true);
  const accountRef = useRef(`${user?.id ?? "guest"}:${token ?? "anonymous"}`);
  accountRef.current = accountKey;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      mutationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const requestId = ++requestRef.current;
    setName("");
    setExerciseType("strength");
    setPrimaryMuscle("chest");
    setSecondaryMuscles([]);
    setEquipmentIds([]);
    setInstructions("");
    setEquipmentQuery("");
    setError(null);
    setLoadError(null);
    setLoadedKey(null);
    setSaving(false);
    if (!exerciseId) {
      setLoading(false);
      setLoadedKey(requestKey);
      return;
    }
    if (!token) {
      setLoading(false);
      setLoadedKey(requestKey);
      setLoadError("Sign in again to edit this exercise.");
      return;
    }
    const account = accountKey;
    setLoading(true);
    getExerciseById(exerciseId, token).then((exercise) => {
      if (!mountedRef.current || requestRef.current !== requestId || accountRef.current !== account) return;
      setName(exercise.name);
      const loadedType = EXERCISE_TYPE_OPTIONS.find(({ value }) => value === exercise.exerciseType)?.value;
      const loadedPrimary = EXERCISE_PRIMARY_MUSCLE_OPTIONS.find(({ value }) => value === exercise.primaryMuscle)?.value;
      setExerciseType(loadedType ?? "strength");
      setPrimaryMuscle(loadedPrimary ?? "chest");
      setSecondaryMuscles(exercise.secondaryMuscles.flatMap((muscle) => {
        const option = EXERCISE_SECONDARY_MUSCLE_OPTIONS.find(({ value }) => value === muscle);
        return option && option.value !== loadedPrimary ? [option.value] : [];
      }));
      setEquipmentIds(exercise.equipmentIds);
      setInstructions(exercise.instructions ?? exercise.howTo ?? "");
      setLoadedKey(requestKey);
    }).catch(() => {
      if (!mountedRef.current || requestRef.current !== requestId || accountRef.current !== account) return;
      setLoadedKey(requestKey);
      setLoadError("This custom exercise couldn’t load. Check your connection and try again.");
    }).finally(() => {
      if (mountedRef.current && requestRef.current === requestId && accountRef.current === account) setLoading(false);
    });
  }, [accountKey, exerciseId, loadRevision, requestKey, token]);

  const shownEquipment = useMemo(() => equipment.filter((item) => item.name.toLowerCase().includes(equipmentQuery.trim().toLowerCase())).slice(0, 40), [equipment, equipmentQuery]);
  const toggleEquipment = (id: string) => setEquipmentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectPrimaryMuscle = (muscle: ExercisePrimaryMuscleValue) => {
    setPrimaryMuscle(muscle);
    setSecondaryMuscles((current) => current.filter((item) => item !== muscle));
  };
  const toggleSecondaryMuscle = (muscle: ExerciseSecondaryMuscleValue) => {
    if (muscle === primaryMuscle) return;
    setSecondaryMuscles((current) => current.includes(muscle)
      ? current.filter((item) => item !== muscle)
      : [...current, muscle]);
  };

  const save = async () => {
    if (!token || saving || loadedKey !== requestKey || loadError || (!dayId && !exerciseId)) return;
    if (!name.trim()) { setError("Enter an exercise name."); return; }
    if (name.trim().length > 120) { setError("Exercise names must be 120 characters or fewer."); return; }
    if (instructions.length > 4000) { setError("Instructions must be 4,000 characters or fewer."); return; }
    if (equipmentIds.length > 30) { setError("Choose no more than 30 equipment items."); return; }
    const payload: CustomExercisePayload = { name: name.trim(), exerciseType, primaryMuscle, secondaryMuscles, equipmentIds, instructions: instructions.trim() || null };
    setSaving(true);
    setError(null);
    const account = accountKey;
    const mutationId = ++mutationRef.current;
    const isCurrent = () => mountedRef.current && accountRef.current === account && mutationRef.current === mutationId && loadedKey === requestKey;
    try {
      const created = exerciseId ? await updateCustomExercise(token, exerciseId, payload) : await createCustomExercise(token, payload);
      if (!isCurrent()) return;
      if (dayId) addExercise(dayId, {
        id: created.id,
        name: created.name,
        exerciseType: created.exerciseType,
        primaryMuscle: created.primaryMuscle,
        secondaryMuscles: created.secondaryMuscles,
        equipmentIds: created.equipmentIds,
        imageUrl: created.imageUrl,
        isFavorited: created.isFavorited,
        source: "custom",
        isEditable: true,
      });
      if (exerciseId) router.back();
      else router.dismiss(2);
    } catch (saveError) {
      if (!isCurrent()) return;
      console.warn("Custom exercise couldn't be saved", saveError);
      setError("The exercise couldn’t be saved. Check your connection and try again.");
    } finally { if (isCurrent()) setSaving(false); }
  };

  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  const title = isEditing ? "Edit exercise" : "Custom exercise";
  const renderBack = (disabled = false) => <View style={styles.backBar}><Pressable testID="custom-exercise-back" accessibilityRole="button" accessibilityLabel={`Back from ${title}`} accessibilityState={{ disabled }} disabled={disabled} onPress={() => router.back()} style={[styles.back, { opacity: disabled ? 0.35 : 1 }]}><Ionicons name="arrow-back" size={24} color={colors.text} /></Pressable></View>;
  const heading = <View style={styles.heading}><ThemedText testID="custom-exercise-title" accessibilityRole="header" style={styles.headingTitle}>{title}</ThemedText><ThemedText testID="custom-exercise-subtitle" style={[styles.headingSubtitle, { color: colors.placeholder }]}>Private to your account</ThemedText></View>;
  const renderState = (content: React.ReactNode) => <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>{largeText ? renderBack() : <ProgramHeader title={title} onBack={() => router.back()} />}{largeText ? <ScrollView testID="custom-exercise-scroll" style={styles.flex} contentContainerStyle={[styles.content, styles.largeContent]} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{heading}{content}</ScrollView> : content}</SafeAreaView>;

  if (loading || loadedKey !== requestKey) {
    return renderState(<ScreenState colors={colors} kind="loading" title={isEditing ? "Loading exercise…" : "Preparing exercise…"} testID="custom-exercise-loading" />);
  }

  if (isEditing && loadError) {
    return renderState(<ScreenState colors={colors} kind="error" title="Exercise unavailable" message={loadError} actionLabel="Retry" onAction={() => setLoadRevision((value) => value + 1)} testID="custom-exercise-load-error" />);
  }

  const formDisabled = saving || loadedKey !== requestKey;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      {largeText ? renderBack(saving) : <ProgramHeader title={isEditing ? "Edit exercise" : "Custom exercise"} subtitle="Private to your account" onBack={() => router.back()} backDisabled={saving} />}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView testID="custom-exercise-scroll" contentContainerStyle={[styles.content, largeText && styles.largeContent]} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {largeText ? heading : null}
          <Label text="Exercise name" /><TextInput testID="custom-exercise-name" accessibilityLabel="Custom exercise name" value={name} onChangeText={setName} maxLength={120} placeholder="Cable high row" placeholderTextColor={colors.placeholder} style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]} />
          <Label text="Type" /><View style={styles.wrap}>{EXERCISE_TYPE_OPTIONS.map((item) => <Choice key={item.value} label={item.label} selected={exerciseType === item.value} onPress={() => setExerciseType(item.value)} testID={`custom-exercise-type-${item.value}`} colors={colors} />)}</View>
          <Label text="Primary muscle" /><View style={styles.wrap}>{EXERCISE_PRIMARY_MUSCLE_OPTIONS.map((item) => <Choice key={item.value} label={item.label} selected={primaryMuscle === item.value} onPress={() => selectPrimaryMuscle(item.value)} testID={`custom-exercise-muscle-${item.value}`} colors={colors} />)}</View>
          <Label text="Secondary muscles" /><View style={styles.wrap}>{EXERCISE_SECONDARY_MUSCLE_OPTIONS.filter(({ value }) => value !== primaryMuscle).map((item) => <Choice key={item.value} label={item.label} selected={secondaryMuscles.includes(item.value)} onPress={() => toggleSecondaryMuscle(item.value)} testID={`custom-exercise-secondary-${item.value}`} colors={colors} />)}</View><ThemedText style={[styles.help, { color: colors.placeholder }]}>Optional. Choose every additional muscle this movement trains.</ThemedText>
          <Label text="Equipment" /><TextInput testID="custom-exercise-equipment-search" accessibilityLabel="Search equipment" value={equipmentQuery} onChangeText={setEquipmentQuery} placeholder="Search equipment" placeholderTextColor={colors.placeholder} style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]} />
          <Pressable testID="custom-exercise-bodyweight" accessibilityRole="button" accessibilityState={{ selected: equipmentIds.length === 0 }} accessibilityLabel="Bodyweight, no equipment" onPress={() => setEquipmentIds([])} style={[styles.bodyweight, { borderColor: equipmentIds.length === 0 ? colors.text : colors.inputBorder }]}><Ionicons name={equipmentIds.length === 0 ? "checkmark-circle" : "ellipse-outline"} size={20} color={equipmentIds.length === 0 ? colors.text : colors.placeholder} /><ThemedText style={styles.bodyweightText}>Bodyweight — no equipment required</ThemedText></Pressable>
          <View style={styles.equipmentList}>{shownEquipment.map((item) => <Pressable key={item.id} testID={`custom-exercise-equipment-${item.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: equipmentIds.includes(item.id) }} accessibilityLabel={item.name} onPress={() => toggleEquipment(item.id)} style={[styles.equipmentRow, { borderBottomColor: colors.inputBorder }]}><ThemedText style={styles.flex}>{item.name}</ThemedText><Ionicons name={equipmentIds.includes(item.id) ? "checkbox" : "square-outline"} size={23} color={equipmentIds.includes(item.id) ? colors.text : colors.placeholder} /></Pressable>)}</View>
          <Label text="Instructions (optional)" /><TextInput testID="custom-exercise-instructions" accessibilityLabel="Custom exercise instructions" value={instructions} onChangeText={setInstructions} maxLength={4000} placeholder="Setup and movement cues" placeholderTextColor={colors.placeholder} multiline style={[styles.input, styles.instructions, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]} />
          {error ? <ThemedText testID="custom-exercise-error" accessibilityRole="alert" style={styles.error}>{error}</ThemedText> : null}
          <Pressable testID="custom-exercise-save" accessibilityRole="button" accessibilityLabel="Save custom exercise" accessibilityState={{ disabled: formDisabled, busy: saving }} disabled={formDisabled} onPress={() => void save()} style={[styles.save, { backgroundColor: colors.primaryButton, opacity: formDisabled ? 0.65 : 1 }]}><ThemedText style={styles.saveText}>{saving ? "Saving…" : isEditing ? "Save changes" : "Save and add"}</ThemedText></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) { return <ThemedText style={styles.label}>{text}</ThemedText>; }
function Choice({ label, selected, onPress, testID, colors }: { label: string; selected: boolean; onPress: () => void; testID: string; colors: typeof Colors.light }) { return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label} onPress={onPress} style={[styles.choice, { borderColor: selected ? colors.text : colors.inputBorder, backgroundColor: selected ? colors === Colors.dark ? "#2B3033" : "#F1F3F5" : colors.inputBackground }]}>{selected ? <Ionicons name="checkmark" size={16} color={colors.text} /> : null}<ThemedText style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{label}</ThemedText></Pressable>; }

const styles = StyleSheet.create({
  container: { flex: 1 }, flex: { flex: 1 }, content: { padding: 21, paddingBottom: 52 }, label: { marginTop: 19, marginBottom: 8, fontSize: 15, fontWeight: "800" }, input: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, fontSize: 16 }, instructions: { minHeight: 100, paddingTop: 13, textAlignVertical: "top" }, wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, choice: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }, help: { marginTop: 6, fontSize: 12 },
  bodyweight: { minHeight: 52, marginTop: 9, borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 9 }, bodyweightText: { flex: 1, fontWeight: "700" }, equipmentList: { marginTop: 8 }, equipmentRow: { minHeight: 48, borderBottomWidth: 1, paddingHorizontal: 4, flexDirection: "row", alignItems: "center" }, error: { marginTop: 14, color: "#D92D20", lineHeight: 20 }, save: { minHeight: 56, marginTop: 22, borderRadius: 18, alignItems: "center", justifyContent: "center" }, saveText: { color: "#FFF", fontSize: 17, fontWeight: "900" },
  backBar: { paddingHorizontal: 16, paddingVertical: 8 }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, largeContent: { flexGrow: 1, paddingHorizontal: 8 }, heading: { paddingVertical: 12, marginBottom: 12 }, headingTitle: { fontSize: 22, lineHeight: 28, fontWeight: "800" }, headingSubtitle: { marginTop: 2, fontSize: 12 },
});
