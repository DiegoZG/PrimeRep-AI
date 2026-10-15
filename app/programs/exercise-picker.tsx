import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
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

  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  const back = <View style={styles.backBar}><Pressable testID="program-exercise-picker-back" accessibilityRole="button" accessibilityLabel="Back from Choose exercise" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color={colors.text} /></Pressable></View>;
  const heading = <View style={styles.heading}><ThemedText testID="program-exercise-picker-title" accessibilityRole="header" style={styles.headingTitle}>Choose exercise</ThemedText>{day ? <ThemedText testID="program-exercise-picker-day" style={[styles.headingDay, { color: colors.placeholder }]}>{day.title}</ThemedText> : null}</View>;
  const renderSearch = () => <View style={[styles.searchWrap, largeText && styles.searchLarge]}><Ionicons name="search" size={20} color={colors.placeholder} /><TextInput testID="program-exercise-search" accessibilityLabel="Search exercises" value={query} onChangeText={setQuery} placeholder="Search by exercise name" placeholderTextColor={colors.placeholder} style={[styles.search, { color: colors.text }]} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear exercise search" onPress={() => setQuery("")} style={styles.clear}><Ionicons name="close-circle" size={20} color={colors.placeholder} /></Pressable> : null}</View>;
  const renderCustom = () => {
    const icon = <View style={[styles.customIcon, { backgroundColor: colors.inputBackground }]}><Ionicons name="add" size={22} color={colors.text} /></View>;
    const chevron = <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />;
    return <Pressable testID="custom-exercise-create" accessibilityRole="button" accessibilityLabel="Create a custom exercise" onPress={() => router.push({ pathname: "/programs/custom-exercise", params: { dayId } })} style={[styles.custom, { borderColor: colors.inputBorder }, largeText && styles.customLarge]}>{largeText ? <View testID="program-exercise-custom-decoration" style={styles.customDecoration}>{icon}{chevron}</View> : icon}<View style={largeText ? styles.customFullCopy : styles.flex}><ThemedText style={styles.customTitle}>Create custom exercise</ThemedText><ThemedText style={[styles.customCopy, { color: colors.placeholder }]}>Private to your account</ThemedText></View>{!largeText ? chevron : null}</Pressable>;
  };
  const renderContent = () => loading ? <ScreenState colors={colors} kind="loading" title="Loading exercises…" testID="program-exercise-picker-loading" /> : error && !items.length ? <ScreenState colors={colors} kind="error" title="Exercises unavailable" message={error} actionLabel="Retry" onAction={refresh} testID="program-exercise-picker-error" /> : <>
    {items.map((exercise) => {
      const selected = existing.has(exercise.id);
      const referenceOnly = isReferenceOnlyExercise(exercise);
      return <View key={exercise.id}><View style={styles.row}><View style={styles.flex}><ExerciseRow {...exercise} canFavorite={false} showFavoriteControl={false} isFavorite={false} isPressDisabled={selected || referenceOnly} disabledReason={referenceOnly ? "Reference only — tracking not supported" : "already added"} onPress={() => choose(exercise)} /></View>{!referenceOnly ? <View importantForAccessibility="no-hide-descendants" style={[styles.selected, { backgroundColor: selected ? "#E5F8EB" : colors.inputBackground }]}><Ionicons name={selected ? "checkmark" : "add"} size={18} color={selected ? "#168A3D" : colors.text} /></View> : null}</View>{referenceOnly ? <ThemedText style={{ color: colors.placeholder, marginBottom: 12 }}>Reference only — tracking not supported</ThemedText> : null}</View>;
    })}
    {items.length === 0 ? <ScreenState colors={colors} kind="empty" title="No exercises found" message="Try another term or create your own exercise." testID="program-exercise-picker-empty" /> : null}
    <CatalogPageFooter colors={colors} loading={loadingMore} error={error} hasMore={hasMore} onLoad={loadMore} testID="program-exercise-load-more" />
  </>;

  if (!day) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>{largeText ? back : <ProgramHeader title="Choose exercise" onBack={() => router.back()} />}{largeText ? <ScrollView testID="program-exercise-picker-scroll" contentContainerStyle={styles.largeContent} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{heading}<ScreenState colors={colors} kind="empty" title="Workout day unavailable" actionLabel="Back to builder" onAction={() => router.replace("/programs/builder")} /></ScrollView> : <ScreenState colors={colors} kind="empty" title="Workout day unavailable" actionLabel="Back to builder" onAction={() => router.replace("/programs/builder")} />}</SafeAreaView>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      {largeText ? back : <ProgramHeader title="Choose exercise" subtitle={day.title} onBack={() => router.back()} />}
      {largeText ? <ScrollView testID="program-exercise-picker-scroll" style={styles.flex} contentContainerStyle={styles.largeContent} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{heading}{renderSearch()}{renderCustom()}{renderContent()}</ScrollView> : <>{renderSearch()}{renderCustom()}{loading || error && !items.length ? renderContent() : <ScrollView contentContainerStyle={styles.list} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{renderContent()}</ScrollView>}</>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, flex: { flex: 1 }, searchWrap: { marginHorizontal: 20, minHeight: 52, borderRadius: 17, paddingHorizontal: 14, backgroundColor: "rgba(155,161,166,0.10)", flexDirection: "row", alignItems: "center", gap: 8 }, search: { flex: 1, fontSize: 16 }, clear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  custom: { minHeight: 72, margin: 20, borderWidth: 1, borderRadius: 19, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 }, customIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" }, customTitle: { fontSize: 16, fontWeight: "800" }, customCopy: { marginTop: 3, fontSize: 12 }, list: { paddingHorizontal: 20, paddingBottom: 50 }, row: { marginBottom: 11, flexDirection: "row", alignItems: "center" }, selected: { position: "absolute", right: 16, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  backBar: { paddingHorizontal: 16, paddingVertical: 8 }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, largeContent: { flexGrow: 1, paddingHorizontal: 8, paddingBottom: 32 }, heading: { paddingVertical: 12, marginBottom: 12 }, headingTitle: { fontSize: 22, lineHeight: 28, fontWeight: "800" }, headingDay: { marginTop: 2, fontSize: 12 }, searchLarge: { marginHorizontal: 0 }, customLarge: { marginHorizontal: 0, paddingVertical: 14, flexDirection: "column", alignItems: "stretch" }, customDecoration: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, customFullCopy: { minWidth: 0, alignSelf: "stretch" },
});
