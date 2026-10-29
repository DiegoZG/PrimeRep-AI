import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

class HttpError extends Error { constructor(message, status) { super(message); this.status = status; } }
const copy = (value) => JSON.parse(JSON.stringify(value));
const item = (id) => ({ exercise: { id, name: id, exerciseType: "strength", primaryMuscle: "chest", secondaryMuscles: [], requiredEquipmentIds: [] }, prescription: { sets: 1, reps: "6-10", restSeconds: 120 } });
const day = (ids = ["a", "b", "c"]) => ({ workoutDayId: "day", date: "2026-10-23", title: "Workout", splitKey: "upper_lower", dayType: "upper", durationMinutes: 40, slotIndex: 0, blocks: [{ blockType: "main", items: ids.map(item) }] });
const api = (workout) => ({ ...workout, exerciseBlocks: workout.blocks });
const server = (ids = ["a", "b", "c"], revision = 0) => ({ id: "server", arrangementRevision: revision, effectiveWorkout: api(day(ids)), workoutSnapshot: api(day()), status: "in_progress", setLogs: [], deletedSetLogs: [] });
const set = (id = "a", extra = {}) => ({ exerciseId: id, setNumber: 1, reps: "8", weight: "20", confirmed: false, syncing: false, syncStatus: "synced", logId: null, ...extra });
const order = (extra = {}) => ({ id: "order-1", type: "order", status: "pending", payload: { exerciseIds: ["c", "a", "b"], expectedRevision: 0, applyRevisedTargets: false, ...extra } });
const draft = (extra = {}) => ({ userId: "user", workoutDayId: "day", workoutDate: "2026-10-23", dayType: "upper", workoutSnapshot: day(), effectiveWorkout: day(), arrangementRevision: 0, clientSessionId: "client", serverSessionId: "server", startedAt: 100, currentExerciseIndex: 1, currentExerciseId: "b", restEndsAt: 10000, restTotalSeconds: 120, restContext: { exerciseId: "a", exerciseIndex: 0, isLastSetOfExercise: false }, revision: 1, sets: [set("a"), set("b"), set("c")], operations: [], ...extra });
const flatIds = (workout) => Array.from(workout.blocks.flatMap((block) => block.items.map((entry) => entry.exercise.id)));
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
async function withoutNetwork(promise) {
  let timeout;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Local save waited for the network")), 1000); })]);
  } finally { clearTimeout(timeout); }
}

function storageHarness(platform, handlers = {}) {
  const memory = new Map();
  const sql = { row: null, sets: [], operations: [], terminal: [] };
  let pausedRead = null;
  const waitForRead = async (key) => {
    if (!pausedRead?.matches(key)) return;
    const paused = pausedRead; pausedRead = null; paused.entered.resolve(); await paused.release.promise;
  };
  const pauseRead = (matches) => {
    pausedRead = { matches, entered: deferred(), release: deferred() };
    return { entered: pausedRead.entered.promise, release: pausedRead.release.resolve };
  };
  const db = {
    execAsync: async () => {}, withTransactionAsync: async (action) => action(),
    getFirstAsync: async (query, params = []) => {
      if (query.includes("FROM active_workouts")) { const value = sql.row && copy(sql.row); await waitForRead("active"); return value; }
      if (query.includes("terminal_workout_sessions")) return sql.terminal.find((entry) => entry.client_session_id === params[1] || (params[2] != null && entry.server_session_id === params[2])) ?? null;
      if (query.includes("workout_pending_operations")) return sql.operations.find((operation) => operation.type === "complete") ?? null;
      return null;
    },
    getAllAsync: async (query) => query.includes("workout_set_drafts") ? copy(sql.sets) : query.includes("workout_pending_operations") ? copy(sql.operations) : [],
    runAsync: async (query, params) => {
      if (query.includes("INSERT INTO active_workouts")) {
        const columns = query.match(/active_workouts \(([^)]+)\)/)[1].split(",").map((column) => column.trim());
        const next = Object.fromEntries(columns.map((column, index) => [column, params[index]]));
        if (sql.row && sql.row.revision >= next.revision) return { changes: 0 };
        sql.row = next; return { changes: 1 };
      }
      if (query.startsWith("INSERT OR IGNORE INTO terminal_workout_sessions")) sql.terminal.push({ client_session_id: params[1], server_session_id: params[2] });
      if (query.startsWith("DELETE FROM active_workouts")) sql.row = null;
      if (query.startsWith("DELETE FROM workout_set_drafts")) sql.sets = [];
      if (query.startsWith("DELETE FROM workout_pending_operations")) sql.operations = [];
      if (query.startsWith("INSERT INTO workout_set_drafts")) sql.sets.push({ payload: params[3] });
      if (query.startsWith("INSERT INTO workout_pending_operations")) sql.operations.push({ id: params[0], type: params[2], status: params[3], attempts: params[4], next_attempt_at: params[5], sequence: params[6], payload: params[7] });
      return { changes: 1 };
    },
  };
  const calls = [];
  let canonical = server();
  const defaults = { getSession: async () => canonical, createSession: async () => server(),
    updateExerciseOrder: async (_token, _session, ids) => (canonical = server(ids, 1)),
    replaceSessionExercise: async () => server(["d", "b", "c"], 1),
    logSet: async (_token, _session, exerciseId, setNumber, reps, weightKg) => ({ id: "log", exerciseId, setNumber, reps, weightKg: weightKg ?? null, version: 1 }),
    updateLoggedSet: async (_token, _session, id, reps, weightKg, version) => ({ id, exerciseId: "a", setNumber: 1, reps, weightKg, version: version + 1 }),
    completeSession: async () => ({ ...server(), status: "completed" }) };
  const service = Object.fromEntries(Object.keys(defaults).map((name) => [name, async (...args) => { calls.push({ name, args }); return (handlers[name] ?? defaults[name])(...args); }]));
  const mocks = { "expo-sqlite": { openDatabaseAsync: async () => db },
    "@react-native-async-storage/async-storage": { getItem: async (key) => { const value = memory.get(key) ?? null; await waitForRead(key.includes("web.active-workout") ? "active" : key); return value; }, setItem: async (key, value) => memory.set(key, value), removeItem: async (key) => memory.delete(key), getAllKeys: async () => [...memory.keys()], multiRemove: async (keys) => keys.forEach((key) => memory.delete(key)) },
    "@/services/httpClient": { HttpError, requestJson: async () => { throw new Error("Unexpected network request"); } },
    "./httpClient": { HttpError, requestJson: async () => {} },
    "@/services/workoutLoggingService": service };
  const reload = () => loadTypescript(`utils/activeWorkoutStore.${platform}.ts`, mocks);
  const store = reload();
  const reloadPrestart = () => loadTypescript("utils/preWorkoutOrderStore.ts", { ...mocks, "@/utils/activeWorkoutStore": store });
  return { store, reload, calls, getCanonical: () => copy(canonical), prestart: reloadPrestart(), reloadPrestart, pauseRead };
}

