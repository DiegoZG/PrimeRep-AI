import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

function harness(gateCompletion = null, options = {}) {
  class HttpError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }
  const items = new Map();
  let failStorage = false;
  const storage = {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => { if (failStorage) throw new Error("Storage full"); items.set(key, value); },
    removeItem: async (key) => { items.delete(key); },
  };
  const firstLog = { id: "log-1", exerciseId: "squat", setNumber: 1, reps: 8, weightKg: 40, version: 1 };
  const session = { id: "session-1", status: "in_progress", setLogs: [firstLog] };
  const calls = { logSet: [], updates: [], getSession: 0, conflicts: 0, complete: 0 };
  const service = {
    getSession: async () => {
      calls.getSession += 1;
      return { ...session, setLogs: session.setLogs.filter((set) => !set.deleted), deletedSetLogs: session.setLogs.filter((set) => set.deleted) };
    },
    logSet: async (_token, _sessionId, exerciseId, setNumber, reps, weightKg, operationId) => {
      calls.logSet.push(operationId);
      if (options.gateSet) await options.gateSet.promise;
      if (options.failSet === setNumber) throw new HttpError("Offline", 503);
      if (session.setLogs.some((set) => set.exerciseId === exerciseId && set.setNumber === setNumber)) {
        calls.conflicts += 1;
        throw new HttpError("That set number already exists for this exercise.", 409);
      }
      const logged = { id: `log-${setNumber}`, exerciseId, setNumber, reps, weightKg: weightKg ?? null, version: 1 };
      session.setLogs.push(logged);
      if (options.loseSetResponse === setNumber) throw new HttpError("Response lost", 503);
      return logged;
    },
    updateLoggedSet: async (_token, _sessionId, logId, reps, weightKg, expectedVersion, operationId) => {
      if (options.gateUpdate) await options.gateUpdate.promise;
      const log = session.setLogs.find((set) => set.id === logId);
      if (calls.updates.includes(operationId)) return log;
      if (log.version !== expectedVersion) throw new HttpError("Version conflict", 409);
      Object.assign(log, { reps, weightKg, version: log.version + 1 });
      calls.updates.push(operationId);
      if (options.loseUpdateResponse) throw new HttpError("Response lost", 503);
      return { ...log };
    },
    deleteLoggedSet: async (_token, _sessionId, logId) => { session.setLogs.find((set) => set.id === logId).deleted = true; },
    restoreLoggedSet: async (_token, _sessionId, logId) => {
      const log = session.setLogs.find((set) => set.id === logId);
      log.deleted = false;
      return { ...log };
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
      "@/services/httpClient": { HttpError },
      "@/services/workoutLoggingService": service,
      "./workoutSetEntries": loadTypescript("utils/workoutSetEntries.ts", { "@react-native-async-storage/async-storage": storage }),
    };
    const require = (name) => mocks[name] ?? fallback(name);
    const Clock = class extends Date { static now() { return Date.now() + (options.clockOffset ?? 0); } };
    vm.runInNewContext(output, { module, exports: module.exports, require, console, Date: Clock, setTimeout, clearTimeout }, { filename });
    return module.exports;
  };
  const baseWorkout = () => ({
    userId: "user-1", workoutDayId: "day-1", workoutDate: "2026-09-25", dayType: "full_body",
    workoutSnapshot: null, clientSessionId: "client-1", serverSessionId: "session-1", startedAt: Date.now(),
    currentExerciseIndex: 0, restEndsAt: null, restTotalSeconds: 0, restContext: null, revision: 1,
    sets: [{ exerciseId: "squat", setNumber: 1, reps: "8", weight: "40", weightKg: 40, confirmed: true, deleted: false, logId: "log-1", syncStatus: "synced", syncing: false }],
    operations: [],
  });
  return { load, baseWorkout, calls, items, session, setStorageFailure: (value) => { failStorage = value; } };
}

function enteredRow(setNumber, extra = {}) {
  return { exerciseId: "squat", setNumber, reps: "8", weight: "40", confirmed: false,
    syncing: false, syncStatus: "synced", logId: null, hasUnsavedInput: true, ...extra };
}

