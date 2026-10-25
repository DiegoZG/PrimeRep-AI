import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import ts from "typescript";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const copy = (value) => JSON.parse(JSON.stringify(value));
const host = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const item = (id, sets = 4) => ({ exercise: { id, name: id, exerciseType: "strength", primaryMuscle: "chest", requiredEquipmentIds: [] }, prescription: { sets, reps: "8-12", restSeconds: 90 } });
const workout = { workoutDayId: "day", date: "2026-10-23", title: "Upper A", dayType: "upper", slotIndex: 0, durationMinutes: 45, splitKey: "upper_lower", blocks: [{ blockType: "main", items: [item("incline"), item("bench")] }, { blockType: "accessory", items: [item("row", 3), item("raise", 3)] }] };
const api = (day) => ({ ...day, exerciseBlocks: day.blocks });
async function player(options = {}) {
  const memory = new Map(), timers = new Map(), intervals = new Map(), keyboardListeners = new Map(), calls = [];
  let identity = { token: options.offline ? null : "token", user: { id: "A" } };
  let route = options.noExisting ? { workoutDayId: "day" } : { sessionId: "session" };
  let layoutChoice = options.layout ?? "focus";
  let timerCounter = 0;
  const AuthContext = React.createContext(null), EquipmentWeightsContext = React.createContext(null);
  let server = { id: "session", clientSessionId: "client", workoutDayId: "day", workoutDate: workout.date, dayType: "upper", arrangementRevision: 0,
    effectiveWorkout: api(workout), workoutSnapshot: api(workout), status: "in_progress", startedAt: new Date(100).toISOString(), setLogs: [], deletedSetLogs: [], exerciseFeedback: [], workoutNote: null };
  if (options.noExisting) server = null;
  if (options.server) server = { ...server, ...copy(options.server) };
  const replacementStarted = deferred(), replacementResponse = deferred();
  const replayStarted = deferred(), replayResponse = deferred();
  const native = { AccessibilityInfo: { setAccessibilityFocus: (node) => calls.push(["focus", node]) }, findNodeHandle: () => 23, ActivityIndicator: "ActivityIndicator", Alert: { alert() {} }, AppState: { addEventListener: () => ({ remove() {} }) }, Keyboard: { dismiss() {}, addListener: (event, listener) => { keyboardListeners.set(event, listener); return { remove: () => keyboardListeners.delete(event) }; } },
    KeyboardAvoidingView: "KeyboardAvoidingView", Modal: "Modal", Platform: { OS: options.platform ?? "web", select: (values) => values[options.platform ?? "web"] ?? values.default }, Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", TextInput: "TextInput", TouchableWithoutFeedback: "TouchableWithoutFeedback", View: "View", useWindowDimensions: () => ({ width: 375, height: 812, fontScale: options.fontScale ?? 1 }) };
  const activeWorkout = { markWorkoutTerminal() {} };
  const router = { replace: (route) => calls.push(["route", route]) }, week = { getWorkoutById: () => workout, isLoading: false, planningRefreshRequired: Boolean(options.barrier), refreshWeek: async () => { calls.push(["refresh"]); } };
  const services = {
    getActiveSession: async () => identity.user?.id === "A" ? copy(server) : null, getSession: async () => { if (identity.user?.id !== "A") throw new Error("Not this owner's session"); return copy(server); }, getUserExerciseNote: async (_token, id) => { calls.push(["noteRead", id]); return options.notes?.[id] ? { note: options.notes[id] } : null; }, fetchLastSetsForExercises: async () => ({}),
    logSet: async (_token, _session, exerciseId, setNumber, reps, weightKg) => { calls.push(["log", exerciseId, setNumber]); replayStarted.resolve(); if (options.deferReplay) await replayResponse.promise; if (options.failReplay) throw new Error("Offline"); const log = { id: `log-${exerciseId}-${setNumber}`, exerciseId, setNumber, reps, weightKg, version: 1 }; server.setLogs.push(log); return log; },
    getReplacementCandidates: async () => [{ id: "fly", name: "Chest Fly" }],
    previewExerciseOrder: async (_token, _session, ids) => ({ arrangementRevision: server.arrangementRevision, exerciseIds: ids, targetsChanged: false, targetChanges: [], effectiveWorkout: server.effectiveWorkout, message: "Targets unchanged." }),
    updateExerciseOrder: async (_token, _session, ids) => { const byId = new Map(server.effectiveWorkout.exerciseBlocks.flatMap((block) => block.items.map((item) => [item.exercise.id, item]))); server = { ...server, arrangementRevision: server.arrangementRevision + 1, effectiveWorkout: api({ ...workout, blocks: [{ blockType: "main", items: ids.map((id) => byId.get(id)) }] }) }; return copy(server); },
    replaceSessionExercise: async (...args) => { calls.push(["replace", ...args]); replacementStarted.resolve(); await replacementResponse.promise; server = { ...server, arrangementRevision: server.arrangementRevision + 1, effectiveWorkout: api({ ...workout, blocks: workout.blocks.map((block) => ({ ...block, items: block.items.map((entry) => entry.exercise.id === "bench" ? item("fly") : entry) })) }) }; return copy(server); },
  };
  class HttpError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const mocks = { react: React, "react-native": native, "@expo/vector-icons": { Ionicons: "Ionicons" }, "expo-image": { Image: "Image" }, "expo-av": { Audio: { Sound: { createAsync: async () => ({ sound: { unloadAsync: async () => {}, replayAsync: async () => {} } }) } } }, "expo-status-bar": { StatusBar: "StatusBar" },
    "expo-router": { useRouter: () => router, useLocalSearchParams: () => route }, "expo-haptics": { notificationAsync: async () => {}, impactAsync: async () => {}, NotificationFeedbackType: { Success: "success" }, ImpactFeedbackStyle: { Medium: "medium" } },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView", useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }, "@/hooks/use-color-scheme": { useColorScheme: () => "light" }, "@/hooks/use-workout-week": { useWorkoutWeek: () => week },
    "@/utils/authContext": { AuthContext }, "@/utils/equipmentWeightsContext": { EquipmentWeightsContext }, "@/utils/activeWorkoutContext": { useActiveWorkout: () => activeWorkout },
    "@/utils/workoutLayoutContext": { useWorkoutLayout: () => ({ layout: layoutChoice, isReady: true, isSaving: false, setLayout: async (next) => { layoutChoice = next; tree.update(element()); } }) },
    "@/components/workout/ExerciseListSheet": { ExerciseListSheet: "ExerciseListSheet" }, "@/components/workout/ExerciseInfoSheet": { ExerciseInfoSheet: "ExerciseInfoSheet" }, "@/components/workout/WorkoutArrangementSheets": { WorkoutArrangementSheets: "WorkoutArrangementSheets" },
    "@/components/workout/RestTimer": { RestTimer: "RestTimer" }, "@/components/workout/SetInputRow": { SetInputRow: "SetInputRow" }, "@/components/workout/WeightUnitControl": { WeightUnitControl: "WeightUnitControl" }, "@/components/workout/WorkoutText": { WorkoutText: (props) => React.createElement("Text", props) },
    "@react-native-async-storage/async-storage": { getItem: async (key) => memory.get(key) ?? null, setItem: async (key, value) => { await options.beforeWrite?.(key, value); memory.set(key, value); }, removeItem: async (key) => memory.delete(key) },
    "@/services/workoutLoggingService": services, "@/services/httpClient": { HttpError }, "./httpClient": { HttpError },
  };
  const cache = new Map();
  function load(relative) {
    const filename = path.join(root, relative); if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(output, { React, module, exports: module.exports, console, Date, JSON, Promise, Map, Set,
      setTimeout: (callback, delay) => { const id = ++timerCounter; timers.set(id, { callback, delay }); return id; }, clearTimeout: (id) => timers.delete(id),
      setInterval: (callback) => { const id = ++timerCounter; intervals.set(id, callback); return id; }, clearInterval: (id) => intervals.delete(id),
      require: (name) => {
        if (name in mocks) return mocks[name]; if (name.endsWith(".m4a")) return 0;
        let resolved = name.startsWith("@/") ? name.slice(2) : path.relative(root, path.resolve(path.dirname(filename), name));
        if (resolved === "utils/activeWorkoutStore") resolved = "utils/activeWorkoutStore.web";
        const target = `${resolved}.ts`; return load(existsSync(path.join(root, target)) ? target : `${resolved}.tsx`);
      } }, { filename }); return module.exports;
  }
  const store = load("utils/activeWorkoutStore.web.ts");
  const local = { userId: "A", workoutDayId: "day", workoutDate: workout.date, dayType: "upper", workoutSnapshot: copy(workout), effectiveWorkout: copy(workout), arrangementRevision: 0, clientSessionId: "client", serverSessionId: "session", startedAt: 100,
    currentExerciseId: "bench", currentExerciseIndex: 1, restEndsAt: null, restTotalSeconds: 0, restContext: null, revision: 1, operations: [], sets: workout.blocks.flatMap((block) => block.items.flatMap((entry) => Array.from({ length: entry.prescription.sets }, (_, index) => ({ exerciseId: entry.exercise.id, setNumber: index + 1, reps: "", weight: "", confirmed: false, syncing: false, syncStatus: "synced", logId: null })))) };
  if (options.local) Object.assign(local, typeof options.local === "function" ? options.local(copy(local)) : copy(options.local));
  if (!options.noExisting) await store.saveActiveWorkout(local);
  if (options.realRestTimer) mocks["@/components/workout/RestTimer"] = load("components/workout/RestTimer.tsx");
  const { default: Screen } = load("app/workout/active.tsx");
  const element = () => React.createElement(AuthContext.Provider, { value: identity }, React.createElement(EquipmentWeightsContext.Provider, { value: { hasLoaded: true, dumbbellWeights: [], plateWeights: [] } }, React.createElement(Screen)));
  const mount = () => create(element(), { createNodeMock: (node) => node.type === "Pressable" ? {} : null });
  let tree; await act(async () => { tree = mount(); });
  const settle = async () => { await act(async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); }); };
  await settle();
  const runTimers = async () => { await act(async () => { const pending = [...timers]; for (const [id, timer] of pending) if (timer.delay === 0) { timers.delete(id); timer.callback(); } }); await settle(); };
  const list = () => tree.root.findByType("ExerciseListSheet");
  const controller = () => tree.root.findByType("WorkoutArrangementSheets").props.controller;
  const result = { tree, store, calls, list, controller, settle, runTimers, replacementStarted, replacementResponse, replayStarted, replayResponse, getServer: () => copy(server), memory, timers,
    getLayout: () => layoutChoice,
    showKeyboard: async () => { await act(async () => keyboardListeners.get("keyboardDidShow")?.()); },
    remount: async () => { await act(async () => tree.unmount()); await act(async () => { tree = mount(); result.tree = tree; }); await settle(); },
    auth: async (id) => { identity = { token: "token", user: { id } }; await act(async () => tree.update(element())); await settle(); },
    route: async (next) => { route = next; await act(async () => tree.update(element())); await settle(); },
    setBarrier: async (value) => { week.planningRefreshRequired = value; await act(async () => tree.update(element())); await settle(); } };
  return result;
}

