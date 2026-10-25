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
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
  useWindowDimensions,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedCard } from "@/components/animated-card";
import {
  WorkoutCardMenu,
  type AnchorRect,
  type MenuItemConfig,
} from "@/components/home";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useStats } from "@/hooks/use-stats";
import { useAccountResource } from "@/hooks/use-account-resource";
import { useWorkoutWeek } from "@/hooks/use-workout-week";
import type { CoachFeedItem, CoachNextAction } from "@/interfaces/coach";
import type { WorkoutDay } from "@/interfaces/workouts";
import { accountRequestGuard } from "@/services/accountScope";
import { getCoachFeed, markCoachItemRead } from "@/services/coachService";
import { getAchievements } from "@/services/profileService";
import { useActiveWorkout } from "@/utils/activeWorkoutContext";
import { AuthContext } from "@/utils/authContext";
import { coachItemPresentation } from "@/utils/coachItemBody";
import { coachTargetHref } from "@/utils/coachNavigation";
import { EquipmentWeightsContext } from "@/utils/equipmentWeightsContext";
import { fourWeekActivity, homeWorkoutState, selectHomeCoachItem } from "@/utils/homeDashboard";
import { workoutPlanningMode, workoutPlanningSummary, workoutPlanningSpokenSummary } from "@/utils/workoutPlanning";
import { localDateIso } from "@/utils/localDate";
import { loadWeightUnit, type WeightUnit } from "@/utils/weightUnits";

import { CARD_GAP, CARD_WIDTH, styles } from "@/styles/home.styles";

// Day name abbreviations
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Placeholder until stats arrive, so a real 0 is never confused with "unknown". */
function statValue(value: number | undefined): string {
  return value === undefined ? "—" : String(value);
}

async function loadHomeCoachAction(token: string): Promise<CoachNextAction> {
  const page = await getCoachFeed(token, localDateIso(), { view: "now", limit: 50 });
  return page.nextAction;
}

async function loadHomeCoachItem(token: string): Promise<CoachFeedItem | null> {
  let cursor: string | undefined;
  do {
    const page = await getCoachFeed(token, localDateIso(), { view: "now", limit: 50, cursor });
    const item = selectHomeCoachItem(page.items);
    if (item) return item;
    cursor = page.hasMore && page.nextCursor ? page.nextCursor : undefined;
  } while (cursor);
  return null;
}

