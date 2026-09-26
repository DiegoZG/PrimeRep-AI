import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

function harness(gateCompletion = null) {
  const items = new Map();
  const storage = {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => { items.set(key, value); },
    removeItem: async (key) => { items.delete(key); },
  };
  const firstLog = { id: "log-1", exerciseId: "squat", setNumber: 1, reps: 8, weightKg: 40, version: 1 };
  const session = { id: "session-1", status: "in_progress", setLogs: [firstLog] };
  const calls = { logSet: [], complete: 0 };
  const service = {
    getSession: async () => ({ ...session, setLogs: [...session.setLogs] }),
    logSet: async (_token, _sessionId, exerciseId, setNumber, reps, weightKg, operationId) => {
      calls.logSet.push(operationId);
      const logged = { id: `log-${setNumber}`, exerciseId, setNumber, reps, weightKg: weightKg ?? null, version: 1 };
      session.setLogs.push(logged);
      return logged;
    },
    completeSession: async () => {
      calls.complete += 1;
      if (gateCompletion) await gateCompletion.promise;
      session.status = "completed";
      return { ...session, setLogs: [...session.setLogs] };
    },
  };
  const filename = path.join(root, "utils/activeWorkoutStore.web.ts");
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const load = () => {
    const module = { exports: {} };
    const fallback = createRequire(filename);
    const mocks = {
      "@react-native-async-storage/async-storage": { __esModule: true, default: storage },
      "@/services/httpClient": { HttpError: class HttpError extends Error {} },
      "@/services/workoutLoggingService": service,
    };
    const require = (name) => mocks[name] ?? fallback(name);
    vm.runInNewContext(output, { module, exports: module.exports, require, console, setTimeout, clearTimeout }, { filename });
    return module.exports;
  };
  const baseWorkout = () => ({
    userId: "user-1", workoutDayId: "day-1", workoutDate: "2026-09-25", dayType: "full_body",
    workoutSnapshot: null, clientSessionId: "client-1", serverSessionId: "session-1", startedAt: Date.now(),
    currentExerciseIndex: 0, restEndsAt: null, restTotalSeconds: 0, restContext: null, revision: 1,
    sets: [{ exerciseId: "squat", setNumber: 1, reps: "8", weight: "40", weightKg: 40, confirmed: true, deleted: false, logId: "log-1", syncStatus: "synced", syncing: false }],
    operations: [],
  });
  return { load, baseWorkout, calls, items };
}

test("a cold-start continuation cancels finish and preserves new sets before the next finish", async () => {
  const fixture = harness();
  const store = fixture.load();
  const initial = fixture.baseWorkout();
  await store.saveActiveWorkout(initial);
  const queued = await store.queueWorkoutCompletion(initial);
  assert.equal(queued.status, "queued");
  assert.equal(queued.workout.operations.at(-1).type, "complete");

  const afterRestart = fixture.load();
  const resumed = await afterRestart.continueWorkoutLogging("user-1", "client-1");
  assert.equal(resumed.status, "active");
  assert.equal(resumed.workout.operations.some((operation) => operation.type === "complete"), false);

  const extra = { ...resumed.workout, revision: resumed.workout.revision + 1,
    sets: [...resumed.workout.sets, { ...resumed.workout.sets[0], setNumber: 2, reps: "6", weightKg: 45, weight: "45", logId: null, syncStatus: "pending", syncing: true }],
    operations: [...resumed.workout.operations, { id: "set-operation-2", type: "set", status: "pending", payload: { exerciseId: "squat", setNumber: 2, reps: 6, weightKg: 45 } }],
  };
  await afterRestart.saveActiveWorkout(extra);
  const requeued = await afterRestart.queueWorkoutCompletion(extra);
  assert.equal(requeued.status, "queued");
  assert.deepEqual(Array.from(requeued.workout.operations, (operation) => operation.type), ["set", "complete"]);
  const result = await afterRestart.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(result.completed, true);
  assert.deepEqual(fixture.calls.logSet, ["set-operation-2"]);
  assert.equal(fixture.calls.complete, 1);
  await afterRestart.clearActiveWorkout("user-1");
  assert.equal((await afterRestart.replayPendingWorkoutOperations("token", "user-1")).workout, null);
  assert.equal(fixture.calls.complete, 1);
});

test("continue waits for an in-flight completion and reports the completed session", async () => {
  const gate = deferred();
  const fixture = harness(gate);
  const store = fixture.load();
  const initial = fixture.baseWorkout();
  await store.saveActiveWorkout(initial);
  await store.queueWorkoutCompletion(initial);
  const replay = store.replayPendingWorkoutOperations("token", "user-1");
  const continued = store.continueWorkoutLogging("user-1", "client-1");
  gate.resolve();
  assert.equal((await replay).completed, true);
  const outcome = await continued;
  assert.equal(outcome.status, "completed");
  assert.equal(outcome.serverSessionId, "session-1");
});

test("legacy set operations queued after finish are reordered before replay", async () => {
  const fixture = harness();
  const initial = fixture.baseWorkout();
  initial.sets.push({ ...initial.sets[0], setNumber: 2, reps: "6", weightKg: 45, weight: "45", logId: null, syncStatus: "pending", syncing: true });
  initial.operations = [
    { id: "complete-old", type: "complete", status: "pending", sequence: 1, payload: {} },
    { id: "set-old", type: "set", status: "pending", sequence: 2, payload: { exerciseId: "squat", setNumber: 2, reps: 6, weightKg: 45 } },
  ];
  fixture.items.set("primerep.web.active-workout.user-1", JSON.stringify(initial));
  const store = fixture.load();
  const restored = await store.loadActiveWorkout("user-1");
  assert.deepEqual(Array.from(restored.operations, (operation) => operation.type), ["set", "complete"]);
  const result = await store.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(result.completed, true);
  assert.deepEqual(fixture.calls.logSet, ["set-old"]);
  assert.equal(fixture.calls.complete, 1);
});

test("Retry Finish cannot recreate a workout after terminal clearing", async () => {
  const fixture = harness();
  const store = fixture.load();
  const initial = fixture.baseWorkout();
  await store.saveActiveWorkout(initial);
  await store.queueWorkoutCompletion(initial);
  assert.equal((await store.replayPendingWorkoutOperations("token", "user-1")).completed, true);
  const cleared = store.clearActiveWorkout("user-1");
  const staleRetry = store.queueWorkoutCompletion(initial, true);
  await cleared;
  const outcome = await staleRetry;
  assert.equal(outcome.status, "terminal");
  assert.equal(outcome.serverSessionId, "session-1");
  assert.equal(await store.loadActiveWorkout("user-1"), null);
  assert.equal(fixture.calls.complete, 1);
});
