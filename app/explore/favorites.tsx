import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useContext, useState } from "react";
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
  getExercises,
  getFavoriteExercises,
  unfavoriteExercise,
} from "@/services/exerciseService";
import { AuthContext } from "@/utils/authContext";

export default function FavoritesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isLoggedIn, token } = useContext(AuthContext);

  // Exercise data state
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Favorites state
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Fetch favorite exercises
  const fetchFavorites = useCallback(
    async (showRefreshing = false) => {
      if (!isLoggedIn || !token) {
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

        // Get favorite IDs first
        const ids = await getFavoriteExercises(token);
        setFavoriteIds(new Set(ids));

        if (ids.length === 0) {
          setExercises([]);
          return;
        }

        // Fetch all exercises and filter to favorites
        const allExercises = await getExercises({ limit: 200 });
        const favoriteExercises = allExercises.filter((e) => ids.includes(e.id));
        setExercises(favoriteExercises);
      } catch (err) {
        console.warn("Failed to load favorites:", err);
        setError("Failed to load favorites");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isLoggedIn, token]
  );

  // Load favorites when screen gains focus (ensures sync when navigating back)
  useFocusEffect(
    useCallback(() => {
      fetchFavorites();
    }, [fetchFavorites])
  );

  // Handle favorite toggle with optimistic updates
  const handleToggleFavorite = useCallback(
    async (exerciseId: string) => {
      if (!isLoggedIn || !token) return;

      const state = {
        action: "favorite" as "favorite" | "unfavorite",
        snapshot: null as Set<string> | null,
      };

      setFavoriteIds((prev) => {
        state.snapshot = new Set(prev);
        const next = new Set(prev);
        if (next.has(exerciseId)) {
          next.delete(exerciseId);
          state.action = "unfavorite";
        } else {
          next.add(exerciseId);
          state.action = "favorite";
        }
        return next;
      });

      // If unfavoriting, remove from list immediately
      if (state.action === "unfavorite") {
        setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
      }

      try {
        if (state.action === "unfavorite") {
          await unfavoriteExercise(exerciseId, token);
        } else {
          await favoriteExercise(exerciseId, token);
        }
      } catch (err) {
        console.warn("Failed to toggle favorite:", err);
        if (state.snapshot) {
          setFavoriteIds(state.snapshot);
        }
        // Refetch to restore list
        fetchFavorites();
      }
    },
    [isLoggedIn, token, fetchFavorites]
  );

  // Handle pull to refresh
  const handleRefresh = useCallback(() => {
    fetchFavorites(true);
  }, [fetchFavorites]);

  // Render exercise row
  const renderExerciseRow = ({ item }: { item: Exercise }) => (
    <ExerciseRow
      id={item.id}
      name={item.name}
      primaryMuscle={item.primaryMuscle}
      imageUrl={item.imageUrl}
      isFavorite={favoriteIds.has(item.id)}
      canFavorite={isLoggedIn}
      onToggleFavorite={handleToggleFavorite}
    />
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="heart" size={24} color="#FF4B4B" />
          <ThemedText type="title" style={styles.headerTitle}>
            Favorites
          </ThemedText>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {!isLoggedIn ? (
        <View style={styles.notLoggedInContainer}>
          <View
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
        </View>
      ) : isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryButton} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable
            onPress={() => fetchFavorites()}
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
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primaryButton}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View
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
                Tap the + button on any exercise to add it to your favorites
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
  headerTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
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
  },
  notLoggedInSubtitle: {
    fontSize: 15,
    opacity: 0.6,
    textAlign: "center",
    lineHeight: 22,
  },
});

