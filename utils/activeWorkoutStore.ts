import * as SQLite from "expo-sqlite";

import type { SetState, WorkoutDay } from "@/interfaces/workouts";
import { HttpError } from "@/services/httpClient";
import { abandonSession, completeSession, createSession, logSet } from "@/services/workoutLoggingService";

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
  | { id: string; type: "complete" | "abandon"; status: SyncState; attempts?: number; nextAttemptAt?: number; payload: Record<string, never> };

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
  operations: PendingWorkoutOperation[];
}

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let replayQueue: Promise<void> = Promise.resolve();

function serializeWrite(write: () => Promise<void>): Promise<void> {
  const next = writeQueue.then(write, write);
  // Keep the queue usable after a storage failure while still returning the
  // actual failure to the caller that initiated it.
  writeQueue = next.catch(() => undefined);
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
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
      for (const statement of [
        "ALTER TABLE workout_pending_operations ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE workout_pending_operations ADD COLUMN next_attempt_at INTEGER",
        "ALTER TABLE active_workouts ADD COLUMN workout_snapshot TEXT",
        "ALTER TABLE active_workouts ADD COLUMN revision INTEGER NOT NULL DEFAULT 0",
      ]) {
        try {
          await db.execAsync(statement);
        } catch {
          // Existing installations may already have the column.
        }
      }
      return db;
    });
  }
  return databasePromise;
}

export function createClientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function loadActiveWorkout(userId: string): Promise<LocalActiveWorkout | null> {
  const db = await database();
  const workout = await db.getFirstAsync<{
    workout_day_id: string; workout_date: string; day_type: string; client_session_id: string;
    server_session_id: string | null; started_at: number; current_exercise_index: number;
    rest_ends_at: number | null; rest_total_seconds: number; rest_context: string | null; workout_snapshot: string | null; revision: number;
  }>("SELECT * FROM active_workouts WHERE user_id = ?", [userId]);
  if (!workout) return null;
  const drafts = await db.getAllAsync<{ payload: string }>("SELECT payload FROM workout_set_drafts WHERE user_id = ?", [userId]);
  const operations = await db.getAllAsync<{ id: string; type: PendingWorkoutOperation["type"]; status: SyncState; attempts: number; next_attempt_at: number | null; payload: string }>(
    "SELECT id, type, status, attempts, next_attempt_at, payload FROM workout_pending_operations WHERE user_id = ? ORDER BY created_at ASC", [userId]
  );
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
    sets: drafts.map((draft) => JSON.parse(draft.payload) as SetState),
    operations: operations.map(({ next_attempt_at, ...operation }) => ({
      ...operation,
      nextAttemptAt: next_attempt_at ?? undefined,
      payload: JSON.parse(operation.payload),
    })) as PendingWorkoutOperation[],
  };
}