for (const platform of ["native", "web"]) {
  test(`${platform}: expired authentication preserves the queued set for automatic retry`, async (context) => {
    let expired = true;
    const harness = storageHarness(platform, { logSet: async (_token, _session, exerciseId, setNumber, reps, weightKg) => {
      if (expired) throw new HttpError("Access token expired", 401);
      return { id: "log-a", exerciseId, setNumber, reps, weightKg, version: 1 };
    } });
    const initial = draft({ sets: [set("a", { hasUnsavedInput: true }), set("b"), set("c")] });
    await harness.store.saveActiveWorkout(initial);
    const saved = await harness.store.saveWorkoutSetEntries(initial, ["a:1"], "KG");
    const result = await harness.store.replayPendingWorkoutOperations("expired-token", "user");
    assert.equal(result.authenticationRequired, true);
    assert.equal(result.workout.sets[0].confirmed, true);
    assert.equal(result.workout.operations[0].status, "pending");
    assert.equal(result.workout.operations[0].id, saved.workout.operations[0].id);
    expired = false;
    const retryTime = result.workout.operations[0].nextAttemptAt + 1;
    context.mock.method(Date, "now", () => retryTime);
    await harness.store.replayPendingWorkoutOperations("new-token", "user");
    assert.equal((await harness.store.loadActiveWorkout("user")).operations.length, 0);
  });

  test(`${platform}: local set commits survive restart while a prior cloud request is stalled`, async () => {
    const entered = deferred(), network = deferred();
    const harness = storageHarness(platform, { logSet: async (_token, _session, exerciseId, setNumber, reps, weightKg) => {
      if (exerciseId === "a") { entered.resolve(); await network.promise; }
      return { id: `log-${exerciseId}`, exerciseId, setNumber, reps, weightKg, version: 1 };
    } });
    const initial = draft({ sets: [set("a", { hasUnsavedInput: true }), set("b", { hasUnsavedInput: true }), set("c")] });
    await harness.store.saveActiveWorkout(initial);
    const first = await harness.store.saveWorkoutSetEntries(initial, ["a:1"], "KG");
    const replay = harness.store.replayPendingWorkoutOperations("token", "user");
    await entered.promise;
    try {
      const second = await withoutNetwork(harness.store.saveWorkoutSetEntries(first.workout, ["b:1"], "KG"));
      assert.equal(second.workout.sets.find((row) => row.exerciseId === "b").confirmed, true);
      const restored = await harness.reload().loadActiveWorkout("user");
      assert.equal(restored.sets.find((row) => row.exerciseId === "b").confirmed, true);
      assert.equal(restored.operations.filter((operation) => operation.type === "set").length, 2);
      assert.equal(harness.calls.filter((call) => call.name === "logSet").length, 1);
    } finally { network.resolve(); }
    const result = await replay;
    assert.equal(result.workout.sets.find((row) => row.exerciseId === "b").confirmed, true);
    assert.equal(result.workout.operations.filter((operation) => operation.type === "set").length, 1);
    await harness.store.replayPendingWorkoutOperations("token", "user");
    assert.equal((await harness.store.loadActiveWorkout("user")).operations.length, 0);
    assert.equal(harness.calls.filter((call) => call.name === "logSet").length, 2);
  });

  test(`${platform}: editing a set during its upload commits locally and syncs the correction afterward`, async () => {
    const entered = deferred(), network = deferred();
    const harness = storageHarness(platform, { logSet: async (_token, _session, exerciseId, setNumber, reps, weightKg) => {
      entered.resolve(); await network.promise;
      return { id: "log-a", exerciseId, setNumber, reps, weightKg, version: 1 };
    } });
    const initial = draft({ sets: [set("a", { hasUnsavedInput: true }), set("b"), set("c")] });
    await harness.store.saveActiveWorkout(initial);
    const first = await harness.store.saveWorkoutSetEntries(initial, ["a:1"], "KG");
    const replay = harness.store.replayPendingWorkoutOperations("token", "user");
    await entered.promise;
    try {
      const edited = { ...first.workout, sets: first.workout.sets.map((row) => row.exerciseId === "a"
        ? { ...row, editing: true, hasUnsavedInput: true, editDraft: { weight: "35", reps: "12" } } : row) };
      const result = await withoutNetwork(harness.store.saveWorkoutSetEntries(edited, ["a:1"], "KG"));
      assert.equal(result.workout.sets[0].reps, "12");
      assert.equal(result.workout.operations.length, 2);
    } finally { network.resolve(); }
    await replay;
    const pending = await harness.store.loadActiveWorkout("user");
    assert.equal(pending.sets[0].reps, "12"); assert.equal(pending.sets[0].weight, "35");
    assert.equal(pending.operations[0].type, "update_set");
    await harness.store.replayPendingWorkoutOperations("token", "user");
    const saved = await harness.reload().loadActiveWorkout("user");
    assert.equal(saved.sets[0].reps, "12"); assert.equal(saved.sets[0].version, 2);
    assert.equal(saved.operations.length, 0);
  });

  test(`${platform}: legacy draft migrates stable current/rest IDs without assuming backend capability`, async () => {
    const { store } = storageHarness(platform);
    await store.saveActiveWorkout(draft({ effectiveWorkout: undefined, arrangementRevision: undefined, currentExerciseId: undefined, restContext: { exerciseIndex: 2, isLastSetOfExercise: true } }));
    const restored = await store.loadActiveWorkout("user");
    assert.equal(restored.currentExerciseId, "b"); assert.equal(restored.restContext.exerciseId, "c");
    assert.equal(restored.arrangementRevision, undefined); assert.deepEqual(flatIds(restored.effectiveWorkout), ["a", "b", "c"]);
  });

  test(`${platform}: offline order survives restart and auto syncs unchanged targets before optional review`, async () => {
    const harness = storageHarness(platform);
    const offline = draft({ effectiveWorkout: day(["c", "a", "b"]), operations: [order({ requiresReview: true }),
      { id: "set", type: "set", status: "pending", payload: { exerciseId: "a", setNumber: 1, reps: 8, weightKg: 20 } }], sets: [set("a", { confirmed: true, syncStatus: "pending" }), set("b"), set("c")] });
    await harness.store.saveActiveWorkout(offline);
    const restarted = harness.reload();
    assert.deepEqual(flatIds((await restarted.loadActiveWorkout("user")).effectiveWorkout), ["c", "a", "b"]);
    const result = await restarted.replayPendingWorkoutOperations("token", "user");
    assert.equal(result.completionBlocked, false);
    assert.equal(harness.calls.filter((call) => call.name === "logSet").length, 1);
    assert.equal(harness.calls.filter((call) => call.name === "updateExerciseOrder").length, 1);
    assert.equal(result.workout.operations.length, 0);
    assert.deepEqual(Array.from(result.workout.targetReviewExerciseIds), ["c", "a", "b"]);
    const restoredAfterSync = await harness.reload().loadActiveWorkout("user");
    assert.deepEqual(Array.from(restoredAfterSync.targetReviewExerciseIds), ["c", "a", "b"]);
    assert.deepEqual(flatIds(result.workout.effectiveWorkout), ["c", "a", "b"]);
    assert.deepEqual(harness.getCanonical().effectiveWorkout.exerciseBlocks.flatMap((block) => block.items.map((entry) => entry.exercise.id)), ["c", "a", "b"]);
    assert.deepEqual(flatIds(result.workout.workoutSnapshot), ["a", "b", "c"]);
  });

  test(`${platform}: creating offline session preserves its pending local order and original snapshot`, async () => {
    const { store } = storageHarness(platform);
    await store.saveActiveWorkout(draft({ serverSessionId: null, effectiveWorkout: day(["c", "a", "b"]), operations: [
      { id: "create", type: "create", status: "pending", payload: { workoutDayId: "day", workoutDate: "2026-10-23", dayType: "upper", clientSessionId: "client" } }, order({ requiresReview: true })] }));
    const result = await store.replayPendingWorkoutOperations("token", "user");
    assert.equal(result.workout.serverSessionId, "server");
    assert.deepEqual(flatIds(result.workout.effectiveWorkout), ["c", "a", "b"]);
    assert.deepEqual(flatIds(result.workout.workoutSnapshot), ["a", "b", "c"]);
  });

  test(`${platform}: order acknowledgement preserves edits, current exercise and rest made during request`, async () => {
    const request = deferred(), entered = deferred();
    const { store } = storageHarness(platform, { updateExerciseOrder: async () => { entered.resolve(); return request.promise; } });
    await store.saveActiveWorkout(draft({ operations: [order()], effectiveWorkout: day(["c", "a", "b"]) }));
    const replay = store.replayPendingWorkoutOperations("token", "user");
    await entered.promise;
    const current = await store.loadActiveWorkout("user");
    await store.saveActiveWorkout({ ...current, revision: current.revision + 1, currentExerciseId: "c", currentExerciseIndex: 0,
      restEndsAt: 88888, sets: current.sets.map((row) => row.exerciseId === "b" ? { ...row, reps: "19", weight: "77", hasUnsavedInput: true } : row) });
    request.resolve(server(["c", "a", "b"], 1));
    await replay;
    const persisted = await store.loadActiveWorkout("user");
    assert.equal(persisted.arrangementRevision, 1); assert.equal(persisted.currentExerciseId, "c");
    assert.equal(persisted.restContext.exerciseId, "a"); assert.equal(persisted.restEndsAt, 88888);
    assert.equal(persisted.sets.find((row) => row.exerciseId === "b").reps, "19");
    assert.equal(persisted.sets.find((row) => row.exerciseId === "b").weight, "77");
    assert.equal(persisted.operations.length, 0);
  });

  test(`${platform}: background order sync keeps a newly removed blank extra set hidden`, async () => {
    const request = deferred(), entered = deferred();
    const { store } = storageHarness(platform, { updateExerciseOrder: async () => { entered.resolve(); return request.promise; } });
    await store.saveActiveWorkout(draft({ operations: [order()], effectiveWorkout: day(["c", "a", "b"]),
      sets: [set("a"), set("b"), set("c"), set("a", { setNumber: 2, reps: "", weight: "", isAdded: true })] }));
    const replay = store.replayPendingWorkoutOperations("token", "user");
    await entered.promise;
    const current = await store.loadActiveWorkout("user");
    await store.saveActiveWorkout({ ...current, revision: current.revision + 1,
      sets: current.sets.map((row) => row.exerciseId === "a" && row.setNumber === 2 ? { ...row, deleted: true } : row) });
    request.resolve(server(["c", "a", "b"], 1));
    await replay;
    const restored = await store.loadActiveWorkout("user");
    assert.equal(restored.sets.find((row) => row.exerciseId === "a" && row.setNumber === 2).deleted, true);
    assert.equal(restored.operations.length, 0);
  });

  test(`${platform}: revision conflict fetches server order but retains failed intent for explicit review`, async () => {
    const harness = storageHarness(platform, { updateExerciseOrder: async () => { throw new HttpError("Changed", 409); }, getSession: async () => server(["b", "c", "a"], 4) });
    await harness.store.saveActiveWorkout(draft({ operations: [order()], effectiveWorkout: day(["c", "a", "b"]) }));
    const result = await harness.store.replayPendingWorkoutOperations("token", "user");
    assert.equal(result.workout.arrangementRevision, 4);
    assert.deepEqual(flatIds(result.workout.effectiveWorkout), ["b", "c", "a"]);
    assert.equal(result.workout.operations[0].payload.conflict, true);
    assert.deepEqual(Array.from(result.workout.operations[0].payload.exerciseIds), ["c", "a", "b"]);
    await harness.store.retryFailedWorkoutOperations("user");
    await harness.store.replayPendingWorkoutOperations("token", "user");
    assert.equal(harness.calls.filter((call) => call.name === "updateExerciseOrder").length, 1);
  });

  test(`${platform}: timeout and restart replay exactly the frozen revision and operation ID`, async () => {
    let attempts = 0;
    const harness = storageHarness(platform, { updateExerciseOrder: async (_token, _id, ids) => {
      if (++attempts === 1) throw new HttpError("Network unavailable", 408);
      return server(ids, 1);
    } });
    await harness.store.saveActiveWorkout(draft({ operations: [order()] }));
    await harness.store.replayPendingWorkoutOperations("token", "user");
    const saved = await harness.store.loadActiveWorkout("user");
    assert.equal(saved.operations[0].attempts, 1);
    saved.operations[0].nextAttemptAt = undefined; saved.revision += 1;
    await harness.store.saveActiveWorkout(saved);
    await harness.reload().replayPendingWorkoutOperations("token", "user");
    const calls = harness.calls.filter((call) => call.name === "updateExerciseOrder");
    assert.equal(calls.length, 2); assert.deepEqual(copy(calls[0].args), copy(calls[1].args));
    assert.equal(calls[0].args[3], 0); assert.equal(calls[0].args[4], "order-1");
  });

  test(`${platform}: replacement acknowledgement retains other typed rows and immutable original`, async () => {
    const { store } = storageHarness(platform);
    await store.saveActiveWorkout(draft({ sets: [set("a", { hasUnsavedInput: true }), set("b", { reps: "13", hasUnsavedInput: true }), set("c")], operations: [
      { id: "replace-1", type: "replace", status: "pending", payload: { exerciseId: "a", replacementExerciseId: "d", expectedRevision: 0 } }] }));
    const result = await store.replayPendingWorkoutOperations("token", "user");
    assert.deepEqual(flatIds(result.workout.effectiveWorkout), ["d", "b", "c"]);
    assert.deepEqual(flatIds(result.workout.workoutSnapshot), ["a", "b", "c"]);
    assert.equal(result.workout.sets.some((row) => row.exerciseId === "a"), false);
    assert.equal(result.workout.sets.find((row) => row.exerciseId === "b").reps, "13");
    assert.ok(result.workout.sets.some((row) => row.exerciseId === "d"));
  });

  test(`${platform}: synced offline order allows completion while optional target review remains`, async () => {
    const harness = storageHarness(platform);
    await harness.store.saveActiveWorkout(draft({ operations: [order({ requiresReview: true }),
      { id: "finish", type: "complete", status: "pending", payload: {} }] }));
    const result = await harness.store.replayPendingWorkoutOperations("token", "user");
    assert.equal(result.completed, true);
    assert.equal(result.completionBlocked, false);
    assert.equal(harness.calls.filter((call) => call.name === "completeSession").length, 1);
    assert.deepEqual(Array.from(result.workout.targetReviewExerciseIds), ["c", "a", "b"]);
  });

  test(`${platform}: post-sync review survives unrelated legacy saves and supports explicit dismissal`, async () => {
    const harness = storageHarness(platform);
    await harness.store.saveActiveWorkout(draft({ targetReviewExerciseIds: ["c", "a", "b"] }));
    await harness.store.saveActiveWorkout(draft({ revision: 2, targetReviewExerciseIds: undefined }));
    let saved = await harness.reload().loadActiveWorkout("user");
    assert.deepEqual(Array.from(saved.targetReviewExerciseIds), ["c", "a", "b"]);
    await harness.store.saveActiveWorkout({ ...saved, revision: saved.revision + 1, targetReviewExerciseIds: null });
    saved = await harness.store.loadActiveWorkout("user");
    assert.equal(saved.targetReviewExerciseIds, null);
  });


  test(`${platform}: unresolved arrangement conflicts cannot be retried by Finish and block completion`, async () => {
    const harness = storageHarness(platform);
    const conflict = { id: "conflict", type: "replace", status: "failed", attempts: 1,
      payload: { exerciseId: "a", replacementExerciseId: "d", expectedRevision: 0, conflict: true } };
    const local = draft({ operations: [conflict] });
    await harness.store.saveActiveWorkout(local);
    const queued = await harness.store.queueWorkoutCompletion(local, true);
    assert.equal(queued.workout.operations.find((operation) => operation.id === "conflict").status, "failed");
    const replay = await harness.store.replayPendingWorkoutOperations("token", "user");
    assert.equal(replay.completed, false); assert.equal(replay.completionBlocked, true);
    assert.equal(harness.calls.filter((call) => call.name === "replaceSessionExercise" || call.name === "completeSession").length, 0);
  });


  test(`${platform}: target reduction removes untouched blank rows but preserves entered and added rows`, async () => {
    const harness = storageHarness(platform, { updateExerciseOrder: async (_token, _session, ids) => server(ids, 1) });
    await harness.store.saveActiveWorkout(draft({ operations: [order()], sets: [
      set("a"), set("b"), set("c"), set("a", { setNumber: 2, reps: "", weight: "" }),
      set("a", { setNumber: 3, reps: "11", hasUnsavedInput: true }),
      set("a", { setNumber: 4, reps: "", weight: "", isAdded: true })] }));
    const result = await harness.store.replayPendingWorkoutOperations("token", "user");
    assert.equal(result.workout.sets.some((row) => row.exerciseId === "a" && row.setNumber === 2), false);
    assert.equal(result.workout.sets.find((row) => row.exerciseId === "a" && row.setNumber === 3).reps, "11");
    assert.equal(result.workout.sets.find((row) => row.exerciseId === "a" && row.setNumber === 4).isAdded, true);
  });


  test(`${platform}: legacy create response disables arrangement and never sends queued order`, async () => {
    const harness = storageHarness(platform, { createSession: async () => ({ ...server(), arrangementRevision: undefined, effectiveWorkout: undefined }) });
    await harness.store.saveActiveWorkout(draft({ serverSessionId: null, operations: [
      { id: "create", type: "create", status: "pending", payload: { workoutDayId: "day", workoutDate: "2026-10-23", dayType: "upper", clientSessionId: "client" } }, order({ requiresReview: true })] }));
    const result = await harness.store.replayPendingWorkoutOperations("token", "user");
    assert.equal(harness.calls.filter((call) => call.name === "updateExerciseOrder").length, 0);
    assert.equal(result.workout.arrangementRevision, undefined);
    assert.equal(result.workout.operations[0].payload.unsupported, true);
    assert.equal(result.workout.operations[0].status, "failed");
    assert.deepEqual(flatIds(result.workout.effectiveWorkout), ["a", "b", "c"]);
  });


  test(`${platform}: late stale player autosave cannot resurrect an acknowledged replacement or lose its four sets`, async () => {
    const entered = deferred(), request = deferred();
    const original = day(["a", "b", "c", "e"]);
    original.blocks[0].items.forEach((entry, index) => { entry.prescription.sets = index < 2 ? 4 : 3; });
    const replacement = day(["d", "b", "c", "e"]);
    replacement.blocks[0].items.forEach((entry, index) => { entry.prescription.sets = index < 2 ? 4 : 3; });
    const harness = storageHarness(platform, { replaceSessionExercise: async () => { entered.resolve(); return request.promise; } });
    const replace = { id: "replace-delayed", type: "replace", status: "pending", payload: { exerciseId: "a", replacementExerciseId: "d", expectedRevision: 0 } };
    const initialSets = original.blocks[0].items.flatMap((entry) => Array.from({ length: entry.prescription.sets }, (_, index) => set(entry.exercise.id, { setNumber: index + 1, reps: "", weight: "" })));
    const stalePlayer = draft({ workoutSnapshot: original, effectiveWorkout: original, sets: initialSets, operations: [replace] });
    await harness.store.saveActiveWorkout(copy(stalePlayer));
    const replay = harness.store.replayPendingWorkoutOperations("token", "user");
    await entered.promise;
    request.resolve({ ...server(), effectiveWorkout: api(replacement), workoutSnapshot: api(original), arrangementRevision: 1 });
    const acknowledged = await replay;
    assert.equal(acknowledged.workout.sets.length, 14);
    // A render queued before the ACK can still write with a higher local revision afterward.
    stalePlayer.revision = acknowledged.workout.revision + 10;
    stalePlayer.sets.find((row) => row.exerciseId === "b").reps = "17";
    stalePlayer.sets.find((row) => row.exerciseId === "b").hasUnsavedInput = true;
    await harness.store.saveActiveWorkout(stalePlayer);
    let durable = await harness.reload().loadActiveWorkout("user");
    assert.equal(durable.arrangementRevision, 1);
    assert.deepEqual(flatIds(durable.effectiveWorkout), ["d", "b", "c", "e"]);
    assert.deepEqual(flatIds(durable.workoutSnapshot), ["a", "b", "c", "e"]);
    assert.equal(durable.sets.filter((row) => row.exerciseId === "d").length, 4);
    assert.equal(durable.sets.length, 14);
    assert.equal(durable.sets.find((row) => row.exerciseId === "b").reps, "17");
    assert.equal(durable.operations.length, 0);
    assert.ok(durable.acknowledgedArrangementOperationIds.includes("replace-delayed"));
    // Also repair a same-revision player projection that accidentally omitted new rows.
    await harness.store.saveActiveWorkout({ ...durable, revision: durable.revision + 1,
      sets: durable.sets.filter((row) => row.exerciseId !== "d"), operations: [replace] });
    durable = await harness.store.loadActiveWorkout("user");
    assert.equal(durable.sets.length, 14);
    assert.equal(durable.operations.length, 0);
    await harness.store.replayPendingWorkoutOperations("token", "user");
    assert.equal(harness.calls.filter((call) => call.name === "replaceSessionExercise").length, 1);
  });


  test(`${platform}: replacing the current non-first exercise keeps that same workout position and rest identity`, async () => {
    const harness = storageHarness(platform, { replaceSessionExercise: async () => server(["a", "d", "c"], 1) });
    await harness.store.saveActiveWorkout(draft({ currentExerciseId: "b", currentExerciseIndex: 1,
      restContext: { exerciseId: "b", exerciseIndex: 1, isLastSetOfExercise: false },
      operations: [{ id: "replace-current", type: "replace", status: "pending", payload: { exerciseId: "b", replacementExerciseId: "d", expectedRevision: 0 } }] }));
    const result = await harness.store.replayPendingWorkoutOperations("token", "user");
    assert.equal(result.workout.currentExerciseId, "d"); assert.equal(result.workout.currentExerciseIndex, 1);
    assert.equal(result.workout.restContext.exerciseId, "d"); assert.equal(result.workout.restContext.exerciseIndex, 1);
    const restored = await harness.reload().loadActiveWorkout("user");
    assert.equal(restored.currentExerciseId, "d");
  });


  test(`${platform}: prestart ordering persists separately through restart without a session, timer or API call`, async () => {
    const harness = storageHarness(platform);
    const original = day();
    await harness.prestart.savePreWorkoutOrder("user", original, ["c", "a", "b"]);
    assert.equal(await harness.store.loadActiveWorkout("user"), null);
    assert.equal(harness.calls.length, 0);
    const saved = await harness.reloadPrestart().loadPreWorkoutOrder("user", original);
    assert.deepEqual(Array.from(saved.exerciseIds), ["c", "a", "b"]); assert.equal(saved.invalidated, false);
    assert.deepEqual(flatIds(original), ["a", "b", "c"]);
    assert.equal((await harness.prestart.loadPreWorkoutOrder("other-user", original)).exerciseIds, null);
    assert.equal((await harness.prestart.loadPreWorkoutOrder("user", { ...original, workoutDayId: "another-day" })).exerciseIds, null);
  });

  test(`${platform}: prestart source changes invalidate intent and malformed permutations never save`, async () => {
    const harness = storageHarness(platform);
    const original = day();
    assert.throws(() => harness.prestart.savePreWorkoutOrder("user", original, ["a", "a", "b"]));
    await harness.prestart.savePreWorkoutOrder("user", original, ["c", "a", "b"]);
    const changed = copy(original); changed.blocks[0].items[0].prescription.sets += 1;
    const state = await harness.prestart.loadPreWorkoutOrder("user", changed);
    assert.equal(state.invalidated, true); assert.equal(state.exerciseIds, null);
    assert.deepEqual(Array.from((await harness.prestart.loadPreWorkoutOrder("user", original)).exerciseIds), ["c", "a", "b"]);
    await harness.prestart.savePreWorkoutOrder("user", original, ["c", "a", "b"]);
    const newProgram = { ...original, programActivationId: "new-program", templateVersion: 2 };
    assert.equal((await harness.prestart.loadPreWorkoutOrder("user", newProgram)).invalidated, true);
  });

  test(`${platform}: Start alone hands original plus chosen order to durable create and unchanged-target replay`, async () => {
    const harness = storageHarness(platform);
    const original = day();
    await harness.prestart.savePreWorkoutOrder("user", original, ["c", "a", "b"]);
    const prepared = await harness.prestart.prepareWorkoutStart("user", original);
    assert.ok(prepared.startedAt > 0); assert.equal(prepared.serverSessionId, null);
    assert.deepEqual(flatIds(prepared.workoutSnapshot), ["a", "b", "c"]);
    assert.deepEqual(flatIds(prepared.effectiveWorkout), ["c", "a", "b"]);
    assert.equal(prepared.currentExerciseId, "c"); assert.equal(prepared.currentExerciseIndex, 0);
    assert.deepEqual(Array.from(prepared.operations, (operation) => operation.type), ["create", "order"]);
    assert.equal(prepared.operations[1].payload.expectedRevision, 0);
    assert.equal(prepared.operations[1].payload.applyRevisedTargets, false);
    assert.equal(harness.calls.length, 0);
    const operationId = prepared.operations[1].id;
    const restarted = harness.reload();
    const result = await restarted.replayPendingWorkoutOperations("token", "user");
    assert.deepEqual(flatIds(result.workout.effectiveWorkout), ["c", "a", "b"]);
    assert.deepEqual(flatIds(result.workout.workoutSnapshot), ["a", "b", "c"]);
    assert.equal(result.workout.operations.length, 0);
    assert.deepEqual(Array.from(result.workout.targetReviewExerciseIds), ["c", "a", "b"]);
    const orderCall = harness.calls.find((call) => call.name === "updateExerciseOrder");
    assert.equal(orderCall.args[3], 0); assert.equal(orderCall.args[4], operationId); assert.equal(orderCall.args[5], false);
  });

  test(`${platform}: existing and concurrently started active sessions always win the prestart handoff`, async () => {
    const harness = storageHarness(platform);
    const active = draft({ workoutDayId: "already-active", sets: [set("b", { confirmed: true, logId: "saved" })] });
    await harness.store.saveActiveWorkout(active);
    await harness.prestart.savePreWorkoutOrder("user", day(), ["c", "a", "b"]);
    const winner = await harness.prestart.prepareWorkoutStart("user", day());
    assert.equal(winner.clientSessionId, active.clientSessionId); assert.equal(winner.sets[0].logId, "saved");
    const fresh = storageHarness(platform);
    await fresh.prestart.savePreWorkoutOrder("user", day(), ["c", "a", "b"]);
    const [first, second] = await Promise.all([
      fresh.prestart.prepareWorkoutStart("user", day()), fresh.prestart.prepareWorkoutStart("user", { ...day(), workoutDayId: "different-day" }),
    ]);
    assert.equal(first.clientSessionId, second.clientSessionId);
    const durable = await fresh.store.loadActiveWorkout("user");
    assert.equal(durable.clientSessionId, first.clientSessionId);
    assert.equal(durable.operations.filter((operation) => operation.type === "create").length, 1);
  });


  test(`${platform}: same active workout accepts the overview order without replacing current progress or timer`, async () => {
    const harness = storageHarness(platform);
    const active = draft({ currentExerciseId: "b", currentExerciseIndex: 1,
      sets: [set("a", { confirmed: true, logId: "saved", version: 3 }), set("b"), set("c")] });
    await harness.store.saveActiveWorkout(active);
    await harness.prestart.savePreWorkoutOrder("user", day(), ["c", "a", "b"]);
    const prepared = await harness.prestart.prepareWorkoutStart("user", day());
    assert.equal(prepared.clientSessionId, active.clientSessionId);
    assert.equal(prepared.currentExerciseId, "b"); assert.equal(prepared.currentExerciseIndex, 2);
    assert.equal(prepared.restEndsAt, active.restEndsAt); assert.equal(prepared.restContext.exerciseId, "a");
    assert.equal(prepared.sets.find((row) => row.exerciseId === "a").logId, "saved");
    assert.deepEqual(flatIds(prepared.workoutSnapshot), ["a", "b", "c"]);
    assert.deepEqual(flatIds(prepared.effectiveWorkout), ["c", "a", "b"]);
    assert.equal(prepared.operations.filter((operation) => operation.type === "create").length, 0);
    assert.equal(prepared.operations[0].type, "order"); assert.equal(harness.calls.length, 0);
    await assert.rejects(() => harness.store.queueWorkoutPrestartOrder({ ...prepared, clientSessionId: "raced-session" }, ["b", "a", "c"]),
      (error) => error.serverSessionId === prepared.serverSessionId);
    assert.equal((await harness.store.loadActiveWorkout("user")).clientSessionId, active.clientSessionId);
  });

  test(`${platform}: remotely replaced membership requires explicit review and never rewrites the active snapshot`, async () => {
    const harness = storageHarness(platform);
    const active = draft({ effectiveWorkout: day(["d", "b", "c"]), arrangementRevision: 2, sets: [set("d"), set("b"), set("c")] });
    await harness.store.saveActiveWorkout(active);
    await harness.prestart.savePreWorkoutOrder("user", day(), ["c", "a", "b"]);
    await assert.rejects(() => harness.prestart.prepareWorkoutStart("user", day()), (error) => error.name === "Error" && error.serverSessionId === "server");
    const durable = await harness.store.loadActiveWorkout("user");
    assert.deepEqual(flatIds(durable.effectiveWorkout), ["d", "b", "c"]);
    assert.equal(durable.arrangementRevision, 2); assert.equal(durable.operations.length, 0);
  });

  test(`${platform}: server-only active resume preserves original and logged sets while queueing overview order`, async () => {
    const harness = storageHarness(platform);
    await harness.prestart.savePreWorkoutOrder("user", day(), ["c", "a", "b"]);
    const remote = { ...server(["b", "a", "c"], 3), workoutDayId: "day", workoutDate: "2026-10-23", dayType: "upper",
      clientSessionId: "remote-client", startedAt: "2026-10-23T12:00:00Z", setLogs: [{ id: "remote-set", exerciseId: "a", setNumber: 1, reps: 9, weightKg: 40, version: 2 }] };
    const prepared = await harness.prestart.prepareWorkoutStart("user", day(), remote);
    assert.equal(prepared.serverSessionId, "server"); assert.equal(prepared.clientSessionId, "remote-client");
    assert.deepEqual(flatIds(prepared.workoutSnapshot), ["a", "b", "c"]);
    assert.deepEqual(flatIds(prepared.effectiveWorkout), ["c", "a", "b"]);
    assert.equal(prepared.sets.find((row) => row.exerciseId === "a").logId, "remote-set");
    assert.equal(prepared.operations[0].payload.expectedRevision, 3);
    assert.equal(prepared.operations.filter((operation) => operation.type === "create").length, 0);
  });

  test(`${platform}: deleting an account clears only its prestart drafts and fences late writes`, async () => {
    const harness = storageHarness(platform);
    await harness.prestart.savePreWorkoutOrder("user", day(), ["c", "a", "b"]);
    await harness.prestart.savePreWorkoutOrder("other-user", day(), ["b", "a", "c"]);
    await harness.prestart.clearPreWorkoutOrdersForUser("user");
    assert.equal((await harness.prestart.loadPreWorkoutOrder("user", day())).exerciseIds, null);
    assert.deepEqual(Array.from((await harness.prestart.loadPreWorkoutOrder("other-user", day())).exerciseIds), ["b", "a", "c"]);
    await assert.rejects(() => harness.prestart.savePreWorkoutOrder("user", day(), ["c", "a", "b"]));
  });


  test(`${platform}: stale prestart invalidation cannot erase a newer saved order for the refreshed source`, async () => {
    const harness = storageHarness(platform);
    const original = day();
    await harness.prestart.savePreWorkoutOrder("user", original, ["c", "a", "b"]);
    const changed = copy(original); changed.blocks[0].items[0].prescription.sets = 2;
    const gate = harness.pauseRead((key) => key.startsWith("primerep.pre-workout-order"));
    const stale = harness.prestart.loadPreWorkoutOrder("user", changed);
    await gate.entered;
    await harness.prestart.savePreWorkoutOrder("user", changed, ["b", "c", "a"]);
    gate.release(); await stale;
    assert.deepEqual(Array.from((await harness.prestart.loadPreWorkoutOrder("user", changed)).exerciseIds), ["b", "c", "a"]);
  });

  test(`${platform}: leaving during server hydration cannot materialize an active workout or timer`, async () => {
    const harness = storageHarness(platform);
    await harness.prestart.savePreWorkoutOrder("user", day(), ["c", "a", "b"]);
    let current = true;
    const gate = harness.pauseRead((key) => key !== "active" && !key.startsWith("primerep.pre-workout-order"));
    const remote = { ...server(), workoutDayId: "day", workoutDate: "2026-10-23", dayType: "upper", clientSessionId: "remote-client", startedAt: "2026-10-23T12:00:00Z" };
    const pending = harness.prestart.prepareWorkoutStart("user", day(), remote, () => current);
    await gate.entered; current = false; gate.release();
    assert.equal(await pending, null);
    assert.equal(await harness.store.loadActiveWorkout("user"), null);
    assert.equal(harness.calls.length, 0);
  });

  test(`${platform}: queued prestart mutation checks the lifecycle fence before changing an existing active workout`, async () => {
    const harness = storageHarness(platform);
    await harness.store.saveActiveWorkout(draft());
    const baseline = await harness.store.loadActiveWorkout("user");
    let current = true;
    const gate = harness.pauseRead((key) => key === "active");
    const pending = harness.store.queueWorkoutPrestartOrder(baseline, ["c", "a", "b"], () => current);
    await gate.entered; current = false; gate.release();
    assert.equal(await pending, null);
    const durable = await harness.store.loadActiveWorkout("user");
    assert.deepEqual(flatIds(durable.effectiveWorkout), ["a", "b", "c"]);
    assert.equal(durable.operations.length, 0);
  });

  test(`${platform}: harmless exercise media and favorite changes preserve a saved prestart order`, async () => {
    const harness = storageHarness(platform);
    const original = day();
    await harness.prestart.savePreWorkoutOrder("user", original, ["c", "a", "b"]);
    const refreshed = copy(original);
    refreshed.blocks[0].items[0].exercise.imageUrl = "new-image";
    refreshed.blocks[0].items[0].exercise.isFavorited = true;
    refreshed.title = "New display title";
    const state = await harness.prestart.loadPreWorkoutOrder("user", refreshed);
    assert.equal(state.invalidated, false); assert.deepEqual(Array.from(state.exerciseIds), ["c", "a", "b"]);
  });


  test(`${platform}: a prestart claim queued behind completion cannot resurrect the finished session`, async () => {
    const entered = deferred(), finish = deferred();
    const harness = storageHarness(platform, { completeSession: async () => { entered.resolve(); return finish.promise; } });
    const baseline = draft();
    await harness.store.saveActiveWorkout({ ...baseline, operations: [{ id: "finish", type: "complete", status: "pending", payload: {} }] });
    const completion = harness.store.replayPendingWorkoutOperations("token", "user");
    await entered.promise;
    const claim = harness.store.queueWorkoutPrestartOrder(baseline, ["c", "a", "b"]);
    const rejection = assert.rejects(claim, (error) => error.terminal === true && error.serverSessionId === "server");
    finish.resolve({ ...server(), status: "completed" });
    const completed = await completion;
    assert.equal(completed.completed, true);
    await harness.store.clearActiveWorkout("user");
    await rejection;
    assert.equal(await harness.store.loadActiveWorkout("user"), null);
    // The persistent terminal marker still rejects the old baseline after process restart.
    await assert.rejects(() => harness.reload().queueWorkoutPrestartOrder(baseline, ["c", "a", "b"]), (error) => error.terminal === true);
    assert.equal(await harness.store.loadActiveWorkout("user"), null);
    assert.equal(harness.calls.filter((call) => call.name === "updateExerciseOrder").length, 0);
  });

}
