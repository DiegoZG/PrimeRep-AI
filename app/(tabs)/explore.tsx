import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedSearch } from "@/components/animated-search";
import { ExerciseRow, FavoritesCard } from "@/components/explore";
import { ProgramCard } from "@/components/program";
import { ScreenState } from "@/components/screen-state";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Exercise } from "@/interfaces/exercises";
import type { ActiveProgram, ActiveProgramState, ProgramSummary } from "@/interfaces/programs";
import { favoriteExercise, getExercises, getFavoriteExerciseItems, unfavoriteExercise } from "@/services/exerciseService";
import { getActiveProgram, getRecommendedPrograms, listPrograms } from "@/services/programService";
import { useExploreSearchPages } from "@/hooks/use-explore-search-pages";
import { CatalogPageFooter } from "@/components/exercises/CatalogPageFooter";
import { AuthContext } from "@/utils/authContext";
import { useProgramDraft } from "@/utils/programDraftContext";
import { todayIso } from "@/utils/programDisplay";

type SearchScope = "all" | "programs" | "exercises";

export default function ExploreScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const stateColors = { ...colors, placeholder: colors.icon };
  const footerColors = { ...stateColors, primaryButton: colors.text };
  const { fontScale } = useWindowDimensions();
  const scrollChrome = fontScale > 1.4;
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
  const { result: searchResults, loading: searching, loadingMore: searchingMore, error: searchError, load: loadSearch } = useExploreSearchPages(token, accountKey, debouncedSearch, scope);

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
    setSearchText("");
    setDebouncedSearch("");
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
    <ExploreContent scrollChrome={scrollChrome} search>
      <View style={styles.scopeRow} accessibilityRole="tablist">
        {(["all", "programs", "exercises"] as SearchScope[]).map((item) => (
          <Pressable
            key={item}
            testID={`explore-search-scope-${item}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === item }}
            onPress={() => setScope(item)}
            style={({ pressed }) => [styles.scopeChip, { borderColor: scope === item ? colors.primaryButton : colors.inputBorder, backgroundColor: colors.inputBackground, opacity: pressed ? 0.78 : 1 }]}
          >
            <ThemedText maxFontSizeMultiplier={0} style={[styles.scopeText, { color: colors.text }]}>{item[0].toUpperCase() + item.slice(1)}</ThemedText>
          </Pressable>
        ))}
      </View>
      {searching ? <ScreenState colors={stateColors} kind="loading" title="Searching…" testID="explore-search-loading" /> : searchError && !searchResults.programs.length && !searchResults.exercises.length ? (
        <ScreenState colors={stateColors} kind="error" title="Search unavailable" message={searchError} actionLabel="Retry" onAction={() => void loadSearch()} testID="explore-search-error" />
      ) : (
        <>
          {(scope === "all" || scope === "programs") && searchResults.programs.length > 0 ? <SectionTitle title="Programs" /> : null}
          {(scope === "all" || scope === "programs") && searchResults.programs.map((program) => <View key={program.id} style={styles.resultSpacing}><ProgramCard compact program={{ ...program, isActive: activePrograms.current?.templateId === program.id, isScheduled: activePrograms.scheduled?.templateId === program.id }} onPress={() => openProgram(program.id)} /></View>)}
          {(scope === "all" || scope === "programs") && searchResults.program_pagination?.has_more ? <CatalogPageFooter colors={footerColors} loading={searchingMore} error={searchError} hasMore onLoad={() => void loadSearch("programs")} testID="explore-programs-load-more" /> : null}
          {(scope === "all" || scope === "exercises") && searchResults.exercises.length > 0 ? <SectionTitle title="Exercises" /> : null}
          {(scope === "all" || scope === "exercises") && searchResults.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.resultSpacing}>
              <ExerciseRow {...exercise} canFavorite isFavorite={favoriteIds.has(exercise.id)} isFavoriteDisabled={favoriteBusy.has(exercise.id)} onToggleFavorite={toggleFavorite} onPress={() => openExercise(exercise.id)} />
            </View>
          ))}
          {(scope === "all" || scope === "exercises") && searchResults.exercise_pagination?.has_more ? <CatalogPageFooter colors={footerColors} loading={searchingMore} error={searchError} hasMore onLoad={() => void loadSearch("exercises")} testID="explore-exercises-load-more" /> : null}
          {searchResults.programs.length === 0 && searchResults.exercises.length === 0 ? <ScreenState colors={stateColors} kind="empty" title="No matches" message="Try a different program or exercise name." testID="explore-search-empty" /> : null}
        </>
      )}
    </ExploreContent>
  );

  const ownsExploreContent = contentOwnerKey === accountKey;
  const defaultContent = isLoading || !ownsExploreContent ? (
    <ScreenState colors={stateColors} kind="loading" title="Loading Explore…" testID="explore-loading" />
  ) : error ? (
    <ScreenState colors={stateColors} kind="error" title="Explore unavailable" message={error} actionLabel="Retry" onAction={() => void loadExplore()} testID="explore-error" />
  ) : (
    <ExploreContent scrollChrome={scrollChrome}>
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

      <SectionTitle title="Your programs" action={myPrograms.length > 0 ? "Build program" : undefined} onAction={buildProgram} />
      {myPrograms.length > 0 ? myPrograms.map((program) => <View key={program.id} style={styles.resultSpacing}><ProgramCard compact program={program} onPress={() => openProgram(program.id)} /></View>) : (
        <Pressable testID="program-create-empty" accessibilityRole="button" accessibilityLabel="Build your first program" onPress={buildProgram} style={({ pressed }) => [styles.emptyProgram, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, opacity: pressed ? 0.78 : 1 }]}>
          <View style={[styles.addIcon, { borderColor: colors.inputBorder }]}><Ionicons name="add" size={24} color={colors.icon} /></View>
          <View style={styles.flex}><ThemedText maxFontSizeMultiplier={0} style={styles.emptyProgramTitle}>Build your own</ThemedText><ThemedText maxFontSizeMultiplier={0} style={[styles.emptyProgramCopy, { color: colors.icon }]}>Choose the days, exercises, and set targets.</ThemedText></View>
          <Ionicons name="chevron-forward" size={20} color={colors.icon} />
        </Pressable>
      )}

      <Pressable testID="browse-programs" accessibilityRole="button" accessibilityLabel="Browse all programs" onPress={() => router.push("/programs")} style={[styles.browseButton, { backgroundColor: colors.primaryButton }]}>
        <ThemedText style={styles.browseText}>Browse programs</ThemedText><Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
      </Pressable>

      <SectionTitle title="Exercise library" />
      <FavoritesCard count={favoriteIds.size} onPress={() => router.push("/explore/favorites")} />
      <View style={styles.categoryGrid}>
        {categories.map((category) => (
          <Pressable key={category.type} testID={`exercise-category-${category.type}`} accessibilityRole="button" accessibilityLabel={`Browse ${category.label} exercises`} onPress={() => router.push({ pathname: "/explore/category", params: { type: category.type } })} style={({ pressed }) => [styles.categoryCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, opacity: pressed ? 0.78 : 1 }]}>
            <Ionicons name={category.icon} size={23} color={colors.icon} />
            <ThemedText maxFontSizeMultiplier={0} style={styles.categoryLabel}>{category.label}</ThemedText>
            <Ionicons name="chevron-forward" size={18} color={colors.icon} />
          </Pressable>
        ))}
      </View>
      {exercises.slice(0, 4).map((exercise) => <View key={exercise.id} style={styles.resultSpacing}><ExerciseRow {...exercise} canFavorite isFavorite={favoriteIds.has(exercise.id)} isFavoriteDisabled={favoriteBusy.has(exercise.id)} onToggleFavorite={toggleFavorite} onPress={() => openExercise(exercise.id)} /></View>)}
    </ExploreContent>
  );

  const chrome = (
    <>
      <View style={styles.header}>
        <ThemedText maxFontSizeMultiplier={0} style={styles.title}>Explore</ThemedText>
        {isSearchMode || isLoading || !ownsExploreContent || error || myPrograms.length > 0 ? <Pressable testID="program-create-button" accessibilityRole="button" accessibilityLabel="Build a program" onPress={buildProgram} style={({ pressed }) => [styles.headerAction, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, opacity: pressed ? 0.78 : 1 }]}><Ionicons name="add" size={24} color={colors.text} /></Pressable> : null}
      </View>
      <View style={styles.search}><AnimatedSearch testID="explore-search-input" accessibilityLabel="Search programs and exercises" placeholder="Search programs and exercises…" value={searchText} onChangeText={setSearchText} /></View>
    </>
  );
  const content = isSearchMode && ownsExploreContent ? searchContent : defaultContent;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      {scrollChrome ? (
        <ScrollView testID="explore-expanded-scroll" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          {chrome}
          {content}
        </ScrollView>
      ) : <>{chrome}{content}</>}
    </SafeAreaView>
  );
}

function ExploreContent({ children, scrollChrome, search = false }: { children: React.ReactNode; scrollChrome: boolean; search?: boolean }) {
  return scrollChrome ? <View style={styles.content}>{children}</View> : (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps={search ? "handled" : undefined} keyboardDismissMode={search ? "on-drag" : undefined}>
      {children}
    </ScrollView>
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
        <ThemedText maxFontSizeMultiplier={0} style={styles.emptyProgramTitle}>{program.templateName}</ThemedText>
        <ThemedText maxFontSizeMultiplier={0} style={[styles.emptyProgramCopy, { color: colors.icon }]}>{statusCopy}</ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
    </Pressable>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const colors = Colors[useColorScheme() ?? "light"];
  const { fontScale } = useWindowDimensions();
  const expanded = fontScale > 1.4;
  return <View style={[styles.sectionTitleRow, expanded && styles.expandedSectionRow]}><ThemedText maxFontSizeMultiplier={0} style={[styles.sectionTitle, expanded && styles.expandedSectionTitle]}>{title}</ThemedText>{action && onAction ? <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onAction} style={({ pressed }) => [styles.linkHit, { opacity: pressed ? 0.78 : 1 }]}><ThemedText maxFontSizeMultiplier={0} style={[styles.link, { color: colors.text }]}>{action}</ThemedText></Pressable> : null}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingTop: 22, paddingBottom: 8 },
  title: { flex: 1, fontSize: 34, lineHeight: 42, fontWeight: "800", fontFamily: Fonts.sans },
  headerAction: { width: 44, height: 44, borderWidth: 1, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  search: { paddingHorizontal: 24, paddingVertical: 12 }, content: { paddingHorizontal: 24, paddingBottom: 48 },
  sectionTitleRow: { minHeight: 48, marginTop: 16, marginBottom: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12 }, sectionTitle: { flexGrow: 1, flexShrink: 1, flexBasis: 180, fontSize: 20, lineHeight: 26, fontWeight: "800" },
  expandedSectionRow: { flexDirection: "column", flexWrap: "nowrap", alignItems: "stretch" }, expandedSectionTitle: { width: "100%", maxWidth: "100%", flexBasis: "auto", flexGrow: 0, flexShrink: 0 },
  linkHit: { minHeight: 44, maxWidth: "100%", justifyContent: "center" }, link: { fontWeight: "700" },
  horizontalCards: { gap: 12, paddingRight: 24, paddingBottom: 4 }, resultSpacing: { marginBottom: 12 },
  emptyProgram: { minHeight: 92, borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 13 },
  addIcon: { width: 44, height: 44, borderWidth: 1, borderRadius: 15, alignItems: "center", justifyContent: "center" }, emptyProgramTitle: { fontSize: 17, lineHeight: 23, fontWeight: "800" }, emptyProgramCopy: { marginTop: 3, fontSize: 13, lineHeight: 18 },
  browseButton: { minHeight: 52, borderRadius: 17, marginTop: 18, paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }, browseText: { flexShrink: 1, color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  categoryGrid: { marginTop: 14, marginBottom: 16, gap: 10 }, categoryCard: { minHeight: 60, borderWidth: 1, borderRadius: 17, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }, categoryLabel: { flex: 1, fontSize: 16, fontWeight: "700" },
  activeBanner: { minHeight: 74, marginTop: 8, borderWidth: 1, borderRadius: 19, paddingHorizontal: 13, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 11 }, activeIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  scopeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 6 }, scopeChip: { minHeight: 44, maxWidth: "100%", borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 8, alignItems: "center", justifyContent: "center" }, scopeText: { fontSize: 14, fontWeight: "700" },
});
