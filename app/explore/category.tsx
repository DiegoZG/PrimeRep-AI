import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExerciseRow } from "@/components/explore";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Exercise } from "@/interfaces/exercises";
import {
  favoriteExercise,
  getFavoriteExercises,
  unfavoriteExercise,
} from "@/services/exerciseService";
import { AuthContext } from "@/utils/authContext";
import { useExercisePages } from "@/hooks/use-exercise-pages";
import { CatalogPageFooter } from "@/components/exercises/CatalogPageFooter";

type CategoryType = "weights" | "bodyweight" | "cardio";

const CATEGORY_TITLES: Record<CategoryType, string> = {
  weights: "Weights",
  bodyweight: "Bodyweight",
  cardio: "Cardio",
};

export default function CategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type: CategoryType }>();
  const categoryType = params.type || "weights";

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isLoggedIn, token, user } = useContext(AuthContext);
  const accountKey = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const accountKeyRef = useRef(accountKey);
  accountKeyRef.current = accountKey;

  // Exercise data state
  const { items: exercises, loading: isLoading, refreshing, error, loadingMore, hasMore, loadMore, refresh, retry } = useExercisePages("", categoryType === "weights" ? ["strength", "accessory"] : [categoryType]);

  // Favorites state
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const favoriteIdsRef = useRef<Set<string>>(new Set());
  const favoriteRequestIdRef = useRef(0);
  const favoriteMutationSequenceRef = useRef(0);
  const favoriteMutationVersionsRef = useRef<Map<string, number>>(new Map());
  const favoriteMutationIdsRef = useRef<Set<string>>(new Set());
  const [favoriteMutationIds, setFavoriteMutationIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    favoriteIdsRef.current = new Set();
    favoriteMutationSequenceRef.current = 0;
    favoriteMutationVersionsRef.current.clear();
    favoriteMutationIdsRef.current = new Set();
    setFavoriteIds(new Set());
    setFavoriteMutationIds(new Set());
  }, [accountKey]);

  // Load favorites when screen gains focus (ensures sync when navigating back)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const requestId = ++favoriteRequestIdRef.current;
      const requestAccountKey = accountKey;
      const requestMutationVersion = favoriteMutationSequenceRef.current;
      async function loadFavorites() {
        if (!isLoggedIn || !token) {
          favoriteIdsRef.current = new Set();
          setFavoriteIds(new Set());
          return;
        }
        try {
          const ids = await getFavoriteExercises(token);
          if (cancelled || favoriteRequestIdRef.current !== requestId || accountKeyRef.current !== requestAccountKey) return;
          const next = new Set(ids);
          for (const [exerciseId, mutationVersion] of favoriteMutationVersionsRef.current) {
            if (mutationVersion <= requestMutationVersion) continue;
            if (favoriteIdsRef.current.has(exerciseId)) next.add(exerciseId);
            else next.delete(exerciseId);
          }
          favoriteIdsRef.current = next;
          setFavoriteIds(next);
        } catch (err) {
          if (cancelled || favoriteRequestIdRef.current !== requestId || accountKeyRef.current !== requestAccountKey) return;
          console.warn("Failed to load favorites:", err);
        }
      }
      void loadFavorites();
      return () => {
        cancelled = true;
      };
    }, [accountKey, isLoggedIn, token])
  );

  // Handle favorite toggle with optimistic updates
  const handleToggleFavorite = useCallback(
    async (exerciseId: string) => {
      if (!isLoggedIn || !token) return;
      if (favoriteMutationIdsRef.current.has(exerciseId)) return;
      const mutationAccountKey = accountKey;
      const mutationVersion = ++favoriteMutationSequenceRef.current;
      favoriteMutationVersionsRef.current.set(exerciseId, mutationVersion);
      favoriteMutationIdsRef.current.add(exerciseId);
      setFavoriteMutationIds(new Set(favoriteMutationIdsRef.current));
      const snapshot = new Set(favoriteIdsRef.current);
      const shouldFavorite = !snapshot.has(exerciseId);
      const optimistic = new Set(snapshot);
      if (shouldFavorite) optimistic.add(exerciseId);
      else optimistic.delete(exerciseId);
      favoriteIdsRef.current = optimistic;
      setFavoriteIds(optimistic);

      try {
        if (shouldFavorite) {
          await favoriteExercise(exerciseId, token);
        } else {
          await unfavoriteExercise(exerciseId, token);
        }
      } catch (err) {
        if (accountKeyRef.current !== mutationAccountKey || favoriteMutationVersionsRef.current.get(exerciseId) !== mutationVersion) return;
        console.warn("Failed to toggle favorite:", err);
        favoriteIdsRef.current = snapshot;
        setFavoriteIds(snapshot);
      } finally {
        if (accountKeyRef.current === mutationAccountKey && favoriteMutationVersionsRef.current.get(exerciseId) === mutationVersion) {
          favoriteMutationIdsRef.current.delete(exerciseId);
          setFavoriteMutationIds(new Set(favoriteMutationIdsRef.current));
        }
      }
    },
    [accountKey, isLoggedIn, token]
  );

  const navigateToExercise = useCallback(
    (exerciseId: string) => {
      router.push({ pathname: "/exercises/[id]", params: { id: exerciseId } });
    },
    [router]
  );

  // Render exercise row
  const renderExerciseRow = ({ item }: { item: Exercise }) => (
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
  );

  const title = CATEGORY_TITLES[categoryType] || "Exercises";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back from exercise category"
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>
          {title}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryButton} />
        </View>
      ) : error && !exercises.length ? (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable
            onPress={refresh}
            style={[
              styles.retryButton,
              { backgroundColor: colors.primaryButton },
            ]}
          >
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={renderExerciseRow}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primaryButton}
            />
          }
          ListFooterComponent={<CatalogPageFooter colors={colors} loading={loadingMore || refreshing} error={error} hasMore={hasMore} onLoad={error ? retry : loadMore} testID="category-exercise-load-more" />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>
                No exercises found
              </ThemedText>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  headerSpacer: {
    width: 48,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    opacity: 0.7,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
  },
});
