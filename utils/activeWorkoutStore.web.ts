import { diagnosticElapsed, diagnosticNow, workoutDiagnostics } from "./workoutDiagnosticsBridge";
import { PreWorkoutOrderConflict, applyPrestartOrder, adoptSessionArrangement, mergeReplayAcknowledgement, mergeSavedArrangement, normalizeWorkoutArrangement } from "./workoutArrangement";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { acknowledgeSetOperation, isAppliedSetOperation, mergeSetAcknowledgements, prepareSetEntries, resolveSetCorrection } from "./workoutSetEntries";
import type { WeightUnit } from "./weightUnits";

import { HttpError } from "@/services/httpClient";
import {
  abandonSession,
  completeSession,
  createSession,
  deleteLoggedSet,
  getSession,
  logSet,
  restoreLoggedSet,
  updateExerciseFeedback,
  updateLoggedSet,
  updateUserExerciseNote,
  updateWorkoutNote,
  updateExerciseOrder,
  replaceSessionExercise,
} from "@/services/workoutLoggingService";
import type { SessionResponse } from "@/services/workoutLoggingService";
import type { ContinueWorkoutLoggingResult, HealthExportCandidate, LocalActiveWorkout, PendingWorkoutOperation, QueueWorkoutCompletionResult, SequencedWorkoutOperation } from "./activeWorkoutStore.native";

export type { LocalActiveWorkout, PendingWorkoutOperation, SyncState } from "./activeWorkoutStore.native";

const keyFor = (userId: string) => `primerep.web.active-workout.${userId}`;
const terminalKeyFor = (userId: string) => `primerep.web.terminal-workouts.${userId}`;
let writeQueue = Promise.resolve();
let replayQueue = Promise.resolve();
let lastTerminalReplay: { userId: string; clientSessionId: string; serverSessionId: string | null } | null = null;
let lastCompletedReplay: { userId: string; clientSessionId: string; serverSessionId: string | null } | null = null;
const MAX_TERMINAL_WORKOUTS_PER_USER = 100;
type TerminalWorkout = { clientSessionId: string; serverSessionId: string | null; completedAt?: number; startedAt?: number; finishedAt?: number | null };

async function terminalWorkouts(userId: string): Promise<TerminalWorkout[]> {
  const raw = await AsyncStorage.getItem(terminalKeyFor(userId));
  const workouts = raw ? JSON.parse(raw) as TerminalWorkout[] : [];
  return workouts.slice(-MAX_TERMINAL_WORKOUTS_PER_USER);
}

export function createClientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function loadActiveWorkout(userId: string): Promise<LocalActiveWorkout | null> {
  const diagnostics = workoutDiagnostics(userId);
  const raw = await AsyncStorage.getItem(keyFor(userId));
  if (!raw) return null;
  const workout = JSON.parse(raw) as LocalActiveWorkout;
  const normalizedOperations = normalizeOperationSequences(
    recoverMissingSetOperations(workout.sets, workout.operations)
  );
  workout.operations = normalizedOperations;
  diagnostics.queue(workout.operations);
  return normalizeWorkoutArrangement(workout);
}

export async function healthExportCandidates(userId: string, since: number): Promise<HealthExportCandidate[]> {
  const terminal = await terminalWorkouts(userId);
  const active = await loadActiveWorkout(userId);
  const candidates = terminal.filter((entry) => entry.serverSessionId && entry.startedAt != null && entry.finishedAt != null && entry.finishedAt >= since)
    .map((entry) => ({ sessionId: entry.serverSessionId!, startedAt: entry.startedAt!, finishedAt: entry.finishedAt! }));
  if (active?.serverSessionId && active.finishedAt != null && active.finishedAt >= since) {
    candidates.push({ sessionId: active.serverSessionId, startedAt: active.startedAt, finishedAt: active.finishedAt });
  }
  return candidates;
}

