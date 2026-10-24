import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WorkoutPlanningSheet } from "@/components/workout/workout-planning-sheet";
import { loadActiveWorkout } from "@/utils/activeWorkoutStore";
import { workoutPlanningError, planningUpdateWasRejected } from "@/utils/workoutPlanning";
import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { TrainingPreferences } from "@/services/onboardingService";
import { getTrainingPreferences, updateTrainingPreferences } from "@/services/onboardingService";
import { AuthContext } from "@/utils/authContext";
import { useEquipment } from "@/utils/equipmentContext";
import { localDateIso, localWeekStartIso } from "@/utils/localDate";
import { WorkoutWeekContext } from "@/utils/workoutWeekContext";

type Choice = { label: string; value: string };
const GOALS: Choice[] = [
  { label: "Build muscle", value: "build-muscle" },
  { label: "Get stronger", value: "get-stronger" },
  { label: "General fitness", value: "general-fitness" },
  { label: "Conditioning", value: "conditioning" },
];
const EXPERIENCE: Choice[] = [
  { label: "New to training", value: "no-experience" },
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Advanced", value: "advanced" },
];
const FREQUENCY: Choice[] = [1, 2, 3, 4, 5, 6].map((days) => ({
  label: `${days} day${days === 1 ? "" : "s"}`, value: `${days}-day${days === 1 ? "" : "s"}`,
})).concat([{ label: "Every day", value: "every-day" }]);
const SPLITS: Choice[] = [
  { label: "PrimeRep Optimized", value: "ai-optimized" },
  { label: "Full body", value: "full-body" },
  { label: "Upper / Lower", value: "upper-lower" },
  { label: "Push / Pull / Legs", value: "push-pull-legs" },
  { label: "Custom", value: "custom" },
  { label: "Bro split", value: "bro-split" },
  { label: "PPL + Full Body", value: "push-pull-legs-full-body" },
  { label: "PPL + Upper / Lower", value: "push-pull-legs-upper-lower" },
  { label: "Upper / Lower + Full Body", value: "upper-lower-full-body" },
  { label: "Lower Focused + Upper", value: "lower-focused-upper" },
  { label: "PPL + Upper Body", value: "push-pull-legs-upper-body" },
];
const PLACES: Choice[] = [
  { label: "Large gym", value: "large-gym" },
  { label: "Small gym", value: "small-gym" },
  { label: "Home / garage gym", value: "garage-gym" },
];
const CUSTOM_MUSCLES: Choice[] = [
  { label: "Chest", value: "chest" }, { label: "Back", value: "back" },
  { label: "Shoulders", value: "shoulders" }, { label: "Biceps", value: "biceps" },
  { label: "Triceps", value: "triceps" }, { label: "Abs", value: "abs" },
  { label: "Quads", value: "quads" }, { label: "Hamstrings", value: "hamstrings" },
  { label: "Glutes", value: "glutes" }, { label: "Calves", value: "calves" },
];

function ChoiceGroup({ title, choices, value, onChange }: { title: string; choices: Choice[]; value?: string; onChange: (next: string) => void }) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { fontScale } = useWindowDimensions();
  return <View style={styles.group}>
    <ThemedText accessibilityRole="header" style={[styles.label, { color: colors.icon }]}>{title}</ThemedText>
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={title}>{choices.map((choice) => {
      const selected = value === choice.value;
      return <Pressable key={choice.value} onPress={() => onChange(choice.value)} accessibilityRole="radio" accessibilityLabel={choice.label} accessibilityState={{ checked: selected, selected }} style={({ pressed }) => [styles.chip, fontScale >= 1.5 && styles.fullWidth, { borderColor: colors.inputBorder, backgroundColor: selected || pressed ? colors.inputBorder : "transparent" }]}>
        <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={18} color={selected ? colors.text : colors.icon} accessible={false} />
        <ThemedText style={[styles.chipText, { color: colors.text }]}>{choice.label}</ThemedText>
      </Pressable>;
    })}</View>
  </View>;
}