test("mounted player replacement with background replay and autosave keeps all replacement sets and clears pending state", async () => {
  const view = await player();
  assert.equal(view.list().props.getProgress("bench").total, 4);
  await act(async () => host(view.tree, "player-exercise-list-button").props.onPress());
  await act(async () => view.list().props.onReplace("bench")); await view.settle();
  assert.ok(view.controller().picker); await act(async () => view.controller().setPicker({ ...view.controller().picker, selected: { id: "fly", name: "Chest Fly" } }));
  await act(async () => view.controller().confirmReplacement()); await view.replacementStarted.promise;
  await view.runTimers();
  await act(async () => view.replacementResponse.resolve()); await view.settle(); await view.runTimers(); await view.settle();
  assert.equal(view.list().props.getProgress("fly").total, 4);
  assert.equal(view.list().props.getProgress("bench").total, 0);
  const durable = await view.store.loadActiveWorkout("A");
  assert.equal(durable.sets.filter((set) => set.exerciseId === "fly").length, 4);
  assert.equal(durable.sets.length, 14); assert.equal(durable.operations.some((operation) => operation.type === "replace"), false);
  assert.equal(view.list().props.currentIndex, 1); assert.equal(view.list().props.exercises[1].exercise.id, "fly");
  assert.doesNotMatch(view.controller().message, /waiting to sync/);
  assert.equal(view.calls.filter((call) => call[0] === "replace").length, 1);
  await act(async () => view.tree.unmount());
});

test("stale Add set cannot recreate a replaced exercise", async () => {
  const view = await player(), oldAddBench = host(view.tree, "player-add-set-bench").props.onPress;
  await act(async () => host(view.tree, "player-exercise-list-button").props.onPress());
  await act(async () => view.list().props.onReplace("bench")); await view.settle();
  await act(async () => view.controller().setPicker({ ...view.controller().picker, selected: { id: "fly", name: "Chest Fly" } }));
  await act(async () => view.controller().confirmReplacement()); await view.replacementStarted.promise;
  await act(async () => view.replacementResponse.resolve()); await view.settle(); await view.runTimers(); await view.settle();
  assert.equal(view.list().props.exercises[1].exercise.id, "fly");
  await act(async () => oldAddBench());
  const durable = await view.store.loadActiveWorkout("A");
  assert.equal(durable.sets.filter((set) => set.exerciseId === "bench").length, 0);
  assert.equal(durable.sets.filter((set) => set.exerciseId === "fly").length, 4);
  await act(async () => view.tree.unmount());
});

test("stale Add set from an earlier account epoch cannot alter the current workout", async () => {
  const view = await player(), oldAddBench = host(view.tree, "player-add-set-bench").props.onPress;
  await view.auth("B"); await view.auth("A");
  const before = await view.store.loadActiveWorkout("A");
  await act(async () => oldAddBench());
  const after = await view.store.loadActiveWorkout("A");
  assert.equal(after.sets.filter((set) => set.exerciseId === "bench").length, before.sets.filter((set) => set.exerciseId === "bench").length);
  await act(async () => view.tree.unmount());
});

