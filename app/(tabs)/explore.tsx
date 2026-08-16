import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedButton } from "@/components/animated-button";
import { AnimatedCard } from "@/components/animated-card";
import { AnimatedSearch } from "@/components/animated-search";
import {
  ExerciseRow,
  FavoritesCard,
  FeaturedWorkoutCard,
  MuscleProgressRing,
  SplitCard,
} from "@/components/explore";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Exercise } from "@/interfaces/exercises";
import {
  favoriteExercise,
  getBodyweightPreview,
  getCardioPreview,
  getExercises,
  getWeightsPreview,
  unfavoriteExercise,
} from "@/services/exerciseService";
import { AuthContext } from "@/utils/authContext";

// Mock data for featured and splits sections
const FEATURED_WORKOUT = {
  title: "Full Body Power",
  subtitle: "Compound movements for maximum gains",
  duration: "45 min",
  calories: "320 kcal",
  badgeLabel: "TRENDING",
};

const SPLIT_CARDS = [
  {
    id: "ppl",
    title: "Push Pull Legs",
    subtitle: "6 days/week • Intermediate",
    progress: 0.3,
    gradientColors: ["#6a4ff5", "#8b5cf6"] as [string, string],
  },
  {
    id: "upper-lower",
    title: "Upper Lower",
    subtitle: "4 days/week • Beginner",
    progress: 0.5,
    gradientColors: ["#00D4FF", "#0096c7"] as [string, string],
  },
  {
    id: "full-body",
    title: "Full Body",
    subtitle: "3 days/week • All levels",
    progress: 0.7,
    gradientColors: ["#FF6B6B", "#ee5a5a"] as [string, string],
  },
];

const MUSCLE_RINGS = [
  { label: "Chest", progress: 0.65 },
  { label: "Back", progress: 0.35 },
  { label: "Legs", progress: 0.7 },
  { label: "Arms", progress: 0.15 },
];

const ExploreScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isLoggedIn, token } = useContext(AuthContext);

  // Exercise data state
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(true);
  const [exercisesError, setExercisesError] = useState<string | null>(null);

  // Favorites state
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteMutationIds, setFavoriteMutationIds] = useState<Set<string>>(
    new Set()
  );
  const favoriteIdsRef = useRef<Set<string>>(new Set());
  const favoriteMutationIdsRef = useRef<Set<string>>(new Set());
  const favoriteMutationSequenceRef = useRef(0);
  const favoriteMutationVersionsRef = useRef<Map<string, number>>(new Map());

  const updateFavorite = useCallback(
    (exerciseId: string, isFavorite: boolean) => {
      const next = new Set(favoriteIdsRef.current);
      if (isFavorite) {
        next.add(exerciseId);
      } else {
        next.delete(exerciseId);
      }
      favoriteIdsRef.current = next;
      setFavoriteIds(next);
    },
    []
  );

  const mergeResponseFavorites = useCallback(
    (exercises: Exercise[], requestMutationVersion: number) => {
      const next = new Set(favoriteIdsRef.current);
      exercises.forEach((exercise) => {
        if (favoriteMutationIdsRef.current.has(exercise.id)) return;

        const exerciseMutationVersion =
          favoriteMutationVersionsRef.current.get(exercise.id) ?? 0;
        if (exerciseMutationVersion > requestMutationVersion) return;

        if (exercise.isFavorited) {
          next.add(exercise.id);
        } else {
          next.delete(exercise.id);
        }
      });
      favoriteIdsRef.current = next;
      setFavoriteIds(next);
    },
    []
  );

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Exercise[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    favoriteIdsRef.current = new Set();
    favoriteMutationSequenceRef.current = 0;
    favoriteMutationVersionsRef.current.clear();
    setFavoriteIds(new Set());
  }, [token]);

  // Refresh catalog state whenever the screen gains focus.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadExercises() {
        try {
          setIsLoadingExercises(true);
          setExercisesError(null);
          const requestMutationVersion = favoriteMutationSequenceRef.current;
          const exercises = await getExercises({ limit: 50 }, token);
          if (!isActive) return;
          setAllExercises(exercises);
          mergeResponseFavorites(exercises, requestMutationVersion);
        } catch (err) {
          if (!isActive) return;
          console.warn("Failed to load exercises:", err);
          setExercisesError("Failed to load exercises");
        } finally {
          if (isActive) setIsLoadingExercises(false);
        }
      }
      loadExercises();

      return () => {
        isActive = false;
      };
    }, [mergeResponseFavorites, token])
  );

  // Search exercises when debounced term changes
  useEffect(() => {
    let isActive = true;

    async function searchExercises() {
      const trimmed = debouncedSearchTerm.trim();
      if (trimmed.length < 2) {
        setSearchResults([]);
        setIsSearchLoading(false);
        return;
      }
      try {
        setIsSearchLoading(true);
        const requestMutationVersion = favoriteMutationSequenceRef.current;
        const results = await getExercises({ q: trimmed, limit: 50 }, token);
        if (!isActive) return;
        setSearchResults(results);
        mergeResponseFavorites(results, requestMutationVersion);
      } catch (err) {
        if (!isActive) return;
        console.warn("Search failed:", err);
        setSearchResults([]);
      } finally {
        if (isActive) setIsSearchLoading(false);
      }
    }
    searchExercises();

    return () => {
      isActive = false;
    };
  }, [debouncedSearchTerm, mergeResponseFavorites, token]);

  // Memoized filtered lists for default layout
  const weightsExercises = useMemo(
    () => getWeightsPreview(allExercises),
    [allExercises]
  );
  const bodyweightExercises = useMemo(
    () => getBodyweightPreview(allExercises),
    [allExercises]
  );
  const cardioExercises = useMemo(
    () => getCardioPreview(allExercises),
    [allExercises]
  );

  // Navigation handlers for category screens
  const navigateToCategory = useCallback(
    (type: "weights" | "bodyweight" | "cardio") => {
      router.push({ pathname: "/explore/category", params: { type } });
    },
    [router]
  );

  // Navigation handler for favorites
  const navigateToFavorites = useCallback(() => {
    router.push("/explore/favorites");
  }, [router]);

  const navigateToExercise = useCallback(
    (exerciseId: string) => {
      router.push({ pathname: "/exercises/[id]", params: { id: exerciseId } });
    },
    [router]
  );

  // Handle favorite toggle with optimistic updates
  const handleToggleFavorite = useCallback(
    async (exerciseId: string) => {
      if (!isLoggedIn || !token) return;
      if (favoriteMutationIdsRef.current.has(exerciseId)) return;

      const wasFavorite = favoriteIdsRef.current.has(exerciseId);
      const shouldFavorite = !wasFavorite;
      const mutationVersion = ++favoriteMutationSequenceRef.current;
      favoriteMutationIdsRef.current.add(exerciseId);
      setFavoriteMutationIds(
        (current) => new Set(current).add(exerciseId)
      );
      favoriteMutationVersionsRef.current.set(exerciseId, mutationVersion);
      updateFavorite(exerciseId, shouldFavorite);

      try {
        if (shouldFavorite) {
          await favoriteExercise(exerciseId, token);
        } else {
          await unfavoriteExercise(exerciseId, token);
        }
      } catch (err) {
        console.warn("Failed to toggle favorite:", err);
        if (
          favoriteMutationVersionsRef.current.get(exerciseId) ===
          mutationVersion
        ) {
          updateFavorite(exerciseId, wasFavorite);
        }
      } finally {
        favoriteMutationIdsRef.current.delete(exerciseId);
        setFavoriteMutationIds((current) => {
          const next = new Set(current);
          next.delete(exerciseId);
          return next;
        });
        if (
          favoriteMutationVersionsRef.current.get(exerciseId) ===
          mutationVersion
        ) {
          favoriteMutationVersionsRef.current.set(
            exerciseId,
            ++favoriteMutationSequenceRef.current
          );
        }
      }
    },
    [isLoggedIn, token, updateFavorite]
  );

  // Check if we're in search mode
  const isInSearchMode = debouncedSearchTerm.trim().length >= 2;

  // Render section header with optional right element
  const renderSectionHeader = (
    title: string,
    rightElement?: React.ReactNode
  ) => (
    <View style={styles.sectionHeader}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {rightElement}
    </View>
  );

  // Render exercise list section with tappable header
  const renderExerciseSection = (
    title: string,
    exercises: Exercise[],
    categoryType: "weights" | "bodyweight" | "cardio",
    delay: number = 0
  ) => (
    <AnimatedCard style={styles.section} delay={delay} testID={`exercise-section-${categoryType}`}>
      <Pressable
        onPress={() => navigateToCategory(categoryType)}
        style={styles.exerciseSectionHeader}
      >
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
      </Pressable>
      <View style={styles.exerciseList}>
        {exercises.map((exercise) => (
          <ExerciseRow
            key={exercise.id}
            id={exercise.id}
            name={exercise.name}
            primaryMuscle={exercise.primaryMuscle}
            imageUrl={exercise.imageUrl}
            isFavorite={favoriteIds.has(exercise.id)}
            canFavorite={isLoggedIn}
            isFavoriteDisabled={favoriteMutationIds.has(exercise.id)}
            onToggleFavorite={handleToggleFavorite}
            onPress={() => navigateToExercise(exercise.id)}
          />
        ))}
      </View>
    </AnimatedCard>
  );

  // Render search results with FlatList
  const renderSearchResults = () => (
    <FlatList
      data={searchResults}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ExerciseRow
          id={item.id}
          name={item.name}
          primaryMuscle={item.primaryMuscle}
          imageUrl={item.imageUrl}
          isFavorite={favoriteIds.has(item.id)}
          canFavorite={isLoggedIn}
          isFavoriteDisabled={favoriteMutationIds.has(item.id)}
          onToggleFavorite={handleToggleFavorite}
          onPress={() => navigateToExercise(item.id)}
        />
      )}
      contentContainerStyle={styles.searchResultsContent}
      ItemSeparatorComponent={() => <View style={styles.exerciseSeparator} />}
      ListHeaderComponent={
        isSearchLoading ? (
          <View style={styles.searchLoadingHeader}>
            <ThemedText style={styles.searchLoadingText}>
              Searching...
            </ThemedText>
          </View>
        ) : null
      }
      ListEmptyComponent={
        !isSearchLoading ? (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No exercises found</ThemedText>
          </View>
        ) : null
      }
    />
  );

  // Render default Explore layout
  const renderDefaultLayout = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Featured Workouts + Favorites Section */}
      <AnimatedCard style={styles.section} delay={0}>
        {renderSectionHeader(
          "Featured Workouts",
          <Pressable style={styles.viewAllButton}>
            <ThemedText
              style={[styles.viewAllText, { color: colors.primaryButton }]}
            >
              View all
            </ThemedText>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={colors.primaryButton}
            />
          </Pressable>
        )}
        <View style={styles.quickAccessRow}>
          <FeaturedWorkoutCard
            title={FEATURED_WORKOUT.title}
            subtitle={FEATURED_WORKOUT.subtitle}
            duration={FEATURED_WORKOUT.duration}
            calories={FEATURED_WORKOUT.calories}
            badgeLabel={FEATURED_WORKOUT.badgeLabel}
            compact={true}
          />
          <FavoritesCard
            count={favoriteIds.size}
            onPress={navigateToFavorites}
          />
        </View>
      </AnimatedCard>

      {/* PrimeRep Splits Section */}
      <AnimatedCard style={styles.section} delay={100}>
        {renderSectionHeader(
          "PrimeRep Splits",
          <View
            style={[
              styles.dropdownPill,
              { backgroundColor: colors.inputBackground },
            ]}
          >
            <ThemedText style={styles.dropdownText}>Recommended</ThemedText>
            <Ionicons
              name="chevron-down"
              size={14}
              color={colors.placeholder}
            />
          </View>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.splitsCarousel}
        >
          {SPLIT_CARDS.map((split) => (
            <SplitCard
              key={split.id}
              title={split.title}
              subtitle={split.subtitle}
              progress={split.progress}
              gradientColors={split.gradientColors}
            />
          ))}
        </ScrollView>
      </AnimatedCard>

      {/* By Muscle Section */}
      <AnimatedCard style={styles.section} delay={200}>
        <ThemedText style={styles.sectionTitle}>By Muscle</ThemedText>
        <View style={styles.muscleRingsRow}>
          {MUSCLE_RINGS.map((ring) => (
            <MuscleProgressRing
              key={ring.label}
              label={ring.label}
              progress={ring.progress}
            />
          ))}
        </View>
      </AnimatedCard>

      {/* Loading state */}
      {isLoadingExercises && (
        <View style={styles.loadingState}>
          <ThemedText style={styles.loadingText}>
            Loading exercises...
          </ThemedText>
        </View>
      )}

      {/* Error state */}
      {exercisesError && !isLoadingExercises && (
        <View style={styles.errorState}>
          <ThemedText style={styles.errorText}>{exercisesError}</ThemedText>
        </View>
      )}

      {/* Weights Section */}
      {weightsExercises.length > 0 &&
        renderExerciseSection("Weights", weightsExercises, "weights", 300)}

      {/* Bodyweight Section */}
      {bodyweightExercises.length > 0 &&
        renderExerciseSection(
          "Bodyweight",
          bodyweightExercises,
          "bodyweight",
          400
        )}

      {/* Cardio Section */}
      {cardioExercises.length > 0 &&
        renderExerciseSection("Cardio", cardioExercises, "cardio", 500)}

      {/* Bottom spacing */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
          Explore
        </ThemedText>
        <AnimatedButton
          style={[styles.addButton, { backgroundColor: colors.primaryButton }]}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </AnimatedButton>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <AnimatedSearch
          placeholder="Search exercises, workouts…"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {/* Content: Search results or default layout */}
      {isInSearchMode ? renderSearchResults() : renderDefaultLayout()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  exerciseSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  dropdownPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dropdownText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: Fonts.sans,
  },
  quickAccessRow: {
    flexDirection: "row",
    gap: 12,
  },
  splitsCarousel: {
    gap: 12,
    paddingRight: 24,
  },
  muscleRingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  exerciseList: {
    gap: 10,
  },
  exerciseSeparator: {
    height: 10,
  },
  searchResultsContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  loadingState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.6,
  },
  errorState: {
    paddingVertical: 20,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#FF4B4B",
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
  },
  searchLoadingHeader: {
    paddingVertical: 12,
    alignItems: "center",
  },
  searchLoadingText: {
    fontSize: 14,
    opacity: 0.6,
  },
  bottomSpacer: {
    height: 20,
  },
});

export default ExploreScreen;
