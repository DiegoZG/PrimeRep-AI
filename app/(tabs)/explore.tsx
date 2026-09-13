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

import { AnimatedCard } from "@/components/animated-card";
import { AnimatedSearch } from "@/components/animated-search";
import {
  ExerciseRow,
  FavoritesCard,
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

const ExploreScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isLoggedIn, token, user } = useContext(AuthContext);

  // Exercise data state
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(true);
  const [exercisesError, setExercisesError] = useState<string | null>(null);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const catalogRequestIdRef = useRef(0);
  const catalogRevisionRef = useRef(catalogRevision);
  catalogRevisionRef.current = catalogRevision;
  const accountKey = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const accountKeyRef = useRef(accountKey);
  accountKeyRef.current = accountKey;

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
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchRevision, setSearchRevision] = useState(0);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    favoriteIdsRef.current = new Set();
    favoriteMutationIdsRef.current = new Set();
    favoriteMutationSequenceRef.current = 0;
    favoriteMutationVersionsRef.current.clear();
    setFavoriteIds(new Set());
    setFavoriteMutationIds(new Set());
    setAllExercises([]);
    setSearchResults([]);
    setExercisesError(null);
    setSearchError(null);
    setFavoriteError(null);
  }, [accountKey]);

  // Refresh catalog state whenever the screen gains focus.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const requestId = ++catalogRequestIdRef.current;
      const requestAccountKey = accountKey;
      const requestRevision = catalogRevision;
      const requestMutationVersion = favoriteMutationSequenceRef.current;

      const isCurrentRequest = () =>
        !cancelled &&
        catalogRequestIdRef.current === requestId &&
        catalogRevisionRef.current === requestRevision &&
        accountKeyRef.current === requestAccountKey;

      async function loadExercises() {
        try {
          setIsLoadingExercises(true);
          setExercisesError(null);
          const exercises = await getExercises({ limit: 50 }, token);
          if (!isCurrentRequest()) return;
          setAllExercises(exercises);
          mergeResponseFavorites(exercises, requestMutationVersion);
        } catch (err) {
          if (!isCurrentRequest()) return;
          console.warn("Failed to load exercises:", err);
          setExercisesError("Exercises couldn't load. Check your connection and try again.");
        } finally {
          if (isCurrentRequest()) setIsLoadingExercises(false);
        }
      }
      void loadExercises();

      return () => {
        cancelled = true;
      };
    }, [accountKey, catalogRevision, mergeResponseFavorites, token])
  );

  // Search exercises when debounced term changes
  useEffect(() => {
    let isActive = true;

    async function searchExercises() {
      const trimmed = debouncedSearchTerm.trim();
      if (trimmed.length < 2) {
        setSearchResults([]);
        setIsSearchLoading(false);
        setSearchError(null);
        return;
      }
      try {
        setIsSearchLoading(true);
        setSearchError(null);
        const requestMutationVersion = favoriteMutationSequenceRef.current;
        const results = await getExercises({ q: trimmed, limit: 50 }, token);
        if (!isActive) return;
        setSearchResults(results);
        mergeResponseFavorites(results, requestMutationVersion);
      } catch (err) {
        if (!isActive) return;
        console.warn("Search failed:", err);
        setSearchResults([]);
        setSearchError("Search couldn't load. Check your connection and try again.");
      } finally {
        if (isActive) setIsSearchLoading(false);
      }
    }
    searchExercises();

    return () => {
      isActive = false;
    };
  }, [debouncedSearchTerm, mergeResponseFavorites, searchRevision, token]);

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

      const mutationAccountKey = accountKey;
      const wasFavorite = favoriteIdsRef.current.has(exerciseId);
      const shouldFavorite = !wasFavorite;
      setFavoriteError(null);
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
        if (accountKeyRef.current !== mutationAccountKey || favoriteMutationVersionsRef.current.get(exerciseId) !== mutationVersion) return;
        console.warn("Failed to toggle favorite:", err);
        updateFavorite(exerciseId, wasFavorite);
        setFavoriteError("Favorite wasn't updated. Try again.");
      } finally {
        if (accountKeyRef.current === mutationAccountKey && favoriteMutationVersionsRef.current.get(exerciseId) === mutationVersion) {
          favoriteMutationIdsRef.current.delete(exerciseId);
          setFavoriteMutationIds((current) => {
            const next = new Set(current);
            next.delete(exerciseId);
            return next;
          });
          favoriteMutationVersionsRef.current.set(
            exerciseId,
            ++favoriteMutationSequenceRef.current
          );
        }
      }
    },
    [accountKey, isLoggedIn, token, updateFavorite]
  );

  // Check if we're in search mode
  const isInSearchMode = debouncedSearchTerm.trim().length >= 2;

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
        searchError ? (
          <View style={styles.emptyState}>
            <ThemedText accessibilityRole="alert" style={styles.errorText}>{searchError}</ThemedText>
            <Pressable accessibilityRole="button" accessibilityLabel="Retry exercise search" onPress={() => setSearchRevision((value) => value + 1)} style={[styles.retryButton, { backgroundColor: colors.primaryButton }]}><ThemedText style={styles.retryText}>Retry</ThemedText></Pressable>
          </View>
        ) : !isSearchLoading ? (
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
      {/* Only backend-backed library surfaces live here until templates ship. */}
      <AnimatedCard style={styles.section} delay={0}>
        <ThemedText style={styles.sectionTitle}>Your library</ThemedText>
        <View style={styles.libraryRow}>
          <FavoritesCard
            count={favoriteIds.size}
            onPress={navigateToFavorites}
          />
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
          <ThemedText accessibilityRole="alert" style={styles.errorText}>{exercisesError}</ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry loading exercises" onPress={() => setCatalogRevision((revision) => revision + 1)} style={[styles.retryButton, { backgroundColor: colors.primaryButton }]}>
            <ThemedText style={styles.retryText}>Retry</ThemedText>
          </Pressable>
        </View>
      )}

      {!isLoadingExercises && !exercisesError && allExercises.length === 0 ? (
        <View style={styles.emptyState}><ThemedText style={styles.emptyText}>No exercises are available yet.</ThemedText></View>
      ) : null}

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
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <AnimatedSearch
          placeholder="Search exercises…"
          value={searchTerm}
          onChangeText={(value) => { setSearchTerm(value); setSearchError(null); }}
        />
        {favoriteError ? <ThemedText accessibilityRole="alert" style={styles.favoriteError}>{favoriteError}</ThemedText> : null}
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
  libraryRow: { marginTop: 16, alignItems: "flex-start" },
  retryButton: { minHeight: 44, paddingHorizontal: 22, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 14 },
  retryText: { color: "#FFFFFF", fontWeight: "700" },
  favoriteError: { color: "#D92D20", fontSize: 13, marginTop: 8 },
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
