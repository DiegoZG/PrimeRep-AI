import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ContentSection } from "@/components/exercises/ContentSection";
import { ExerciseRow } from "@/components/explore";
import { ThemedText } from "@/components/themed-text";
import { CoachCard } from "@/components/workout/CoachCard";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWorkoutWeek } from "@/hooks/use-workout-week";
import type { WorkoutDay, WorkoutItem, WorkoutWeekPlan } from "@/interfaces/workouts";
import {
  favoriteExercise,
  getFavoriteExercises,
  unfavoriteExercise,
} from "@/services/exerciseService";
import { abandonSession, getActiveSession } from "@/services/workoutLoggingService";
import { useActiveWorkout } from "@/utils/activeWorkoutContext";
import { clearActiveWorkout } from "@/utils/activeWorkoutStore";
import { AuthContext } from "@/utils/authContext";

// Block type display names
const BLOCK_TYPE_LABELS: Record<string, string> = {
  main: "Main Lifts",
  accessory: "Accessories",
  finisher: "Finisher",
};

// Duration options for picker
const DURATION_OPTIONS = [25, 35, 45, 60];

// Section data type for SectionList
interface WorkoutSection {
  title: string;
  blockType: string;
  data: WorkoutItem[];
}

/**
 * Helper: Get highlighted workout from a plan
 * (today match or next upcoming by date, sorted by slotIndex)
 */
function getHighlightedFromPlan(
  plan: WorkoutWeekPlan,
  todayIso: string
): WorkoutDay | null {
  if (!plan.workouts || plan.workouts.length === 0) return null;

  const sorted = [...plan.workouts].sort((a, b) => a.slotIndex - b.slotIndex);

  // First, try to find a workout matching today
  const todayWorkout = sorted.find((w) => w.date === todayIso);
  if (todayWorkout) return todayWorkout;

  // Otherwise, find the next upcoming workout (min date >= today)
  const upcoming = sorted.filter((w) => w.date >= todayIso);
  if (upcoming.length > 0) return upcoming[0];

  // Fallback to first
  return sorted[0];
}

