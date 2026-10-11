import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../utils/activeWorkoutStore.native.ts");
const output = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness(service = {}) {
  const active = new Map();
  const drafts = new Map();
  const operations = new Map();
  const terminal = new Map();
  let failStorage = false;
  const db = {
    execAsync: async () => {},
    withTransactionAsync: async (task) => {
      const snapshots = [active, drafts, operations, terminal].map((map) => structuredClone(map));
      try { return await task(); }
      catch (error) {
        [active, drafts, operations, terminal].forEach((map, index) => { map.clear(); for (const [key, value] of snapshots[index]) map.set(key, value); });
        throw error;
      }
    },
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
      if (failStorage && sql.startsWith("INSERT INTO workout_set_drafts")) throw new Error("Storage full");
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
        if (name === "@/services/workoutLoggingService") return service;
        if (name === "./workoutSetEntries") return loadTypescript("utils/workoutSetEntries.ts", { "@react-native-async-storage/async-storage": {} });
        throw new Error(`Unexpected import: ${name}`);
      },
    }, { filename });
    return module.exports;
  };
  return { load, setStorageFailure: (value) => { failStorage = value; } };
}

test("native batch is transactional, preserves rest, and restores markers after storage failure", async () => {
  const fixture = harness();
  const store = fixture.load();
  const initial = { ...workout(), restEndsAt: Date.now() + 120000, sets: [
    { exerciseId: "squat", setNumber: 1, reps: "8", weight: "40", confirmed: false, hasUnsavedInput: true, syncStatus: "synced", syncing: false, logId: null },
    { exerciseId: "squat", setNumber: 2, reps: "8", weight: "40", confirmed: false, syncStatus: "synced", syncing: false, logId: null },
  ] };
  await store.saveActiveWorkout(initial);
  fixture.setStorageFailure(true);
  await assert.rejects(store.saveWorkoutSetEntries(initial, ["squat:1"], "KG"));
  const failed = await fixture.load().loadActiveWorkout(initial.userId);
  assert.equal(failed.sets[0].hasUnsavedInput, true);
  assert.equal(failed.sets[0].confirmed, false);
  assert.equal(failed.operations.length, 0);
  fixture.setStorageFailure(false);
  const result = await store.saveWorkoutSetEntries(initial, ["squat:1"], "KG");
  const restored = await fixture.load().loadActiveWorkout(initial.userId);
  assert.equal(restored.restEndsAt, initial.restEndsAt);
  assert.equal(restored.operations[0].id, result.workout.operations[0].id);
  assert.equal(restored.sets[0].hasUnsavedInput, false);
  assert.equal(restored.sets[1].confirmed, false);
  await store.queueWorkoutCompletion(restored);
  await assert.rejects(store.saveWorkoutSetEntries(initial, ["squat:1"], "KG"));
});

test("native finish waits for batch replay and retains canonical identifiers", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const session = { id: "session-1", status: "in_progress", setLogs: [] };
  let completions = 0;
  const fixture = harness({
    getSession: async () => session,
    logSet: async () => {
      await gate;
      const log = { id: "log-1", exerciseId: "squat", setNumber: 1, reps: 8, weightKg: 40, version: 1 };
      session.setLogs.push(log);
      return log;
    },
    completeSession: async () => { completions += 1; session.status = "completed"; return session; },
  });
  const store = fixture.load();
  const initial = { ...workout(), sets: [
    { exerciseId: "squat", setNumber: 1, reps: "8", weight: "40", confirmed: false, hasUnsavedInput: true, syncStatus: "synced", syncing: false, logId: null },
  ] };
  await store.saveActiveWorkout(initial);
  const saved = await store.saveWorkoutSetEntries(initial, ["squat:1"], "KG");
  const replay = store.replayPendingWorkoutOperations("token", "user-1");
  let queued = false;
  const finish = store.queueWorkoutCompletion(saved.workout).then((result) => { queued = true; return result; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(queued, false);
  release();
  await replay;
  const queuedFinish = await finish;
  assert.equal(queuedFinish.workout.sets[0].logId, "log-1");
  assert.deepEqual(Array.from(queuedFinish.workout.operations, (operation) => operation.type), ["complete"]);
  assert.equal((await store.replayPendingWorkoutOperations("token", "user-1")).completed, true);
  assert.equal(completions, 1);
});

test("native Finish preserves acknowledgements for attempted sets and corrections across restart", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const session = { id: "session-1", status: "in_progress", setLogs: [] };
  let completions = 0;
  let writes = 0;
  const fixture = harness({
    getSession: async () => session,
    logSet: async () => {
      writes += 1;
      const log = { id: "log-1", exerciseId: "squat", setNumber: 1, reps: 8, weightKg: 40, version: 1 };
      session.setLogs.push(log);
      return log;
    },
    updateLoggedSet: async () => {
      await gate;
      writes += 1;
      Object.assign(session.setLogs[0], { reps: 12, weightKg: 60, version: 2 });
      return { ...session.setLogs[0] };
    },
    completeSession: async () => { completions += 1; session.status = "completed"; return session; },
  });
  let store = fixture.load();
  const initial = { ...workout(), sets: [{ exerciseId: "squat", setNumber: 1,
    reps: "12", weight: "60", weightKg: 60, confirmed: true, logId: null, syncing: false, syncStatus: "pending" }],
    operations: [
      { id: "attempted-set", type: "set", status: "pending", attempts: 1, payload: { exerciseId: "squat", setNumber: 1, reps: 8, weightKg: 40 } },
      { id: "correction", type: "update_set", status: "pending", payload: { exerciseId: "squat", setNumber: 1, logId: "",
        reps: 12, weightKg: 60, displayWeight: "60", expectedVersion: 1, previousReps: "8", previousWeight: "40", previousVersion: 1, resolveAfterPending: true } },
    ] };
  await store.saveActiveWorkout(initial);
  const replay = store.replayPendingWorkoutOperations("token", "user-1");
  const finish = store.queueWorkoutCompletion(initial);
  await new Promise((resolve) => setImmediate(resolve));
  release();
  await replay;
  const queued = await finish;
  assert.deepEqual(Array.from(queued.workout.operations, (operation) => operation.type), ["complete"]);
  store = fixture.load();
  const restored = await store.loadActiveWorkout("user-1");
  assert.deepEqual(Array.from(restored.sets[0].acknowledgedOperationIds), ["attempted-set", "correction"]);
  assert.equal((await store.replayPendingWorkoutOperations("token", "user-1")).completed, true);
  assert.equal(writes, 2);
  assert.equal(completions, 1);
});

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