test("captured set-row callbacks cannot edit or confirm the next owner's same exercise", async () => {
  const view = await player(), staleRow = input(view).props;
  await view.auth("B"); await view.auth("A");
  const before = await view.store.loadActiveWorkout("A");
  await act(async () => {
    staleRow.onUpdate(1, "reps", "12");
    staleRow.onUpdate(1, "weight", "99");
    staleRow.onEdit(1);
    staleRow.onConfirm(1);
    staleRow.onRemove(1);
  });
  await view.settle(); await view.runTimers();
  const after = await view.store.loadActiveWorkout("A");
  assert.deepEqual(copy(after.sets), copy(before.sets));
  assert.deepEqual(copy(after.operations), copy(before.operations));
  assert.equal(view.calls.some((call) => call[0] === "log"), false);
  await act(async () => input(view).props.onUpdate(1, "reps", "8"));
  assert.equal(input(view).props.setRow.reps, "8");
  await act(async () => view.tree.unmount());
});

test("captured set-row callbacks cannot act after a same-account session route changes", async () => {
  const view = await player(), staleRow = input(view).props;
  await view.route({ sessionId: "another-session" }); await view.route({ sessionId: "session" });
  const before = await view.store.loadActiveWorkout("A");
  await act(async () => { staleRow.onUpdate(1, "reps", "12"); staleRow.onConfirm(1); staleRow.onRemove(1); });
  await view.settle();
  const after = await view.store.loadActiveWorkout("A");
  assert.deepEqual(copy(after.sets), copy(before.sets));
  assert.deepEqual(copy(after.operations), copy(before.operations));
  await act(async () => view.tree.unmount());
});

test("a delayed set save cannot replace edits after a same-account session route changes", async () => {
  let pause = false; const writing = deferred(), release = deferred();
  const view = await player({ beforeWrite: async (key, value) => {
    if (pause && key.includes("active-workout") && JSON.parse(value).sets.some((set) => set.exerciseId === "bench" && set.setNumber === 1 && set.confirmed)) {
      writing.resolve(); await release.promise;
    }
  } });
  await act(async () => { input(view).props.onUpdate(1, "reps", "8"); input(view).props.onUpdate(1, "weight", "40"); });
  await view.settle(); pause = true;
  await act(async () => input(view).props.onConfirm(1)); await writing.promise;
  await view.route({ sessionId: "another-session" }); await view.route({ sessionId: "session" });
  assert.equal(view.list().props.selectionDisabled, false);
  await act(async () => input(view).props.onUpdate(2, "reps", "11"));
  const currentDraft = input(view, 2).props.setRow.reps;
  pause = false; await act(async () => release.resolve()); await view.settle();
  assert.equal(currentDraft, "11");
  assert.equal(input(view, 2).props.setRow.reps, "11");
  assert.equal(view.list().props.selectionDisabled, false);
  await act(async () => view.tree.unmount());
});

test("a delayed set save from an earlier account epoch cannot replace the restored account workout", async () => {
  let pause = false; const writing = deferred(), release = deferred();
  const view = await player({ beforeWrite: async (key, value) => {
    if (pause && key.includes("active-workout") && JSON.parse(value).sets.some((set) => set.exerciseId === "bench" && set.setNumber === 1 && set.confirmed)) {
      writing.resolve(); await release.promise;
    }
  } });
  await act(async () => { input(view).props.onUpdate(1, "reps", "8"); input(view).props.onUpdate(1, "weight", "40"); });
  await view.settle(); pause = true;
  await act(async () => input(view).props.onConfirm(1)); await writing.promise;
  await view.auth("B"); await view.auth("A");
  assert.equal(view.list().props.selectionDisabled, false);
  await act(async () => input(view).props.onUpdate(2, "reps", "11"));
  pause = false; await act(async () => release.resolve()); await view.settle();
  assert.equal(input(view, 2).props.setRow.reps, "11");
  assert.equal(view.list().props.selectionDisabled, false);
  await act(async () => view.tree.unmount());
});

test("an old save completion cannot unlock a newer in-flight set save", async () => {
  let pause = false; const firstWrite = deferred(), firstRelease = deferred(), secondWrite = deferred(), secondRelease = deferred();
  const view = await player({ beforeWrite: async (key, value) => {
    if (!pause || !key.includes("active-workout")) return;
    const confirmed = JSON.parse(value).sets.filter((set) => set.exerciseId === "bench" && set.confirmed).map((set) => set.setNumber);
    if (confirmed.includes(2)) { secondWrite.resolve(); await secondRelease.promise; }
    else if (confirmed.includes(1)) { firstWrite.resolve(); await firstRelease.promise; }
  } });
  await act(async () => { input(view).props.onUpdate(1, "reps", "8"); input(view).props.onUpdate(1, "weight", "40"); });
  await view.settle(); pause = true;
  await act(async () => input(view).props.onConfirm(1)); await firstWrite.promise;
  await view.auth("B"); await view.auth("A");
  await act(async () => { input(view, 2).props.onUpdate(2, "reps", "9"); input(view, 2).props.onUpdate(2, "weight", "45"); });
  await act(async () => input(view, 2).props.onConfirm(2));
  assert.equal(view.list().props.selectionDisabled, true);
  await act(async () => firstRelease.resolve()); await secondWrite.promise; await view.settle();
  assert.equal(view.list().props.selectionDisabled, true);
  pause = false; await act(async () => secondRelease.resolve()); await view.settle();
  assert.equal(view.list().props.selectionDisabled, false);
  assert.equal(input(view, 2).props.setRow.confirmed, true);
  await act(async () => view.tree.unmount());
});

test("note and feedback editors close on identity change and stale Save cannot target the next session", async () => {
  const view = await player();
  await act(async () => host(view.tree, "player-exercise-note-bench").props.onPress());
  await act(async () => host(view.tree, "player-exercise-note-input-bench").props.onChangeText("Old account note"));
  const staleNoteSave = host(view.tree, "player-save-note").props.onPress;
  await view.auth("B"); await view.auth("A");
  assert.equal(view.tree.root.findAllByType("Modal").filter((modal) => modal.props.visible).length, 0);
  await act(async () => staleNoteSave()); await view.settle();
  assert.equal((await view.store.loadActiveWorkout("A")).exerciseNotes?.bench ?? null, null);
  await act(async () => host(view.tree, "player-feedback-bench").props.onPress());
  const staleFeedbackSave = host(view.tree, "player-save-feedback").props.onPress;
  await view.route({ sessionId: "another-session" }); await view.route({ sessionId: "session" });
  assert.equal(view.tree.root.findAllByType("Modal").filter((modal) => modal.props.visible).length, 0);
  await act(async () => staleFeedbackSave()); await view.settle();
  const after = await view.store.loadActiveWorkout("A");
  assert.equal(after.operations.some((operation) => operation.type === "update_exercise_note" || operation.type === "update_exercise_feedback"), false);
  await act(async () => view.tree.unmount());
});

