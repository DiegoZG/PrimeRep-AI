import { PreWorkoutOrderConflict, applyPrestartOrder, adoptSessionArrangement, mergeReplayAcknowledgement, mergeSavedArrangement, normalizeWorkoutArrangement } from "./workoutArrangement";
import * as SQLite from "expo-sqlite";
import { acknowledgeSetOperation, isAppliedSetOperation, mergeSetAcknowledgements, prepareSetEntries, resolveSetCorrection } from "./workoutSetEntries";
import type { WeightUnit } from "./weightUnits";

import type { SetState, WorkoutDay } from "@/interfaces/workouts";
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

export type SyncState = "pending" | "synced" | "failed" | "retrying";

export type PendingWorkoutOperation =
  | {
      id: string;
      type: "create";
      status: SyncState;
      attempts?: number;
      nextAttemptAt?: number;
      payload: { workoutDayId: string; workoutDate: string; dayType: string; clientSessionId: string };
    }
  | {
      id: string;
      type: "set";
      status: SyncState;
      attempts?: number;
      nextAttemptAt?: number;
      payload: { exerciseId: string; setNumber: number; reps: number; weightKg?: number };
    }
  | {
      id: string;
      type: "update_set";
      status: SyncState;
      attempts?: number;
      nextAttemptAt?: number;
      payload: {
        logId: string;
        exerciseId: string;
        setNumber: number;
        reps: number;
        weightKg: number | null;
        displayWeight: string;
        expectedVersion: number;
        previousReps: string;
        previousWeight: string;
        previousVersion: number;
        resolveAfterPending?: boolean;
        conflict?: boolean;
      };
    }
  | {
      id: string;
      type: "delete_set" | "restore_set";
      status: SyncState;
      attempts?: number;
      nextAttemptAt?: number;
      payload: { logId: string; exerciseId: string; setNumber: number; resolveAfterPending?: boolean };
    }
  | {
      id: string;
      type: "update_workout_note";
      status: SyncState;
      attempts?: number;
      nextAttemptAt?: number;
      payload: { note: string | null };
    }
  | {
      id: string;
      type: "update_exercise_feedback";
      status: SyncState;
      attempts?: number;
      nextAttemptAt?: number;
      payload: { exerciseId: string; effort: "easy" | "right" | "hard" | null; rir: number | null };
    }
  | {
      id: string;
      type: "update_exercise_note";
      status: SyncState;
      attempts?: number;
      nextAttemptAt?: number;
      payload: { exerciseId: string; note: string | null };
    }
  | { id: string; type: "order"; status: SyncState; attempts?: number; nextAttemptAt?: number;
      payload: { exerciseIds: string[]; expectedRevision: number; applyRevisedTargets: boolean; requiresReview?: boolean; conflict?: boolean; unsupported?: boolean } }
  | { id: string; type: "replace"; status: SyncState; attempts?: number; nextAttemptAt?: number;
      payload: { exerciseId: string; replacementExerciseId: string; expectedRevision: number; conflict?: boolean; unsupported?: boolean } }
  | { id: string; type: "complete" | "abandon"; status: SyncState; attempts?: number; nextAttemptAt?: number; payload: Record<string, never> };

export type SequencedWorkoutOperation = PendingWorkoutOperation & { sequence?: number };

export interface LocalActiveWorkout {
  userId: string;
  workoutDayId: string;
  workoutDate: string;
  dayType: string;
  workoutSnapshot: WorkoutDay | null;
  effectiveWorkout?: WorkoutDay | null;
  arrangementRevision?: number;
  currentExerciseId?: string | null;
  targetReviewExerciseIds?: string[] | null;
  acknowledgedArrangementOperationIds?: string[];
  clientSessionId: string;
  serverSessionId: string | null;
  startedAt: number;
  finishedAt?: number | null;
  currentExerciseIndex: number;
  restEndsAt: number | null;
  restTotalSeconds: number;
  restContext: { exerciseId?: string; exerciseIndex?: number; isLastSetOfExercise: boolean; suppressAutoAdvance?: boolean } | null;
  revision: number;
  sets: SetState[];
  operations: SequencedWorkoutOperation[];
  workoutNote?: string | null;
  exerciseFeedback?: Record<string, { effort: "easy" | "right" | "hard" | null; rir: number | null }>;
  exerciseNotes?: Record<string, string | null>;
}

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let replayQueue: Promise<void> = Promise.resolve();
let lastTerminalReplay: { userId: string; clientSessionId: string; serverSessionId: string | null } | null = null;
let lastCompletedReplay: { userId: string; clientSessionId: string; serverSessionId: string | null } | null = null;
export type HealthExportCandidate = { sessionId: string; startedAt: number; finishedAt: number };

function serializeWrite<T>(write: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(write, write);
  // Keep the queue usable after a storage failure while still returning the
  // actual failure to the caller that initiated it.
  writeQueue = next.then(() => undefined, () => undefined);
  return next;
}

