import * as SQLite from "expo-sqlite";

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
        conflict?: boolean;
      };
    }
  | {
      id: string;
      type: "delete_set" | "restore_set";
      status: SyncState;
      attempts?: number;
      nextAttemptAt?: number;
      payload: { logId: string; exerciseId: string; setNumber: number };
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
  | { id: string; type: "complete" | "abandon"; status: SyncState; attempts?: number; nextAttemptAt?: number; payload: Record<string, never> };

export type SequencedWorkoutOperation = PendingWorkoutOperation & { sequence?: number };

export interface LocalActiveWorkout {
  userId: string;
  workoutDayId: string;
  workoutDate: string;
  dayType: string;
  workoutSnapshot: WorkoutDay | null;
  clientSessionId: string;
  serverSessionId: string | null;
  startedAt: number;
  currentExerciseIndex: number;
  restEndsAt: number | null;
  restTotalSeconds: number;
  restContext: { exerciseIndex: number; isLastSetOfExercise: boolean } | null;
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
let lastCompletedReplay: { userId: string; clientSessionId: string; serverSessionId: string | null } | null = null;
const MAX_TERMINAL_WORKOUTS_PER_USER = 100;

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
          current_exercise_index INTEGER NOT NULL DEFAULT 0,
          rest_ends_at INTEGER,
          rest_total_seconds INTEGER NOT NULL DEFAULT 0,
          rest_context TEXT,
          workout_snapshot TEXT,
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
          PRIMARY KEY (user_id, client_session_id)
        );
      `);
      for (const statement of [
        "ALTER TABLE workout_pending_operations ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE workout_pending_operations ADD COLUMN next_attempt_at INTEGER",
        "ALTER TABLE workout_pending_operations ADD COLUMN sequence INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE active_workouts ADD COLUMN workout_snapshot TEXT",
        "ALTER TABLE active_workouts ADD COLUMN revision INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE active_workouts ADD COLUMN workout_note TEXT",
        "ALTER TABLE active_workouts ADD COLUMN exercise_feedback TEXT",
        "ALTER TABLE active_workouts ADD COLUMN exercise_notes TEXT",
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
    server_session_id: string | null; started_at: number; current_exercise_index: number;
    rest_ends_at: number | null; rest_total_seconds: number; rest_context: string | null; workout_snapshot: string | null;
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
  return {
    userId,
    workoutDayId: workout.workout_day_id,
    workoutDate: workout.workout_date,
    dayType: workout.day_type,
    workoutSnapshot: workout.workout_snapshot ? JSON.parse(workout.workout_snapshot) as WorkoutDay : null,
    clientSessionId: workout.client_session_id,
    serverSessionId: workout.server_session_id,
    startedAt: workout.started_at,
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
  };
}

async function persistActiveWorkout(db: SQLite.SQLiteDatabase, workout: LocalActiveWorkout): Promise<void> {
  workout.operations = normalizeOperationSequences(
    recoverMissingSetOperations(workout.sets, workout.operations)
  );
  await db.withTransactionAsync(async () => {
    const terminal = await db.getFirstAsync<{ client_session_id: string }>(
      `SELECT client_session_id FROM terminal_workout_sessions
       WHERE user_id = ? AND (client_session_id = ? OR (server_session_id IS NOT NULL AND server_session_id = ?))
       LIMIT 1`,
      [workout.userId, workout.clientSessionId, workout.serverSessionId]
    );
    if (terminal) return;
    const result = await db.runAsync(
      `INSERT INTO active_workouts (user_id, workout_day_id, workout_date, day_type, client_session_id, server_session_id, started_at, current_exercise_index, rest_ends_at, rest_total_seconds, rest_context, workout_snapshot, workout_note, exercise_feedback, exercise_notes, revision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET workout_day_id=excluded.workout_day_id, workout_date=excluded.workout_date, day_type=excluded.day_type, workout_snapshot=excluded.workout_snapshot, client_session_id=excluded.client_session_id, server_session_id=excluded.server_session_id, started_at=excluded.started_at, current_exercise_index=excluded.current_exercise_index, rest_ends_at=excluded.rest_ends_at, rest_total_seconds=excluded.rest_total_seconds, rest_context=excluded.rest_context, workout_note=excluded.workout_note, exercise_feedback=excluded.exercise_feedback, exercise_notes=excluded.exercise_notes, revision=excluded.revision
       WHERE active_workouts.revision < excluded.revision`,
      [workout.userId, workout.workoutDayId, workout.workoutDate, workout.dayType, workout.clientSessionId, workout.serverSessionId, workout.startedAt, workout.currentExerciseIndex, workout.restEndsAt, workout.restTotalSeconds, workout.restContext ? JSON.stringify(workout.restContext) : null, workout.workoutSnapshot ? JSON.stringify(workout.workoutSnapshot) : null, workout.workoutNote ?? null, JSON.stringify(workout.exerciseFeedback ?? {}), JSON.stringify(workout.exerciseNotes ?? {}), workout.revision]
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
  });
}

export async function saveActiveWorkout(workout: LocalActiveWorkout): Promise<void> {
  return serializeWrite(async () => {
    await persistActiveWorkout(await database(), workout);
  });
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
      ? incoming.operations.map((operation) => operation.status === "failed" ? { ...operation, status: "pending", nextAttemptAt: undefined } : operation)
      : incoming.operations) as SequencedWorkoutOperation[];
    const operations = recoverMissingSetOperations(
      incoming.sets,
      incomingOperations.filter((operation) => operation.type !== "complete")
    );
    const complete = incomingOperations.find((operation) => operation.type === "complete");
    return {
      ...incoming,
      operations: normalizeOperationSequences([
        ...operations,
        { ...(complete ?? { id: createClientId(), type: "complete", status: "pending", payload: {} }), status: "pending", nextAttemptAt: undefined } as SequencedWorkoutOperation,
      ]),
      revision: incoming.revision + 1,
    };
  }

  const persistedIds = new Set(persisted.operations.map((operation) => operation.id));
  const incomingSetKeys = new Set(incoming.operations.map(operationSetKey).filter((key): key is string => key != null));
  const incomingHasWorkoutNote = incoming.operations.some((operation) => operation.type === "update_workout_note");
  const incomingOnlyOperations = incoming.operations.filter((operation) => !persistedIds.has(operation.id));
  const operationsById = new Map(persisted.operations.map((operation) => [operation.id, operation]));
  for (const operation of incomingOnlyOperations) operationsById.set(operation.id, operation);

  const incomingSets = new Map(incoming.sets.map((set) => [`${set.exerciseId}:${set.setNumber}`, set]));
  const mergedSets = persisted.sets.map((set) => {
    const key = `${set.exerciseId}:${set.setNumber}`;
    const incomingSet = incomingSets.get(key);
    if (!incomingSet) return set;
    if (incomingSetKeys.has(key) || (incomingSet.confirmed && !set.confirmed) || (incomingSet.deleted && !set.deleted)) return incomingSet;
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
    operations = operations.map((operation) => operation.status === "failed"
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
    workoutSnapshot: incoming.workoutSnapshot ?? persisted.workoutSnapshot,
    clientSessionId: incoming.clientSessionId,
    serverSessionId: persisted.serverSessionId ?? incoming.serverSessionId,
    startedAt: incoming.startedAt,
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
  return serializeWrite(async (): Promise<QueueWorkoutCompletionResult> => {
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
    const resumed = { ...durable, operations: normalizeOperationSequences(operations), revision: durable.revision + 1 };
    await persistActiveWorkout(await database(), resumed);
    return { status: "active", workout: resumed };
  }));
  replayQueue = task.then(() => undefined, () => undefined);
  return task;
}

export async function clearActiveWorkout(userId: string): Promise<void> {
  return serializeWrite(async () => {
    const db = await database();
    await db.withTransactionAsync(async () => {
    const active = await db.getFirstAsync<{ client_session_id: string; server_session_id: string | null }>(
      "SELECT client_session_id, server_session_id FROM active_workouts WHERE user_id = ?",
      [userId]
    );
    if (active) {
      await db.runAsync(
        "INSERT OR IGNORE INTO terminal_workout_sessions (user_id, client_session_id, server_session_id, completed_at) VALUES (?, ?, ?, ?)",
        [userId, active.client_session_id, active.server_session_id, Date.now()]
      );
      await db.runAsync(
        `DELETE FROM terminal_workout_sessions
         WHERE user_id = ? AND client_session_id NOT IN (
           SELECT client_session_id FROM terminal_workout_sessions
           WHERE user_id = ?
           ORDER BY completed_at DESC
           LIMIT ?
         )`,
        [userId, userId, MAX_TERMINAL_WORKOUTS_PER_USER]
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
    operation.status === "failed"
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
  return error.status === 408 || error.status === 429 || error.status >= 500;
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
): Promise<{ workout: LocalActiveWorkout | null; completed: boolean; abandoned: boolean; completedSession: SessionResponse | null; completionBlocked: boolean; startedOperationIds: string[] }> {
  const workout = await loadActiveWorkout(userId);
  if (!workout) return { workout: null, completed: false, abandoned: false, completedSession: null, completionBlocked: false, startedOperationIds: [] };

  let completed = false;
  let abandoned = false;
  let completedSession: SessionResponse | null = null;
  let completionBlocked = false;
  const remaining: PendingWorkoutOperation[] = [];
  // Use an immutable pass list because each attempt is durably written before
  // it goes to the network.
  const operations = workout.operations.map((operation) =>
    operation.status === "retrying" ? { ...operation, status: "pending" as const } : operation
  ).sort((left, right) => (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER)) as SequencedWorkoutOperation[];
  const startedOperationIds = operations.map((operation) => operation.id);
  const now = Date.now();
  for (let index = 0; index < operations.length; index += 1) {
    const operation = operations[index];
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
    const retrying = { ...operation, status: "retrying" as const, attempts: (operation.attempts ?? 0) + 1, nextAttemptAt: undefined } as PendingWorkoutOperation;
    // Durably mark the operation before issuing a request. A process death at
    // any point can safely replay the same client identifier.
    workout.operations = [...remaining, retrying, ...operations.slice(index + 1)];
    workout.revision += 1;
    await saveActiveWorkout(workout);
    try {
      if (operation.type === "create") {
        const created = await createSession(
          token,
          operation.payload.workoutDayId,
          operation.payload.workoutDate,
          operation.payload.dayType,
          operation.payload.clientSessionId
        );
        workout.serverSessionId = created.id;
      } else if (operation.type === "set") {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" });
          remaining.push(...operations.slice(index + 1));
          break;
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
        workout.sets = workout.sets.map((set) =>
          set.exerciseId === operation.payload.exerciseId && set.setNumber === operation.payload.setNumber
            ? { ...set, weightKg: logged.weightKg, syncing: false, syncStatus: "synced", logId: logged.id, version: logged.version }
            : set
        );
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
            ? { ...set, reps: String(updated.reps), weight: operation.payload.displayWeight, weightKg: updated.weightKg, syncing: false, syncStatus: "synced", version: updated.version }
            : set
        );
      } else if (operation.type === "delete_set") {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" });
          remaining.push(...operations.slice(index + 1));
          break;
        }
        await deleteLoggedSet(token, workout.serverSessionId, operation.payload.logId, operation.id);
      } else if (operation.type === "restore_set") {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" });
          remaining.push(...operations.slice(index + 1));
          break;
        }
        const restored = await restoreLoggedSet(token, workout.serverSessionId, operation.payload.logId, operation.id);
        workout.sets = workout.sets.map((set) =>
          set.logId === restored.id ? { ...set, deleted: false, deletedLogId: null, syncing: false, syncStatus: "synced" } : set
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
      if (
        operation.type === "set" &&
        error instanceof HttpError &&
        error.status === 409 &&
        workout.serverSessionId
      ) {
        try {
          const canonical = await getSession(token, workout.serverSessionId);
          const existing = canonical.setLogs.find(
            (set) =>
              set.exerciseId === operation.payload.exerciseId &&
              set.setNumber === operation.payload.setNumber &&
              set.reps === operation.payload.reps &&
              set.weightKg === (operation.payload.weightKg ?? null)
          );
          if (existing) {
            workout.sets = workout.sets.map((set) =>
              set.exerciseId === existing.exerciseId && set.setNumber === existing.setNumber
                ? { ...set, reps: String(existing.reps), weightKg: existing.weightKg, syncing: false, syncStatus: "synced", logId: existing.id, version: existing.version }
                : set
            );
            continue;
          }
        } catch {
          // Keep the normal durable error path when reconciliation fails.
        }
      }
      const retryable = isRetryableError(error);
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
  await saveActiveWorkout(workout);
  return { workout, completed, abandoned, completedSession, completionBlocked, startedOperationIds };
}

export function replayPendingWorkoutOperations(
  token: string,
  userId: string
): Promise<{ workout: LocalActiveWorkout | null; completed: boolean; abandoned: boolean; completedSession: SessionResponse | null; completionBlocked: boolean; startedOperationIds: string[] }> {
  const run = async () => {
    const result = await replayPendingWorkoutOperationsInternal(token, userId);
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
