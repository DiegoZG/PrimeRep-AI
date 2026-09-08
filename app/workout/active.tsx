import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExerciseInfoSheet } from "@/components/workout/ExerciseInfoSheet";
import { ExerciseListSheet } from "@/components/workout/ExerciseListSheet";
import { RestTimer } from "@/components/workout/RestTimer";
import { SetInputRow } from "@/components/workout/SetInputRow";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWorkoutWeek } from "@/hooks/use-workout-week";
import type { RestContext, SetState, WorkoutDay, WorkoutItem } from "@/interfaces/workouts";
import {
  abandonSession,
  completeSession,
  fetchLastSetsForExercises,
  getActiveSession,
  getSession,
  type LastSet,
} from "@/services/workoutLoggingService";
import { mapApiWorkoutDay } from "@/services/workoutWeekService";
import { AuthContext } from "@/utils/authContext";
import {
  clearActiveWorkout,
  createClientId,
  loadActiveWorkout,
  replayPendingWorkoutOperations,
  retryFailedWorkoutOperations,
  saveActiveWorkout,
  type PendingWorkoutOperation,
} from "@/utils/activeWorkoutStore";
import {
  convertWeightString,
  formatWeightInput,
  formatWeightLabel,
  fromKg,
  loadWeightUnit,
  saveWeightUnit,
  toKg,
  type WeightUnit,
} from "@/utils/weightUnits";

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

interface WorkoutSummaryPayload {
  workoutName: string;
  durationSeconds: number;
  setsCompleted: number;
  totalSets: number;
  totalVolumeKg: number;
  weightUnit: WeightUnit;
  prExerciseNames: string[];
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
  logs: { id: string; exerciseId: string; setNumber: number; reps: number; weightKg: number | null }[],
  unit: WeightUnit
): SetState[] {
  const bySet = new Map(logs.map((log) => [`${log.exerciseId}:${log.setNumber}`, log]));
  return prescribed.map((set) => {
    const log = bySet.get(`${set.exerciseId}:${set.setNumber}`);
    return log
      ? { ...set, reps: String(log.reps), weight: log.weightKg == null ? "" : formatWeightInput(fromKg(log.weightKg, unit)), confirmed: true, syncing: false, syncStatus: "synced" as const, logId: log.id }
      : set;
  });
}

function mergePersistedSets(prescribed: SetState[], persisted: SetState[]): SetState[] {
  const bySet = new Map(persisted.map((set) => [`${set.exerciseId}:${set.setNumber}`, set]));
  return prescribed.map((set) => bySet.get(`${set.exerciseId}:${set.setNumber}`) ?? set);
}

function mergeReplaySets(current: SetState[], replayed: SetState[]): SetState[] {
  const bySet = new Map(replayed.map((set) => [`${set.exerciseId}:${set.setNumber}`, set]));
  return current.map((set) => {
    const replayedSet = bySet.get(`${set.exerciseId}:${set.setNumber}`);
    if (!replayedSet || (set.confirmed && !replayedSet.confirmed)) return set;
    return {
      ...replayedSet,
      reps: set.reps || replayedSet.reps,
      weight: set.weight || replayedSet.weight,
    };
  });
}

