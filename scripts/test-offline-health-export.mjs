import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../utils/activeWorkoutStore.native.ts");
const output = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness() {
  const active = new Map();
  const drafts = new Map();
  const operations = new Map();
  const terminal = new Map();
  const db = {
    execAsync: async () => {},
    withTransactionAsync: async (task) => task(),
    getFirstAsync: async (sql, [userId] = []) => {
      if (sql.includes("FROM terminal_workout_sessions")) return terminal.get(userId) ?? null;
      if (sql.includes("FROM workout_pending_operations")) return operations.get(userId)?.find((operation) => operation.type === "complete") ?? null;
      if (sql.includes("FROM active_workouts")) return active.get(userId) ?? null;
      throw new Error(`Unexpected query: ${sql}`);
    },
    getAllAsync: async (sql, [userId] = []) => {
      if (sql.includes("FROM terminal_workout_sessions")) {
        const record = terminal.get(userId);
        return record?.finished_at != null ? [record] : [];
      }
      if (sql.includes("FROM workout_set_drafts")) return drafts.get(userId) ?? [];
      if (sql.includes("FROM workout_pending_operations")) return userId ? operations.get(userId) ?? [] : [];
      throw new Error(`Unexpected query: ${sql}`);
    },
    runAsync: async (sql, values) => {
      if (sql.startsWith("INSERT INTO active_workouts")) {
        const [userId, workoutDayId, workoutDate, dayType, clientSessionId, serverSessionId, startedAt, finishedAt, currentExerciseIndex, restEndsAt, restTotalSeconds, restContext, workoutSnapshot, workoutNote, exerciseFeedback, exerciseNotes, revision] = values;
        if ((active.get(userId)?.revision ?? -1) >= revision) return { changes: 0 };
        active.set(userId, { workout_day_id: workoutDayId, workout_date: workoutDate, day_type: dayType, client_session_id: clientSessionId, server_session_id: serverSessionId, started_at: startedAt, finished_at: finishedAt, current_exercise_index: currentExerciseIndex, rest_ends_at: restEndsAt, rest_total_seconds: restTotalSeconds, rest_context: restContext, workout_snapshot: workoutSnapshot, workout_note: workoutNote, exercise_feedback: exerciseFeedback, exercise_notes: exerciseNotes, revision });
        return { changes: 1 };
      }
      if (sql.startsWith("DELETE FROM workout_set_drafts")) drafts.set(values[0], []);
      else if (sql.startsWith("INSERT INTO workout_set_drafts")) drafts.get(values[0]).push({ payload: values[3] });
      else if (sql.startsWith("DELETE FROM workout_pending_operations")) operations.set(values[0], []);
      else if (sql.startsWith("INSERT INTO workout_pending_operations")) {
        const [id, userId, type, status, attempts, nextAttemptAt, sequence, payload] = values;
        operations.get(userId).push({ id, type, status, attempts, next_attempt_at: nextAttemptAt, sequence, payload });
      } else if (sql.startsWith("INSERT OR IGNORE INTO terminal_workout_sessions")) {
        const [userId, clientSessionId, serverSessionId, completedAt, startedAt, finishedAt] = values;
        terminal.set(userId, { client_session_id: clientSessionId, server_session_id: serverSessionId, completed_at: completedAt, started_at: startedAt, finished_at: finishedAt });
      } else if (sql.startsWith("DELETE FROM active_workouts")) active.delete(values[0]);
      else if (!sql.startsWith("UPDATE workout_pending_operations")) throw new Error(`Unexpected mutation: ${sql}`);
      return { changes: 1 };
    },
  };
  const load = () => {
    const module = { exports: {} };
    vm.runInNewContext(output, {
      module, exports: module.exports, Date, JSON, Promise, Set, Map, console,
      require: (name) => {
        if (name === "expo-sqlite") return { openDatabaseAsync: async () => db };
        if (name === "@/services/httpClient") return { HttpError: class HttpError extends Error {} };
        if (name === "@/services/workoutLoggingService") return {};
        throw new Error(`Unexpected import: ${name}`);
      },
    }, { filename });
    return module.exports;
  };
  return { load };
}

function workout() {
  return {
    userId: "user-1", workoutDayId: "day-1", workoutDate: "2026-10-03", dayType: "upper",
    workoutSnapshot: null, clientSessionId: "client-1", serverSessionId: "session-1",
    startedAt: 1_791_065_521_242, currentExerciseIndex: 0, restEndsAt: null,
    restTotalSeconds: 0, restContext: null, revision: 1, operations: [], sets: [],
  };
}

test("an offline finish survives a stale autosave, restart, and terminal cleanup for Health export", async () => {
  const { load } = harness();
  const store = load();
  const initial = workout();
  await store.saveActiveWorkout(initial);
  const result = await store.queueWorkoutCompletion(initial);
  assert.equal(result.status, "queued");
  const finishedAt = result.workout.finishedAt;
  assert.ok(finishedAt > initial.startedAt);

  await store.saveActiveWorkout({ ...initial, revision: result.workout.revision + 1 });
  const afterRestart = load();
  const saved = await afterRestart.loadActiveWorkout(initial.userId);
  assert.equal(saved.finishedAt, finishedAt);
  assert.ok(saved.operations.some((operation) => operation.type === "complete"));
  assert.equal((await afterRestart.healthExportCandidates(initial.userId, initial.startedAt))[0].finishedAt, finishedAt);

  await afterRestart.clearActiveWorkout(initial.userId);
  assert.equal((await afterRestart.healthExportCandidates(initial.userId, initial.startedAt))[0].finishedAt, finishedAt);
});

test("Continue logging intentionally clears the queued finish timestamp", async () => {
  const store = harness().load();
  const initial = workout();
  await store.saveActiveWorkout(initial);
  await store.queueWorkoutCompletion(initial);
  const resumed = await store.continueWorkoutLogging(initial.userId, initial.clientSessionId);
  assert.equal(resumed.status, "active");
  assert.equal(resumed.workout.finishedAt, null);
  assert.ok(resumed.workout.operations.every((operation) => operation.type !== "complete"));
});
