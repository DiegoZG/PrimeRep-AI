import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const drafts = loadTypescript("utils/workoutSetEntries.ts", { "@react-native-async-storage/async-storage": {} });
const row = (setNumber, extra = {}) => ({ exerciseId: "squat", setNumber, reps: "8", weight: "40",
  confirmed: false, syncing: false, syncStatus: "synced", logId: null, ...extra });
const workout = (sets) => ({ userId: "a", clientSessionId: "client", serverSessionId: "session", startedAt: 10,
  restEndsAt: 456789, restTotalSeconds: 120, restContext: { exerciseIndex: 0, isLastSetOfExercise: false },
  currentExerciseIndex: 0, sets, operations: [], revision: 1 });
let nextId = 0;
const prepare = (incoming, durable = incoming, unit = "KG", keys = drafts.enteredSets(incoming.sets).map(drafts.setEntryKey)) =>
  drafts.prepareSetEntries(incoming, durable, keys, unit, () => `operation-${++nextId}`);

test("batch saves edited rows only and preserves rest and exercise index", () => {
  const incoming = workout([row(1), row(2, { hasUnsavedInput: true }), row(3, { hasUnsavedInput: true, weight: "" }),
    row(4, { confirmed: true, logId: "saved" }), row(5, { deleted: true, hasUnsavedInput: true })]);
  const result = prepare(incoming);
  assert.equal(result.savedCount, 2);
  assert.equal(result.workout.sets[0].confirmed, false);
  assert.equal(result.workout.sets[1].hasUnsavedInput, false);
  assert.equal(result.workout.sets[2].weightKg, null);
  assert.equal(result.workout.restEndsAt, incoming.restEndsAt);
  assert.equal(result.workout.restContext, incoming.restContext);
  assert.equal(result.workout.currentExerciseIndex, 0);
  assert.equal(result.workout.operations.length, 2);
  assert.equal(prepare(result.workout).savedCount, 0);
});

test("legacy drafts remain individually loggable but are not silently bulk saved", () => {
  const incoming = workout([row(1)]);
  assert.equal(prepare(incoming).savedCount, 0);
  assert.equal(prepare(incoming, incoming, "KG", ["squat:1"]).savedCount, 1);
});

test("strict reps and decimal separators with KG/LB conversion", () => {
  for (const reps of ["", "0", "-1", "2.5", "8x", "Infinity", "9007199254740992"]) {
    assert.ok("error" in drafts.validateSetEntry(row(1, { reps }), "KG"), reps);
  }
  for (const weight of ["-1", "NaN", "Infinity", "1.2x", "1,2,3", "1e400"]) {
    assert.ok("error" in drafts.validateSetEntry(row(1, { weight }), "KG"), weight);
  }
  assert.equal(drafts.validateSetEntry(row(1, { weight: "100,5" }), "LB").weightKg, 45.59);
  assert.equal(drafts.validateSetEntry(row(1, { weight: "100,5" }), "KG").weightKg, 100.5);
  assert.equal(drafts.validateSetEntry(row(1, { weight: "0" }), "KG").weightKg, 0);
  assert.equal(drafts.validateSetEntry(row(1, { weight: " " }), "KG").weightKg, null);
});

test("partial validity saves good entries while preserving invalid/incomplete drafts", () => {
  const incoming = workout([row(1, { hasUnsavedInput: true }), row(2, { hasUnsavedInput: true, reps: "" }), row(3, { hasUnsavedInput: true, weight: "no" })]);
  const result = prepare(incoming);
  assert.equal(result.savedCount, 1);
  assert.equal(Object.keys(result.issues).length, 2);
  assert.equal(result.workout.sets[1].hasUnsavedInput, true);
  assert.equal(result.workout.sets[2].weight, "no");
  assert.equal(incoming.sets[0].confirmed, false);
});

test("logged draft rebases onto the latest server version after in-flight replay", () => {
  const incoming = workout([row(1, { confirmed: true, editing: true, hasUnsavedInput: true, editDraft: { reps: "12", weight: "60" } })]);
  const durable = workout([row(1, { confirmed: true, logId: "log", version: 3 })]);
  const result = prepare(incoming, durable);
  const operation = result.workout.operations[0];
  assert.equal(operation.type, "update_set");
  assert.equal(operation.payload.expectedVersion, 3);
  assert.equal(operation.payload.reps, 12);
  assert.equal(result.workout.sets[0].editing, false);
});

