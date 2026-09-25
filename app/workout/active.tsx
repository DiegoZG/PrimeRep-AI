import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Modal, Pressable, ScrollView, TextInput, View } from "react-native";
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
  createClientId,
  loadActiveWorkout,
  queueWorkoutCompletion,
  replayPendingWorkoutOperations,
  retryFailedWorkoutOperations,
  saveActiveWorkout,
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
  const { workoutDayId, sessionId: requestedSessionId } = useLocalSearchParams<{ workoutDayId?: string; sessionId?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { token, user } = useContext(AuthContext);
  const equipmentWeights = useContext(EquipmentWeightsContext);
  const { markWorkoutTerminal } = useActiveWorkout();
  const { getWorkoutById, isLoading: isWeekLoading, refreshWeek } = useWorkoutWeek();

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
          if (matchingLocal) setSnapshotWorkout(matchingLocal.workoutSnapshot!);
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
        if (matchingLocal) setSnapshotWorkout(matchingLocal.workoutSnapshot!);
        setCanRestoreRequestedSession(Boolean(matchingLocal) && !server);
        setIsResolvingSession(false);
        if (server) router.replace("/(tabs)");
        return;
      }
      if (server) {
        if (server.workoutSnapshot) {
          setSnapshotWorkout(mapApiWorkoutDay(server.workoutSnapshot));
        } else if (server.recoveryRequired) {
          setLegacySession(server);
        }
      }
      if (matchingLocal && !server) setSnapshotWorkout(matchingLocal.workoutSnapshot!);
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
  const [startedAt, setStartedAt] = useState(Date.now);
  const [operations, setOperations] = useState<PendingWorkoutOperation[]>([]);
  const [persistedRevision, setPersistedRevision] = useState(0);
  const replayInFlightRef = useRef(false);
  const deferredPersistenceRef = useRef(false);
  const operationsRef = useRef<PendingWorkoutOperation[]>([]);
  const [storageError, setStorageError] = useState(false);
  const [didComplete, setDidComplete] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
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
  const setsRef = useRef<SetState[]>([]);
  const [workoutNote, setWorkoutNote] = useState<string | null>(null);
  const [exerciseFeedback, setExerciseFeedback] = useState<Record<string, { effort: "easy" | "right" | "hard" | null; rir: number | null }>>({});
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string | null>>({});
  const [noteEditorVisible, setNoteEditorVisible] = useState(false);
  const [noteEditorTarget, setNoteEditorTarget] = useState<"workout" | "exercise">("workout");
  const [noteDraft, setNoteDraft] = useState("");
  const [feedbackEditorVisible, setFeedbackEditorVisible] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState<{ effort: "easy" | "right" | "hard" | null; rir: number | null }>({ effort: null, rir: null });

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

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [infoSheetVisible, setInfoSheetVisible] = useState(false);
  const currentItem: WorkoutItem | undefined = exercises[currentExerciseIndex];
  const currentEquipmentIds = currentItem?.exercise.requiredEquipmentIds ?? [];
  const weightColumnLabel = currentItem?.exercise.loadProfile?.implement_count === 1 ? "Weight" : currentEquipmentIds.includes("dumbbells")
    ? "Weight each"
    : currentEquipmentIds.includes("olympic_barbell")
      ? "Total weight"
      : "Weight";
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

  const currentSets = useMemo(() => {
    if (!currentItem) return [];
    return sets
      .filter((s) => s.exerciseId === currentItem.exercise.id)
      .sort((a, b) => a.setNumber - b.setNumber);
  }, [sets, currentItem]);

  useEffect(() => {
    if (!token || !currentItem || Object.prototype.hasOwnProperty.call(exerciseNotes, currentItem.exercise.id)) return;
    let cancelled = false;
    void getUserExerciseNote(token, currentItem.exercise.id).then((note) => {
      if (!cancelled) setExerciseNotes((current) => ({ ...current, [currentItem.exercise.id]: note?.note ?? null }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [token, currentItem, exerciseNotes]);

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
      if (!user || !workout || !unitReady || (requestedSessionId && !canRestoreRequestedSession)) return;
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
          setSets(mergeServerLogs(prescribedSetStates(exercises), serverActive.setLogs, weightUnit, serverActive.deletedSetLogs ?? []));
          setWorkoutNote(serverActive.workoutNote);
          setExerciseFeedback(Object.fromEntries(serverActive.exerciseFeedback.map((feedback) => [feedback.exerciseId, { effort: feedback.effort, rir: feedback.rir }])));
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
        setWorkoutNote(serverActive?.workoutNote ?? saved.workoutNote ?? null);
        setExerciseFeedback(serverActive ? Object.fromEntries(serverActive.exerciseFeedback.map((feedback) => [feedback.exerciseId, { effort: feedback.effort, rir: feedback.rir }])) : saved.exerciseFeedback ?? {});
        setExerciseNotes(saved.exerciseNotes ?? {});
        const restoredSets = mergePersistedSets(prescribedSetStates(exercises), saved.sets);
        setSets(serverActive ? mergeServerLogs(restoredSets, serverActive.setLogs, weightUnit, serverActive.deletedSetLogs ?? []) : restoredSets);
        setOperations(reconciledOperations);
        const queuedCompletion = reconciledOperations.find((operation) => operation.type === "complete");
        if (queuedCompletion) setFinishStatus(queuedCompletion.status === "failed" ? "failed" : "pendingOffline");
      }
      if (!cancelled) setIsRestoring(false);
    }
    void restore();
    return () => { cancelled = true; };
  }, [user, workout, token, unitReady, weightUnit, exercises, router, clientSessionId, requestedSessionId, canRestoreRequestedSession]);

  // Store every draft, confirmed set, timer timestamp, and queued operation before
  // attempting network sync. This is what lets process termination be recoverable.
  useEffect(() => {
    if (isTerminalRef.current || isFinishingRef.current || isRestoring || !user || !workout || sets.length === 0) return;
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
      workoutSnapshot: workout,
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
    }).then(() => {
      setStorageError(false);
      setPersistedRevision((revision) => revision + 1);
    }).catch(() => setStorageError(true));
  }, [isRestoring, user, workout, sets, clientSessionId, sessionId, startedAt, currentExerciseIndex, restEndsAt, restTotalSeconds, restContext, operations, workoutNote, exerciseFeedback, exerciseNotes]);

  const replayPendingWrites = useCallback(async () => {
    if (!token || !user || replayInFlightRef.current) return;
    replayInFlightRef.current = true;
    try {
      const result = await replayPendingWorkoutOperations(token, user.id);
      if (!result.workout) return;
      const operationIdsAtStart = new Set(result.startedOperationIds);
      workoutRevisionRef.current = Math.max(workoutRevisionRef.current, result.workout.revision);
      setSessionId(result.workout.serverSessionId);
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
        const merged = mergeReplaySets(current, result.workout!.sets).map((set) =>
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
  }, [token, user, markWorkoutTerminal, weightUnit]);

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

  const persistConfirmedMutation = useCallback(
    async (nextSets: SetState[], nextOperations: PendingWorkoutOperation[]) => {
      if (!user || !workout || isRestoring || isTerminalRef.current) return;
      const localWorkout: LocalActiveWorkout = {
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
        sets: nextSets,
        operations: nextOperations,
        workoutNote,
        exerciseFeedback,
        exerciseNotes,
        revision: ++workoutRevisionRef.current,
      };
      await saveActiveWorkout(localWorkout);
      setStorageError(false);
      setPersistedRevision((revision) => revision + 1);
    },
    [user, workout, isRestoring, clientSessionId, sessionId, startedAt, currentExerciseIndex, restEndsAt, restTotalSeconds, restContext, workoutNote, exerciseFeedback, exerciseNotes]
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
            ? s.editing
              ? { ...s, editDraft: { reps: s.editDraft?.reps ?? s.reps, weight: s.editDraft?.weight ?? s.weight, [field]: value } }
              : { ...s, [field]: value }
            : s
        )
      );
    },
    [currentItem]
  );

  const confirmSet = useCallback(
    async (setNumber: number) => {
      if (!currentItem) return;
      const exerciseId = currentItem.exercise.id;

      const currentSets = setsRef.current;
      const target = currentSets.find(
        (s) => s.exerciseId === exerciseId && s.setNumber === setNumber
      );
      if (!target || target.deleted || (target.confirmed && !target.editing)) return;

      const draft = target.editing && target.editDraft ? target.editDraft : target;
      const reps = parseInt(draft.reps, 10);
      if (isNaN(reps) || reps <= 0) {
        Alert.alert("Invalid reps", "Enter a valid number of reps.");
        return;
      }

      const weightDisplay = draft.weight ? parseFloat(draft.weight) : undefined;
      if (draft.weight && (isNaN(weightDisplay!) || weightDisplay! < 0)) {
        Alert.alert("Invalid weight", "Enter a valid weight.");
        return;
      }
      // Backend always stores kilograms.
      const weightKg =
        weightDisplay != null ? Math.round(toKg(weightDisplay, weightUnit) * 100) / 100 : undefined;

      const isEditing = Boolean(target.editing);
      // Determine whether this confirmation completes the exercise, so we
      // know what to do once the rest period that follows ends.
      const exerciseSetsAfter = currentSets
        .filter((s) => s.exerciseId === exerciseId && !s.deleted)
        .map((s) => (s.setNumber === setNumber ? { ...s, confirmed: true } : s));
      const isLastSetOfExercise = exerciseSetsAfter.every((s) => s.confirmed);

      // Optimistic update
      const nextSets: SetState[] = currentSets.map((s) =>
          s.exerciseId === exerciseId && s.setNumber === setNumber
            ? isEditing
              ? {
                  ...s,
                  reps: draft.reps,
                  weight: draft.weight,
                  weightKg: weightKg ?? null,
                  editing: false,
                  editDraft: undefined,
                  syncing: true,
                  syncStatus: "pending",
                }
              : { ...s, weightKg: weightKg ?? null, confirmed: true, editing: false, syncing: true, syncStatus: "pending" }
            : s
        );
      setsRef.current = nextSets;
      setSets(nextSets);

      if (!isEditing) {
        // Rest begins only for a newly completed set. Corrections must never
        // reset an active rest timer.
        const restSeconds = currentItem.prescription.restSeconds;
        setRestTotalSeconds(restSeconds);
        setRestEndsAt(Date.now() + restSeconds * 1000);
        setRestContext({ exerciseIndex: currentExerciseIndex, isLastSetOfExercise });
      }

      const previousOperations = operationsRef.current;
      const nextOperations: PendingWorkoutOperation[] = (() => {
        if (isEditing && target.logId) {
          return [...previousOperations, {
            id: createClientId(), type: "update_set", status: "pending",
            payload: {
              logId: target.logId,
              exerciseId,
              setNumber,
              reps,
              weightKg: weightKg ?? null,
              displayWeight: draft.weight,
              expectedVersion: target.version ?? 1,
              previousReps: target.reps,
              previousWeight: target.weight,
              previousVersion: target.version ?? 1,
            },
          }];
        }
        if (isEditing) {
          return previousOperations.map((operation) =>
            operation.type === "set" && operation.payload.exerciseId === exerciseId && operation.payload.setNumber === setNumber
              ? { ...operation, payload: { ...operation.payload, reps, weightKg } }
              : operation
          );
        }
        return [...previousOperations, {
          id: createClientId(), type: "set", status: "pending",
          payload: { exerciseId, setNumber, reps, weightKg },
        }];
      })();
      operationsRef.current = nextOperations;
      setOperations(nextOperations);
      void persistConfirmedMutation(nextSets, nextOperations)
        .then(() => void replayPendingWrites())
        .catch(() => setStorageError(true));
    },
    [currentItem, currentExerciseIndex, weightUnit, persistConfirmedMutation, replayPendingWrites]
  );

  const beginSetEdit = useCallback((setNumber: number) => {
    if (!currentItem) return;
    setSets((previous) => previous.map((set) =>
      set.exerciseId === currentItem.exercise.id && set.setNumber === setNumber && set.syncStatus !== "failed"
        ? { ...set, editing: true, editDraft: { reps: set.reps, weight: set.weight } }
        : set
    ));
  }, [currentItem]);

  const removeSet = useCallback((setNumber: number) => {
    if (!currentItem) return;
    const exerciseId = currentItem.exercise.id;
    const target = setsRef.current.find((set) => set.exerciseId === exerciseId && set.setNumber === setNumber);
    if (!target || target.syncStatus === "failed") return;
    if (!target.logId) {
      const nextSets = setsRef.current.filter((set) => !(set.exerciseId === exerciseId && set.setNumber === setNumber));
      const nextOperations = operationsRef.current.filter((operation) => !(
        operation.type === "set" && operation.payload.exerciseId === exerciseId && operation.payload.setNumber === setNumber
      ));
      setsRef.current = nextSets;
      operationsRef.current = nextOperations;
      setSets(nextSets);
      setOperations(nextOperations);
      void persistConfirmedMutation(nextSets, nextOperations)
        .then(() => void replayPendingWrites())
        .catch(() => setStorageError(true));
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
      .then(() => void replayPendingWrites())
      .catch(() => setStorageError(true));
  }, [currentItem, persistConfirmedMutation, replayPendingWrites]);

  const restoreSet = useCallback((setNumber: number) => {
    if (!currentItem) return;
    const exerciseId = currentItem.exercise.id;
    const target = setsRef.current.find((set) => set.exerciseId === exerciseId && set.setNumber === setNumber);
    if (!target?.deletedLogId) return;
    const hasPendingDelete = operationsRef.current.some((operation) => operation.type === "delete_set" && operation.payload.logId === target.deletedLogId);
    const nextSets: SetState[] = setsRef.current.map((set) =>
      set.exerciseId === exerciseId && set.setNumber === setNumber
        ? {
            ...set,
            deleted: false,
            deletedLogId: null,
            syncing: hasPendingDelete,
            syncStatus: hasPendingDelete ? "pending" as const : "synced" as const,
          }
        : set
    );
    let nextOperations: PendingWorkoutOperation[];
    if (hasPendingDelete) {
      nextOperations = operationsRef.current.filter((operation) => !(operation.type === "delete_set" && operation.payload.logId === target.deletedLogId));
    } else {
      nextOperations = [...operationsRef.current, {
        id: createClientId(), type: "restore_set", status: "pending",
        payload: { logId: target.deletedLogId!, exerciseId, setNumber },
      }];
    }
    setsRef.current = nextSets;
    operationsRef.current = nextOperations;
    setSets(nextSets);
    setOperations(nextOperations);
    void persistConfirmedMutation(nextSets, nextOperations)
      .then(() => void replayPendingWrites())
      .catch(() => setStorageError(true));
  }, [currentItem, persistConfirmedMutation, replayPendingWrites]);

  const addSet = useCallback(() => {
    if (!currentItem) return;
    const exerciseId = currentItem.exercise.id;
    const nextSetNumber = sets
      .filter((set) => set.exerciseId === exerciseId)
      .reduce((maximum, set) => Math.max(maximum, set.setNumber), 0) + 1;
    setSets((previous) => [...previous, {
      exerciseId, setNumber: nextSetNumber, reps: "", weight: "", confirmed: false,
      syncing: false, syncStatus: "synced", logId: null, isAdded: true,
    }]);
  }, [currentItem, sets]);

  const openWorkoutNoteEditor = useCallback(() => {
    setNoteEditorTarget("workout");
    setNoteDraft(workoutNote ?? "");
    setNoteEditorVisible(true);
  }, [workoutNote]);

  const openExerciseNoteEditor = useCallback(() => {
    if (!currentItem) return;
    setNoteEditorTarget("exercise");
    setNoteDraft(exerciseNotes[currentItem.exercise.id] ?? "");
    setNoteEditorVisible(true);
  }, [currentItem, exerciseNotes]);

  const saveNote = useCallback(() => {
    const note = noteDraft.trim() || null;
    if (noteEditorTarget === "workout") {
      setWorkoutNote(note);
      setOperations((previous) => [...previous, {
        id: createClientId(), type: "update_workout_note", status: "pending", payload: { note },
      }]);
    } else if (currentItem) {
      const exerciseId = currentItem.exercise.id;
      setExerciseNotes((current) => ({ ...current, [exerciseId]: note }));
      setOperations((previous) => [...previous, {
        id: createClientId(), type: "update_exercise_note", status: "pending", payload: { exerciseId, note },
      }]);
    }
    setNoteEditorVisible(false);
  }, [noteDraft, noteEditorTarget, currentItem]);

  const openFeedbackEditor = useCallback(() => {
    if (!currentItem) return;
    setFeedbackDraft(exerciseFeedback[currentItem.exercise.id] ?? { effort: null, rir: null });
    setFeedbackEditorVisible(true);
  }, [currentItem, exerciseFeedback]);

  const saveExerciseFeedback = useCallback(() => {
    if (!currentItem) return;
    const exerciseId = currentItem.exercise.id;
    setExerciseFeedback((current) => ({ ...current, [exerciseId]: feedbackDraft }));
    setOperations((previous) => [...previous, {
      id: createClientId(), type: "update_exercise_feedback", status: "pending",
      payload: { exerciseId, effort: feedbackDraft.effort, rir: feedbackDraft.rir },
    }]);
    setFeedbackEditorVisible(false);
  }, [currentItem, feedbackDraft]);

  // ── Complete workout ───────────────────────────────────────────────────────

  const finishWorkout = useCallback(async (retry = false) => {
    if (!user || !workout || isFinishingRef.current) return;
    isFinishingRef.current = true;
    setFinishStatus("syncing");
    try {
      const queued = await queueWorkoutCompletion({
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
        workoutNote,
        exerciseFeedback,
        exerciseNotes,
        revision: ++workoutRevisionRef.current,
      }, retry);
      workoutRevisionRef.current = Math.max(workoutRevisionRef.current, queued.revision);
      setSets(queued.sets);
      setOperations(queued.operations);
      setWorkoutNote(queued.workoutNote ?? null);
      if (!token) {
        setFinishStatus("pendingOffline");
        return;
      }
      const result = await replayPendingWorkoutOperations(token, user.id);
      const completeOperation = result.workout?.operations.find((operation) => operation.type === "complete");
      if (result.completed || (result.workout && !completeOperation)) {
        setSessionId(result.workout?.serverSessionId ?? sessionId);
        isTerminalRef.current = true;
        await clearActiveWorkout(user.id);
        markWorkoutTerminal();
        setDidComplete(true);
        return;
      }
      if (!result.workout) throw new Error("Missing active workout");
      workoutRevisionRef.current = Math.max(workoutRevisionRef.current, result.workout.revision);
      setSets(result.workout.sets);
      setOperations(result.workout.operations);
      setFinishStatus(completeOperation?.status === "failed" ? "failed" : result.completionBlocked ? "pendingSets" : "pendingOffline");
    } catch {
      setFinishStatus("failed");
    } finally {
      isFinishingRef.current = false;
    }
  }, [token, user, workout, operations, clientSessionId, sessionId, startedAt, currentExerciseIndex, restEndsAt, restTotalSeconds, restContext, sets, workoutNote, exerciseFeedback, exerciseNotes, markWorkoutTerminal]);

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
    Alert.alert(
      "Leave workout?",
      "Keep it active to resume later, or quit and abandon it. Abandoned workouts don't count toward your progress.",
      [
        { text: "Continue Workout", style: "cancel" },
        { text: "Keep Workout Active", onPress: leaveWorkoutActive },
        { text: "Quit & Abandon", style: "destructive", onPress: () => void abandonAndExit() },
      ]
    );
  }, [leaveWorkoutActive, abandonAndExit]);

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
          accessibilityRole="button"
          accessibilityLabel="Leave workout"
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
        </Pressable>
        <Pressable
          testID="player-exercise-list-button"
          accessibilityRole="button"
          accessibilityLabel="Open exercise list"
          onPress={() => setSheetVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="list" size={22} color={colors.text} />
        </Pressable>
        {finishStatus === "pendingOffline" || finishStatus === "pendingSets" || finishStatus === "failed" ? (
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
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${currentItem.exercise.name} details`}
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
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: -10, marginBottom: 18 }}>
              <Pressable testID="player-workout-note" onPress={openWorkoutNoteEditor}>
                <ThemedText style={{ color: colors.primaryButton, fontWeight: "700", fontSize: 13 }}>
                  {workoutNote ? "Edit workout note" : "Add workout note"}
                </ThemedText>
              </Pressable>
              <Pressable testID={`player-feedback-${currentItem.exercise.id}`} onPress={openFeedbackEditor}>
                <ThemedText style={{ color: colors.primaryButton, fontWeight: "700", fontSize: 13 }}>
                  {exerciseFeedback[currentItem.exercise.id]?.effort ? "Edit feedback" : "Add feedback"}
                </ThemedText>
              </Pressable>
              <Pressable testID={`player-exercise-note-${currentItem.exercise.id}`} onPress={openExerciseNoteEditor}>
                <ThemedText style={{ color: colors.primaryButton, fontWeight: "700", fontSize: 13 }}>
                  {exerciseNotes[currentItem.exercise.id] ? "Edit exercise note" : "Add exercise note"}
                </ThemedText>
              </Pressable>
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
                      {weightColumnLabel}
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
                  const displaySetNumber = setRow.deleted
                    ? undefined
                    : currentSets.filter((set) => !set.deleted).findIndex((set) => set.exerciseId === setRow.exerciseId && set.setNumber === setRow.setNumber) + 1;
                  return (
                    <SetInputRow
                      key={`${setRow.exerciseId}-${setRow.setNumber}`}
                      setRow={displaySet}
                      displaySetNumber={displaySetNumber}
                      colors={colors}
                      weightUnit={weightUnit}
                      lastTimeHint={formatLastTimeHint(
                        findHistoryForSet(lastSetsByExercise[setRow.exerciseId], setRow.setNumber),
                        weightUnit
                      )}
                      progressionTag={progressionTag}
                      onUpdate={updateSet}
                      onConfirm={confirmSet}
                      onEdit={beginSetEdit}
                      onRemove={removeSet}
                      onRestore={restoreSet}
                    />
                  );
                })}
                <Pressable
                  testID={`player-add-set-${currentItem.exercise.id}`}
                  onPress={addSet}
                  style={{ alignSelf: "flex-start", marginTop: 2, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: `${colors.primaryButton}15` }}
                >
                  <ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>+ Add set</ThemedText>
                </Pressable>
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
            {finishStatus === "syncing"
              ? "Finishing workout…"
              : finishStatus === "failed"
                ? "Couldn't finish this workout. Your sets are safe."
                : finishStatus === "pendingSets"
                  ? "Your sets are still saving — finish will resume automatically."
                  : "Saved on this device — finish when online."}
          </ThemedText>
        ) : null}
        <Pressable
          testID="player-finish"
          onPress={finishStatus === "idle" ? handleComplete : () => void finishWorkout(true)}
          disabled={finishStatus === "syncing" || confirmedCount === 0}
          accessibilityState={{ disabled: finishStatus === "syncing" || confirmedCount === 0, busy: finishStatus === "syncing" }}
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

      <Modal transparent visible={noteEditorVisible} animationType="fade" onRequestClose={() => setNoteEditorVisible(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#00000066" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 }}>
            <ThemedText type="title" style={{ fontSize: 21 }}>{noteEditorTarget === "workout" ? "Workout note" : "Exercise note"}</ThemedText>
            <TextInput
              testID={noteEditorTarget === "workout" ? "player-workout-note-input" : `player-exercise-note-input-${currentItem?.exercise.id ?? ""}`}
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="Add a note"
              placeholderTextColor={colors.placeholder}
              multiline
              style={{ minHeight: 110, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, color: colors.text, padding: 12, textAlignVertical: "top" }}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 18 }}>
              <Pressable onPress={() => setNoteEditorVisible(false)}><ThemedText style={{ color: colors.placeholder, fontWeight: "700" }}>Cancel</ThemedText></Pressable>
              <Pressable testID="player-save-note" onPress={saveNote}><ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>Save</ThemedText></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={feedbackEditorVisible} animationType="fade" onRequestClose={() => setFeedbackEditorVisible(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#00000066" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 }}>
            <ThemedText type="title" style={{ fontSize: 21 }}>How did that feel?</ThemedText>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["easy", "right", "hard"] as const).map((effort) => (
                <Pressable key={effort} testID={`player-feedback-effort-${effort}`} onPress={() => setFeedbackDraft((draft) => ({ ...draft, effort }))} style={{ flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: "center", backgroundColor: feedbackDraft.effort === effort ? colors.primaryButton : colors.inputBackground }}>
                  <ThemedText style={{ color: feedbackDraft.effort === effort ? "#FFF" : colors.text, fontWeight: "700", textTransform: "capitalize" }}>{effort}</ThemedText>
                </Pressable>
              ))}
            </View>
            <ThemedText style={{ color: colors.placeholder }}>Optional RIR</ThemedText>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[0, 1, 2, 3, 4, 5].map((rir) => (
                <Pressable key={rir} onPress={() => setFeedbackDraft((draft) => ({ ...draft, rir: draft.rir === rir ? null : rir }))} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: feedbackDraft.rir === rir ? colors.primaryButton : colors.inputBackground }}>
                  <ThemedText style={{ color: feedbackDraft.rir === rir ? "#FFF" : colors.text, fontWeight: "700" }}>{rir}</ThemedText>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 18 }}>
              <Pressable onPress={() => setFeedbackEditorVisible(false)}><ThemedText style={{ color: colors.placeholder, fontWeight: "700" }}>Cancel</ThemedText></Pressable>
              <Pressable testID="player-save-feedback" onPress={saveExerciseFeedback}><ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>Save</ThemedText></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