test("mounted player uses one native Modal while moving from exercise list to review to guidance", async () => {
  const view = await player(); await act(async () => host(view.tree, "player-exercise-list-button").props.onPress());
  await act(async () => view.list().props.onMove("row", 0)); await view.settle();
  assert.ok(view.controller().review);
  assert.equal(view.list().props.visible, false);
  assert.equal(view.tree.root.findAllByType("Modal").filter((modal) => modal.props.visible).length, 1);
  await act(async () => view.controller().setReview(null)); assert.equal(view.list().props.visible, true);
  await act(async () => view.list().props.onReplace("bench")); await view.settle();
  await act(async () => view.controller().setGuidance({ id: "fly", name: "Chest Fly" }));
  assert.equal(view.tree.root.findAllByType("Modal").filter((modal) => modal.props.visible).length, 1);
  const guidance = view.tree.root.findAllByType("ExerciseInfoSheet").find((sheet) => sheet.props.visible);
  assert.equal(guidance.props.inline, true); assert.equal(guidance.props.exerciseId, "fly");
  await act(async () => guidance.props.onClose()); assert.ok(view.controller().picker); assert.equal(view.controller().guidance, null);
  await act(async () => view.tree.unmount());
});

test("direct player routes cannot create a workout behind an uncertain planning barrier and recover after refresh", async () => {
  const view = await player({ noExisting: true, barrier: true });
  assert.ok(host(view.tree, "active-planning-refresh"));
  await view.runTimers(); assert.equal(await view.store.loadActiveWorkout("A"), null);
  await act(async () => host(view.tree, "active-planning-refresh").props.onPress());
  assert.equal(view.calls.filter((call) => call[0] === "refresh").length, 1);
  await view.setBarrier(false); await view.runTimers();
  assert.equal(host(view.tree, "active-planning-refresh"), undefined);
  const local = await view.store.loadActiveWorkout("A");
  assert.ok(local); assert.equal(local.operations.filter((operation) => operation.type === "create").length, 1);
  await act(async () => view.tree.unmount());
});

test("an existing logged workout remains resumable while a new-plan refresh is required", async () => {
  const view = await player({ barrier: true });
  assert.equal(host(view.tree, "active-planning-refresh"), undefined);
  assert.ok(view.list()); assert.equal((await view.store.loadActiveWorkout("A")).serverSessionId, "session");
  await act(async () => view.tree.unmount());
});

const choose = async (view, index) => { await act(async () => view.list().props.onSelect(index)); await view.settle(); };
const input = (view, number = 1) => view.tree.root.findAllByType("SetInputRow").find((node) => node.props.setRow.setNumber === number);
const inputFor = (view, exerciseId, number = 1) => view.tree.root.findAllByType("SetInputRow").find((node) => node.props.setRow.exerciseId === exerciseId && node.props.setRow.setNumber === number);
const infoSheet = (view) => view.tree.root.findAllByType("ExerciseInfoSheet")[1];
const rest = (view) => view.tree.root.findAllByType("RestTimer")[0];
const confirmed = (local, count = 4) => ({ ...local, sets: local.sets.map((set) => set.exerciseId === "bench" && set.setNumber <= count ? { ...set, confirmed: true, reps: "8", weight: "40", logId: `saved-${set.setNumber}`, version: 1 } : set) });

test("all exercises shows every editable card and logs the touched exercise", async () => {
  const view = await player({ layout: "all", notes: { row: "Keep elbows close." } });
  for (const id of ["incline", "bench", "row", "raise"]) assert.ok(host(view.tree, `player-all-card-${id}`));
  assert.deepEqual(view.calls.filter((call) => call[0] === "noteRead").map((call) => call[1]).sort(), ["bench", "incline", "raise", "row"]);
  assert.equal(view.tree.root.findAllByType("SetInputRow").length, 14);
  assert.ok(host(view.tree, "player-all-thumb-bench"));
  assert.equal(inputFor(view, "bench").props.compact, true);
  assert.ok(host(view.tree, "player-add-set-bench"));
  assert.ok(host(view.tree, "player-exercise-note-bench"));
  assert.ok(host(view.tree, "player-feedback-bench"));
  await act(async () => { inputFor(view, "row").props.onUpdate(1, "weight", "45"); inputFor(view, "row").props.onUpdate(1, "reps", "9"); });
  await view.settle();
  assert.equal(view.list().props.currentIndex, 2);
  assert.equal(inputFor(view, "bench").props.setRow.weight, "");
  await act(async () => inputFor(view, "row").props.onConfirm(1)); await view.settle();
  const saved = await view.store.loadActiveWorkout("A");
  assert.equal(saved.sets.find((set) => set.exerciseId === "row" && set.setNumber === 1).confirmed, true);
  assert.equal(saved.sets.find((set) => set.exerciseId === "bench" && set.setNumber === 1).confirmed, false);
  assert.equal(saved.restContext.exerciseId, "row");
  assert.equal(view.calls.some((call) => call[0] === "log" && call[1] === "bench"), false);
  assert.equal(view.tree.root.findAllByType("RestTimer").length, 1);
  await act(async () => rest(view).props.onExpire());
  assert.ok(host(view.tree, "player-all-rest-done"));
  assert.equal([...view.timers.values()].some((timer) => timer.delay === 2200), false);
  await act(async () => host(view.tree, "player-all-toggle-row").props.onPress());
  assert.equal(inputFor(view, "row"), undefined); assert.ok(inputFor(view, "bench"));
  await act(async () => host(view.tree, "player-all-toggle-row").props.onPress());
  assert.ok(inputFor(view, "row"));
  await act(async () => view.tree.unmount());
});

test("all exercise thumbnail shows supplied image and falls back when it fails", async () => {
  const withImage = copy(workout);
  withImage.blocks[0].items[1].exercise.imageUrl = "https://example.com/bench.png";
  const view = await player({ layout: "all", server: { effectiveWorkout: api(withImage), workoutSnapshot: api(withImage) },
    local: (local) => ({ ...local, effectiveWorkout: withImage, workoutSnapshot: withImage }) });
  const thumb = host(view.tree, "player-all-thumb-bench");
  const photo = thumb.findByType("Image");
  assert.equal(photo.props.source.uri, "https://example.com/bench.png");
  await act(async () => photo.props.onError());
  assert.equal(thumb.findAllByType("Image").length, 0);
  assert.ok(thumb.findAllByType("Text").length > 0);
  await act(async () => view.tree.unmount());
});

test("removing a blank added set leaves no row or delete operation after restart", async () => {
  const view = await player({ layout: "all" });
  await act(async () => host(view.tree, "player-add-set-bench").props.onPress());
  assert.ok(inputFor(view, "bench", 5));
  await act(async () => inputFor(view, "bench", 5).props.onRemove(5));
  await view.settle();
  assert.equal(inputFor(view, "bench", 5), undefined);
  assert.equal(view.list().props.getProgress("bench").total, 4);
  const durable = await view.store.loadActiveWorkout("A");
  assert.equal(durable.sets.filter((set) => set.exerciseId === "bench" && !set.deleted).length, 4);
  assert.equal(durable.sets.find((set) => set.exerciseId === "bench" && set.setNumber === 5).deleted, true);
  assert.equal(durable.operations.some((operation) => operation.type === "delete_set"), false);
  await view.remount();
  assert.equal(inputFor(view, "bench", 5), undefined);
  await act(async () => host(view.tree, "player-add-set-bench").props.onPress());
  assert.ok(inputFor(view, "bench", 5));
  await act(async () => view.tree.unmount());
});