test("pending unsynced edits reuse the stable operation ID, including queued corrections", () => {
  const incoming = workout([row(1, { confirmed: true, editing: true, hasUnsavedInput: true, editDraft: { reps: "12", weight: "60" } })]);
  incoming.operations = [{ id: "stable", type: "set", status: "pending", payload: { exerciseId: "squat", setNumber: 1, reps: 8, weightKg: 40 } }];
  assert.equal(prepare(incoming).workout.operations[0].id, "stable");
  incoming.sets[0].logId = "log";
  incoming.operations = [{ id: "update", type: "update_set", status: "retrying", payload: { exerciseId: "squat", setNumber: 1,
    logId: "log", expectedVersion: 2, previousVersion: 2, previousReps: "8", previousWeight: "40", reps: 10, weightKg: 50 } }];
  const result = prepare(incoming);
  assert.equal(result.workout.operations.length, 1);
  assert.equal(result.workout.operations[0].id, "update");
  assert.equal(result.workout.operations[0].payload.expectedVersion, 2);
});

test("exercise scope leaves other entered rows for the explicit finish flow", () => {
  const sets = [row(1, { hasUnsavedInput: true }), row(1, { exerciseId: "press", hasUnsavedInput: true })];
  assert.equal(drafts.enteredSets(sets, "squat").length, 1);
  const result = prepare(workout(sets), undefined, "KG", drafts.enteredSets(sets, "squat").map(drafts.setEntryKey));
  assert.equal(result.workout.sets[1].hasUnsavedInput, true);
});

test("an attempted request stays immutable while its correction waits for the canonical log/version", () => {
  const incoming = workout([row(1, { confirmed: true, editing: true, hasUnsavedInput: true, editDraft: { reps: "12", weight: "60" } })]);
  incoming.operations = [{ id: "sent", type: "set", status: "pending", attempts: 1,
    payload: { exerciseId: "squat", setNumber: 1, reps: 8, weightKg: 40 } }];
  const result = prepare(incoming);
  assert.equal(result.workout.operations.length, 2);
  assert.equal(result.workout.operations[0].id, "sent");
  assert.equal(result.workout.operations[0].payload.reps, 8);
  const correction = result.workout.operations[1];
  assert.equal(correction.payload.resolveAfterPending, true);
  assert.equal(drafts.resolveSetCorrection(correction, incoming.sets), null);
  const resolved = drafts.resolveSetCorrection(correction, [row(1, { logId: "canonical", version: 2 })]);
  assert.equal(resolved.payload.logId, "canonical");
  assert.equal(resolved.payload.expectedVersion, 2);
  assert.equal(resolved.payload.resolveAfterPending, undefined);
  assert.equal(resolved.payload.reps, 12);
});

test("batch retains notes entered during replay without resurrecting an already replayed note", () => {
  const durable = workout([row(1, { hasUnsavedInput: true })]);
  durable.workoutNote = "old";
  const incoming = { ...durable, workoutNote: "new", operations: [
    { id: "note", type: "update_workout_note", status: "pending", payload: { note: "new" } },
  ] };
  assert.equal(prepare(incoming, durable).workout.operations[0].id, "note");
  assert.equal(prepare(incoming, { ...durable, workoutNote: "new" }).workout.operations.some((operation) => operation.id === "note"), false);
});

test("unit conversion accepts commas without turning invalid drafts into valid suggestions", () => {
  const units = loadTypescript("utils/weightUnits.ts", { "@react-native-async-storage/async-storage": {} });
  assert.equal(units.convertWeightString("100,5", "LB", "KG"), "45.6");
  assert.equal(units.convertWeightString("40x", "LB", "KG"), "40x");
  assert.equal(units.convertWeightString("Infinity", "LB", "KG"), "Infinity");
  assert.equal(units.convertWeightString("", "LB", "KG"), "");
});
