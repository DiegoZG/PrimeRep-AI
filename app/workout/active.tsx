import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, AppState, findNodeHandle, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, TouchableWithoutFeedback, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ExerciseInfoSheet } from "@/components/workout/ExerciseInfoSheet";
import { WorkoutArrangementSheets } from "@/components/workout/WorkoutArrangementSheets";
import { useWorkoutArrangement } from "@/hooks/use-workout-arrangement";
import { adoptSessionArrangement, reorderWorkout } from "@/utils/workoutArrangement";
import { ExerciseListSheet } from "@/components/workout/ExerciseListSheet";
import { RestTimer } from "@/components/workout/RestTimer";
import { SetInputRow } from "@/components/workout/SetInputRow";
import { WeightUnitControl } from "@/components/workout/WeightUnitControl";
import { StatusBar } from "expo-status-bar";
import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWorkoutWeek } from "@/hooks/use-workout-week";
import { useWorkoutLayout } from "@/utils/workoutLayoutContext";
import type { WorkoutLayout } from "@/utils/workoutLayoutPreference";
import type { RestContext, SetState, WorkoutDay, WorkoutItem } from "@/interfaces/workouts";
import {
  abandonSession,
  completeSession,
  fetchLastSetsForExercises,
  getActiveSession,
  getSession,
  getUserExerciseNote,
  type LastSet,
} from "@/services/workoutLoggingService";
import { mapApiWorkoutDay } from "@/services/workoutWeekService";
import { resolveFriendlyLoad } from "@/utils/attainableLoads";
import { AuthContext } from "@/utils/authContext";
import { useActiveWorkout } from "@/utils/activeWorkoutContext";
import { EquipmentWeightsContext } from "@/utils/equipmentWeightsContext";
import {
  clearActiveWorkout,
  continueWorkoutLogging,
  createClientId,
  loadActiveWorkout,
  queueWorkoutCompletion,
  replayPendingWorkoutOperations,
  retryFailedWorkoutOperations,
  saveActiveWorkout,
  saveWorkoutSetEntries,
  type LocalActiveWorkout,
  type PendingWorkoutOperation,
} from "@/utils/activeWorkoutStore";
import {
  convertWeightString,
  formatWeightInput,
  formatWeightLabel,
  fromKg,
  loadWeightUnit,
  saveWeightUnit,
  type WeightUnit,
} from "@/utils/weightUnits";
import { enteredSets, setEntryKey, validateSetEntry } from "@/utils/workoutSetEntries";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function findHistoryForSet(history: LastSet[] | undefined, setNumber: number): LastSet | undefined {
  if (!history || history.length === 0) return undefined;
  return history.find((h) => h.setNumber === setNumber) || history[0];
}

function formatLastTimeHint(
  match: LastSet | undefined,
  weightUnit: WeightUnit
): string | undefined {
  if (!match) return undefined;
  if (match.weightKg != null) {
    return `${formatWeightLabel(match.weightKg, weightUnit)} × ${match.reps}`;
  }
  return `${match.reps} reps`;
}

function prescribedSetStates(exercises: WorkoutItem[]): SetState[] {
  return exercises.flatMap((item) =>
    Array.from({ length: item.prescription.sets }, (_, index) => ({
      exerciseId: item.exercise.id,
      setNumber: index + 1,
      reps: "",
      weight: "",
      confirmed: false,
      syncing: false,
      syncStatus: "synced" as const,
      logId: null,
    }))
  );
}

function mergeServerLogs(
  prescribed: SetState[],
  logs: { id: string; exerciseId: string; setNumber: number; reps: number; weightKg: number | null; version: number }[],
  unit: WeightUnit,
  deletedLogs: { id: string; exerciseId: string; setNumber: number; reps: number; weightKg: number | null; version: number }[] = []
): SetState[] {
  const bySet = new Map(logs.map((log) => [`${log.exerciseId}:${log.setNumber}`, log]));
  const deletedBySet = new Map(deletedLogs.map((log) => [`${log.exerciseId}:${log.setNumber}`, log]));
  const merged = prescribed.map((set) => {
    const log = bySet.get(`${set.exerciseId}:${set.setNumber}`);
    const deletedLog = deletedBySet.get(`${set.exerciseId}:${set.setNumber}`);
    if (deletedLog) {
      return {
        ...set,
        confirmed: true,
        deleted: true,
        deletedLogId: deletedLog.id,
        logId: deletedLog.id,
        version: deletedLog.version,
        syncing: false,
        syncStatus: "synced" as const,
      };
    }
    return log
      ? { ...set, reps: String(log.reps), weight: log.weightKg == null ? "" : formatWeightInput(fromKg(log.weightKg, unit)), weightKg: log.weightKg, confirmed: true, syncing: false, syncStatus: "synced" as const, logId: log.id, version: log.version }
      : set;
  });
  const prescribedKeys = new Set(prescribed.map((set) => `${set.exerciseId}:${set.setNumber}`));
  for (const log of logs) {
    if (prescribedKeys.has(`${log.exerciseId}:${log.setNumber}`)) continue;
    merged.push({
      exerciseId: log.exerciseId,
      setNumber: log.setNumber,
      reps: String(log.reps),
      weight: log.weightKg == null ? "" : formatWeightInput(fromKg(log.weightKg, unit)),
      weightKg: log.weightKg,
      confirmed: true,
      syncing: false,
      syncStatus: "synced",
      logId: log.id,
      version: log.version,
      isAdded: true,
    });
  }
  for (const deletedLog of deletedLogs) {
    if (prescribedKeys.has(`${deletedLog.exerciseId}:${deletedLog.setNumber}`)) continue;
    merged.push({
      exerciseId: deletedLog.exerciseId,
      setNumber: deletedLog.setNumber,
      reps: String(deletedLog.reps),
      weight: deletedLog.weightKg == null ? "" : formatWeightInput(fromKg(deletedLog.weightKg, unit)),
      weightKg: deletedLog.weightKg,
      confirmed: true,
      syncing: false,
      syncStatus: "synced",
      logId: deletedLog.id,
      deleted: true,
      deletedLogId: deletedLog.id,
      version: deletedLog.version,
      isAdded: true,
    });
  }
  return merged;
}

function mergePersistedSets(prescribed: SetState[], persisted: SetState[]): SetState[] {
  const bySet = new Map(persisted.map((set) => [`${set.exerciseId}:${set.setNumber}`, set]));
  const merged = prescribed.map((set) => bySet.get(`${set.exerciseId}:${set.setNumber}`) ?? set);
  const prescribedKeys = new Set(prescribed.map((set) => `${set.exerciseId}:${set.setNumber}`));
  persisted.forEach((set) => {
    if (!prescribedKeys.has(`${set.exerciseId}:${set.setNumber}`)) merged.push(set);
  });
  return merged;
}

function mergeReplaySets(current: SetState[], replayed: SetState[]): SetState[] {
  const bySet = new Map(replayed.map((set) => [`${set.exerciseId}:${set.setNumber}`, set]));
  const merged = current.map((set) => {
    const replayedSet = bySet.get(`${set.exerciseId}:${set.setNumber}`);
    if (!replayedSet || (set.confirmed && !replayedSet.confirmed)) return set;
    return {
      ...replayedSet,
      reps: set.reps || replayedSet.reps,
      weight: set.weight || replayedSet.weight,
      editing: set.editing,
      editDraft: set.editDraft,
      hasUnsavedInput: set.hasUnsavedInput,
    };
  });
  const keys = new Set(merged.map((set) => `${set.exerciseId}:${set.setNumber}`));
  for (const set of replayed) if (!keys.has(`${set.exerciseId}:${set.setNumber}`)) merged.push(set);
  return merged;
}

