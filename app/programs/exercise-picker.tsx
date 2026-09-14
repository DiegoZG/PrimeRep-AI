import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExerciseRow } from "@/components/explore";
import { ProgramHeader } from "@/components/program";
import { ScreenState } from "@/components/screen-state";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Exercise } from "@/interfaces/exercises";
import { getExercises } from "@/services/exerciseService";
import { AuthContext } from "@/utils/authContext";
import { useProgramDraft } from "@/utils/programDraftContext";

export default function ExercisePickerScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { token, user } = useContext(AuthContext);
  const accountKey = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const { draft, addExercise } = useProgramDraft();
  const day = draft.days.find((item) => item.localId === dayId);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const requestRef = useRef(0);
  const accountRef = useRef(`${user?.id ?? "guest"}:${token ?? "anonymous"}`);
  accountRef.current = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;

  useEffect(() => { const timeout = setTimeout(() => setDebounced(query.trim()), 250); return () => clearTimeout(timeout); }, [query]);
  useEffect(() => {
    if (!token || !dayId) return;
    let active = true;
    const requestId = ++requestRef.current;
    const account = accountRef.current;
    setLoading(true);
    setError(null);
    getExercises({ q: debounced.length >= 2 ? debounced : undefined, limit: 100 }, token)
      .then((result) => { if (active && requestRef.current === requestId && accountRef.current === account) setItems(result); })
      .catch((loadError) => { if (active && requestRef.current === requestId && accountRef.current === account) { console.warn("Exercises couldn't load", loadError); setError("Exercises couldn’t load. Check your connection and try again."); } })
      .finally(() => { if (active && requestRef.current === requestId && accountRef.current === account) setLoading(false); });
    return () => { active = false; };
  }, [accountKey, dayId, debounced, revision, token]);

  const existing = useMemo(() => new Set(day?.exercises.map((item) => item.exerciseId) ?? []), [day]);
  const choose = (exercise: Exercise) => { if (!dayId || existing.has(exercise.id)) return; addExercise(dayId, exercise); router.back(); };

  if (!day) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ProgramHeader title="Choose exercise" onBack={() => router.back()} /><ScreenState colors={colors} kind="empty" title="Workout day unavailable" actionLabel="Back to builder" onAction={() => router.replace("/programs/builder")} /></SafeAreaView>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ProgramHeader title="Choose exercise" subtitle={day.title} onBack={() => router.back()} />
      <View style={styles.searchWrap}><Ionicons name="search" size={20} color={colors.placeholder} /><TextInput testID="program-exercise-search" accessibilityLabel="Search exercises" value={query} onChangeText={setQuery} placeholder="Search by exercise name" placeholderTextColor={colors.placeholder} style={[styles.search, { color: colors.text }]} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear exercise search" onPress={() => setQuery("")} style={styles.clear}><Ionicons name="close-circle" size={20} color={colors.placeholder} /></Pressable> : null}</View>
      <Pressable testID="custom-exercise-create" accessibilityRole="button" accessibilityLabel="Create a custom exercise" onPress={() => router.push({ pathname: "/programs/custom-exercise", params: { dayId } })} style={[styles.custom, { borderColor: colors.inputBorder }]}><View style={[styles.customIcon, { backgroundColor: "rgba(0,212,255,0.12)" }]}><Ionicons name="add" size={22} color="#009FC4" /></View><View style={styles.flex}><ThemedText style={styles.customTitle}>Create custom exercise</ThemedText><ThemedText style={[styles.customCopy, { color: colors.placeholder }]}>Private to your account</ThemedText></View><Ionicons name="chevron-forward" size={20} color={colors.placeholder} /></Pressable>
      {loading ? <ScreenState colors={colors} kind="loading" title="Loading exercises…" testID="program-exercise-picker-loading" /> : error ? <ScreenState colors={colors} kind="error" title="Exercises unavailable" message={error} actionLabel="Retry" onAction={() => setRevision((value) => value + 1)} testID="program-exercise-picker-error" /> : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {items.map((exercise) => {
            const selected = existing.has(exercise.id);
            return <View key={exercise.id} style={styles.row}><View style={styles.flex}><ExerciseRow {...exercise} canFavorite={false} showFavoriteControl={false} isFavorite={false} isPressDisabled={selected} onPress={() => choose(exercise)} /></View><View importantForAccessibility="no-hide-descendants" style={[styles.selected, { backgroundColor: selected ? "#E5F8EB" : "rgba(106,79,245,0.11)" }]}><Ionicons name={selected ? "checkmark" : "add"} size={18} color={selected ? "#168A3D" : colors.primaryButton} /></View></View>;
          })}
          {items.length === 0 ? <ScreenState colors={colors} kind="empty" title="No exercises found" message="Try another term or create your own exercise." testID="program-exercise-picker-empty" /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, flex: { flex: 1 }, searchWrap: { marginHorizontal: 20, minHeight: 52, borderRadius: 17, paddingHorizontal: 14, backgroundColor: "rgba(155,161,166,0.10)", flexDirection: "row", alignItems: "center", gap: 8 }, search: { flex: 1, fontSize: 16 }, clear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  custom: { minHeight: 72, margin: 20, borderWidth: 1, borderRadius: 19, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 }, customIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" }, customTitle: { fontSize: 16, fontWeight: "800" }, customCopy: { marginTop: 3, fontSize: 12 }, list: { paddingHorizontal: 20, paddingBottom: 50 }, row: { marginBottom: 11, flexDirection: "row", alignItems: "center" }, selected: { position: "absolute", right: 16, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});
