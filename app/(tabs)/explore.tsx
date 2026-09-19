import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedSearch } from "@/components/animated-search";
import { ExerciseRow, FavoritesCard } from "@/components/explore";
import { ProgramCard } from "@/components/program";
import { ScreenState } from "@/components/screen-state";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Exercise } from "@/interfaces/exercises";
import type { ActiveProgram, ActiveProgramState, ExploreSearchResponse, ProgramSummary } from "@/interfaces/programs";
import { favoriteExercise, getExercises, getFavoriteExerciseItems, unfavoriteExercise } from "@/services/exerciseService";
import { getActiveProgram, getRecommendedPrograms, listPrograms, searchExplore } from "@/services/programService";
import { AuthContext } from "@/utils/authContext";
import { useProgramDraft } from "@/utils/programDraftContext";
import { todayIso } from "@/utils/programDisplay";

type SearchScope = "all" | "programs" | "exercises";
const EMPTY_SEARCH: ExploreSearchResponse = { programs: [], exercises: [] };

export default function ExploreScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { token, user } = useContext(AuthContext);
  const { resetDraft } = useProgramDraft();
  const accountKey = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const accountKeyRef = useRef(accountKey);
  accountKeyRef.current = accountKey;
  const requestIdRef = useRef(0);

  const [recommended, setRecommended] = useState<ProgramSummary[]>([]);
  const [myPrograms, setMyPrograms] = useState<ProgramSummary[]>([]);
  const [activePrograms, setActivePrograms] = useState<ActiveProgramState>({ current: null, scheduled: null });
  const [contentOwnerKey, setContentOwnerKey] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteBusy, setFavoriteBusy] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [searchResults, setSearchResults] = useState<ExploreSearchResponse>(EMPTY_SEARCH);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchRevision, setSearchRevision] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchText.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchText]);

  useEffect(() => {
    setRecommended([]);
    setMyPrograms([]);
    setActivePrograms({ current: null, scheduled: null });
    setContentOwnerKey(null);
    setExercises([]);
    setFavoriteIds(new Set());
    setSearchResults(EMPTY_SEARCH);
    setSearchText("");
    setDebouncedSearch("");
    setSearching(false);
    setSearchError(null);
    setError(null);
    setIsLoading(Boolean(token));
  }, [accountKey, token]);

  const loadExplore = useCallback(async () => {
    if (!token || !user) return;
    const requestId = ++requestIdRef.current;
    const requestAccountKey = accountKey;
    const isCurrent = () => requestId === requestIdRef.current && requestAccountKey === accountKeyRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const [suggested, mine, catalog, favorites, currentProgram] = await Promise.all([
        getRecommendedPrograms(token),
        listPrograms(token, { scope: "private", limit: 3 }),
        getExercises({ limit: 24 }, token),
        getFavoriteExerciseItems(token),
        getActiveProgram(token, todayIso()),
      ]);
      if (!isCurrent()) return;
      setRecommended(suggested.map((item) => ({
        ...item,
        isActive: currentProgram.current?.templateId === item.id,
        isScheduled: currentProgram.scheduled?.templateId === item.id,
      })));
      setMyPrograms(mine.items.map((item) => ({
        ...item,
        isActive: currentProgram.current?.templateId === item.id,
        isScheduled: currentProgram.scheduled?.templateId === item.id,
      })));
      setActivePrograms(currentProgram);
      setExercises(catalog);
      setFavoriteIds(new Set(favorites.map((item) => item.id)));
      setContentOwnerKey(requestAccountKey);
    } catch (loadError) {
      if (!isCurrent()) return;
      console.warn("Explore couldn't load", loadError);
      setContentOwnerKey(requestAccountKey);
      setError("Explore couldn’t load. Check your connection and try again.");
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [accountKey, token, user]);

  useFocusEffect(useCallback(() => {
    void loadExplore();
    return () => { requestIdRef.current += 1; };
  }, [loadExplore]));

  useEffect(() => {
    let active = true;
    const query = debouncedSearch.trim();
    if (!token || query.length < 2) {
      setSearchResults(EMPTY_SEARCH);
      setSearchError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError(null);
    const searchAccount = accountKey;
    searchExplore(token, query, scope)
      .then((result) => { if (active && accountKeyRef.current === searchAccount) setSearchResults(result); })
      .catch((searchFailure) => {
        if (!active || accountKeyRef.current !== searchAccount) return;
        console.warn("Explore search couldn't load", searchFailure);
        setSearchResults(EMPTY_SEARCH);
        setSearchError("Search couldn’t load. Try again.");
      })
      .finally(() => { if (active && accountKeyRef.current === searchAccount) setSearching(false); });
    return () => { active = false; };
  }, [accountKey, debouncedSearch, scope, searchRevision, token]);

  const openProgram = useCallback((programId: string) => router.push({ pathname: "/programs/[templateId]", params: { templateId: programId } }), [router]);
  const openExercise = useCallback((exerciseId: string) => router.push({ pathname: "/exercises/[id]", params: { id: exerciseId } }), [router]);

  const toggleFavorite = useCallback(async (exerciseId: string) => {
    if (!token || favoriteBusy.has(exerciseId)) return;
    const mutationAccount = accountKey;
    const wasFavorite = favoriteIds.has(exerciseId);
    setFavoriteBusy((current) => new Set(current).add(exerciseId));
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (wasFavorite) next.delete(exerciseId); else next.add(exerciseId);
      return next;
    });
    try {
      if (wasFavorite) await unfavoriteExercise(exerciseId, token);
      else await favoriteExercise(exerciseId, token);
    } catch {
      if (accountKeyRef.current !== mutationAccount) return;
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (wasFavorite) next.add(exerciseId); else next.delete(exerciseId);
        return next;
      });
    } finally {
      if (accountKeyRef.current !== mutationAccount) return;
      setFavoriteBusy((current) => {
        const next = new Set(current);
        next.delete(exerciseId);
        return next;
      });
    }
  }, [accountKey, favoriteBusy, favoriteIds, token]);

  const categories = useMemo(() => [
    { type: "weights", label: "Weights", icon: "barbell-outline" as const },
    { type: "bodyweight", label: "Bodyweight", icon: "body-outline" as const },
    { type: "cardio", label: "Cardio", icon: "heart-circle-outline" as const },
  ], []);

  const buildProgram = () => {
    resetDraft();
    router.push("/programs/builder");
  };

  const isSearchMode = debouncedSearch.length >= 2;

  const searchContent = (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.scopeRow} accessibilityRole="tablist">
        {(["all", "programs", "exercises"] as SearchScope[]).map((item) => (
          <Pressable
            key={item}
            testID={`explore-search-scope-${item}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === item }}
            onPress={() => setScope(item)}
            style={[styles.scopeChip, { borderColor: scope === item ? colors.primaryButton : colors.inputBorder, backgroundColor: scope === item ? "rgba(106,79,245,0.10)" : colors.inputBackground }]}
          >
            <ThemedText style={[styles.scopeText, { color: scope === item ? colors.primaryButton : colors.text }]}>{item[0].toUpperCase() + item.slice(1)}</ThemedText>
          </Pressable>
        ))}
      </View>
      {searching ? <ScreenState colors={colors} kind="loading" title="Searching…" testID="explore-search-loading" /> : searchError ? (
        <ScreenState colors={colors} kind="error" title="Search unavailable" message={searchError} actionLabel="Retry" onAction={() => setSearchRevision((value) => value + 1)} testID="explore-search-error" />
      ) : (
        <>
          {(scope === "all" || scope === "programs") && searchResults.programs.length > 0 ? <SectionTitle title="Programs" /> : null}
          {(scope === "all" || scope === "programs") && searchResults.programs.map((program) => <View key={program.id} style={styles.resultSpacing}><ProgramCard compact program={{ ...program, isActive: activePrograms.current?.templateId === program.id, isScheduled: activePrograms.scheduled?.templateId === program.id }} onPress={() => openProgram(program.id)} /></View>)}
          {(scope === "all" || scope === "exercises") && searchResults.exercises.length > 0 ? <SectionTitle title="Exercises" /> : null}
          {(scope === "all" || scope === "exercises") && searchResults.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.resultSpacing}>
              <ExerciseRow {...exercise} canFavorite isFavorite={favoriteIds.has(exercise.id)} isFavoriteDisabled={favoriteBusy.has(exercise.id)} onToggleFavorite={toggleFavorite} onPress={() => openExercise(exercise.id)} />
            </View>
          ))}
          {searchResults.programs.length === 0 && searchResults.exercises.length === 0 ? <ScreenState colors={colors} kind="empty" title="No matches" message="Try a different program or exercise name." testID="explore-search-empty" /> : null}
        </>
      )}
    </ScrollView>
  );

  const ownsExploreContent = contentOwnerKey === accountKey;
  const defaultContent = isLoading || !ownsExploreContent ? (
    <ScreenState colors={colors} kind="loading" title="Loading Explore…" testID="explore-loading" />
  ) : error ? (
    <ScreenState colors={colors} kind="error" title="Explore unavailable" message={error} actionLabel="Retry" onAction={() => void loadExplore()} testID="explore-error" />
  ) : (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {activePrograms.current ? <ProgramStatusBanner program={activePrograms.current} kind="current" colors={colors} onOpen={openProgram} onReview={(templateId) => router.push({ pathname: "/programs/activate", params: { templateId, applyMode: "now", review: "equipment" } })} /> : null}
      {activePrograms.scheduled ? <ProgramStatusBanner program={activePrograms.scheduled} kind="scheduled" colors={colors} onOpen={openProgram} onReview={(templateId) => router.push({ pathname: "/programs/activate", params: { templateId, applyMode: "next-week", review: "equipment" } })} /> : null}
      {recommended.length > 0 ? (
        <>
          <SectionTitle title="Recommended for you" action="View all" onAction={() => router.push({ pathname: "/programs", params: { recommended: "true" } })} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
            {recommended.map((program) => <ProgramCard key={program.id} program={program} onPress={() => openProgram(program.id)} />)}
          </ScrollView>
        </>
      ) : null}

      <SectionTitle title="Your programs" action="Build program" onAction={buildProgram} />
      {myPrograms.length > 0 ? myPrograms.map((program) => <View key={program.id} style={styles.resultSpacing}><ProgramCard compact program={program} onPress={() => openProgram(program.id)} /></View>) : (
        <Pressable testID="program-create-empty" accessibilityRole="button" accessibilityLabel="Build your first program" onPress={buildProgram} style={[styles.emptyProgram, { borderColor: colors.inputBorder }]}>
          <View style={[styles.addIcon, { backgroundColor: "rgba(106,79,245,0.11)" }]}><Ionicons name="add" size={24} color={colors.primaryButton} /></View>
          <View style={styles.flex}><ThemedText style={styles.emptyProgramTitle}>Build your own</ThemedText><ThemedText style={[styles.emptyProgramCopy, { color: colors.placeholder }]}>Choose the days, exercises, and set targets.</ThemedText></View>
          <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
        </Pressable>
      )}

      <Pressable testID="browse-programs" accessibilityRole="button" accessibilityLabel="Browse all programs" onPress={() => router.push("/programs")} style={[styles.browseButton, { backgroundColor: colors.primaryButton }]}>
        <ThemedText style={styles.browseText}>Browse programs</ThemedText><Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
      </Pressable>

      <SectionTitle title="Exercise library" />
      <FavoritesCard count={favoriteIds.size} onPress={() => router.push("/explore/favorites")} />
      <View style={styles.categoryGrid}>
        {categories.map((category) => (
          <Pressable key={category.type} testID={`exercise-category-${category.type}`} accessibilityRole="button" accessibilityLabel={`Browse ${category.label} exercises`} onPress={() => router.push({ pathname: "/explore/category", params: { type: category.type } })} style={[styles.categoryCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}>
            <Ionicons name={category.icon} size={23} color="#009FC4" />
            <ThemedText style={styles.categoryLabel}>{category.label}</ThemedText>
            <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
          </Pressable>
        ))}
      </View>
      {exercises.slice(0, 4).map((exercise) => <View key={exercise.id} style={styles.resultSpacing}><ExerciseRow {...exercise} canFavorite isFavorite={favoriteIds.has(exercise.id)} isFavoriteDisabled={favoriteBusy.has(exercise.id)} onToggleFavorite={toggleFavorite} onPress={() => openExercise(exercise.id)} /></View>)}
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.header}><ThemedText style={styles.title}>Explore</ThemedText><Pressable testID="program-create-button" accessibilityRole="button" accessibilityLabel="Build a program" onPress={buildProgram} style={[styles.headerAction, { backgroundColor: colors.primaryButton }]}><Ionicons name="add" size={24} color="#FFFFFF" /></Pressable></View>
      <View style={styles.search}><AnimatedSearch placeholder="Search programs and exercises…" value={searchText} onChangeText={setSearchText} /></View>
      {isSearchMode && ownsExploreContent ? searchContent : defaultContent}
    </SafeAreaView>
  );
}

function ProgramStatusBanner({
  program,
  kind,
  colors,
  onOpen,
  onReview,
}: {
  program: ActiveProgram;
  kind: "current" | "scheduled";
  colors: typeof Colors.light;
  onOpen: (templateId: string) => void;
  onReview: (templateId: string) => void;
}) {
  const needsReview = program.requiresReview;
  const statusCopy = needsReview
    ? "Equipment changed — review your program"
    : kind === "scheduled"
      ? "Starts next week"
      : "Your current program";
  const open = () => {
    if (!program.templateId) return;
    if (needsReview) onReview(program.templateId);
    else onOpen(program.templateId);
  };

  return (
    <Pressable
      testID={kind === "scheduled" ? "scheduled-program-banner" : "active-program-banner"}
      accessibilityRole="button"
      accessibilityLabel={needsReview ? `Review equipment for ${program.templateName}` : `${statusCopy}: ${program.templateName}`}
      accessibilityState={{ disabled: !program.templateId }}
      disabled={!program.templateId}
      onPress={open}
      style={[
        styles.activeBanner,
        {
          borderColor: needsReview ? "#F0A020" : colors.inputBorder,
          backgroundColor: colors.inputBackground,
        },
      ]}
    >
      <View style={[styles.activeIcon, { backgroundColor: needsReview ? "rgba(240,160,32,0.13)" : kind === "scheduled" ? "rgba(106,79,245,0.12)" : "rgba(39,196,92,0.12)" }]}>
        <Ionicons
          name={needsReview ? "alert-circle-outline" : kind === "scheduled" ? "calendar-outline" : "checkmark-circle-outline"}
          size={22}
          color={needsReview ? "#B36A00" : kind === "scheduled" ? colors.primaryButton : "#168A3D"}
        />
      </View>
      <View style={styles.flex}>
        <ThemedText style={styles.emptyProgramTitle}>{program.templateName}</ThemedText>
        <ThemedText style={[styles.emptyProgramCopy, { color: colors.placeholder }]}>{statusCopy}</ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
    </Pressable>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionTitleRow}><ThemedText style={styles.sectionTitle}>{title}</ThemedText>{action && onAction ? <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onAction} style={styles.linkHit}><ThemedText style={styles.link}>{action}</ThemedText></Pressable> : null}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingTop: 22, paddingBottom: 8 },
  title: { flex: 1, fontSize: 34, fontWeight: "800", fontFamily: Fonts.sans },
  headerAction: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  search: { paddingHorizontal: 24, paddingVertical: 12 }, content: { paddingHorizontal: 24, paddingBottom: 48 },
  sectionTitleRow: { minHeight: 48, marginTop: 14, flexDirection: "row", alignItems: "center" }, sectionTitle: { flex: 1, fontSize: 20, fontWeight: "800" },
  linkHit: { minHeight: 44, paddingLeft: 16, justifyContent: "center" }, link: { color: "#6A4FF5", fontWeight: "700" },
  horizontalCards: { gap: 12, paddingRight: 24, paddingBottom: 4 }, resultSpacing: { marginBottom: 12 },
  emptyProgram: { minHeight: 92, borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 13 },
  addIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" }, emptyProgramTitle: { fontSize: 17, fontWeight: "800" }, emptyProgramCopy: { marginTop: 3, fontSize: 13, lineHeight: 18 },
  browseButton: { minHeight: 52, borderRadius: 17, marginTop: 18, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }, browseText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  categoryGrid: { marginTop: 14, marginBottom: 16, gap: 10 }, categoryCard: { minHeight: 60, borderWidth: 1, borderRadius: 17, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }, categoryLabel: { flex: 1, fontSize: 16, fontWeight: "700" },
  activeBanner: { minHeight: 74, marginTop: 8, borderWidth: 1, borderRadius: 19, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 }, activeIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  scopeRow: { flexDirection: "row", gap: 8, paddingBottom: 6 }, scopeChip: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }, scopeText: { fontSize: 14, fontWeight: "700" },
});
