import { Ionicons } from "@expo/vector-icons";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedButton } from "@/components/animated-button";
import { AnimatedCard } from "@/components/animated-card";
import { AnimatedSearch } from "@/components/animated-search";
import {
  ExerciseRow,
  FeaturedWorkoutCard,
  MuscleProgressRing,
  SplitCard,
} from "@/components/explore";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  Exercise,
  favoriteExercise,
  getBodyweightPreview,
  getExercises,
  getFavoriteExercises,
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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isLoggedIn, token } = useContext(AuthContext);

  // Exercise data state
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(true);
  const [exercisesError, setExercisesError] = useState<string | null>(null);

  // Favorites state
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Exercise[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load exercises on mount
  useEffect(() => {
    async function loadExercises() {
      try {
        setIsLoadingExercises(true);
        setExercisesError(null);
        const exercises = await getExercises({ limit: 50 });
        setAllExercises(exercises);
      } catch (err) {
        console.warn("Failed to load exercises:", err);
        setExercisesError("Failed to load exercises");
      } finally {
        setIsLoadingExercises(false);
      }
    }
    loadExercises();
  }, []);

  // Load favorites when auth is ready (independent of exercises)
  useEffect(() => {
    async function loadFavorites() {
      if (!isLoggedIn || !token) {
        setFavoriteIds(new Set());
        return;
      }
      try {
        setIsLoadingFavorites(true);
        const ids = await getFavoriteExercises(token);
        setFavoriteIds(new Set(ids));
      } catch (err) {
        console.warn("Failed to load favorites:", err);
      } finally {
        setIsLoadingFavorites(false);
      }
    }
    loadFavorites();
  }, [isLoggedIn, token]);

  // Search exercises when debounced term changes
  useEffect(() => {
    async function searchExercises() {
      const trimmed = debouncedSearchTerm.trim();
      if (trimmed.length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      try {
        setIsSearching(true);
        const results = await getExercises({ q: trimmed, limit: 50 });
        setSearchResults(results);
      } catch (err) {
        console.warn("Search failed:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }
    searchExercises();
  }, [debouncedSearchTerm]);

  // Memoized filtered lists for default layout
  const weightsExercises = useMemo(
    () => getWeightsPreview(allExercises),
    [allExercises]
  );
  const bodyweightExercises = useMemo(
    () => getBodyweightPreview(allExercises),
    [allExercises]
  );

  // Handle favorite toggle with optimistic updates
  const handleToggleFavorite = useCallback(
    async (exerciseId: string) => {
      if (!isLoggedIn || !token) return;

      const wasInFavorites = favoriteIds.has(exerciseId);
      const snapshot = new Set(favoriteIds);

      // Optimistic update
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasInFavorites) {
          next.delete(exerciseId);
        } else {
          next.add(exerciseId);
        }
        return next;
      });

      try {
        if (wasInFavorites) {
          await unfavoriteExercise(exerciseId, token);
        } else {
          await favoriteExercise(exerciseId, token);
        }
      } catch (err) {
        console.warn("Failed to toggle favorite:", err);
        // Revert to snapshot on error
        setFavoriteIds(snapshot);
      }
    },
    [isLoggedIn, token, favoriteIds]
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

  // Render exercise list section with chevron
  const renderExerciseSection = (
    title: string,
    exercises: Exercise[],
    delay: number = 0,
    onViewAll?: () => void
  ) => (
    <AnimatedCard style={styles.section} delay={delay}>
      <Pressable onPress={onViewAll} style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        <View style={styles.sectionChevron}>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.placeholder}
          />
        </View>
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
            onToggleFavorite={handleToggleFavorite}
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
          onToggleFavorite={handleToggleFavorite}
        />
      )}
      contentContainerStyle={styles.searchResultsContent}
      ItemSeparatorComponent={() => <View style={styles.exerciseSeparator} />}
      ListEmptyComponent={
        isSearching ? (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>Searching...</ThemedText>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No exercises found</ThemedText>
          </View>
        )
      }
    />
  );

  // Render default Explore layout
  const renderDefaultLayout = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Featured Workouts Section */}
      <AnimatedCard style={styles.section} delay={0}>
        {renderSectionHeader(
          "Featured Workouts",
          <Pressable style={styles.viewAllButton}>
            <Text style={[styles.viewAllText, { color: colors.primaryButton }]}>
              View all
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={colors.primaryButton}
            />
          </Pressable>
        )}
        <FeaturedWorkoutCard
          title={FEATURED_WORKOUT.title}
          subtitle={FEATURED_WORKOUT.subtitle}
          duration={FEATURED_WORKOUT.duration}
          calories={FEATURED_WORKOUT.calories}
          badgeLabel={FEATURED_WORKOUT.badgeLabel}
        />
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
            <Text style={[styles.dropdownText, { color: colors.text }]}>
              Recommended
            </Text>
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
        renderExerciseSection("Weights", weightsExercises, 300)}

      {/* Bodyweight Section */}
      {bodyweightExercises.length > 0 &&
        renderExerciseSection("Bodyweight", bodyweightExercises, 400)}

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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  sectionChevron: {
    paddingLeft: 8,
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
  bottomSpacer: {
    height: 20,
  },
});

export default ExploreScreen;
