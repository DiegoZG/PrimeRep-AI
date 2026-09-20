import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Alert, FlatList, LayoutAnimation, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CoachBriefingItem, type CoachPalette } from "@/components/coach";
import { ThemedText } from "@/components/themed-text";
import { Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWorkoutWeek } from "@/hooks/use-workout-week";
import type { CoachFeedItem, CoachFeedResponse, CoachFeedView, CoachNextAction, CoachTarget } from "@/interfaces/coach";
import type { WorkoutDay } from "@/interfaces/workouts";
import { dismissCoachItem, getCoachFeed, markCoachItemRead } from "@/services/coachService";
import { getActiveProgram } from "@/services/programService";
import { listCompletedSessions } from "@/services/workoutLoggingService";
import { useActiveWorkout } from "@/utils/activeWorkoutContext";
import { AuthContext } from "@/utils/authContext";
import { coachTargetHref } from "@/utils/coachNavigation";
import { EquipmentWeightsContext } from "@/utils/equipmentWeightsContext";
import { localDateIso } from "@/utils/localDate";
import { loadWeightUnit, type WeightUnit } from "@/utils/weightUnits";

const PALETTES: Record<"light" | "dark", CoachPalette> = {
  light: {
    canvas: "#F6F7F4", surface: "#FFFFFF", ink: "#111312", ink2: "#626965", ink3: "#676F6A",
    accent: "#06628F", accentText: "#FFFFFF", accentSoft: "#E5F3F9", signal: "#8A6400",
    signalSoft: "#FFF5D6", success: "#237B52", neutralNode: "#7D8580", separator: "#D9DED9",
    error: "#A71914", errorSoft: "#FDECEA",
  },
  dark: {
    canvas: "#0B0D0C", surface: "#141816", ink: "#F4F7F3", ink2: "#A7B0AA", ink3: "#7C857F",
    accent: "#5CC8F5", accentText: "#06121A", accentSoft: "#103344", signal: "#FFCE3D",
    signalSoft: "#3A3215", success: "#68C794", neutralNode: "#737D77", separator: "#2B312D",
    error: "#FF817A", errorSoft: "#3B1B1A",
  },
};

type OwnedFeed = { ownerUserId: string; view: CoachFeedView; response: CoachFeedResponse };
type OwnedCompletedWorkoutIds = { ownerUserId: string; workoutDayIds: Set<string> };

