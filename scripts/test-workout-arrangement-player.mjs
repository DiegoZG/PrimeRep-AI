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
async function player() {
  const memory = new Map(), timers = new Map(), intervals = new Map(), calls = [];
  let timerCounter = 0;
  const AuthContext = React.createContext(null), EquipmentWeightsContext = React.createContext(null);
  let server = { id: "session", clientSessionId: "client", workoutDayId: "day", workoutDate: workout.date, dayType: "upper", arrangementRevision: 0,
    effectiveWorkout: api(workout), workoutSnapshot: api(workout), status: "in_progress", startedAt: new Date(100).toISOString(), setLogs: [], deletedSetLogs: [], exerciseFeedback: [], workoutNote: null };
  const replacementStarted = deferred(), replacementResponse = deferred();
  const native = { ActivityIndicator: "ActivityIndicator", Alert: { alert() {} }, AppState: { addEventListener: () => ({ remove() {} }) }, Keyboard: { dismiss() {}, addListener: () => ({ remove() {} }) },
    KeyboardAvoidingView: "KeyboardAvoidingView", Modal: "Modal", Platform: { OS: "web", select: (values) => values.web ?? values.default }, Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", TextInput: "TextInput", TouchableWithoutFeedback: "TouchableWithoutFeedback", View: "View", useWindowDimensions: () => ({ width: 375, height: 812, fontScale: 1 }) };
  const activeWorkout = { markWorkoutTerminal() {} };
  const router = { replace: (route) => calls.push(["route", route]) }, week = { getWorkoutById: () => workout, isLoading: false, refreshWeek: async () => {} };
  const services = {
    getActiveSession: async () => copy(server), getSession: async () => copy(server), getUserExerciseNote: async () => null, fetchLastSetsForExercises: async () => ({}),
    getReplacementCandidates: async () => [{ id: "fly", name: "Chest Fly" }],
    previewExerciseOrder: async (_token, _session, ids) => ({ arrangementRevision: server.arrangementRevision, exerciseIds: ids, targetsChanged: false, targetChanges: [], effectiveWorkout: server.effectiveWorkout, message: "Targets unchanged." }),
    updateExerciseOrder: async (_token, _session, ids) => { const byId = new Map(server.effectiveWorkout.exerciseBlocks.flatMap((block) => block.items.map((item) => [item.exercise.id, item]))); server = { ...server, arrangementRevision: server.arrangementRevision + 1, effectiveWorkout: api({ ...workout, blocks: [{ blockType: "main", items: ids.map((id) => byId.get(id)) }] }) }; return copy(server); },
    replaceSessionExercise: async (...args) => { calls.push(["replace", ...args]); replacementStarted.resolve(); await replacementResponse.promise; server = { ...server, arrangementRevision: server.arrangementRevision + 1, effectiveWorkout: api({ ...workout, blocks: workout.blocks.map((block) => ({ ...block, items: block.items.map((entry) => entry.exercise.id === "bench" ? item("fly") : entry) })) }) }; return copy(server); },
  };
  class HttpError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const mocks = { react: React, "react-native": native, "@expo/vector-icons": { Ionicons: "Ionicons" }, "expo-av": { Audio: { Sound: { createAsync: async () => ({ sound: { unloadAsync() {}, replayAsync() {} } }) } } }, "expo-status-bar": { StatusBar: "StatusBar" },
    "expo-router": { useRouter: () => router, useLocalSearchParams: () => ({ sessionId: "session" }) }, "expo-haptics": { notificationAsync: async () => {}, impactAsync: async () => {}, NotificationFeedbackType: { Success: "success" }, ImpactFeedbackStyle: { Medium: "medium" } },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView", useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }, "@/hooks/use-color-scheme": { useColorScheme: () => "light" }, "@/hooks/use-workout-week": { useWorkoutWeek: () => week },
    "@/utils/authContext": { AuthContext }, "@/utils/equipmentWeightsContext": { EquipmentWeightsContext }, "@/utils/activeWorkoutContext": { useActiveWorkout: () => activeWorkout },
    "@/components/workout/ExerciseListSheet": { ExerciseListSheet: "ExerciseListSheet" }, "@/components/workout/ExerciseInfoSheet": { ExerciseInfoSheet: "ExerciseInfoSheet" }, "@/components/workout/WorkoutArrangementSheets": { WorkoutArrangementSheets: "WorkoutArrangementSheets" },
    "@/components/workout/RestTimer": { RestTimer: "RestTimer" }, "@/components/workout/SetInputRow": { SetInputRow: "SetInputRow" }, "@/components/workout/WeightUnitControl": { WeightUnitControl: "WeightUnitControl" }, "@/components/workout/WorkoutText": { WorkoutText: (props) => React.createElement("Text", props) },
    "@react-native-async-storage/async-storage": { getItem: async (key) => memory.get(key) ?? null, setItem: async (key, value) => { memory.set(key, value); }, removeItem: async (key) => memory.delete(key) },
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
  await store.saveActiveWorkout(local);
  const { default: Screen } = load("app/workout/active.tsx");
  const element = React.createElement(AuthContext.Provider, { value: { token: "token", user: { id: "A" } } }, React.createElement(EquipmentWeightsContext.Provider, { value: { hasLoaded: true, dumbbellWeights: [], plateWeights: [] } }, React.createElement(Screen)));
  let tree; await act(async () => { tree = create(element); });
  const settle = async () => { await act(async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); }); };
  await settle();
  const runTimers = async () => { await act(async () => { const pending = [...timers]; for (const [id, timer] of pending) if (timer.delay === 0) { timers.delete(id); timer.callback(); } }); await settle(); };
  const list = () => tree.root.findByType("ExerciseListSheet");
  const controller = () => tree.root.findByType("WorkoutArrangementSheets").props.controller;
  return { tree, store, calls, list, controller, settle, runTimers, replacementStarted, replacementResponse, getServer: () => copy(server), memory };
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