export default function TrainingPreferencesScreen() {
  const router = useRouter();
  const { token, user } = useContext(AuthContext);
  const { refreshWeek, markPlanningRefreshRequired, applyPlanningPreference, planningRefreshRequired } = useContext(WorkoutWeekContext);
  const { items: catalogItems } = useEquipment();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { fontScale } = useWindowDimensions();
  const scrollingTitle = fontScale >= 2;
  const stackedPickerTabs = fontScale >= 1.3;
  const stackedPickerActions = fontScale >= 2.5;
  const destructiveColor = scheme === "dark" ? "#F18C86" : "#D14343";
  const pressedSurface = scheme === "dark" ? colors.inputBackground : "#F5F5F5";
  const [preferences, setPreferences] = useState<TrainingPreferences>({});
  const [planningPreference, setPlanningPreference] = useState({ workoutPlanningMode: "time_budget" as "trainer_led" | "time_budget", preferredWorkoutMinutes: 35 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const [planningVisible, setPlanningVisible] = useState(false);
  const owner = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const ownerRef = useRef(owner), epochRef = useRef(0), requestRef = useRef(0), busyRef = useRef(false), mountedRef = useRef(true);
  if (ownerRef.current !== owner) { ownerRef.current = owner; epochRef.current += 1; }
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; epochRef.current += 1; }; }, []);
  const [saving, setSaving] = useState(false);
  const [customWorkoutName, setCustomWorkoutName] = useState("");
  const [customMuscles, setCustomMuscles] = useState<string[]>([]);
  const [equipmentPickerVisible, setEquipmentPickerVisible] = useState(false);
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [equipmentDraft, setEquipmentDraft] = useState<string[]>([]);
  const [equipmentPickerTab, setEquipmentPickerTab] = useState<"selected" | "not-selected">("selected");

  const selectedEquipmentItems = useMemo(
    () => catalogItems.filter((item) => preferences.selectedEquipment?.includes(item.id)),
    [catalogItems, preferences.selectedEquipment]
  );
  const pickerItems = useMemo(() => {
    const query = equipmentQuery.trim().toLowerCase();
    return catalogItems.filter((item) => {
      const selected = equipmentDraft.includes(item.id);
      const matchesTab = equipmentPickerTab === "selected" ? selected : !selected;
      const matchesQuery = !query || item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
      return matchesTab && matchesQuery;
    });
  }, [catalogItems, equipmentDraft, equipmentPickerTab, equipmentQuery]);

  useEffect(() => {
    const epoch = epochRef.current;
    const request = ++requestRef.current;
    busyRef.current = false;
    setSaving(false); setLoading(true); setLoadError(false); setPreferences({}); setPlanningPreference({ workoutPlanningMode: "time_budget", preferredWorkoutMinutes: 35 }); setPlanningVisible(false);
    if (!token) { setLoading(false); return; }
    const isCurrent = () => mountedRef.current && ownerRef.current === owner && epochRef.current === epoch && requestRef.current === request;
    void getTrainingPreferences(token).then((loaded) => { if (isCurrent()) { setPreferences(loaded); setPlanningPreference({ workoutPlanningMode: loaded.workoutPlanningMode ?? "time_budget", preferredWorkoutMinutes: loaded.preferredWorkoutMinutes ?? 35 }); } })
      .catch(() => { if (isCurrent()) setLoadError(true); })
      .finally(() => { if (isCurrent()) setLoading(false); });
    return () => { requestRef.current += 1; };
  }, [token, owner, loadRevision]);

  useEffect(() => {
    if (catalogItems.length === 0) return;
    const catalogIds = new Set(catalogItems.map((item) => item.id));
    setPreferences((current) => ({
      ...current,
      selectedEquipment: (current.selectedEquipment || []).filter((id) => catalogIds.has(id)),
    }));
  }, [catalogItems]);

  const savePlanning = async () => {
    if (!token || busyRef.current || loading || loadError || planningRefreshRequired) return;
    busyRef.current = true;
    setSaving(true);
    const epoch = epochRef.current, request = ++requestRef.current;
    const isCurrent = () => mountedRef.current && ownerRef.current === owner && epochRef.current === epoch && requestRef.current === request;
    const release = () => { if (isCurrent()) { busyRef.current = false; setSaving(false); } };
    const finish = () => { if (isCurrent()) release(); };
    const dates = { weekStart: localWeekStartIso(), effectiveDate: localDateIso() };
    const refreshSavedPlan = async () => {
      if (!isCurrent()) return;
      busyRef.current = true; setSaving(true);
      const plan = await refreshWeek({ weekStart: dates.weekStart });
      if (!isCurrent()) return;
      release();
      if (plan) Alert.alert("Latest plan loaded", "Your saved preference is available and the latest workout plan is ready.", [{ text: "Done", onPress: finish }]);
      else Alert.alert("Refresh needed", "Your preference is saved, but the latest workout plan could not load. Refresh before starting a new workout.", [{ text: "Retry refresh", onPress: () => void refreshSavedPlan() }]);
    };
    let applyInFlight = false;
    const applySaved = async () => {
      if (!isCurrent() || applyInFlight) return;
      applyInFlight = true;
      busyRef.current = true; setSaving(true);
      try {
        const local = user?.id ? await loadActiveWorkout(user.id) : null;
        if (!isCurrent()) return;
        if (local && !local.serverSessionId) {
          release();
          Alert.alert("Preferences saved", "Resume your active workout and let it sync before updating remaining workouts. Your existing plan is unchanged.", [{ text: "Keep current plan", onPress: finish }]);
          return;
        }
        const result = await applyPlanningPreference(dates);
        if (!isCurrent()) return;
        if (!result) {
          release();
          Alert.alert("Refresh needed", "Your preference is saved. Refresh to confirm the latest workout plan.", [{ text: "Refresh plan", onPress: () => void refreshSavedPlan() }]);
          return;
        }
        release();
        Alert.alert("Workout plan updated", `${result.updatedWorkoutCount} ${result.updatedWorkoutCount === 1 ? "workout updated" : "workouts updated"}. Started, completed and program workouts keep their original plan.`, [{ text: "Done", onPress: finish }]);
      } catch (error) {
        if (!isCurrent()) return;
        release();
        if (planningUpdateWasRejected(error)) Alert.alert("Preferences saved", `Existing workouts could not be updated. ${workoutPlanningError(error)}`, [
          { text: "Keep current plan", style: "cancel", onPress: finish },
          { text: "Retry update", onPress: () => void applySaved() },
        ]);
        else {
          markPlanningRefreshRequired();
          Alert.alert("Preferences saved", "We could not confirm the workout update. Refresh the plan before starting a new workout.", [{ text: "Refresh plan", onPress: () => void refreshSavedPlan() }]);
        }
      } finally { applyInFlight = false; }
    };
    try {
      const saved = await updateTrainingPreferences(token, planningPreference, { ...dates, planUpdateScope: "preserve" });
      if (!isCurrent()) return;
      setPlanningPreference({ workoutPlanningMode: saved.workoutPlanningMode ?? planningPreference.workoutPlanningMode, preferredWorkoutMinutes: saved.preferredWorkoutMinutes ?? planningPreference.preferredWorkoutMinutes });
      Alert.alert("Preferences saved", "Use these defaults for newly generated plans, or rebuild remaining unstarted workouts now? Rebuilding replaces their individual time choices and may reset exercises and saved orders. Active, completed and program workouts stay unchanged.", [
        { text: "Keep current plan", style: "cancel", onPress: finish },
        { text: "Update remaining workouts", onPress: () => void applySaved() },
      ], { cancelable: false });
    } catch {
      if (isCurrent()) { release(); Alert.alert("Could Not Save Preferences", "Your preferences could not be saved. Your existing workout plan is unchanged. Please try again."); }
    }
  };

  const save = async () => {
    if (!token || busyRef.current || loading || loadError || planningRefreshRequired) return;
    if (preferences.workoutSplit === "custom" && !preferences.customWorkouts?.length) {
      Alert.alert("Add a custom workout", "Your custom split needs at least one workout day."); return;
    }
    busyRef.current = true; setSaving(true);
    const epoch = epochRef.current, request = ++requestRef.current;
    const isCurrent = () => mountedRef.current && ownerRef.current === owner && epochRef.current === epoch && requestRef.current === request;
    let saved = false;
    try {
      const updates = { ...preferences };
      delete updates.workoutPlanningMode; delete updates.preferredWorkoutMinutes;
      if (catalogItems.length) updates.selectedEquipment = (updates.selectedEquipment || []).filter((id) => catalogItems.some((item) => item.id === id));
      else delete updates.selectedEquipment;
      const weekStart = localWeekStartIso();
      await updateTrainingPreferences(token, updates, { weekStart, effectiveDate: localDateIso() });
      if (!isCurrent()) return;
      saved = true;
      await refreshWeek({ weekStart });
      if (isCurrent()) router.back();
    } catch {
      if (isCurrent()) Alert.alert(saved ? "Preferences saved" : "Could Not Save Preferences", saved ? "Your preferences were saved, but the updated plan could not load. Reopen your workout to try again." : "Your preferences could not be saved. Your existing workout plan is unchanged. Please try again.");
    } finally { if (isCurrent()) { busyRef.current = false; setSaving(false); } }
  };

  const toggleDraftEquipment = (equipment: string) => setEquipmentDraft((current) => {
    const selected = new Set(current);
    if (selected.has(equipment)) {
      selected.delete(equipment);
    } else {
      selected.add(equipment);
    }
    return [...selected].sort();
  });

  const openEquipmentPicker = () => {
    setEquipmentDraft(preferences.selectedEquipment || []);
    setEquipmentQuery("");
    setEquipmentPickerTab("selected");
    setEquipmentPickerVisible(true);
  };

  const applyEquipmentDraft = () => {
    setPreferences((current) => ({ ...current, selectedEquipment: equipmentDraft }));
    setEquipmentPickerVisible(false);
  };

  const toggleCustomMuscle = (muscle: string) => {
    setCustomMuscles((current) => current.includes(muscle)
      ? current.filter((item) => item !== muscle)
      : [...current, muscle]);
  };

  const addCustomWorkout = () => {
    const name = customWorkoutName.trim();
    if (!name || customMuscles.length === 0) {
      Alert.alert("Add a workout name and muscles", "Choose at least one muscle group for this custom day.");
      return;
    }
    setPreferences((current) => ({
      ...current,
      customWorkouts: [
        ...(current.customWorkouts || []),
        { id: `settings-${Date.now()}`, name, type: "custom", muscleGroups: customMuscles },
      ],
    }));
    setCustomWorkoutName("");
    setCustomMuscles([]);
  };

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && { backgroundColor: colors.inputBorder }]} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={24} color={colors.text} accessible={false} /></Pressable>
      {!scrollingTitle && <ThemedText accessibilityRole="header" testID="training-preferences-title" style={[styles.title, styles.headerTitle]}>Training Preferences</ThemedText>}
      <View style={styles.back} />
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScrollBeginDrag={Keyboard.dismiss}>
      {scrollingTitle && <ThemedText accessibilityRole="header" testID="training-preferences-title" style={styles.scrollingTitle}>Training Preferences</ThemedText>}
      {loading ? <ThemedText style={{ color: colors.icon }}>Loading preferences…</ThemedText> : loadError ? <View style={styles.group}><ThemedText accessibilityRole="alert">Could not load your preferences.</ThemedText><Pressable accessibilityRole="button" accessibilityLabel="Retry loading training preferences" onPress={() => setLoadRevision((value) => value + 1)} style={styles.save}><ThemedText>Try again</ThemedText></Pressable></View> : <>
        <View style={styles.group}><ThemedText accessibilityRole="header" style={[styles.label, { color: colors.icon }]}>Workout planning</ThemedText>
          <Pressable testID="training-planning-open" accessibilityRole="button" accessibilityLabel="Edit default workout planning" disabled={saving || planningRefreshRequired} accessibilityState={{ disabled: saving || planningRefreshRequired }} onPress={() => setPlanningVisible(true)} style={({ pressed }) => [styles.equipmentSummary, { borderColor: colors.inputBorder, backgroundColor: pressed ? pressedSurface : "transparent" }]}><View style={styles.equipmentSummaryCopy}><ThemedText style={styles.customWorkoutName}>{planningPreference.workoutPlanningMode === "trainer_led" ? "Trainer-led" : `Up to ${planningPreference.preferredWorkoutMinutes} min`}</ThemedText><ThemedText style={{ color: colors.icon }}>{planningPreference.workoutPlanningMode === "trainer_led" ? "A complete workout, without a time limit." : "A maximum time budget, not a target."}</ThemedText></View><Ionicons name="chevron-forward" size={22} color={colors.icon} accessible={false} /></Pressable>
          <Pressable testID="training-planning-save" accessibilityRole="button" accessibilityLabel="Save workout planning" disabled={saving || planningRefreshRequired} accessibilityState={{ disabled: saving || planningRefreshRequired, busy: saving }} onPress={() => void savePlanning()} style={({ pressed }) => [styles.save, { backgroundColor: colors.primaryButton }, pressed && styles.pressedSave]}><ThemedText style={styles.saveText}>Save workout planning</ThemedText></Pressable>
        </View>
        <ChoiceGroup title="Goal" choices={GOALS} value={preferences.fitnessGoal} onChange={(value) => setPreferences((p) => ({ ...p, fitnessGoal: value as TrainingPreferences["fitnessGoal"] }))} />
        <ChoiceGroup title="Experience" choices={EXPERIENCE} value={preferences.experienceLevel} onChange={(value) => setPreferences((p) => ({ ...p, experienceLevel: value as TrainingPreferences["experienceLevel"] }))} />
        <ChoiceGroup title="Days per week" choices={FREQUENCY} value={preferences.workoutFrequency} onChange={(value) => setPreferences((p) => ({ ...p, workoutFrequency: value as TrainingPreferences["workoutFrequency"] }))} />
        <ChoiceGroup title="Workout split" choices={SPLITS} value={preferences.workoutSplit} onChange={(value) => setPreferences((p) => ({ ...p, workoutSplit: value as TrainingPreferences["workoutSplit"] }))} />
        {preferences.workoutSplit === "custom" && <View style={styles.group}>
          <ThemedText accessibilityRole="header" style={[styles.label, { color: colors.icon }]}>Custom workout cycle</ThemedText>
          {(preferences.customWorkouts || []).map((workout) => <View key={workout.id} style={[styles.customWorkout, { borderColor: colors.inputBorder }]}>
            <View style={styles.customWorkoutCopy}><ThemedText style={styles.customWorkoutName}>{workout.name}</ThemedText><ThemedText style={{ color: colors.icon }}>{workout.muscleGroups.join(", ")}</ThemedText></View>
            <Pressable style={({ pressed }) => [styles.removeWorkout, pressed && { backgroundColor: colors.inputBorder }]} accessibilityRole="button" accessibilityLabel={`Remove ${workout.name}`} onPress={() => setPreferences((current) => ({ ...current, customWorkouts: current.customWorkouts?.filter((item) => item.id !== workout.id) }))}><Ionicons name="trash-outline" size={22} color={destructiveColor} accessible={false} /></Pressable>
          </View>)}
          <TextInput value={customWorkoutName} onChangeText={setCustomWorkoutName} placeholder="Workout name" accessibilityLabel="Workout name" placeholderTextColor={colors.icon} style={[styles.textInput, { color: colors.text, borderColor: colors.inputBorder }]} />
          <View style={styles.chips}>{CUSTOM_MUSCLES.map((muscle) => { const selected = customMuscles.includes(muscle.value); return <Pressable key={muscle.value} onPress={() => toggleCustomMuscle(muscle.value)} accessibilityRole="checkbox" accessibilityLabel={muscle.label} accessibilityState={{ checked: selected }} style={({ pressed }) => [styles.chip, fontScale >= 1.5 && styles.fullWidth, { borderColor: colors.inputBorder, backgroundColor: selected || pressed ? colors.inputBorder : "transparent" }]}><Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={18} color={selected ? colors.text : colors.icon} accessible={false} /><ThemedText style={[styles.chipText, { color: colors.text }]}>{muscle.label}</ThemedText></Pressable>; })}</View>
          <Pressable onPress={addCustomWorkout} accessibilityRole="button" accessibilityLabel="Add custom workout" style={({ pressed }) => [styles.addWorkout, { borderColor: colors.inputBorder, backgroundColor: pressed ? colors.inputBorder : "transparent" }]}><Ionicons name="add" size={20} color={colors.text} accessible={false} /><ThemedText style={[styles.actionText, { color: colors.text }]}>Add custom workout</ThemedText></Pressable>
        </View>}
        <ChoiceGroup title="Training location" choices={PLACES} value={preferences.trainingPlace} onChange={(value) => setPreferences((p) => ({ ...p, trainingPlace: value as TrainingPreferences["trainingPlace"] }))} />
        <View style={styles.group}>
          <ThemedText accessibilityRole="header" style={[styles.label, { color: colors.icon }]}>General equipment</ThemedText>
          <Pressable onPress={openEquipmentPicker} accessibilityRole="button" accessibilityLabel="Edit owned equipment" accessibilityHint="Opens a searchable equipment picker" style={({ pressed }) => [styles.equipmentSummary, { borderColor: colors.inputBorder, backgroundColor: pressed ? pressedSurface : "transparent" }]}>
            <View style={styles.equipmentSummaryCopy}>
              <ThemedText style={styles.customWorkoutName}>{selectedEquipmentItems.length} {selectedEquipmentItems.length === 1 ? "item" : "items"} selected</ThemedText>
              <ThemedText style={{ color: colors.icon }}>{selectedEquipmentItems.length ? selectedEquipmentItems.slice(0, 3).map((item) => item.name).join(", ") + (selectedEquipmentItems.length > 3 ? "…" : "") : "No equipment selected"}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.icon} accessible={false} />
          </Pressable>
        </View>
        <Pressable onPress={() => void save()} disabled={saving || planningRefreshRequired} accessibilityRole="button" accessibilityLabel="Save preferences" accessibilityState={{ disabled: saving || planningRefreshRequired, busy: saving }} style={({ pressed }) => [styles.save, { backgroundColor: saving ? colors.inputBorder : colors.primaryButton }, pressed && !saving && styles.pressedSave]}><ThemedText style={[styles.saveText, saving && { color: colors.text }]}>{saving ? "Saving…" : "Save preferences"}</ThemedText></Pressable>
      </>}
    </ScrollView>
    <WorkoutPlanningSheet visible={planningVisible} value={{ planningMode: planningPreference.workoutPlanningMode, timeBudgetMinutes: planningPreference.preferredWorkoutMinutes }} onClose={() => setPlanningVisible(false)} onApply={(choice) => { setPlanningPreference((current) => ({ workoutPlanningMode: choice.planningMode, preferredWorkoutMinutes: choice.timeBudgetMinutes ?? current.preferredWorkoutMinutes })); setPlanningVisible(false); }} disabled={saving || planningRefreshRequired} />
    <Modal visible={equipmentPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEquipmentPickerVisible(false)}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <View style={[styles.header, stackedPickerActions && styles.stackedPickerHeader]}>
          <Pressable onPress={() => setEquipmentPickerVisible(false)} style={({ pressed }) => [styles.headerAction, scrollingTitle && styles.expandedHeaderAction, stackedPickerActions && styles.fullWidthHeaderAction, pressed && { backgroundColor: colors.inputBorder }]} accessibilityRole="button" accessibilityLabel="Cancel equipment changes"><ThemedText style={[styles.actionText, { color: colors.text }]}>Cancel</ThemedText></Pressable>
          {!scrollingTitle && <ThemedText accessibilityRole="header" testID="training-equipment-title" style={[styles.title, styles.headerTitle]}>Your equipment</ThemedText>}
          <Pressable onPress={applyEquipmentDraft} style={({ pressed }) => [styles.headerAction, scrollingTitle && styles.expandedHeaderAction, stackedPickerActions && styles.fullWidthHeaderAction, pressed && { backgroundColor: colors.inputBorder }]} accessibilityRole="button" accessibilityLabel="Apply equipment changes"><ThemedText style={[styles.actionText, { color: colors.text }]}>Done</ThemedText></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.pickerContent} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScrollBeginDrag={Keyboard.dismiss}>
          {scrollingTitle && <ThemedText accessibilityRole="header" testID="training-equipment-title" style={styles.scrollingTitle}>Your equipment</ThemedText>}
          <TextInput value={equipmentQuery} onChangeText={setEquipmentQuery} placeholder="Search equipment" placeholderTextColor={colors.icon} style={[styles.textInput, { color: colors.text, borderColor: colors.inputBorder }]} accessibilityLabel="Search equipment" />
          <View testID="training-equipment-tabs" style={[styles.pickerTabs, stackedPickerTabs && styles.stackedPickerTabs, { borderColor: colors.inputBorder }]} accessibilityRole="tablist">
            {(["selected", "not-selected"] as const).map((tab) => {
              const selected = equipmentPickerTab === tab;
              const label = tab === "selected" ? `Selected (${equipmentDraft.length})` : `Not selected (${Math.max(0, catalogItems.length - equipmentDraft.length)})`;
              return <Pressable key={tab} testID={`training-equipment-tab-${tab}`} onPress={() => setEquipmentPickerTab(tab)} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} style={({ pressed }) => [styles.pickerTab, !stackedPickerTabs && styles.flexibleTab, { backgroundColor: selected || pressed ? colors.inputBorder : "transparent" }]}><Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={18} color={selected ? colors.text : colors.icon} accessible={false} /><ThemedText style={[styles.pickerTabText, { color: colors.text }]}>{label}</ThemedText></Pressable>;
            })}
          </View>
          <ThemedText style={{ color: colors.icon }}>{equipmentQuery ? "Search results" : equipmentPickerTab === "selected" ? "Equipment you own" : "Available equipment"}</ThemedText>
          <View style={styles.pickerList}>
            {pickerItems.map((item) => { const selected = equipmentDraft.includes(item.id); return <Pressable key={item.id} onPress={() => toggleDraftEquipment(item.id)} accessibilityRole="checkbox" accessibilityLabel={item.name} accessibilityState={{ checked: selected }} style={({ pressed }) => [styles.pickerRow, { borderColor: colors.inputBorder, backgroundColor: pressed ? pressedSurface : "transparent" }]}><View style={styles.pickerRowCopy}><ThemedText style={styles.customWorkoutName}>{item.name}</ThemedText><ThemedText style={{ color: colors.icon }}>{item.category}</ThemedText></View><Ionicons style={styles.pickerRowControl} name={selected ? "checkmark-circle" : "ellipse-outline"} size={25} color={selected ? colors.text : colors.icon} accessible={false} /></Pressable>; })}
            {!pickerItems.length && <ThemedText style={{ color: colors.icon }}>{equipmentPickerTab === "selected" ? "No selected equipment matches your search." : "No unselected equipment matches your search."}</ThemedText>}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { minHeight: 64, paddingHorizontal: 20, paddingVertical: 8, gap: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 44, minHeight: 44, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  headerAction: { minWidth: 44, minHeight: 44, maxWidth: "40%", paddingHorizontal: 4, paddingVertical: 8, justifyContent: "center", alignItems: "center", borderRadius: 10 },
  expandedHeaderAction: { flex: 1, maxWidth: "50%" },
  stackedPickerHeader: { flexDirection: "column" },
  fullWidthHeaderAction: { flex: 0, width: "100%", maxWidth: "100%" },
  headerTitle: { flex: 1, minWidth: 0, textAlign: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  scrollingTitle: { fontSize: 24, fontWeight: "700" },
  content: { padding: 20, paddingBottom: 28, gap: 24 },
  group: { gap: 12 },
  label: { fontSize: 14, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, maxWidth: "100%", borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  fullWidth: { width: "100%" },
  chipText: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  save: { minHeight: 52, paddingHorizontal: 16, paddingVertical: 14, alignItems: "center", justifyContent: "center", borderRadius: 12, marginTop: 4 },
  saveText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16, textAlign: "center" },
  pressedSave: { transform: [{ scale: 0.99 }] },
  customWorkout: { minHeight: 56, padding: 12, gap: 8, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center" },
  customWorkoutCopy: { flex: 1, minWidth: 0, gap: 4 },
  customWorkoutName: { fontWeight: "700" },
  removeWorkout: { minHeight: 44, minWidth: 44, flexShrink: 0, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  textInput: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  actionText: { fontWeight: "700", flexShrink: 1 },
  addWorkout: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 12, gap: 8, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  equipmentSummary: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center" },
  equipmentSummaryCopy: { flex: 1, minWidth: 0, gap: 4, paddingRight: 12 },
  pickerContent: { padding: 20, paddingBottom: 28, gap: 16 },
  pickerTabs: { borderWidth: 1, borderRadius: 12, padding: 3, gap: 4, flexDirection: "row" },
  stackedPickerTabs: { flexDirection: "column" },
  pickerTab: { minHeight: 44, minWidth: 0, borderRadius: 9, gap: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 10 },
  flexibleTab: { flex: 1 },
  pickerTabText: { fontSize: 14, fontWeight: "700", textAlign: "center", flexShrink: 1 },
  pickerList: { gap: 10 },
  pickerRow: { minHeight: 64, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center" },
  pickerRowCopy: { flex: 1, minWidth: 0, gap: 2 },
  pickerRowControl: { flexShrink: 0, marginLeft: 12 },
});