const VIEW_OPTIONS: { value: CoachFeedView; label: string }[] = [
  { value: "now", label: "Now" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7Days", label: "Last 7 days" },
];

function exerciseCount(workout: WorkoutDay | null) {
  return workout?.blocks.reduce((total, block) => total + block.items.length, 0) ?? 0;
}

function Skeleton({ palette }: { palette: CoachPalette }) {
  const lines = [78, 50, 95, 68];
  return (
    <View testID="coach-loading" accessibilityLabel="Refreshing coach updates">
      <ThemedText style={[styles.refreshCopy, { color: palette.ink3 }]}>Refreshing coach updates</ThemedText>
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.skeletonRow}>
          <View style={styles.railColumn}>
            <View style={[styles.skeletonNode, { backgroundColor: palette.separator }]} />
            {row < 2 ? <View style={[styles.skeletonRail, { backgroundColor: palette.separator }]} /> : null}
          </View>
          <View style={styles.skeletonCopy}>
            {lines.map((width, index) => (
              <View key={index} style={[styles.skeletonLine, { backgroundColor: palette.separator, width: `${width}%`, height: index === 2 ? 12 : 8 }]} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function SectionRule({ title, trailing, palette }: { title: string; trailing?: string; palette: CoachPalette }) {
  return (
    <View style={styles.sectionRule}>
      <ThemedText style={[styles.sectionLabel, { color: palette.ink3 }]}>{title}</ThemedText>
      <View style={[styles.rule, { backgroundColor: palette.separator }]} />
      {trailing ? <ThemedText style={[styles.ruleTrailing, { color: palette.ink3 }]}>{trailing}</ThemedText> : null}
    </View>
  );
}

export default function CoachScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? "light";
  const palette = PALETTES[scheme];
  const { token, user } = useContext(AuthContext);
  const { activeWorkout, refreshActiveWorkout } = useActiveWorkout();
  const { weekPlan, getSortedWorkouts, syncCurrentWeek } = useWorkoutWeek();
  const equipmentWeights = useContext(EquipmentWeightsContext);
  const [ownedFeed, setOwnedFeed] = useState<OwnedFeed | null>(null);
  const [selectedView, setSelectedView] = useState<CoachFeedView>("now");
  const [activeTemplate, setActiveTemplate] = useState<{ ownerUserId: string; templateId: string | null } | null>(null);
  const [completedWorkoutIds, setCompletedWorkoutIds] = useState<OwnedCompletedWorkoutIds | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [reduceMotion, setReduceMotion] = useState(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit | null>(null);
  const firstRequestRef = useRef(0);
  const pageRequestRef = useRef(0);
  const activeProgramRequestRef = useRef(0);
  const completedSessionsRequestRef = useRef(0);
  const readMutationVersionsRef = useRef(new Map<string, number>());
  const dismissMutationVersionsRef = useRef(new Map<string, number>());
  const ownedFeedRef = useRef<OwnedFeed | null>(ownedFeed);
  ownedFeedRef.current = ownedFeed;
  const selectedViewRef = useRef<CoachFeedView>(selectedView);
  selectedViewRef.current = selectedView;
  const accountRef = useRef(`${user?.id ?? "guest"}:${token ?? "anonymous"}`);
  accountRef.current = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const userId = user?.id ?? null;
  const accountKey = accountRef.current;
  const response = ownedFeed?.ownerUserId === userId && ownedFeed.view === selectedView
    ? ownedFeed.response
    : null;
  const isHistory = selectedView !== "now";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const animateChange = useCallback(() => {
    if (reduceMotion) return;
    LayoutAnimation.configureNext({
      duration: 240,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  }, [reduceMotion]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    firstRequestRef.current += 1;
    pageRequestRef.current += 1;
    activeProgramRequestRef.current += 1;
    completedSessionsRequestRef.current += 1;
    readMutationVersionsRef.current.clear();
    dismissMutationVersionsRef.current.clear();
    setOwnedFeed(null);
    selectedViewRef.current = "now";
    setSelectedView("now");
    setActiveTemplate(null);
    setCompletedWorkoutIds(null);
    setInitialLoading(Boolean(token && userId));
    setRefreshing(false);
    setLoadingMore(false);
    setLoadError(null);
    setPageError(null);
    setMutationError(null);
    setExpandedIds(new Set());
    setBusyIds(new Set());
  }, [accountKey, token, userId]);

  const loadFirstPage = useCallback(async (
    source: "focus" | "pull" | "retry" | "filter",
    requestedView?: CoachFeedView,
  ) => {
    if (!token || !userId) return null;
    const feedView = requestedView ?? selectedViewRef.current;
    const requestId = ++firstRequestRef.current;
    pageRequestRef.current += 1;
    const requestAccount = accountKey;
    const currentOwnedFeed = ownedFeedRef.current;
    const existing = currentOwnedFeed?.ownerUserId === userId && currentOwnedFeed.view === feedView
      ? currentOwnedFeed
      : null;
    if (!existing) setInitialLoading(true);
    if (source === "pull") setRefreshing(true);
    setLoadingMore(false);
    setLoadError(null);
    setPageError(null);
    try {
      const feed = await getCoachFeed(token, localDateIso(), { view: feedView, timeZone });
      if (firstRequestRef.current !== requestId || accountRef.current !== requestAccount) return null;
      animateChange();
      const previousCount = existing?.response.items.length ?? 0;
      setOwnedFeed({ ownerUserId: userId, view: feedView, response: feed });
      if (source === "pull" && feed.items.length > previousCount) {
        const count = feed.items.length - previousCount;
        AccessibilityInfo.announceForAccessibility(`${count} new coach ${count === 1 ? "update" : "updates"} loaded.`);
      }
      return feed;
    } catch {
      if (firstRequestRef.current !== requestId || accountRef.current !== requestAccount) return null;
      setLoadError("Coach updates couldn’t be refreshed.");
      return null;
    } finally {
      if (firstRequestRef.current === requestId && accountRef.current === requestAccount) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [accountKey, animateChange, timeZone, token, userId]);

  const loadActiveTemplate = useCallback(async () => {
    if (!token || !userId) return;
    const requestId = ++activeProgramRequestRef.current;
    const requestAccount = accountKey;
    try {
      const programs = await getActiveProgram(token, localDateIso());
      if (activeProgramRequestRef.current !== requestId || accountRef.current !== requestAccount) return;
      setActiveTemplate({ ownerUserId: userId, templateId: programs?.current?.templateId ?? programs?.scheduled?.templateId ?? null });
    } catch {
      // Program metadata is optional; keep any same-account value already shown.
    }
  }, [accountKey, token, userId]);

  const loadCompletedWorkoutIds = useCallback(async () => {
    if (!token || !userId) return;
    const requestId = ++completedSessionsRequestRef.current;
    const requestAccount = accountKey;
    try {
      const sessions = await listCompletedSessions(token, 100, 0);
      if (completedSessionsRequestRef.current !== requestId || accountRef.current !== requestAccount) return;
      setCompletedWorkoutIds({
        ownerUserId: userId,
        workoutDayIds: new Set(sessions.items.map((session) => session.workoutDayId)),
      });
    } catch {
      if (completedSessionsRequestRef.current === requestId && accountRef.current === requestAccount) {
        setCompletedWorkoutIds(null);
      }
    }
  }, [accountKey, token, userId]);

  useFocusEffect(useCallback(() => {
    let focused = true;
    void loadWeightUnit().then((unit) => {
      if (focused) setWeightUnit(unit);
    });
    void refreshActiveWorkout();
    void syncCurrentWeek();
    void loadFirstPage("focus");
    void loadActiveTemplate();
    void loadCompletedWorkoutIds();
    return () => {
      focused = false;
      firstRequestRef.current += 1;
      pageRequestRef.current += 1;
      activeProgramRequestRef.current += 1;
      completedSessionsRequestRef.current += 1;
    };
  }, [loadActiveTemplate, loadCompletedWorkoutIds, loadFirstPage, refreshActiveWorkout, syncCurrentWeek]));

  const loadEarlier = useCallback(async () => {
    if (!token || !userId || !response?.hasMore || !response.nextCursor || loadingMore) return;
    const requestId = ++pageRequestRef.current;
    const requestAccount = accountKey;
    setLoadingMore(true);
    setPageError(null);
    try {
      const page = await getCoachFeed(token, localDateIso(), { cursor: response.nextCursor, view: selectedView, timeZone });
      if (pageRequestRef.current !== requestId || accountRef.current !== requestAccount) return;
      const current = ownedFeedRef.current?.ownerUserId === userId
        ? ownedFeedRef.current.response
        : response;
      const ids = new Set(current.items.map((item) => item.id));
      const additions = page.items.filter((item) => !ids.has(item.id));
      animateChange();
      setOwnedFeed({ ownerUserId: userId, view: selectedView, response: { ...current, items: [...current.items, ...additions], nextCursor: page.nextCursor, hasMore: page.hasMore, generatedAt: page.generatedAt } });
      AccessibilityInfo.announceForAccessibility(`${additions.length} earlier ${additions.length === 1 ? "update" : "updates"} loaded.`);
    } catch {
      if (pageRequestRef.current === requestId && accountRef.current === requestAccount) setPageError("Earlier guidance couldn’t load. Try again.");
    } finally {
      if (pageRequestRef.current === requestId && accountRef.current === requestAccount) setLoadingMore(false);
    }
  }, [accountKey, animateChange, loadingMore, response, selectedView, timeZone, token, userId]);

  const markRead = useCallback((item: CoachFeedItem, reason: "expanded" | "primaryAction") => {
    if (!token || !userId || item.readAt || readMutationVersionsRef.current.has(item.id)) return;
    const requestAccount = accountKey;
    const mutationVersion = (readMutationVersionsRef.current.get(item.id) ?? 0) + 1;
    const optimisticReadAt = new Date().toISOString();
    readMutationVersionsRef.current.set(item.id, mutationVersion);
    setBusyIds((current) => new Set(current).add(item.id));
    setOwnedFeed((current) => current?.ownerUserId === userId ? {
      ...current,
      response: { ...current.response, items: current.response.items.map((candidate) => candidate.id === item.id ? { ...candidate, readAt: optimisticReadAt } : candidate) },
    } : current);
    void markCoachItemRead(token, item.id, reason)
      .then((saved) => {
        if (
          accountRef.current !== requestAccount ||
          readMutationVersionsRef.current.get(item.id) !== mutationVersion
        ) return;
        setOwnedFeed((current) => current?.ownerUserId === userId ? {
          ...current,
          response: {
            ...current.response,
            items: current.response.items.map((candidate) =>
              candidate.id === item.id
                ? { ...candidate, readAt: saved.readAt }
                : candidate),
          },
        } : current);
      })
      .catch(() => {
        if (
          accountRef.current !== requestAccount ||
          readMutationVersionsRef.current.get(item.id) !== mutationVersion
        ) return;
        setOwnedFeed((current) => current?.ownerUserId === userId ? {
          ...current,
          response: {
            ...current.response,
            items: current.response.items.map((candidate) =>
              candidate.id === item.id && candidate.readAt === optimisticReadAt
                ? { ...candidate, readAt: item.readAt }
                : candidate),
          },
        } : current);
        setMutationError("Read status couldn’t be confirmed. This guidance remains unread.");
      })
      .finally(() => {
        if (
          accountRef.current === requestAccount &&
          readMutationVersionsRef.current.get(item.id) === mutationVersion
        ) {
          readMutationVersionsRef.current.delete(item.id);
          setBusyIds((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
        }
      });
  }, [accountKey, token, userId]);

  const openTarget = useCallback((target: CoachTarget) => {
    const href = coachTargetHref(target);
    if (href) router.push(href);
  }, [router]);

  const toggleDetail = useCallback((item: CoachFeedItem) => {
    const willExpand = !expandedIds.has(item.id);
    animateChange();
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
      return next;
    });
    if (willExpand && !isHistory) markRead(item, "expanded");
  }, [animateChange, expandedIds, isHistory, markRead]);

  const handleItemAction = useCallback((item: CoachFeedItem) => {
    markRead(item, "primaryAction");
    openTarget(item.target);
  }, [markRead, openTarget]);

  const confirmDismiss = useCallback((item: CoachFeedItem) => {
    if (!token || !userId || busyIds.has(item.id)) return;
    Alert.alert("Dismiss this guidance?", "It won’t appear again unless your training data changes meaningfully.", [
      { text: "Keep", style: "cancel" },
      { text: "Dismiss", style: "destructive", onPress: () => {
        const requestAccount = accountKey;
        const mutationVersion = (dismissMutationVersionsRef.current.get(item.id) ?? 0) + 1;
        const currentItems = ownedFeedRef.current?.ownerUserId === userId
          ? ownedFeedRef.current.response.items
          : [];
        const originalIndex = currentItems.findIndex((candidate) => candidate.id === item.id);
        const dismissedItem = originalIndex >= 0 ? currentItems[originalIndex] : item;
        const previousId = originalIndex > 0 ? currentItems[originalIndex - 1]?.id : null;
        const nextId = originalIndex >= 0 ? currentItems[originalIndex + 1]?.id ?? null : null;
        dismissMutationVersionsRef.current.set(item.id, mutationVersion);
        animateChange();
        setBusyIds((current) => new Set(current).add(item.id));
        setOwnedFeed((current) => current?.ownerUserId === userId ? { ...current, response: { ...current.response, items: current.response.items.filter((candidate) => candidate.id !== item.id) } } : current);
        void dismissCoachItem(token, item.id)
          .then(() => {
            if (
              accountRef.current === requestAccount &&
              dismissMutationVersionsRef.current.get(item.id) === mutationVersion
            ) {
              setOwnedFeed((current) => current?.ownerUserId === userId ? {
                ...current,
                response: { ...current.response, items: current.response.items.filter((candidate) => candidate.id !== item.id) },
              } : current);
              AccessibilityInfo.announceForAccessibility("Guidance dismissed.");
            }
          })
          .catch(() => {
            if (
              accountRef.current !== requestAccount ||
              dismissMutationVersionsRef.current.get(item.id) !== mutationVersion
            ) return;
            animateChange();
            setOwnedFeed((current) => {
              if (current?.ownerUserId !== userId || current.response.items.some((candidate) => candidate.id === item.id)) return current;
              const items = [...current.response.items];
              const nextIndex = nextId ? items.findIndex((candidate) => candidate.id === nextId) : -1;
              const previousIndex = previousId ? items.findIndex((candidate) => candidate.id === previousId) : -1;
              const restoreIndex = nextIndex >= 0
                ? nextIndex
                : previousIndex >= 0
                  ? previousIndex + 1
                  : Math.min(Math.max(originalIndex, 0), items.length);
              items.splice(restoreIndex, 0, dismissedItem);
              return { ...current, response: { ...current.response, items } };
            });
            setMutationError("Guidance couldn’t be dismissed. It was restored.");
            AccessibilityInfo.announceForAccessibility("Guidance couldn’t be dismissed and was restored.");
          })
          .finally(() => {
            if (
              accountRef.current !== requestAccount ||
              dismissMutationVersionsRef.current.get(item.id) !== mutationVersion
            ) return;
            dismissMutationVersionsRef.current.delete(item.id);
            setBusyIds((current) => { const next = new Set(current); next.delete(item.id); return next; });
          });
      } },
    ]);
  }, [accountKey, animateChange, busyIds, token, userId]);

  const sortedWorkouts = useMemo(() => getSortedWorkouts(), [getSortedWorkouts]);
  const completedIds = completedWorkoutIds?.ownerUserId === userId
    ? completedWorkoutIds.workoutDayIds
    : null;
  const fallbackWorkout = useMemo(() => completedIds
    ? sortedWorkouts.find((workout) => workout.date >= localDateIso() && !completedIds.has(workout.workoutDayId)) ?? null
    : null, [completedIds, sortedWorkouts]);
  const canonicalAction: CoachNextAction | null = response?.nextAction ?? null;
  const plannedTarget = canonicalAction?.target.type === "planned_workout" ? canonicalAction.target : null;
  const plannedWorkout = plannedTarget
    ? sortedWorkouts.find((workout) => workout.workoutDayId === plannedTarget.workoutDayId) ?? null
    : loadError && !canonicalAction ? fallbackWorkout : null;
  const activePlanWorkout = activeWorkout ? sortedWorkouts.find((workout) => workout.workoutDayId === activeWorkout.workoutDayId) ?? null : null;
  const activeTemplateId = activeTemplate?.ownerUserId === userId ? activeTemplate.templateId : null;
  const heroTemplateId = activePlanWorkout?.templateId ?? plannedWorkout?.templateId ?? activeTemplateId;
  const fallbackAction: CoachNextAction | null = plannedWorkout ? {
    type: "planned_workout", title: plannedWorkout.title,
    body: plannedWorkout.workoutIntent ?? `${exerciseCount(plannedWorkout)} exercises are ready for your next session.`,
    target: { type: "planned_workout", workoutDayId: plannedWorkout.workoutDayId, weekStart: weekPlan?.weekStart ?? "" },
  } : null;
  const displayedAction = canonicalAction ?? fallbackAction;
  const newCount = response?.items.filter((item) => !item.readAt).length ?? 0;
  const showActiveHero = Boolean(activeWorkout || displayedAction?.type === "active_workout");
  const showCaughtUp = !activeWorkout && (displayedAction?.type === "caught_up" || (response?.items.length === 0 && displayedAction?.type === "planned_workout" && Boolean(plannedWorkout?.date && plannedWorkout.date > localDateIso())));
  const hasFallbackTraining = !isHistory && Boolean(activeWorkout || fallbackAction);
  const showFullInitialError = Boolean(loadError && !response && !hasFallbackTraining);

  const openHero = useCallback(() => {
    if (activeWorkout) {
      router.push({ pathname: "/workout/active", params: activeWorkout.sessionId ? { sessionId: activeWorkout.sessionId } : { workoutDayId: activeWorkout.workoutDayId } });
    } else if (displayedAction) openTarget(displayedAction.target);
  }, [activeWorkout, displayedAction, openTarget, router]);

  const openProgram = useCallback(() => {
    if (heroTemplateId) router.push({ pathname: "/programs/[templateId]", params: { templateId: heroTemplateId } });
  }, [heroTemplateId, router]);

  const selectView = useCallback((view: CoachFeedView) => {
    if (view === selectedView) return;
    animateChange();
    selectedViewRef.current = view;
    setSelectedView(view);
    setInitialLoading(true);
    setRefreshing(false);
    setLoadingMore(false);
    setLoadError(null);
    setPageError(null);
    setMutationError(null);
    setExpandedIds(new Set());
    setBusyIds(new Set());
    void loadFirstPage("filter", view);
  }, [animateChange, loadFirstPage, selectedView]);

  const header = (
    <View>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText style={[styles.screenTitle, { color: palette.ink }]}>Coach</ThemedText>
          <ThemedText style={[styles.subtitle, { color: palette.ink2 }]}>Your next useful move</ThemedText>
        </View>
        <Pressable testID="coach-refresh" accessibilityRole="button" accessibilityLabel="Refresh coach updates" accessibilityState={{ busy: refreshing, disabled: refreshing }} disabled={refreshing} onPress={() => void loadFirstPage("pull")} style={[styles.refreshButton, { borderColor: palette.separator, backgroundColor: palette.surface }]}>
          <Ionicons name="refresh" size={18} color={palette.ink2} />
        </Pressable>
      </View>
      <View testID={refreshing ? "coach-refreshing" : response ? "coach-feed-ready" : undefined}>
        <ThemedText style={[styles.pullHint, { color: palette.ink3 }]}>{refreshing ? "Refreshing…" : "Pull to refresh"}</ThemedText>
      </View>

      <View
        testID="coach-view-filter"
        accessibilityLabel="Coach timeline period"
        style={[styles.viewFilter, { backgroundColor: palette.surface, borderColor: palette.separator }]}
      >
        {VIEW_OPTIONS.map((option) => {
          const selected = selectedView === option.value;
          return (
            <Pressable
              key={option.value}
              testID={`coach-view-${option.value}`}
              accessibilityRole="button"
              accessibilityLabel={`Show ${option.label.toLowerCase()} Coach guidance`}
              accessibilityState={{ selected }}
              onPress={() => selectView(option.value)}
              style={[styles.viewOption, selected && { backgroundColor: palette.accentSoft }]}
            >
              <ThemedText style={[styles.viewOptionText, { color: selected ? palette.accent : palette.ink2 }]}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {!isHistory && showActiveHero ? (
        <View testID="coach-hero-active" style={styles.hero}>
          <SectionRule title="WORKOUT IN PROGRESS" palette={palette} />
          <ThemedText style={[styles.heroTitle, { color: palette.ink }]}>{activeWorkout?.title ?? displayedAction?.title}</ThemedText>
          {activeWorkout ? <ThemedText style={[styles.heroMeta, { color: palette.ink2 }]}>{activeWorkout.completedSets} of {activeWorkout.totalSets || "—"} sets completed</ThemedText> : null}
          <ThemedText style={[styles.heroBody, { color: palette.ink }]}>{activeWorkout ? "Pick up where you left off. Your completed sets are saved on this device." : displayedAction?.body}</ThemedText>
          {activeWorkout && activeWorkout.totalSets > 0 ? <View style={[styles.progressTrack, { backgroundColor: palette.separator }]}><View style={[styles.progressFill, { backgroundColor: palette.accent, width: `${Math.min(100, activeWorkout.completedSets / activeWorkout.totalSets * 100)}%` }]} /></View> : null}
          <View style={styles.heroActions}>
            <Pressable testID="coach-resume-workout" accessibilityRole="button" accessibilityLabel={`Resume ${activeWorkout?.title ?? displayedAction?.title ?? "workout"}`} onPress={openHero} style={[styles.heroPrimary, { backgroundColor: palette.accent }]}><ThemedText style={[styles.heroPrimaryText, { color: palette.accentText }]}>Resume workout</ThemedText></Pressable>
            {heroTemplateId ? <Pressable testID="coach-view-program" accessibilityRole="button" accessibilityLabel="View active program" onPress={openProgram} style={[styles.heroSecondary, { borderColor: palette.separator }]}><ThemedText style={[styles.heroSecondaryText, { color: palette.accent }]}>View program</ThemedText></Pressable> : null}
          </View>
        </View>
      ) : !isHistory && showCaughtUp ? (
        <View testID="coach-hero-caught-up" style={styles.hero}>
          <SectionRule title="CAUGHT UP" palette={palette} />
          <ThemedText style={[styles.caughtUpTitle, { color: palette.ink }]}>You’re caught up</ThemedText>
          <ThemedText style={[styles.heroBody, { color: palette.ink2 }]}>There’s nothing you need to adjust right now.</ThemedText>
          {displayedAction?.type === "planned_workout" && plannedWorkout ? <View style={[styles.nextScheduled, { borderColor: palette.separator, backgroundColor: palette.surface }]}>
            <View style={styles.nextScheduledCopy}><ThemedText style={[styles.nextScheduledLabel, { color: palette.ink3 }]}>NEXT SCHEDULED</ThemedText><ThemedText style={[styles.nextScheduledTitle, { color: palette.ink }]}>{plannedWorkout.title}</ThemedText><ThemedText style={[styles.nextScheduledMeta, { color: palette.ink2 }]}>{plannedWorkout.date} · {plannedWorkout.durationMinutes} min · {exerciseCount(plannedWorkout)} exercises</ThemedText></View>
            <Pressable testID="coach-preview-workout" accessibilityRole="button" accessibilityLabel={`Preview ${plannedWorkout.title}`} onPress={openHero} style={[styles.previewButton, { borderColor: palette.separator }]}><ThemedText style={[styles.previewText, { color: palette.accent }]}>Preview</ThemedText></Pressable>
          </View> : null}
        </View>
      ) : !isHistory && displayedAction && displayedAction.type !== "caught_up" ? (
        <View testID="coach-hero-next" style={styles.hero}>
          <SectionRule title="NEXT MOVE" palette={palette} />
          <ThemedText style={[styles.heroTitle, { color: palette.ink }]}>{displayedAction.title}</ThemedText>
          {plannedWorkout ? <ThemedText style={[styles.heroMeta, { color: palette.ink2 }]}>{plannedWorkout.date === localDateIso() ? "Today" : plannedWorkout.date} · {plannedWorkout.durationMinutes} min · {exerciseCount(plannedWorkout)} exercises</ThemedText> : null}
          <ThemedText style={[styles.heroBody, { color: palette.ink }]}>{displayedAction.body}</ThemedText>
          <View style={styles.heroActions}>
            <Pressable testID="coach-open-workout" accessibilityRole="button" accessibilityLabel={`Open ${displayedAction.title}`} onPress={openHero} style={[styles.heroPrimary, { backgroundColor: palette.accent }]}><ThemedText style={[styles.heroPrimaryText, { color: palette.accentText }]}>Open workout</ThemedText></Pressable>
            {heroTemplateId ? <Pressable testID="coach-view-program" accessibilityRole="button" accessibilityLabel="View active program" onPress={openProgram} style={[styles.heroSecondary, { borderColor: palette.separator }]}><ThemedText style={[styles.heroSecondaryText, { color: palette.accent }]}>View program</ThemedText></Pressable> : null}
          </View>
        </View>
      ) : null}

      {showFullInitialError ? <View testID="coach-initial-error" accessibilityRole="alert" style={styles.fullError}><Ionicons name="cloud-offline-outline" size={28} color={palette.error} /><ThemedText style={[styles.fullErrorTitle, { color: palette.ink }]}>{isHistory ? "Coach history is unavailable" : "Coach guidance is unavailable"}</ThemedText><ThemedText style={[styles.fullErrorBody, { color: palette.ink2 }]}>{isHistory ? "We couldn’t load guidance from this period. Check your connection and try again." : "We couldn’t load guidance or confirm an unfinished workout. Check your connection and try again."}</ThemedText><Pressable testID="coach-retry" accessibilityRole="button" accessibilityLabel="Try loading coach updates again" onPress={() => void loadFirstPage("retry")} style={[styles.tryAgain, { borderColor: palette.error }]}><ThemedText style={[styles.tryAgainText, { color: palette.error }]}>Try again</ThemedText></Pressable></View> : loadError ? <View testID="coach-inline-error" accessibilityRole="alert" style={[styles.errorBanner, { backgroundColor: palette.errorSoft }]}><Ionicons name="alert-circle-outline" size={18} color={palette.error} /><View style={styles.errorCopy}><ThemedText style={[styles.errorTitle, { color: palette.ink }]}>Coach updates couldn’t be refreshed.</ThemedText><ThemedText style={[styles.errorBody, { color: palette.ink2 }]}>{response ? "Showing guidance from your last successful refresh." : activeWorkout ? "Your active workout is still available above." : "Your next confirmed unfinished workout is still available above."}</ThemedText></View><Pressable testID="coach-retry" accessibilityRole="button" accessibilityLabel="Try loading coach updates again" onPress={() => void loadFirstPage("retry")} style={[styles.tryAgain, { borderColor: palette.error }]}><ThemedText style={[styles.tryAgainText, { color: palette.error }]}>Try again</ThemedText></Pressable></View> : null}
      {!isHistory && mutationError ? <View testID="coach-mutation-error" accessibilityRole="alert" style={styles.mutationErrorRow}><ThemedText style={[styles.mutationErrorText, { color: palette.error }]}>{mutationError}</ThemedText><Pressable accessibilityRole="button" accessibilityLabel="Dismiss error message" onPress={() => setMutationError(null)} style={styles.closeError}><Ionicons name="close" size={18} color={palette.error} /></Pressable></View> : null}
      {initialLoading && !response ? <Skeleton palette={palette} /> : null}
      {response?.items.length ? <SectionRule title={selectedView === "now" ? "BRIEFING" : selectedView === "yesterday" ? "YESTERDAY" : "PREVIOUS 7 DAYS"} trailing={!isHistory && newCount ? `${newCount} new` : undefined} palette={palette} /> : null}
      {isHistory && response && response.items.length === 0 ? (
        <View testID={`coach-history-empty-${selectedView}`} style={styles.historyEmpty}>
          <Ionicons name="time-outline" size={24} color={palette.ink3} />
          <ThemedText style={[styles.historyEmptyTitle, { color: palette.ink }]}>No guidance from this period</ThemedText>
          <ThemedText style={[styles.historyEmptyBody, { color: palette.ink2 }]}>Your current coaching stays in Now. Completed workouts remain available in Workout History.</ThemedText>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView testID="coach-screen" style={[styles.safeArea, { backgroundColor: palette.canvas }]} edges={["top"]}>
      <FlatList
        data={response?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <CoachBriefingItem item={item} palette={palette} expanded={expandedIds.has(item.id)} busy={!isHistory && busyIds.has(item.id)} historical={isHistory} isLast={index === (response?.items.length ?? 0) - 1} weightUnit={weightUnit} dumbbellWeights={equipmentWeights.dumbbellWeights} plateWeights={equipmentWeights.plateWeights} onToggleDetail={() => toggleDetail(item)} onPrimaryAction={() => handleItemAction(item)} onDismiss={() => confirmDismiss(item)} />}
        ListHeaderComponent={header}
        ListFooterComponent={response?.hasMore || pageError ? <View style={styles.footer}>{pageError ? <ThemedText accessibilityRole="alert" style={[styles.pageError, { color: palette.error }]}>{pageError}</ThemedText> : null}<Pressable testID="coach-earlier-guidance" accessibilityRole="button" accessibilityLabel={isHistory ? "Load more guidance from this period" : "Load earlier guidance"} accessibilityState={{ disabled: loadingMore, busy: loadingMore }} disabled={loadingMore} onPress={() => void loadEarlier()} style={[styles.earlierButton, { borderColor: palette.separator, opacity: loadingMore ? 0.55 : 1 }]}><ThemedText style={[styles.earlierText, { color: palette.accent }]}>{loadingMore ? "Loading guidance…" : isHistory ? "More from this period" : "Earlier guidance"}</ThemedText></Pressable></View> : <View style={styles.bottomSpace} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => void loadFirstPage("pull")}
        accessibilityRole="list"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: 6 },
  headerCopy: { flex: 1, minWidth: 0 },
  screenTitle: { fontFamily: Fonts.sans, fontSize: 30, lineHeight: 32.4, fontWeight: "700" },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  refreshButton: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pullHint: { textAlign: "center", fontSize: 11, lineHeight: 15, marginTop: 16, marginBottom: 6 },
  viewFilter: { flexDirection: "row", borderWidth: 1, borderRadius: 13, padding: 3, marginTop: 4, marginBottom: 22 },
  viewOption: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  viewOptionText: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  refreshCopy: { textAlign: "center", fontSize: 11, lineHeight: 15, marginBottom: 18 },
  sectionRule: { flexDirection: "row", alignItems: "center", minHeight: 24, marginTop: 2, marginBottom: 7, gap: 9 },
  sectionLabel: { fontFamily: Fonts.mono, fontSize: 9.5, lineHeight: 12, fontWeight: "700", letterSpacing: 0.85 },
  rule: { height: StyleSheet.hairlineWidth, flex: 1 },
  ruleTrailing: { fontFamily: Fonts.mono, fontSize: 9.5, lineHeight: 12 },
  hero: { marginBottom: 26 },
  heroTitle: { fontFamily: Fonts.sans, fontSize: 32, lineHeight: 33.92, fontWeight: "700", marginTop: 2 },
  caughtUpTitle: { fontFamily: Fonts.sans, fontSize: 27, lineHeight: 30, fontWeight: "700", marginTop: 4 },
  heroMeta: { fontFamily: Fonts.mono, fontSize: 13, lineHeight: 18, marginTop: 3 },
  heroBody: { fontSize: 14, lineHeight: 21, marginTop: 15, maxWidth: 350 },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 14 },
  progressFill: { height: 4, borderRadius: 2 },
  heroActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 17 },
  heroPrimary: { minHeight: 52, flexGrow: 1, minWidth: 180, borderRadius: 13, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  heroPrimaryText: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  heroSecondary: { minHeight: 52, borderRadius: 13, borderWidth: 1, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  heroSecondaryText: { fontSize: 14, lineHeight: 19, fontWeight: "700" },
  nextScheduled: { borderWidth: 1, borderRadius: 13, marginTop: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  nextScheduledCopy: { flex: 1, minWidth: 0 },
  nextScheduledLabel: { fontFamily: Fonts.mono, fontSize: 9, lineHeight: 12, fontWeight: "700", letterSpacing: 0.7 },
  nextScheduledTitle: { fontSize: 16, lineHeight: 21, fontWeight: "700", marginTop: 3 },
  nextScheduledMeta: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  previewButton: { minWidth: 72, minHeight: 44, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  previewText: { fontSize: 12, lineHeight: 17, fontWeight: "700" },
  errorBanner: { borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 9, marginBottom: 18 },
  fullError: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 34, marginBottom: 18 },
  fullErrorTitle: { fontSize: 20, lineHeight: 25, fontWeight: "700", marginTop: 12, textAlign: "center" },
  fullErrorBody: { fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 15, textAlign: "center", maxWidth: 330 },
  errorCopy: { flex: 1, minWidth: 0 },
  errorTitle: { fontSize: 12, lineHeight: 16, fontWeight: "700" },
  errorBody: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  tryAgain: { minWidth: 70, minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  tryAgainText: { fontSize: 11, lineHeight: 15, fontWeight: "700" },
  mutationErrorRow: { minHeight: 44, flexDirection: "row", alignItems: "center", marginBottom: 12 },
  mutationErrorText: { flex: 1, fontSize: 12, lineHeight: 17 },
  closeError: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  skeletonRow: { flexDirection: "row", minHeight: 88 },
  railColumn: { width: 22, alignItems: "center" },
  skeletonNode: { width: 9, height: 9, borderRadius: 2, marginTop: 6 },
  skeletonRail: { width: StyleSheet.hairlineWidth, flex: 1, marginTop: 4 },
  skeletonCopy: { flex: 1, marginLeft: 12, gap: 8, paddingBottom: 22 },
  skeletonLine: { borderRadius: 4 },
  historyEmpty: { alignItems: "center", paddingHorizontal: 26, paddingVertical: 38 },
  historyEmptyTitle: { fontSize: 18, lineHeight: 23, fontWeight: "700", marginTop: 10, textAlign: "center" },
  historyEmptyBody: { fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 320, textAlign: "center" },
  footer: { alignItems: "center", paddingBottom: 28, paddingTop: 2 },
  pageError: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  earlierButton: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  earlierText: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  bottomSpace: { height: 28 },
});
