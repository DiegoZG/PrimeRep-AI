import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useContext,
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
  Text,
  View,
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
import { useWorkoutWeek } from "@/hooks/use-workout-week";
import type { WorkoutDay } from "@/interfaces/workouts";
import { AuthContext } from "@/utils/authContext";

import { CARD_GAP, CARD_WIDTH, styles } from "./index.styles";

// Day name abbreviations
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Gradient colors for workout cards (cycle through)
const CARD_GRADIENTS: [string, string][] = [
  ["#6a4ff5", "#4338ca"], // Purple
  ["#00D4FF", "#0096c7"], // Blue
  ["#FF6B6B", "#ee5a5a"], // Red
  ["#34C759", "#2da94e"], // Green
  ["#FF9500", "#e68600"], // Orange
];

const Home = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { token, user } = useContext(AuthContext);
  const flatListRef = useRef<FlatList>(null);

  // Store refs for overflow buttons to measure their positions
  const buttonRefs = useRef<Map<string, View | null>>(new Map());

  // Workout week context
  const {
    isLoading,
    error,
    refreshWeek,
    getSortedWorkouts,
    getHighlightedWorkout,
    getExerciseCount,
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

  // Today's date in YYYY-MM-DD format
  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Get sorted workouts and highlighted workout
  const sortedWorkouts = useMemo(() => getSortedWorkouts(), [getSortedWorkouts]);
  const highlightedWorkout = useMemo(
    () => getHighlightedWorkout(todayIso),
    [getHighlightedWorkout, todayIso]
  );

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
      if (token && sortedWorkouts.length === 0) {
        refreshWeek({ force: false });
      }
    }, [token, refreshWeek, sortedWorkouts.length])
  );

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
        scrollToIndex(highlightedIndex);
      }
    }, [sortedWorkouts.length, highlightedIndex, scrollToIndex])
  );

  // Handle pull-to-refresh (uses local state, not global isLoading)
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshWeek({ force: false });
    setIsRefreshing(false);
  }, [refreshWeek]);

  // Navigate to workout day detail
  const handleWorkoutPress = useCallback(
    (workoutDayId: string) => {
      router.push({
        pathname: "/workouts/[workoutDayId]",
        params: { workoutDayId },
      });
    },
    [router]
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

  // Handle share (stub)
  const handleShare = useCallback(() => {
    handleCloseMenu();
    // Share functionality stub - show alert for now
    Alert.alert("Share", "Share functionality coming soon!");
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
        label: "Share Workout",
        icon: "share-outline",
        onPress: handleShare,
      });

      return items;
    },
    [highlightedWorkout, handleRegenerateWeek, handleShare]
  );

  // Get menu subtitle text
  const getMenuSubtitle = (workout: WorkoutDay): string => {
    return `${getDayName(workout.date)} • ${workout.durationMinutes} min`;
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
    const gradientColors = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
    const exerciseCount = getExerciseCount(workout);

    return (
      <AnimatedCard delay={100 + index * 50}>
        <Pressable
          testID="workout-card"
          onPress={() => handleWorkoutPress(workout.workoutDayId)}
          style={({ pressed }) => [
            styles.workoutCard,
            highlighted && styles.workoutCardHighlighted,
            { opacity: pressed ? 0.95 : 1 },
          ]}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.workoutCardGradient}
          />

          {/* Day badge */}
          <View style={styles.dayBadge}>
            <Text style={styles.dayBadgeText}>{getDayName(workout.date)}</Text>
            {today && (
              <View style={styles.todayIndicator}>
                <Text style={styles.todayText}>TODAY</Text>
              </View>
            )}
          </View>

          {/* Overflow menu button */}
          <View
            ref={(ref) => {
              buttonRefs.current.set(workout.workoutDayId, ref);
            }}
            collapsable={false}
          >
            <Pressable
              onPress={() => handleOpenMenu(workout)}
              style={styles.overflowButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Workout options"
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.workoutContent}>
            <Text style={styles.workoutTitle} numberOfLines={1}>
              {workout.title}
            </Text>
            <Text style={styles.workoutSubtitle}>{workout.dayType}</Text>

            {/* Metrics */}
            <View style={styles.workoutMetrics}>
              <View style={styles.metric}>
                <Ionicons
                  name="time-outline"
                  size={14}
                  color="rgba(255, 255, 255, 0.85)"
                />
                <Text style={styles.metricText}>
                  {workout.durationMinutes} min
                </Text>
              </View>
              <View style={styles.metric}>
                <Ionicons
                  name="barbell-outline"
                  size={14}
                  color="rgba(255, 255, 255, 0.85)"
                />
                <Text style={styles.metricText}>{exerciseCount} exercises</Text>
              </View>
            </View>
          </View>

          {/* Highlighted indicator */}
          {highlighted && (
            <View style={styles.highlightIndicator}>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          )}
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
          <View>
            <ThemedText type="default" style={styles.greeting}>
              {getGreeting()},
            </ThemedText>
            <ThemedText type="title" style={styles.userName}>
              {user?.preferred_name || "Athlete"}
            </ThemedText>
          </View>
          <Pressable
            style={[
              styles.notificationButton,
              { backgroundColor: colors.inputBackground },
            ]}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={colors.text}
            />
          </Pressable>
        </View>

        {/* This Week Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderPadded}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              This Week
            </ThemedText>
            <Text style={[styles.workoutCount, { color: colors.placeholder }]}>
              {sortedWorkouts.length} workouts
            </Text>
          </View>

          {!hasLoadedOnce && isLoading && sortedWorkouts.length === 0 ? (
            // Loading state (only show for initial load when no data yet)
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
                  onPress={() => refreshWeek({ force: false })}
                  style={[
                    styles.retryButton,
                    { backgroundColor: colors.primaryButton },
                  ]}
                >
                  <Text style={styles.retryButtonText}>Try Again</Text>
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
                    { backgroundColor: "rgba(106, 79, 245, 0.1)" },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={32}
                    color={colors.primaryButton}
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
            <View style={styles.statsRow}>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: colors.inputBackground },
                ]}
              >
                <View
                  style={[
                    styles.statIcon,
                    { backgroundColor: "rgba(106, 79, 245, 0.1)" },
                  ]}
                >
                  <Ionicons
                    name="flame"
                    size={24}
                    color={colors.primaryButton}
                  />
                </View>
                <ThemedText style={styles.statValue}>0</ThemedText>
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
                    { backgroundColor: "rgba(0, 212, 255, 0.1)" },
                  ]}
                >
                  <Ionicons
                    name="trophy"
                    size={24}
                    color={colors.electricBlue}
                  />
                </View>
                <ThemedText style={styles.statValue}>0</ThemedText>
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
                <ThemedText style={styles.statValue}>0</ThemedText>
                <ThemedText style={styles.statLabel}>PRs This Week</ThemedText>
              </View>
            </View>
          </AnimatedCard>
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
