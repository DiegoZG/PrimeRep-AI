import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useContext, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExerciseRow } from "@/components/explore";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Workout, WorkoutBlock, WorkoutItem } from "@/interfaces/workouts";
import {
  favoriteExercise,
  getFavoriteExercises,
  unfavoriteExercise,
} from "@/services/exerciseService";
import { getNextWorkout } from "@/services/workoutService";
import { AuthContext } from "@/utils/authContext";

// Block type display names
const BLOCK_TYPE_LABELS: Record<string, string> = {
  main: "Main Lifts",
  accessory: "Accessories",
  finisher: "Finisher",
};

// Section data type for SectionList
interface WorkoutSection {
  title: string;
  blockType: string;
  data: WorkoutItem[];
}

export default function TodayWorkoutScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { token, isLoggedIn } = useContext(AuthContext);

  // Workout state
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Favorites state
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Fetch workout
  const fetchWorkout = useCallback(
    async (force = false, showRefreshing = false) => {
      if (!token) {
        setError("Authentication required");
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

        const data = await getNextWorkout(token, force ? { force: true } : undefined);
        setWorkout(data);
      } catch (err: any) {
        console.warn("Failed to load workout:", err);
        setError(err?.message || "Failed to load workout");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  // Load favorites when screen gains focus
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

  // Initial fetch
  useFocusEffect(
    useCallback(() => {
      if (!workout) {
        fetchWorkout();
      }
    }, [fetchWorkout, workout])
  );

  // Handle pull-to-refresh (regenerate workout)
  const handleRefresh = useCallback(() => {
    fetchWorkout(true, true);
  }, [fetchWorkout]);

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
      }
    },
    [isLoggedIn, token]
  );

  // Navigate to exercise detail
  const handleExercisePress = useCallback(
    (exerciseId: string) => {
      router.push({ pathname: "/exercises/[id]", params: { id: exerciseId } });
    },
    [router]
  );

  // Transform workout blocks to sections
  const sections: WorkoutSection[] = workout
    ? workout.blocks.map((block) => ({
        title: BLOCK_TYPE_LABELS[block.blockType] || block.blockType,
        blockType: block.blockType,
        data: block.items,
      }))
    : [];

  // Render section header
  const renderSectionHeader = ({
    section,
  }: {
    section: WorkoutSection;
  }) => (
    <View style={styles.sectionHeader}>
      <ThemedText type="subtitle" style={styles.sectionTitle}>
        {section.title}
      </ThemedText>
      <View
        style={[
          styles.sectionBadge,
          { backgroundColor: colors.inputBackground },
        ]}
      >
        <Text style={[styles.sectionBadgeText, { color: colors.placeholder }]}>
          {section.data.length} {section.data.length === 1 ? "exercise" : "exercises"}
        </Text>
      </View>
    </View>
  );

  // Render workout item with prescription info
  const renderWorkoutItem = ({ item }: { item: WorkoutItem }) => (
    <View style={styles.workoutItemContainer}>
      <ExerciseRow
        id={item.exercise.id}
        name={item.exercise.name}
        primaryMuscle={item.exercise.primaryMuscle}
        imageUrl={item.exercise.imageUrl}
        isFavorite={favoriteIds.has(item.exercise.id)}
        canFavorite={isLoggedIn}
        onToggleFavorite={handleToggleFavorite}
        onPress={() => handleExercisePress(item.exercise.id)}
      />
      {/* Prescription info */}
      <View style={styles.prescriptionContainer}>
        <View style={styles.prescriptionItem}>
          <Text style={[styles.prescriptionLabel, { color: colors.placeholder }]}>
            Sets
          </Text>
          <Text style={[styles.prescriptionValue, { color: colors.text }]}>
            {item.prescription.sets}
          </Text>
        </View>
        <View style={styles.prescriptionDivider} />
        <View style={styles.prescriptionItem}>
          <Text style={[styles.prescriptionLabel, { color: colors.placeholder }]}>
            Reps
          </Text>
          <Text style={[styles.prescriptionValue, { color: colors.text }]}>
            {item.prescription.reps}
          </Text>
        </View>
        <View style={styles.prescriptionDivider} />
        <View style={styles.prescriptionItem}>
          <Text style={[styles.prescriptionLabel, { color: colors.placeholder }]}>
            Rest
          </Text>
          <Text style={[styles.prescriptionValue, { color: colors.text }]}>
            {item.prescription.restSeconds}s
          </Text>
        </View>
      </View>
    </View>
  );

  // Render footer with regenerate hint
  const renderFooter = () => (
    <View style={styles.footer}>
      <View style={styles.hintContainer}>
        <Ionicons name="refresh-outline" size={16} color={colors.placeholder} />
        <Text style={[styles.hintText, { color: colors.placeholder }]}>
          Pull down to generate a new workout
        </Text>
      </View>
    </View>
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
          <ThemedText type="title" style={styles.headerTitle}>
            {workout?.title || "Today's Workout"}
          </ThemedText>
          {workout && (
            <Text style={[styles.headerSubtitle, { color: colors.placeholder }]}>
              {workout.estimatedMinutes} min • {workout.dayType}
            </Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryButton} />
          <ThemedText style={styles.loadingText}>
            Loading workout...
          </ThemedText>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <View
            style={[
              styles.errorIcon,
              { backgroundColor: "rgba(255, 59, 48, 0.1)" },
            ]}
          >
            <Ionicons name="alert-circle" size={48} color="#FF3B30" />
          </View>
          <ThemedText style={styles.errorTitle}>
            Unable to load workout
          </ThemedText>
          <ThemedText style={styles.errorSubtitle}>{error}</ThemedText>
          <Pressable
            onPress={() => fetchWorkout()}
            style={[
              styles.retryButton,
              { backgroundColor: colors.primaryButton },
            ]}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : workout ? (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.exercise.id}-${index}`}
          renderItem={renderWorkoutItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primaryButton}
              colors={[colors.primaryButton]}
            />
          }
        />
      ) : null}
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
    paddingVertical: 16,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
    textTransform: "capitalize",
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.7,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
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
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: Fonts.sans,
  },
  workoutItemContainer: {
    gap: 8,
  },
  prescriptionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  prescriptionItem: {
    alignItems: "center",
    flex: 1,
  },
  prescriptionLabel: {
    fontSize: 11,
    fontWeight: "500",
    fontFamily: Fonts.sans,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  prescriptionValue: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  prescriptionDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(150, 150, 150, 0.2)",
  },
  itemSeparator: {
    height: 16,
  },
  sectionSeparator: {
    height: 8,
  },
  footer: {
    paddingTop: 24,
    paddingBottom: 40,
  },
  hintContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  hintText: {
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
});

