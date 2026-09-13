import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  deleteLoggedSet,
  getSession,
  restoreLoggedSet,
  updateLoggedSet,
  updateWorkoutNote,
  type SessionResponse,
} from "@/services/workoutLoggingService";
import { HttpError } from "@/services/httpClient";
import { AuthContext } from "@/utils/authContext";
import { createClientId } from "@/utils/activeWorkoutStore";

export default function WorkoutHistoryDetailScreen() {
  const router = useRouter();
  const { token } = useContext(AuthContext);
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const colors = Colors[useColorScheme() ?? "light"];
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingSetIds, setSavingSetIds] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState({ reps: "", weight: "" });
  const [noteDraft, setNoteDraft] = useState("");
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [recentlyRemoved, setRecentlyRemoved] = useState<{ id: string; exerciseId: string; setNumber: number } | null>(null);

  const load = useCallback(() => {
    if (!token || !sessionId) return;
    setLoading(true);
    void getSession(token, sessionId).then((result) => {
      setSession(result);
      setNoteDraft(result.workoutNote ?? "");
    }).catch(() => Alert.alert("Couldn’t load workout", "Please try again.")).finally(() => setLoading(false));
  }, [token, sessionId]);
  useEffect(() => { load(); }, [load]);

  const logsByExercise = useMemo(() => {
    const groups = new Map<string, SessionResponse["setLogs"]>();
    session?.setLogs.forEach((set) => groups.set(set.exerciseId, [...(groups.get(set.exerciseId) ?? []), set]));
    return groups;
  }, [session]);

  const saveSet = async (logId: string) => {
    if (!token || !session) return;
    const reps = Number(draft.reps);
    const weight = draft.weight.trim() === "" ? null : Number(draft.weight);
    if (!Number.isInteger(reps) || reps < 1 || (weight !== null && (!Number.isFinite(weight) || weight < 0))) {
      Alert.alert("Invalid set", "Use whole reps and a non-negative weight.");
      return;
    }
    const current = session.setLogs.find((set) => set.id === logId);
    if (!current || savingSetIds.has(logId)) return;
    setSession((value) => value ? {
      ...value,
      setLogs: value.setLogs.map((set) => set.id === logId ? { ...set, reps, weightKg: weight } : set),
    } : value);
    setEditingId(null);
    setSavingSetIds((ids) => new Set(ids).add(logId));
    try {
      const updated = await updateLoggedSet(token, session.id, logId, reps, weight, current.version, createClientId());
      setSession((value) => value ? {
        ...value,
        setLogs: value.setLogs.map((set) => set.id === logId ? updated : set),
      } : value);
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        try {
          const latest = await getSession(token, session.id);
          setSession(latest);
          setNoteDraft(latest.workoutNote ?? "");
          Alert.alert("Set updated elsewhere", "The latest saved value was restored.");
        } catch {
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
    if (!token || !session) return;
    Alert.alert("Remove set?", "You can undo this later.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void deleteLoggedSet(token, session.id, logId, createClientId()).then(() => {
        const removed = session.setLogs.find((set) => set.id === logId);
        if (!removed) return;
        setRecentlyRemoved({ id: removed.id, exerciseId: removed.exerciseId, setNumber: removed.setNumber });
        setSession((current) => current ? { ...current, setLogs: current.setLogs.filter((set) => set.id !== logId) } : current);
      }).catch(() => Alert.alert("Couldn’t remove set", "Try again.")) },
    ]);
  };

  const restoreSet = async () => {
    if (!token || !session || !recentlyRemoved) return;
    try {
      await restoreLoggedSet(token, session.id, recentlyRemoved.id, createClientId());
      setRecentlyRemoved(null);
      load();
    } catch {
      Alert.alert("Couldn’t restore set", "Try again.");
    }
  };

  const saveNote = async () => {
    if (!token || !session || noteStatus === "saving") return;
    setNoteStatus("saving");
    try {
      const updated = await updateWorkoutNote(token, session.id, noteDraft.trim() || null, createClientId());
      setSession(updated);
      setNoteDraft(updated.workoutNote ?? "");
      setNoteStatus("saved");
    } catch {
      setNoteStatus("error");
    }
  };

  if (loading || !session) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primaryButton} /></View></SafeAreaView>;
  const exerciseNames = new Map(
    (session.workoutSnapshot?.exerciseBlocks ?? []).flatMap((block) => block.items).map((item) => [String(item.exercise.id), item.exercise.name])
  );
  const readOnly = session.status === "abandoned";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 20, gap: 12 }}><Pressable accessibilityRole="button" accessibilityLabel="Back from workout details" onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={28} color={colors.text} /></Pressable><View style={{ flex: 1 }}><ThemedText type="title" style={{ fontSize: 24 }}>{session.summary.title}</ThemedText><ThemedText style={{ color: colors.placeholder }}>{session.status === "abandoned" ? "Abandoned — read only" : "Completed workout"}</ThemedText></View></View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        {Array.from(logsByExercise.entries()).map(([exerciseId, logs]) => (
          <View key={exerciseId} style={{ borderRadius: 16, padding: 16, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder }}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 17 }}>{exerciseNames.get(String(exerciseId)) ?? exerciseId}</ThemedText>
            {logs.sort((a, b) => a.setNumber - b.setNumber).map((set) => (
              <View key={set.id} style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.inputBorder, paddingTop: 10 }}>
                {editingId === set.id ? <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><TextInput value={draft.weight} onChangeText={(weight) => setDraft((current) => ({ ...current, weight }))} keyboardType="decimal-pad" placeholder="kg" placeholderTextColor={colors.placeholder} style={{ flex: 1, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, padding: 9, color: colors.text }} /><TextInput value={draft.reps} onChangeText={(reps) => setDraft((current) => ({ ...current, reps }))} keyboardType="number-pad" placeholder="reps" placeholderTextColor={colors.placeholder} style={{ flex: 1, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, padding: 9, color: colors.text }} /><Pressable testID={`history-save-set-${set.id}`} onPress={() => void saveSet(set.id)}><ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>Save</ThemedText></Pressable></View> : <View style={{ flexDirection: "row", alignItems: "center" }}><View style={{ flex: 1 }}><ThemedText>Set {set.setNumber}: {set.weightKg == null ? "Bodyweight" : `${set.weightKg} kg`} × {set.reps}</ThemedText>{savingSetIds.has(set.id) ? <ThemedText style={{ color: colors.placeholder, fontSize: 12, marginTop: 3 }}>Saving correction…</ThemedText> : null}</View>{!readOnly ? <><Pressable testID={`history-edit-set-${set.id}`} accessibilityRole="button" accessibilityLabel={`Edit set ${set.setNumber}`} accessibilityState={{ disabled: savingSetIds.has(set.id), busy: savingSetIds.has(set.id) }} disabled={savingSetIds.has(set.id)} onPress={() => { setEditingId(set.id); setDraft({ reps: String(set.reps), weight: set.weightKg == null ? "" : String(set.weightKg) }); }} hitSlop={8} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: savingSetIds.has(set.id) ? 0.45 : 1 }}><Ionicons name="create-outline" size={21} color={colors.primaryButton} /></Pressable><Pressable testID={`history-remove-set-${set.id}`} accessibilityRole="button" accessibilityLabel={`Remove set ${set.setNumber}`} accessibilityState={{ disabled: savingSetIds.has(set.id), busy: savingSetIds.has(set.id) }} disabled={savingSetIds.has(set.id)} onPress={() => removeSet(set.id)} hitSlop={8} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: 4, opacity: savingSetIds.has(set.id) ? 0.45 : 1 }}><Ionicons name="trash-outline" size={21} color="#D14343" /></Pressable></> : null}</View>}
              </View>
            ))}
          </View>
        ))}
        {recentlyRemoved && !readOnly ? <Pressable testID={`history-restore-set-${recentlyRemoved.id}`} onPress={() => void restoreSet()} style={{ alignSelf: "flex-start" }}><ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>Undo remove</ThemedText></Pressable> : null}
        <View style={{ borderRadius: 16, padding: 16, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder }}><ThemedText type="defaultSemiBold">Workout note</ThemedText><TextInput testID="history-workout-note" accessibilityLabel="Workout note" value={noteDraft} onChangeText={(value) => { setNoteDraft(value); setNoteStatus("idle"); }} editable={!readOnly && noteStatus !== "saving"} multiline placeholder="Add a note" placeholderTextColor={colors.placeholder} style={{ minHeight: 80, color: colors.text, marginTop: 8, textAlignVertical: "top" }} />{!readOnly ? <><Pressable testID="history-save-note" accessibilityRole="button" accessibilityLabel="Save workout note" accessibilityState={{ disabled: noteStatus === "saving", busy: noteStatus === "saving" }} disabled={noteStatus === "saving"} onPress={() => void saveNote()} style={{ opacity: noteStatus === "saving" ? 0.6 : 1 }}><ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>{noteStatus === "saving" ? "Saving note…" : "Save note"}</ThemedText></Pressable>{noteStatus !== "idle" ? <ThemedText accessibilityLiveRegion="polite" accessibilityRole={noteStatus === "error" ? "alert" : "text"} testID={noteStatus === "saved" ? "history-note-saved" : noteStatus === "error" ? "history-note-error" : "history-note-saving"} style={{ color: noteStatus === "error" ? "#DC2626" : colors.primaryButton, fontSize: 12, marginTop: 6 }}>{noteStatus === "saving" ? "Saving note…" : noteStatus === "saved" ? "Note saved" : "Couldn’t save note. Try again."}</ThemedText> : null}</> : null}</View>
        {session.exerciseFeedback.length > 0 ? <View style={{ borderRadius: 16, padding: 16, backgroundColor: colors.inputBackground }}><ThemedText type="defaultSemiBold">Exercise feedback</ThemedText>{session.exerciseFeedback.map((feedback) => <ThemedText key={feedback.exerciseId} style={{ marginTop: 6 }}>{exerciseNames.get(String(feedback.exerciseId)) ?? feedback.exerciseId}: {feedback.effort ?? "—"}{feedback.rir !== null ? ` · ${feedback.rir} RIR` : ""}</ThemedText>)}</View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