test("layout switch keeps cross-exercise drafts and restores the selected layout", async () => {
  const view = await player();
  await act(async () => host(view.tree, "player-layout-all").props.onPress()); await view.settle();
  assert.equal(view.getLayout(), "all"); assert.ok(host(view.tree, "player-all-card-row"));
  await act(async () => { inputFor(view, "row").props.onUpdate(1, "weight", "55"); inputFor(view, "row").props.onUpdate(1, "reps", "10"); });
  await act(async () => host(view.tree, "player-layout-focus").props.onPress()); await view.settle();
  assert.equal(input(view).props.setRow.exerciseId, "row"); assert.equal(input(view).props.setRow.weight, "55");
  await act(async () => host(view.tree, "player-layout-all").props.onPress()); await view.settle();
  await view.remount();
  assert.equal(view.getLayout(), "all"); assert.ok(host(view.tree, "player-all-card-row"));
  assert.equal(inputFor(view, "row").props.setRow.reps, "10");
  assert.equal(view.calls.some((call) => call[0] === "log"), false);
  await act(async () => view.tree.unmount());
});

test("large-text layout switch keeps the scroll view and focused radio mounted", async () => {
  const view = await player({ fontScale: 2 });
  const scroll = host(view.tree, "player-main-scroll");
  const allRadio = host(view.tree, "player-layout-all");
  assert.equal(host(view.tree, "player-layout-switch").props.style.flexDirection, "column");
  assert.ok(host(view.tree, "player-layout-all").props.style.minHeight >= 44);
  await act(async () => host(view.tree, "player-layout-all").props.onPress()); await view.settle();
  assert.strictEqual(host(view.tree, "player-main-scroll"), scroll);
  assert.strictEqual(host(view.tree, "player-layout-all"), allRadio);
  await act(async () => host(view.tree, "player-layout-focus").props.onPress()); await view.settle();
  assert.strictEqual(host(view.tree, "player-main-scroll"), scroll);
  await act(async () => view.tree.unmount());
});

test("all exercises keyboard save names and targets the selected exercise", async () => {
  const view = await player({ layout: "all" });
  await act(async () => { inputFor(view, "row").props.onUpdate(1, "weight", "45"); inputFor(view, "row").props.onUpdate(1, "reps", "9"); });
  await view.showKeyboard();
  const save = host(view.tree, "player-save-entered-sets");
  assert.match(save.findByType("Text").children.join(""), /Save 1 sets · row/);
  assert.match(save.props.accessibilityLabel, /for row/);
  await act(async () => save.props.onPress()); await view.settle();
  assert.equal((await view.store.loadActiveWorkout("A")).sets.find((set) => set.exerciseId === "row" && set.setNumber === 1).confirmed, true);
  assert.equal(view.calls.some((call) => call[0] === "log" && call[1] === "bench"), false);
  await act(async () => view.tree.unmount());
});

for (const navigation of ["account", "route"]) test(`all-card and layout callbacks from an earlier ${navigation} epoch cannot act after ABA`, async () => {
  const view = await player({ layout: "all" });
  const oldLayout = host(view.tree, "player-layout-focus").props.onPress;
  const oldToggle = host(view.tree, "player-all-toggle-row").props.onPress;
  const oldInfo = host(view.tree, "player-all-info-row").props.onPress;
  const oldEdit = inputFor(view, "row").props.onUpdate;
  await act(async () => oldInfo());
  assert.equal(infoSheet(view).props.visible, true);
  const oldDismiss = view.tree.root.findAllByType("Modal").find((node) => node.props.onDismiss).props.onDismiss;
  if (navigation === "account") {
    await view.auth("B"); assert.notEqual(infoSheet(view)?.props.visible, true);
    await view.auth("A");
  } else {
    await view.route({ sessionId: "another-session" }); assert.notEqual(infoSheet(view)?.props.visible, true);
    await view.route({ sessionId: "session" });
  }
  assert.equal(infoSheet(view).props.visible, false);
  assert.equal(infoSheet(view).props.exerciseId, null);
  await act(async () => oldDismiss());
  assert.equal(view.calls.filter((call) => call[0] === "focus").length, 0);
  await act(async () => { oldLayout(); oldToggle(); oldInfo(); oldEdit(1, "weight", "100"); });
  await view.settle();
  assert.equal(view.getLayout(), "all");
  assert.equal(infoSheet(view).props.visible, false);
  assert.ok(inputFor(view, "row"));
  assert.equal(inputFor(view, "row").props.setRow.weight, "");
  await act(async () => view.tree.unmount());
});

test("all-card controls stay inert when selection is blocked by a set save", async () => {
  let pause = false; const writing = deferred(), release = deferred();
  const view = await player({ layout: "all", beforeWrite: async (key) => { if (pause && key.includes("active-workout")) { writing.resolve(); await release.promise; } } });
  const toggle = host(view.tree, "player-all-toggle-row").props.onPress;
  const info = host(view.tree, "player-all-info-row").props.onPress;
  await act(async () => { inputFor(view, "bench").props.onUpdate(1, "weight", "45"); inputFor(view, "bench").props.onUpdate(1, "reps", "9"); });
  await view.settle(); pause = true;
  await act(async () => inputFor(view, "bench").props.onConfirm(1)); await writing.promise;
  await act(async () => { toggle(); info(); });
  assert.equal(infoSheet(view).props.visible, false);
  assert.ok(inputFor(view, "row"));
  pause = false; await act(async () => release.resolve()); await view.settle();
  await act(async () => view.tree.unmount());
});

test("all exercises keeps one rest timer and uses a nonblocking expiry notice", async () => {
  const deadline = Date.now() + 90000;
  const view = await player({ local: { restEndsAt: deadline, restTotalSeconds: 90, restContext: { exerciseId: "bench", isLastSetOfExercise: true } } });
  await act(async () => host(view.tree, "player-layout-all").props.onPress()); await view.settle();
  const snapshot = await view.store.loadActiveWorkout("A");
  assert.equal(snapshot.restEndsAt, deadline); assert.equal(snapshot.restContext.suppressAutoAdvance, true);
  assert.equal(view.tree.root.findAllByType("RestTimer").length, 1);
  await act(async () => rest(view).props.onExpire());
  assert.ok(host(view.tree, "player-all-rest-done")); assert.ok(host(view.tree, "player-all-card-bench"));
  assert.equal([...view.timers.values()].some((timer) => timer.delay === 2200), false);
  await act(async () => host(view.tree, "player-dismiss-rest-done").props.onPress());
  assert.equal(host(view.tree, "player-all-rest-done"), undefined);
  await view.remount(); assert.equal(view.getLayout(), "all"); assert.ok(host(view.tree, "player-all-card-bench"));
  await act(async () => view.tree.unmount());
});