function reconcileSetSyncState(sets: SetState[], operations: PendingWorkoutOperation[]): SetState[] {
  const mutationBySet = new Map<string, PendingWorkoutOperation>();
  for (const operation of operations) {
    if (operation.type === "set" || operation.type === "update_set" || operation.type === "delete_set" || operation.type === "restore_set") {
      mutationBySet.set(`${operation.payload.exerciseId}:${operation.payload.setNumber}`, operation);
    }
  }
  return sets.map((set) => {
    const operation = mutationBySet.get(`${set.exerciseId}:${set.setNumber}`);
    if (!operation) {
      if (set.confirmed && !set.deleted && !set.logId) {
        return { ...set, syncing: false, syncStatus: "pending" as const };
      }
      return set.confirmed ? { ...set, syncing: false, syncStatus: "synced" as const } : set;
    }
    return {
      ...set,
      syncing: operation.status === "retrying",
      syncStatus: operation.status === "failed" ? "failed" as const : "pending" as const,
    };
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale, height } = useWindowDimensions();
  const expandedLayout = fontScale > 1.3 || height - insets.top - insets.bottom < 480;
  const { workoutDayId, sessionId: requestedSessionId } = useLocalSearchParams<{ workoutDayId?: string; sessionId?: string }>();
  const colorScheme = useColorScheme();
  const colors = { ...Colors[colorScheme ?? "light"], placeholder: colorScheme === "dark" ? Colors.dark.placeholder : "#68727A" };
  const { token, user } = useContext(AuthContext);
  const equipmentWeights = useContext(EquipmentWeightsContext);
  const { markWorkoutTerminal } = useActiveWorkout();
  const { getWorkoutById, isLoading: isWeekLoading, refreshWeek, planningRefreshRequired } = useWorkoutWeek();
  const { layout, isReady: isLayoutReady, isSaving: isLayoutSaving, setLayout } = useWorkoutLayout();
  const allExercisesLayout = isLayoutReady && layout === "all";
  const allExercisesLayoutRef = useRef(allExercisesLayout); allExercisesLayoutRef.current = allExercisesLayout;
  const planningBarrierRef = useRef(planningRefreshRequired); planningBarrierRef.current = planningRefreshRequired;

  const [originalWorkout, setOriginalWorkout] = useState<WorkoutDay | null>(null);
  const [targetReviewExerciseIds, setTargetReviewExerciseIds] = useState<string[] | null | undefined>();
  const [arrangementRevision, setArrangementRevision] = useState<number | undefined>();
  const [snapshotWorkout, setSnapshotWorkout] = useState<WorkoutDay | null>(null);
  const [legacySession, setLegacySession] = useState<Awaited<ReturnType<typeof getActiveSession>>>(null);
  const [isResolvingSession, setIsResolvingSession] = useState(Boolean(requestedSessionId));
  const [canRestoreRequestedSession, setCanRestoreRequestedSession] = useState(!requestedSessionId);
  const planWorkout = workoutDayId ? getWorkoutById(workoutDayId) : null;
  const workout = snapshotWorkout ?? planWorkout;
  const [hasRequestedWorkout, setHasRequestedWorkout] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function resolveSessionWorkout() {
      if (!user) {
        if (!cancelled) setIsResolvingSession(false);
        return;
      }
      const local = await loadActiveWorkout(user.id).catch(() => null);
      const matchingLocal = local?.workoutSnapshot && (!requestedSessionId || local.serverSessionId === requestedSessionId)
        ? local
        : null;
      if (!token) {
        if (!cancelled) {
          if (matchingLocal) { setSnapshotWorkout(matchingLocal.effectiveWorkout ?? matchingLocal.workoutSnapshot!); setOriginalWorkout(matchingLocal.workoutSnapshot); setArrangementRevision(matchingLocal.arrangementRevision); setTargetReviewExerciseIds(matchingLocal.targetReviewExerciseIds); }
          setCanRestoreRequestedSession(Boolean(matchingLocal) || !requestedSessionId);
          setIsResolvingSession(false);
        }
        return;
      }
      const server = requestedSessionId
        ? await getSession(token, requestedSessionId).catch(() => null)
        : await getActiveSession(token).catch(() => null);
      if (cancelled) return;
      if (requestedSessionId && server?.status !== "in_progress") {
        if (server?.status === "completed" || server?.status === "abandoned") markWorkoutTerminal();
        if (matchingLocal) { setSnapshotWorkout(matchingLocal.effectiveWorkout ?? matchingLocal.workoutSnapshot!); setOriginalWorkout(matchingLocal.workoutSnapshot); setArrangementRevision(matchingLocal.arrangementRevision); setTargetReviewExerciseIds(matchingLocal.targetReviewExerciseIds); }
        setCanRestoreRequestedSession(Boolean(matchingLocal) && !server);
        setIsResolvingSession(false);
        if (server) router.replace("/(tabs)");
        return;
      }
      if (server) {
        if (server.effectiveWorkout ?? server.workoutSnapshot) {
          let effective = mapApiWorkoutDay((server.effectiveWorkout ?? server.workoutSnapshot)!);
          const pendingOrder = matchingLocal?.operations.find((operation) => operation.type === "order" && !operation.payload.conflict);
          if (pendingOrder?.type === "order") {
            try { effective = reorderWorkout(effective, pendingOrder.payload.exerciseIds); } catch { /* Review a changed server workout before applying this order. */ }
          }
          setSnapshotWorkout(effective);
          setOriginalWorkout(server.workoutSnapshot ? mapApiWorkoutDay(server.workoutSnapshot) : null);
          setArrangementRevision(server.arrangementRevision);
        } else if (server.recoveryRequired) {
          setLegacySession(server);
        }
      }
      if (matchingLocal && !server) { setSnapshotWorkout(matchingLocal.effectiveWorkout ?? matchingLocal.workoutSnapshot!); setOriginalWorkout(matchingLocal.workoutSnapshot); setArrangementRevision(matchingLocal.arrangementRevision); setTargetReviewExerciseIds(matchingLocal.targetReviewExerciseIds); }
      setCanRestoreRequestedSession(Boolean(server) || Boolean(matchingLocal) || !requestedSessionId);
      setIsResolvingSession(false);
    }
    void resolveSessionWorkout();
    return () => { cancelled = true; };
  }, [user, token, requestedSessionId, router, markWorkoutTerminal]);

  useEffect(() => {
    if (workout || !workoutDayId || isWeekLoading || hasRequestedWorkout) return;
    setHasRequestedWorkout(true);
    void refreshWeek({ force: false });
  }, [workout, workoutDayId, isWeekLoading, hasRequestedWorkout, refreshWeek]);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [finishStatus, setFinishStatus] = useState<"idle" | "syncing" | "pendingOffline" | "pendingSets" | "failed">("idle");
  const [isRestoring, setIsRestoring] = useState(true);
  const [clientSessionId, setClientSessionId] = useState(createClientId);
  const navigationKey = `${user?.id ?? "guest"}:${requestedSessionId ?? workout?.workoutDayId ?? "new"}:${clientSessionId}`;
  const navigationIdentityRef = useRef({ key: navigationKey, epoch: 0 });
  if (navigationIdentityRef.current.key !== navigationKey) navigationIdentityRef.current = { key: navigationKey, epoch: navigationIdentityRef.current.epoch + 1 };
  const navigationEpoch = navigationIdentityRef.current.epoch;
  const navigationRevisionRef = useRef(0), navigationMountedRef = useRef(true), navigationBlockedRef = useRef(true);
  const arrangementBusyRef = useRef<() => boolean>(() => true);
  const navigationSnapshotRef = useRef<() => LocalActiveWorkout | null>(() => null);
  const manualNavigationRef = useRef<(exerciseId: string) => void>(() => {});
  const [startedAt, setStartedAt] = useState(Date.now);
  const [operations, setOperations] = useState<PendingWorkoutOperation[]>([]);
  const hasPendingReplacement = operations.some((operation) => operation.type === "replace");
  const [persistedRevision, setPersistedRevision] = useState(0);
  const replayInFlightRef = useRef(false);
  const deferredPersistenceRef = useRef(false);
  const operationsRef = useRef<PendingWorkoutOperation[]>([]);
  const [storageError, setStorageError] = useState(false);
  const [isSavingEntries, setIsSavingEntries] = useState(false);
  const savingEntriesRef = useRef(false);
  const savingEntriesEpochRef = useRef<number | null>(null);
  const [entryIssues, setEntryIssues] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState("");
  const [finishReviewVisible, setFinishReviewVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const accountRef = useRef(user?.id);
  accountRef.current = user?.id;
  const [didComplete, setDidComplete] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const isTerminalRef = useRef(false);
  const isFinishingRef = useRef(false);
  const isContinuingRef = useRef(false);
  const workoutRevisionRef = useRef(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // All exercises flattened from blocks
  const exercises = useMemo(() => {
    if (!workout) return [];
    return workout.blocks.flatMap((block) => block.items);
  }, [workout]);

  // Initialize set tracking state from prescription
  const [sets, setSets] = useState<SetState[]>([]);
  const setsRef = useRef<SetState[]>([]);
  const [workoutNote, setWorkoutNote] = useState<string | null>(null);
  const [exerciseFeedback, setExerciseFeedback] = useState<Record<string, { effort: "easy" | "right" | "hard" | null; rir: number | null }>>({});
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string | null>>({});
  const [noteEditorVisible, setNoteEditorVisible] = useState(false);
  const [noteEditorTarget, setNoteEditorTarget] = useState<"workout" | "exercise">("workout");
  const [noteEditorExerciseId, setNoteEditorExerciseId] = useState<string | null>(null);
  const noteEditorEpochRef = useRef<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [feedbackEditorVisible, setFeedbackEditorVisible] = useState(false);
  const [feedbackEditorExerciseId, setFeedbackEditorExerciseId] = useState<string | null>(null);
  const feedbackEditorEpochRef = useRef<number | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState<{ effort: "easy" | "right" | "hard" | null; rir: number | null }>({ effort: null, rir: null });
  const [collapsedExercises, setCollapsedExercises] = useState<Record<string, boolean>>({});
  const [restDoneExerciseId, setRestDoneExerciseId] = useState<string | null>(null);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hidden = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);

  useEffect(() => {
    operationsRef.current = operations;
  }, [operations]);

  useEffect(() => {
    setsRef.current = sets;
  }, [sets]);

  useEffect(() => {
    if (exercises.length > 0 && sets.length === 0) {
      setSets(prescribedSetStates(exercises));
    }
  }, [exercises, sets.length]);

  // ── Weight unit (display preference; API always stores kg) ─────────────────

  const [weightUnit, setWeightUnit] = useState<WeightUnit>("LB");
  const [unitReady, setUnitReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadWeightUnit().then((unit) => {
      if (!cancelled) {
        setWeightUnit(unit);
        setUnitReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleWeightUnit = useCallback(() => {
    const next: WeightUnit = weightUnit === "KG" ? "LB" : "KG";
    setSets((prev) =>
      prev.map((s) => ({
        ...s,
        weight: convertWeightString(s.weight, weightUnit, next),
        editDraft: s.editDraft ? { ...s.editDraft, weight: convertWeightString(s.editDraft.weight, weightUnit, next) } : undefined,
      }))
    );
    setWeightUnit(next);
    setOperations((previous) => previous.map((operation) => operation.type === "update_set" ? {
      ...operation, payload: { ...operation.payload,
        displayWeight: convertWeightString(operation.payload.displayWeight, weightUnit, next),
        previousWeight: convertWeightString(operation.payload.previousWeight, weightUnit, next) },
    } : operation));
    void saveWeightUnit(next);
  }, [weightUnit]);

  // ── Last-sets prefetch (for pre-fill + PR detection) ──────────────────────

  const [lastSetsByExercise, setLastSetsByExercise] = useState<Record<string, LastSet[]>>({});
  const [lastSetsLoaded, setLastSetsLoaded] = useState(false);
  const hasPrefilledRef = useRef(false);

  useEffect(() => {
    async function loadLastSets() {
      if (!token || exercises.length === 0 || lastSetsLoaded) return;
      const exerciseIds = exercises.map((item) => item.exercise.id);
      const map = await fetchLastSetsForExercises(token, exerciseIds);
      setLastSetsByExercise(map);
      setLastSetsLoaded(true);
    }
    loadLastSets();
  }, [token, exercises, lastSetsLoaded]);

  // Pre-fill blank, unconfirmed set inputs exactly once. Weight precedence:
  //   1. suggestedWeightKg from prescription (progression engine)
  //   2. Last logged weight from history
  // Reps always come from history. Wait for unit preference so values match display unit.
  useEffect(() => {
    const inventoryReady = equipmentWeights.hasLoaded || Boolean(equipmentWeights.error);
    if (!unitReady || !inventoryReady || !lastSetsLoaded || sets.length === 0 || hasPrefilledRef.current) return;
    hasPrefilledRef.current = true;
    setSets((prev) =>
      prev.map((s) => {
        if (s.confirmed || s.weight || s.reps) return s;
        const item = exercises.find((e) => e.exercise.id === s.exerciseId);
        const match = findHistoryForSet(lastSetsByExercise[s.exerciseId], s.setNumber);
        const suggestedKg = item?.prescription.suggestedWeightKg;
        const friendlySuggestion = suggestedKg != null && item
          ? resolveFriendlyLoad({
              targetWeightKg: suggestedKg,
              currentWeightKg: item.prescription.suggestedPreviousWeightKg,
              reason: item.prescription.suggestedWeightReason ?? "hold",
              equipmentIds: item.exercise.requiredEquipmentIds,
              loadProfile: item.exercise.loadProfile,
              weightUnit,
              dumbbellWeights: equipmentWeights.dumbbellWeights,
              plateWeights: equipmentWeights.plateWeights,
            })
          : null;
        const prefillWeight =
          friendlySuggestion
            ? formatWeightInput(fromKg(friendlySuggestion.workingWeightKg, weightUnit))
            : match?.weightKg != null
            ? formatWeightInput(fromKg(match.weightKg, weightUnit))
            : s.weight;
        const prefillReps = match?.reps != null ? String(match.reps) : s.reps;
        if (!prefillWeight && !prefillReps) return s;
        return { ...s, weight: prefillWeight, reps: prefillReps };
      })
    );
  }, [
    unitReady,
    lastSetsLoaded,
    sets.length,
    lastSetsByExercise,
    weightUnit,
    exercises,
    equipmentWeights.dumbbellWeights,
    equipmentWeights.error,
    equipmentWeights.hasLoaded,
    equipmentWeights.plateWeights,
  ]);

  // Confirmed set count (overall, across all exercises)
  const confirmedCount = useMemo(() => sets.filter((s) => s.confirmed && !s.deleted).length, [sets]);
  const totalSets = useMemo(() => sets.filter((set) => !set.deleted || !set.isAdded).length, [sets]);
  const pendingSetOperations = useMemo(() => {
    const bySet = new Map<string, PendingWorkoutOperation>();
    for (const operation of operations) {
      if (operation.type === "set" || operation.type === "update_set" || operation.type === "delete_set" || operation.type === "restore_set") {
        bySet.set(`${operation.payload.exerciseId}:${operation.payload.setNumber}`, operation);
      }
    }
    return bySet;
  }, [operations]);

  const getExerciseProgress = useCallback(
    (exerciseId: string) => {
      const exerciseSets = sets.filter((set) => set.exerciseId === exerciseId && (!set.deleted || !set.isAdded));
      return {
        confirmed: exerciseSets.filter((set) => set.confirmed && !set.deleted).length,
        total: exerciseSets.length,
      };
    },
    [sets]
  );

  // ── Timer ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isRestoring) {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRestoring, startedAt]);

  // ── Rest-end sound (loaded once, replayed on each rest completion) ────────

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadSound() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/sounds/rest-done.m4a")
        );
        if (isMounted) {
          soundRef.current = sound;
        } else {
          sound.unloadAsync();
        }
      } catch (err) {
        console.warn("Failed to load rest-done sound:", err);
      }
    }
    loadSound();
    return () => {
      isMounted = false;
      soundRef.current?.unloadAsync();
    };
  }, []);

  const playRestEndFeedback = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    soundRef.current?.replayAsync().catch((err) => {
      console.warn("Failed to play rest-done sound:", err);
    });
  }, []);

  // ── One-exercise-at-a-time navigation ──────────────────────────────────────

  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(null);
  const currentExerciseIndex = Math.max(0, exercises.findIndex((item) => item.exercise.id === currentExerciseId));
  const setCurrentExerciseIndex = useCallback((next: number | ((index: number) => number)) => {
    if (navigationIdentityRef.current.epoch !== navigationEpoch) return;
    const index = typeof next === "function" ? next(currentExerciseIndex) : next;
    const id = exercises[index]?.exercise.id;
    if (id) manualNavigationRef.current(id);
  }, [currentExerciseIndex, exercises, navigationEpoch]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const sheetVisibleRef = useRef(sheetVisible); sheetVisibleRef.current = sheetVisible;
  const exerciseOverlayVisibleRef = useRef(false);
  const chooseExerciseTrigger = useRef<React.ElementRef<typeof Pressable>>(null), listExerciseTrigger = useRef<React.ElementRef<typeof Pressable>>(null);
  const listFocusRef = useRef<{ epoch: number; target: React.ElementRef<typeof Pressable> | null; infoSource?: "focus" | "all"; exerciseId?: string } | null>(null);
  const focusInfoTrigger = useRef<React.ElementRef<typeof Pressable>>(null);
  const allInfoTriggers = useRef(new Map<string, React.ElementRef<typeof Pressable>>());
  const [infoSheetVisible, setInfoSheetVisible] = useState(false);
  const [infoExerciseId, setInfoExerciseId] = useState<string | null>(null);
  const infoSheetEpochRef = useRef<number | null>(null);
  const currentItem: WorkoutItem | undefined = exercises[currentExerciseIndex];
  const currentExerciseRef = useRef(currentItem?.exercise.id); currentExerciseRef.current = currentItem?.exercise.id;
  const exercisesRef = useRef(exercises); exercisesRef.current = exercises;
  const isCurrentWorkout = useCallback(() => navigationMountedRef.current
    && navigationIdentityRef.current.epoch === navigationEpoch && navigationIdentityRef.current.key === navigationKey
    && accountRef.current === user?.id, [navigationEpoch, navigationKey, user?.id]);
  const canActOnWorkout = useCallback(() => isCurrentWorkout() && !navigationBlockedRef.current && !arrangementBusyRef.current()
    && !savingEntriesRef.current && !isFinishingRef.current && !isTerminalRef.current
    && !operationsRef.current.some((operation) => operation.type === "replace"), [isCurrentWorkout]);
  const canActOnExercise = useCallback((exerciseId: string) => canActOnWorkout()
    && exercisesRef.current.some((item) => item.exercise.id === exerciseId), [canActOnWorkout]);
  const currentFriendlySuggestion = useMemo(() => {
    const targetWeightKg = currentItem?.prescription.suggestedWeightKg;
    if (targetWeightKg == null || !currentItem || !unitReady) return null;
    return resolveFriendlyLoad({
      targetWeightKg,
      currentWeightKg: currentItem.prescription.suggestedPreviousWeightKg,
      reason: currentItem.prescription.suggestedWeightReason ?? "hold",
      equipmentIds: currentItem.exercise.requiredEquipmentIds,
      loadProfile: currentItem.exercise.loadProfile,
      weightUnit,
      dumbbellWeights: equipmentWeights.dumbbellWeights,
      plateWeights: equipmentWeights.plateWeights,
    });
  }, [
    currentItem,
    equipmentWeights.dumbbellWeights,
    equipmentWeights.plateWeights,
    unitReady,
    weightUnit,
  ]);

  useEffect(() => {
    if (!token || isRestoring) return;
    const ids = allExercisesLayout ? exercises.map((item) => item.exercise.id) : currentItem ? [currentItem.exercise.id] : [];
    const missing = ids.filter((id) => !Object.prototype.hasOwnProperty.call(exerciseNotes, id));
    if (missing.length === 0) return;
    let cancelled = false;
    void Promise.all(missing.map(async (id) => {
      try { return [id, (await getUserExerciseNote(token, id))?.note ?? null] as const; }
      catch { return [id, null] as const; }
    })).then((entries) => {
      if (cancelled || navigationIdentityRef.current.epoch !== navigationEpoch) return;
      setExerciseNotes((current) => {
        const next = { ...current };
        for (const [id, note] of entries) if (!Object.prototype.hasOwnProperty.call(next, id)) next[id] = note;
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [token, isRestoring, allExercisesLayout, exercises, currentItem, exerciseNotes, navigationEpoch]);

  // ── Rest timer state ───────────────────────────────────────────────────────

  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restTotalSeconds, setRestTotalSeconds] = useState(0);
  const [restContext, setRestContext] = useState<RestContext | null>(null);
  const restStateRef = useRef({ endsAt: restEndsAt, context: restContext });
  restStateRef.current = { endsAt: restEndsAt, context: restContext };
  const [pendingTransition, setPendingTransition] = useState<{
    sourceExerciseId: string;
    epoch: number;
    nextExerciseId: string;
    nextName: string;
  } | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTransitionRef = useRef(pendingTransition); pendingTransitionRef.current = pendingTransition;
  const restoredWorkoutKey = useRef<string | null>(null);
  const cancelExerciseTransition = useCallback(() => {
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = null;
    pendingTransitionRef.current = null;
    setPendingTransition(null);
  }, []);
  useEffect(() => {
    navigationMountedRef.current = true;
    return () => { navigationMountedRef.current = false; navigationIdentityRef.current.epoch += 1; if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current); };
  }, []);
  useEffect(() => {
    cancelExerciseTransition(); setSheetVisible(false); listFocusRef.current = null;
    infoSheetEpochRef.current = null; setInfoSheetVisible(false); setInfoExerciseId(null);
    noteEditorEpochRef.current = null; feedbackEditorEpochRef.current = null;
    setNoteEditorVisible(false); setFeedbackEditorVisible(false);
    if (savingEntriesEpochRef.current !== navigationEpoch) {
      savingEntriesEpochRef.current = null;
      savingEntriesRef.current = false;
      setIsSavingEntries(false);
    }
  }, [navigationEpoch, cancelExerciseTransition]);
  const selectExercise = useCallback((exerciseId: string, dismissKeyboard = true) => {
    if (!navigationMountedRef.current || navigationIdentityRef.current.epoch !== navigationEpoch || navigationBlockedRef.current || arrangementBusyRef.current() || savingEntriesRef.current || isFinishingRef.current || isTerminalRef.current || operationsRef.current.some((operation) => operation.type === "replace")) return false;
    const snapshot = navigationSnapshotRef.current();
    const index = exercisesRef.current.findIndex((item) => item.exercise.id === exerciseId);
    if (!snapshot || index < 0 || snapshot.userId !== accountRef.current) return false;
    const context = restStateRef.current.context ? { ...restStateRef.current.context, suppressAutoAdvance: true } : null;
    navigationRevisionRef.current += 1;
    cancelExerciseTransition(); if (dismissKeyboard) Keyboard.dismiss();
    currentExerciseRef.current = exerciseId;
    restStateRef.current = { ...restStateRef.current, context };
    sheetVisibleRef.current = false;
    setCurrentExerciseId(exerciseId); setRestContext(context); setSheetVisible(false); setSaveMessage("");
    snapshot.currentExerciseId = exerciseId; snapshot.currentExerciseIndex = index; snapshot.restContext = context; snapshot.restEndsAt = restStateRef.current.endsAt;
    snapshot.revision = ++workoutRevisionRef.current;
    void saveActiveWorkout(snapshot, () => navigationMountedRef.current && navigationIdentityRef.current.epoch === navigationEpoch).then(() => {
      if (!navigationMountedRef.current || navigationIdentityRef.current.epoch !== navigationEpoch) return;
      setPersistedRevision((revision) => revision + 1);
    }).catch(() => { if (navigationMountedRef.current && navigationIdentityRef.current.epoch === navigationEpoch) setStorageError(true); });
    return true;
  }, [navigationEpoch, cancelExerciseTransition]);
  manualNavigationRef.current = selectExercise;
  useEffect(() => {
    setCollapsedExercises({}); setRestDoneExerciseId(null);
  }, [navigationEpoch]);
  useEffect(() => {
    if (!allExercisesLayout || isRestoring) return;
    const context = restStateRef.current.context;
    if ((context && !context.suppressAutoAdvance) || pendingTransitionRef.current) {
      const id = currentExerciseRef.current;
      if (id) selectExercise(id, false);
    }
  }, [allExercisesLayout, isRestoring, isSavingEntries, restContext, pendingTransition, selectExercise]);
  useEffect(() => {
    if (restEndsAt !== null || !allExercisesLayout) setRestDoneExerciseId(null);
  }, [restEndsAt, allExercisesLayout]);
  const openExerciseList = useCallback((target: React.ElementRef<typeof Pressable> | null) => {
    if (navigationIdentityRef.current.epoch !== navigationEpoch || navigationBlockedRef.current || arrangementBusyRef.current() || savingEntriesRef.current || isFinishingRef.current) return;
    Keyboard.dismiss(); listFocusRef.current = { epoch: navigationEpoch, target }; sheetVisibleRef.current = true; setSheetVisible(true);
  }, [navigationEpoch]);
  const restoreExerciseListFocus = useCallback(() => {
    const saved = listFocusRef.current;
    if (!saved) return;
    if (!navigationMountedRef.current || saved.epoch !== navigationIdentityRef.current.epoch) { listFocusRef.current = null; return; }
    if (sheetVisibleRef.current || exerciseOverlayVisibleRef.current) return;
    listFocusRef.current = null;
    const target = saved.infoSource === "focus"
      ? !allExercisesLayoutRef.current && currentExerciseRef.current === saved.exerciseId ? focusInfoTrigger.current : null
      : saved.infoSource === "all"
        ? allExercisesLayoutRef.current ? allInfoTriggers.current.get(saved.exerciseId ?? "") ?? null : null
        : saved.target;
    if (!target) return;
    if (typeof findNodeHandle === "function" && typeof AccessibilityInfo?.setAccessibilityFocus === "function") { const node = findNodeHandle(target); if (node) AccessibilityInfo.setAccessibilityFocus(node); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!user || !workout || !unitReady || (requestedSessionId && !canRestoreRequestedSession)) return;
      const restoreKey = `${user.id}:${workout.workoutDayId}`;
      if (restoredWorkoutKey.current === restoreKey) {
        setIsRestoring(false);
        return;
      }
      const [saved, serverActive] = await Promise.all([
        loadActiveWorkout(user.id).catch(() => null),
        token ? getActiveSession(token).catch(() => null) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      if (planningBarrierRef.current && !saved && !serverActive) return;
      restoredWorkoutKey.current = restoreKey;

      // Never overwrite a valid active workout just because a user tapped a
      // different card. Resume the authoritative server workout first.
      const activeSessionId = serverActive?.id ?? saved?.serverSessionId;
      if (activeSessionId && requestedSessionId !== activeSessionId) {
        router.replace({ pathname: "/workout/active", params: { sessionId: activeSessionId } });
        return;
      }

      if (!saved) {
        if (serverActive) {
          setClientSessionId(serverActive.clientSessionId ?? clientSessionId);
          setSessionId(serverActive.id);
          setStartedAt(new Date(serverActive.startedAt).getTime());
          setArrangementRevision(serverActive.arrangementRevision);
          setOriginalWorkout(serverActive.workoutSnapshot ? mapApiWorkoutDay(serverActive.workoutSnapshot) : null);
          setSets(mergeServerLogs(prescribedSetStates(exercises), serverActive.setLogs, weightUnit, serverActive.deletedSetLogs ?? []));
          setWorkoutNote(serverActive.workoutNote);
          setExerciseFeedback(Object.fromEntries(serverActive.exerciseFeedback.map((feedback) => [feedback.exerciseId, { effort: feedback.effort, rir: feedback.rir }])));
        } else {
          const newClientSessionId = createClientId();
          setArrangementRevision(0);
          setOriginalWorkout(workout);
          setClientSessionId(newClientSessionId);
          setOperations([{ id: createClientId(), type: "create", status: "pending", payload: {
            workoutDayId: workout.workoutDayId,
            workoutDate: workout.date,
            dayType: workout.dayType,
            clientSessionId: newClientSessionId,
          }}]);
        }
      } else {
        const reconciledClientSessionId = serverActive?.clientSessionId ?? saved.clientSessionId;
        const reconciledOperations = serverActive
          ? saved.operations.filter((operation) => operation.type !== "create")
          : saved.operations;
        setClientSessionId(reconciledClientSessionId);
        setSessionId(serverActive?.id ?? saved.serverSessionId);
        setStartedAt(saved.startedAt);
        workoutRevisionRef.current = saved.revision;
        const restoredArrangement = serverActive ? adoptSessionArrangement(saved, serverActive) : saved;
        const pendingOrder = saved.operations.find((operation) => operation.type === "order" && !operation.payload.conflict);
        if (pendingOrder?.type === "order" && restoredArrangement.effectiveWorkout) {
          try { restoredArrangement.effectiveWorkout = reorderWorkout(restoredArrangement.effectiveWorkout, pendingOrder.payload.exerciseIds); } catch { /* A conflicting order remains available for review. */ }
        }
        setSnapshotWorkout(restoredArrangement.effectiveWorkout ?? restoredArrangement.workoutSnapshot);
        setOriginalWorkout(restoredArrangement.workoutSnapshot);
        setArrangementRevision(restoredArrangement.arrangementRevision); setTargetReviewExerciseIds(restoredArrangement.targetReviewExerciseIds);
        const restoredExercises = (restoredArrangement.effectiveWorkout ?? restoredArrangement.workoutSnapshot)?.blocks.flatMap((block) => block.items) ?? exercises;
        setCurrentExerciseId(restoredArrangement.currentExerciseId ?? restoredExercises[saved.currentExerciseIndex]?.exercise.id ?? null);
        setRestEndsAt(saved.restEndsAt);
        setRestTotalSeconds(saved.restTotalSeconds);
        setRestContext(saved.restContext ? { ...saved.restContext, exerciseId: saved.restContext.exerciseId ?? (saved.effectiveWorkout ?? saved.workoutSnapshot)?.blocks.flatMap((block) => block.items)[saved.restContext.exerciseIndex ?? 0]?.exercise.id } : null);
        setWorkoutNote(serverActive?.workoutNote ?? saved.workoutNote ?? null);
        setExerciseFeedback(serverActive ? Object.fromEntries(serverActive.exerciseFeedback.map((feedback) => [feedback.exerciseId, { effort: feedback.effort, rir: feedback.rir }])) : saved.exerciseFeedback ?? {});
        setExerciseNotes(saved.exerciseNotes ?? {});
        const restoredSets = mergePersistedSets(prescribedSetStates(restoredExercises), restoredArrangement.sets);
        setSets(serverActive ? mergeServerLogs(restoredSets, serverActive.setLogs, weightUnit, serverActive.deletedSetLogs ?? []) : restoredSets);
        setOperations(reconciledOperations);
        const queuedCompletion = reconciledOperations.find((operation) => operation.type === "complete");
        if (queuedCompletion) setFinishStatus(queuedCompletion.status === "failed" ? "failed" : "pendingOffline");
      }
      if (!cancelled) setIsRestoring(false);
    }
    void restore();
    return () => { cancelled = true; };
  }, [user, workout, token, unitReady, weightUnit, exercises, router, clientSessionId, requestedSessionId, canRestoreRequestedSession, planningRefreshRequired]);

  // Store every draft, confirmed set, timer timestamp, and queued operation before
  // attempting network sync. This is what lets process termination be recoverable.
  useEffect(() => {
    if (isTerminalRef.current || isFinishingRef.current || savingEntriesRef.current || finishStatus !== "idle" || isRestoring || !user || !workout || sets.length === 0) return;
    if (replayInFlightRef.current) {
      deferredPersistenceRef.current = true;
      return;
    }
    const latestSets = setsRef.current;
    const latestOperations = operationsRef.current;
    void saveActiveWorkout({
      userId: user.id,
      workoutDayId: workout.workoutDayId,
      workoutDate: workout.date,
      dayType: workout.dayType,
      workoutSnapshot: originalWorkout ?? workout, effectiveWorkout: workout, arrangementRevision, targetReviewExerciseIds, currentExerciseId: currentExerciseId ?? exercises[0]?.exercise.id,
      clientSessionId,
      serverSessionId: sessionId,
      startedAt,
      currentExerciseIndex,
      restEndsAt,
      restTotalSeconds,
      restContext,
      sets: latestSets,
      operations: latestOperations,
      workoutNote,
      exerciseFeedback,
      exerciseNotes,
      revision: ++workoutRevisionRef.current,
    }, isCurrentWorkout).then(() => {
      if (!isCurrentWorkout()) return;
      setStorageError(false);
      setPersistedRevision((revision) => revision + 1);
    }).catch(() => { if (isCurrentWorkout()) setStorageError(true); });
  }, [originalWorkout, arrangementRevision, targetReviewExerciseIds, currentExerciseId, exercises, finishStatus, isRestoring, user, workout, sets, clientSessionId, sessionId, startedAt, currentExerciseIndex, restEndsAt, restTotalSeconds, restContext, operations, workoutNote, exerciseFeedback, exerciseNotes, isCurrentWorkout]);

  const replayPendingWrites = useCallback(async () => {
    if (!token || !user || navigationIdentityRef.current.epoch !== navigationEpoch || replayInFlightRef.current || savingEntriesRef.current || isFinishingRef.current) return;
    const selectedRevision = navigationRevisionRef.current;
    replayInFlightRef.current = true;
    try {
      const result = await replayPendingWorkoutOperations(token, user.id);
      if (accountRef.current !== user.id || navigationIdentityRef.current.epoch !== navigationEpoch) return;
      if (!result.workout) return;
      if (isFinishingRef.current && !result.completed && !result.abandoned) return;
      if (isContinuingRef.current && !result.completed && !result.abandoned) return;
      const operationIdsAtStart = new Set(result.startedOperationIds);
      workoutRevisionRef.current = Math.max(workoutRevisionRef.current, result.workout.revision);
      setSessionId(result.workout.serverSessionId);
      if (result.workout.effectiveWorkout) setSnapshotWorkout(result.workout.effectiveWorkout);
      if (result.workout.workoutSnapshot) setOriginalWorkout(result.workout.workoutSnapshot);
      setArrangementRevision(result.workout.arrangementRevision); setTargetReviewExerciseIds(result.workout.targetReviewExerciseIds);
      if (result.workout.currentExerciseId && navigationRevisionRef.current === selectedRevision) setCurrentExerciseId(result.workout.currentExerciseId);
      const conflictOperations = result.workout.operations.filter(
        (operation): operation is Extract<PendingWorkoutOperation, { type: "update_set" }> =>
          operation.type === "update_set" && operation.status === "failed" && operation.payload.conflict === true
      );
      const conflictOperationIds = new Set(conflictOperations.map((operation) => operation.id));
      const failedUpdateKeys = new Set(
        result.workout.operations
          .filter((operation): operation is Extract<PendingWorkoutOperation, { type: "update_set" }> => operation.type === "update_set" && operation.status === "failed")
          .map((operation) => `${operation.payload.exerciseId}:${operation.payload.setNumber}`)
      );
      const replayedSetsByKey = new Map(result.workout.sets.map((set) => [`${set.exerciseId}:${set.setNumber}`, set]));
      const remainingById = new Map(result.workout.operations.map((operation) => [operation.id, operation]));
      const nextOperations = [
        ...result.workout.operations.filter((operation) => !conflictOperationIds.has(operation.id)),
        ...operationsRef.current.filter((operation) => !operationIdsAtStart.has(operation.id) && !remainingById.has(operation.id) && !conflictOperationIds.has(operation.id)),
      ];
      setSets((current) => {
        const effectiveIds = new Set((result.workout!.effectiveWorkout ?? result.workout!.workoutSnapshot)?.blocks.flatMap((block) => block.items.map((item) => item.exercise.id)));
        const merged = mergeReplaySets(current, result.workout!.sets).filter((set) =>
          set.confirmed || set.logId || (effectiveIds.has(set.exerciseId) && (replayedSetsByKey.has(`${set.exerciseId}:${set.setNumber}`) || set.hasUnsavedInput || set.editing || set.isAdded))
        ).map((set) =>
          failedUpdateKeys.has(`${set.exerciseId}:${set.setNumber}`)
            ? replayedSetsByKey.get(`${set.exerciseId}:${set.setNumber}`) ?? set
            : set
        );
        const nextSets = reconcileSetSyncState(merged, nextOperations);
        setsRef.current = nextSets;
        return nextSets;
      });
      operationsRef.current = nextOperations;
      setOperations(nextOperations);
      if (conflictOperations.length > 0) {
        try {
          const latest = await getSession(token, result.workout.serverSessionId!);
          const latestById = new Map(latest.setLogs.map((set) => [set.id, set]));
          setSets((current) => current.map((set) => {
            const latestSet = set.logId ? latestById.get(set.logId) : undefined;
            return latestSet
              ? {
                  ...set,
                  reps: String(latestSet.reps),
                  weight: latestSet.weightKg == null ? "" : formatWeightInput(fromKg(latestSet.weightKg, weightUnit)),
                  version: latestSet.version,
                  syncing: false,
                  syncStatus: "synced",
                }
              : set;
          }));
          Alert.alert("Set updated elsewhere", "The latest saved value was restored.");
        } catch {
          Alert.alert("Couldn’t refresh set", "Your previous value was restored. Try again when you’re back online.");
        }
      }
      if (result.abandoned || result.completed) {
        isTerminalRef.current = true;
        await clearActiveWorkout(user.id);
        markWorkoutTerminal();
        if (result.completed) setDidComplete(true);
      }
    } catch {
      // The operation remains durable and will be retried on the next retry window.
    } finally {
      replayInFlightRef.current = false;
      if (deferredPersistenceRef.current) {
        deferredPersistenceRef.current = false;
        setOperations((current) => [...current]);
      }
    }
  }, [token, user, markWorkoutTerminal, weightUnit, navigationEpoch]);

  const retryAt = useMemo(() => Math.min(
    ...operations
      .filter((operation) => operation.status !== "failed")
      .map((operation) => operation.nextAttemptAt ?? Date.now())
  ), [operations]);

  useEffect(() => {
    if (persistedRevision === 0 || operations.length === 0 || operations.every((operation) => operation.status === "failed")) return;
    const delay = Math.max(0, retryAt - Date.now());
    const retryTimer = setTimeout(() => void replayPendingWrites(), delay);
    return () => clearTimeout(retryTimer);
  }, [persistedRevision, operations, retryAt, replayPendingWrites]);

  const retryFailedWrites = useCallback(async () => {
    if (!user || !isCurrentWorkout()) return;
    const restored = await retryFailedWorkoutOperations(user.id);
    if (restored && isCurrentWorkout()) {
      setsRef.current = restored.sets;
      operationsRef.current = restored.operations;
      setSets(restored.sets);
      setOperations(restored.operations);
      setPersistedRevision((revision) => revision + 1);
    }
  }, [user, isCurrentWorkout]);

  const persistConfirmedMutation = useCallback(
    async (nextSets: SetState[], nextOperations: PendingWorkoutOperation[]) => {
      if (!user || !workout || isRestoring || isTerminalRef.current || !isCurrentWorkout()) return;
      const localWorkout: LocalActiveWorkout = {
        userId: user.id,
        workoutDayId: workout.workoutDayId,
        workoutDate: workout.date,
        dayType: workout.dayType,
        workoutSnapshot: originalWorkout ?? workout, effectiveWorkout: workout, arrangementRevision, targetReviewExerciseIds, currentExerciseId: currentExerciseId ?? exercises[0]?.exercise.id,
        clientSessionId,
        serverSessionId: sessionId,
        startedAt,
        currentExerciseIndex,
        restEndsAt,
        restTotalSeconds,
        restContext,
        sets: nextSets,
        operations: nextOperations,
        workoutNote,
        exerciseFeedback,
        exerciseNotes,
        revision: ++workoutRevisionRef.current,
      };
      await saveActiveWorkout(localWorkout, isCurrentWorkout);
      if (!isCurrentWorkout()) return;
      setStorageError(false);
      setPersistedRevision((revision) => revision + 1);
    },
    [originalWorkout, arrangementRevision, targetReviewExerciseIds, currentExerciseId, exercises, user, workout, isRestoring, clientSessionId, sessionId, startedAt, currentExerciseIndex, restEndsAt, restTotalSeconds, restContext, workoutNote, exerciseFeedback, exerciseNotes, isCurrentWorkout]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void retryFailedWrites();
        setPersistedRevision((revision) => revision + 1);
      }
    });
    return () => subscription.remove();
  }, [retryFailedWrites]);

  const restingExercise = exercises.find((item) => item.exercise.id === restContext?.exerciseId) ?? exercises[restContext?.exerciseIndex ?? -1];
  const finishRest = useCallback((deadline: number | null) => {
    if (!navigationMountedRef.current || navigationIdentityRef.current.epoch !== navigationEpoch || restStateRef.current.endsAt !== deadline || deadline === null) return false;
    const ctx = restStateRef.current.context;
    restStateRef.current = { endsAt: null, context: null };
    setRestEndsAt(null);
    setRestContext(null);
    const sourceId = ctx?.exerciseId ?? exercisesRef.current[ctx?.exerciseIndex ?? -1]?.exercise.id;
    const sourceIndex = exercisesRef.current.findIndex((item) => item.exercise.id === sourceId);
    const next = exercisesRef.current[sourceIndex + 1];
    if (!allExercisesLayoutRef.current && ctx?.isLastSetOfExercise && !ctx.suppressAutoAdvance && sourceIndex >= 0 && sourceId === currentExerciseRef.current && next) {
      const transition = { sourceExerciseId: sourceId, epoch: navigationEpoch, nextExerciseId: next.exercise.id, nextName: next.exercise.name };
      pendingTransitionRef.current = transition; setPendingTransition(transition);
    }
    return true;
  }, [navigationEpoch]);

  useEffect(() => {
    setPendingTransition((current) => {
      if (!current) return null;
      if (current.epoch !== navigationEpoch || current.sourceExerciseId !== currentItem?.exercise.id) { pendingTransitionRef.current = null; return null; }
      const next = exercises[currentExerciseIndex + 1];
      if (!next) { pendingTransitionRef.current = null; return null; }
      return current.nextExerciseId === next.exercise.id ? current : { ...current, nextExerciseId: next.exercise.id, nextName: next.exercise.name };
    });
  }, [exercises, currentExerciseIndex, currentItem, navigationEpoch]);

  const handleRestExpire = useCallback((deadline: number) => {
    const sourceId = restStateRef.current.context?.exerciseId ?? null;
    if (finishRest(deadline)) {
      playRestEndFeedback();
      if (allExercisesLayoutRef.current) setRestDoneExerciseId(sourceId);
    }
  }, [playRestEndFeedback, finishRest]);

  const handleRestSkip = useCallback(() => {
    finishRest(restStateRef.current.endsAt);
  }, [finishRest]);

  const adjustRest = useCallback((deltaSeconds: number) => {
    const deadline = restStateRef.current.endsAt;
    const next = deadline === null ? null : deadline + deltaSeconds * 1000;
    restStateRef.current = { ...restStateRef.current, endsAt: next }; setRestEndsAt(next);
  }, []);

  const handleContinueTransition = useCallback((expected = pendingTransitionRef.current) => {
    if (!expected || allExercisesLayoutRef.current || pendingTransitionRef.current !== expected || expected.epoch !== navigationIdentityRef.current.epoch || expected.sourceExerciseId !== currentExerciseRef.current || navigationBlockedRef.current || arrangementBusyRef.current() || sheetVisibleRef.current) return;
    manualNavigationRef.current(expected.nextExerciseId);
  }, []);

  // Auto-advance the "Next up" transition after a short delay; the user can
  // also tap Continue to skip the wait.
  useEffect(() => {
    if (!pendingTransition || sheetVisible || allExercisesLayout) return;
    transitionTimeoutRef.current = setTimeout(() => {
      handleContinueTransition(pendingTransition);
    }, 2200);
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, [pendingTransition, handleContinueTransition, sheetVisible, allExercisesLayout]);

  // ── Set input handlers ─────────────────────────────────────────────────────

  const updateSet = useCallback(
    (exerciseId: string, setNumber: number, field: "reps" | "weight", value: string) => {
      if (!canActOnExercise(exerciseId)) return;
      const nextSets = setsRef.current.map((s) =>
          s.exerciseId === exerciseId && s.setNumber === setNumber
            ? s.editing
              ? { ...s, hasUnsavedInput: true, editDraft: { reps: s.editDraft?.reps ?? s.reps, weight: s.editDraft?.weight ?? s.weight, [field]: value } }
              : { ...s, hasUnsavedInput: true, [field]: value }
            : s
        );
      setsRef.current = nextSets;
      setSets(nextSets);
      setSaveMessage("");
      setEntryIssues((previous) => { const next = { ...previous }; delete next[`${exerciseId}:${setNumber}`]; return next; });
    },
    [canActOnExercise]
  );

  const saveEntries = useCallback(async (keys: string[], individual = false, replay = true) => {
    if (!user || !workout || !isCurrentWorkout() || isRestoring || isTerminalRef.current || savingEntriesRef.current
      || finishStatus !== "idle" || operationsRef.current.some((operation) => operation.type === "replace")) return false;
    savingEntriesRef.current = true;
    savingEntriesEpochRef.current = navigationEpoch;
    setIsSavingEntries(true);
    Keyboard.dismiss();
    const snapshot: LocalActiveWorkout = {
      userId: user.id, workoutDayId: workout.workoutDayId, workoutDate: workout.date,
      dayType: workout.dayType, workoutSnapshot: originalWorkout ?? workout, effectiveWorkout: workout, arrangementRevision, targetReviewExerciseIds, currentExerciseId: currentExerciseRef.current ?? currentExerciseId ?? exercises[0]?.exercise.id, clientSessionId, serverSessionId: sessionId,
      startedAt, currentExerciseIndex: Math.max(0, exercises.findIndex((item) => item.exercise.id === currentExerciseRef.current)), restEndsAt, restTotalSeconds, restContext,
      sets: setsRef.current, operations: operationsRef.current, workoutNote, exerciseFeedback, exerciseNotes,
      revision: ++workoutRevisionRef.current,
    };
    if (individual) {
      const target = snapshot.sets.find((set) => setEntryKey(set) === keys[0]);
      const exercise = exercises.find((item) => item.exercise.id === target?.exerciseId);
      if (target && exercise && !target.editing && !("error" in validateSetEntry(target, weightUnit))) {
        snapshot.restTotalSeconds = exercise.prescription.restSeconds;
        snapshot.restEndsAt = Date.now() + snapshot.restTotalSeconds * 1000;
        snapshot.restContext = { exerciseId: target.exerciseId,
          isLastSetOfExercise: snapshot.sets.filter((set) => set.exerciseId === target.exerciseId && !set.deleted)
            .every((set) => set.confirmed || setEntryKey(set) === keys[0]) };
      }
    }
    try {
      const result = await saveWorkoutSetEntries(snapshot, keys, weightUnit);
      if (!isCurrentWorkout()) return false;
      setEntryIssues(result.issues);
      if (result.savedCount > 0) {
        workoutRevisionRef.current = Math.max(workoutRevisionRef.current, result.workout.revision);
        setsRef.current = result.workout.sets;
        operationsRef.current = result.workout.operations;
        setSets(result.workout.sets);
        setOperations(result.workout.operations);
        setSessionId(result.workout.serverSessionId);
        if (individual) {
          setRestTotalSeconds(result.workout.restTotalSeconds);
          setRestEndsAt(result.workout.restEndsAt);
          setRestContext(result.workout.restContext);
        }
        setStorageError(false);
        setSaveMessage(`${result.savedCount} ${result.savedCount === 1 ? "set" : "sets"} saved on this device.${Object.keys(result.issues).length ? ` ${Object.keys(result.issues).length} need attention.` : ""}`);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      } else setSaveMessage("Check the entries below before saving.");
      return result.savedCount > 0 && Object.keys(result.issues).length === 0;
    } catch {
      if (isCurrentWorkout()) {
        setStorageError(true);
        setSaveMessage("Couldn’t save on this device. Your entries are still here — try again.");
      }
      return false;
    } finally {
      if (savingEntriesEpochRef.current === navigationEpoch) {
        savingEntriesEpochRef.current = null;
        savingEntriesRef.current = false;
      }
      if (isCurrentWorkout()) {
        setIsSavingEntries(false);
        if (replay) setPersistedRevision((revision) => revision + 1);
      }
    }
  }, [originalWorkout, arrangementRevision, targetReviewExerciseIds, currentExerciseId, exercises, user, workout, isRestoring, finishStatus, clientSessionId, sessionId, startedAt,
    restEndsAt, restTotalSeconds, restContext, workoutNote, exerciseFeedback, exerciseNotes, weightUnit, navigationEpoch, isCurrentWorkout]);

  const confirmSet = useCallback((exerciseId: string, setNumber: number) => {
    if (!canActOnExercise(exerciseId)) return;
    void saveEntries([`${exerciseId}:${setNumber}`], true);
  }, [canActOnExercise, saveEntries]);

  const saveExerciseEntries = useCallback((exerciseId: string) => {
    if (!canActOnExercise(exerciseId)) return;
    void saveEntries(enteredSets(setsRef.current, exerciseId).map(setEntryKey));
  }, [canActOnExercise, saveEntries]);

  const beginSetEdit = useCallback((exerciseId: string, setNumber: number) => {
    if (!canActOnExercise(exerciseId)) return;
    const nextSets = setsRef.current.map((set) =>
      set.exerciseId === exerciseId && set.setNumber === setNumber && set.syncStatus !== "failed"
        ? { ...set, editing: true, editDraft: { reps: set.reps, weight: set.weight } }
        : set
    );
    setsRef.current = nextSets;
    setSets(nextSets);
  }, [canActOnExercise]);

  const removeSet = useCallback((exerciseId: string, setNumber: number) => {
    if (!canActOnExercise(exerciseId)) return;
    const target = setsRef.current.find((set) => set.exerciseId === exerciseId && set.setNumber === setNumber);
    if (!target || target.syncStatus === "failed") return;
    if (!target.logId) {
      const nextSets = setsRef.current.map((set) => set.exerciseId === exerciseId && set.setNumber === setNumber
        ? { ...set, deleted: true, editing: false, editDraft: undefined, hasUnsavedInput: false } : set);
      const nextOperations: PendingWorkoutOperation[] = target.confirmed ? [...operationsRef.current, {
        id: createClientId(), type: "delete_set", status: "pending",
        payload: { logId: "", exerciseId, setNumber, resolveAfterPending: true },
      }] : operationsRef.current;
      setsRef.current = nextSets;
      operationsRef.current = nextOperations;
      setSets(nextSets);
      setOperations(nextOperations);
      void persistConfirmedMutation(nextSets, nextOperations)
        .then(() => { if (isCurrentWorkout()) void replayPendingWrites(); })
        .catch(() => { if (isCurrentWorkout()) setStorageError(true); });
      return;
    }
    const nextSets: SetState[] = setsRef.current.map((set) =>
      set.exerciseId === exerciseId && set.setNumber === setNumber
        ? { ...set, deleted: true, deletedLogId: target.logId, syncing: true, syncStatus: "pending" as const }
        : set
    );
    const nextOperations: PendingWorkoutOperation[] = [...operationsRef.current, {
      id: createClientId(), type: "delete_set", status: "pending",
      payload: { logId: target.logId!, exerciseId, setNumber },
    }];
    setsRef.current = nextSets;
    operationsRef.current = nextOperations;
    setSets(nextSets);
    setOperations(nextOperations);
    void persistConfirmedMutation(nextSets, nextOperations)
      .then(() => { if (isCurrentWorkout()) void replayPendingWrites(); })
      .catch(() => { if (isCurrentWorkout()) setStorageError(true); });
  }, [canActOnExercise, persistConfirmedMutation, replayPendingWrites, isCurrentWorkout]);

  const restoreSet = useCallback((exerciseId: string, setNumber: number) => {
    if (!canActOnExercise(exerciseId)) return;
    const target = setsRef.current.find((set) => set.exerciseId === exerciseId && set.setNumber === setNumber);
    if (!target) return;
    if (!target.deletedLogId) {
      const nextSets = setsRef.current.map((set) => set.exerciseId === exerciseId && set.setNumber === setNumber ? { ...set, deleted: false } : set);
      const nextOperations: PendingWorkoutOperation[] = target.confirmed ? [...operationsRef.current, {
        id: createClientId(), type: "restore_set", status: "pending", payload: { logId: "", exerciseId, setNumber, resolveAfterPending: true },
      }] : operationsRef.current;
      setsRef.current = nextSets;
      operationsRef.current = nextOperations;
      setSets(nextSets);
      setOperations(nextOperations);
      void persistConfirmedMutation(nextSets, nextOperations)
        .then(() => { if (isCurrentWorkout()) void replayPendingWrites(); })
        .catch(() => { if (isCurrentWorkout()) setStorageError(true); });
      return;
    }
    const nextSets: SetState[] = setsRef.current.map((set) =>
      set.exerciseId === exerciseId && set.setNumber === setNumber
        ? {
            ...set,
            deleted: false,
            deletedLogId: null,
            syncing: false,
            syncStatus: "pending" as const,
          }
        : set
    );
    const nextOperations: PendingWorkoutOperation[] = [...operationsRef.current, {
        id: createClientId(), type: "restore_set", status: "pending",
        payload: { logId: target.deletedLogId!, exerciseId, setNumber },
      }];
    setsRef.current = nextSets;
    operationsRef.current = nextOperations;
    setSets(nextSets);
    setOperations(nextOperations);
    void persistConfirmedMutation(nextSets, nextOperations)
      .then(() => { if (isCurrentWorkout()) void replayPendingWrites(); })
      .catch(() => { if (isCurrentWorkout()) setStorageError(true); });
  }, [canActOnExercise, persistConfirmedMutation, replayPendingWrites, isCurrentWorkout]);

  const addSet = useCallback((exerciseId: string) => {
    if (!canActOnExercise(exerciseId)) return;
    const nextSetNumber = setsRef.current
      .filter((set) => set.exerciseId === exerciseId)
      .reduce((maximum, set) => Math.max(maximum, set.setNumber), 0) + 1;
    const nextSets = [...setsRef.current, {
      exerciseId, setNumber: nextSetNumber, reps: "", weight: "", confirmed: false,
      syncing: false, syncStatus: "synced" as const, logId: null, isAdded: true,
    }];
    setsRef.current = nextSets;
    setSets(nextSets);
  }, [canActOnExercise]);

  const openWorkoutNoteEditor = useCallback(() => {
    if (!canActOnWorkout()) return;
    noteEditorEpochRef.current = navigationEpoch;
    setNoteEditorTarget("workout");
    setNoteEditorExerciseId(null);
    setNoteDraft(workoutNote ?? "");
    setNoteEditorVisible(true);
  }, [canActOnWorkout, navigationEpoch, workoutNote]);

  const openExerciseNoteEditor = useCallback((exerciseId: string) => {
    if (!canActOnExercise(exerciseId)) return;
    noteEditorEpochRef.current = navigationEpoch;
    setNoteEditorTarget("exercise");
    setNoteEditorExerciseId(exerciseId);
    setNoteDraft(exerciseNotes[exerciseId] ?? "");
    setNoteEditorVisible(true);
  }, [canActOnExercise, navigationEpoch, exerciseNotes]);

  const closeNoteEditor = useCallback(() => {
    Keyboard.dismiss();
    noteEditorEpochRef.current = null;
    setNoteEditorVisible(false);
  }, []);

  const saveNote = useCallback(() => {
    if (noteEditorEpochRef.current !== navigationEpoch || !canActOnWorkout()
      || (noteEditorTarget === "exercise" && (!noteEditorExerciseId || !canActOnExercise(noteEditorExerciseId)))) return;
    const note = noteDraft.trim() || null;
    if (noteEditorTarget === "workout") {
      setWorkoutNote(note);
      setOperations((previous) => [...previous, {
        id: createClientId(), type: "update_workout_note", status: "pending", payload: { note },
      }]);
    } else if (noteEditorExerciseId) {
      const exerciseId = noteEditorExerciseId;
      setExerciseNotes((current) => ({ ...current, [exerciseId]: note }));
      setOperations((previous) => [...previous, {
        id: createClientId(), type: "update_exercise_note", status: "pending", payload: { exerciseId, note },
      }]);
    }
    closeNoteEditor();
  }, [noteDraft, noteEditorTarget, noteEditorExerciseId, navigationEpoch, canActOnWorkout, canActOnExercise, closeNoteEditor]);

  const openFeedbackEditor = useCallback((exerciseId: string) => {
    if (!canActOnExercise(exerciseId)) return;
    feedbackEditorEpochRef.current = navigationEpoch;
    setFeedbackEditorExerciseId(exerciseId);
    setFeedbackDraft(exerciseFeedback[exerciseId] ?? { effort: null, rir: null });
    setFeedbackEditorVisible(true);
  }, [canActOnExercise, navigationEpoch, exerciseFeedback]);

  const saveExerciseFeedback = useCallback(() => {
    if (!feedbackEditorExerciseId || feedbackEditorEpochRef.current !== navigationEpoch || !canActOnExercise(feedbackEditorExerciseId)) return;
    const exerciseId = feedbackEditorExerciseId;
    setExerciseFeedback((current) => ({ ...current, [exerciseId]: feedbackDraft }));
    setOperations((previous) => [...previous, {
      id: createClientId(), type: "update_exercise_feedback", status: "pending",
      payload: { exerciseId, effort: feedbackDraft.effort, rir: feedbackDraft.rir },
    }]);
    feedbackEditorEpochRef.current = null;
    setFeedbackEditorVisible(false);
  }, [feedbackEditorExerciseId, feedbackDraft, navigationEpoch, canActOnExercise]);

  // ── Complete workout ───────────────────────────────────────────────────────

  const finishWorkout = useCallback(async (retry = false) => {
    if (!user || !workout || isFinishingRef.current) return;
    isFinishingRef.current = true;
    setFinishStatus("syncing");
    try {
      const completion = await queueWorkoutCompletion({
        userId: user.id,
        workoutDayId: workout.workoutDayId,
        workoutDate: workout.date,
        dayType: workout.dayType,
        workoutSnapshot: originalWorkout ?? workout, effectiveWorkout: workout, arrangementRevision, targetReviewExerciseIds, currentExerciseId: currentExerciseId ?? exercises[0]?.exercise.id,
        clientSessionId,
        serverSessionId: sessionId,
        startedAt,
        currentExerciseIndex,
        restEndsAt,
        restTotalSeconds,
        restContext,
        sets: setsRef.current,
        operations: operationsRef.current,
        workoutNote,
        exerciseFeedback,
        exerciseNotes,
        revision: ++workoutRevisionRef.current,
      }, retry);
      if (accountRef.current !== user.id) return;
      if (completion.status === "terminal") {
        const terminalSessionId = completion.serverSessionId ?? sessionId;
        isTerminalRef.current = true;
        markWorkoutTerminal();
        if (terminalSessionId && token) {
          const canonical = await getSession(token, terminalSessionId).catch(() => null);
          if (canonical?.status === "completed") {
            setSessionId(terminalSessionId);
            setDidComplete(true);
            return;
          }
        }
        router.replace("/(tabs)");
        return;
      }
      const queued = completion.workout;
      workoutRevisionRef.current = Math.max(workoutRevisionRef.current, queued.revision);
      setSets(queued.sets);
      setOperations(queued.operations);
      setWorkoutNote(queued.workoutNote ?? null);
      if (!token) {
        setFinishStatus("pendingOffline");
        return;
      }
      const result = await replayPendingWorkoutOperations(token, user.id);
      if (accountRef.current !== user.id) return;
      const completeOperation = result.workout?.operations.find((operation) => operation.type === "complete");
      const canonical = !result.completed && !completeOperation && result.workout?.serverSessionId
        ? await getSession(token, result.workout.serverSessionId)
        : null;
      if (accountRef.current !== user.id) return;
      if (result.completed || canonical?.status === "completed") {
        setSessionId(result.workout?.serverSessionId ?? sessionId);
        isTerminalRef.current = true;
        await clearActiveWorkout(user.id);
        markWorkoutTerminal();
        setDidComplete(true);
        return;
      }
      if (!result.workout) throw new Error("Missing active workout");
      if (!completeOperation) throw new Error("Workout completion was not confirmed");
      workoutRevisionRef.current = Math.max(workoutRevisionRef.current, result.workout.revision);
      setSets(result.workout.sets);
      setOperations(result.workout.operations);
      setFinishStatus(completeOperation?.status === "failed" ? "failed" : result.completionBlocked ? "pendingSets" : "pendingOffline");
    } catch {
      setFinishStatus("failed");
    } finally {
      isFinishingRef.current = false;
    }
  }, [originalWorkout, arrangementRevision, targetReviewExerciseIds, currentExerciseId, exercises, token, user, workout, clientSessionId, sessionId, startedAt, currentExerciseIndex, restEndsAt, restTotalSeconds, restContext, workoutNote, exerciseFeedback, exerciseNotes, markWorkoutTerminal, router]);

  const continueLogging = useCallback(async () => {
    if (!user || isFinishingRef.current || finishStatus === "idle") return;
    isFinishingRef.current = true;
    isContinuingRef.current = true;
    setFinishStatus("syncing");
    try {
      const result = await continueWorkoutLogging(user.id, clientSessionId);
      if (result.status === "completed") {
        const completedSessionId = result.serverSessionId ?? sessionId;
        if (!completedSessionId) throw new Error("Completed session has no identifier");
        setSessionId(completedSessionId);
        isTerminalRef.current = true;
        await clearActiveWorkout(user.id);
        markWorkoutTerminal();
        setDidComplete(true);
        return;
      }
      if (result.status === "missing") throw new Error("Saved workout is unavailable");
      if (isTerminalRef.current) return;
      workoutRevisionRef.current = Math.max(workoutRevisionRef.current, result.workout.revision);
      setsRef.current = result.workout.sets;
      operationsRef.current = result.workout.operations;
      setSessionId(result.workout.serverSessionId);
      setSets(result.workout.sets);
      setOperations(result.workout.operations);
      setFinishStatus("idle");
      setPersistedRevision((revision) => revision + 1);
    } catch {
      setFinishStatus("pendingOffline");
      Alert.alert("Couldn’t continue logging", "Your saved workout is still safe. Try again.");
    } finally {
      isContinuingRef.current = false;
      isFinishingRef.current = false;
    }
  }, [user, finishStatus, clientSessionId, sessionId, markWorkoutTerminal]);

  const handleComplete = useCallback(() => {
    if (savingEntriesRef.current) return;
    if (enteredSets(setsRef.current).length > 0) {
      Keyboard.dismiss();
      setFinishReviewVisible(true);
      return;
    }
    if (confirmedCount === 0) {
      Alert.alert("No sets logged", "Log at least one set before finishing.");
      return;
    }
    const unloggedCount = Math.max(0, totalSets - confirmedCount);
    Alert.alert("Finish workout?", unloggedCount > 0
      ? `${confirmedCount} of ${totalSets} sets logged. ${unloggedCount} ${unloggedCount === 1 ? "set will" : "sets will"} remain unlogged. You can add them later in Review or correct workout.`
      : `All ${totalSets} sets are logged.`, [
      { text: "Keep logging", style: "cancel" },
      { text: unloggedCount > 0 ? "Finish anyway" : "Finish", onPress: () => void finishWorkout() },
    ]);
  }, [confirmedCount, totalSets, finishWorkout]);

  const saveEntriesAndFinish = useCallback(async () => {
    const entries = enteredSets(setsRef.current);
    if (entries.some((set) => "error" in validateSetEntry(set, weightUnit))) return;
    if (await saveEntries(entries.map(setEntryKey), false, false)) {
      setFinishReviewVisible(false);
      await finishWorkout();
    }
  }, [weightUnit, saveEntries, finishWorkout]);

  const reviewEntries = useCallback(() => {
    const entries = enteredSets(setsRef.current);
    const issues = Object.fromEntries(entries.flatMap((set) => {
      const validation = validateSetEntry(set, weightUnit);
      return "error" in validation ? [[setEntryKey(set), validation.error]] : [];
    }));
    setEntryIssues(issues);
    const first = entries.find((set) => issues[setEntryKey(set)]) ?? entries[0];
    if (first) setCurrentExerciseIndex(exercises.findIndex((item) => item.exercise.id === first.exerciseId));
    setPendingTransition(null);
    setFinishReviewVisible(false);
  }, [exercises, weightUnit, setCurrentExerciseIndex]);

  useEffect(() => {
    if (!didComplete || !sessionId) return;
    if (timerRef.current) clearInterval(timerRef.current);
    router.replace({
      pathname: "/workout/summary",
      params: { sessionId },
    });
  }, [didComplete, router, sessionId]);

  // ── Back with confirmation ─────────────────────────────────────────────────

  const leaveWorkoutActive = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }, [router]);

  const abandonAndExit = useCallback(async () => {
    if (!token || !user || isExiting) return;
    setIsExiting(true);
    try {
      // Wait for a queued create before abandoning. Clearing local state while a
      // create request is still in flight can leave a hidden server session.
      const replayed = await replayPendingWorkoutOperations(token, user.id);
      if (replayed.completed || replayed.abandoned) {
        isTerminalRef.current = true;
        await clearActiveWorkout(user.id);
        markWorkoutTerminal();
        router.replace("/(tabs)");
        return;
      }
      const activeSessionId = replayed.workout?.serverSessionId ?? sessionId ?? (await getActiveSession(token))?.id ?? null;
      if (!activeSessionId) {
        throw new Error("The workout has not reached PrimeRep yet.");
      }
      await abandonSession(token, activeSessionId);
      isTerminalRef.current = true;
      await clearActiveWorkout(user.id);
      markWorkoutTerminal();
      router.replace("/(tabs)");
    } catch {
      Alert.alert("Couldn't abandon workout", "Your workout is still active. Try again when you're online.");
    } finally {
      setIsExiting(false);
    }
  }, [token, user, isExiting, sessionId, markWorkoutTerminal, router]);

  const handleBack = useCallback(() => {
    if (savingEntriesRef.current) return;
    if (finishStatus !== "idle") {
      router.replace("/(tabs)");
      return;
    }
    Alert.alert(
      "Leave workout?",
      "Keep it active to resume later, or quit and abandon it. Abandoned workouts don't count toward your progress.",
      [
        { text: "Continue Workout", style: "cancel" },
        { text: "Keep Workout Active", onPress: leaveWorkoutActive },
        { text: "Quit & Abandon", style: "destructive", onPress: () => void abandonAndExit() },
      ]
    );
  }, [leaveWorkoutActive, abandonAndExit, finishStatus, router]);

    const arrangementSnapshot = useCallback((): LocalActiveWorkout | null => {
    if (!user || !workout) return null;
    return { userId: user.id, workoutDayId: workout.workoutDayId, workoutDate: workout.date, dayType: workout.dayType,
      workoutSnapshot: originalWorkout ?? workout, effectiveWorkout: workout, arrangementRevision, targetReviewExerciseIds,
      clientSessionId, serverSessionId: sessionId, startedAt, currentExerciseIndex, currentExerciseId: currentItem?.exercise.id,
      restEndsAt, restTotalSeconds, restContext, sets: setsRef.current, operations: operationsRef.current,
      workoutNote, exerciseFeedback, exerciseNotes, revision: workoutRevisionRef.current };
  }, [user, workout, originalWorkout, arrangementRevision, targetReviewExerciseIds, clientSessionId, sessionId, startedAt, currentExerciseIndex, currentItem, restEndsAt, restTotalSeconds, restContext, workoutNote, exerciseFeedback, exerciseNotes]);
  const persistArrangementSnapshot = useCallback(async () => {
    const local = arrangementSnapshot();
    if (!local) return;
    local.revision = ++workoutRevisionRef.current;
    await saveActiveWorkout(local);
  }, [arrangementSnapshot]);
  const arrangementSessionRef = useRef({ clientSessionId, requestedSessionId });
  arrangementSessionRef.current = { clientSessionId, requestedSessionId };
  const applyArrangement = useCallback((local: LocalActiveWorkout) => {
    const identity = arrangementSessionRef.current;
    if (accountRef.current !== local.userId || identity.clientSessionId !== local.clientSessionId
      || (identity.requestedSessionId && local.serverSessionId && identity.requestedSessionId !== local.serverSessionId)) return;
    workoutRevisionRef.current = Math.max(workoutRevisionRef.current, local.revision);
    setSnapshotWorkout(local.effectiveWorkout ?? local.workoutSnapshot);
    setOriginalWorkout(local.workoutSnapshot);
    setArrangementRevision(local.arrangementRevision); setTargetReviewExerciseIds(local.targetReviewExerciseIds);
    setSessionId(local.serverSessionId);
    setCurrentExerciseId(local.currentExerciseId ?? null);
    setRestContext(local.restContext);
    setsRef.current = local.sets;
    operationsRef.current = local.operations;
    setSets(local.sets); setOperations(local.operations);
    setPersistedRevision((revision) => revision + 1);
  }, []);
  const arrangement = useWorkoutArrangement({ token, userId: user?.id, sessionKey: `${requestedSessionId ?? workout?.workoutDayId ?? "new"}:${clientSessionId}`, snapshot: arrangementSnapshot, apply: applyArrangement, persist: persistArrangementSnapshot });
  const pendingArrangement = operations.find((operation) => operation.type === "order" || operation.type === "replace");
  const exerciseSelectionDisabled = isRestoring || isResolvingSession || finishStatus !== "idle" || isSavingEntries || arrangement.busy || hasPendingReplacement || isExiting || didComplete;
  navigationBlockedRef.current = exerciseSelectionDisabled;
  arrangementBusyRef.current = arrangement.isBusy;
  navigationSnapshotRef.current = arrangementSnapshot;
  const layoutSwitchDisabled = !isLayoutReady || isLayoutSaving || exerciseSelectionDisabled;
  const changeLayout = (next: WorkoutLayout) => {
    if (!canActOnWorkout() || layoutSwitchDisabled || layout === next) return;
    Keyboard.dismiss();
    if (next === "all") {
      if (restStateRef.current.context || pendingTransitionRef.current) {
        const id = currentExerciseRef.current;
        if (!id || !selectExercise(id, false)) return;
      }
      allExercisesLayoutRef.current = true;
      cancelExerciseTransition();
    } else allExercisesLayoutRef.current = false;
    void setLayout(next).catch(() => { if (isCurrentWorkout()) Alert.alert("Couldn't save workout layout", "Try changing the layout again."); });
  };
  const showExerciseInfo = (exerciseId: string, target: React.ElementRef<typeof Pressable> | null, source: "focus" | "all") => {
    if (!canActOnExercise(exerciseId)) return;
    listFocusRef.current = { epoch: navigationEpoch, target, infoSource: source, exerciseId };
    exerciseOverlayVisibleRef.current = true;
    infoSheetEpochRef.current = navigationEpoch;
    setInfoExerciseId(exerciseId);
    setInfoSheetVisible(true);
  };
  const closeExerciseInfo = () => {
    if (infoSheetEpochRef.current !== navigationEpoch) return;
    infoSheetEpochRef.current = null;
    setInfoSheetVisible(false);
    setInfoExerciseId(null);
  };
  const currentInfoSheetVisible = infoSheetVisible && infoSheetEpochRef.current === navigationEpoch && Boolean(infoExerciseId);
  const exerciseOverlayVisible = sheetVisible || currentInfoSheetVisible || Boolean(arrangement.review || arrangement.picker || arrangement.guidance);
  exerciseOverlayVisibleRef.current = exerciseOverlayVisible;
  useEffect(() => { if (Platform.OS === "android" && !exerciseOverlayVisible) restoreExerciseListFocus(); }, [exerciseOverlayVisible, restoreExerciseListFocus]);

  // ── Loading / error states ─────────────────────────────────────────────────

  if (legacySession) {
    const savedSetCount = legacySession.setLogs.length;
    const resolveLegacySession = async (action: "complete" | "abandon") => {
      if (!token || !user) return;
      try {
        if (action === "complete") await completeSession(token, legacySession.id);
        else await abandonSession(token, legacySession.id);
        await clearActiveWorkout(user.id);
        markWorkoutTerminal();
        router.replace("/(tabs)");
      } catch {
        Alert.alert("Couldn't update workout", "Please try again.");
      }
    };
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
        <View style={{ flex: 1, justifyContent: "center", padding: 28, gap: 14 }}>
          <ThemedText type="title" style={{ textAlign: "center" }}>Workout recovery</ThemedText>
          <ThemedText style={{ textAlign: "center", color: colors.placeholder }}>
            This workout was started before PrimeRep could save its exercise plan. We kept {savedSetCount} saved {savedSetCount === 1 ? "set" : "sets"}, but can’t safely recreate the remaining exercises.
          </ThemedText>
          {savedSetCount > 0 ? (
            <Pressable onPress={() => void resolveLegacySession("complete")} style={{ backgroundColor: colors.primaryButton, borderRadius: 14, padding: 16 }}>
              <ThemedText style={{ color: "#FFF", textAlign: "center", fontWeight: "700" }}>Complete saved sets</ThemedText>
            </Pressable>
          ) : null}
          <Pressable onPress={() => void resolveLegacySession("abandon")} style={{ borderWidth: 1, borderColor: "#DC2626", borderRadius: 14, padding: 16 }}>
            <ThemedText style={{ color: "#DC2626", textAlign: "center", fontWeight: "700" }}>Abandon workout</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!workout) {
  if (isResolvingSession || !hasRequestedWorkout || isWeekLoading) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.primaryButton} />
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ThemedText>Workout not found.</ThemedText>
          <Pressable onPress={() => router.replace("/(tabs)")} style={{ marginTop: 16 }}>
            <ThemedText style={{ color: colors.primaryButton }}>Go Back</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (planningRefreshRequired && isRestoring && !sessionId) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: "center" }}>
        <ThemedText accessibilityRole="alert">Refresh to confirm the latest workout before starting.</ThemedText>
        <Pressable testID="active-planning-refresh" accessibilityRole="button" accessibilityLabel="Refresh workout plan" onPress={() => void refreshWeek()} style={{ minHeight: 48, padding: 12, justifyContent: "center" }}><ThemedText style={{ color: colors.primaryButton }}>Refresh workout plan</ThemedText></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to workouts" onPress={() => router.replace("/(tabs)")} style={{ minHeight: 48, padding: 12, justifyContent: "center" }}><ThemedText>Back to workouts</ThemedText></Pressable>
      </View>
    </SafeAreaView>;
  }

  if (isRestoring || sets.length === 0 || !isLayoutReady) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primaryButton} />
          <ThemedText style={{ marginTop: 12, opacity: 0.7 }}>Starting session...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const initials = currentItem
    ? currentItem.exercise.name
        .split(/[\s-]+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "";

  const allEnteredSets = enteredSets(sets);
  const currentEnteredCount = enteredSets(sets, currentItem?.exercise.id).length;
  const invalidEntryCount = allEnteredSets.filter((set) => "error" in validateSetEntry(set, weightUnit)).length;
  const canFinish = confirmedCount > 0 || allEnteredSets.length > 0;
  const nextExercise = exercises[currentExerciseIndex + 1];
  const nextExerciseDisabled = exerciseSelectionDisabled || !currentItem || !nextExercise;
  const emphasizeFinish = finishStatus === "idle" && canFinish && totalSets > 0 && confirmedCount >= totalSets && allEnteredSets.length === 0;
  const saveEnteredAction = currentEnteredCount > 0 && currentItem ? <Pressable testID="player-save-entered-sets" accessibilityRole="button"
    accessibilityLabel={`Save ${currentEnteredCount} entered sets for ${currentItem.exercise.name}`}
    accessibilityState={{ disabled: isSavingEntries || finishStatus !== "idle", busy: isSavingEntries }}
    disabled={isSavingEntries || finishStatus !== "idle"} onPress={() => saveExerciseEntries(currentItem.exercise.id)}
    style={{ flex: keyboardVisible ? undefined : 1, minWidth: 160, minHeight: 44, alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 10, backgroundColor: colors.primaryButton }}>
    {isSavingEntries ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14, textAlign: "center" }}>{allExercisesLayout ? `Save ${currentEnteredCount} sets · ${currentItem.exercise.name}` : `Save entered sets (${currentEnteredCount})`}</ThemedText>}
  </Pressable> : null;

  const activateExerciseForAll = (exerciseId: string) => {
    if (!allExercisesLayout) return true;
    if (!allExercisesLayoutRef.current || !canActOnExercise(exerciseId)) return false;
    if (currentExerciseRef.current !== exerciseId) return selectExercise(exerciseId, false);
    return true;
  };
  const renderSetInputs = (item: WorkoutItem, focus: boolean, cardActions?: React.ReactNode) => {
    const exerciseId = item.exercise.id;
    const itemSets = sets.filter((set) => set.exerciseId === exerciseId).sort((a, b) => a.setNumber - b.setNumber);
    const equipmentIds = item.exercise.requiredEquipmentIds ?? [];
    const columnLabel = item.exercise.loadProfile?.implement_count === 1 ? "Weight" : equipmentIds.includes("dumbbells")
      ? "Weight each" : equipmentIds.includes("olympic_barbell") ? "Total weight" : "Weight";
    const enteredCount = enteredSets(sets, exerciseId).length;
    const saveAction = focus ? saveEnteredAction : enteredCount > 0 ? <Pressable
      testID={`player-save-entered-sets-${exerciseId}`} accessibilityRole="button"
      accessibilityLabel={`Save ${enteredCount} entered sets for ${item.exercise.name}`}
      accessibilityState={{ disabled: isSavingEntries || finishStatus !== "idle", busy: isSavingEntries }}
      disabled={isSavingEntries || finishStatus !== "idle"} onPress={() => { if (activateExerciseForAll(exerciseId)) saveExerciseEntries(exerciseId); }}
      style={{ minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.primaryButton }}>
      <ThemedText style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>Save entered sets ({enteredCount})</ThemedText>
    </Pressable> : null;
    return <>
      {focus ? <WeightUnitControl unit={weightUnit} colors={colors} disabled={finishStatus !== "idle" || isSavingEntries || arrangement.busy || hasPendingReplacement} onChange={toggleWeightUnit} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: focus ? 12 : 4, marginTop: focus ? 0 : 8, marginBottom: focus ? 8 : 2 }}>
        <ThemedText accessibilityLabel={expandedLayout ? "Set" : undefined} style={{ width: 36, fontSize: 11, color: colors.placeholder }}>{expandedLayout ? "#" : "SET"}</ThemedText>
        <View style={{ flex: 1, marginRight: 8 }}>
          <ThemedText accessibilityLabel={expandedLayout ? `${columnLabel} (${weightUnit})` : undefined}
            style={{ fontSize: 11, color: colors.placeholder, fontWeight: "500", fontFamily: Fonts.sans, textTransform: expandedLayout ? "none" : "uppercase" }}>
            {expandedLayout ? columnLabel === "Weight each" ? `${weightUnit} each` : columnLabel === "Total weight" ? `Total ${weightUnit}` : weightUnit : columnLabel}
          </ThemedText>
        </View>
        <ThemedText style={{ flex: 1, fontSize: 11, color: colors.placeholder, fontWeight: "500", fontFamily: Fonts.sans, textTransform: expandedLayout ? "none" : "uppercase" }}>Reps</ThemedText>
        <View style={{ width: 52 }} />
      </View>
      {itemSets.map((setRow) => {
        const reason = item.prescription.suggestedWeightReason;
        const progressionTag = reason === "increase" ? "▲" : reason === "hold" ? "—" : reason === "deload" ? "▼" : undefined;
        const operation = pendingSetOperations.get(`${setRow.exerciseId}:${setRow.setNumber}`);
        const displaySet = operation ? { ...setRow, syncing: operation.status === "retrying", syncStatus: operation.status === "failed" ? "failed" as const : "pending" as const }
          : setRow.confirmed ? { ...setRow, syncing: false, syncStatus: "synced" as const } : setRow;
        const displaySetNumber = setRow.deleted ? undefined : itemSets.filter((set) => !set.deleted).findIndex((set) => set.setNumber === setRow.setNumber) + 1;
        return <SetInputRow key={`${exerciseId}-${setRow.setNumber}`} setRow={displaySet} displaySetNumber={displaySetNumber}
          colors={colors} weightUnit={weightUnit} compact={!focus} readOnly={finishStatus !== "idle" || isSavingEntries || arrangement.busy || hasPendingReplacement}
          issue={entryIssues[setEntryKey(setRow)]}
          lastTimeHint={formatLastTimeHint(findHistoryForSet(lastSetsByExercise[exerciseId], setRow.setNumber), weightUnit)}
          progressionTag={progressionTag}
          onUpdate={(setNumber, field, value) => { if (activateExerciseForAll(exerciseId)) updateSet(exerciseId, setNumber, field, value); }}
          onConfirm={(setNumber) => { if (activateExerciseForAll(exerciseId)) confirmSet(exerciseId, setNumber); }}
          onEdit={(setNumber) => { if (activateExerciseForAll(exerciseId)) beginSetEdit(exerciseId, setNumber); }}
          onRemove={(setNumber) => { if (activateExerciseForAll(exerciseId)) removeSet(exerciseId, setNumber); }}
          onRestore={(setNumber) => { if (activateExerciseForAll(exerciseId)) restoreSet(exerciseId, setNumber); }}
          onRetry={() => { if (activateExerciseForAll(exerciseId)) void retryFailedWrites(); }} />;
      })}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: focus ? 10 : 4, marginTop: focus ? 4 : 0,
        borderTopWidth: focus ? 0 : 1, borderTopColor: colors.inputBorder, paddingTop: focus ? 0 : 4 }}>
        <Pressable testID={`player-add-set-${exerciseId}`} accessibilityRole="button"
          accessibilityState={{ disabled: finishStatus !== "idle" || isSavingEntries || arrangement.busy || hasPendingReplacement }}
          disabled={finishStatus !== "idle" || isSavingEntries || arrangement.busy || hasPendingReplacement}
          onPress={() => { if (activateExerciseForAll(exerciseId)) addSet(exerciseId); }}
          style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: focus ? 14 : 8, borderRadius: 10,
            borderWidth: focus ? 1 : 0, borderColor: colors.inputBorder }}>
          <ThemedText style={{ fontWeight: "600", fontSize: 14, color: focus ? colors.text : colors.primaryButton }}>+ Add set</ThemedText>
        </Pressable>
        {cardActions}
        {!keyboardVisible ? saveAction : null}
      </View>
      {focus && saveMessage ? <ThemedText testID="player-save-confirmation" accessibilityLiveRegion="polite" style={{ fontSize: 13, lineHeight: 20, color: colors.placeholder, marginTop: 10 }}>{saveMessage}</ThemedText> : null}
    </>;
  };
  const renderAllExerciseCard = (item: WorkoutItem, index: number) => {
    const exerciseId = item.exercise.id;
    const collapsed = Boolean(collapsedExercises[exerciseId]);
    const progress = getExerciseProgress(exerciseId);
    const isCurrent = currentItem?.exercise.id === exerciseId;
    const suggestedWeight = item.prescription.suggestedWeightKg;
    const suggestion = suggestedWeight == null || !unitReady ? null : resolveFriendlyLoad({
      targetWeightKg: suggestedWeight,
      currentWeightKg: item.prescription.suggestedPreviousWeightKg,
      reason: item.prescription.suggestedWeightReason ?? "hold",
      equipmentIds: item.exercise.requiredEquipmentIds,
      loadProfile: item.exercise.loadProfile,
      weightUnit,
      dumbbellWeights: equipmentWeights.dumbbellWeights,
      plateWeights: equipmentWeights.plateWeights,
    });
    const actionDisabled = finishStatus !== "idle" || isSavingEntries || arrangement.busy || hasPendingReplacement;
    return <View key={exerciseId} testID={`player-all-card-${exerciseId}`}
      style={{ borderWidth: 1, borderColor: isCurrent ? colors.primaryButton : colors.inputBorder, borderRadius: 16, padding: 12, marginBottom: 12, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable testID={`player-all-toggle-${exerciseId}`} accessibilityRole="button"
          accessibilityLabel={`${collapsed ? "Expand" : "Collapse"} ${item.exercise.name}`}
          accessibilityState={{ expanded: !collapsed, disabled: exerciseSelectionDisabled }} disabled={exerciseSelectionDisabled}
          onPress={() => { if (!activateExerciseForAll(exerciseId)) return; setCollapsedExercises((current) => ({ ...current, [exerciseId]: !current[exerciseId] })); }}
          style={{ flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, flexShrink: 1 }}>{index + 1}. {item.exercise.name}</ThemedText>
            <ThemedText style={{ fontSize: 13, color: colors.placeholder }}>
              {progress.confirmed}/{progress.total} sets · {item.prescription.sets} × {item.prescription.reps} · {item.prescription.restSeconds}s rest
            </ThemedText>
          </View>
          <Ionicons name={collapsed ? "chevron-down" : "chevron-up"} size={18} color={colors.placeholder} />
        </Pressable>
        <Pressable testID={`player-all-info-${exerciseId}`} accessibilityRole="button" accessibilityLabel={`Open ${item.exercise.name} details`}
          ref={(target) => { if (target) allInfoTriggers.current.set(exerciseId, target); else allInfoTriggers.current.delete(exerciseId); }}
          onPress={() => { if (activateExerciseForAll(exerciseId)) showExerciseInfo(exerciseId, allInfoTriggers.current.get(exerciseId) ?? null, "all"); }}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="information-circle-outline" size={22} color={colors.placeholder} />
        </Pressable>
      </View>
      {!collapsed ? <View>
        {exerciseNotes[exerciseId] ? <ThemedText numberOfLines={2} style={{ color: colors.placeholder, fontSize: 13, marginTop: 4 }}>{exerciseNotes[exerciseId]}</ThemedText> : null}
        {suggestion ? <ThemedText style={{ color: colors.placeholder, fontSize: 13, marginTop: 4 }}>Next setup: {suggestion.displayText}</ThemedText> : null}
        {renderSetInputs(item, false, ([
          { id: `player-exercise-note-${exerciseId}`, label: "Note", accessibilityLabel: "Exercise note", icon: "create-outline", action: () => openExerciseNoteEditor(exerciseId) },
          { id: `player-feedback-${exerciseId}`, label: "Feedback", accessibilityLabel: "Feedback", icon: "chatbubble-outline", action: () => openFeedbackEditor(exerciseId) },
        ] as const).map((action) => <Pressable key={action.id} testID={action.id} accessibilityRole="button" accessibilityLabel={`${action.accessibilityLabel} for ${item.exercise.name}`}
          accessibilityState={{ disabled: actionDisabled }} disabled={actionDisabled} onPress={() => { if (activateExerciseForAll(exerciseId)) action.action(); }}
          style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8 }}>
          <Ionicons name={action.icon} size={16} color={colors.placeholder} />
          <ThemedText style={{ fontSize: 13, fontWeight: "500" }}>{action.label}</ThemedText>
        </Pressable>))}
      </View> : null}
    </View>;
  };

  const header = <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: expandedLayout ? "space-between" : undefined,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.inputBorder,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave workout"
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        {!expandedLayout ? <Pressable
          style={{ flex: 1, alignItems: "center" }}
          disabled={exerciseSelectionDisabled}
          onPress={() => openExerciseList(listExerciseTrigger.current)}
        >
          <ThemedText type="defaultSemiBold">{workout.title}</ThemedText>
          <ThemedText style={{ fontSize: 13, color: colors.placeholder, textAlign: "center" }}>
            {formatTime(elapsedSeconds)} • Exercise {currentExerciseIndex + 1} of{" "}
            {exercises.length} • {confirmedCount}/{totalSets} sets
          </ThemedText>
        </Pressable> : null}
        <Pressable
          testID="player-exercise-list-button"
          ref={listExerciseTrigger}
          accessibilityRole="button"
          accessibilityLabel="Open exercise list"
          accessibilityState={{ disabled: exerciseSelectionDisabled }}
          disabled={exerciseSelectionDisabled}
          onPress={() => openExerciseList(listExerciseTrigger.current)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="list" size={22} color={colors.text} />
        </Pressable>
      </View>

      {expandedLayout ? <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open exercise list for ${workout.title}`}
          style={{ minHeight: 44, alignItems: "center", paddingHorizontal: 20, paddingBottom: 12 }}
          disabled={exerciseSelectionDisabled}
          onPress={() => openExerciseList(listExerciseTrigger.current)}
        >
          <ThemedText type="defaultSemiBold" style={{ textAlign: "center" }}>{workout.title}</ThemedText>
          <ThemedText style={{ fontSize: 13, color: colors.placeholder, textAlign: "center" }}>
            {formatTime(elapsedSeconds)} • Exercise {currentExerciseIndex + 1} of{" "}
            {exercises.length} • {confirmedCount}/{totalSets} sets
          </ThemedText>
        </Pressable> : null}
      <View style={{ height: 3, backgroundColor: colors.inputBorder }}>
        <View
          style={{
            height: 3,
            width: totalSets > 0 ? `${(confirmedCount / totalSets) * 100}%` : "0%",
            backgroundColor: colors.primaryButton,
          }}
        />
      </View>
      <View testID="player-layout-switch" accessibilityRole="radiogroup"
        style={{ flexDirection: fontScale > 1.5 ? "column" : "row", gap: 8, paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.inputBorder }}>
        {([{"id": "focus", "label": "Focus"}, {"id": "all", "label": "All exercises"}] as const).map((option) => <Pressable
          key={option.id} testID={`player-layout-${option.id}`} accessibilityRole="radio" accessibilityLabel={`${option.label} workout layout`}
          accessibilityState={{ selected: layout === option.id, disabled: layoutSwitchDisabled }} disabled={layoutSwitchDisabled}
          onPress={() => changeLayout(option.id)}
          style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10,
            borderWidth: layout === option.id ? 1 : 0, borderColor: layout === option.id ? colors.primaryButton : colors.inputBorder,
            backgroundColor: layout === option.id ? colors.inputBackground : colors.background, paddingHorizontal: 10, paddingVertical: 8,
            opacity: layoutSwitchDisabled ? 0.5 : 1 }}>
          <ThemedText style={{ fontSize: 14, fontWeight: layout === option.id ? "700" : "500", textAlign: "center" }}>{option.label}</ThemedText>
        </Pressable>)}
      </View>
  </>;
  const footer = (
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 12,
          paddingTop: 12,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.inputBorder,
        }}
      >
        {!expandedLayout && keyboardVisible && finishStatus === "idle" && saveEnteredAction ? <View style={{ marginBottom: 8 }}>{saveEnteredAction}</View> : null}
        {finishStatus !== "idle" ? (
          <ThemedText style={{ textAlign: "center", color: finishStatus === "failed" ? "#DC2626" : colors.placeholder, fontSize: 13, marginBottom: 8 }}>
            {finishStatus === "syncing"
              ? "Finishing workout…"
              : finishStatus === "failed"
                ? "Couldn't finish this workout. Your sets are safe."
                : finishStatus === "pendingSets"
                  ? "Your sets are still saving — finish will resume automatically."
                  : "Saved on this device — finish when online."}
          </ThemedText>
        ) : null}
        {finishStatus === "pendingOffline" || finishStatus === "pendingSets" || finishStatus === "failed" ? (
          <Pressable
            testID="player-continue-logging"
            accessibilityRole="button"
            onPress={() => void continueLogging()}
            style={{ paddingVertical: 14, minHeight: 48, alignItems: "center", backgroundColor: colors.primaryButton, borderRadius: 12, marginBottom: 8 }}
          >
            <ThemedText type="defaultSemiBold" style={{ color: "#FFFFFF" }}>
              Continue logging
            </ThemedText>
          </Pressable>
        ) : null}
        {currentItem && finishStatus === "idle" && !allExercisesLayout ? <View style={{ flexDirection: fontScale > 1.5 ? "column" : "row", gap: 8, marginBottom: 8 }}>
          <Pressable ref={chooseExerciseTrigger} testID="player-choose-exercise" accessibilityRole="button" accessibilityLabel="Choose exercise" accessibilityHint="Open this workout's exercise list and choose what to do now"
            accessibilityState={{ disabled: exerciseSelectionDisabled }} disabled={exerciseSelectionDisabled} onPress={() => openExerciseList(chooseExerciseTrigger.current)}
            style={{ flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, opacity: exerciseSelectionDisabled ? 0.5 : 1 }}>
            <Ionicons name="list" size={20} color={colors.text} /><ThemedText style={{ fontSize: 14, fontWeight: "600", flexShrink: 1 }}>Exercises</ThemedText>
          </Pressable>
          <Pressable testID="player-next-exercise-shortcut" accessibilityRole="button" accessibilityLabel={nextExercise ? `Next exercise: ${nextExercise.exercise.name}` : "No next exercise"}
            accessibilityHint="Move to the next exercise without logging unfinished sets" accessibilityState={{ disabled: nextExerciseDisabled }} disabled={nextExerciseDisabled}
            onPress={() => { if (nextExercise) selectExercise(nextExercise.exercise.id); }}
            style={{ width: fontScale > 1.5 ? "100%" : 48, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: nextExerciseDisabled ? 1 : 0, borderColor: colors.inputBorder, backgroundColor: nextExerciseDisabled ? colors.background : colors.primaryButton }}>
            {fontScale > 1.5 ? <ThemedText style={{ fontSize: 14, fontWeight: "600", color: nextExerciseDisabled ? colors.placeholder : "#FFFFFF" }}>Next exercise</ThemedText> : null}
            <Ionicons name="arrow-forward" size={22} color={nextExerciseDisabled ? colors.placeholder : "#FFFFFF"} />
          </Pressable>
        </View> : null}
        <Pressable
          testID="player-finish"
          onPress={finishStatus === "idle" ? handleComplete : () => void finishWorkout(true)}
          disabled={finishStatus === "syncing" || isSavingEntries || arrangement.busy || hasPendingReplacement || !canFinish}
          accessibilityRole="button"
          accessibilityState={{ disabled: finishStatus === "syncing" || isSavingEntries || arrangement.busy || hasPendingReplacement || !canFinish, busy: finishStatus === "syncing" }}
          style={{
            backgroundColor: emphasizeFinish ? colors.primaryButton : colors.background,
            borderWidth: emphasizeFinish ? 0 : 1,
            borderColor: colors.inputBorder,
            paddingVertical: keyboardVisible ? 8 : emphasizeFinish ? 16 : 12,
            minHeight: 44,
            borderRadius: 14,
            alignItems: "center",
            opacity: finishStatus === "syncing" ? 0.6 : 1,
          }}
        >
          {finishStatus === "syncing" ? (
            <ActivityIndicator color={colors.placeholder} />
          ) : (
            <ThemedText
              type={emphasizeFinish ? "defaultSemiBold" : "default"}
              style={{
                color: !canFinish ? colors.placeholder : emphasizeFinish ? "#FFFFFF" : colors.text,
                fontSize: 16,
                textAlign: "center",
              }}
            >
              {finishStatus === "idle" ? `Finish Workout (${confirmedCount}/${totalSets})` : "Retry Finish"}
            </ThemedText>
          )}
        </Pressable>
      </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {!expandedLayout ? <View key="fixed-header">{header}</View> : null}

      {/* Main content */}
      <ScrollView
        testID="player-main-scroll"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }}
      >
        {expandedLayout ? <View key="scroll-header" style={{ marginHorizontal: -20, marginTop: -20, marginBottom: 20 }}>{header}</View> : null}
        <TouchableWithoutFeedback key="logger-body" onPress={Keyboard.dismiss} accessible={false}>
        <View pointerEvents={finishStatus === "idle" && !isSavingEntries && !arrangement.busy && !hasPendingReplacement ? "auto" : "none"}
          onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }}>
        {storageError ? (
          <View style={{ marginBottom: 12 }}>
          <ThemedText style={{ color: "#D14343", fontSize: 13 }}>
            Your latest change could not be saved on this device. Try again before leaving this workout.
          </ThemedText>
          <Pressable testID="player-retry-save" accessibilityRole="button" onPress={() => {
            if (currentItem && currentEnteredCount > 0) saveExerciseEntries(currentItem.exercise.id); else setOperations((current) => [...current]);
          }} style={{ minHeight: 44, justifyContent: "center" }}><ThemedText style={{ fontWeight: "600", fontSize: 14 }}>Retry save</ThemedText></Pressable>
          </View>
        ) : null}
        {pendingTransition && !allExercisesLayout ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <ThemedText style={{ fontSize: 14, color: colors.placeholder, marginBottom: 8 }}>
              Next up
            </ThemedText>
            <ThemedText type="title" style={{ fontSize: 26, textAlign: "center", marginBottom: 24 }}>
              {pendingTransition.nextName}
            </ThemedText>
            <Pressable
              testID="player-next-exercise"
              onPress={() => handleContinueTransition()}
              style={{
                backgroundColor: colors.primaryButton,
                paddingHorizontal: 32,
                paddingVertical: 14,
                borderRadius: 14,
              }}
            >
              <ThemedText style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                Continue
              </ThemedText>
            </Pressable>
          </View>
        ) : allExercisesLayout ? (
          <>
            <Pressable testID="player-workout-note" accessibilityRole="button" accessibilityLabel="Workout note"
              accessibilityState={{ disabled: finishStatus !== "idle" || isSavingEntries || arrangement.busy || hasPendingReplacement }}
              disabled={finishStatus !== "idle" || isSavingEntries || arrangement.busy || hasPendingReplacement}
              onPress={openWorkoutNoteEditor} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginBottom: 12 }}>
              <Ionicons name="document-text-outline" size={16} color={colors.placeholder} />
              <ThemedText style={{ fontSize: 14 }}>Workout note</ThemedText>
            </Pressable>
            {workoutNote ? <ThemedText numberOfLines={2} style={{ color: colors.placeholder, fontSize: 13, marginBottom: 12 }}>{workoutNote}</ThemedText> : null}
            {restEndsAt !== null ? <RestTimer restEndsAt={restEndsAt} totalSeconds={restTotalSeconds}
              exerciseName={restingExercise?.exercise.name} colors={colors} onAdjust={adjustRest} onSkip={handleRestSkip}
              onExpire={() => handleRestExpire(restEndsAt)}
              disabled={finishStatus !== "idle" || isSavingEntries || arrangement.busy || hasPendingReplacement} /> : null}
            {restDoneExerciseId ? <View testID="player-all-rest-done" style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <ThemedText accessibilityLiveRegion="polite" style={{ flex: 1, color: colors.primaryButton, fontSize: 14 }}>
                Rest done · {exercises.find((item) => item.exercise.id === restDoneExerciseId)?.exercise.name ?? "Exercise"}
              </ThemedText>
              <Pressable testID="player-dismiss-rest-done" accessibilityRole="button" accessibilityLabel="Dismiss rest complete notice"
                onPress={() => { if (isCurrentWorkout()) setRestDoneExerciseId(null); }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={18} color={colors.placeholder} />
              </Pressable>
            </View> : null}
            <WeightUnitControl unit={weightUnit} colors={colors}
              disabled={finishStatus !== "idle" || isSavingEntries || arrangement.busy || hasPendingReplacement} onChange={toggleWeightUnit} />
            {saveMessage ? <ThemedText testID="player-save-confirmation" accessibilityLiveRegion="polite" style={{ fontSize: 13, lineHeight: 20, color: colors.placeholder, marginBottom: 12 }}>{saveMessage}</ThemedText> : null}
            {exercises.map(renderAllExerciseCard)}
          </>
        ) : currentItem ? (
          <>
            {/* Exercise header */}
            <View style={{ flexDirection: fontScale > 2 ? "column" : "row", alignItems: fontScale > 2 ? "stretch" : "center", marginBottom: 20, gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: colors.inputBackground,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  display: fontScale > 2 ? "none" : "flex",
                }}
              >
                <ThemedText allowFontScaling={false} accessible={false} style={{ fontSize: 15, fontWeight: "600", fontFamily: Fonts.sans }}>
                  {initials}
                </ThemedText>
              </View>
              <View style={{ flex: fontScale > 2 ? undefined : 1, minWidth: 0 }}>
                <View style={{ flexDirection: fontScale > 2 ? "column-reverse" : "row", alignItems: fontScale > 2 ? "stretch" : "center", gap: 6 }}>
                  <ThemedText type="title" style={{ fontSize: 22, flexShrink: fontScale > 2 ? undefined : 1 }}>
                    {currentItem.exercise.name}
                  </ThemedText>
                  <Pressable
                    testID="player-exercise-info"
                    ref={focusInfoTrigger}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${currentItem.exercise.name} details`}
                    onPress={() => showExerciseInfo(currentItem.exercise.id, focusInfoTrigger.current, "focus")}
                    style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", alignSelf: fontScale > 2 ? "flex-end" : undefined }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={22}
                      color={colors.placeholder}
                    />
                  </Pressable>
                </View>
                <ThemedText style={{ fontSize: 14, color: colors.placeholder, marginTop: 2 }}>
                  {currentItem.prescription.sets} × {currentItem.prescription.reps} •{" "}
                  {currentItem.prescription.restSeconds}s rest
                </ThemedText>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: -8, marginBottom: 12 }}>
              {([
                { id: "player-workout-note", label: "Workout note", icon: "document-text-outline", action: openWorkoutNoteEditor },
                { id: `player-exercise-note-${currentItem.exercise.id}`, label: "Exercise note", icon: "create-outline", action: () => openExerciseNoteEditor(currentItem.exercise.id) },
                { id: `player-feedback-${currentItem.exercise.id}`, label: "Feedback", icon: "chatbubble-outline", action: () => openFeedbackEditor(currentItem.exercise.id) },
              ] as const).map((action) => <Pressable key={action.id} testID={action.id} accessibilityRole="button" accessibilityLabel={action.label}
                accessibilityState={{ disabled: finishStatus !== "idle" || isSavingEntries || arrangement.busy || hasPendingReplacement }}
                disabled={finishStatus !== "idle" || isSavingEntries || arrangement.busy || hasPendingReplacement} onPress={action.action}
                style={{ minHeight: 44, maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name={action.icon} size={16} color={colors.placeholder} />
                <ThemedText style={{ fontWeight: "500", fontSize: 13, flexShrink: 1 }}>{action.label}</ThemedText>
              </Pressable>)}
            </View>
            {exerciseNotes[currentItem.exercise.id] ? (
              <ThemedText style={{ color: colors.placeholder, marginTop: -10, marginBottom: 16, fontSize: 13 }}>
                {exerciseNotes[currentItem.exercise.id]}
              </ThemedText>
            ) : null}
            {currentFriendlySuggestion ? (
              <View
                testID={`player-load-setup-${currentItem.exercise.id}`}
                style={{
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  backgroundColor: colors.inputBackground,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  marginBottom: 16,
                }}
              >
                <ThemedText style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                  Next setup: {currentFriendlySuggestion.displayText}
                </ThemedText>
                {currentFriendlySuggestion.adjustmentNote ? (
                  <ThemedText style={{ color: colors.placeholder, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                    {currentFriendlySuggestion.adjustmentNote}
                  </ThemedText>
                ) : null}
              </View>
            ) : null}

            {restEndsAt !== null ? (
              <RestTimer
                restEndsAt={restEndsAt}
                totalSeconds={restTotalSeconds}
                exerciseName={restingExercise?.exercise.id !== currentItem.exercise.id ? restingExercise?.exercise.name : undefined}
                colors={colors}
                onAdjust={adjustRest}
                onSkip={handleRestSkip}
                onExpire={() => handleRestExpire(restEndsAt)}
                disabled={finishStatus !== "idle" || isSavingEntries || arrangement.busy || hasPendingReplacement}
              />
            ) : null}
              {renderSetInputs(currentItem, true)}
          </>
        ) : null}
        </View>
        </TouchableWithoutFeedback>
        {expandedLayout ? <View key="scroll-footer" style={{ marginHorizontal: -20, marginBottom: -20, marginTop: 20 }}>{footer}</View> : null}
      </ScrollView>

      {!expandedLayout ? <View key="fixed-footer">{footer}</View> : null}
      {expandedLayout && keyboardVisible && finishStatus === "idle" && saveEnteredAction ? <View key="keyboard-save" style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.background }}>{saveEnteredAction}</View> : null}
      </KeyboardAvoidingView>

      <Modal visible={finishReviewVisible} transparent animationType="none" onRequestClose={() => setFinishReviewVisible(false)}>
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <Pressable accessibilityLabel="Close finish confirmation" accessibilityRole="button" onPress={() => { if (!isSavingEntries) setFinishReviewVisible(false); }}
            style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.45)" }} />
          <ScrollView accessibilityViewIsModal style={{ flexGrow: 0, maxHeight: "90%", backgroundColor: colors.background, borderRadius: 20 }} contentContainerStyle={{ padding: 20, gap: 12 }}>
            <ThemedText type="subtitle">Finish workout?</ThemedText>
            <ThemedText>{confirmedCount} logged · {allEnteredSets.length} unsaved {allEnteredSets.length === 1 ? "entry" : "entries"}</ThemedText>
            <ThemedText style={{ fontSize: 14, color: colors.placeholder }}>{invalidEntryCount > 0 ? `${invalidEntryCount} ${invalidEntryCount === 1 ? "entry needs" : "entries need"} review before saving and finishing.` : "Save what you entered before finishing. Untouched suggestions won’t be logged."}</ThemedText>
            {storageError ? <ThemedText style={{ color: "#D14343", fontSize: 13 }}>Couldn’t save. Your entries are still here; try again.</ThemedText> : null}
            <Pressable testID="player-save-and-finish" accessibilityRole="button" onPress={() => void saveEntriesAndFinish()}
              disabled={invalidEntryCount > 0 || isSavingEntries} accessibilityState={{ disabled: invalidEntryCount > 0 || isSavingEntries, busy: isSavingEntries }}
              style={{ minHeight: 48, padding: 12, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: invalidEntryCount > 0 ? colors.inputBackground : colors.primaryButton }}>
              {isSavingEntries ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={{ fontWeight: "600", textAlign: "center", color: invalidEntryCount > 0 ? colors.placeholder : "#FFFFFF" }}>Save entered sets and finish</ThemedText>}
            </Pressable>
            <Pressable testID="player-review-entries" accessibilityRole="button" disabled={isSavingEntries} accessibilityState={{ disabled: isSavingEntries }} onPress={reviewEntries} style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}><ThemedText style={{ fontWeight: "600" }}>Review entries</ThemedText></Pressable>
            <Pressable testID="player-finish-logged-only" accessibilityRole="button" disabled={confirmedCount === 0 || isSavingEntries}
              accessibilityState={{ disabled: confirmedCount === 0 || isSavingEntries }} onPress={() => { setFinishReviewVisible(false); void finishWorkout(); }}
              style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}><ThemedText style={{ fontSize: 14, color: colors.placeholder }}>Finish logged sets only</ThemedText></Pressable>
          </ScrollView>
        </View>
      </Modal>

      {targetReviewExerciseIds && !pendingArrangement ? <View style={{ paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.inputBackground }}><ThemedText>Order synced. Targets stayed the same.</ThemedText><Pressable testID="player-review-synced-order" accessibilityRole="button" disabled={arrangement.busy} onPress={arrangement.reviewPending} style={{ minHeight: 44, justifyContent: "center" }}><ThemedText type="defaultSemiBold">Review target suggestions</ThemedText></Pressable></View> : null}
      {pendingArrangement ? <View style={{ paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.inputBackground }}>
        <ThemedText accessibilityLiveRegion="polite">{pendingArrangement.payload.unsupported ? "This server doesn’t support workout changes yet. Use the latest saved workout." : pendingArrangement.type === "order" ? pendingArrangement.payload.conflict ? "Your exercise order changed elsewhere. Review it before syncing." : "Your exercise order is waiting to sync." : "Your exercise replacement is waiting to sync."}</ThemedText>
        {pendingArrangement.type === "order" ? <Pressable testID="player-review-pending-order" accessibilityRole="button" disabled={arrangement.busy} onPress={arrangement.reviewPending} style={{ minHeight: 44, justifyContent: "center" }}><ThemedText type="defaultSemiBold">Review and sync order</ThemedText></Pressable> : <Pressable testID="player-retry-replacement" accessibilityRole="button" disabled={arrangement.busy} onPress={() => void retryFailedWrites()} style={{ minHeight: 44, justifyContent: "center" }}><ThemedText type="defaultSemiBold">Retry replacement</ThemedText></Pressable>}
        {pendingArrangement.type === "replace" && pendingArrangement.payload.conflict ? <Pressable testID="player-replacement-use-server" accessibilityRole="button" disabled={arrangement.busy} onPress={arrangement.dismissPending} style={{ minHeight: 44, justifyContent: "center" }}><ThemedText type="defaultSemiBold">Use latest saved workout</ThemedText></Pressable> : null}
      </View> : null}
      {arrangement.message && !sheetVisible ? <ThemedText accessibilityLiveRegion="polite" style={{ paddingHorizontal: 20, paddingVertical: 6 }}>{arrangement.message}</ThemedText> : null}
      <Modal transparent animationType="slide" onDismiss={restoreExerciseListFocus} visible={sheetVisible || currentInfoSheetVisible || Boolean(arrangement.review || arrangement.picker || arrangement.guidance)} onRequestClose={() => {
        if (arrangement.busy) return;
        if (arrangement.guidance) arrangement.setGuidance(null);
        else if (currentInfoSheetVisible) closeExerciseInfo();
        else if (arrangement.review) arrangement.setReview(null);
        else if (arrangement.picker) arrangement.setPicker(null);
        else setSheetVisible(false);
      }}>
      <ExerciseListSheet
        inline
        visible={sheetVisible && !currentInfoSheetVisible && !arrangement.review && !arrangement.picker && !arrangement.guidance}
        exercises={exercises}
        canArrange={arrangementRevision != null && finishStatus === "idle"}
        busy={arrangement.busy || isSavingEntries || isRestoring}
        selectionDisabled={exerciseSelectionDisabled}
        message={arrangement.message}
        onMove={arrangement.move}
        onReplace={arrangement.openReplacement}
        canReplace={(id) => !sets.some((set) => set.exerciseId === id && (set.confirmed || set.logId))}

        currentIndex={currentExerciseIndex}
        colors={colors}
        getProgress={getExerciseProgress}
        onSelect={(index) => {
          const id = exercises[index]?.exercise.id;
          if (id) selectExercise(id);
        }}
        onClose={() => setSheetVisible(false)}
      />

      <WorkoutArrangementSheets inline controller={arrangement} colors={colors} exercises={exercises} />
      <ExerciseInfoSheet inline visible={Boolean(arrangement.guidance)} exerciseId={arrangement.guidance?.id ?? null} exerciseName={arrangement.guidance?.name ?? ""} colors={colors} token={token} isLoggedIn={Boolean(token)} onClose={() => arrangement.setGuidance(null)} />

      <ExerciseInfoSheet
        inline
        visible={currentInfoSheetVisible && !arrangement.guidance}
        exerciseId={infoSheetEpochRef.current === navigationEpoch ? infoExerciseId : null}
        exerciseName={infoSheetEpochRef.current === navigationEpoch ? exercises.find((item) => item.exercise.id === infoExerciseId)?.exercise.name ?? "" : ""}
        colors={colors}
        token={token}
        isLoggedIn={Boolean(token)}
        onClose={closeExerciseInfo}
      />
      </Modal>

      <Modal transparent visible={noteEditorVisible} animationType="none" onRequestClose={closeNoteEditor}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
        >
          <View style={{ flex: 1, backgroundColor: "#00000066" }}>
            <Pressable
              testID="player-note-backdrop"
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
              onPress={Keyboard.dismiss}
              style={{ flex: 1 }}
            />
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 20), gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Pressable testID="player-cancel-note" accessibilityRole="button" onPress={closeNoteEditor} style={{ minWidth: 72, minHeight: 44, justifyContent: "center" }}>
                  <ThemedText style={{ color: colors.primaryButton }}>Cancel</ThemedText>
                </Pressable>
                <ThemedText type="title" style={{ flex: 1, fontSize: 20, textAlign: "center" }}>{noteEditorTarget === "workout" ? "Workout note" : "Exercise note"}</ThemedText>
                <Pressable testID="player-save-note" accessibilityRole="button" onPress={saveNote} style={{ minWidth: 72, minHeight: 44, justifyContent: "center", alignItems: "flex-end" }}>
                  <ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>Save</ThemedText>
                </Pressable>
              </View>
              <TextInput
                testID={noteEditorTarget === "workout" ? "player-workout-note-input" : `player-exercise-note-input-${noteEditorExerciseId ?? ""}`}
                value={noteDraft}
                onChangeText={setNoteDraft}
                placeholder="Add a note"
                placeholderTextColor={colors.placeholder}
                multiline
                style={{ minHeight: 110, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, color: colors.text, padding: 12, textAlignVertical: "top" }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal transparent visible={feedbackEditorVisible} animationType="none" onRequestClose={() => setFeedbackEditorVisible(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#00000066" }}>
          <ScrollView accessibilityViewIsModal style={{ flexGrow: 0, maxHeight: "90%", backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: Math.max(insets.bottom, 20), gap: 14 }}>
            <ThemedText accessibilityRole="header" type="title" style={{ fontSize: 21 }}>How did that feel?</ThemedText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["easy", "right", "hard"] as const).map((effort) => (
                <Pressable key={effort} testID={`player-feedback-effort-${effort}`} accessibilityRole="button" accessibilityLabel={effort[0].toUpperCase() + effort.slice(1)} accessibilityState={{ selected: feedbackDraft.effort === effort }} onPress={() => setFeedbackDraft((draft) => ({ ...draft, effort }))} style={{ flexGrow: 1, flexShrink: 1, flexBasis: "auto", minWidth: 44, minHeight: 44, maxWidth: "100%", paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: feedbackDraft.effort === effort ? colors.primaryButton : colors.inputBackground }}>
                  <ThemedText style={{ color: feedbackDraft.effort === effort ? "#FFF" : colors.text, fontWeight: "700", textTransform: "capitalize" }}>{effort}</ThemedText>
                </Pressable>
              ))}
            </View>
            <ThemedText style={{ color: colors.placeholder }}>Optional RIR</ThemedText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[0, 1, 2, 3, 4, 5].map((rir) => (
                <Pressable key={rir} testID={`player-feedback-rir-${rir}`} accessibilityRole="button" accessibilityLabel={`${rir} ${rir === 1 ? "rep" : "reps"} in reserve`} accessibilityState={{ selected: feedbackDraft.rir === rir }} onPress={() => setFeedbackDraft((draft) => ({ ...draft, rir: draft.rir === rir ? null : rir }))} style={{ minWidth: 44, minHeight: 44, maxWidth: "100%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: feedbackDraft.rir === rir ? colors.primaryButton : colors.inputBackground }}>
                  <ThemedText style={{ color: feedbackDraft.rir === rir ? "#FFF" : colors.text, fontWeight: "700" }}>{rir}</ThemedText>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 18 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Cancel exercise feedback" onPress={() => setFeedbackEditorVisible(false)} style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center", alignItems: "center" }}><ThemedText style={{ color: colors.placeholder, fontWeight: "700" }}>Cancel</ThemedText></Pressable>
              <Pressable testID="player-save-feedback" accessibilityRole="button" accessibilityLabel="Save exercise feedback" onPress={saveExerciseFeedback} style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center", alignItems: "center" }}><ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>Save</ThemedText></Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