export function saveActiveWorkout(workout: LocalActiveWorkout, isCurrent: () => boolean = () => true): Promise<void> {
  const diagnostics = workoutDiagnostics(workout.userId);
  const queuedAt = Date.now();
  workout.operations = normalizeOperationSequences(
    recoverMissingSetOperations(workout.sets, workout.operations)
  );
  const task = writeQueue.then(async () => {
    const terminal = await terminalWorkouts(workout.userId);
    if (terminal.some((entry) => entry.clientSessionId === workout.clientSessionId || (workout.serverSessionId != null && entry.serverSessionId === workout.serverSessionId))) return;
    const raw = await AsyncStorage.getItem(keyFor(workout.userId));
    const saved = raw ? JSON.parse(raw) as LocalActiveWorkout : null;
    if (saved) {
      Object.assign(workout, mergeSavedArrangement(saved, workout));
      if (saved.revision >= workout.revision || (saved.operations.some((operation) => operation.type === "complete") && workout.finishedAt == null)) return;
    }
    if (!isCurrent()) return;
    await AsyncStorage.setItem(keyFor(workout.userId), JSON.stringify(workout));
    diagnostics.queue(workout.operations, saved?.operations ?? [], queuedAt);
    for (const operation of saved?.operations ?? []) {
      if (workout.operations.some(({ id }) => id === operation.id)) continue;
      if (workout.acknowledgedArrangementOperationIds?.includes(operation.id) || workout.sets.some((set) => set.acknowledgedOperationIds?.includes(operation.id)) || (operation.type === "create" && workout.serverSessionId)) diagnostics.terminal(operation, "acknowledged", "reconciled");
      else if (operation.type === "order" && workout.operations.some(({ type }) => type === "order")) diagnostics.terminal(operation, "superseded");
      else if (operation.status === "failed") diagnostics.terminal(operation, "cancelled");
    }
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

function normalizeOperationSequences(operations: SequencedWorkoutOperation[]): SequencedWorkoutOperation[] {
  return operations
    .map((operation, index) => ({ operation, index }))
    .sort((left, right) => (left.operation.sequence ?? Number.MAX_SAFE_INTEGER) - (right.operation.sequence ?? Number.MAX_SAFE_INTEGER) || left.index - right.index)
    .map(({ operation }, index) => ({ ...operation, sequence: index + 1 }));
}

async function saveReplayWorkout(workout: LocalActiveWorkout, startedIds: string[], diagnostics: ReturnType<typeof workoutDiagnostics>, acknowledgments: Map<string, "direct" | "reconciled">): Promise<boolean> {
  const task = writeQueue.then(async () => {
    const terminal = await terminalWorkouts(workout.userId);
    if (terminal.some((entry) => entry.clientSessionId === workout.clientSessionId)) return false;
    const durable = await loadActiveWorkout(workout.userId);
    const merged = mergeReplayAcknowledgement(durable, workout, startedIds);
    merged.operations = normalizeOperationSequences(merged.operations);
    await AsyncStorage.setItem(keyFor(workout.userId), JSON.stringify(merged));
    diagnostics.queue(merged.operations);
    for (const operation of durable?.operations ?? []) {
      const kind = acknowledgments.get(operation.id);
      if (kind && !merged.operations.some(({ id }) => id === operation.id)) diagnostics.terminal(operation, "acknowledged", kind);
    }
    Object.assign(workout, merged);
    return true;
  });
  writeQueue = task.then(() => undefined, () => undefined);
  return task;
}

export function queueWorkoutPrestartOrder(baseline: LocalActiveWorkout, exerciseIds: string[], isCurrent: () => boolean = () => true): Promise<LocalActiveWorkout | null> {
  const diagnostics = workoutDiagnostics(baseline.userId);
  const queuedAt = Date.now();
  const task = replayQueue.then(() => {
    const pending = writeQueue.then(async () => {
      const terminal = await terminalWorkouts(baseline.userId);
      if (terminal.some((entry) => entry.clientSessionId === baseline.clientSessionId || (baseline.serverSessionId != null && entry.serverSessionId === baseline.serverSessionId))
        || (lastTerminalReplay?.userId === baseline.userId && (lastTerminalReplay.clientSessionId === baseline.clientSessionId || (baseline.serverSessionId != null && lastTerminalReplay.serverSessionId === baseline.serverSessionId)))) {
        throw new PreWorkoutOrderConflict("This workout has already finished. Refresh your workouts before starting again.", baseline.serverSessionId, true);
      }
      const durable = await loadActiveWorkout(baseline.userId);
      if (!isCurrent()) return null;
      if (durable && durable.clientSessionId !== baseline.clientSessionId) {
      if (durable.workoutDayId === baseline.workoutDayId) throw new PreWorkoutOrderConflict("Another session already owns this workout. Resume its saved progress before changing the order.", durable.serverSessionId);
      return durable;
    }
      const current = durable ? mergeReplayAcknowledgement(durable, baseline, []) : baseline;
      const next = applyPrestartOrder(current, exerciseIds, createClientId);
      next.operations = normalizeOperationSequences(next.operations);
      if (!isCurrent()) return null;
      await AsyncStorage.setItem(keyFor(next.userId), JSON.stringify(next));
      diagnostics.queue(next.operations, durable?.operations ?? [], queuedAt);
      for (const operation of durable?.operations ?? []) if (operation.type === "order" && !next.operations.some(({ id }) => id === operation.id)) diagnostics.terminal(operation, "superseded");
      return next;
    });
    writeQueue = pending.then(() => undefined, () => undefined);
    return pending;
  });
  replayQueue = task.then(() => undefined, () => undefined);
  return task;
}

function operationSetKey(operation: SequencedWorkoutOperation): string | null {
  if (operation.type === "set" || operation.type === "update_set" || operation.type === "delete_set" || operation.type === "restore_set") {
    return `${operation.payload.exerciseId}:${operation.payload.setNumber}`;
  }
  return null;
}

function recoverMissingSetOperations(
  sets: LocalActiveWorkout["sets"],
  operations: SequencedWorkoutOperation[]
): SequencedWorkoutOperation[] {
  const queuedSetKeys = new Set(operations.map(operationSetKey).filter((key): key is string => key != null));
  const recovered = sets.flatMap((set): SequencedWorkoutOperation[] => {
    if (!set.confirmed || set.deleted || set.logId || queuedSetKeys.has(`${set.exerciseId}:${set.setNumber}`)) return [];
    const reps = Number(set.reps);
    if (!Number.isInteger(reps) || reps < 1) return [];
    return [{
      id: createClientId(), type: "set", status: "pending",
      payload: { exerciseId: set.exerciseId, setNumber: set.setNumber, reps, weightKg: set.weightKg ?? undefined },
    }];
  });
  return [
    ...operations.filter((operation) => operation.type !== "complete"),
    ...recovered,
    ...operations.filter((operation) => operation.type === "complete"),
  ].map((operation, index) => ({ ...operation, sequence: index + 1 }));
}

function mergeWorkoutForCompletion(persisted: LocalActiveWorkout | null, incoming: LocalActiveWorkout, retry: boolean): LocalActiveWorkout {
  if (!persisted) {
    const incomingOperations = (retry
      ? incoming.operations.map((operation) => operation.status === "failed" && !((operation.type === "order" || operation.type === "replace") && operation.payload.conflict) ? { ...operation, status: "pending", nextAttemptAt: undefined } : operation)
      : incoming.operations) as SequencedWorkoutOperation[];
    const operations = recoverMissingSetOperations(
      incoming.sets,
      incomingOperations.filter((operation) => operation.type !== "complete")
    );
    const complete = incomingOperations.find((operation) => operation.type === "complete");
    return {
      ...incoming,
      finishedAt: incoming.finishedAt ?? Date.now(),
      operations: normalizeOperationSequences([
        ...operations,
        { ...(complete ?? { id: createClientId(), type: "complete", status: "pending", payload: {} }), status: "pending", nextAttemptAt: undefined } as SequencedWorkoutOperation,
      ]),
      revision: incoming.revision + 1,
    };
  }
  const persistedIds = new Set(persisted.operations.map((operation) => operation.id));
  const incomingOperations = incoming.operations.filter((operation) => !isAppliedSetOperation(operation, persisted.sets));
  const incomingSetKeys = new Set(incomingOperations.map(operationSetKey).filter((key): key is string => key != null));
  const incomingHasWorkoutNote = incoming.operations.some((operation) => operation.type === "update_workout_note");
  const operationsById = new Map(persisted.operations.map((operation) => [operation.id, operation]));
  for (const operation of incomingOperations) if (!persistedIds.has(operation.id)) operationsById.set(operation.id, operation);
  const incomingSets = new Map(incoming.sets.map((set) => [`${set.exerciseId}:${set.setNumber}`, set]));
  const mergedSets = persisted.sets.map((set) => {
    const key = `${set.exerciseId}:${set.setNumber}`;
    const incomingSet = incomingSets.get(key);
    if (!incomingSet) return set;
    return incomingSetKeys.has(key) || (incomingSet.confirmed && !set.confirmed) || (incomingSet.deleted && !set.deleted) ? mergeSetAcknowledgements(incomingSet, set) : set;
  });
  for (const [key, set] of incomingSets) if (!persisted.sets.some((current) => `${current.exerciseId}:${current.setNumber}` === key)) mergedSets.push(set);
  let operations = recoverMissingSetOperations(
    mergedSets,
    Array.from(operationsById.values()).filter((operation) => operation.type !== "complete")
  );
  if (retry) operations = operations.map((operation) => operation.status === "failed" && !((operation.type === "order" || operation.type === "replace") && operation.payload.conflict) ? { ...operation, status: "pending", nextAttemptAt: undefined } : operation);
  const previousComplete = [...persisted.operations, ...incoming.operations].find((operation) => operation.type === "complete");
  operations.push({ ...(previousComplete ?? { id: createClientId(), type: "complete", status: "pending", payload: {} }), status: "pending", nextAttemptAt: undefined } as SequencedWorkoutOperation);
  return {
    ...persisted,
    workoutDayId: incoming.workoutDayId,
    workoutDate: incoming.workoutDate,
    dayType: incoming.dayType,
    workoutSnapshot: persisted.workoutSnapshot ?? incoming.workoutSnapshot,
    effectiveWorkout: (incoming.arrangementRevision ?? 0) >= (persisted.arrangementRevision ?? 0) ? incoming.effectiveWorkout ?? persisted.effectiveWorkout : persisted.effectiveWorkout,
    arrangementRevision: Math.max(incoming.arrangementRevision ?? 0, persisted.arrangementRevision ?? 0),
    currentExerciseId: incoming.currentExerciseId ?? persisted.currentExerciseId,
    clientSessionId: incoming.clientSessionId,
    serverSessionId: persisted.serverSessionId ?? incoming.serverSessionId,
    startedAt: incoming.startedAt,
    finishedAt: persisted.finishedAt ?? incoming.finishedAt ?? Date.now(),
    currentExerciseIndex: incoming.currentExerciseIndex,
    restEndsAt: incoming.restEndsAt,
    restTotalSeconds: incoming.restTotalSeconds,
    restContext: incoming.restContext,
    sets: mergedSets,
    operations: normalizeOperationSequences(operations),
    workoutNote: incomingHasWorkoutNote ? incoming.workoutNote : persisted.workoutNote,
    exerciseFeedback: { ...(persisted.exerciseFeedback ?? {}), ...(incoming.exerciseFeedback ?? {}) },
    exerciseNotes: { ...(persisted.exerciseNotes ?? {}), ...(incoming.exerciseNotes ?? {}) },
    revision: Math.max(persisted.revision, incoming.revision) + 1,
  };
}

export function queueWorkoutCompletion(incoming: LocalActiveWorkout, retry = false): Promise<QueueWorkoutCompletionResult> {
  const diagnostics = workoutDiagnostics(incoming.userId);
  const queuedAt = Date.now();
  const task = replayQueue.then(() => {
    const write = writeQueue.then(async (): Promise<QueueWorkoutCompletionResult> => {
      const terminal = (await terminalWorkouts(incoming.userId)).find((entry) =>
        entry.clientSessionId === incoming.clientSessionId
        || (incoming.serverSessionId != null && entry.serverSessionId === incoming.serverSessionId)
      );
      if (terminal) return { status: "terminal", serverSessionId: terminal.serverSessionId };
      const raw = await AsyncStorage.getItem(keyFor(incoming.userId));
      const durable = raw ? JSON.parse(raw) as LocalActiveWorkout : null;
      const queued = mergeWorkoutForCompletion(durable, incoming, retry);
      await AsyncStorage.setItem(keyFor(incoming.userId), JSON.stringify(queued));
      diagnostics.queue(queued.operations, durable?.operations ?? [], queuedAt);
      return { status: "queued", workout: queued };
    });
    writeQueue = write.then(() => undefined, () => undefined);
    return write;
  });
  replayQueue = task.then(() => undefined, () => undefined);
  return task;
}

export function saveWorkoutSetEntries(incoming: LocalActiveWorkout, keys: string[], unit: WeightUnit) {
  const diagnostics = workoutDiagnostics(incoming.userId);
  const queuedAt = Date.now();
  const started = diagnosticNow();
  let stage: "storage" | "admission_conflict" | "unknown" = "storage";
  const task = writeQueue.then(async () => {
    const durable = await loadActiveWorkout(incoming.userId);
    if (!durable || durable.clientSessionId !== incoming.clientSessionId || durable.finishedAt != null
      || durable.operations.some((operation) => operation.type === "complete" || operation.type === "abandon" || operation.type === "replace")) {
      stage = "admission_conflict";
      throw new Error("Workout is no longer editable");
    }
    stage = "unknown";
    const result = prepareSetEntries(mergeSavedArrangement(durable, incoming), durable, keys, unit, createClientId);
    stage = "storage";
    if (result.savedCount > 0) {
      result.workout.operations = normalizeOperationSequences(result.workout.operations);
      await AsyncStorage.setItem(keyFor(incoming.userId), JSON.stringify(result.workout));
      diagnostics.queue(result.workout.operations, durable.operations, queuedAt);
    }
    if (result.savedCount > 0) diagnostics.emit({ kind: "local", outcome: "success", count: result.savedCount, duration: diagnosticElapsed(started) });
    else if (Object.keys(result.issues).length) diagnostics.emit({ kind: "local", outcome: "failure", category: "validation", duration: diagnosticElapsed(started) });
    return result;
  });
  writeQueue = task.then(() => undefined, () => undefined);
  return task.catch((error: unknown) => {
    diagnostics.emit({ kind: "local", outcome: "failure", category: stage, duration: diagnosticElapsed(started) });
    throw error;
  });
}

/** Waits for any replay attempt, then removes an unsent finish before logging resumes. */
export function continueWorkoutLogging(userId: string, clientSessionId: string): Promise<ContinueWorkoutLoggingResult> {
  const diagnostics = workoutDiagnostics(userId);
  const task = replayQueue.then(() => {
    const write = writeQueue.then(async (): Promise<ContinueWorkoutLoggingResult> => {
      if (lastCompletedReplay?.userId === userId && lastCompletedReplay.clientSessionId === clientSessionId) {
        return { status: "completed", serverSessionId: lastCompletedReplay.serverSessionId };
      }
      const raw = await AsyncStorage.getItem(keyFor(userId));
      if (!raw) return { status: "missing" };
      const durable = JSON.parse(raw) as LocalActiveWorkout;
      if (durable.clientSessionId !== clientSessionId) return { status: "missing" };
      const operations = durable.operations.filter((operation) => operation.type !== "complete");
      if (operations.length === durable.operations.length) return { status: "active", workout: durable };
      const resumed = { ...durable, finishedAt: null, operations: normalizeOperationSequences(operations), revision: durable.revision + 1 };
      await AsyncStorage.setItem(keyFor(userId), JSON.stringify(resumed));
      for (const operation of durable.operations) if (operation.type === "complete") diagnostics.terminal(operation, "cancelled");
      return { status: "active", workout: resumed };
    });
    writeQueue = write.then(() => undefined, () => undefined);
    return write;
  });
  replayQueue = task.then(() => undefined, () => undefined);
  return task;
}

export function clearActiveWorkout(userId: string): Promise<void> {
  const diagnostics = workoutDiagnostics(userId);
  const started = diagnosticNow();
  const task = writeQueue.then(async () => {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (raw) {
      const workout = JSON.parse(raw) as LocalActiveWorkout;
      const terminal = await terminalWorkouts(userId);
      if (!terminal.some((entry) => entry.clientSessionId === workout.clientSessionId)) {
        const completedTerminal = [...terminal, {
          clientSessionId: workout.clientSessionId,
          serverSessionId: workout.serverSessionId,
          completedAt: Date.now(),
          startedAt: workout.startedAt,
          finishedAt: workout.finishedAt,
        }].slice(-MAX_TERMINAL_WORKOUTS_PER_USER);
        await AsyncStorage.setItem(
          terminalKeyFor(userId),
          JSON.stringify(completedTerminal)
        );
      }
    }
    await AsyncStorage.removeItem(keyFor(userId));
  });
  writeQueue = task.catch(() => undefined);

  return task.then(() => {
    diagnostics.emit({ kind: "finish", stage: "local_cleanup", outcome: "success", duration: diagnosticElapsed(started) });
  }, (error: unknown) => {
    diagnostics.emit({ kind: "finish", stage: "local_cleanup", outcome: "failure", category: "storage", duration: diagnosticElapsed(started) });
    throw error;
  });
}

export async function retryFailedWorkoutOperations(userId: string): Promise<LocalActiveWorkout | null> {
  const workout = await loadActiveWorkout(userId);
  if (!workout) return null;
  workout.operations = workout.operations.map((operation) => operation.status === "failed" && !((operation.type === "order" || operation.type === "replace") && operation.payload.conflict) ? { ...operation, status: "pending", nextAttemptAt: undefined } : operation) as PendingWorkoutOperation[];
  workout.sets = workout.sets.map((set) => set.syncStatus === "failed" ? { ...set, syncing: false, syncStatus: "pending" } : set);
  workout.revision += 1;
  await saveActiveWorkout(workout);
  return workout;
}

function isRetryable(error: unknown): boolean {
  return !(error instanceof HttpError) || error.status == null || error.status === 401 || error.status === 408 || error.status === 429 || error.status >= 500;
}

function nextAttempt(attempts: number): number {
  return Date.now() + Math.min(300_000, 5_000 * 2 ** Math.max(0, attempts - 1));
}

function hasCanonicalEffectiveSets(workout: LocalActiveWorkout, session: SessionResponse): boolean {
  const canonicalByKey = new Map(session.setLogs.map((set) => [`${set.exerciseId}:${set.setNumber}`, set]));
  return workout.sets
    .filter((set) => set.confirmed && !set.deleted)
    .every((set) => {
      const canonical = canonicalByKey.get(`${set.exerciseId}:${set.setNumber}`);
      return canonical != null
        && canonical.reps === Number(set.reps)
        && canonical.weightKg === (set.weightKg ?? null);
    });
}

async function replay(token: string, userId: string) {
  const diagnostics = workoutDiagnostics(userId);
  const acknowledgments = diagnostics.acknowledgments;
  const request = diagnostics.request;
  const workout = await loadActiveWorkout(userId);
  if (!workout) return { workout: null, completed: false, abandoned: false, completedSession: null, completionBlocked: false, startedOperationIds: [], authenticationRequired: false };
  const remaining: PendingWorkoutOperation[] = [];
  let completed = false;
  let abandoned = false;
  let completedSession: SessionResponse | null = null;
  let completionBlocked = false;
  let authenticationRequired = false;
  const operations = workout.operations.map((operation) => operation.status === "retrying" ? { ...operation, status: "pending" as const } : operation)
    .sort((left, right) => (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER)) as SequencedWorkoutOperation[];
  const startedOperationIds = operations.map((operation) => operation.id);
  const shouldReconcileSetsBeforeReplay = operations.some((operation) => operation.type === "complete")
    || operations.filter((operation) => operation.type === "set").length > 1
    || operations.some((operation) => operation.type === "set" && (operation.attempts ?? 0) > 0);
  let canonicalSets = new Map<string, SessionResponse["setLogs"][number]>();
  let canonicalSetsLoaded = false;
  const refreshCanonicalSets = async () => {
    const session = await getSession(token, workout.serverSessionId!);
    canonicalSets = new Map(session.setLogs.map((set) => [`${set.exerciseId}:${set.setNumber}`, set]));
    canonicalSetsLoaded = true;
  };
  const acceptSetLog = (setLog: SessionResponse["setLogs"][number], operationId: string) => {
    workout.sets = workout.sets.map((set) =>
      set.exerciseId === setLog.exerciseId && set.setNumber === setLog.setNumber
        ? { ...acknowledgeSetOperation(set, operationId), reps: String(setLog.reps), weightKg: setLog.weightKg, logId: setLog.id, version: setLog.version, syncing: false, syncStatus: "synced" }
        : set
    );
  };
  for (let index = 0; index < operations.length; index += 1) {
    let operation = operations[index];
    if ((operation.type === "order" || operation.type === "replace") && workout.serverSessionId && workout.arrangementRevision == null) {
      remaining.push({ ...operation, status: "failed", payload: { ...operation.payload, conflict: true, unsupported: true } } as PendingWorkoutOperation);
      completionBlocked = true;
      continue;
    }
    if ((operation.type === "order" || operation.type === "replace") && operation.payload.conflict) {
      remaining.push(operation);
      completionBlocked = true;
      continue;
    }
    if ((operation.type === "replace" || operation.type === "complete")
      && remaining.some((pending) => pending.type === "order" || pending.type === "replace")) {
      remaining.push(operation, ...operations.slice(index + 1));
      completionBlocked = true;
      break;
    }
    if (operation.status === "failed" || (operation.nextAttemptAt && operation.nextAttemptAt > Date.now())) {
      remaining.push(operation, ...operations.slice(index + 1));
      break;
    }
    const resolved = resolveSetCorrection(operation, workout.sets);
    if (!resolved) {
      remaining.push(operation, ...operations.slice(index + 1));
      break;
    }
    operation = resolved;
    const retrying = { ...operation, status: "retrying" as const, attempts: (operation.attempts ?? 0) + 1, nextAttemptAt: undefined } as PendingWorkoutOperation;
    workout.operations = [...remaining, retrying, ...operations.slice(index + 1)];
    workout.revision += 1;
    await saveReplayWorkout(workout, startedOperationIds, diagnostics, acknowledgments);
    try {
      if (operation.type === "create") {
        const created = await request(operation, () => createSession(token, operation.payload.workoutDayId, operation.payload.workoutDate, operation.payload.dayType, operation.payload.clientSessionId));
        Object.assign(workout, adoptSessionArrangement(workout, created));
      } else if (!workout.serverSessionId) {
        remaining.push({ ...retrying, status: "pending" });
        remaining.push(...operations.slice(index + 1));
        break;
      } else if (operation.type === "order") {
        const updated = await request(operation, () => updateExerciseOrder(token, workout.serverSessionId!, operation.payload.exerciseIds,
          operation.payload.expectedRevision, operation.id, operation.payload.applyRevisedTargets));
        Object.assign(workout, adoptSessionArrangement(workout, updated));
        if (operation.payload.requiresReview) workout.targetReviewExerciseIds = [...operation.payload.exerciseIds];
        workout.acknowledgedArrangementOperationIds = [...new Set([...(workout.acknowledgedArrangementOperationIds ?? []), operation.id])];
      } else if (operation.type === "replace") {
        const updated = await request(operation, () => replaceSessionExercise(token, workout.serverSessionId!, operation.payload.exerciseId,
          operation.payload.replacementExerciseId, operation.payload.expectedRevision, operation.id));
        Object.assign(workout, adoptSessionArrangement(workout, updated));
        workout.acknowledgedArrangementOperationIds = [...new Set([...(workout.acknowledgedArrangementOperationIds ?? []), operation.id])];
      } else if (operation.type === "set") {
        if (shouldReconcileSetsBeforeReplay && !canonicalSetsLoaded) await refreshCanonicalSets();
        const existing = canonicalSets.get(`${operation.payload.exerciseId}:${operation.payload.setNumber}`);
        if (existing) {
          if (existing.reps !== operation.payload.reps || existing.weightKg !== (operation.payload.weightKg ?? null)) {
            throw new HttpError("That set number already exists for this exercise.", 409);
          }
          acceptSetLog(existing, operation.id);
          acknowledgments.set(operation.id, "reconciled");
          continue;
        }
        const logged = await request(operation, () => logSet(token, workout.serverSessionId!, operation.payload.exerciseId, operation.payload.setNumber, operation.payload.reps, operation.payload.weightKg, operation.id));
        canonicalSets.set(`${logged.exerciseId}:${logged.setNumber}`, logged);
        acceptSetLog(logged, operation.id);
      } else if (operation.type === "update_set") {
        const updated = await request(operation, () => updateLoggedSet(token, workout.serverSessionId!, operation.payload.logId, operation.payload.reps, operation.payload.weightKg, operation.payload.expectedVersion, operation.id));
        workout.sets = workout.sets.map((set) => set.logId === updated.id ? { ...acknowledgeSetOperation(set, operation.id), reps: String(updated.reps), weight: operation.payload.displayWeight, weightKg: updated.weightKg, version: updated.version, syncing: false, syncStatus: "synced" } : set);
      } else if (operation.type === "delete_set") {
        await request(operation, () => deleteLoggedSet(token, workout.serverSessionId!, operation.payload.logId, operation.id));
        workout.sets = workout.sets.map((set) => set.logId === operation.payload.logId ? acknowledgeSetOperation(set, operation.id) : set);
      } else if (operation.type === "restore_set") {
        const restored = await request(operation, () => restoreLoggedSet(token, workout.serverSessionId!, operation.payload.logId, operation.id));
        workout.sets = workout.sets.map((set) => set.logId === restored.id ? { ...acknowledgeSetOperation(set, operation.id), deleted: false, syncing: false, syncStatus: "synced" } : set);
      } else if (operation.type === "update_workout_note") {
        const updated = await request(operation, () => updateWorkoutNote(token, workout.serverSessionId!, operation.payload.note, operation.id));
        workout.workoutNote = updated.workoutNote;
      } else if (operation.type === "update_exercise_feedback") {
        await request(operation, () => updateExerciseFeedback(token, workout.serverSessionId!, operation.payload.exerciseId, operation.payload.effort, operation.payload.rir, operation.id));
      } else if (operation.type === "update_exercise_note") {
        await request(operation, () => updateUserExerciseNote(token, operation.payload.exerciseId, operation.payload.note));
      } else if (operation.type === "complete") {
        const canonicalBeforeComplete = await getSession(token, workout.serverSessionId);
        if (canonicalBeforeComplete.status === "completed") {
          completedSession = canonicalBeforeComplete;
          acknowledgments.set(operation.id, "reconciled");
          diagnostics.emit({ kind: "finish", stage: "server", outcome: "success" });
          completed = true;
          break;
        }
        if (!hasCanonicalEffectiveSets(workout, canonicalBeforeComplete)) {
          completionBlocked = true;
          remaining.push({ ...retrying, status: "pending", nextAttemptAt: nextAttempt(retrying.attempts ?? 1) });
          remaining.push(...operations.slice(index + 1));
          break;
        }
        completedSession = await request(operation, () => completeSession(token, workout.serverSessionId!));
        if (hasCanonicalEffectiveSets(workout, completedSession)) {
          completed = true;
          break;
        }
        const canonicalAfterComplete = await getSession(token, workout.serverSessionId);
        completedSession = canonicalAfterComplete;
        if (canonicalAfterComplete.status === "completed") {
          completed = true;
          break;
        }
      } else if (operation.type === "abandon") {
        await request(operation, () => abandonSession(token, workout.serverSessionId!));
        abandoned = true;
        break;
      }
    } catch (error) {
      if ((operation.type === "order" || operation.type === "replace") && error instanceof HttpError && error.status === 409) {
        try {
          const canonical = await getSession(token, workout.serverSessionId!);
          Object.assign(workout, adoptSessionArrangement(workout, canonical));
        } catch {
          // Keep the intent and require review even if refreshing the server is temporarily unavailable.
        }
        remaining.push({ ...operation, status: "failed", attempts: retrying.attempts,
          payload: { ...operation.payload, conflict: true } } as PendingWorkoutOperation);
        completionBlocked = true;
        continue;
      }
      if (operation.type === "set" && error instanceof HttpError && error.status === 409 && workout.serverSessionId) {
        try {
          const key = `${operation.payload.exerciseId}:${operation.payload.setNumber}`;
          if (!canonicalSets.has(key)) await refreshCanonicalSets();
          const existing = canonicalSets.get(key);
          if (existing && existing.reps === operation.payload.reps && existing.weightKg === (operation.payload.weightKg ?? null)) {
            acceptSetLog(existing, operation.id);
            acknowledgments.set(operation.id, "reconciled");
            continue;
          }
        } catch {
          // Keep the normal durable error path when reconciliation fails.
        }
      }
      const retryable = isRetryable(error);
      authenticationRequired = error instanceof HttpError && error.status === 401;
      const failedOperation = {
        ...operation,
        status: retryable ? "pending" as const : "failed" as const,
        attempts: retrying.attempts,
        nextAttemptAt: retryable ? nextAttempt(retrying.attempts ?? 1) : undefined,
      } as PendingWorkoutOperation;
      if (operation.type === "update_set" && !retryable) {
        (failedOperation as Extract<PendingWorkoutOperation, { type: "update_set" }>).payload.conflict =
          error instanceof HttpError && error.status === 409;
        workout.sets = workout.sets.map((set) =>
          set.exerciseId === operation.payload.exerciseId && set.setNumber === operation.payload.setNumber
            ? {
                ...set,
                reps: operation.payload.previousReps,
                weight: operation.payload.previousWeight,
                version: operation.payload.previousVersion,
                syncing: false,
                syncStatus: "failed",
              }
            : set
        );
      } else if (operation.type === "set" || operation.type === "delete_set" || operation.type === "restore_set") {
        workout.sets = workout.sets.map((set) =>
          set.exerciseId === operation.payload.exerciseId && set.setNumber === operation.payload.setNumber
            ? { ...set, syncing: false, syncStatus: retryable ? "pending" : "failed" }
            : set
        );
      }
      remaining.push(failedOperation);
      remaining.push(...operations.slice(index + 1));
      break;
    }
  }
  workout.operations = remaining;
  workout.revision += 1;
  const persisted = await saveReplayWorkout(workout, startedOperationIds, diagnostics, acknowledgments);
  if (persisted) diagnostics.queue(workout.operations);
  for (const operation of operations) {
    const pending = workout.operations.find(({ id }) => id === operation.id);
    if (persisted && pending?.nextAttemptAt != null && pending.nextAttemptAt !== operation.nextAttemptAt) diagnostics.emit({ kind: "retry", operation: { id: operation.id, type: operation.type }, delay: Math.max(0, pending.nextAttemptAt - Date.now()), category: diagnostics.failures.get(operation.id) });
  }
  return { workout, completed, abandoned, completedSession, completionBlocked, startedOperationIds, authenticationRequired };
}

export function replayPendingWorkoutOperations(token: string, userId: string) {
  const run = async () => {
    const result = await replay(token, userId);
    if ((result.completed || result.abandoned) && result.workout) {
      lastTerminalReplay = { userId, clientSessionId: result.workout.clientSessionId, serverSessionId: result.workout.serverSessionId };
    }
    if (result.completed && result.workout) {
      lastCompletedReplay = {
        userId,
        clientSessionId: result.workout.clientSessionId,
        serverSessionId: result.workout.serverSessionId,
      };
    }
    return result;
  };
  const task = replayQueue.then(run, run);
  replayQueue = task.then(() => undefined, () => undefined);
  return task;
}