for (const savedCount of [0, 2, 4]) test(`choose any exercise with ${savedCount} saved sets preserves progress, drafts and cold-resume cursor`, async () => {
  const view = await player({ local: (local) => ({ ...confirmed(local, savedCount), workoutNote: "Workout note", exerciseNotes: { bench: "Exercise note" } }) });
  const before = await view.store.loadActiveWorkout("A");
  await act(async () => host(view.tree, "player-choose-exercise").props.onPress());
  assert.equal(view.list().props.visible, true);
  assert.equal(view.list().props.selectionDisabled, false);
  await choose(view, 2);
  assert.equal(view.list().props.currentIndex, 2);
  assert.equal(view.list().props.visible, false);
  await act(async () => { input(view).props.onUpdate(1, "reps", "11"); input(view).props.onUpdate(1, "weight", "25"); });
  await choose(view, 0); await choose(view, 2);
  assert.equal(input(view).props.setRow.reps, "11"); assert.equal(input(view).props.setRow.weight, "25");
  const durable = await view.store.loadActiveWorkout("A");
  assert.equal(durable.currentExerciseId, "row"); assert.equal(durable.currentExerciseIndex, 2);
  assert.deepEqual(copy(durable.workoutSnapshot), copy(before.workoutSnapshot));
  assert.deepEqual(copy(durable.effectiveWorkout), copy(before.effectiveWorkout));
  assert.deepEqual(copy(durable.operations), copy(before.operations));
  assert.deepEqual(copy(durable.sets.filter((set) => set.exerciseId === "bench")), copy(before.sets.filter((set) => set.exerciseId === "bench")));
  assert.equal(durable.workoutNote, "Workout note"); assert.equal(durable.exerciseNotes.bench, "Exercise note");
  assert.equal(view.calls.some((call) => ["log", "replace"].includes(call[0])), false);
  await view.remount(); assert.equal(view.list().props.currentIndex, 2);
  assert.equal(input(view).props.setRow.reps, "11"); assert.equal(input(view).props.setRow.weight, "25");
  await choose(view, 1); assert.equal(view.list().props.getProgress("bench").confirmed, savedCount);
  await act(async () => view.tree.unmount());
});

test("manual navigation preserves editing drafts and leaves them unlogged", async () => {
  const view = await player({ local: (local) => confirmed(local) });
  await act(async () => input(view).props.onEdit(1));
  await act(async () => { input(view).props.onUpdate(1, "reps", "10"); input(view).props.onUpdate(1, "weight", "45"); });
  await choose(view, 3); await view.remount(); await choose(view, 1);
  const durable = await view.store.loadActiveWorkout("A"), set = durable.sets.find((entry) => entry.exerciseId === "bench" && entry.setNumber === 1);
  assert.equal(set.editing, true); assert.deepEqual(copy(set.editDraft), { reps: "10", weight: "45" });
  assert.equal(set.reps, "8"); assert.equal(set.logId, "saved-1"); assert.equal(durable.operations.length, 0);
  assert.equal(view.calls.some((call) => call[0] === "log"), false);
  await act(async () => view.tree.unmount());
});

test("exercise row actions stay bound to their own exercise after navigation", async () => {
  const view = await player();
  const benchRow = input(view), updateBench = benchRow.props.onUpdate, confirmBench = benchRow.props.onConfirm;
  const addBenchSet = host(view.tree, "player-add-set-bench").props.onPress;
  const openBenchNote = host(view.tree, "player-exercise-note-bench").props.onPress;
  await choose(view, 2);
  await act(async () => { updateBench(1, "reps", "9"); updateBench(1, "weight", "55"); addBenchSet(); });
  await act(async () => confirmBench(1)); await view.settle(); await view.runTimers();
  assert.equal(view.list().props.currentIndex, 2);
  const durable = await view.store.loadActiveWorkout("A");
  assert.equal(durable.sets.find((set) => set.exerciseId === "bench" && set.setNumber === 1).confirmed, true);
  assert.equal(durable.sets.find((set) => set.exerciseId === "row" && set.setNumber === 1).confirmed, false);
  assert.equal(durable.sets.filter((set) => set.exerciseId === "bench").length, 5);
  assert.equal(durable.restContext.exerciseId, "bench");
  assert.deepEqual(view.calls.filter((call) => call[0] === "log").map((call) => call[1]), ["bench"]);
  await act(async () => openBenchNote());
  assert.ok(host(view.tree, "player-exercise-note-input-bench"));
  await act(async () => host(view.tree, "player-exercise-note-input-bench").props.onChangeText("Bench setup"));
  await act(async () => host(view.tree, "player-save-note").props.onPress());
  assert.equal(view.tree.root.findAllByType("ExerciseListSheet")[0].props.currentIndex, 2);
  assert.equal((await view.store.loadActiveWorkout("A")).exerciseNotes.bench, "Bench setup");
  await act(async () => view.tree.unmount());
});

test("switching keeps the original rest deadline and source visible, persists suppression, and ignores stale expiry after restart", async () => {
  const deadline = Date.now() + 90000;
  const view = await player({ local: (local) => ({ ...confirmed(local), restEndsAt: deadline, restTotalSeconds: 90, restContext: { exerciseId: "bench", isLastSetOfExercise: true } }) });
  const oldExpiry = rest(view).props.onExpire;
  await choose(view, 2);
  assert.equal(rest(view).props.restEndsAt, deadline); assert.equal(rest(view).props.exerciseName, "bench");
  const durable = await view.store.loadActiveWorkout("A");
  assert.equal(durable.restEndsAt, deadline); assert.deepEqual(copy(durable.restContext), { exerciseId: "bench", exerciseIndex: 1, isLastSetOfExercise: true, suppressAutoAdvance: true });
  await view.remount(); assert.equal(view.list().props.currentIndex, 2); assert.equal(rest(view).props.restEndsAt, deadline);
  await act(async () => oldExpiry()); assert.equal(rest(view).props.restEndsAt, deadline);
  await choose(view, 1); await act(async () => rest(view).props.onExpire());
  assert.equal(view.list().props.currentIndex, 1); assert.equal(rest(view), undefined);
  assert.equal([...view.timers.values()].some((timer) => timer.delay === 2200), false);
  await act(async () => host(view.tree, "player-next-exercise-shortcut").props.onPress());
  assert.equal(view.list().props.currentIndex, 2);
  await act(async () => view.tree.unmount());
});

test("footer Next leaves unfinished sets unlogged and keeps drafts and rest through restart", async () => {
  const deadline = Date.now() + 90000;
  const view = await player({ local: (local) => ({ ...local, restEndsAt: deadline, restTotalSeconds: 90, restContext: { exerciseId: "bench", isLastSetOfExercise: false } }) });
  await act(async () => { input(view).props.onUpdate(1, "reps", "9"); input(view).props.onUpdate(1, "weight", "55"); });
  assert.equal(host(view.tree, "player-next-exercise-shortcut").props.disabled, false);
  await act(async () => host(view.tree, "player-next-exercise-shortcut").props.onPress());
  await view.settle();
  assert.equal(view.list().props.currentIndex, 2);
  const durable = await view.store.loadActiveWorkout("A");
  const draft = durable.sets.find((set) => set.exerciseId === "bench" && set.setNumber === 1);
  assert.equal(draft.reps, "9"); assert.equal(draft.weight, "55"); assert.equal(draft.confirmed, false);
  assert.equal(durable.restEndsAt, deadline); assert.equal(durable.restContext.suppressAutoAdvance, true);
  assert.equal(view.calls.some((call) => call[0] === "log"), false);
  await act(async () => host(view.tree, "player-next-exercise-shortcut").props.onPress());
  assert.equal(view.list().props.currentIndex, 3);
  assert.equal(host(view.tree, "player-next-exercise-shortcut").props.disabled, true);
  await view.remount(); assert.equal(view.list().props.currentIndex, 3);
  await choose(view, 1); assert.equal(input(view).props.setRow.reps, "9");
  await act(async () => view.tree.unmount());
});