function reconcileSetSyncState(sets: SetState[], operations: PendingWorkoutOperation[]): SetState[] {
  const pendingSetKeys = new Set(
    operations
      .filter((operation): operation is Extract<PendingWorkoutOperation, { type: "set" }> => operation.type === "set")
      .map((operation) => `${operation.payload.exerciseId}:${operation.payload.setNumber}`)
  );
  return sets.map((set) =>
    set.confirmed && !pendingSetKeys.has(`${set.exerciseId}:${set.setNumber}`)
      ? { ...set, syncing: false, syncStatus: "synced" as const }
      : set
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const { workoutDayId, sessionId: requestedSessionId } = useLocalSearchParams<{ workoutDayId?: string; sessionId?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { token, user } = useContext(AuthContext);
  const { getWorkoutById, isLoading: isWeekLoading, refreshWeek } = useWorkoutWeek();

  const [snapshotWorkout, setSnapshotWorkout] = useState<WorkoutDay | null>(null);
  const [legacySession, setLegacySession] = useState<Awaited<ReturnType<typeof getActiveSession>>>(null);
  const [isResolvingSession, setIsResolvingSession] = useState(Boolean(requestedSessionId));
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
      if (!cancelled && local?.workoutSnapshot && (!requestedSessionId || local.serverSessionId === requestedSessionId)) {
        setSnapshotWorkout(local.workoutSnapshot);
      }
      if (!token) {
        if (!cancelled) setIsResolvingSession(false);
        return;
      }
      const server = requestedSessionId
        ? await getSession(token, requestedSessionId).catch(() => null)
        : await getActiveSession(token).catch(() => null);
      if (!cancelled && server) {
        if (server.workoutSnapshot) {
          setSnapshotWorkout(mapApiWorkoutDay(server.workoutSnapshot));
        } else if (server.recoveryRequired) {
          setLegacySession(server);
        }
      }
      if (!cancelled) setIsResolvingSession(false);
    }
    void resolveSessionWorkout();
    return () => { cancelled = true; };
  }, [user, token, requestedSessionId]);

  useEffect(() => {
    if (workout || !workoutDayId || isWeekLoading || hasRequestedWorkout) return;
    setHasRequestedWorkout(true);
    void refreshWeek({ force: false });
  }, [workout, workoutDayId, isWeekLoading, hasRequestedWorkout, refreshWeek]);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [finishStatus, setFinishStatus] = useState<"idle" | "syncing" | "pendingOffline" | "failed">("idle");
  const [isRestoring, setIsRestoring] = useState(true);
  const [clientSessionId, setClientSessionId] = useState(createClientId);
  const [startedAt, setStartedAt] = useState(Date.now);
  const [operations, setOperations] = useState<PendingWorkoutOperation[]>([]);
  const [persistedRevision, setPersistedRevision] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const replayInFlightRef = useRef(false);
  const operationsRef = useRef<PendingWorkoutOperation[]>([]);
  const [storageError, setStorageError] = useState(false);
  const [didComplete, setDidComplete] = useState(false);
  const isTerminalRef = useRef(false);
  const isFinishingRef = useRef(false);
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

  useEffect(() => {
    operationsRef.current = operations;
  }, [operations]);

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
      }))
    );
    setWeightUnit(next);
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
    if (!unitReady || !lastSetsLoaded || sets.length === 0 || hasPrefilledRef.current) return;
    hasPrefilledRef.current = true;
    setSets((prev) =>
      prev.map((s) => {
        if (s.confirmed || s.weight || s.reps) return s;
        const item = exercises.find((e) => e.exercise.id === s.exerciseId);
        const match = findHistoryForSet(lastSetsByExercise[s.exerciseId], s.setNumber);
        const suggestedKg = item?.prescription.suggestedWeightKg;
        const prefillWeight =
          suggestedKg != null
            ? formatWeightInput(fromKg(suggestedKg, weightUnit))
            : match?.weightKg != null
            ? formatWeightInput(fromKg(match.weightKg, weightUnit))
            : s.weight;
        const prefillReps = match?.reps != null ? String(match.reps) : s.reps;
        if (!prefillWeight && !prefillReps) return s;
        return { ...s, weight: prefillWeight, reps: prefillReps };
      })
    );
  }, [unitReady, lastSetsLoaded, sets.length, lastSetsByExercise, weightUnit, exercises]);

  // Confirmed set count (overall, across all exercises)
  const confirmedCount = useMemo(() => sets.filter((s) => s.confirmed).length, [sets]);
  const totalSets = sets.length;
  const syncLabel = useMemo(() => {
    if (isReplaying) return "Syncing…";
    if (operations.some((operation) => operation.status === "failed") || sets.some((set) => set.syncStatus === "failed")) return "Sync needs attention";
    if (operations.length > 0 || sets.some((set) => set.confirmed && set.syncStatus !== "synced")) return "Saved locally — waiting to sync";
    return "Synced";
  }, [isReplaying, operations, sets]);

  const pendingSetOperations = useMemo(() => {
    const bySet = new Map<string, PendingWorkoutOperation>();
    for (const operation of operations) {
      if (operation.type === "set") {
        bySet.set(`${operation.payload.exerciseId}:${operation.payload.setNumber}`, operation);
      }
    }
    return bySet;
  }, [operations]);

  const getExerciseProgress = useCallback(
    (exerciseId: string) => {
      const exerciseSets = sets.filter((s) => s.exerciseId === exerciseId);
      return {
        confirmed: exerciseSets.filter((s) => s.confirmed).length,
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

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [infoSheetVisible, setInfoSheetVisible] = useState(false);
  const currentItem: WorkoutItem | undefined = exercises[currentExerciseIndex];

  const currentSets = useMemo(() => {
    if (!currentItem) return [];
    return sets
      .filter((s) => s.exerciseId === currentItem.exercise.id)
      .sort((a, b) => a.setNumber - b.setNumber);
  }, [sets, currentItem]);

  // ── Rest timer state ───────────────────────────────────────────────────────

  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restTotalSeconds, setRestTotalSeconds] = useState(0);
  const [restContext, setRestContext] = useState<RestContext | null>(null);
  const [pendingTransition, setPendingTransition] = useState<{
    nextIndex: number;
    nextName: string;
  } | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredWorkoutKey = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!user || !workout || !unitReady) return;
      const restoreKey = `${user.id}:${workout.workoutDayId}`;
      if (restoredWorkoutKey.current === restoreKey) {
        setIsRestoring(false);
        return;
      }
      restoredWorkoutKey.current = restoreKey;
      const [saved, serverActive] = await Promise.all([
        loadActiveWorkout(user.id).catch(() => null),
        token ? getActiveSession(token).catch(() => null) : Promise.resolve(null),
      ]);

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
          setSets(mergeServerLogs(prescribedSetStates(exercises), serverActive.setLogs, weightUnit));
        } else {
          const newClientSessionId = createClientId();
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
        setCurrentExerciseIndex(saved.currentExerciseIndex);
        setRestEndsAt(saved.restEndsAt);
        setRestTotalSeconds(saved.restTotalSeconds);
        setRestContext(saved.restContext);
        const restoredSets = mergePersistedSets(prescribedSetStates(exercises), saved.sets);
        setSets(serverActive ? mergeServerLogs(restoredSets, serverActive.setLogs, weightUnit) : restoredSets);
        setOperations(reconciledOperations);
      }
      if (!cancelled) setIsRestoring(false);
    }
    void restore();
    return () => { cancelled = true; };
  }, [user, workout, token, unitReady, weightUnit, exercises, router, clientSessionId, requestedSessionId]);

  // Store every draft, confirmed set, timer timestamp, and queued operation before
  // attempting network sync. This is what lets process termination be recoverable.
  useEffect(() => {
    if (isTerminalRef.current || isFinishingRef.current || replayInFlightRef.current || isRestoring || !user || !workout || sets.length === 0) return;
    void saveActiveWorkout({
      userId: user.id,
      workoutDayId: workout.workoutDayId,
      workoutDate: workout.date,
      dayType: workout.dayType,
      workoutSnapshot: workout,
      clientSessionId,
      serverSessionId: sessionId,
      startedAt,
      currentExerciseIndex,
      restEndsAt,
      restTotalSeconds,
      restContext,
      sets,
      operations,
      revision: ++workoutRevisionRef.current,
    }).then(() => {
      setStorageError(false);
      setPersistedRevision((revision) => revision + 1);
    }).catch(() => setStorageError(true));
  }, [isRestoring, user, workout, sets, clientSessionId, sessionId, startedAt, currentExerciseIndex, restEndsAt, restTotalSeconds, restContext, operations]);

  const replayPendingWrites = useCallback(async () => {
    if (!token || !user || replayInFlightRef.current) return;
    replayInFlightRef.current = true;
    const operationIdsAtStart = new Set(operationsRef.current.map((operation) => operation.id));
    setIsReplaying(true);
    try {
      const result = await replayPendingWorkoutOperations(token, user.id);
      if (!result.workout) return;
      workoutRevisionRef.current = Math.max(workoutRevisionRef.current, result.workout.revision);
      setSessionId(result.workout.serverSessionId);
      const remainingById = new Map(result.workout.operations.map((operation) => [operation.id, operation]));
      const nextOperations = [
        ...result.workout.operations,
        ...operationsRef.current.filter((operation) => !operationIdsAtStart.has(operation.id) && !remainingById.has(operation.id)),
      ];
      setSets((current) => reconcileSetSyncState(mergeReplaySets(current, result.workout!.sets), nextOperations));
      setOperations((current) => {
        return [
          ...result.workout!.operations,
          ...current.filter((operation) => !operationIdsAtStart.has(operation.id) && !remainingById.has(operation.id)),
        ];
      });
      if (result.abandoned || result.completed) {
        isTerminalRef.current = true;
        await clearActiveWorkout(user.id);
        if (result.completed) setDidComplete(true);
      }
    } catch {
      // The operation remains durable and will be retried on the next retry window.
    } finally {
      replayInFlightRef.current = false;
      setIsReplaying(false);
    }
  }, [token, user]);

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
    if (!user) return;
    const restored = await retryFailedWorkoutOperations(user.id);
    if (restored) {
      setSets(restored.sets);
      setOperations(restored.operations);
      setPersistedRevision((revision) => revision + 1);
    }
  }, [user]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setPersistedRevision((revision) => revision + 1);
    });
    return () => subscription.remove();
  }, []);

  const isRestingCurrentExercise =
    restEndsAt !== null && restContext?.exerciseIndex === currentExerciseIndex;

  const finishRest = useCallback(() => {
    setRestEndsAt(null);
    setRestContext((ctx) => {
      if (ctx?.isLastSetOfExercise) {
        const nextIndex = ctx.exerciseIndex + 1;
        if (nextIndex < exercises.length) {
          setPendingTransition({ nextIndex, nextName: exercises[nextIndex].exercise.name });
        }
      }
      return null;
    });
  }, [exercises]);

  const handleRestExpire = useCallback(() => {
    playRestEndFeedback();
    finishRest();
  }, [playRestEndFeedback, finishRest]);

  const handleRestSkip = useCallback(() => {
    finishRest();
  }, [finishRest]);

  const adjustRest = useCallback((deltaSeconds: number) => {
    setRestEndsAt((prev) => (prev === null ? prev : prev + deltaSeconds * 1000));
  }, []);

  const handleContinueTransition = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    setPendingTransition((current) => {
      if (!current) return null;
      setCurrentExerciseIndex(current.nextIndex);
      return null;
    });
  }, []);

  // Auto-advance the "Next up" transition after a short delay; the user can
  // also tap Continue to skip the wait.
  useEffect(() => {
    if (!pendingTransition) return;
    transitionTimeoutRef.current = setTimeout(() => {
      handleContinueTransition();
    }, 2200);
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, [pendingTransition, handleContinueTransition]);

  // ── Set input handlers ─────────────────────────────────────────────────────

  const updateSet = useCallback(
    (setNumber: number, field: "reps" | "weight", value: string) => {
      if (!currentItem) return;
      const exerciseId = currentItem.exercise.id;
      setSets((prev) =>
        prev.map((s) =>
          s.exerciseId === exerciseId && s.setNumber === setNumber
            ? { ...s, [field]: value }
            : s
        )
      );
    },
    [currentItem]
  );

  const confirmSet = useCallback(
    async (setNumber: number) => {
      if (!token || !currentItem) return;
      const exerciseId = currentItem.exercise.id;

      const target = sets.find(
        (s) => s.exerciseId === exerciseId && s.setNumber === setNumber
      );
      if (!target || target.confirmed) return;

      const reps = parseInt(target.reps, 10);
      if (isNaN(reps) || reps <= 0) {
        Alert.alert("Invalid reps", "Enter a valid number of reps.");
        return;
      }

      const weightDisplay = target.weight ? parseFloat(target.weight) : undefined;
      if (target.weight && (isNaN(weightDisplay!) || weightDisplay! < 0)) {
        Alert.alert("Invalid weight", "Enter a valid weight.");
        return;
      }
      // Backend always stores kilograms.
      const weightKg =
        weightDisplay != null ? Math.round(toKg(weightDisplay, weightUnit) * 100) / 100 : undefined;

      // Determine whether this confirmation completes the exercise, so we
      // know what to do once the rest period that follows ends.
      const exerciseSetsAfter = sets
        .filter((s) => s.exerciseId === exerciseId)
        .map((s) => (s.setNumber === setNumber ? { ...s, confirmed: true } : s));
      const isLastSetOfExercise = exerciseSetsAfter.every((s) => s.confirmed);

      // Optimistic update
      setSets((prev) =>
        prev.map((s) =>
          s.exerciseId === exerciseId && s.setNumber === setNumber
            ? { ...s, confirmed: true, syncing: true, syncStatus: "pending" }
            : s
        )
      );

      // Rest timer starts immediately — it's a UX affordance independent of
      // whether the network call has resolved yet.
      const restSeconds = currentItem.prescription.restSeconds;
      setRestTotalSeconds(restSeconds);
      setRestEndsAt(Date.now() + restSeconds * 1000);
      setRestContext({ exerciseIndex: currentExerciseIndex, isLastSetOfExercise });

      setOperations((previous) => [
        ...previous,
        {
          id: createClientId(),
          type: "set",
          status: "pending",
          payload: { exerciseId, setNumber, reps, weightKg },
        },
      ]);
    },
    [token, sets, currentItem, currentExerciseIndex, weightUnit]
  );

  // ── Complete workout ───────────────────────────────────────────────────────

  const buildSummaryPayload = useCallback((): WorkoutSummaryPayload => {
    let totalVolumeKg = 0;
    const prExerciseNames = new Set<string>();

    for (const item of exercises) {
      const history = lastSetsByExercise[item.exercise.id] || [];
      const priorMaxWeight = history.reduce<number | null>((max, h) => {
        if (h.weightKg == null) return max;
        return max === null ? h.weightKg : Math.max(max, h.weightKg);
      }, null);

      const exerciseSets = sets.filter((s) => s.exerciseId === item.exercise.id && s.confirmed);
      for (const s of exerciseSets) {
        const weightDisplay = s.weight ? parseFloat(s.weight) : null;
        const reps = parseInt(s.reps, 10);
        if (weightDisplay != null && !isNaN(weightDisplay) && !isNaN(reps)) {
          const weightKg = toKg(weightDisplay, weightUnit);
          totalVolumeKg += weightKg * reps;
          if (priorMaxWeight !== null && weightKg > priorMaxWeight) {
            prExerciseNames.add(item.exercise.name);
          }
        }
      }
    }

    return {
      workoutName: workout?.title || "Workout",
      durationSeconds: elapsedSeconds,
      setsCompleted: confirmedCount,
      totalSets,
      totalVolumeKg,
      weightUnit,
      prExerciseNames: Array.from(prExerciseNames),
    };
  }, [
    exercises,
    lastSetsByExercise,
    sets,
    workout,
    elapsedSeconds,
    confirmedCount,
    totalSets,
    weightUnit,
  ]);

  const finishWorkout = useCallback(async (retry = false) => {
    if (!token || !user || !workout || isFinishingRef.current) return;
    isFinishingRef.current = true;
    setFinishStatus("syncing");
    const completionOperation: PendingWorkoutOperation = {
      id: createClientId(), type: "complete", status: "pending", payload: {},
    };
    const nextOperations = retry
      ? operations.map((operation) => operation.type === "complete"
        ? { ...operation, status: "pending" as const, nextAttemptAt: undefined }
        : operation)
      : [...operations, completionOperation];
    try {
      const stored = await loadActiveWorkout(user.id);
      await saveActiveWorkout({
        userId: user.id,
        workoutDayId: workout.workoutDayId,
        workoutDate: workout.date,
        dayType: workout.dayType,
        workoutSnapshot: workout,
        clientSessionId,
        serverSessionId: sessionId ?? stored?.serverSessionId ?? null,
        startedAt,
        currentExerciseIndex,
        restEndsAt,
        restTotalSeconds,
        restContext,
        sets,
        operations: nextOperations,
        revision: ++workoutRevisionRef.current,
      });
      setOperations(nextOperations);
      const result = await replayPendingWorkoutOperations(token, user.id);
      const completeOperation = result.workout?.operations.find((operation) => operation.type === "complete");
      if (result.completed || (result.workout && !completeOperation)) {
        isTerminalRef.current = true;
        await clearActiveWorkout(user.id);
        setDidComplete(true);
        return;
      }
      if (!result.workout) throw new Error("Missing active workout");
      workoutRevisionRef.current = Math.max(workoutRevisionRef.current, result.workout.revision);
      setSets(result.workout.sets);
      setOperations(result.workout.operations);
      setFinishStatus(completeOperation?.status === "failed" ? "failed" : "pendingOffline");
    } catch {
      setFinishStatus("failed");
    } finally {
      isFinishingRef.current = false;
    }
  }, [token, user, workout, operations, clientSessionId, sessionId, startedAt, currentExerciseIndex, restEndsAt, restTotalSeconds, restContext, sets]);

  const handleComplete = useCallback(() => {
    if (confirmedCount === 0) {
      Alert.alert("No sets logged", "Log at least one set before finishing.");
      return;
    }
    Alert.alert("Finish Workout?", `You completed ${confirmedCount} of ${totalSets} sets.`, [
      { text: "Keep Going", style: "cancel" },
      { text: "Finish", onPress: () => void finishWorkout() },
    ]);
  }, [confirmedCount, totalSets, finishWorkout]);

  useEffect(() => {
    if (!didComplete) return;
    if (timerRef.current) clearInterval(timerRef.current);
    router.replace({
      pathname: "/workout/summary",
      params: { payload: JSON.stringify(buildSummaryPayload()) },
    });
  }, [didComplete, router, buildSummaryPayload]);

  // ── Back with confirmation ─────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    const leaveWorkout = () => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
    };
    if (confirmedCount > 0) {
      Alert.alert(
        "Quit Workout?",
        "Your logged sets will be saved but the session won't be marked as complete.",
        [
          { text: "Keep Going", style: "cancel" },
          { text: "Quit", style: "destructive", onPress: leaveWorkout },
        ]
      );
    } else {
      leaveWorkout();
    }
  }, [confirmedCount, router]);

  // ── Loading / error states ─────────────────────────────────────────────────

  if (legacySession) {
    const savedSetCount = legacySession.setLogs.length;
    const resolveLegacySession = async (action: "complete" | "abandon") => {
      if (!token || !user) return;
      try {
        if (action === "complete") await completeSession(token, legacySession.id);
        else await abandonSession(token, legacySession.id);
        await clearActiveWorkout(user.id);
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

  if (isRestoring || sets.length === 0) {
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.inputBorder,
        }}
      >
        <Pressable
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          style={{ flex: 1, alignItems: "center" }}
          onPress={() => setSheetVisible(true)}
        >
          <ThemedText type="defaultSemiBold">{workout.title}</ThemedText>
          <ThemedText style={{ fontSize: 13, color: colors.placeholder }}>
            {formatTime(elapsedSeconds)} • Exercise {currentExerciseIndex + 1} of{" "}
            {exercises.length} • {confirmedCount}/{totalSets} sets
          </ThemedText>
          <ThemedText style={{ fontSize: 11, color: colors.placeholder, marginTop: 2 }}>
            {syncLabel}
          </ThemedText>
        </Pressable>
        <Pressable
          testID="player-exercise-list-button"
          onPress={() => setSheetVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="list" size={22} color={colors.text} />
        </Pressable>
        {finishStatus === "pendingOffline" || finishStatus === "failed" ? (
          <Pressable onPress={() => router.replace("/(tabs)")} style={{ paddingTop: 12 }}>
            <ThemedText style={{ textAlign: "center", color: colors.primaryButton, fontWeight: "700" }}>Back to Home</ThemedText>
          </Pressable>
        ) : null}
      </View>

      {/* Overall progress bar */}
      <View style={{ height: 3, backgroundColor: colors.inputBorder }}>
        <View
          style={{
            height: 3,
            width: totalSets > 0 ? `${(confirmedCount / totalSets) * 100}%` : "0%",
            backgroundColor: colors.primaryButton,
          }}
        />
      </View>

      {/* Main content */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        {storageError ? (
          <ThemedText style={{ color: "#D14343", fontSize: 13, marginBottom: 12 }}>
            Your latest change could not be saved on this device. Try again before leaving this workout.
          </ThemedText>
        ) : null}
        {operations.some((operation) => operation.status === "failed") ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void retryFailedWrites()}
            style={{ alignSelf: "flex-start", marginBottom: 14, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: `${colors.primaryButton}15` }}
          >
            <ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>Retry failed sync</ThemedText>
          </Pressable>
        ) : null}
        {pendingTransition ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <ThemedText style={{ fontSize: 14, color: colors.placeholder, marginBottom: 8 }}>
              Next up
            </ThemedText>
            <ThemedText type="title" style={{ fontSize: 26, textAlign: "center", marginBottom: 24 }}>
              {pendingTransition.nextName}
            </ThemedText>
            <Pressable
              testID="player-next-exercise"
              onPress={handleContinueTransition}
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
        ) : currentItem ? (
          <>
            {/* Exercise header */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 12 }}>
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
                }}
              >
                <ThemedText style={{ fontSize: 15, fontWeight: "600", fontFamily: Fonts.sans }}>
                  {initials}
                </ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <ThemedText type="title" style={{ fontSize: 22, flexShrink: 1 }}>
                    {currentItem.exercise.name}
                  </ThemedText>
                  <Pressable
                    testID="player-exercise-info"
                    onPress={() => setInfoSheetVisible(true)}
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

            {isRestingCurrentExercise && restEndsAt !== null ? (
              <RestTimer
                restEndsAt={restEndsAt}
                totalSeconds={restTotalSeconds}
                colors={colors}
                onAdjust={adjustRest}
                onSkip={handleRestSkip}
                onExpire={handleRestExpire}
              />
            ) : (
              <>
                {/* Column labels + unit toggle */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 4,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ width: 42 }} />
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ThemedText
                      style={{
                        fontSize: 11,
                        color: colors.placeholder,
                        fontWeight: "500",
                        fontFamily: Fonts.sans,
                        textTransform: "uppercase",
                      }}
                    >
                      Weight
                    </ThemedText>
                    <View
                      style={{
                        flexDirection: "row",
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.inputBorder,
                        overflow: "hidden",
                      }}
                    >
                      {(["LB", "KG"] as const).map((unit) => {
                        const isActive = weightUnit === unit;
                        return (
                          <Pressable
                            key={unit}
                            testID={`player-unit-${unit.toLowerCase()}`}
                            onPress={() => {
                              if (unit !== weightUnit) toggleWeightUnit();
                            }}
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              backgroundColor: isActive
                                ? colors.primaryButton
                                : colors.background,
                            }}
                          >
                            <ThemedText
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                fontFamily: Fonts.sans,
                                color: isActive ? "#FFFFFF" : colors.placeholder,
                              }}
                            >
                              {unit}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={{ width: 20 }} />
                  <ThemedText
                    style={{
                      flex: 1,
                      fontSize: 11,
                      color: colors.placeholder,
                      fontWeight: "500",
                      fontFamily: Fonts.sans,
                      textTransform: "uppercase",
                    }}
                  >
                    Reps
                  </ThemedText>
                  <View style={{ width: 40 }} />
                </View>

                {currentSets.map((setRow) => {
                  const reason = currentItem?.prescription.suggestedWeightReason;
                  const progressionTag =
                    reason === "increase" ? "▲"
                    : reason === "hold" ? "—"
                    : reason === "deload" ? "▼"
                    : undefined;
                  const operation = pendingSetOperations.get(`${setRow.exerciseId}:${setRow.setNumber}`);
                  const displaySet = operation
                    ? {
                        ...setRow,
                        syncing: operation.status === "retrying",
                        syncStatus: operation.status === "failed" ? "failed" as const : setRow.syncStatus,
                      }
                    : setRow.confirmed
                    ? { ...setRow, syncing: false, syncStatus: "synced" as const }
                    : setRow;
                  return (
                    <SetInputRow
                      key={`${setRow.exerciseId}-${setRow.setNumber}`}
                      setRow={displaySet}
                      colors={colors}
                      weightUnit={weightUnit}
                      lastTimeHint={formatLastTimeHint(
                        findHistoryForSet(lastSetsByExercise[setRow.exerciseId], setRow.setNumber),
                        weightUnit
                      )}
                      progressionTag={progressionTag}
                      onUpdate={updateSet}
                      onConfirm={confirmSet}
                    />
                  );
                })}
              </>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Finish button */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 20,
          paddingBottom: 34,
          paddingTop: 12,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.inputBorder,
        }}
      >
        {finishStatus !== "idle" ? (
          <ThemedText style={{ textAlign: "center", color: finishStatus === "failed" ? "#DC2626" : colors.placeholder, fontSize: 13, marginBottom: 8 }}>
            {finishStatus === "syncing" ? "Finishing workout…" : finishStatus === "failed" ? "Couldn't finish this workout. Your sets are safe." : "Saved on this device — finish when online."}
          </ThemedText>
        ) : null}
        <Pressable
          testID="player-finish"
          onPress={finishStatus === "idle" ? handleComplete : () => void finishWorkout(true)}
          disabled={finishStatus === "syncing" || confirmedCount === 0}
          style={{
            backgroundColor: confirmedCount > 0 ? colors.primaryButton : colors.inputBackground,
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: "center",
            opacity: finishStatus === "syncing" ? 0.6 : 1,
          }}
        >
          {finishStatus === "syncing" ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText
              type="defaultSemiBold"
              style={{
                color: confirmedCount > 0 ? "#FFFFFF" : colors.placeholder,
                fontSize: 16,
              }}
            >
              {finishStatus === "idle" ? `Finish Workout (${confirmedCount}/${totalSets})` : "Retry Finish"}
            </ThemedText>
          )}
        </Pressable>
      </View>

      <ExerciseListSheet
        visible={sheetVisible}
        exercises={exercises}
        currentIndex={currentExerciseIndex}
        colors={colors}
        getProgress={getExerciseProgress}
        onSelect={(index) => {
          setCurrentExerciseIndex(index);
          setSheetVisible(false);
        }}
        onClose={() => setSheetVisible(false)}
      />

      <ExerciseInfoSheet
        visible={infoSheetVisible}
        exerciseId={currentItem?.exercise.id ?? null}
        exerciseName={currentItem?.exercise.name ?? ""}
        colors={colors}
        token={token}
        isLoggedIn={Boolean(token)}
        onClose={() => setInfoSheetVisible(false)}
      />
    </SafeAreaView>
  );
}