test("durable bulk save survives restart and completes exactly once without saving suggestions", async () => {
  const fixture = harness();
  const store = fixture.load();
  const initial = { ...fixture.baseWorkout(), restEndsAt: Date.now() + 120000,
    sets: [...fixture.baseWorkout().sets, enteredRow(2), enteredRow(3), enteredRow(4, { hasUnsavedInput: undefined })] };
  await store.saveActiveWorkout(initial);
  const saved = await store.saveWorkoutSetEntries(initial, ["squat:2", "squat:3"], "LB");
  const afterRestart = fixture.load();
  const restored = await afterRestart.loadActiveWorkout("user-1");
  assert.equal(restored.restEndsAt, initial.restEndsAt);
  assert.equal(restored.sets[3].confirmed, false);
  assert.equal(restored.operations.length, 2);
  assert.equal(restored.sets[1].weightKg, 18.14);
  await afterRestart.queueWorkoutCompletion(restored);
  assert.equal((await afterRestart.replayPendingWorkoutOperations("token", "user-1")).completed, true);
  await afterRestart.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(fixture.calls.complete, 1);
  assert.equal(new Set(fixture.calls.logSet).size, 2);
  assert.equal(saved.workout.sets[1].hasUnsavedInput, false);
});

test("bulk storage failure preserves edited drafts and allows a clean retry", async () => {
  const fixture = harness();
  const store = fixture.load();
  const initial = { ...fixture.baseWorkout(), sets: [enteredRow(2)] };
  await store.saveActiveWorkout(initial);
  fixture.setStorageFailure(true);
  await assert.rejects(store.saveWorkoutSetEntries(initial, ["squat:2"], "KG"));
  assert.equal((await store.loadActiveWorkout("user-1")).sets[0].hasUnsavedInput, true);
  assert.equal(initial.sets[0].confirmed, false);
  fixture.setStorageFailure(false);
  assert.equal((await store.saveWorkoutSetEntries(initial, ["squat:2"], "KG")).savedCount, 1);
});

test("partial network failure retains stable operation ID and blocks completion until retry", async () => {
  const options = { failSet: 3 };
  const fixture = harness(null, options);
  const store = fixture.load();
  const initial = { ...fixture.baseWorkout(), sets: [enteredRow(2), enteredRow(3)] };
  await store.saveActiveWorkout(initial);
  const saved = await store.saveWorkoutSetEntries(initial, ["squat:2", "squat:3"], "KG");
  const failedId = saved.workout.operations[1].id;
  await store.queueWorkoutCompletion(saved.workout);
  const partial = await store.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(partial.completed, false);
  assert.equal(fixture.calls.complete, 0);
  options.failSet = null;
  options.clockOffset = 120000;
  await store.retryFailedWorkoutOperations("user-1");
  await store.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(fixture.calls.complete, 1);
  assert.equal(fixture.calls.logSet.filter((id) => id === failedId).length, 2);
  assert.equal(fixture.session.setLogs.filter((set) => set.setNumber === 3).length, 1);
});

test("bulk save waits for replay, rebases log IDs, and never touches another account", async () => {
  const gateSet = deferred();
  const fixture = harness(null, { gateSet });
  const store = fixture.load();
  const initial = { ...fixture.baseWorkout(), sets: [enteredRow(2)] };
  await store.saveActiveWorkout(initial);
  const saved = await store.saveWorkoutSetEntries(initial, ["squat:2"], "KG");
  const replay = store.replayPendingWorkoutOperations("token", "user-1");
  const next = { ...saved.workout, sets: [...saved.workout.sets, enteredRow(3)] };
  const batch = store.saveWorkoutSetEntries(next, ["squat:3"], "KG");
  gateSet.resolve();
  await replay;
  const result = await batch;
  assert.equal(result.workout.sets[0].logId, "log-2");
  assert.equal(result.workout.operations.length, 1);
  assert.equal(result.workout.operations[0].payload.setNumber, 3);
  assert.equal(await store.loadActiveWorkout("user-2"), null);
});