test("opening the list pauses a captured transition and selection cancels it immediately", async () => {
  const view = await player({ local: (local) => ({ ...confirmed(local), restEndsAt: Date.now() + 90000, restTotalSeconds: 90, restContext: { exerciseId: "bench", isLastSetOfExercise: true } }) });
  await act(async () => rest(view).props.onExpire());
  const timer = [...view.timers.values()].find((entry) => entry.delay === 2200); assert.ok(timer);
  await act(async () => { host(view.tree, "player-exercise-list-button").props.onPress(); timer.callback(); });
  assert.equal(view.list().props.currentIndex, 1); assert.equal(view.list().props.visible, true);
  await choose(view, 0); await act(async () => timer.callback());
  assert.equal(view.list().props.currentIndex, 0); assert.equal(view.list().props.visible, false);
  await act(async () => view.tree.unmount());
});

test("rest adjustments and same-turn navigation persist the live deadline", async () => {
  const deadline = Date.now() + 90000;
  const view = await player({ local: { restEndsAt: deadline, restTotalSeconds: 90, restContext: { exerciseId: "bench", isLastSetOfExercise: false } } });
  await act(async () => { rest(view).props.onAdjust(15); view.list().props.onSelect(2); });
  assert.equal(rest(view).props.restEndsAt, deadline + 15000);
  assert.equal((await view.store.loadActiveWorkout("A")).restEndsAt, deadline + 15000);
  await act(async () => view.tree.unmount());
});

test("offline navigation preserves the chosen exercise and drafts through restart without session mutations", async () => {
  const view = await player({ offline: true });
  await act(async () => { input(view).props.onUpdate(1, "reps", "7"); input(view).props.onUpdate(1, "weight", "35"); });
  await choose(view, 3); await view.remount(); assert.equal(view.list().props.currentIndex, 3);
  await choose(view, 1); assert.equal(input(view).props.setRow.reps, "7"); assert.equal(input(view).props.setRow.weight, "35");
  assert.equal(view.calls.some((call) => ["log", "replace"].includes(call[0])), false);
  await act(async () => view.tree.unmount());
});

test("a delayed background acknowledgement cannot replace a newer selection, rest suppression or draft", async () => {
  const view = await player({ deferReplay: true, local: (local) => ({ ...local,
    restEndsAt: Date.now() + 90000, restTotalSeconds: 90, restContext: { exerciseId: "bench", isLastSetOfExercise: false },
    sets: local.sets.map((set) => set.exerciseId === "bench" && set.setNumber === 1 ? { ...set, confirmed: true, reps: "8", weight: "40", syncStatus: "pending" } : set),
    operations: [{ id: "queued-set", type: "set", status: "pending", payload: { exerciseId: "bench", setNumber: 1, reps: 8, weightKg: 18.14 } }] }) });
  await view.runTimers(); await view.replayStarted.promise;
  assert.equal(view.list().props.selectionDisabled, false);
  await choose(view, 2);
  await act(async () => { input(view).props.onUpdate(1, "reps", "12"); input(view).props.onUpdate(1, "weight", "30"); });
  await act(async () => view.replayResponse.resolve()); await view.settle();
  assert.equal(view.list().props.currentIndex, 2); assert.equal(input(view).props.setRow.reps, "12");
  assert.equal(rest(view).props.exerciseName, "bench");
  const durable = await view.store.loadActiveWorkout("A");
  assert.equal(durable.currentExerciseId, "row"); assert.equal(durable.restContext.suppressAutoAdvance, true);
  assert.equal(durable.sets.find((set) => set.exerciseId === "row" && set.setNumber === 1).reps, "12");
  assert.equal(durable.sets.find((set) => set.exerciseId === "bench" && set.setNumber === 1).logId, "log-bench-1");
  assert.equal(view.calls.filter((call) => call[0] === "log").length, 1);
  await act(async () => view.tree.unmount());
});

test("selection is guarded synchronously while arrangement changes are in flight", async () => {
  const view = await player(), oldSelect = view.list().props.onSelect;
  await act(async () => { void view.controller().openReplacement("bench"); oldSelect(2); });
  assert.equal(view.list().props.currentIndex, 1);
  await view.settle();
  await act(async () => view.tree.unmount());
});

test("a fresh logged set replaces suppressed rest and retains legacy automatic completion behavior", async () => {
  const deadline = Date.now() + 30000;
  const view = await player({ local: (local) => ({ ...local, restEndsAt: deadline, restTotalSeconds: 90, restContext: { exerciseId: "bench", isLastSetOfExercise: false },
    sets: local.sets.map((set) => set.exerciseId === "row" && set.setNumber > 1 ? { ...set, confirmed: true, reps: "8", weight: "25", logId: `row-${set.setNumber}` } : set) }) });
  const oldExpiry = rest(view).props.onExpire;
  await choose(view, 2);
  await act(async () => { input(view).props.onUpdate(1, "reps", "8"); input(view).props.onUpdate(1, "weight", "25"); });
  await act(async () => input(view).props.onConfirm(1)); await view.settle();
  const durable = await view.store.loadActiveWorkout("A");
  assert.equal(durable.restContext.exerciseId, "row"); assert.equal(durable.restContext.suppressAutoAdvance, undefined);
  assert.equal(durable.restContext.isLastSetOfExercise, true); assert.ok(durable.restEndsAt > deadline);
  await act(async () => oldExpiry()); assert.equal(rest(view).props.restEndsAt, durable.restEndsAt);
  await act(async () => rest(view).props.onExpire());
  const timer = [...view.timers.values()].find((entry) => entry.delay === 2200); assert.ok(timer);
  await act(async () => timer.callback()); assert.equal(view.list().props.currentIndex, 3);
  await act(async () => view.tree.unmount());
});

test("finishing and pending replacement states disable both navigation entry points and row selection", async () => {
  for (const operation of [
    { id: "finish", type: "complete", status: "failed", payload: {} },
    { id: "replacement", type: "replace", status: "failed", payload: { exerciseId: "bench", replacementExerciseId: "fly", expectedRevision: 0 } },
  ]) {
    const view = await player({ local: { operations: [operation] } });
    assert.equal(view.list().props.selectionDisabled, true);
    assert.equal(host(view.tree, "player-exercise-list-button").props.disabled, true);
    const control = host(view.tree, "player-choose-exercise"); if (control) assert.equal(control.props.disabled, true);
    const before = await view.store.loadActiveWorkout("A"); await choose(view, 2);
    assert.equal(view.list().props.currentIndex, 1); assert.equal((await view.store.loadActiveWorkout("A")).currentExerciseId, before.currentExerciseId);
    await act(async () => view.tree.unmount());
  }
});