const Home = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { fontScale, width } = useWindowDimensions();
  const expandedText = fontScale >= 1.6 || width < 360;
  const actionStyle = (style: StyleProp<ViewStyle>, primary = false) =>
    ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
      style,
      pressed && { backgroundColor: primary ? "#5940D0" : colors.inputBorder },
    ];
  const { token, user } = useContext(AuthContext);
  const equipmentWeights = useContext(EquipmentWeightsContext);
  const { activeWorkout, refreshActiveWorkout } = useActiveWorkout();
  const { stats, refresh: refreshStats } = useStats();
  const coachAction = useAccountResource(loadHomeCoachAction);
  const coachCard = useAccountResource(loadHomeCoachItem);
  const achievements = useAccountResource(getAchievements);
  const refreshCoachAction = coachAction.refresh;
  const refreshCoachCard = coachCard.refresh;
  const refreshAchievements = achievements.refresh;
  const [weightUnitState, setWeightUnitState] = useState<{ userId: string; unit: WeightUnit } | null>(null);
  const weightUnit = weightUnitState && weightUnitState.userId === user?.id ? weightUnitState.unit : null;
  const flatListRef = useRef<FlatList>(null);
  const previousFontScale = useRef(fontScale);

  // Store refs for overflow buttons to measure their positions
  const buttonRefs = useRef<Map<string, View | null>>(new Map());

  // Workout week context
  const {
    weekPlan,
    currentWeekStart,
    isLoading,
    error,
    refreshWeek,
    getSortedWorkouts,
    getExerciseCount,
    syncCurrentWeek,
  } = useWorkoutWeek();

  // Menu state
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutDay | null>(
    null
  );
  const [menuAnchorRect, setMenuAnchorRect] = useState<AnchorRect | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track if this is the initial load (never had data)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [todayIso, setTodayIso] = useState(localDateIso);

  const sortedWorkouts = useMemo(() => getSortedWorkouts(), [getSortedWorkouts]);
  const nextAction = coachAction.loading || coachAction.error ? null : coachAction.data;
  const completedCount = achievements.data?.total_completed ?? stats?.totalCompleted ?? null;
  const workoutState = homeWorkoutState(Boolean(activeWorkout), nextAction, completedCount);
  const coachItem = coachCard.loading || coachCard.error ? null : coachCard.data;
  const trendWeeks = achievements.data ? fourWeekActivity(achievements.data) : [];
  const trendMaximum = Math.max(1, ...trendWeeks.map((week) => week.completed_workouts));
  const plannedTarget = nextAction?.type === "planned_workout" && nextAction.target.type === "planned_workout"
    ? nextAction.target
    : null;
  const highlightedWorkout = useMemo(
    () => plannedTarget ? sortedWorkouts.find((workout) => workout.workoutDayId === plannedTarget.workoutDayId) ?? null : null,
    [plannedTarget, sortedWorkouts]
  );
  const activeWorkoutTitle = activeWorkout?.title ?? "";
  const activeWorkoutTotalSets = activeWorkout?.totalSets ?? 0;

  // Find index of highlighted workout for auto-scroll
  const highlightedIndex = useMemo(() => {
    if (!highlightedWorkout) return 0;
    const index = sortedWorkouts.findIndex(
      (w) => w.workoutDayId === highlightedWorkout.workoutDayId
    );
    return index >= 0 ? index : 0;
  }, [sortedWorkouts, highlightedWorkout]);

  // Refresh week on focus (only if we don't have data yet)
  useFocusEffect(
    useCallback(() => {
      setTodayIso(localDateIso());
      void syncCurrentWeek();
      void refreshActiveWorkout();
      if (token && !isLoading && !error && weekPlan === null) {
        void refreshWeek({ force: false });
      }
    }, [token, isLoading, error, weekPlan, refreshWeek, refreshActiveWorkout, syncCurrentWeek])
  );

  useFocusEffect(useCallback(() => {
    let current = true;
    void loadWeightUnit().then((unit) => {
      if (current && user?.id) setWeightUnitState({ userId: user.id, unit });
    });
    return () => { current = false; };
  }, [user?.id]));

  useEffect(() => {
    if (weekPlan?.weekStart && token) {
      void refreshCoachAction();
      void refreshCoachCard();
    }
  }, [weekPlan?.weekStart, token, refreshCoachAction, refreshCoachCard]);

  const scrollToIndex = useCallback((index: number, viewPosition = 0.1) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition });
    }, 100);
  }, []);

  // Auto-scroll to highlighted workout when data loads
  useFocusEffect(
    useCallback(() => {
      if (sortedWorkouts.length > 0 && flatListRef.current) {
        if (!hasLoadedOnce) {
          setHasLoadedOnce(true);
        }
        scrollToIndex(highlightedIndex, fontScale >= 1.6 ? 0 : 0.1);
      }
    }, [sortedWorkouts.length, highlightedIndex, scrollToIndex, hasLoadedOnce, fontScale])
  );

  // Handle pull-to-refresh (uses local state, not global isLoading)
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshWeek({ force: false });
      await Promise.allSettled([
        refreshActiveWorkout(),
        refreshStats(),
        refreshCoachAction(),
        refreshCoachCard(),
        refreshAchievements(),
      ]);
      setTodayIso(localDateIso());
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshWeek, refreshActiveWorkout, refreshStats, refreshCoachAction, refreshCoachCard, refreshAchievements]);

  const openCoachItem = useCallback((item: CoachFeedItem) => {
    const href = coachTargetHref(item.target);
    if (!href) return;
    if (token) {
      const sameAccount = accountRequestGuard();
      void markCoachItemRead(token, item.id, "primaryAction")
        .then(() => { if (sameAccount()) void refreshCoachCard(); })
        .catch(() => {});
    }
    router.push(href);
  }, [token, router, refreshCoachCard]);

  const openNextAction = useCallback(() => {
    if (activeWorkout) {
      router.push({ pathname: "/workout/active", params: activeWorkout.sessionId ? { sessionId: activeWorkout.sessionId } : { workoutDayId: activeWorkout.workoutDayId } });
      return;
    }
    const href = coachTargetHref(nextAction?.target);
    if (href) router.push(href);
  }, [activeWorkout, nextAction, router]);

  // Navigate to workout day detail
  const handleWorkoutPress = useCallback(
    (workout: WorkoutDay) => {
      router.push({
        pathname: "/workouts/[workoutDayId]",
        params: {
          workoutDayId: workout.workoutDayId,
          weekStart: weekPlan?.weekStart || currentWeekStart,
        },
      });
    },
    [router, weekPlan?.weekStart, currentWeekStart]
  );

  // Open menu for a workout - measure button position first
  const handleOpenMenu = useCallback((workout: WorkoutDay) => {
    const buttonRef = buttonRefs.current.get(workout.workoutDayId);
    if (buttonRef) {
      buttonRef.measureInWindow((x, y, width, height) => {
        setMenuAnchorRect({ x, y, width, height });
        setSelectedWorkout(workout);
        setMenuVisible(true);
      });
    } else {
      // Fallback if ref not found
      setSelectedWorkout(workout);
      setMenuVisible(true);
    }
  }, []);

  // Close menu
  const handleCloseMenu = useCallback(() => {
    setMenuVisible(false);
    setSelectedWorkout(null);
    setMenuAnchorRect(null);
  }, []);

  useEffect(() => {
    if (previousFontScale.current === fontScale) return;
    previousFontScale.current = fontScale;
    handleCloseMenu();
  }, [fontScale, handleCloseMenu]);

  // Handle regenerate week
  const handleRegenerateWeek = useCallback(async () => {
    handleCloseMenu();

    Alert.alert(
      "Regenerate Week",
      "This will create a completely new workout plan for the week. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          style: "destructive",
          onPress: async () => {
            setIsRegenerating(true);
            const newPlan = await refreshWeek({ force: true });
            setIsRegenerating(false);

            if (newPlan && newPlan.workouts.length > 0) {
              // Find highlighted workout from the new plan
              const sorted = [...newPlan.workouts].sort(
                (a, b) => a.slotIndex - b.slotIndex
              );
              const todayWorkout = sorted.find((w) => w.date === todayIso);
              const upcomingWorkouts = sorted.filter((w) => w.date >= todayIso);
              const highlighted =
                todayWorkout || upcomingWorkouts[0] || sorted[0];

              // Auto-scroll to highlighted workout
              if (highlighted) {
                const newIndex = sorted.findIndex(
                  (w) => w.workoutDayId === highlighted.workoutDayId
                );
                if (newIndex >= 0) scrollToIndex(newIndex);
              }
            }
          },
        },
      ]
    );
  }, [handleCloseMenu, refreshWeek, todayIso, scrollToIndex]);

  const handleShare = useCallback(async (workout: WorkoutDay) => {
    handleCloseMenu();
    const exercises = workout.blocks.flatMap((block) => block.items.map((item) => item.exercise.name));
    try {
      await Share.share({
        title: workout.title,
        message: `${workout.title}\n${workout.date} · ${workoutPlanningSummary(workout)}\n${exercises.join(", ")}\n\nPlanned with PrimeRep.`,
      });
    } catch {
      Alert.alert("Couldn't Share Workout", "The share sheet could not open.", [
        { text: "Cancel", style: "cancel" },
        { text: "Try Again", onPress: () => void handleShare(workout) },
      ]);
    }
  }, [handleCloseMenu]);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Get day name from date string
  const getDayName = (dateStr: string): string => {
    const date = new Date(dateStr + "T00:00:00");
    return DAY_NAMES[date.getDay()];
  };

  // Check if workout is highlighted (today or next upcoming)
  const isHighlighted = (workout: WorkoutDay): boolean => {
    return workout.workoutDayId === highlightedWorkout?.workoutDayId;
  };

  // Check if workout date is today
  const isToday = (dateStr: string): boolean => {
    return dateStr === todayIso;
  };

  // Get menu items for a workout
  const getMenuItems = useCallback(
    (workout: WorkoutDay): MenuItemConfig[] => {
      // Check if workout is highlighted (avoid calling isHighlighted to prevent dependency issues)
      const highlighted =
        workout.workoutDayId === highlightedWorkout?.workoutDayId;
      const items: MenuItemConfig[] = [];

      // Only highlighted card gets Regenerate option
      if (highlighted) {
        items.push({
          id: "regenerate",
          label: "Regenerate Week",
          icon: "refresh",
          onPress: handleRegenerateWeek,
          destructive: true,
        });
      }

      // All cards get Share option
      items.push({
        id: "share",
        testID: "home-share-workout",
        label: "Share Workout",
        icon: "share-outline",
        onPress: () => void handleShare(workout),
      });

      return items;
    },
    [highlightedWorkout, handleRegenerateWeek, handleShare]
  );

  // Get menu subtitle text
  const getMenuSubtitle = (workout: WorkoutDay): string => {
    return `${getDayName(workout.date)} • ${workoutPlanningSummary(workout)}`;
  };

  // Render a workout card for FlatList
  const renderWorkoutCard = ({
    item: workout,
    index,
  }: {
    item: WorkoutDay;
    index: number;
  }) => {
    const highlighted = isHighlighted(workout);
    const today = isToday(workout.date);
    const exerciseCount = getExerciseCount(workout);

    return (
      <AnimatedCard delay={100 + index * 50}>
        <Pressable
          testID="workout-card"
          accessibilityRole="button"
          accessibilityLabel={`Open ${workout.title}, ${getDayName(workout.date)}${today ? ", today" : ""}, ${workoutPlanningSpokenSummary(workout)}, ${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`}
          onPress={() => handleWorkoutPress(workout)}
          style={({ pressed }) => [
            styles.workoutCard,
            { backgroundColor: colors.inputBackground, borderColor: highlighted ? colors.primaryButton : colors.inputBorder },
            { opacity: pressed ? 0.95 : 1 },
          ]}
        >
          <View style={styles.workoutCardHeader}>
            <View style={styles.dayBadge}>
              <Text style={[styles.dayBadgeText, { color: colors.icon }]}>{getDayName(workout.date)}</Text>
              {today && (
                <View style={[styles.todayIndicator, { borderColor: colors.inputBorder }]}>
                  <Text style={[styles.todayText, { color: colors.text }]}>Today</Text>
                </View>
              )}
            </View>
            <View
              ref={(ref) => {
                buttonRefs.current.set(workout.workoutDayId, ref);
              }}
              collapsable={false}
            >
              <Pressable
                testID="home-workout-options"
                onPress={() => handleOpenMenu(workout)}
                style={actionStyle(styles.overflowButton)}
                accessibilityRole="button"
                accessibilityLabel={`Workout options for ${workout.title}`}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.icon} />
              </Pressable>
            </View>
          </View>

          {/* Content */}
          <View style={styles.workoutContent}>
            <Text style={[styles.workoutTitle, { color: colors.text }]}>
              {workout.title}
            </Text>
            <Text style={[styles.workoutSubtitle, { color: colors.icon }]}>{workout.dayType}</Text>

            {/* Metrics */}
            <View style={styles.workoutMetrics}>
              <View style={styles.metric}>
                <Ionicons
                  name={workoutPlanningMode(workout) === "trainer_led" && !workout.programActivationId ? "sparkles-outline" : "time-outline"}
                  size={14}
                  color={colors.icon}
                />
                <Text style={[styles.metricText, { color: colors.icon }]}>
                  {workoutPlanningMode(workout) === "trainer_led" && !workout.programActivationId ? "Trainer-led" : workoutPlanningSummary(workout)}
                </Text>
              </View>
              <View style={styles.metric}>
                <Ionicons
                  name="barbell-outline"
                  size={14}
                  color={colors.icon}
                />
                <Text style={[styles.metricText, { color: colors.icon }]}>{exerciseCount} {exerciseCount === 1 ? "exercise" : "exercises"}</Text>
              </View>
            </View>
          </View>

        </Pressable>
      </AnimatedCard>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Regenerating overlay */}
      {isRegenerating && (
        <View style={styles.regeneratingOverlay}>
          <View
            style={[
              styles.regeneratingContent,
              { backgroundColor: colors.inputBackground },
            ]}
          >
            <ActivityIndicator size="large" color={colors.primaryButton} />
            <ThemedText style={styles.regeneratingText}>
              Regenerating your week...
            </ThemedText>
          </View>
        </View>

      )}

      <ScrollView
        key={fontScale}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primaryButton}
            colors={[colors.primaryButton]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText type="default" style={styles.greeting}>
              {getGreeting()},
            </ThemedText>
            <ThemedText type="title" style={styles.userName}>
              {user?.preferred_name || "Athlete"}
            </ThemedText>
          </View>
        </View>

        {activeWorkout ? (
          <Pressable
            testID="home-resume-workout"
            accessibilityRole="button"
            accessibilityLabel={`Resume ${activeWorkoutTitle}`}
            onPress={openNextAction}
            style={actionStyle([styles.primaryAction, { backgroundColor: colors.primaryButton }], true)}
          >
            <View style={[styles.liveDot, { backgroundColor: "#FFFFFF" }]} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.primaryEyebrow}>Workout in progress</ThemedText>
              <ThemedText style={styles.primaryTitle}>{activeWorkoutTitle}</ThemedText>
              <ThemedText style={styles.primaryBody}>
                {activeWorkout.completedSets}{activeWorkoutTotalSets > 0 ? `/${activeWorkoutTotalSets}` : ""} sets completed
              </ThemedText>
            </View>
            <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
          </Pressable>
        ) : coachAction.loading ? (
          <View testID="home-next-loading" style={[styles.quietAction, { backgroundColor: colors.inputBackground }]}>
            <ActivityIndicator color={colors.primaryButton} />
            <ThemedText style={{ color: colors.icon }}>Checking your next workout…</ThemedText>
          </View>
        ) : coachAction.error ? (
          <View testID="home-next-error" style={[styles.quietAction, { backgroundColor: colors.inputBackground }]}>
            <ThemedText style={styles.quietActionTitle}>Next workout unavailable</ThemedText>
            <ThemedText style={{ color: colors.icon }}>Browse your week below, or retry to confirm what’s next.</ThemedText>
            <Pressable testID="home-next-retry" accessibilityRole="button" accessibilityLabel="Retry next workout guidance" onPress={() => void refreshCoachAction()} style={actionStyle(styles.compactAction)}>
              <ThemedText style={{ color: colors.text, fontWeight: "700" }}>Retry guidance</ThemedText>
            </Pressable>
          </View>
        ) : workoutState === "planned" || workoutState === "resume" ? (
          <Pressable
            testID="home-next-workout"
            accessibilityRole="button"
            accessibilityLabel={`${completedCount === 0 ? "Open your first workout" : "Open next workout"}: ${nextAction?.title ?? "Workout"}`}
            onPress={openNextAction}
            style={actionStyle([styles.primaryAction, { backgroundColor: colors.primaryButton }], true)}
          >
            <Ionicons name="barbell-outline" size={22} color="#FFFFFF" />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.primaryEyebrow}>{completedCount === 0 ? "Your first workout" : workoutState === "resume" ? "Workout in progress" : "Up next"}</ThemedText>
              <ThemedText style={styles.primaryTitle}>{nextAction?.title}</ThemedText>
              <ThemedText style={styles.primaryBody}>{nextAction?.body}</ThemedText>
            </View>
            <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
          </Pressable>
        ) : workoutState === "first" ? (
          <View testID="home-first-workout" style={[styles.quietAction, { backgroundColor: colors.inputBackground }]}>
            <ThemedText style={styles.quietActionTitle}>Your first workout starts here</ThemedText>
            <ThemedText style={{ color: colors.icon }}>Choose a program to put a workout on your calendar.</ThemedText>
            <Pressable testID="home-find-program" accessibilityRole="button" onPress={() => router.push("/programs")} style={actionStyle(styles.compactAction)}>
              <ThemedText style={{ color: colors.text, fontWeight: "700" }}>Browse programs</ThemedText>
            </Pressable>
          </View>
        ) : workoutState === "complete" ? (
          <View testID="home-week-complete" style={[styles.quietAction, { backgroundColor: colors.inputBackground }]}>
            <ThemedText style={styles.quietActionTitle}>Your week is complete</ThemedText>
            <ThemedText style={{ color: colors.icon }}>No unfinished workout is scheduled next. Your training history is ready whenever you are.</ThemedText>
            <Pressable accessibilityRole="button" onPress={() => router.push("/workout/history")} style={actionStyle(styles.compactAction)}>
              <ThemedText style={{ color: colors.text, fontWeight: "700" }}>View history</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View testID="home-next-unavailable" style={[styles.quietAction, { backgroundColor: colors.inputBackground }]}>
            <ThemedText style={styles.quietActionTitle}>No next workout confirmed</ThemedText>
            <ThemedText style={{ color: colors.icon }}>Browse this week while we check your training history.</ThemedText>
          </View>
        )}

        {/* This Week Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderPadded}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              This Week
            </ThemedText>
            <Text style={[styles.workoutCount, { color: colors.icon }]}>
              {sortedWorkouts.length} workouts
            </Text>
          </View>

          {isLoading && sortedWorkouts.length === 0 ? (
            // Never render a prior account's week while the next one loads.
            <View style={styles.stateContainerPadded}>
              <View
                style={[
                  styles.loadingContainer,
                  { backgroundColor: colors.inputBackground },
                ]}
              >
                <ActivityIndicator size="large" color={colors.primaryButton} />
                <ThemedText style={styles.loadingText}>
                  Loading your week...
                </ThemedText>
              </View>
            </View>
          ) : error && sortedWorkouts.length === 0 ? (
            // Error state (only show when no data)
            <View style={styles.stateContainerPadded}>
              <View
                style={[
                  styles.errorContainer,
                  { backgroundColor: colors.inputBackground },
                ]}
              >
                <View
                  style={[
                    styles.errorIcon,
                    { backgroundColor: "rgba(255, 59, 48, 0.1)" },
                  ]}
                >
                  <Ionicons name="alert-circle" size={32} color="#FF3B30" />
                </View>
                <ThemedText style={styles.errorTitle}>
                  Unable to load workouts
                </ThemedText>
                <ThemedText style={styles.errorSubtitle}>{error}</ThemedText>
                <Pressable
                  testID="home-week-retry"
                  accessibilityRole="button"
                  accessibilityLabel="Retry weekly workouts"
                  onPress={() => refreshWeek({ force: false })}
                  style={actionStyle([
                    styles.retryButton,
                    { borderColor: colors.inputBorder },
                  ])}
                >
                  <Text style={[styles.retryButtonText, { color: colors.text }]}>Try Again</Text>
                </Pressable>
              </View>
            </View>
          ) : sortedWorkouts.length === 0 ? (
            // Empty state
            <View style={styles.stateContainerPadded}>
              <View
                style={[
                  styles.emptyContainer,
                  { backgroundColor: colors.inputBackground },
                ]}
              >
                <View
                  style={[
                    styles.emptyIcon,
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={32}
                    color={colors.icon}
                  />
                </View>
                <ThemedText style={styles.emptyTitle}>
                  No workouts scheduled
                </ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  Your weekly plan will appear here
                </ThemedText>
              </View>
            </View>
          ) : (
            // Workout cards carousel
            <FlatList
              ref={flatListRef}
              data={sortedWorkouts}
              renderItem={renderWorkoutCard}
              keyExtractor={(item) => item.workoutDayId}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
              ItemSeparatorComponent={() => (
                <View style={styles.cardSeparator} />
              )}
              snapToInterval={CARD_WIDTH + CARD_GAP}
              snapToAlignment="start"
              decelerationRate="fast"
              onScrollToIndexFailed={(info) => scrollToIndex(info.index)}
            />
          )}
        </View>

        {/* Quick Stats Section */}
        <View style={styles.sectionPadded}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Quick Stats
            </ThemedText>
          </View>

          <AnimatedCard delay={300}>
            <View testID="home-live-stats" style={[styles.statsRow, expandedText && styles.statsStack]}>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: colors.inputBackground },
                ]}
              >
                <View
                  style={[
                    styles.statIcon,
                  ]}
                >
                  <Ionicons
                    name="flame"
                    size={24}
                    color={colors.icon}
                  />
                </View>
                <ThemedText testID="home-stat-streak" style={styles.statValue}>
                  {statValue(stats?.streak)}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Day Streak</ThemedText>
              </View>

              <View
                style={[
                  styles.statCard,
                  { backgroundColor: colors.inputBackground },
                ]}
              >
                <View
                  style={[
                    styles.statIcon,
                  ]}
                >
                  <Ionicons
                    name="trophy"
                    size={24}
                    color={colors.icon}
                  />
                </View>
                <ThemedText testID="home-stat-workouts" style={styles.statValue}>
                  {statValue(stats?.totalCompleted)}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Workouts</ThemedText>
              </View>

              <View
                style={[
                  styles.statCard,
                  { backgroundColor: colors.inputBackground },
                ]}
              >
                <View
                  style={[
                    styles.statIcon,
                    { backgroundColor: "rgba(52, 199, 89, 0.1)" },
                  ]}
                >
                  <Ionicons name="fitness" size={24} color="#34C759" />
                </View>
                <ThemedText style={styles.statValue}>
                  {statValue(stats?.prsThisWeek)}
                </ThemedText>
                <ThemedText style={styles.statLabel}>PRs This Week</ThemedText>
              </View>
            </View>
          </AnimatedCard>
        </View>

        <View style={styles.sectionPadded}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Coach</ThemedText>
          </View>
          {coachCard.loading ? (
            <View testID="home-coach-loading" style={[styles.compactPanel, { backgroundColor: colors.inputBackground }]}>
              <ActivityIndicator color={colors.primaryButton} />
              <ThemedText style={{ color: colors.icon }}>Loading guidance…</ThemedText>
            </View>
          ) : coachCard.error ? (
            <View testID="home-coach-error" style={[styles.compactPanel, { backgroundColor: colors.inputBackground }]}>
              <ThemedText style={{ color: colors.icon, flex: 1 }}>Coach guidance is unavailable.</ThemedText>
              <Pressable testID="home-coach-retry" accessibilityRole="button" accessibilityLabel="Retry Coach guidance" onPress={() => void refreshCoachCard()} style={actionStyle(styles.compactAction)}>
                <ThemedText style={{ color: colors.text, fontWeight: "700" }}>Retry</ThemedText>
              </Pressable>
            </View>
          ) : coachItem ? (
            <Pressable
              testID="home-coach-action"
              accessibilityRole="button"
              accessibilityLabel={`Open Coach action: ${coachItem.title}`}
              onPress={() => openCoachItem(coachItem)}
              style={actionStyle([styles.coachPanel, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }])}
            >
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.panelLabel, { color: colors.icon }]}>For your next move</ThemedText>
                <ThemedText style={styles.coachTitle}>{coachItem.title}</ThemedText>
                <ThemedText style={[styles.coachBody, { color: colors.icon }]}>
                  {coachItem.weightData && !weightUnit
                    ? "Preparing your target…"
                    : coachItemPresentation(coachItem, weightUnit, equipmentWeights.dumbbellWeights, equipmentWeights.plateWeights).body}
                </ThemedText>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.icon} />
            </Pressable>
          ) : (
            <ThemedText testID="home-coach-empty" style={[styles.emptyLine, { color: colors.icon }]}>No unread Coach actions right now.</ThemedText>
          )}
        </View>

        <View style={styles.sectionPadded}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Last four weeks</ThemedText>
            <Pressable testID="home-trend-history" accessibilityRole="button" accessibilityLabel="View workout history" onPress={() => router.push("/workout/history")} style={actionStyle(styles.compactAction)}>
              <ThemedText style={{ color: colors.text, fontWeight: "700" }}>History</ThemedText>
            </Pressable>
          </View>
          {achievements.loading ? (
            <View testID="home-trend-loading" style={[styles.compactPanel, { backgroundColor: colors.inputBackground }]}>
              <ActivityIndicator color={colors.primaryButton} />
              <ThemedText style={{ color: colors.icon }}>Loading training trend…</ThemedText>
            </View>
          ) : achievements.error ? (
            <View testID="home-trend-error" style={[styles.compactPanel, { backgroundColor: colors.inputBackground }]}>
              <ThemedText style={{ color: colors.icon, flex: 1 }}>Training trend is unavailable.</ThemedText>
              <Pressable testID="home-trend-retry" accessibilityRole="button" accessibilityLabel="Retry training trend" onPress={() => void refreshAchievements()} style={actionStyle(styles.compactAction)}>
                <ThemedText style={{ color: colors.text, fontWeight: "700" }}>Retry</ThemedText>
              </Pressable>
            </View>
          ) : achievements.data?.total_completed === 0 ? (
            <View testID="home-trend-first-workout" style={[styles.trendPanel, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
              <ThemedText style={styles.quietActionTitle}>Your first workout starts the trend</ThemedText>
              <ThemedText style={{ color: colors.icon }}>Finish a session to see your weekly rhythm here.</ThemedText>
            </View>
          ) : achievements.data ? (
            <View testID="home-four-week-trend" style={[styles.trendPanel, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
              <View style={[styles.trendBars, expandedText && styles.trendBarsExpanded]}>
                {trendWeeks.map((week) => {
                  const label = week.is_current ? "This week" : new Date(`${week.week_start}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
                  return (
                    <View key={week.week_start} testID={`home-trend-week-${week.week_start}`} accessible accessibilityLabel={`${label}: ${week.completed_workouts} completed ${week.completed_workouts === 1 ? "workout" : "workouts"}${week.is_current ? ", week in progress" : ""}`} style={[styles.trendColumn, expandedText && styles.trendColumnExpanded]}>
                      <ThemedText style={styles.trendCount}>{week.completed_workouts}</ThemedText>
                      <View style={[styles.trendTrack, { backgroundColor: colors.inputBorder }]}>
                        <View style={[styles.trendFill, { height: week.completed_workouts === 0 ? 0 : Math.max(6, 64 * week.completed_workouts / trendMaximum), backgroundColor: week.is_current ? colors.electricBlue : colors.primaryButton }]} />
                      </View>
                      <ThemedText style={[styles.trendWeekLabel, { color: colors.icon }]}>{label}</ThemedText>
                    </View>
                  );
                })}
              </View>
              <ThemedText style={[styles.trendFootnote, { color: colors.icon }]}>Completed workouts · current week is still in progress</ThemedText>
            </View>
          ) : (
            <ThemedText testID="home-trend-empty" style={[styles.emptyLine, { color: colors.icon }]}>Training history will appear here after your first workout.</ThemedText>
          )}
        </View>
      </ScrollView>

      {/* Menu Popover */}
      {selectedWorkout && (
        <WorkoutCardMenu
          visible={menuVisible}
          title={selectedWorkout.title}
          subtitle={getMenuSubtitle(selectedWorkout)}
          items={getMenuItems(selectedWorkout)}
          anchorRect={menuAnchorRect}
          onDismiss={handleCloseMenu}
        />
      )}
    </SafeAreaView>
  );
};

export default Home;
