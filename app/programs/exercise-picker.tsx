import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExerciseRow } from "@/components/explore";
import { ProgramHeader } from "@/components/program";
import { ScreenState } from "@/components/screen-state";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Exercise } from "@/interfaces/exercises";
import { useExercisePages } from "@/hooks/use-exercise-pages";
import { CatalogPageFooter } from "@/components/exercises/CatalogPageFooter";
import { useProgramDraft } from "@/utils/programDraftContext";
import { isReferenceOnlyExercise } from "@/utils/exerciseTracking";

export default function ExercisePickerScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { draft, addExercise } = useProgramDraft();
  const day = draft.days.find((item) => item.localId === dayId);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const { items, loading, error, loadingMore, hasMore, loadMore, refresh } = useExercisePages(debounced);

  useEffect(() => { const timeout = setTimeout(() => setDebounced(query.trim()), 250); return () => clearTimeout(timeout); }, [query]);

  const existing = useMemo(() => new Set(day?.exercises.map((item) => item.exerciseId) ?? []), [day]);
  const choose = (exercise: Exercise) => { if (!dayId || existing.has(exercise.id) || isReferenceOnlyExercise(exercise)) return; addExercise(dayId, exercise); router.back(); };

  if (!day) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ProgramHeader title="Choose exercise" onBack={() => router.back()} /><ScreenState colors={colors} kind="empty" title="Workout day unavailable" actionLabel="Back to builder" onAction={() => router.replace("/programs/builder")} /></SafeAreaView>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ProgramHeader title="Choose exercise" subtitle={day.title} onBack={() => router.back()} />
      <View style={styles.searchWrap}><Ionicons name="search" size={20} color={colors.placeholder} /><TextInput testID="program-exercise-search" accessibilityLabel="Search exercises" value={query} onChangeText={setQuery} placeholder="Search by exercise name" placeholderTextColor={colors.placeholder} style={[styles.search, { color: colors.text }]} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear exercise search" onPress={() => setQuery("")} style={styles.clear}><Ionicons name="close-circle" size={20} color={colors.placeholder} /></Pressable> : null}</View>
      <Pressable testID="custom-exercise-create" accessibilityRole="button" accessibilityLabel="Create a custom exercise" onPress={() => router.push({ pathname: "/programs/custom-exercise", params: { dayId } })} style={[styles.custom, { borderColor: colors.inputBorder }]}><View style={[styles.customIcon, { backgroundColor: "rgba(0,212,255,0.12)" }]}><Ionicons name="add" size={22} color="#009FC4" /></View><View style={styles.flex}><ThemedText style={styles.customTitle}>Create custom exercise</ThemedText><ThemedText style={[styles.customCopy, { color: colors.placeholder }]}>Private to your account</ThemedText></View><Ionicons name="chevron-forward" size={20} color={colors.placeholder} /></Pressable>
      {loading ? <ScreenState colors={colors} kind="loading" title="Loading exercises…" testID="program-exercise-picker-loading" /> : error && !items.length ? <ScreenState colors={colors} kind="error" title="Exercises unavailable" message={error} actionLabel="Retry" onAction={refresh} testID="program-exercise-picker-error" /> : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {items.map((exercise) => {
            const selected = existing.has(exercise.id);
            const referenceOnly = isReferenceOnlyExercise(exercise);
            return <View key={exercise.id}><View style={styles.row}><View style={styles.flex}><ExerciseRow {...exercise} canFavorite={false} showFavoriteControl={false} isFavorite={false} isPressDisabled={selected || referenceOnly} disabledReason={referenceOnly ? "Reference only — tracking not supported" : "already added"} onPress={() => choose(exercise)} /></View>{!referenceOnly ? <View importantForAccessibility="no-hide-descendants" style={[styles.selected, { backgroundColor: selected ? "#E5F8EB" : "rgba(106,79,245,0.11)" }]}><Ionicons name={selected ? "checkmark" : "add"} size={18} color={selected ? "#168A3D" : colors.primaryButton} /></View> : null}</View>{referenceOnly ? <ThemedText style={{ color: colors.placeholder, marginBottom: 12 }}>Reference only — tracking not supported</ThemedText> : null}</View>;
          })}
          {items.length === 0 ? <ScreenState colors={colors} kind="empty" title="No exercises found" message="Try another term or create your own exercise." testID="program-exercise-picker-empty" /> : null}
          <CatalogPageFooter colors={colors} loading={loadingMore} error={error} hasMore={hasMore} onLoad={loadMore} testID="program-exercise-load-more" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, flex: { flex: 1 }, searchWrap: { marginHorizontal: 20, minHeight: 52, borderRadius: 17, paddingHorizontal: 14, backgroundColor: "rgba(155,161,166,0.10)", flexDirection: "row", alignItems: "center", gap: 8 }, search: { flex: 1, fontSize: 16 }, clear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  custom: { minHeight: 72, margin: 20, borderWidth: 1, borderRadius: 19, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 }, customIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" }, customTitle: { fontSize: 16, fontWeight: "800" }, customCopy: { marginTop: 3, fontSize: 12 }, list: { paddingHorizontal: 20, paddingBottom: 50 }, row: { marginBottom: 11, flexDirection: "row", alignItems: "center" }, selected: { position: "absolute", right: 16, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});