test("old selection callbacks cannot navigate after account ABA or component restart", async () => {
  const view = await player(), oldSelect = view.list().props.onSelect;
  await view.auth("B"); await view.auth("A");
  const before = await view.store.loadActiveWorkout("A");
  await act(async () => oldSelect(3));
  assert.equal(view.list().props.currentIndex, 1); assert.equal((await view.store.loadActiveWorkout("A")).currentExerciseId, before.currentExerciseId);
  const preRestartSelect = view.list().props.onSelect; await view.remount(); await act(async () => preRestartSelect(3));
  assert.equal(view.list().props.currentIndex, 1);
  await act(async () => view.tree.unmount());
});

test("exercise sheet dismissal restores accessible focus to its visible opening control", async () => {
  const view = await player();
  await act(async () => host(view.tree, "player-choose-exercise").props.onPress());
  await choose(view, 2);
  const modal = view.tree.root.findAllByType("Modal").find((node) => node.props.onDismiss);
  await act(async () => modal.props.onDismiss());
  assert.deepEqual(view.calls.filter((call) => call[0] === "focus"), [["focus", 23]]);
  await act(async () => modal.props.onDismiss());
  assert.equal(view.calls.filter((call) => call[0] === "focus").length, 1);
  await act(async () => view.tree.unmount());
});

for (const layout of ["focus", "all"]) test(`${layout} exercise info returns accessibility focus to its card trigger`, async () => {
  const view = await player({ layout });
  const id = layout === "all" ? "player-all-info-row" : "player-exercise-info";
  await act(async () => host(view.tree, id).props.onPress());
  assert.equal(infoSheet(view).props.visible, true);
  const modal = view.tree.root.findAllByType("Modal").find((node) => node.props.onDismiss);
  await act(async () => infoSheet(view).props.onClose());
  await act(async () => modal.props.onDismiss());
  assert.deepEqual(view.calls.filter((call) => call[0] === "focus"), [["focus", 23]]);
  await act(async () => modal.props.onDismiss());
  assert.equal(view.calls.filter((call) => call[0] === "focus").length, 1);
  await act(async () => view.tree.unmount());
});

test("a late info dismiss cannot steal focus from a reopened info sheet", async () => {
  const view = await player({ layout: "all" });
  await act(async () => host(view.tree, "player-all-info-row").props.onPress());
  const dismiss = view.tree.root.findAllByType("Modal").find((node) => node.props.onDismiss).props.onDismiss;
  await act(async () => infoSheet(view).props.onClose());
  await act(async () => { host(view.tree, "player-all-info-bench").props.onPress(); dismiss(); });
  assert.equal(view.calls.filter((call) => call[0] === "focus").length, 0);
  await act(async () => infoSheet(view).props.onClose());
  await act(async () => dismiss());
  assert.equal(view.calls.filter((call) => call[0] === "focus").length, 1);
  await act(async () => view.tree.unmount());
});

test("same-turn selection waits for an entered-set save, then becomes available again", async () => {
  let pause = false; const writing = deferred(), release = deferred();
  const view = await player({ beforeWrite: async (key) => { if (pause && key.includes("active-workout")) { writing.resolve(); await release.promise; } } });
  await act(async () => { input(view).props.onUpdate(1, "reps", "8"); input(view).props.onUpdate(1, "weight", "40"); }); await view.settle();
  const oldSelect = view.list().props.onSelect; pause = true;
  await act(async () => { input(view).props.onConfirm(1); oldSelect(2); }); await writing.promise;
  assert.equal(view.list().props.currentIndex, 1); assert.equal(view.list().props.selectionDisabled, true);
  assert.equal(host(view.tree, "player-next-exercise-shortcut").props.disabled, true);
  pause = false; await act(async () => release.resolve()); await view.settle();
  assert.equal(view.list().props.selectionDisabled, false); assert.equal(host(view.tree, "player-next-exercise-shortcut").props.disabled, false);
  await choose(view, 2); assert.equal(view.list().props.currentIndex, 2);
  await act(async () => view.tree.unmount());
});

test("the actual rest component labels its original exercise while navigating elsewhere", async () => {
  const view = await player({ realRestTimer: true, local: { restEndsAt: Date.now() + 90000, restTotalSeconds: 90, restContext: { exerciseId: "bench", isLastSetOfExercise: false } } });
  await choose(view, 2);
  const texts = view.tree.root.findAllByType("Text");
  assert.ok(texts.some((node) => node.children.join("") === "Resting · bench"));
  for (const text of texts) if (text.children.join("").includes("Resting")) assert.equal(text.props.numberOfLines, undefined);
  assert.equal(host(view.tree, "player-rest-skip").props.disabled, false);
  await act(async () => host(view.tree, "player-rest-skip").props.onPress());
  assert.equal(view.list().props.currentIndex, 2); assert.equal(host(view.tree, "player-rest-skip"), undefined);
  await act(async () => view.tree.unmount());
});

test("manual selection wins an expiry callback in the same event turn", async () => {
  const view = await player({ local: (local) => ({ ...confirmed(local), restEndsAt: Date.now() + 90000, restTotalSeconds: 90, restContext: { exerciseId: "bench", isLastSetOfExercise: true } }) });
  const expiry = rest(view).props.onExpire;
  await act(async () => { view.list().props.onSelect(2); expiry(); });
  assert.equal(view.list().props.currentIndex, 2); assert.equal(rest(view), undefined);
  assert.equal([...view.timers.values()].some((timer) => timer.delay === 2200), false);
  await act(async () => view.tree.unmount());
});

test("selection callbacks from an earlier same-account session route cannot act after route ABA", async () => {
  const view = await player(), oldSelect = view.list().props.onSelect;
  await view.route({ sessionId: "another-session" }); await view.route({ sessionId: "session" });
  await act(async () => oldSelect(3)); assert.equal(view.list().props.currentIndex, 1);
  await choose(view, -1); await choose(view, 99); assert.equal(view.list().props.currentIndex, 1);
  await act(async () => view.tree.unmount());
});

test("Android focus restoration waits until every shared overlay closes", async () => {
  const view = await player({ platform: "android" });
  await act(async () => host(view.tree, "player-choose-exercise").props.onPress());
  await act(async () => { view.list().props.onClose(); view.controller().setGuidance({ id: "bench", name: "bench" }); });
  assert.equal(view.calls.filter((call) => call[0] === "focus").length, 0);
  await act(async () => view.controller().setGuidance(null));
  assert.equal(view.calls.filter((call) => call[0] === "focus").length, 1);
  await act(async () => view.tree.unmount());
});

test("a late native dismiss does not consume the focus target of a reopened list", async () => {
  const view = await player();
  await act(async () => host(view.tree, "player-choose-exercise").props.onPress());
  const dismiss = view.tree.root.findAllByType("Modal").find((node) => node.props.onDismiss).props.onDismiss;
  await act(async () => view.list().props.onClose());
  await act(async () => { host(view.tree, "player-choose-exercise").props.onPress(); dismiss(); }); assert.equal(view.calls.filter((call) => call[0] === "focus").length, 0);
  await act(async () => view.list().props.onClose()); await act(async () => dismiss());
  assert.equal(view.calls.filter((call) => call[0] === "focus").length, 1);
  await act(async () => view.tree.unmount());
});