export default function WorkoutDayDetailScreen() {
  const router = useRouter();
  const { workoutDayId, weekStart: routeWeekStart } = useLocalSearchParams<{
    workoutDayId: string;
    weekStart?: string;
  }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { token, user, isLoggedIn } = useContext(AuthContext);

  // Workout week context
  const {
    weekPlan,
    isLoading: isWeekLoading,
    staleIdRefreshed,
    refreshWeek,
    skipDay,
    setDuration,
    clearStaleIdFlag,
    getWorkoutById,
    getExerciseCount,
  } = useWorkoutWeek();

  // Local state
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [hasTriedRefresh, setHasTriedRefresh] = useState(false);
  const { markWorkoutTerminal } = useActiveWorkout();

  // Today's date in YYYY-MM-DD format
  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);

  const requestedWeekStart =
    typeof routeWeekStart === "string" ? routeWeekStart : undefined;
  const targetWeekStart = requestedWeekStart || weekPlan?.weekStart;
  const isTargetWeekLoaded =
    !targetWeekStart || weekPlan?.weekStart === targetWeekStart;

  // Never resolve a route's workout ID against a different week plan.
  const workout =
    workoutDayId && isTargetWeekLoaded ? getWorkoutById(workoutDayId) : null;

  const abandonActiveWorkout = useCallback(async (sessionId: string) => {
    if (!token) return false;
    try {
      await abandonSession(token, sessionId);
      if (user) await clearActiveWorkout(user.id);
      markWorkoutTerminal();
      return true;
    } catch {
      Alert.alert("Couldn't abandon workout", "Please try again before starting another workout.");
      return false;
    }
  }, [token, user, markWorkoutTerminal]);

  const startWorkout = useCallback(async () => {
    if (!workout || !token) return;
    const openWorkout = () => router.push({
      pathname: "/workout/active",
        params: {
          workoutDayId: workout.workoutDayId,
          weekStart: targetWeekStart,
        },
    });
    try {
      const active = await getActiveSession(token);
      if (!active || active.workoutDayId === workout.workoutDayId) {
        openWorkout();
        return;
      }
      const activeTitle = active.workoutSnapshot?.title ?? `${active.dayType.replace(/_/g, " ")} workout`;
      const progress = active.setLogs.length > 0 ? `${active.setLogs.length} set${active.setLogs.length === 1 ? "" : "s"} logged` : "No sets logged yet";
      Alert.alert(
        `${activeTitle} is in progress`,
        `${progress}. Resume it, or abandon it before starting ${workout.title}.`,
        [
          {
            text: `Resume ${activeTitle}`,
            onPress: () => router.push({ pathname: "/workout/active", params: { sessionId: active.id } }),
          },
          {
            text: "Abandon & Start",
            style: "destructive",
            onPress: async () => {
              if (await abandonActiveWorkout(active.id)) openWorkout();
            },
          },
        ]
      );
    } catch {
      Alert.alert("Couldn't check active workout", "Please try again.");
    }
  }, [workout, token, router, abandonActiveWorkout, targetWeekStart]);

  // Handle stale ID notification
  useEffect(() => {
    if (staleIdRefreshed) {
      Alert.alert(
        "Plan Refreshed",
        "This workout is no longer available. Return to your workouts to choose another one.",
        [{ text: "OK", onPress: () => {
          clearStaleIdFlag();
          router.replace("/(tabs)");
        } }]
      );
    }
  }, [staleIdRefreshed, clearStaleIdFlag, router]);

  // If workout not found and we haven't tried refreshing, try to refresh
  useEffect(() => {
    async function tryRefresh() {
      if (!workout && workoutDayId && weekPlan && !hasTriedRefresh && !isWeekLoading) {
        setHasTriedRefresh(true);
        await refreshWeek({ force: false, weekStart: targetWeekStart });
      }
    }
    tryRefresh();
  }, [
    workout,
    workoutDayId,
    weekPlan,
    targetWeekStart,
    hasTriedRefresh,
    isWeekLoading,
    refreshWeek,
  ]);

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

  // Handle skip day - uses returned plan for navigation (not context selectors)
  const handleSkipDay = useCallback(async () => {
    if (!workout || !workoutDayId) return;

    Alert.alert(
      "Skip Workout",
      `Skip "${workout.title}" and add a new workout to the end of the week?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip",
          style: "destructive",
          onPress: async () => {
            // Capture prior slot index before mutation
            const priorSlotIndex = workout.slotIndex;

            setIsActionLoading(true);
            const runSkip = async () => {
              setIsActionLoading(true);
              const newPlan = await skipDay(workoutDayId, targetWeekStart);
              setIsActionLoading(false);

              if (newPlan) {
              // Find workout with same slotIndex from the returned plan
              const sorted = [...newPlan.workouts].sort(
                (a, b) => a.slotIndex - b.slotIndex
              );
              const sameSlot = sorted.find((w) => w.slotIndex === priorSlotIndex);

              // Fallback: get highlighted from the returned plan (not context)
              const highlighted = getHighlightedFromPlan(newPlan, todayIso);
              const targetWorkout = sameSlot || highlighted || sorted[0];

              if (targetWorkout) {
                router.replace({
                  pathname: "/workouts/[workoutDayId]",
                  params: {
                    workoutDayId: targetWorkout.workoutDayId,
                    weekStart: newPlan.weekStart,
                  },
                });
              } else {
                router.back();
              }
              }
            };
            try {
              await runSkip();
            } catch {
              Alert.alert("Couldn't skip workout", "Please try again.");
            }
            // If null returned (stale 404), alert is shown via staleIdRefreshed effect
          },
        },
      ]
    );
  }, [workout, workoutDayId, skipDay, targetWeekStart, todayIso, router]);

  // Handle update duration
  const handleUpdateDuration = useCallback(
    (newDuration: number) => {
      if (!workout || !workoutDayId) return;
      if (newDuration === workout.durationMinutes) return;

      Alert.alert(
        "Update Duration",
        `Change workout duration to ${newDuration} minutes? This will regenerate the workout to fit the new time.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Update",
            onPress: async () => {
              setIsActionLoading(true);
              await setDuration(workoutDayId, newDuration, targetWeekStart);
              setIsActionLoading(false);

              // If newPlan is null (stale 404), alert is shown via staleIdRefreshed effect
              // Otherwise, the workout data updates automatically via context
            },
          },
        ]
      );
    },
    [workout, workoutDayId, setDuration, targetWeekStart]
  );

  // Get formatted date
  const getFormattedDate = (dateStr: string): string => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  // Transform workout blocks to sections
  const sections: WorkoutSection[] = workout
    ? workout.blocks.map((block) => ({
        title: BLOCK_TYPE_LABELS[block.blockType] || block.blockType,
        blockType: block.blockType,
        data: block.items,
      }))
    : [];

  // Render section header
  const renderSectionHeader = ({ section }: { section: WorkoutSection }) => (
    <View style={styles.sectionHeader}>
      <ThemedText type="subtitle" style={styles.sectionTitle}>
        {section.title}
      </ThemedText>
      <View
        style={[styles.sectionBadge, { backgroundColor: colors.inputBackground }]}
      >
        <Text style={[styles.sectionBadgeText, { color: colors.placeholder }]}>
          {section.data.length}{" "}
          {section.data.length === 1 ? "exercise" : "exercises"}
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
      {/* Per-exercise coach rationale — renders nothing when absent */}
      <ContentSection
        title="Why this exercise"
        content={item.exerciseRationale}
        colors={colors}
      />
    </View>
  );

  // Render header with actions (Skip Day only - Regenerate moved to Home)
  const renderListHeader = () => (
    <View style={styles.listHeader}>
      {/* Coach intent — renders nothing when absent */}
      <CoachCard intent={workout?.workoutIntent} colors={colors} />
      {!!workout?.unavailableMuscles?.length && (
        <View style={[styles.coverageNotice, { backgroundColor: colors.inputBackground }]}>
          <ThemedText style={styles.coverageNoticeTitle}>Equipment update</ThemedText>
          <ThemedText style={{ color: colors.placeholder }}>
            {`We couldn't add ${workout.unavailableMuscles.join(", ")} with your current equipment.`}
          </ThemedText>
        </View>
      )}
      {!!workout?.deferredMuscles?.length && (
        <View style={[styles.coverageNotice, { backgroundColor: colors.inputBackground }]}>
          <ThemedText style={styles.coverageNoticeTitle}>Muscle rotation</ThemedText>
          <ThemedText style={{ color: colors.placeholder }}>
            {`${workout.deferredMuscles.join(", ")} will be prioritized in your next custom workout.`}
          </ThemedText>
        </View>
      )}
      {/* Duration selector */}
      <View style={styles.durationSection}>
        <ThemedText type="default" style={styles.durationLabel}>
          Duration
        </ThemedText>
        <View style={styles.durationPicker}>
          {DURATION_OPTIONS.map((duration) => (
            <Pressable
              key={duration}
              onPress={() => handleUpdateDuration(duration)}
              disabled={isActionLoading}
              style={[
                styles.durationOption,
                {
                  backgroundColor:
                    workout?.durationMinutes === duration
                      ? colors.primaryButton
                      : colors.inputBackground,
                },
              ]}
            >
              <Text
                style={[
                  styles.durationOptionText,
                  {
                    color:
                      workout?.durationMinutes === duration
                        ? "#FFFFFF"
                        : colors.text,
                  },
                ]}
              >
                {duration}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Skip Day action button */}
      <Pressable
        onPress={handleSkipDay}
        disabled={isActionLoading}
        style={[styles.skipButton, { backgroundColor: colors.inputBackground }]}
      >
        <Ionicons name="play-skip-forward" size={18} color={colors.text} />
        <Text style={[styles.skipButtonText, { color: colors.text }]}>
          Skip Day
        </Text>
      </Pressable>
    </View>
  );

  // Loading state
  if (isWeekLoading && !workout) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <ThemedText type="title" style={styles.headerTitle}>
              Workout
            </ThemedText>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryButton} />
          <ThemedText style={styles.loadingText}>Loading workout...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  // Not found state
  if (!workout && hasTriedRefresh) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <ThemedText type="title" style={styles.headerTitle}>
              Workout
            </ThemedText>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <View
            style={[
              styles.errorIcon,
              { backgroundColor: "rgba(255, 59, 48, 0.1)" },
            ]}
          >
            <Ionicons name="alert-circle" size={48} color="#FF3B30" />
          </View>
          <ThemedText style={styles.errorTitle}>Workout not found</ThemedText>
          <ThemedText style={styles.errorSubtitle}>
            This workout may have been removed or updated.
          </ThemedText>
          <Pressable
            onPress={() => router.back()}
            style={[styles.retryButton, { backgroundColor: colors.primaryButton }]}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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
            {workout?.title || "Workout"}
          </ThemedText>
          {workout && (
            <Text style={[styles.headerSubtitle, { color: colors.placeholder }]}>
              {getFormattedDate(workout.date)} • {workout.durationMinutes} min
            </Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Action loading overlay */}
      {isActionLoading && (
        <View style={styles.actionLoadingOverlay}>
          <ActivityIndicator size="large" color={colors.primaryButton} />
        </View>
      )}

      {/* Content */}
      {workout ? (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.exercise.id}-${index}`}
          renderItem={renderWorkoutItem}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={renderListHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        />
      ) : null}

      {/* Start Workout button */}
      {workout && (
        <View style={styles.startButtonContainer}>
          <Pressable
            testID="start-workout-button"
            onPress={() => void startWorkout()}
            style={[styles.startButton, { backgroundColor: colors.primaryButton }]}
          >
            <Ionicons name="play" size={20} color="#FFFFFF" />
            <Text style={styles.startButtonText}>Start Workout</Text>
          </Pressable>
        </View>
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
  actionLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  listHeader: {
    paddingBottom: 20,
  },
  durationSection: {
    marginBottom: 16,
  },
  coverageNotice: {
    borderRadius: 12,
    padding: 14,
    gap: 4,
    marginBottom: 16,
  },
  coverageNoticeTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  durationLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
    opacity: 0.7,
  },
  durationPicker: {
    flexDirection: "row",
    gap: 10,
  },
  durationOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  durationOptionText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  skipButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: Fonts.sans,
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
  startButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 12,
    backgroundColor: "transparent",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
});
