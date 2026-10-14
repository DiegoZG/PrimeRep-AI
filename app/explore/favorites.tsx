import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
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
  getFavoriteExerciseItems,
  unfavoriteExercise,
} from "@/services/exerciseService";
import { AuthContext } from "@/utils/authContext";

export default function FavoritesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isLoggedIn, token, user } = useContext(AuthContext);
  const accountKey = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const accountKeyRef = useRef(accountKey);
  accountKeyRef.current = accountKey;

  // Exercise data state
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataOwnerKey, setDataOwnerKey] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  // Favorites state
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const favoriteIdsRef = useRef<Set<string>>(new Set());
  const mutationSequenceRef = useRef(0);
  const mutationVersionsRef = useRef<Map<string, number>>(new Map());
  const mutationIdsRef = useRef<Set<string>>(new Set());
  const [mutationIds, setMutationIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    favoriteIdsRef.current = new Set();
    mutationSequenceRef.current = 0;
    mutationVersionsRef.current.clear();
    mutationIdsRef.current = new Set();
    setExercises([]);
    setDataOwnerKey(null);
    setFavoriteIds(new Set());
    setMutationIds(new Set());
    setError(null);
    setIsLoading(isLoggedIn);
    setIsRefreshing(false);
  }, [accountKey, isLoggedIn]);

  // Fetch favorite exercises
  const fetchFavorites = useCallback(
    async (showRefreshing = false) => {
      const requestId = ++requestIdRef.current;
      const requestAccountKey = accountKey;
      const requestMutationVersion = mutationSequenceRef.current;
      const isCurrentRequest = () => requestIdRef.current === requestId && accountKeyRef.current === requestAccountKey;
      if (!isLoggedIn || !token) {
        favoriteIdsRef.current = new Set();
        setExercises([]);
        setFavoriteIds(new Set());
        setIsLoading(false);
        return;
      }

      try {
        if (showRefreshing) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError(null);

        const favoriteExercises = await getFavoriteExerciseItems(token);
        if (!isCurrentRequest()) return;
        const nextFavoriteIds = new Set(favoriteExercises.map((item) => item.id));
        for (const [exerciseId, mutationVersion] of mutationVersionsRef.current) {
          if (mutationVersion <= requestMutationVersion) continue;
          if (favoriteIdsRef.current.has(exerciseId)) nextFavoriteIds.add(exerciseId);
          else nextFavoriteIds.delete(exerciseId);
        }
        favoriteIdsRef.current = nextFavoriteIds;
        setFavoriteIds(nextFavoriteIds);

        setExercises(favoriteExercises.filter((exercise) => favoriteIdsRef.current.has(exercise.id)));
        setDataOwnerKey(requestAccountKey);
      } catch (err) {
        if (!isCurrentRequest()) return;
        console.warn("Failed to load favorites:", err);
        setError("Failed to load favorites");
        setDataOwnerKey(requestAccountKey);
      } finally {
        if (isCurrentRequest()) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [accountKey, isLoggedIn, token]
  );

  // Load favorites when screen gains focus (ensures sync when navigating back)
  useFocusEffect(
    useCallback(() => {
      void fetchFavorites();
      return () => {
        requestIdRef.current += 1;
      };
    }, [fetchFavorites])
  );

  // Handle favorite toggle with optimistic updates
  const handleToggleFavorite = useCallback(
    async (exerciseId: string) => {
      if (!isLoggedIn || !token) return;
      if (mutationIdsRef.current.has(exerciseId)) return;
      const mutationAccountKey = accountKey;
      const mutationVersion = ++mutationSequenceRef.current;
      mutationVersionsRef.current.set(exerciseId, mutationVersion);
      mutationIdsRef.current.add(exerciseId);
      setMutationIds(new Set(mutationIdsRef.current));
      const favoriteSnapshot = new Set(favoriteIdsRef.current);
      const exerciseSnapshot = exercises;
      const shouldFavorite = !favoriteSnapshot.has(exerciseId);
      const optimistic = new Set(favoriteSnapshot);
      if (shouldFavorite) optimistic.add(exerciseId);
      else optimistic.delete(exerciseId);
      favoriteIdsRef.current = optimistic;
      setFavoriteIds(optimistic);
      if (!shouldFavorite) setExercises((current) => current.filter((exercise) => exercise.id !== exerciseId));

      try {
        if (shouldFavorite) {
          await favoriteExercise(exerciseId, token);
        } else {
          await unfavoriteExercise(exerciseId, token);
        }
      } catch (err) {
        if (accountKeyRef.current !== mutationAccountKey || mutationVersionsRef.current.get(exerciseId) !== mutationVersion) return;
        console.warn("Failed to toggle favorite:", err);
        favoriteIdsRef.current = favoriteSnapshot;
        setFavoriteIds(favoriteSnapshot);
        setExercises(exerciseSnapshot);
      } finally {
        if (accountKeyRef.current === mutationAccountKey && mutationVersionsRef.current.get(exerciseId) === mutationVersion) {
          mutationIdsRef.current.delete(exerciseId);
          setMutationIds(new Set(mutationIdsRef.current));
        }
      }
    },
    [accountKey, exercises, isLoggedIn, token]
  );

  // Handle pull to refresh
  const handleRefresh = useCallback(() => {
    fetchFavorites(true);
  }, [fetchFavorites]);

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
      isFavoriteDisabled={mutationIds.has(item.id)}
      onToggleFavorite={handleToggleFavorite}
      onPress={() => navigateToExercise(item.id)}
    />
  );

  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  const heading = <View style={[styles.headerTitleContainer, largeText && styles.scrollHeading]}>
    <Ionicons name="heart" size={24} color="#FF4B4B" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={largeText ? { alignSelf: "flex-start" } : undefined} />
    <ThemedText type="title" style={[styles.headerTitle, !largeText && { flex: 1 }]}>Favorites</ThemedText>
  </View>;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      {/* Header */}
      <View testID="favorites-header" style={[styles.header, largeText && styles.largeHeader]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back from favorites"
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        {!largeText && heading}
        {!largeText && <View style={styles.headerSpacer} />}
      </View>

      {/* Content */}
      {!isLoggedIn || isLoading || dataOwnerKey !== accountKey || error ? (
        <ScrollView testID="favorites-state-scroll" style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.stateScrollContent, largeText && { paddingHorizontal: 8 }]}>
          {largeText && heading}
          {!isLoggedIn ? <View style={[styles.notLoggedInContainer, largeText && { paddingHorizontal: 0 }]}>
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.notLoggedInIcon,
              { backgroundColor: colors.inputBackground },
            ]}
          >
            <Ionicons name="heart-outline" size={48} color={colors.placeholder} />
          </View>
          <ThemedText style={styles.notLoggedInTitle}>
            Sign in to save favorites
          </ThemedText>
          <ThemedText style={styles.notLoggedInSubtitle}>
            Create an account to save your favorite exercises and access them
            anytime
          </ThemedText>
        </View> : isLoading || dataOwnerKey !== accountKey ? <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryButton} />
        </View> : <View style={[styles.errorContainer, largeText && { paddingHorizontal: 0 }]}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading favorites"
            onPress={() => fetchFavorites()}
            style={[
              styles.retryButton,
              { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
            ]}
          >
            <Ionicons name="refresh" size={20} color={colors.icon} />
            <ThemedText style={[styles.retryButtonText, { color: colors.text }]}>Retry</ThemedText>
          </Pressable>
        </View>}
        </ScrollView>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={renderExerciseRow}
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.listContent, largeText && { paddingHorizontal: 8 }]}
          ListHeaderComponent={largeText ? heading : null}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primaryButton}
            />
          }
          ListEmptyComponent={
            <View style={[styles.emptyContainer, largeText && { paddingHorizontal: 0 }]}>
              <View
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.inputBackground },
                ]}
              >
                <Ionicons
                  name="heart-outline"
                  size={56}
                  color={colors.placeholder}
                />
              </View>
              <ThemedText style={styles.emptyTitle}>No favorites yet</ThemedText>
              <ThemedText style={styles.emptySubtitle}>
                Tap the heart on any exercise to add it to your favorites
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
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 24,
    minWidth: 0,
    flexShrink: 1,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  headerSpacer: {
    width: 48,
  },
  largeHeader: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  scrollHeading: {
    flex: 0,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
    marginBottom: 20,
  },
  stateScrollContent: {
    flexGrow: 1,
    paddingVertical: 20,
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
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    flexShrink: 1,
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
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    opacity: 0.6,
    textAlign: "center",
    lineHeight: 22,
  },
  notLoggedInContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  notLoggedInIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  notLoggedInTitle: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    marginBottom: 8,
    textAlign: "center",
  },
  notLoggedInSubtitle: {
    fontSize: 15,
    opacity: 0.6,
    textAlign: "center",
    lineHeight: 22,
  },
});
