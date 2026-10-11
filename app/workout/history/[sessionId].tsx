import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, TouchableWithoutFeedback, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  deleteLoggedSet,
  getSession,
  logSet,
  restoreLoggedSet,
  updateLoggedSet,
  updateWorkoutNote,
  type SessionResponse,
} from "@/services/workoutLoggingService";
import { HttpError } from "@/services/httpClient";
import { AuthContext } from "@/utils/authContext";
import { createClientId } from "@/utils/activeWorkoutStore";
import { formatWeightInput, fromKg, loadWeightUnit, toKg, type WeightUnit } from "@/utils/weightUnits";

type AddDraft = { exerciseId: string; setNumber: number; reps: string; weight: string };
type AddAttempt = { exerciseId: string; setNumber: number; reps: number; weightKg: number | undefined; clientOperationId: string };

function CorrectionAction({ colors, label, testID, accessibilityLabel = label, icon, primary = false, disabled = false, busy = false, onPress }: {
  colors: typeof Colors.light; label: string; testID?: string; accessibilityLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap; primary?: boolean; disabled?: boolean; busy?: boolean; onPress: () => void;
}) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 44, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: primary ? colors.primaryButton : colors.inputBorder, backgroundColor: primary ? pressed ? "#5940DD" : colors.primaryButton : colors.inputBackground, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.5 : pressed && !primary ? 0.65 : 1 })}>
    {icon ? <Ionicons accessible={false} name={icon} size={18} color={primary ? "#FFFFFF" : colors.icon} /> : null}
    <ThemedText style={{ fontWeight: "600", color: primary ? "#FFFFFF" : colors.text, textAlign: "center", flexShrink: 1 }}>{label}</ThemedText>
  </Pressable>;
}

