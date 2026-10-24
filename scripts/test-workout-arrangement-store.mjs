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

function storageHarness(platform, handlers = {}) {
  const memory = new Map();
  const sql = { row: null, sets: [], operations: [] };
  const db = {
    execAsync: async () => {}, withTransactionAsync: async (action) => action(),
    getFirstAsync: async (query) => {
      if (query.includes("SELECT * FROM active_workouts")) return sql.row && copy(sql.row);
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
    completeSession: async () => ({ ...server(), status: "completed" }) };
  const service = Object.fromEntries(Object.keys(defaults).map((name) => [name, async (...args) => { calls.push({ name, args }); return (handlers[name] ?? defaults[name])(...args); }]));
  const mocks = { "expo-sqlite": { openDatabaseAsync: async () => db },
    "@react-native-async-storage/async-storage": { getItem: async (key) => memory.get(key) ?? null, setItem: async (key, value) => memory.set(key, value), removeItem: async (key) => memory.delete(key) },
    "@/services/httpClient": { HttpError, requestJson: async () => { throw new Error("Unexpected network request"); } },
    "./httpClient": { HttpError, requestJson: async () => {} },
    "@/services/workoutLoggingService": service };
  const reload = () => loadTypescript(`utils/activeWorkoutStore.${platform}.ts`, mocks);
  return { store: reload(), reload, calls, getCanonical: () => copy(canonical) };
}

for (const platform of ["native", "web"]) {
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

}