function database(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync("primerep-workouts.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS active_workouts (
          user_id TEXT PRIMARY KEY NOT NULL,
          workout_day_id TEXT NOT NULL,
          workout_date TEXT NOT NULL,
          day_type TEXT NOT NULL,
          client_session_id TEXT NOT NULL,
          server_session_id TEXT,
          started_at INTEGER NOT NULL,
          finished_at INTEGER,
          current_exercise_index INTEGER NOT NULL DEFAULT 0,
          rest_ends_at INTEGER,
          rest_total_seconds INTEGER NOT NULL DEFAULT 0,
          rest_context TEXT,
          workout_snapshot TEXT,
          effective_workout TEXT,
          arrangement_revision INTEGER,
          current_exercise_id TEXT,
          target_review_exercise_ids TEXT,
          acknowledged_arrangement_operation_ids TEXT,
          workout_note TEXT,
          exercise_feedback TEXT,
          exercise_notes TEXT,
          revision INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS workout_set_drafts (
          user_id TEXT NOT NULL,
          exercise_id TEXT NOT NULL,
          set_number INTEGER NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY (user_id, exercise_id, set_number)
        );
        CREATE TABLE IF NOT EXISTS workout_pending_operations (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt_at INTEGER,
          sequence INTEGER NOT NULL DEFAULT 0,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS terminal_workout_sessions (
          user_id TEXT NOT NULL,
          client_session_id TEXT NOT NULL,
          server_session_id TEXT,
          completed_at INTEGER NOT NULL,
          started_at INTEGER,
          finished_at INTEGER,
          PRIMARY KEY (user_id, client_session_id)
        );
      `);
      for (const statement of [
        "ALTER TABLE workout_pending_operations ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE workout_pending_operations ADD COLUMN next_attempt_at INTEGER",
        "ALTER TABLE workout_pending_operations ADD COLUMN sequence INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE active_workouts ADD COLUMN workout_snapshot TEXT",
        "ALTER TABLE active_workouts ADD COLUMN effective_workout TEXT",
        "ALTER TABLE active_workouts ADD COLUMN arrangement_revision INTEGER",
        "ALTER TABLE active_workouts ADD COLUMN current_exercise_id TEXT",
        "ALTER TABLE active_workouts ADD COLUMN target_review_exercise_ids TEXT",
        "ALTER TABLE active_workouts ADD COLUMN acknowledged_arrangement_operation_ids TEXT",
        "ALTER TABLE active_workouts ADD COLUMN revision INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE active_workouts ADD COLUMN workout_note TEXT",
        "ALTER TABLE active_workouts ADD COLUMN exercise_feedback TEXT",
        "ALTER TABLE active_workouts ADD COLUMN exercise_notes TEXT",
        "ALTER TABLE active_workouts ADD COLUMN finished_at INTEGER",
        "ALTER TABLE terminal_workout_sessions ADD COLUMN started_at INTEGER",
        "ALTER TABLE terminal_workout_sessions ADD COLUMN finished_at INTEGER",
      ]) {
        try {
          await db.execAsync(statement);
        } catch {
          // Existing installations may already have the column.
        }
      }
      const legacyOperations = await db.getAllAsync<{ id: string; user_id: string }>(
        "SELECT id, user_id FROM workout_pending_operations ORDER BY user_id ASC, sequence ASC, created_at ASC, id ASC"
      );
      let currentUserId: string | null = null;
      let sequence = 0;
      for (const operation of legacyOperations) {
        if (operation.user_id !== currentUserId) {
          currentUserId = operation.user_id;
          sequence = 0;
        }
        sequence += 1;
        await db.runAsync("UPDATE workout_pending_operations SET sequence = ? WHERE id = ?", [sequence, operation.id]);
      }
      return db;
    });
  }
  return databasePromise;
}

export function createClientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeOperationSequences(operations: SequencedWorkoutOperation[]): SequencedWorkoutOperation[] {
  return operations
    .map((operation, index) => ({ operation, index }))
    .sort((left, right) => (left.operation.sequence ?? Number.MAX_SAFE_INTEGER) - (right.operation.sequence ?? Number.MAX_SAFE_INTEGER) || left.index - right.index)
    .map(({ operation }, index) => ({ ...operation, sequence: index + 1 }));
}

export async function loadActiveWorkout(userId: string): Promise<LocalActiveWorkout | null> {
  const db = await database();
  const workout = await db.getFirstAsync<{
    workout_day_id: string; workout_date: string; day_type: string; client_session_id: string;
    server_session_id: string | null; started_at: number; finished_at: number | null; current_exercise_index: number;
    rest_ends_at: number | null; rest_total_seconds: number; rest_context: string | null; workout_snapshot: string | null;
    effective_workout: string | null; arrangement_revision: number; current_exercise_id: string | null; target_review_exercise_ids: string | null; acknowledged_arrangement_operation_ids: string | null;
    workout_note: string | null; exercise_feedback: string | null; exercise_notes: string | null; revision: number;
  }>("SELECT * FROM active_workouts WHERE user_id = ?", [userId]);
  if (!workout) return null;
  const drafts = await db.getAllAsync<{ payload: string }>("SELECT payload FROM workout_set_drafts WHERE user_id = ?", [userId]);
  const operations = await db.getAllAsync<{ id: string; type: PendingWorkoutOperation["type"]; status: SyncState; attempts: number; next_attempt_at: number | null; sequence: number; payload: string }>(
    "SELECT id, type, status, attempts, next_attempt_at, sequence, payload FROM workout_pending_operations WHERE user_id = ? ORDER BY sequence ASC, created_at ASC, id ASC", [userId]
  );
  const normalizedOperations = normalizeOperationSequences(operations.map(({ next_attempt_at, ...operation }) => ({
    ...operation,
    nextAttemptAt: next_attempt_at ?? undefined,
    payload: JSON.parse(operation.payload),
  })) as SequencedWorkoutOperation[]);
  const sets = drafts.map((draft) => JSON.parse(draft.payload) as SetState);
  return normalizeWorkoutArrangement({
    userId,
    workoutDayId: workout.workout_day_id,
    workoutDate: workout.workout_date,
    dayType: workout.day_type,
    workoutSnapshot: workout.workout_snapshot ? JSON.parse(workout.workout_snapshot) as WorkoutDay : null,
    effectiveWorkout: workout.effective_workout ? JSON.parse(workout.effective_workout) as WorkoutDay : null,
    arrangementRevision: workout.arrangement_revision ?? undefined,
    currentExerciseId: workout.current_exercise_id,
    targetReviewExerciseIds: workout.target_review_exercise_ids ? JSON.parse(workout.target_review_exercise_ids) : null,
    acknowledgedArrangementOperationIds: workout.acknowledged_arrangement_operation_ids ? JSON.parse(workout.acknowledged_arrangement_operation_ids) : [],
    clientSessionId: workout.client_session_id,
    serverSessionId: workout.server_session_id,
    startedAt: workout.started_at,
    finishedAt: workout.finished_at,
    currentExerciseIndex: workout.current_exercise_index,
    restEndsAt: workout.rest_ends_at,
    restTotalSeconds: workout.rest_total_seconds,
    restContext: workout.rest_context ? JSON.parse(workout.rest_context) : null,
    revision: workout.revision ?? 0,
    sets,
    operations: normalizeOperationSequences(recoverMissingSetOperations(sets, normalizedOperations)),
    workoutNote: workout.workout_note,
    exerciseFeedback: workout.exercise_feedback ? JSON.parse(workout.exercise_feedback) : {},
    exerciseNotes: workout.exercise_notes ? JSON.parse(workout.exercise_notes) : {},
  });
}

export async function healthExportCandidates(userId: string, since: number): Promise<HealthExportCandidate[]> {
  const db = await database();
  const terminal = await db.getAllAsync<{ server_session_id: string; started_at: number; finished_at: number }>(
    `SELECT server_session_id, started_at, finished_at FROM terminal_workout_sessions
     WHERE user_id = ? AND server_session_id IS NOT NULL AND finished_at >= ?
     ORDER BY finished_at ASC`, [userId, since]
  );
  const active = await loadActiveWorkout(userId);
  const candidates = terminal.map((row) => ({ sessionId: row.server_session_id, startedAt: row.started_at, finishedAt: row.finished_at }));
  if (active?.serverSessionId && active.finishedAt != null && active.finishedAt >= since) {
    candidates.push({ sessionId: active.serverSessionId, startedAt: active.startedAt, finishedAt: active.finishedAt });
  }
  return candidates;
}

async function persistActiveWorkout(db: SQLite.SQLiteDatabase, workout: LocalActiveWorkout, allowFinishReset = false): Promise<boolean> {
  workout.operations = normalizeOperationSequences(
    recoverMissingSetOperations(workout.sets, workout.operations)
  );
  let persisted = false;
  await db.withTransactionAsync(async () => {
    const terminal = await db.getFirstAsync<{ client_session_id: string }>(
      `SELECT client_session_id FROM terminal_workout_sessions
       WHERE user_id = ? AND (client_session_id = ? OR (server_session_id IS NOT NULL AND server_session_id = ?))
       LIMIT 1`,
      [workout.userId, workout.clientSessionId, workout.serverSessionId]
    );
    if (terminal) return;
    if (!allowFinishReset && workout.finishedAt == null) {
      const queuedFinish = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM workout_pending_operations WHERE user_id = ? AND type = 'complete' LIMIT 1",
        [workout.userId]
      );
      if (queuedFinish) return;
    }
    const result = await db.runAsync(
      `INSERT INTO active_workouts (user_id, workout_day_id, workout_date, day_type, client_session_id, server_session_id, started_at, finished_at, current_exercise_index, rest_ends_at, rest_total_seconds, rest_context, workout_snapshot, workout_note, exercise_feedback, exercise_notes, effective_workout, arrangement_revision, current_exercise_id, target_review_exercise_ids, acknowledged_arrangement_operation_ids, revision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET workout_day_id=excluded.workout_day_id, workout_date=excluded.workout_date, day_type=excluded.day_type, workout_snapshot=excluded.workout_snapshot, client_session_id=excluded.client_session_id, server_session_id=excluded.server_session_id, started_at=excluded.started_at, finished_at=excluded.finished_at, current_exercise_index=excluded.current_exercise_index, rest_ends_at=excluded.rest_ends_at, rest_total_seconds=excluded.rest_total_seconds, rest_context=excluded.rest_context, workout_note=excluded.workout_note, exercise_feedback=excluded.exercise_feedback, exercise_notes=excluded.exercise_notes, effective_workout=excluded.effective_workout, arrangement_revision=excluded.arrangement_revision, current_exercise_id=excluded.current_exercise_id, target_review_exercise_ids=excluded.target_review_exercise_ids, acknowledged_arrangement_operation_ids=excluded.acknowledged_arrangement_operation_ids, revision=excluded.revision
       WHERE active_workouts.revision < excluded.revision`,
      [workout.userId, workout.workoutDayId, workout.workoutDate, workout.dayType, workout.clientSessionId, workout.serverSessionId, workout.startedAt, workout.finishedAt ?? null, workout.currentExerciseIndex, workout.restEndsAt, workout.restTotalSeconds, workout.restContext ? JSON.stringify(workout.restContext) : null, workout.workoutSnapshot ? JSON.stringify(workout.workoutSnapshot) : null, workout.workoutNote ?? null, JSON.stringify(workout.exerciseFeedback ?? {}), JSON.stringify(workout.exerciseNotes ?? {}), workout.effectiveWorkout ? JSON.stringify(workout.effectiveWorkout) : null, workout.arrangementRevision ?? null, workout.currentExerciseId ?? null, workout.targetReviewExerciseIds ? JSON.stringify(workout.targetReviewExerciseIds) : null, JSON.stringify(workout.acknowledgedArrangementOperationIds ?? []), workout.revision]
    );
    if (result.changes === 0) return;
    await db.runAsync("DELETE FROM workout_set_drafts WHERE user_id = ?", [workout.userId]);
    for (const set of workout.sets) {
      await db.runAsync("INSERT INTO workout_set_drafts (user_id, exercise_id, set_number, payload) VALUES (?, ?, ?, ?)", [workout.userId, set.exerciseId, set.setNumber, JSON.stringify(set)]);
    }
    await db.runAsync("DELETE FROM workout_pending_operations WHERE user_id = ?", [workout.userId]);
    for (const operation of workout.operations) {
      await db.runAsync(
        "INSERT INTO workout_pending_operations (id, user_id, type, status, attempts, next_attempt_at, sequence, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [operation.id, workout.userId, operation.type, operation.status, operation.attempts ?? 0, operation.nextAttemptAt ?? null, operation.sequence ?? 0, JSON.stringify(operation.payload), Date.now()]
      );
    }
    persisted = true;
  });
  return persisted;
}

export async function saveActiveWorkout(workout: LocalActiveWorkout, isCurrent: () => boolean = () => true): Promise<void> {
  return serializeWrite(async () => {
    const durable = await loadActiveWorkout(workout.userId);
    if (!isCurrent()) return;
    Object.assign(workout, mergeSavedArrangement(durable, workout));
    const db = await database();
    if (!isCurrent()) return;
    await persistActiveWorkout(db, workout);
  });
}

async function saveReplayWorkout(workout: LocalActiveWorkout, startedIds: string[]): Promise<void> {
  await serializeWrite(async () => {
    const durable = await loadActiveWorkout(workout.userId);
    const merged = mergeReplayAcknowledgement(durable, workout, startedIds);
    await persistActiveWorkout(await database(), merged);
    Object.assign(workout, merged);
  });
}

export function queueWorkoutPrestartOrder(baseline: LocalActiveWorkout, exerciseIds: string[], isCurrent: () => boolean = () => true): Promise<LocalActiveWorkout | null> {
  const task = replayQueue.then(() => serializeWrite(async () => {
    const db = await database();
    const terminal = await db.getFirstAsync<{ client_session_id: string }>(
      "SELECT client_session_id FROM terminal_workout_sessions WHERE user_id = ? AND (client_session_id = ? OR (server_session_id IS NOT NULL AND server_session_id = ?)) LIMIT 1",
      [baseline.userId, baseline.clientSessionId, baseline.serverSessionId]);
    if (terminal || (lastTerminalReplay?.userId === baseline.userId && (lastTerminalReplay.clientSessionId === baseline.clientSessionId || (baseline.serverSessionId != null && lastTerminalReplay.serverSessionId === baseline.serverSessionId)))) {
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
    if (!isCurrent()) return null;
    const persisted = await persistActiveWorkout(db, next);
    if (!persisted) throw new PreWorkoutOrderConflict("This workout can no longer be changed. Refresh your workouts.", baseline.serverSessionId, true);
    return next;
  }));
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
  sets: SetState[],
  operations: SequencedWorkoutOperation[]
): SequencedWorkoutOperation[] {
  const queuedSetKeys = new Set(
    operations.map(operationSetKey).filter((key): key is string => key != null)
  );
  const recovered = sets.flatMap((set): SequencedWorkoutOperation[] => {
    if (!set.confirmed || set.deleted || set.logId || queuedSetKeys.has(`${set.exerciseId}:${set.setNumber}`)) {
      return [];
    }
    const reps = Number(set.reps);
    if (!Number.isInteger(reps) || reps < 1) return [];
    return [{
      id: createClientId(),
      type: "set",
      status: "pending",
      payload: {
        exerciseId: set.exerciseId,
        setNumber: set.setNumber,
        reps,
        weightKg: set.weightKg ?? undefined,
      },
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
  const incomingOnlyOperations = incomingOperations.filter((operation) => !persistedIds.has(operation.id));
  const operationsById = new Map(persisted.operations.map((operation) => [operation.id, operation]));
  for (const operation of incomingOnlyOperations) operationsById.set(operation.id, operation);

  const incomingSets = new Map(incoming.sets.map((set) => [`${set.exerciseId}:${set.setNumber}`, set]));
  const mergedSets = persisted.sets.map((set) => {
    const key = `${set.exerciseId}:${set.setNumber}`;
    const incomingSet = incomingSets.get(key);
    if (!incomingSet) return set;
    if (incomingSetKeys.has(key) || (incomingSet.confirmed && !set.confirmed) || (incomingSet.deleted && !set.deleted)) return mergeSetAcknowledgements(incomingSet, set);
    return set;
  });
  for (const [key, set] of incomingSets) {
    if (!persisted.sets.some((current) => `${current.exerciseId}:${current.setNumber}` === key)) mergedSets.push(set);
  }

  let operations = recoverMissingSetOperations(
    mergedSets,
    Array.from(operationsById.values()).filter((operation) => operation.type !== "complete")
  );
  if (retry) {
    operations = operations.map((operation) => operation.status === "failed" && !((operation.type === "order" || operation.type === "replace") && operation.payload.conflict)
      ? { ...operation, status: "pending", nextAttemptAt: undefined }
      : operation);
  }
  const priorComplete = [...persisted.operations, ...incoming.operations].find((operation) => operation.type === "complete");
  operations.push({
    ...(priorComplete ?? { id: createClientId(), type: "complete", status: "pending", payload: {} }),
    status: "pending",
    nextAttemptAt: undefined,
  } as SequencedWorkoutOperation);

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

export type QueueWorkoutCompletionResult =
  | { status: "queued"; workout: LocalActiveWorkout }
  | { status: "terminal"; serverSessionId: string | null };

/** Atomically merges the latest UI state with disk and appends completion after every mutation. */
export function queueWorkoutCompletion(incoming: LocalActiveWorkout, retry = false): Promise<QueueWorkoutCompletionResult> {
  const task = replayQueue.then(() => serializeWrite(async (): Promise<QueueWorkoutCompletionResult> => {
    const db = await database();
    const terminal = await db.getFirstAsync<{ server_session_id: string | null }>(
      `SELECT server_session_id FROM terminal_workout_sessions
       WHERE user_id = ? AND (client_session_id = ? OR (server_session_id IS NOT NULL AND server_session_id = ?))
       LIMIT 1`,
      [incoming.userId, incoming.clientSessionId, incoming.serverSessionId]
    );
    if (terminal) return { status: "terminal", serverSessionId: terminal.server_session_id };
    const durable = await loadActiveWorkout(incoming.userId);
    const next = mergeWorkoutForCompletion(durable, incoming, retry);
    await persistActiveWorkout(db, next);
    return { status: "queued", workout: next };
  }));
  replayQueue = task.then(() => undefined, () => undefined);
  return task;
}

export function saveWorkoutSetEntries(incoming: LocalActiveWorkout, keys: string[], unit: WeightUnit) {
  return serializeWrite(async () => {
    const durable = await loadActiveWorkout(incoming.userId);
    if (!durable || durable.clientSessionId !== incoming.clientSessionId || durable.finishedAt != null
      || durable.operations.some((operation) => operation.type === "complete" || operation.type === "abandon" || operation.type === "replace")) {
      throw new Error("Workout is no longer editable");
    }
    const result = prepareSetEntries(mergeSavedArrangement(durable, incoming), durable, keys, unit, createClientId);
    if (result.savedCount > 0 && !await persistActiveWorkout(await database(), result.workout)) {
      throw new Error("Workout is no longer editable");
    }
    return result;
  });
}

export type ContinueWorkoutLoggingResult =
  | { status: "active"; workout: LocalActiveWorkout }
  | { status: "completed"; serverSessionId: string | null }
  | { status: "missing" };

/** Waits for any replay attempt, then removes an unsent finish before logging resumes. */
export function continueWorkoutLogging(userId: string, clientSessionId: string): Promise<ContinueWorkoutLoggingResult> {
  const task = replayQueue.then(() => serializeWrite(async (): Promise<ContinueWorkoutLoggingResult> => {
    if (lastCompletedReplay?.userId === userId && lastCompletedReplay.clientSessionId === clientSessionId) {
      return { status: "completed", serverSessionId: lastCompletedReplay.serverSessionId };
    }
    const durable = await loadActiveWorkout(userId);
    if (!durable || durable.clientSessionId !== clientSessionId) return { status: "missing" };
    const operations = durable.operations.filter((operation) => operation.type !== "complete");
    if (operations.length === durable.operations.length) return { status: "active", workout: durable };
    const resumed = { ...durable, finishedAt: null, operations: normalizeOperationSequences(operations), revision: durable.revision + 1 };
    await persistActiveWorkout(await database(), resumed, true);
    return { status: "active", workout: resumed };
  }));
  replayQueue = task.then(() => undefined, () => undefined);
  return task;
}

export async function clearActiveWorkout(userId: string): Promise<void> {
  return serializeWrite(async () => {
    const db = await database();
    await db.withTransactionAsync(async () => {
    const active = await db.getFirstAsync<{ client_session_id: string; server_session_id: string | null; started_at: number; finished_at: number | null }>(
      "SELECT client_session_id, server_session_id, started_at, finished_at FROM active_workouts WHERE user_id = ?",
      [userId]
    );
    if (active) {
      await db.runAsync(
        "INSERT OR IGNORE INTO terminal_workout_sessions (user_id, client_session_id, server_session_id, completed_at, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?)",
        [userId, active.client_session_id, active.server_session_id, Date.now(), active.started_at, active.finished_at]
      );
    }
    await db.runAsync("DELETE FROM active_workouts WHERE user_id = ?", [userId]);
    await db.runAsync("DELETE FROM workout_set_drafts WHERE user_id = ?", [userId]);
    await db.runAsync("DELETE FROM workout_pending_operations WHERE user_id = ?", [userId]);
    });
  });
}

export async function retryFailedWorkoutOperations(userId: string): Promise<LocalActiveWorkout | null> {
  const workout = await loadActiveWorkout(userId);
  if (!workout) return null;
  workout.operations = workout.operations.map((operation) =>
    operation.status === "failed" && !((operation.type === "order" || operation.type === "replace") && operation.payload.conflict)
      ? { ...operation, status: "pending", nextAttemptAt: undefined }
      : operation
  ) as PendingWorkoutOperation[];
  workout.sets = workout.sets.map((set) =>
    set.syncStatus === "failed" ? { ...set, syncing: false, syncStatus: "pending" } : set
  );
  workout.revision += 1;
  await saveActiveWorkout(workout);
  return workout;
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof HttpError) || error.status == null) return true;
  return error.status === 401 || error.status === 408 || error.status === 429 || error.status >= 500;
}

function nextRetryAt(attempts: number): number {
  return Date.now() + Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, attempts - 1));
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

/** Replays persisted operations in order. The backend's client IDs make every retry safe. */
async function replayPendingWorkoutOperationsInternal(
  token: string,
  userId: string
): Promise<{ workout: LocalActiveWorkout | null; completed: boolean; abandoned: boolean; completedSession: SessionResponse | null; completionBlocked: boolean; startedOperationIds: string[]; authenticationRequired: boolean }> {
  const workout = await loadActiveWorkout(userId);
  if (!workout) return { workout: null, completed: false, abandoned: false, completedSession: null, completionBlocked: false, startedOperationIds: [], authenticationRequired: false };

  let completed = false;
  let abandoned = false;
  let completedSession: SessionResponse | null = null;
  let completionBlocked = false;
  let authenticationRequired = false;
  const remaining: PendingWorkoutOperation[] = [];
  // Use an immutable pass list because each attempt is durably written before
  // it goes to the network.
  const operations = workout.operations.map((operation) =>
    operation.status === "retrying" ? { ...operation, status: "pending" as const } : operation
  ).sort((left, right) => (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER)) as SequencedWorkoutOperation[];
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
        ? { ...acknowledgeSetOperation(set, operationId), reps: String(setLog.reps), weightKg: setLog.weightKg, syncing: false, syncStatus: "synced", logId: setLog.id, version: setLog.version }
        : set
    );
  };
  const now = Date.now();
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
    if (operation.status === "failed") {
      remaining.push(operation);
      remaining.push(...operations.slice(index + 1));
      break;
    }
    if (operation.nextAttemptAt && operation.nextAttemptAt > now) {
      remaining.push(operation);
      remaining.push(...operations.slice(index + 1));
      break;
    }
    const resolved = resolveSetCorrection(operation, workout.sets);
    if (!resolved) {
      remaining.push(operation, ...operations.slice(index + 1));
      break;
    }
    operation = resolved;
    const retrying = { ...operation, status: "retrying" as const, attempts: (operation.attempts ?? 0) + 1, nextAttemptAt: undefined } as PendingWorkoutOperation;
    // Durably mark the operation before issuing a request. A process death at
    // any point can safely replay the same client identifier.
    workout.operations = [...remaining, retrying, ...operations.slice(index + 1)];
    workout.revision += 1;
    await saveReplayWorkout(workout, startedOperationIds);
    try {
      if (operation.type === "create") {
        const created = await createSession(
          token,
          operation.payload.workoutDayId,
          operation.payload.workoutDate,
          operation.payload.dayType,
          operation.payload.clientSessionId
        );
        Object.assign(workout, adoptSessionArrangement(workout, created));
      } else if (operation.type === "order") {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" }, ...operations.slice(index + 1));
          break;
        }
        const updated = await updateExerciseOrder(token, workout.serverSessionId!, operation.payload.exerciseIds,
          operation.payload.expectedRevision, operation.id, operation.payload.applyRevisedTargets);
        Object.assign(workout, adoptSessionArrangement(workout, updated));
        if (operation.payload.requiresReview) workout.targetReviewExerciseIds = [...operation.payload.exerciseIds];
        workout.acknowledgedArrangementOperationIds = [...new Set([...(workout.acknowledgedArrangementOperationIds ?? []), operation.id])];
      } else if (operation.type === "replace") {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" }, ...operations.slice(index + 1));
          break;
        }
        const updated = await replaceSessionExercise(token, workout.serverSessionId!, operation.payload.exerciseId,
          operation.payload.replacementExerciseId, operation.payload.expectedRevision, operation.id);
        Object.assign(workout, adoptSessionArrangement(workout, updated));
        workout.acknowledgedArrangementOperationIds = [...new Set([...(workout.acknowledgedArrangementOperationIds ?? []), operation.id])];
      } else if (operation.type === "set") {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" });
          remaining.push(...operations.slice(index + 1));
          break;
        }
        if (shouldReconcileSetsBeforeReplay && !canonicalSetsLoaded) await refreshCanonicalSets();
        const existing = canonicalSets.get(`${operation.payload.exerciseId}:${operation.payload.setNumber}`);
        if (existing) {
          if (existing.reps !== operation.payload.reps || existing.weightKg !== (operation.payload.weightKg ?? null)) {
            throw new HttpError("That set number already exists for this exercise.", 409);
          }
          acceptSetLog(existing, operation.id);
          continue;
        }
        const logged = await logSet(
          token,
          workout.serverSessionId,
          operation.payload.exerciseId,
          operation.payload.setNumber,
          operation.payload.reps,
          operation.payload.weightKg,
          operation.id
        );
        canonicalSets.set(`${logged.exerciseId}:${logged.setNumber}`, logged);
        acceptSetLog(logged, operation.id);
      } else if (operation.type === "update_set") {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" });
          remaining.push(...operations.slice(index + 1));
          break;
        }
        const updated = await updateLoggedSet(
          token, workout.serverSessionId, operation.payload.logId, operation.payload.reps,
          operation.payload.weightKg, operation.payload.expectedVersion, operation.id
        );
        workout.sets = workout.sets.map((set) =>
          set.logId === updated.id
            ? { ...acknowledgeSetOperation(set, operation.id), reps: String(updated.reps), weight: operation.payload.displayWeight, weightKg: updated.weightKg, syncing: false, syncStatus: "synced", version: updated.version }
            : set
        );
      } else if (operation.type === "delete_set") {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" });
          remaining.push(...operations.slice(index + 1));
          break;
        }
        await deleteLoggedSet(token, workout.serverSessionId, operation.payload.logId, operation.id);
        workout.sets = workout.sets.map((set) => set.logId === operation.payload.logId ? acknowledgeSetOperation(set, operation.id) : set);
      } else if (operation.type === "restore_set") {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" });
          remaining.push(...operations.slice(index + 1));
          break;
        }
        const restored = await restoreLoggedSet(token, workout.serverSessionId, operation.payload.logId, operation.id);
        workout.sets = workout.sets.map((set) =>
          set.logId === restored.id ? { ...acknowledgeSetOperation(set, operation.id), deleted: false, deletedLogId: null, syncing: false, syncStatus: "synced" } : set
        );
      } else if (operation.type === "update_workout_note") {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" });
          remaining.push(...operations.slice(index + 1));
          break;
        }
        const updated = await updateWorkoutNote(token, workout.serverSessionId, operation.payload.note, operation.id);
        workout.workoutNote = updated.workoutNote;
      } else if (operation.type === "update_exercise_feedback") {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" });
          continue;
        }
        await updateExerciseFeedback(
          token, workout.serverSessionId, operation.payload.exerciseId, operation.payload.effort, operation.payload.rir, operation.id
        );
      } else if (operation.type === "update_exercise_note") {
        await updateUserExerciseNote(token, operation.payload.exerciseId, operation.payload.note);
      } else if (operation.type === "complete") {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" });
          continue;
        }
        const canonicalBeforeComplete = await getSession(token, workout.serverSessionId);
        if (canonicalBeforeComplete.status === "completed") {
          completedSession = canonicalBeforeComplete;
          completed = true;
          break;
        }
        if (!hasCanonicalEffectiveSets(workout, canonicalBeforeComplete)) {
          completionBlocked = true;
          remaining.push({ ...retrying, status: "pending", nextAttemptAt: nextRetryAt(retrying.attempts ?? 1) });
          remaining.push(...operations.slice(index + 1));
          break;
        }
        completedSession = await completeSession(token, workout.serverSessionId);
        if (hasCanonicalEffectiveSets(workout, completedSession)) {
          completed = true;
          break;
        }
        const canonicalAfterComplete = await getSession(token, workout.serverSessionId);
        completedSession = canonicalAfterComplete;
        // Completion is already terminal on the server. Clear local state rather
        // than leaving an impossible retry operation that would block Home.
        if (canonicalAfterComplete.status === "completed") {
          completed = true;
          break;
        }
      } else if (operation.type === "abandon") {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" });
          continue;
        }
        await abandonSession(token, workout.serverSessionId);
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
      if (
        operation.type === "set" &&
        error instanceof HttpError &&
        error.status === 409 &&
        workout.serverSessionId
      ) {
        try {
          const key = `${operation.payload.exerciseId}:${operation.payload.setNumber}`;
          if (!canonicalSets.has(key)) await refreshCanonicalSets();
          const existing = canonicalSets.get(key);
          if (existing && existing.reps === operation.payload.reps && existing.weightKg === (operation.payload.weightKg ?? null)) {
            acceptSetLog(existing, operation.id);
            continue;
          }
        } catch {
          // Keep the normal durable error path when reconciliation fails.
        }
      }
      const retryable = isRetryableError(error);
      authenticationRequired = error instanceof HttpError && error.status === 401;
      const failedOperation = {
        ...operation,
        status: retryable ? "pending" as const : "failed" as const,
        attempts: retrying.attempts,
        nextAttemptAt: retryable ? nextRetryAt(retrying.attempts ?? 1) : undefined,
      } as PendingWorkoutOperation;
      if (operation.type === "update_set" && !retryable) {
        (failedOperation as Extract<PendingWorkoutOperation, { type: "update_set" }>).payload.conflict =
          error instanceof HttpError && error.status === 409;
      }
      remaining.push(failedOperation);
      if (operation.type === "set" || operation.type === "update_set" || operation.type === "delete_set" || operation.type === "restore_set") {
        workout.sets = workout.sets.map((set) =>
          set.exerciseId === operation.payload.exerciseId && set.setNumber === operation.payload.setNumber
            ? operation.type === "update_set" && !retryable
              ? {
                  ...set,
                  reps: operation.payload.previousReps,
                  weight: operation.payload.previousWeight,
                  version: operation.payload.previousVersion,
                  syncing: false,
                  syncStatus: "failed",
                }
              : { ...set, syncing: false, syncStatus: retryable ? "pending" : "failed" }
            : set
        );
      }
      remaining.push(...operations.slice(index + 1));
      break;
    }
  }
  workout.operations = remaining;
  workout.revision += 1;
  await saveReplayWorkout(workout, startedOperationIds);
  return { workout, completed, abandoned, completedSession, completionBlocked, startedOperationIds, authenticationRequired };
}

export function replayPendingWorkoutOperations(
  token: string,
  userId: string
): Promise<{ workout: LocalActiveWorkout | null; completed: boolean; abandoned: boolean; completedSession: SessionResponse | null; completionBlocked: boolean; startedOperationIds: string[]; authenticationRequired: boolean }> {
  const run = async () => {
    const result = await replayPendingWorkoutOperationsInternal(token, userId);
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