export async function saveActiveWorkout(workout: LocalActiveWorkout): Promise<void> {
  return serializeWrite(async () => {
    const db = await database();
    await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO active_workouts (user_id, workout_day_id, workout_date, day_type, client_session_id, server_session_id, started_at, current_exercise_index, rest_ends_at, rest_total_seconds, rest_context, workout_snapshot, revision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET workout_day_id=excluded.workout_day_id, workout_date=excluded.workout_date, day_type=excluded.day_type, workout_snapshot=excluded.workout_snapshot, client_session_id=excluded.client_session_id, server_session_id=excluded.server_session_id, started_at=excluded.started_at, current_exercise_index=excluded.current_exercise_index, rest_ends_at=excluded.rest_ends_at, rest_total_seconds=excluded.rest_total_seconds, rest_context=excluded.rest_context, revision=excluded.revision
       WHERE active_workouts.revision <= excluded.revision`,
      [workout.userId, workout.workoutDayId, workout.workoutDate, workout.dayType, workout.clientSessionId, workout.serverSessionId, workout.startedAt, workout.currentExerciseIndex, workout.restEndsAt, workout.restTotalSeconds, workout.restContext ? JSON.stringify(workout.restContext) : null, workout.workoutSnapshot ? JSON.stringify(workout.workoutSnapshot) : null, workout.revision]
    );
    if (result.changes === 0) return;
    await db.runAsync("DELETE FROM workout_set_drafts WHERE user_id = ?", [workout.userId]);
    for (const set of workout.sets) {
      await db.runAsync("INSERT INTO workout_set_drafts (user_id, exercise_id, set_number, payload) VALUES (?, ?, ?, ?)", [workout.userId, set.exerciseId, set.setNumber, JSON.stringify(set)]);
    }
    await db.runAsync("DELETE FROM workout_pending_operations WHERE user_id = ?", [workout.userId]);
    for (const operation of workout.operations) {
      await db.runAsync(
        "INSERT INTO workout_pending_operations (id, user_id, type, status, attempts, next_attempt_at, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [operation.id, workout.userId, operation.type, operation.status, operation.attempts ?? 0, operation.nextAttemptAt ?? null, JSON.stringify(operation.payload), Date.now()]
      );
    }
    });
  });
}

export async function clearActiveWorkout(userId: string): Promise<void> {
  return serializeWrite(async () => {
    const db = await database();
    await db.withTransactionAsync(async () => {
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

/** Replays persisted operations in order. The backend's client IDs make every retry safe. */
async function replayPendingWorkoutOperationsInternal(
  token: string,
  userId: string
): Promise<{ workout: LocalActiveWorkout | null; completed: boolean; abandoned: boolean }> {
  const workout = await loadActiveWorkout(userId);
  if (!workout) return { workout: null, completed: false, abandoned: false };

  let completed = false;
  let abandoned = false;
  const remaining: PendingWorkoutOperation[] = [];
  // Use an immutable pass list because each attempt is durably written before
  // it goes to the network.
  const operations = workout.operations.map((operation) =>
    operation.status === "retrying" ? { ...operation, status: "pending" as const } : operation
  ) as PendingWorkoutOperation[];
  const now = Date.now();
  for (let index = 0; index < operations.length; index += 1) {
    const operation = operations[index];
    if (operation.status === "failed") {
      remaining.push(operation);
      continue;
    }
    if (operation.nextAttemptAt && operation.nextAttemptAt > now) {
      remaining.push(operation);
      continue;
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
        workout.sets = workout.sets.map((set) =>
          set.exerciseId === operation.payload.exerciseId && set.setNumber === operation.payload.setNumber
            ? { ...set, syncing: false, syncStatus: "synced", logId: logged.id }
            : set
        );
      } else if (operation.type === "complete") {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" });
          continue;
        }
        await completeSession(token, workout.serverSessionId);
        completed = true;
      } else {
        if (!workout.serverSessionId) {
          remaining.push({ ...retrying, status: "pending" });
          continue;
        }
        await abandonSession(token, workout.serverSessionId);
        abandoned = true;
      }
    } catch (error) {
      const retryable = isRetryableError(error);
      const failedOperation = {
        ...operation,
        status: retryable ? "pending" as const : "failed" as const,
        attempts: retrying.attempts,
        nextAttemptAt: retryable ? nextRetryAt(retrying.attempts ?? 1) : undefined,
      } as PendingWorkoutOperation;
      remaining.push(failedOperation);
      if (operation.type === "set") {
        workout.sets = workout.sets.map((set) =>
          set.exerciseId === operation.payload.exerciseId && set.setNumber === operation.payload.setNumber
            ? { ...set, syncing: false, syncStatus: retryable ? "pending" : "failed" }
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
  return { workout, completed, abandoned };
}

export function replayPendingWorkoutOperations(
  token: string,
  userId: string
): Promise<{ workout: LocalActiveWorkout | null; completed: boolean; abandoned: boolean }> {
  const task = replayQueue.then(
    () => replayPendingWorkoutOperationsInternal(token, userId),
    () => replayPendingWorkoutOperationsInternal(token, userId)
  );
  replayQueue = task.then(() => undefined, () => undefined);
  return task;
}
