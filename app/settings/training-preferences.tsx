import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { TrainingPreferences } from "@/services/onboardingService";
import { getTrainingPreferences, updateTrainingPreferences } from "@/services/onboardingService";
import { AuthContext } from "@/utils/authContext";
import { useEquipment } from "@/utils/equipmentContext";
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
  return <View style={styles.group}>
    <ThemedText style={[styles.label, { color: colors.placeholder }]}>{title}</ThemedText>
    <View style={styles.chips}>{choices.map((choice) => {
      const selected = value === choice.value;
      return <Pressable key={choice.value} onPress={() => onChange(choice.value)} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.chip, { borderColor: colors.inputBorder }, selected && { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton }]}>
        <ThemedText style={[styles.chipText, selected && styles.selectedChipText]}>{choice.label}</ThemedText>
      </Pressable>;
    })}</View>
  </View>;
}

export default function TrainingPreferencesScreen() {
  const router = useRouter();
  const { token } = useContext(AuthContext);
  const { refreshWeek } = useContext(WorkoutWeekContext);
  const { items: catalogItems } = useEquipment();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const [preferences, setPreferences] = useState<TrainingPreferences>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customWorkoutName, setCustomWorkoutName] = useState("");
  const [customMuscles, setCustomMuscles] = useState<string[]>([]);
  const [equipmentPickerVisible, setEquipmentPickerVisible] = useState(false);
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [equipmentDraft, setEquipmentDraft] = useState<string[]>([]);

  const selectedEquipmentItems = useMemo(
    () => catalogItems.filter((item) => preferences.selectedEquipment?.includes(item.id)),
    [catalogItems, preferences.selectedEquipment]
  );
  const pickerItems = useMemo(() => {
    const query = equipmentQuery.trim().toLowerCase();
    return query
      ? catalogItems.filter((item) => item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query))
      : catalogItems.filter((item) => equipmentDraft.includes(item.id));
  }, [catalogItems, equipmentDraft, equipmentQuery]);

  useEffect(() => {
    if (!token) return;
    void getTrainingPreferences(token).then(setPreferences).catch(() => Alert.alert("Could Not Load Preferences", "Please try again.")).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (catalogItems.length === 0) return;
    const catalogIds = new Set(catalogItems.map((item) => item.id));
    setPreferences((current) => ({
      ...current,
      selectedEquipment: (current.selectedEquipment || []).filter((id) => catalogIds.has(id)),
    }));
  }, [catalogItems]);

  const save = async () => {
    if (!token || saving) return;
    if (preferences.workoutSplit === "custom" && !preferences.customWorkouts?.length) {
      Alert.alert("Add a custom workout", "Your custom split needs at least one workout day.");
      return;
    }
    setSaving(true);
    try {
      const { selectedEquipment, ...otherPreferences } = preferences;
      const saved = await updateTrainingPreferences(token, {
        ...otherPreferences,
        ...(catalogItems.length > 0
          ? {
              selectedEquipment: (selectedEquipment || []).filter((id) =>
                catalogItems.some((item) => item.id === id)
              ),
            }
          : {}),
      });
      setPreferences(saved);
      await refreshWeek();
      router.back();
    } catch {
      Alert.alert("Could Not Save Preferences", "Your existing workout plan is unchanged. Please try again.");
    } finally { setSaving(false); }
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

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back"><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable><ThemedText type="title" style={styles.title}>Training Preferences</ThemedText><View style={styles.back} /></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {loading ? <ThemedText style={{ color: colors.placeholder }}>Loading preferences…</ThemedText> : <>
        <ChoiceGroup title="Goal" choices={GOALS} value={preferences.fitnessGoal} onChange={(value) => setPreferences((p) => ({ ...p, fitnessGoal: value as TrainingPreferences["fitnessGoal"] }))} />
        <ChoiceGroup title="Experience" choices={EXPERIENCE} value={preferences.experienceLevel} onChange={(value) => setPreferences((p) => ({ ...p, experienceLevel: value as TrainingPreferences["experienceLevel"] }))} />
        <ChoiceGroup title="Days per week" choices={FREQUENCY} value={preferences.workoutFrequency} onChange={(value) => setPreferences((p) => ({ ...p, workoutFrequency: value as TrainingPreferences["workoutFrequency"] }))} />
        <ChoiceGroup title="Workout split" choices={SPLITS} value={preferences.workoutSplit} onChange={(value) => setPreferences((p) => ({ ...p, workoutSplit: value as TrainingPreferences["workoutSplit"] }))} />
        {preferences.workoutSplit === "custom" && <View style={styles.group}>
          <ThemedText style={[styles.label, { color: colors.placeholder }]}>Custom workout cycle</ThemedText>
          {(preferences.customWorkouts || []).map((workout) => <View key={workout.id} style={[styles.customWorkout, { borderColor: colors.inputBorder }]}><View><ThemedText style={styles.customWorkoutName}>{workout.name}</ThemedText><ThemedText style={{ color: colors.placeholder }}>{workout.muscleGroups.join(", ")}</ThemedText></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${workout.name}`} onPress={() => setPreferences((current) => ({ ...current, customWorkouts: current.customWorkouts?.filter((item) => item.id !== workout.id) }))}><Ionicons name="trash-outline" size={22} color="#D14343" /></Pressable></View>)}
          <TextInput value={customWorkoutName} onChangeText={setCustomWorkoutName} placeholder="Workout name" placeholderTextColor={colors.placeholder} style={[styles.textInput, { color: colors.text, borderColor: colors.inputBorder }]} />
          <View style={styles.chips}>{CUSTOM_MUSCLES.map((muscle) => { const selected = customMuscles.includes(muscle.value); return <Pressable key={muscle.value} onPress={() => toggleCustomMuscle(muscle.value)} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} style={[styles.chip, { borderColor: colors.inputBorder }, selected && { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton }]}><ThemedText style={[styles.chipText, selected && styles.selectedChipText]}>{muscle.label}</ThemedText></Pressable>; })}</View>
          <Pressable onPress={addCustomWorkout} accessibilityRole="button" style={[styles.addWorkout, { borderColor: colors.primaryButton }]}><ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>Add custom workout</ThemedText></Pressable>
        </View>}
        <ChoiceGroup title="Training location" choices={PLACES} value={preferences.trainingPlace} onChange={(value) => setPreferences((p) => ({ ...p, trainingPlace: value as TrainingPreferences["trainingPlace"] }))} />
        <View style={styles.group}>
          <ThemedText style={[styles.label, { color: colors.placeholder }]}>General equipment</ThemedText>
          <Pressable onPress={openEquipmentPicker} accessibilityRole="button" accessibilityLabel="Edit owned equipment" accessibilityHint="Opens a searchable equipment picker" style={[styles.equipmentSummary, { borderColor: colors.inputBorder }]}>
            <View style={styles.equipmentSummaryCopy}>
              <ThemedText style={styles.customWorkoutName}>{selectedEquipmentItems.length} {selectedEquipmentItems.length === 1 ? "item" : "items"} selected</ThemedText>
              <ThemedText numberOfLines={1} style={{ color: colors.placeholder }}>{selectedEquipmentItems.length ? selectedEquipmentItems.slice(0, 3).map((item) => item.name).join(", ") + (selectedEquipmentItems.length > 3 ? "…" : "") : "No equipment selected"}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.placeholder} />
          </Pressable>
        </View>
        <Pressable onPress={() => void save()} disabled={saving} accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} style={[styles.save, { backgroundColor: colors.primaryButton }, saving && styles.dim]}><ThemedText style={styles.saveText}>{saving ? "Saving…" : "Save preferences"}</ThemedText></Pressable>
      </>}
    </ScrollView>
    <Modal visible={equipmentPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEquipmentPickerVisible(false)}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <View style={styles.header}><Pressable onPress={() => setEquipmentPickerVisible(false)} style={styles.back} accessibilityRole="button" accessibilityLabel="Cancel equipment changes"><ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>Cancel</ThemedText></Pressable><ThemedText type="title" style={styles.title}>Your equipment</ThemedText><Pressable onPress={applyEquipmentDraft} style={styles.back} accessibilityRole="button" accessibilityLabel="Apply equipment changes"><ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>Done</ThemedText></Pressable></View>
        <View style={styles.pickerContent}>
          <TextInput value={equipmentQuery} onChangeText={setEquipmentQuery} placeholder="Search equipment" placeholderTextColor={colors.placeholder} style={[styles.textInput, { color: colors.text, borderColor: colors.inputBorder }]} accessibilityLabel="Search equipment" />
          <ThemedText style={{ color: colors.placeholder }}>{equipmentQuery ? "Search results" : "Selected equipment"}</ThemedText>
          <ScrollView contentContainerStyle={styles.pickerList} keyboardShouldPersistTaps="handled">
            {pickerItems.map((item) => { const selected = equipmentDraft.includes(item.id); return <Pressable key={item.id} onPress={() => toggleDraftEquipment(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} style={[styles.pickerRow, { borderColor: colors.inputBorder }]}><View><ThemedText style={styles.customWorkoutName}>{item.name}</ThemedText><ThemedText style={{ color: colors.placeholder }}>{item.category}</ThemedText></View><Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={25} color={selected ? colors.primaryButton : colors.placeholder} /></Pressable>; })}
            {!pickerItems.length && <ThemedText style={{ color: colors.placeholder }}>Search the catalog to add equipment you own.</ThemedText>}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1 }, header: { height: 64, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, back: { width: 64, minHeight: 44, justifyContent: "center" }, title: { fontSize: 20 }, content: { padding: 20, paddingBottom: 44, gap: 28 }, group: { gap: 12 }, label: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, chip: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, justifyContent: "center" }, chipText: { fontSize: 15, fontWeight: "600" }, selectedChipText: { color: "#FFFFFF" }, save: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 12, marginTop: 4 }, saveText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 }, dim: { opacity: 0.6 }, customWorkout: { minHeight: 56, padding: 12, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, customWorkoutName: { fontWeight: "700" }, textInput: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, fontSize: 16 }, addWorkout: { minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" }, equipmentSummary: { minHeight: 68, paddingHorizontal: 16, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, equipmentSummaryCopy: { flex: 1, gap: 4, paddingRight: 12 }, pickerContent: { flex: 1, padding: 20, gap: 16 }, pickerList: { gap: 10, paddingBottom: 32 }, pickerRow: { minHeight: 64, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" } });