export default function WorkoutHistoryDetailScreen() {
  const router = useRouter();
  const { token, user } = useContext(AuthContext);
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.3;
  const errorColor = scheme === "dark" ? "#F87171" : "#B42318";
  const savedColor = scheme === "dark" ? "#4ADE80" : "#15803D";
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [sessionOwnerId, setSessionOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingSetIds, setSavingSetIds] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState({ reps: "", weight: "" });
  const [noteDraft, setNoteDraft] = useState("");
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [recentlyRemoved, setRecentlyRemoved] = useState<{ id: string; exerciseId: string; setNumber: number } | null>(null);
  const [unit, setUnit] = useState<WeightUnit>("LB");
  const [addDraft, setAddDraft] = useState<AddDraft | null>(null);
  const [addAttempt, setAddAttempt] = useState<AddAttempt | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const activeRequestKey = useRef("");
  activeRequestKey.current = JSON.stringify([user?.id, token, sessionId, requestVersion.current]);

  useEffect(() => { void loadWeightUnit().then(setUnit); }, []);

  const load = useCallback(() => {
    const version = ++requestVersion.current;
    activeRequestKey.current = JSON.stringify([user?.id, token, sessionId, version]);
    setSession(null);
    setSessionOwnerId(null);
    if (!token || !user?.id || !sessionId) { setLoadError(true); setLoading(false); return; }
    setLoading(true);
    setLoadError(false);
    void getSession(token, sessionId).then((result) => {
      if (requestVersion.current !== version) return;
      setSession(result);
      setSessionOwnerId(user.id);
      setNoteDraft(result.workoutNote ?? "");
    }).catch(() => { if (requestVersion.current === version) setLoadError(true); }).finally(() => { if (requestVersion.current === version) setLoading(false); });
  }, [token, user?.id, sessionId]);
  useEffect(() => {
    setAddDraft(null);
    setAddAttempt(null);
    setAddError(null);
    load();
  }, [load]);

  const logsByExercise = useMemo(() => {
    const groups = new Map<string, SessionResponse["setLogs"]>();
    session?.setLogs.forEach((set) => groups.set(set.exerciseId, [...(groups.get(set.exerciseId) ?? []), set]));
    return groups;
  }, [session]);

  const exercises = useMemo(() => {
    const planned = (session?.workoutSnapshot?.exerciseBlocks ?? []).flatMap((block) => block.items);
    const seen = new Set<string>();
    const ordered = planned.flatMap((item) => {
      const id = String(item.exercise.id);
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ id, name: item.exercise.name, prescribedSets: item.prescription.sets }];
    });
    for (const id of logsByExercise.keys()) {
      if (!seen.has(id)) ordered.push({ id, name: id, prescribedSets: 0 });
    }
    return ordered;
  }, [session?.workoutSnapshot, logsByExercise]);

  const saveAddedSet = async (retry?: AddAttempt) => {
    if (!token || !user?.id || sessionOwnerId !== user.id || !session || !addDraft || adding || session.status === "abandoned") return;
    const requestKey = activeRequestKey.current;
    const reps = Number(addDraft.reps);
    const enteredWeight = addDraft.weight.trim() === "" ? undefined : Number(addDraft.weight);
    if (!retry && (!Number.isInteger(reps) || reps < 1 || (enteredWeight !== undefined && (!Number.isFinite(enteredWeight) || enteredWeight < 0)))) {
      setAddError("Enter whole reps and a non-negative weight, or leave weight blank for bodyweight.");
      return;
    }
    const attempt = retry ?? {
      exerciseId: addDraft.exerciseId,
      setNumber: addDraft.setNumber,
      reps,
      weightKg: enteredWeight === undefined ? undefined : toKg(enteredWeight, unit),
      clientOperationId: createClientId(),
    };
    setAddAttempt(attempt);
    setAdding(true);
    setAddError(null);
    try {
      const created = await logSet(token, session.id, attempt.exerciseId, attempt.setNumber, attempt.reps, attempt.weightKg, attempt.clientOperationId);
      if (activeRequestKey.current !== requestKey) return;
      setSession((value) => value ? { ...value, setLogs: [...value.setLogs.filter((set) => set.id !== created.id), created] } : value);
      setAddDraft(null);
      setAddAttempt(null);
      try {
        const latest = await getSession(token, session.id);
        if (activeRequestKey.current !== requestKey) return;
        setSession(latest);
        setNoteDraft(latest.workoutNote ?? "");
      } catch {
        if (activeRequestKey.current === requestKey) Alert.alert("Set saved", "The set was saved. Updated totals will appear when the workout refreshes.");
      }
    } catch (error) {
      if (activeRequestKey.current !== requestKey) return;
      if (error instanceof HttpError && error.status === 409) {
        try {
          const latest = await getSession(token, session.id);
          if (activeRequestKey.current !== requestKey) return;
          setSession(latest);
          setNoteDraft(latest.workoutNote ?? "");
          setAddDraft(null);
          setAddAttempt(null);
          Alert.alert("Set already logged", "The latest workout was loaded. Check the set before adding another.");
        } catch {
          if (activeRequestKey.current === requestKey) setAddError("This set may already be logged. Refresh the workout before trying again.");
        }
      } else {
        setAddError("Couldn’t save this set. Retry to safely send the same set again.");
      }
    } finally {
      setAdding(false);
    }
  };

  const saveSet = async (logId: string) => {
    if (!token || !session || !user?.id || sessionOwnerId !== user.id) return;
    const requestKey = activeRequestKey.current;
    const reps = Number(draft.reps);
    const enteredWeight = draft.weight.trim() === "" ? null : Number(draft.weight);
    if (!Number.isInteger(reps) || reps < 1 || (enteredWeight !== null && (!Number.isFinite(enteredWeight) || enteredWeight < 0))) {
      Alert.alert("Invalid set", "Use whole reps and a non-negative weight.");
      return;
    }
    const current = session.setLogs.find((set) => set.id === logId);
    if (!current || savingSetIds.has(logId)) return;
    const originalDisplay = current.weightKg == null ? "" : formatWeightInput(fromKg(current.weightKg, unit));
    const weight = draft.weight.trim() === originalDisplay
      ? current.weightKg
      : enteredWeight === null ? null : toKg(enteredWeight, unit);
    setSession((value) => value ? {
      ...value,
      setLogs: value.setLogs.map((set) => set.id === logId ? { ...set, reps, weightKg: weight } : set),
    } : value);
    setEditingId(null);
    setSavingSetIds((ids) => new Set(ids).add(logId));
    try {
      const updated = await updateLoggedSet(token, session.id, logId, reps, weight, current.version, createClientId());
      if (activeRequestKey.current !== requestKey) return;
      setSession((value) => value ? {
        ...value,
        setLogs: value.setLogs.map((set) => set.id === logId ? updated : set),
      } : value);
    } catch (error) {
      if (activeRequestKey.current !== requestKey) return;
      if (error instanceof HttpError && error.status === 409) {
        try {
          const latest = await getSession(token, session.id);
          if (activeRequestKey.current !== requestKey) return;
          setSession(latest);
          setNoteDraft(latest.workoutNote ?? "");
          Alert.alert("Set updated elsewhere", "The latest saved value was restored.");
        } catch {
          if (activeRequestKey.current !== requestKey) return;
          setSession((value) => value ? { ...value, setLogs: value.setLogs.map((set) => set.id === logId ? current : set) } : value);
          Alert.alert("Couldn’t refresh set", "Your previous value was restored. Try again when you’re back online.");
        }
      } else {
        setSession((value) => value ? { ...value, setLogs: value.setLogs.map((set) => set.id === logId ? current : set) } : value);
        Alert.alert("Couldn’t save correction", "Your previous value was restored. Try again.");
      }
    } finally {
      setSavingSetIds((ids) => {
        const next = new Set(ids);
        next.delete(logId);
        return next;
      });
    }
  };

  const removeSet = (logId: string) => {
    if (!token || !session || !user?.id || sessionOwnerId !== user.id) return;
    const requestKey = activeRequestKey.current;
    Alert.alert("Remove set?", "You can undo this later.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void deleteLoggedSet(token, session.id, logId, createClientId()).then(() => {
        if (activeRequestKey.current !== requestKey) return;
        const removed = session.setLogs.find((set) => set.id === logId);
        if (!removed) return;
        setRecentlyRemoved({ id: removed.id, exerciseId: removed.exerciseId, setNumber: removed.setNumber });
        setSession((current) => current ? {
          ...current,
          setLogs: current.setLogs.filter((set) => set.id !== logId),
          deletedSetLogs: [...current.deletedSetLogs.filter((set) => set.id !== logId), removed],
        } : current);
        void getSession(token, session.id).then((latest) => {
          if (activeRequestKey.current === requestKey) setSession(latest);
        }).catch(() => {});
      }).catch(() => { if (activeRequestKey.current === requestKey) Alert.alert("Couldn’t remove set", "Try again."); }) },
    ]);
  };

  const restoreSet = async () => {
    if (!token || !session || !recentlyRemoved || !user?.id || sessionOwnerId !== user.id) return;
    const requestKey = activeRequestKey.current;
    try {
      await restoreLoggedSet(token, session.id, recentlyRemoved.id, createClientId());
      if (activeRequestKey.current !== requestKey) return;
      setRecentlyRemoved(null);
      load();
    } catch {
      if (activeRequestKey.current === requestKey) Alert.alert("Couldn’t restore set", "Try again.");
    }
  };

  const saveNote = async () => {
    if (!token || !session || !user?.id || sessionOwnerId !== user.id || noteStatus === "saving") return;
    const requestKey = activeRequestKey.current;
    setNoteStatus("saving");
    try {
      const updated = await updateWorkoutNote(token, session.id, noteDraft.trim() || null, createClientId());
      if (activeRequestKey.current !== requestKey) return;
      setSession(updated);
      setNoteDraft(updated.workoutNote ?? "");
      setNoteStatus("saved");
    } catch {
      if (activeRequestKey.current === requestKey) setNoteStatus("error");
    }
  };

  if (loading || !session || sessionOwnerId !== user?.id || session.id !== sessionId) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>{loadError ? <><ThemedText>Couldn’t load this workout.</ThemedText><CorrectionAction colors={colors} testID="history-retry-load" label="Retry" icon="refresh-outline" onPress={load} /></> : <ActivityIndicator color={colors.icon} />}</View></SafeAreaView>;
  const exerciseNames = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
  const readOnly = session.status === "abandoned";
  const inputStyle = { minHeight: 48, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, color: colors.text };
  const heading = <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}><View testID="history-heading" style={{ flex: stacked ? undefined : 1, gap: 4 }}><ThemedText type="title" style={{ fontSize: 24 }}>{session.summary.title}</ThemedText><ThemedText style={{ color: colors.icon }}>{session.status === "abandoned" ? "Abandoned — read only" : session.status === "completed" ? "Completed workout" : "Workout in progress"}</ThemedText></View></TouchableWithoutFeedback>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <View testID="history-header" onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
        <Pressable testID="history-back" accessibilityRole="button" accessibilityLabel="Back from workout details" onPress={() => { Keyboard.dismiss(); router.back(); }} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}><Ionicons accessible={false} name="chevron-back" size={26} color={colors.text} /></Pressable>
        {!stacked ? heading : null}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView testID="history-scroll" keyboardShouldPersistTaps="always" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} contentContainerStyle={{ padding: 20, flexGrow: 1 }} onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }}>
        <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
        <View testID="history-content" style={{ gap: 16 }} onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }}>
        {stacked ? heading : null}
        {exercises.map((exercise) => {
          const logs = [...(logsByExercise.get(exercise.id) ?? [])].sort((a, b) => a.setNumber - b.setNumber);
          const occupied = new Set(logs.map((set) => set.setNumber));
          const deleted = new Map(session.deletedSetLogs.filter((set) => set.exerciseId === exercise.id).map((set) => [set.setNumber, set]));
          const prescribedSlots = Array.from({ length: exercise.prescribedSets }, (_, index) => index + 1);
          const nextSlot = prescribedSlots.find((number) => !occupied.has(number) && !deleted.has(number));
          const deletedSlots = prescribedSlots.filter((number) => !occupied.has(number) && deleted.has(number));
          const isAddingHere = addDraft?.exerciseId === exercise.id;
          return <View key={exercise.id} testID={`history-exercise-${exercise.id}`} style={{ borderRadius: 16, padding: 16, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder }}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18 }}>{exercise.name}</ThemedText>
            {logs.length === 0 ? <ThemedText style={{ color: colors.icon, marginTop: 8 }}>No sets logged yet.</ThemedText> : null}
            {logs.map((set) => (
              <View key={set.id} style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.inputBorder, paddingTop: 10 }}>
                {editingId === set.id ? <View style={{ gap: 12 }}>
                  <ThemedText type="defaultSemiBold">Edit set {set.setNumber}</ThemedText>
                  <View testID={`history-edit-fields-${set.id}`} style={{ flexDirection: stacked ? "column" : "row", gap: 12 }}>
                    <View style={{ flex: 1, gap: 6 }}><ThemedText style={{ color: colors.icon, fontSize: 14 }}>Weight ({unit.toLowerCase()})</ThemedText><TextInput testID={`history-edit-weight-${set.id}`} accessibilityLabel={`Set ${set.setNumber} weight in ${unit.toLowerCase()}`} value={draft.weight} onChangeText={(weight) => setDraft((current) => ({ ...current, weight }))} keyboardType="decimal-pad" placeholder={unit.toLowerCase()} placeholderTextColor={colors.icon} style={inputStyle} /></View>
                    <View style={{ flex: 1, gap: 6 }}><ThemedText style={{ color: colors.icon, fontSize: 14 }}>Reps</ThemedText><TextInput testID={`history-edit-reps-${set.id}`} accessibilityLabel={`Set ${set.setNumber} reps`} value={draft.reps} onChangeText={(reps) => setDraft((current) => ({ ...current, reps }))} keyboardType="number-pad" placeholder="reps" placeholderTextColor={colors.icon} style={inputStyle} /></View>
                  </View>
                  <View style={{ flexDirection: stacked ? "column" : "row", gap: 8 }}><CorrectionAction colors={colors} testID={`history-save-set-${set.id}`} label="Save changes" accessibilityLabel={`Save changes to set ${set.setNumber}`} primary onPress={() => { Keyboard.dismiss(); void saveSet(set.id); }} /><CorrectionAction colors={colors} testID={`history-cancel-edit-${set.id}`} label="Cancel" accessibilityLabel={`Cancel editing set ${set.setNumber}`} onPress={() => { Keyboard.dismiss(); setEditingId(null); }} /></View>
                </View> : <View style={{ flexDirection: stacked ? "column" : "row", gap: 8, alignItems: stacked ? "stretch" : "center" }}>
                  <View style={{ flex: 1, gap: 4 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Ionicons accessible={false} name="checkmark-done-outline" size={19} color={savingSetIds.has(set.id) ? colors.icon : savedColor} /><ThemedText testID={`history-logged-set-${set.id}`} accessibilityLabel={`${savingSetIds.has(set.id) ? "Saving correction to" : "Saved"} set ${set.setNumber}: ${set.weightKg == null ? "Bodyweight" : `${formatWeightInput(fromKg(set.weightKg, unit))} ${unit.toLowerCase()}`} × ${set.reps}`} style={{ flex: 1 }}>Set {set.setNumber}: {set.weightKg == null ? "Bodyweight" : `${formatWeightInput(fromKg(set.weightKg, unit))} ${unit.toLowerCase()}`} × {set.reps}</ThemedText></View>{savingSetIds.has(set.id) ? <ThemedText accessibilityLiveRegion="polite" style={{ color: colors.icon, fontSize: 13 }}>Saving correction…</ThemedText> : null}</View>
                  {!readOnly ? <View style={{ flexDirection: "row", gap: 4, alignSelf: "flex-end" }}>
                    <Pressable testID={`history-edit-set-${set.id}`} accessibilityRole="button" accessibilityLabel={`Edit set ${set.setNumber}`} accessibilityState={{ disabled: savingSetIds.has(set.id), busy: savingSetIds.has(set.id) }} disabled={savingSetIds.has(set.id)} onPress={() => { setEditingId(set.id); setDraft({ reps: String(set.reps), weight: set.weightKg == null ? "" : formatWeightInput(fromKg(set.weightKg, unit)) }); }} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: savingSetIds.has(set.id) ? 0.45 : pressed ? 0.6 : 1 })}><Ionicons accessible={false} name="create-outline" size={21} color={colors.icon} /></Pressable>
                    <Pressable testID={`history-remove-set-${set.id}`} accessibilityRole="button" accessibilityLabel={`Remove set ${set.setNumber}`} accessibilityState={{ disabled: savingSetIds.has(set.id), busy: savingSetIds.has(set.id) }} disabled={savingSetIds.has(set.id)} onPress={() => removeSet(set.id)} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: savingSetIds.has(set.id) ? 0.45 : pressed ? 0.6 : 1 })}><Ionicons accessible={false} name="trash-outline" size={21} color={errorColor} /></Pressable>
                  </View> : null}
                </View>}
              </View>
            ))}
            {!readOnly && nextSlot !== undefined && !isAddingHere ? <View style={{ marginTop: 12 }}><CorrectionAction colors={colors} testID={`history-add-set-${exercise.id}`} label={`Add set ${nextSlot}`} accessibilityLabel={`Add set ${nextSlot} for ${exercise.name}`} icon="add-outline" onPress={() => { setAddDraft({ exerciseId: exercise.id, setNumber: nextSlot, reps: "", weight: "" }); setAddAttempt(null); setAddError(null); }} /></View> : null}
            {!readOnly && isAddingHere ? <View style={{ marginTop: 16, gap: 12 }}>
              <ThemedText type="defaultSemiBold">Add set {addDraft.setNumber}</ThemedText><ThemedText style={{ color: colors.icon, fontSize: 14 }}>Leave weight blank for bodyweight.</ThemedText>
              <View testID={`history-add-fields-${exercise.id}`} style={{ flexDirection: stacked ? "column" : "row", gap: 12 }}>
                <View style={{ flex: 1, gap: 6 }}><ThemedText style={{ color: colors.icon, fontSize: 14 }}>Weight ({unit.toLowerCase()})</ThemedText><TextInput testID={`history-add-weight-${exercise.id}`} accessibilityLabel={`New set weight in ${unit.toLowerCase()}`} value={addDraft.weight} editable={!adding && !addAttempt} onChangeText={(weight) => setAddDraft((current) => current ? { ...current, weight } : current)} keyboardType="decimal-pad" placeholder={unit.toLowerCase()} placeholderTextColor={colors.icon} style={inputStyle} /></View>
                <View style={{ flex: 1, gap: 6 }}><ThemedText style={{ color: colors.icon, fontSize: 14 }}>Reps</ThemedText><TextInput testID={`history-add-reps-${exercise.id}`} accessibilityLabel="New set reps" value={addDraft.reps} editable={!adding && !addAttempt} onChangeText={(reps) => setAddDraft((current) => current ? { ...current, reps } : current)} keyboardType="number-pad" placeholder="reps" placeholderTextColor={colors.icon} style={inputStyle} /></View>
              </View>
              {addError ? <ThemedText accessibilityRole="alert" testID="history-add-set-error" style={{ color: errorColor }}>{addError}</ThemedText> : null}
              <View style={{ flexDirection: stacked ? "column" : "row", gap: 8 }}><CorrectionAction colors={colors} testID={`history-save-added-set-${exercise.id}`} label={adding ? "Saving…" : addAttempt ? "Retry set" : "Save set"} primary disabled={adding} busy={adding} onPress={() => { Keyboard.dismiss(); void saveAddedSet(addAttempt ?? undefined); }} /><CorrectionAction colors={colors} testID={`history-cancel-add-${exercise.id}`} label="Cancel" disabled={adding} busy={adding} onPress={() => { Keyboard.dismiss(); setAddDraft(null); setAddAttempt(null); setAddError(null); }} /></View>
            </View> : null}
            {!readOnly ? deletedSlots.map((deletedSlot) => <View key={deletedSlot} style={{ marginTop: 12 }}><CorrectionAction colors={colors} testID={`history-restore-slot-${exercise.id}-${deletedSlot}`} label={`Restore set ${deletedSlot}`} accessibilityLabel={`Restore set ${deletedSlot} for ${exercise.name}`} icon="refresh-outline" onPress={() => { const removed = deleted.get(deletedSlot); const requestKey = activeRequestKey.current; if (!removed || !token) return; void restoreLoggedSet(token, session.id, removed.id, createClientId()).then(() => { if (activeRequestKey.current === requestKey) load(); }).catch(() => { if (activeRequestKey.current === requestKey) Alert.alert("Couldn’t restore set", "Try again."); }); }} /></View>) : null}
          </View>;
        })}
        {recentlyRemoved && !readOnly ? <CorrectionAction colors={colors} testID={`history-restore-set-${recentlyRemoved.id}`} label="Undo remove" icon="arrow-undo-outline" onPress={() => void restoreSet()} /> : null}
        <View testID="history-note-card" style={{ borderRadius: 16, padding: 16, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, gap: 12 }}><ThemedText type="defaultSemiBold" style={{ fontSize: 18 }}>Workout note</ThemedText><TextInput testID="history-workout-note" accessibilityLabel="Workout note" value={noteDraft} onChangeText={(value) => { setNoteDraft(value); setNoteStatus("idle"); }} editable={!readOnly && noteStatus !== "saving"} multiline placeholder="Add a note" placeholderTextColor={colors.icon} style={{ ...inputStyle, minHeight: 96, textAlignVertical: "top" }} />{!readOnly ? <><CorrectionAction colors={colors} testID="history-save-note" accessibilityLabel="Save workout note" label={noteStatus === "saving" ? "Saving note…" : "Save note"} primary disabled={noteStatus === "saving"} busy={noteStatus === "saving"} onPress={() => { Keyboard.dismiss(); void saveNote(); }} />{noteStatus !== "idle" ? <ThemedText accessibilityLiveRegion="polite" accessibilityRole={noteStatus === "error" ? "alert" : "text"} testID={noteStatus === "saved" ? "history-note-saved" : noteStatus === "error" ? "history-note-error" : "history-note-saving"} style={{ color: noteStatus === "error" ? errorColor : colors.icon, fontSize: 14 }}>{noteStatus === "saving" ? "Saving note…" : noteStatus === "saved" ? "Note saved" : "Couldn’t save note. Try again."}</ThemedText> : null}</> : null}</View>
        {session.exerciseFeedback.length > 0 ? <View style={{ borderRadius: 16, padding: 16, backgroundColor: colors.inputBackground }}><ThemedText type="defaultSemiBold">Exercise feedback</ThemedText>{session.exerciseFeedback.map((feedback) => <ThemedText key={feedback.exerciseId} style={{ marginTop: 6 }}>{exerciseNames.get(String(feedback.exerciseId)) ?? feedback.exerciseId}: {feedback.effort ?? "—"}{feedback.rir !== null ? ` · ${feedback.rir} RIR` : ""}</ThemedText>)}</View> : null}
        </View>
        </TouchableWithoutFeedback>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
