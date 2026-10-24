import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ContentSection } from "@/components/exercises/ContentSection";
import { ExerciseRow } from "@/components/explore";
import { ThemedText } from "@/components/themed-text";
import { WorkoutOverviewList, type OverviewControls } from "@/components/workout/workout-overview-list";
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
import { loadPreWorkoutOrder, savePreWorkoutOrder, prepareWorkoutStart, preWorkoutOrderFingerprint, PreWorkoutOrderConflict } from "@/utils/preWorkoutOrderStore";
import { reorderWorkout } from "@/utils/workoutArrangement";
import { clearActiveWorkout } from "@/utils/activeWorkoutStore";
import { AuthContext } from "@/utils/authContext";
import { localDateIso } from "@/utils/localDate";

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
    syncCurrentWeek,
  } = useWorkoutWeek();

  // Local state
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [hasTriedRefresh, setHasTriedRefresh] = useState(false);
  const { markWorkoutTerminal } = useActiveWorkout();

  const [todayIso, setTodayIso] = useState(localDateIso);

  const requestedWeekStart =
    typeof routeWeekStart === "string" ? routeWeekStart : undefined;
  const targetWeekStart = requestedWeekStart || weekPlan?.weekStart;
  const isTargetWeekLoaded =
    !targetWeekStart || weekPlan?.weekStart === targetWeekStart;

  // Never resolve a route's workout ID against a different week plan.
  const workout =
    workoutDayId && isTargetWeekLoaded ? getWorkoutById(workoutDayId) : null;

  const sourceFingerprint = workout ? preWorkoutOrderFingerprint(workout) : "missing";
  const orderUserId = user?.id;
  const sourceWorkoutRef = useRef(workout); sourceWorkoutRef.current = workout;
  const orderOwner = `${orderUserId ?? "guest"}:${sourceFingerprint}`;
  const lifetime = `${orderOwner}:${token ?? "anonymous"}`;
  const lifetimeRef = useRef(lifetime), lifetimeEpochRef = useRef(0);
  if (lifetimeRef.current !== lifetime) { lifetimeEpochRef.current += 1; lifetimeRef.current = lifetime; }
  const renderEpoch = lifetimeEpochRef.current;
  const mountedRef = useRef(true), startingRef = useRef(false);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; lifetimeEpochRef.current += 1; }; }, []);
  const [orderState, setOrderState] = useState<{ owner: string; exerciseIds: string[] | null } | null>(null);
  const [orderMessage, setOrderMessage] = useState<{ owner: string; text: string } | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const isOrderLoading = orderState?.owner !== orderOwner;
  useEffect(() => {
    let cancelled = false;
    const requestEpoch = lifetimeEpochRef.current;
    setIsSavingOrder(false); setIsStarting(false); startingRef.current = false;
    const original = sourceWorkoutRef.current;
    if (!orderUserId || !original) { setOrderState({ owner: orderOwner, exerciseIds: null }); return; }
    void loadPreWorkoutOrder(orderUserId, original).then((saved) => {
      if (cancelled || lifetimeRef.current !== lifetime || lifetimeEpochRef.current !== requestEpoch) return;
      setOrderState({ owner: orderOwner, exerciseIds: saved.exerciseIds });
      if (saved.invalidated) setOrderMessage({ owner: orderOwner, text: "Your workout changed, so its previous exercise order was reset. Choose an order again." });
    }).catch(() => {
      if (!cancelled && lifetimeRef.current === lifetime && lifetimeEpochRef.current === requestEpoch) {
        setOrderState({ owner: orderOwner, exerciseIds: null });
        setOrderMessage({ owner: orderOwner, text: "Couldn’t load your saved order. Try moving an exercise again before starting." });
      }
    });
    return () => { cancelled = true; };
  }, [sourceFingerprint, orderUserId, orderOwner, lifetime]);
  const displayedWorkout = useMemo(() => {
    const ids = orderState?.owner === orderOwner ? orderState.exerciseIds : null;
    if (!workout || !ids) return workout;
    try { return reorderWorkout(workout, ids); } catch { return workout; }
  }, [workout, orderState, orderOwner]);
  const moveOverviewExercise = useCallback(async (exerciseId: string, destination: number) => {
    if (!workout || !displayedWorkout || !user || isActionLoading || isOrderLoading || isSavingOrder || isStarting) return;
    const ids = displayedWorkout.blocks.flatMap((block) => block.items.map((item) => item.exercise.id));
    const source = ids.indexOf(exerciseId);
    if (source < 0 || source === destination || destination < 0 || destination >= ids.length) return;
    ids.splice(destination, 0, ids.splice(source, 1)[0]);
    const previous = orderState;
    setOrderState({ owner: orderOwner, exerciseIds: ids }); setIsSavingOrder(true);
    try {
      await savePreWorkoutOrder(user.id, workout, ids);
      if (mountedRef.current && lifetimeRef.current === lifetime && lifetimeEpochRef.current === renderEpoch) setOrderMessage({ owner: orderOwner, text: "Exercise order saved. Start when you’re ready." });
    } catch {
      if (mountedRef.current && lifetimeRef.current === lifetime && lifetimeEpochRef.current === renderEpoch) {
        setOrderState(previous);
        setOrderMessage({ owner: orderOwner, text: "Couldn’t save that order. Your previous order is still here; try again." });
      }
    } finally { if (mountedRef.current && lifetimeRef.current === lifetime && lifetimeEpochRef.current === renderEpoch) setIsSavingOrder(false); }
  }, [workout, displayedWorkout, user, isActionLoading, isOrderLoading, isSavingOrder, isStarting, orderState, orderOwner, lifetime, renderEpoch]);

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
    if (!workout || !token || !user || isOrderLoading || isSavingOrder || isStarting || startingRef.current) return;
    const origin = lifetime;
    const originEpoch = lifetimeEpochRef.current;
    const isCurrent = () => mountedRef.current && lifetimeRef.current === origin && lifetimeEpochRef.current === originEpoch;
    const openWorkout = async (active?: Awaited<ReturnType<typeof getActiveSession>>) => {
      if (!isCurrent()) return;
      const prepared = await prepareWorkoutStart(user.id, workout, active, isCurrent);
      if (!isCurrent() || !prepared) return;
      router.push({ pathname: "/workout/active", params: prepared.serverSessionId
        ? { sessionId: prepared.serverSessionId }
        : { workoutDayId: prepared.workoutDayId, weekStart: prepared.workoutDayId === workout.workoutDayId ? targetWeekStart : undefined } });
    };
    const reportStartError = (error: unknown) => {
      if (!isCurrent()) return;
      if (error instanceof PreWorkoutOrderConflict && error.terminal) {
        Alert.alert("Workout already finished", "This workout finished while you were starting it. Return to your workouts to choose another one.", [{ text: "Back to workouts", onPress: () => {
          if (!isCurrent()) return;
          void refreshWeek({ force: false, weekStart: targetWeekStart }).catch(() => undefined);
          router.replace("/(tabs)");
        } }]);
      } else if (error instanceof PreWorkoutOrderConflict) {
        Alert.alert("Workout already changed", "Your active workout has different exercises. Resume it to arrange the current exercises and keep your saved sets.", [{ text: "Cancel", style: "cancel" }, { text: "Resume active workout", onPress: () => {
          if (isCurrent()) router.push({ pathname: "/workout/active", params: error.serverSessionId ? { sessionId: error.serverSessionId } : { workoutDayId: workout.workoutDayId } });
        } }]);
      } else Alert.alert("Couldn’t start workout", "Your chosen order is saved. Please try again.");
    };
    startingRef.current = true; setIsStarting(true);
    try {
      let active: Awaited<ReturnType<typeof getActiveSession>> = null;
      try { active = await getActiveSession(token); }
      catch (error) {
        if (error && typeof error === "object" && "status" in error && typeof error.status === "number") throw error;
      }
      if (!isCurrent()) return;
      if (!active || active.workoutDayId === workout.workoutDayId) { await openWorkout(active); return; }
      const activeTitle = (active.effectiveWorkout ?? active.workoutSnapshot)?.title ?? `${active.dayType.replace(/_/g, " ")} workout`;
      const progress = active.setLogs.length > 0 ? `${active.setLogs.length} set${active.setLogs.length === 1 ? "" : "s"} logged` : "No sets logged yet";
      Alert.alert(`${activeTitle} is in progress`, `${progress}. Resume it, or abandon it before starting ${workout.title}.`, [
        { text: `Resume ${activeTitle}`, onPress: () => { if (isCurrent()) router.push({ pathname: "/workout/active", params: { sessionId: active!.id } }); } },
        { text: "Abandon & Start", style: "destructive", onPress: async () => {
          if (!isCurrent()) return;
          try { if (await abandonActiveWorkout(active!.id)) await openWorkout(); } catch (error) { reportStartError(error); }
        } },
      ]);
    } catch (error) { reportStartError(error); }
    finally { if (isCurrent()) { startingRef.current = false; setIsStarting(false); } }
  }, [workout, token, user, isOrderLoading, isSavingOrder, isStarting, lifetime, router, targetWeekStart, abandonActiveWorkout, refreshWeek]);

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
      setTodayIso(localDateIso());
      void syncCurrentWeek();
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
    }, [isLoggedIn, syncCurrentWeek, token])
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
  const sections: WorkoutSection[] = displayedWorkout
    ? displayedWorkout.blocks.map((block) => ({
        title: BLOCK_TYPE_LABELS[block.blockType] || block.blockType,
        blockType: block.blockType,
        data: block.items,
      }))
    : [];

  // Render section header
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3 && Boolean(workout);

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
  const renderWorkoutItem = ({ item, controls }: { item: WorkoutItem; controls: OverviewControls }) => (
    <View style={styles.workoutItemContainer}>
      <View style={styles.workoutItemHeader}>
      <ExerciseRow
        compact
        id={item.exercise.id}
        name={item.exercise.name}
        primaryMuscle={item.exercise.primaryMuscle}
        imageUrl={item.exercise.imageUrl}
        isFavorite={favoriteIds.has(item.exercise.id)}
        canFavorite={isLoggedIn}
        onToggleFavorite={handleToggleFavorite}
        onPress={() => handleExercisePress(item.exercise.id)}
      />
      {controls.handle}
      </View>
      {/* Prescription info */}
      <View style={[styles.workoutItemFooter, { borderTopColor: colors.inputBorder }]}>
      <View style={styles.prescriptionContainer}>
        <View style={styles.prescriptionItem}>
          <Text style={[styles.prescriptionLabel, { color: colors.placeholder }]}>
            Sets
          </Text>
          <Text style={[styles.prescriptionValue, { color: colors.text }]}>
            {item.prescription.sets}
          </Text>
        </View>
        <View style={styles.prescriptionItem}>
          <Text style={[styles.prescriptionLabel, { color: colors.placeholder }]}>
            Reps
          </Text>
          <Text style={[styles.prescriptionValue, { color: colors.text }]}>
            {item.prescription.reps}
          </Text>
        </View>
        <View style={styles.prescriptionItem}>
          <Text style={[styles.prescriptionLabel, { color: colors.placeholder }]}>
            Rest
          </Text>
          <Text style={[styles.prescriptionValue, { color: colors.text }]}>
            {item.prescription.restSeconds}s
          </Text>
        </View>
      </View>
      {controls.moves}
      </View>
      {/* Per-exercise coach rationale — renders nothing when absent */}
      <ContentSection
        title="Why this exercise"
        content={item.exerciseRationale}
        colors={colors}
      />
    </View>
  );

  const renderWorkoutHeading = () => (
    <View testID={largeText ? "workout-scroll-heading" : "workout-header-heading"} style={largeText ? styles.scrollHeading : styles.headerTitleContainer}>
      <ThemedText type="title" style={styles.headerTitle}>
        {workout?.title || "Workout"}
      </ThemedText>
      {workout && (
        <Text style={[styles.headerSubtitle, { color: colors.placeholder }]}>
          {getFormattedDate(workout.date)} • {workout.durationMinutes} min
        </Text>
      )}
    </View>
  );

  // Render header with actions (Skip Day only - Regenerate moved to Home)
  const renderListHeader = () => (
    <View style={styles.listHeader}>
      {largeText && renderWorkoutHeading()}
      <View style={{ gap: 6, marginBottom: 16 }}>
        <ThemedText type="defaultSemiBold">Choose your exercise order</ThemedText>
        <ThemedText style={{ color: colors.placeholder }}>Drag a card using its handle, or use the move buttons. Your order is saved for this workout; targets can be reviewed after you start.</ThemedText>
        {orderMessage?.owner === orderOwner ? <ThemedText testID="workout-overview-order-message" accessibilityLiveRegion="polite">{orderMessage.text}</ThemedText> : null}
      </View>
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
      {/* Program prescriptions stay locked to the activated template. */}
      {!workout?.programActivationId ? <View style={styles.durationSection}>
        <ThemedText type="default" style={styles.durationLabel}>
          Duration
        </ThemedText>
        <View style={styles.durationPicker}>
          {DURATION_OPTIONS.map((duration) => (
            <Pressable
              key={duration}
              accessibilityRole="button"
              accessibilityLabel={`${duration} minutes`}
              onPress={() => handleUpdateDuration(duration)}
              disabled={isActionLoading}
              accessibilityState={{ disabled: isActionLoading, busy: isActionLoading, selected: workout?.durationMinutes === duration }}
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
      </View> : (
        <View testID="program-duration-locked" style={[styles.coverageNotice, { backgroundColor: colors.inputBackground }]}>
          <ThemedText style={styles.coverageNoticeTitle}>Program workout</ThemedText>
          <ThemedText style={{ color: colors.placeholder }}>Duration and set targets come from your active program.</ThemedText>
        </View>
      )}

      {/* Skip Day action button */}
      <Pressable
        testID="skip-day-button"
        accessibilityRole="button"
        accessibilityLabel="Skip Day"
        onPress={handleSkipDay}
        disabled={isActionLoading}
        accessibilityState={{ disabled: isActionLoading, busy: isActionLoading }}
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
        edges={["top", "bottom"]}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back from workout" onPress={() => router.back()} style={styles.backButton}>
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
        edges={["top", "bottom"]}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back from unavailable workout" onPress={() => router.back()} style={styles.backButton}>
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
            accessibilityRole="button"
            accessibilityLabel="Go Back"
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
      edges={["top", "bottom"]}
    >
      {/* Header */}
      <View style={largeText ? styles.largeTextHeader : styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back from workout details"
          onPress={() => router.back()}
          style={largeText ? [styles.backButton, styles.largeTextBackButton] : styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        {!largeText && renderWorkoutHeading()}
        {!largeText && <View style={styles.headerSpacer} />}
      </View>

      {/* Action loading overlay */}
      {isActionLoading && (
        <View style={styles.actionLoadingOverlay}>
          <ActivityIndicator size="large" color={colors.primaryButton} />
        </View>
      )}

      {/* Content */}
      {workout ? (
        <WorkoutOverviewList sections={sections} colors={colors} disabled={!user || isActionLoading || isOrderLoading || isSavingOrder || isStarting}
          onMove={(id, destination) => void moveOverviewExercise(id, destination)}
          renderItem={(item, controls) => renderWorkoutItem({ item, controls })} renderSectionHeader={(section) => renderSectionHeader({ section })}
          header={renderListHeader()} contentContainerStyle={styles.listContent} />
      ) : null}

      {/* Start Workout button */}
      {workout && (
        <View testID="workout-start-footer" style={[styles.startButtonContainer, { backgroundColor: colors.background }]}>
          <Pressable
            testID="start-workout-button"
            accessibilityRole="button"
            accessibilityLabel="Start Workout"
            onPress={() => void startWorkout()}
            disabled={isOrderLoading || isSavingOrder || isStarting || isActionLoading}
            accessibilityState={{ disabled: isOrderLoading || isSavingOrder || isStarting || isActionLoading, busy: isStarting }}
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
    minHeight: 44,
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
    paddingBottom: 24,
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
    minHeight: 44,
    minWidth: 44,
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
    minHeight: 44,
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
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    flexShrink: 1,
    minWidth: 0,
  },
  sectionBadge: {
    maxWidth: "100%",
    alignSelf: "flex-start",
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
  workoutItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  workoutItemFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  prescriptionContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 12,
    rowGap: 4,
    alignItems: "center",
    paddingVertical: 8,
  },
  prescriptionItem: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: 4,
    flexShrink: 0,
  },
  prescriptionLabel: {
    fontSize: 11,
    fontWeight: "500",
    fontFamily: Fonts.sans,
  },
  prescriptionValue: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    fontVariant: ["tabular-nums"],
  },
  itemSeparator: {
    height: 16,
  },
  sectionSeparator: {
    height: 8,
  },
  startButtonContainer: {
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 12,
  },
  startButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 8,
  },
  startButtonText: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  largeTextHeader: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: "flex-start",
  },
  largeTextBackButton: {
    width: 44,
    height: 44,
  },
  scrollHeading: {
    paddingBottom: 20,
    gap: 4,
  },
});