test("finish waits for an in-flight batch replay and completes the latest canonical sets", async () => {
  const gateSet = deferred();
  const fixture = harness(null, { gateSet });
  const store = fixture.load();
  const initial = { ...fixture.baseWorkout(), sets: [enteredRow(2)] };
  await store.saveActiveWorkout(initial);
  const saved = await store.saveWorkoutSetEntries(initial, ["squat:2"], "KG");
  const replay = store.replayPendingWorkoutOperations("token", "user-1");
  let queued = false;
  const finish = store.queueWorkoutCompletion(saved.workout).then((result) => { queued = true; return result; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(queued, false);
  gateSet.resolve();
  await replay;
  const completion = await finish;
  assert.equal(completion.workout.sets[0].logId, "log-2");
  assert.deepEqual(Array.from(completion.workout.operations, (operation) => operation.type), ["complete"]);
  const outcome = await store.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(outcome.completed, true);
  assert.equal(fixture.session.status, "completed");
  assert.equal(fixture.calls.complete, 1);
});

test("editing after a lost set or correction response preserves the request and replays the new values once", async () => {
  const options = { loseSetResponse: 2 };
  const fixture = harness(null, options);
  let store = fixture.load();
  const initial = { ...fixture.baseWorkout(), sets: [enteredRow(2)] };
  await store.saveActiveWorkout(initial);
  await store.saveWorkoutSetEntries(initial, ["squat:2"], "KG");
  const lost = await store.replayPendingWorkoutOperations("token", "user-1");
  const edit = { ...lost.workout, sets: lost.workout.sets.map((set) => ({ ...set,
    editing: true, hasUnsavedInput: true, editDraft: { reps: "12", weight: "60" } })) };
  const saved = await store.saveWorkoutSetEntries(edit, ["squat:2"], "KG");
  assert.equal(saved.workout.operations[0].payload.reps, 8);
  options.clockOffset = 120000;
  options.loseUpdateResponse = true;
  const correctionLost = await store.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(correctionLost.workout.operations[0].payload.resolveAfterPending, undefined);
  const secondEdit = { ...correctionLost.workout, sets: correctionLost.workout.sets.map((set) => ({ ...set,
    editing: true, hasUnsavedInput: true, editDraft: { reps: "14", weight: "70" } })) };
  const secondSaved = await store.saveWorkoutSetEntries(secondEdit, ["squat:2"], "KG");
  options.clockOffset = 240000;
  options.loseUpdateResponse = false;
  store = fixture.load();
  await store.queueWorkoutCompletion(secondSaved.workout);
  const completed = await store.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(completed.completed, true);
  assert.equal(fixture.session.setLogs.filter((set) => set.setNumber === 2).length, 1);
  assert.equal(fixture.session.setLogs.find((set) => set.setNumber === 2).reps, 14);
  assert.equal(fixture.session.setLogs.find((set) => set.setNumber === 2).weightKg, 70);
  assert.equal(fixture.calls.logSet.length, 1);
  assert.equal(fixture.calls.updates.length, 2);
  assert.equal(fixture.calls.complete, 1);
});

test("Finish excludes acknowledged attempts after an in-flight correction changes the final values", async () => {
  const options = { loseSetResponse: 2 };
  const fixture = harness(null, options);
  let store = fixture.load();
  const initial = { ...fixture.baseWorkout(), sets: [enteredRow(2)] };
  await store.saveActiveWorkout(initial);
  await store.saveWorkoutSetEntries(initial, ["squat:2"], "KG");
  const lost = await store.replayPendingWorkoutOperations("token", "user-1");
  const edit = { ...lost.workout, sets: lost.workout.sets.map((set) => ({ ...set,
    editing: true, hasUnsavedInput: true, editDraft: { reps: "12", weight: "60" } })) };
  const saved = await store.saveWorkoutSetEntries(edit, ["squat:2"], "KG");
  options.loseSetResponse = null;
  options.clockOffset = 120000;
  options.gateUpdate = deferred();
  const replay = store.replayPendingWorkoutOperations("token", "user-1");
  const finish = store.queueWorkoutCompletion(saved.workout);
  await new Promise((resolve) => setImmediate(resolve));
  options.gateUpdate.resolve();
  await replay;
  const queued = await finish;
  assert.deepEqual(Array.from(queued.workout.operations, (operation) => operation.type), ["complete"]);
  assert.equal(queued.workout.sets[0].reps, "12");
  assert.deepEqual(Array.from(queued.workout.sets[0].acknowledgedOperationIds), Array.from(saved.workout.operations, (operation) => operation.id));
  store = fixture.load();
  const completed = await store.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(completed.completed, true);
  assert.equal(fixture.calls.complete, 1);
  assert.equal(fixture.calls.logSet.length, 1);
  assert.equal(fixture.calls.updates.length, 1);
});

test("matching values do not discard an unacknowledged correction", async () => {
  const fixture = harness();
  const store = fixture.load();
  const initial = fixture.baseWorkout();
  await store.saveActiveWorkout(initial);
  const correction = { id: "unacknowledged", type: "update_set", status: "pending", payload: {
    logId: "log-1", exerciseId: "squat", setNumber: 1, reps: 8, weightKg: 40,
    displayWeight: "40", expectedVersion: 0, previousReps: "8", previousWeight: "40", previousVersion: 0,
  } };
  const queued = await store.queueWorkoutCompletion({ ...initial, operations: [correction] });
  assert.equal(queued.workout.operations[0].id, correction.id);
});

test("removing and undoing a locally saved unsynced set resolves its canonical identifier in order", async () => {
  const fixture = harness();
  const store = fixture.load();
  const initial = { ...fixture.baseWorkout(), sets: [enteredRow(2)] };
  await store.saveActiveWorkout(initial);
  const saved = await store.saveWorkoutSetEntries(initial, ["squat:2"], "KG");
  const restored = { ...saved.workout, revision: saved.workout.revision + 1, operations: [...saved.workout.operations,
    { id: "delete", type: "delete_set", status: "pending", payload: { logId: "", exerciseId: "squat", setNumber: 2, resolveAfterPending: true } },
    { id: "restore", type: "restore_set", status: "pending", payload: { logId: "", exerciseId: "squat", setNumber: 2, resolveAfterPending: true } },
  ] };
  await store.saveActiveWorkout(restored);
  const result = await store.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(result.workout.operations.length, 0);
  assert.equal(result.workout.sets[0].deleted, false);
  assert.equal(result.workout.sets[0].logId, "log-2");
  assert.equal(fixture.session.setLogs.find((set) => set.setNumber === 2).deleted, false);
  assert.equal(fixture.calls.logSet.length, 1);
});

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

test("a stale web autosave cannot erase a queued offline finish", async () => {
  const fixture = harness();
  const store = fixture.load();
  const initial = fixture.baseWorkout();
  await store.saveActiveWorkout(initial);
  const queued = await store.queueWorkoutCompletion(initial);
  const finishedAt = queued.workout.finishedAt;
  await store.saveActiveWorkout({ ...initial, revision: queued.workout.revision + 1 });

  const afterRestart = fixture.load();
  const saved = await afterRestart.loadActiveWorkout(initial.userId);
  assert.equal(saved.finishedAt, finishedAt);
  assert.ok(saved.operations.some((operation) => operation.type === "complete"));
  assert.equal((await afterRestart.healthExportCandidates(initial.userId, 0))[0].finishedAt, finishedAt);
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

test("web terminal workout history stays capped at 100 records", async () => {
  const fixture = harness();
  const key = "primerep.web.terminal-workouts.user-1";
  const terminal = Array.from({ length: 101 }, (_, index) => ({
    clientSessionId: `client-${index}`,
    serverSessionId: `session-${index}`,
    startedAt: 1,
    finishedAt: 2,
  }));
  fixture.items.set(key, JSON.stringify(terminal));
  const store = fixture.load();
  const candidates = await store.healthExportCandidates("user-1", 0);
  assert.equal(candidates.length, 100);
  assert.equal(candidates[0].sessionId, "session-1");

  const workout = { ...fixture.baseWorkout(), clientSessionId: "client-101", serverSessionId: "session-101" };
  await store.saveActiveWorkout(workout);
  await store.clearActiveWorkout("user-1");
  const saved = JSON.parse(fixture.items.get(key));
  assert.equal(saved.length, 100);
  assert.equal(saved[0].clientSessionId, "client-2");
  assert.equal(saved.at(-1).clientSessionId, "client-101");
});

test("offline finish reconciles saved set slots in one fetch without a conflict burst", async () => {
  const fixture = harness();
  const store = fixture.load();
  const workout = fixture.baseWorkout();
  for (let setNumber = 2; setNumber <= 10; setNumber += 1) {
    fixture.session.setLogs.push({ id: `log-${setNumber}`, exerciseId: "squat", setNumber, reps: 8, weightKg: 40, version: 1 });
    workout.sets.push({ ...workout.sets[0], setNumber, logId: null, syncStatus: "pending" });
    workout.operations.push({ id: `queued-${setNumber}`, type: "set", status: "pending", payload: { exerciseId: "squat", setNumber, reps: 8, weightKg: 40 } });
  }
  await store.saveActiveWorkout(workout);
  await store.queueWorkoutCompletion(workout);

  const result = await store.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(result.completed, true);
  assert.equal(fixture.calls.logSet.length, 0);
  assert.equal(fixture.calls.conflicts, 0);
  assert.equal(fixture.calls.getSession, 2);
  assert.equal(result.workout.sets.filter((set) => set.confirmed && set.logId).length, 10);
});

test("duplicate queued operations for a new slot post only once", async () => {
  const fixture = harness();
  const store = fixture.load();
  const workout = fixture.baseWorkout();
  workout.sets.push({ ...workout.sets[0], setNumber: 2, logId: null, syncStatus: "pending" });
  workout.operations.push(
    { id: "queued-first", type: "set", status: "pending", payload: { exerciseId: "squat", setNumber: 2, reps: 8, weightKg: 40 } },
    { id: "queued-second", type: "set", status: "pending", payload: { exerciseId: "squat", setNumber: 2, reps: 8, weightKg: 40 } }
  );
  await store.saveActiveWorkout(workout);

  const result = await store.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(result.workout.operations.length, 0);
  assert.deepEqual(fixture.calls.logSet, ["queued-first"]);
  assert.equal(fixture.calls.conflicts, 0);
  assert.equal(result.workout.sets.find((set) => set.setNumber === 2).logId, "log-2");
});

test("one late duplicate POST reconciles and is not retried", async () => {
  const fixture = harness();
  const store = fixture.load();
  const workout = fixture.baseWorkout();
  workout.sets.push({ ...workout.sets[0], setNumber: 2, logId: null, syncStatus: "pending" });
  workout.operations.push({ id: "queued-late", type: "set", status: "pending", payload: { exerciseId: "squat", setNumber: 2, reps: 8, weightKg: 40 } });
  fixture.session.setLogs.push({ id: "log-2", exerciseId: "squat", setNumber: 2, reps: 8, weightKg: 40, version: 1 });
  await store.saveActiveWorkout(workout);

  const first = await store.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(first.workout.operations.length, 0);
  assert.equal(first.workout.sets.find((set) => set.setNumber === 2).logId, "log-2");
  await store.replayPendingWorkoutOperations("token", "user-1");
  assert.deepEqual(fixture.calls.logSet, ["queued-late"]);
  assert.equal(fixture.calls.conflicts, 1);
  assert.equal(fixture.calls.getSession, 1);
});

test("a different saved value remains a failed conflict without repeated POSTs", async () => {
  const fixture = harness();
  const store = fixture.load();
  const workout = fixture.baseWorkout();
  workout.sets.push({ ...workout.sets[0], setNumber: 2, reps: "10", logId: null, syncStatus: "pending" });
  workout.operations.push({ id: "queued-different", type: "set", status: "pending", payload: { exerciseId: "squat", setNumber: 2, reps: 10, weightKg: 40 } });
  fixture.session.setLogs.push({ id: "log-2", exerciseId: "squat", setNumber: 2, reps: 8, weightKg: 40, version: 1 });
  await store.saveActiveWorkout(workout);

  const first = await store.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(first.workout.operations[0].status, "failed");
  assert.equal(fixture.calls.logSet.length, 1);
  assert.equal(fixture.calls.conflicts, 1);
  await store.replayPendingWorkoutOperations("token", "user-1");
  assert.equal(fixture.calls.logSet.length, 1);
});
