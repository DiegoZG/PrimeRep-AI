import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useState } from "react";
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
  getExercisesByTypes,
  getFavoriteExercises,
  unfavoriteExercise,
} from "@/services/exerciseService";
import { AuthContext } from "@/utils/authContext";

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
  const { isLoggedIn, token } = useContext(AuthContext);

  // Exercise data state
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Favorites state
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Fetch exercises based on category type
  const fetchExercises = useCallback(
    async (showRefreshing = false) => {
      try {
        if (showRefreshing) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError(null);

        let result: Exercise[];

        switch (categoryType) {
          case "weights":
            // Fetch both strength and accessory types
            result = await getExercisesByTypes(["strength", "accessory"], {
              limit: 100,
            });
            break;
          case "bodyweight":
            result = await getExercises({ type: "bodyweight", limit: 100 });
            break;
          case "cardio":
            result = await getExercises({ type: "cardio", limit: 100 });
            break;
          default:
            result = [];
        }

        setExercises(result);
      } catch (err) {
        console.warn("Failed to load exercises:", err);
        setError("Failed to load exercises");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [categoryType]
  );

  // Load exercises on mount
  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  // Load favorites when screen gains focus (ensures sync when navigating back)
  useFocusEffect(
    useCallback(() => {
      async function loadFavorites() {
        if (!isLoggedIn || !token) {
          setFavoriteIds(new Set());
          return;
        }
        try {
          const ids = await getFavoriteExercises(token);
          setFavoriteIds(new Set(ids));
        } catch (err) {
          console.warn("Failed to load favorites:", err);
        }
      }
      loadFavorites();
    }, [isLoggedIn, token])
  );

  // Handle favorite toggle with optimistic updates
  const handleToggleFavorite = useCallback(
    async (exerciseId: string) => {
      if (!isLoggedIn || !token) return;

      // Use object to track action and snapshot to avoid stale closure issues
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

      try {
        if (state.action === "unfavorite") {
          await unfavoriteExercise(exerciseId, token);
        } else {
          await favoriteExercise(exerciseId, token);
        }
      } catch (err) {
        console.warn("Failed to toggle favorite:", err);
        // Revert to snapshot on error
        if (state.snapshot) {
          setFavoriteIds(state.snapshot);
        }
      }
    },
    [isLoggedIn, token]
  );

  // Handle pull to refresh
  const handleRefresh = useCallback(() => {
    fetchExercises(true);
  }, [fetchExercises]);

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

  const title = CATEGORY_TITLES[categoryType] || "Exercises";

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
      ) : error ? (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable
            onPress={() => fetchExercises()}
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
