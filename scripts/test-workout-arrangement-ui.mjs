import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import ts from "typescript";
import { loadTypescript } from "./helpers/load-typescript.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plain = (value) => JSON.parse(JSON.stringify(value));
function load(relative, mocks) {
  const filename = path.join(root, relative), module = { exports: {} }, fallback = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console }, { filename });
  return module.exports;
}
const arrangement = loadTypescript("utils/workoutArrangement.ts", { "@react-native-async-storage/async-storage": {}, "./httpClient": {}, "@/services/httpClient": {} });
const item = (id) => ({ exercise: { id, name: id.toUpperCase(), requiredEquipmentIds: [] }, prescription: { sets: 2, reps: "8-12", restSeconds: 60 } });
const workout = { workoutDayId: "day", date: "2026-10-23", title: "Upper A", dayType: "upper", blocks: [{ blockType: "main", items: [item("press")] }, { blockType: "accessory", items: [item("row")] }] };
const apiWorkout = (value) => ({ ...value, exerciseBlocks: value.blocks });
const initial = () => ({ userId: "A", clientSessionId: "client", serverSessionId: "session", workoutSnapshot: plain(workout), effectiveWorkout: plain(workout), arrangementRevision: 0,
  workoutDayId: "day", workoutDate: "2026-10-23", dayType: "upper", startedAt: 1, revision: 1, currentExerciseId: "press", currentExerciseIndex: 0,
  restEndsAt: 1234, restTotalSeconds: 60, restContext: { exerciseId: "press", isLastSetOfExercise: false }, operations: [], sets: workout.blocks.flatMap((block) => block.items.flatMap((item) => [1, 2].map((setNumber) => ({ exerciseId: item.exercise.id, setNumber, reps: "", weight: "", confirmed: false, syncing: false, syncStatus: "synced", logId: null })))) });
class HttpError extends Error { constructor(message, status) { super(message); this.status = status; } }
async function harness(options = {}) {
  let local = options.local ?? initial(), online = options.online ?? true, counter = 0, controller;
  let server = { id: "session", status: "in_progress", arrangementRevision: 0, workoutSnapshot: apiWorkout(workout), effectiveWorkout: apiWorkout(workout), setLogs: [], deletedSetLogs: [] };
  const calls = [];
  const service = {
    getSession: async () => { calls.push("session"); if (!online) throw new HttpError("Offline"); return plain(server); },
    previewExerciseOrder: async (_token, _session, ids, revision) => { calls.push("preview"); if (!online) throw new HttpError("Offline"); return { arrangementRevision: revision, exerciseIds: ids, targetsChanged: true, targetChanges: [{ exerciseId: "row", fromBlockType: "accessory", toBlockType: "main", before: item("row").prescription, after: { sets: 3, reps: "6-8", restSeconds: 90 } }], effectiveWorkout: server.effectiveWorkout, message: "You can revise targets." }; },
    getReplacementCandidates: async () => { calls.push("candidates"); return options.candidates ? options.candidates() : [{ id: "fly", name: "Fly" }]; },
  };
  const store = {
    createClientId: () => `op-${++counter}`, loadActiveWorkout: async () => plain(local), saveActiveWorkout: async (value) => { calls.push(["save", plain(value.operations)]); local = plain(value); },
    replayPendingWorkoutOperations: async () => {
      calls.push("replay"); if (!online) throw new HttpError("Offline");
      if (options.replay) local = await options.replay(local, server, calls);
      else {
        const remaining = [];
        for (const operation of local.operations) {
          if (operation.type === "order" && operation.payload.conflict) { remaining.push(operation); continue; }
          if (operation.type === "order" && operation.payload.requiresReview) local.targetReviewExerciseIds = operation.payload.exerciseIds;
          if (operation.type === "order") { calls.push(["order", plain(operation)]); server.effectiveWorkout = apiWorkout(arrangement.reorderWorkout({ ...server.effectiveWorkout, blocks: server.effectiveWorkout.exerciseBlocks }, operation.payload.exerciseIds)); server.arrangementRevision++; }
          else if (operation.type === "replace") { calls.push(["replace", plain(operation)]); server.effectiveWorkout = apiWorkout({ ...workout, blocks: [{ blockType: "main", items: [item(operation.payload.replacementExerciseId)] }, workout.blocks[1]] }); server.arrangementRevision++; }
        }
        local = arrangement.adoptSessionArrangement({ ...local, operations: remaining }, server);
      }
      return { workout: plain(local), startedOperationIds: [], completed: false, abandoned: false };
    },
  };
  const { useWorkoutArrangement } = load("hooks/use-workout-arrangement.ts", { react: React, "@/services/httpClient": { HttpError }, "@/services/workoutLoggingService": service, "@/utils/activeWorkoutStore": store, "@/utils/workoutArrangement": arrangement });
  function Probe({ account = "A", sessionKey = "client" }) { controller = useWorkoutArrangement({ token: `token-${account}`, userId: account, sessionKey, snapshot: () => plain(local), apply: (value) => { local = plain(value); }, persist: async () => { calls.push("persist"); } }); return null; }
  let tree; await act(async () => { tree = create(React.createElement(Probe)); });
  const invoke = async (name, ...args) => { await act(async () => { controller[name](...args); }); };
  return { get controller() { return controller; }, get local() { return local; }, calls, tree, invoke, setOnline: (value) => online = value, setServer: (value) => server = { ...server, ...value }, setOwner: async (account) => { await act(async () => tree.update(React.createElement(Probe, { account }))); }, setSession: async (sessionKey) => { await act(async () => tree.update(React.createElement(Probe, { sessionKey }))); } };
}
test("online order flushes writes, previews targets and preserves original and rest identity", async () => {
  const view = await harness(); await view.invoke("move", "row", 0);
  assert.ok(view.calls.indexOf("replay") < view.calls.indexOf("preview")); assert.equal(view.controller.review.preview.targetsChanged, true);
  await view.invoke("applyOrder", false);
  const op = view.calls.find((call) => Array.isArray(call) && call[0] === "order")[1];
  assert.equal(op.payload.expectedRevision, 0); assert.equal(op.payload.applyRevisedTargets, false);
  assert.deepEqual(view.local.effectiveWorkout.blocks.flatMap((block) => block.items.map((item) => item.exercise.id)), ["row", "press"]);
  assert.equal(view.local.currentExerciseId, "row"); assert.equal(view.local.restContext.exerciseId, "press"); assert.equal(view.local.restEndsAt, 1234);
  assert.deepEqual(view.local.workoutSnapshot, workout); await act(async () => view.tree.unmount());
});
test("typed rows keep their numbers and suppress revised targets", async () => {
  const local = initial(); local.sets[2] = { ...local.sets[2], reps: "15", weight: "12", hasUnsavedInput: true };
  const view = await harness({ local }); await view.invoke("move", "row", 0);
  assert.equal(view.controller.review.preview.targetsChanged, false); assert.equal(view.local.sets[2].reps, "15");
  await view.invoke("applyOrder", true); assert.equal(view.calls.find((call) => Array.isArray(call) && call[0] === "order")[1].payload.applyRevisedTargets, false);
  assert.equal(view.local.sets.find((set) => set.exerciseId === "row").weight, "12"); await act(async () => view.tree.unmount());
});
test("offline order survives restart and reconnect syncs unchanged targets before optional review", async () => {
  const first = await harness({ online: false }); await first.invoke("move", "row", 0);
  assert.equal(first.local.operations[0].payload.requiresReview, true); assert.equal(first.local.effectiveWorkout.blocks[0].items[0].exercise.id, "row");
  const saved = plain(first.local); await act(async () => first.tree.unmount());
  const second = await harness({ local: saved }); await second.invoke("reviewPending"); assert.ok(second.controller.review); assert.equal(second.calls.filter((call) => Array.isArray(call) && call[0] === "order").length, 1); assert.equal(second.calls.find((call) => Array.isArray(call) && call[0] === "order")[1].payload.applyRevisedTargets, false);
  await second.invoke("applyOrder", false); assert.equal(second.local.operations.length, 0); await act(async () => second.tree.unmount());
});
test("replacement flushes first, asks before discarding typed rows, and sends durable ID", async () => {
  const local = initial(); local.sets[0].hasUnsavedInput = true; local.sets[0].reps = "9";
  const view = await harness({ local }); await view.invoke("openReplacement", "press"); assert.ok(view.calls.indexOf("replay") < view.calls.indexOf("candidates")); assert.equal(view.controller.picker.discard, true);
  await view.invoke("setPicker", { ...view.controller.picker, selected: view.controller.picker.candidates[0] });
  await view.invoke("confirmReplacement");
  const op = view.calls.find((call) => Array.isArray(call) && call[0] === "replace")[1];
  const save = view.calls.find((call) => Array.isArray(call) && call[0] === "save" && call[1].some((item) => item.id === op.id)); assert.ok(save);
  assert.equal(view.local.currentExerciseId, "fly"); assert.equal(view.local.sets.some((set) => set.exerciseId === "press"), false); assert.deepEqual(view.local.workoutSnapshot, workout); await act(async () => view.tree.unmount());
});
test("source exercise with a saved or pending set never opens replacement", async () => {
  const local = initial(); local.sets[0] = { ...local.sets[0], confirmed: true, reps: "8" }; local.operations = [{ id: "set-op", type: "set", status: "pending", payload: { exerciseId: "press", setNumber: 1, reps: 8 } }];
  const view = await harness({ local, replay: async (local) => local }); await view.invoke("openReplacement", "press"); assert.equal(view.controller.picker, null); assert.equal(view.calls.includes("candidates"), false); assert.match(view.controller.message, /Sync pending/); await act(async () => view.tree.unmount());
});
test("another device replacement invalidates pending permutation and offers latest workout", async () => {
  const local = initial(); local.operations = [{ id: "order", type: "order", status: "failed", payload: { exerciseIds: ["row", "press"], expectedRevision: 0, applyRevisedTargets: false, conflict: true } }];
  const view = await harness({ local, replay: async (local) => local }); view.setServer({ arrangementRevision: 1, effectiveWorkout: apiWorkout({ ...workout, blocks: [{ blockType: "main", items: [item("fly")] }, workout.blocks[1]] }) });
  await view.invoke("reviewPending"); assert.equal(view.controller.review.invalid, true); assert.equal(view.local.effectiveWorkout.blocks[0].items[0].exercise.id, "fly");
  await view.invoke("applyOrder", false); assert.equal(view.calls.some((call) => Array.isArray(call) && call[0] === "order"), false);
  await view.invoke("dismissPending"); assert.equal(view.local.operations.length, 0); await act(async () => view.tree.unmount());
});

const native = { Modal: "Modal", Pressable: "Pressable", ScrollView: "ScrollView", View: "View", Text: "Text", ActivityIndicator: "ActivityIndicator", Platform: { OS: "ios", select: (values) => values.ios } };
const { Colors, Fonts } = load("constants/theme.ts", { "react-native": native });
const host = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const textOf = (node) => typeof node === "string" ? node : (node?.children?.map(textOf).join(" ") ?? "").replace(/\s+/g, " ").trim();
for (const scheme of ["light", "dark"]) {
  test(`${scheme}: exercise sheet drag and accessible move actions use stable exercise IDs`, async () => {
    const calls = [], colors = Colors[scheme];
    const mocks = { react: React, "react-native": { ...native, useWindowDimensions: () => ({ width: 320, fontScale: 3 }), AccessibilityInfo: { announceForAccessibility: (message) => calls.push(["announce", message]) } },
      "@expo/vector-icons": { Ionicons: "Ionicons" }, "@/constants/theme": { Colors }, "@/components/workout/WorkoutText": { WorkoutText: (props) => React.createElement("Text", props) }, "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
      "react-native-worklets": { scheduleOnRN: (callback, ...args) => callback(...args) },
      "react-native-reanimated": { __esModule: true, default: { View: "AnimatedView" }, LinearTransition: { duration: () => ({ reduceMotion: () => ({}) }) }, ReduceMotion: { System: "system" }, useReducedMotion: () => true, useSharedValue: (value) => React.useRef({ value }).current, useAnimatedStyle: (callback) => callback(), withTiming: (value) => value },
      "react-native-gesture-handler": { GestureDetector: "GestureDetector", GestureHandlerRootView: "GestureHandlerRootView", Gesture: { Pan: () => { const gesture = { callbacks: {}, enabled(value) { this.isEnabled = value; return this; }, minDistance() { return this; }, onStart(cb) { this.callbacks.start = cb; return this; }, onUpdate(cb) { this.callbacks.update = cb; return this; }, onEnd(cb) { this.callbacks.end = cb; return this; }, onFinalize(cb) { this.callbacks.finalize = cb; return this; } }; return gesture; } } },
    };
    const { ExerciseListSheet } = load("components/workout/ExerciseListSheet.tsx", mocks);
    const props = { visible: true, exercises: [item("press"), item("row")], currentIndex: 0, colors, getProgress: (id) => ({ confirmed: id === "press" ? 1 : 0, total: 2 }), onSelect: (index) => calls.push(["select", index]), onClose: () => calls.push(["close"]), canArrange: true, onMove: (id, destination) => calls.push(["move", id, destination]), onReplace: (id) => calls.push(["replace", id]), canReplace: (id) => id !== "press" };
    let tree; await act(async () => { tree = create(React.createElement(ExerciseListSheet, props)); });
    assert.equal(host(tree, "player-move-up-press").props.disabled, true); assert.equal(host(tree, "player-replace-press").props.disabled, true);
    await act(async () => host(tree, "player-order-handle-row").props.onAccessibilityAction({ nativeEvent: { actionName: "decrement" } }));
    assert.deepEqual(calls.find((call) => call[0] === "move"), ["move", "row", 0]);
    assert.ok(calls.some((call) => call[0] === "announce"));
    const gesture = tree.root.findAllByType("GestureDetector")[0].props.gesture;
    await act(async () => { gesture.callbacks.start(); gesture.callbacks.update({ translationY: 220 }); gesture.callbacks.end({ translationY: 220 }); });
    assert.ok(calls.some((call) => call[0] === "move" && call[1] === "press" && call[2] === 1));
    await act(async () => host(tree, "player-replace-row").props.onPress()); assert.ok(calls.some((call) => call[0] === "replace" && call[1] === "row"));
    for (const text of tree.root.findAllByType("Text")) assert.equal(text.props.numberOfLines, undefined);
    await act(async () => tree.update(React.createElement(ExerciseListSheet, { ...props, canArrange: false })));
    assert.equal(host(tree, "player-order-handle-row"), undefined); assert.equal(host(tree, "player-replace-row"), undefined);
    await act(async () => tree.unmount());
  });
}
test("replacement confirmation explicitly warns about discarded inputs and keeps guidance available", async () => {
  const calls = [], controller = { picker: { exerciseId: "press", candidates: [{ id: "fly", name: "Fly" }], selected: { id: "fly", name: "Fly" }, discard: true }, review: null, busy: false, guidance: null,
    setPicker: (value) => calls.push(["picker", value]), setGuidance: (value) => calls.push(["guidance", value]), confirmReplacement: () => calls.push(["confirm"]), setReview() {} };
  const { WorkoutArrangementSheets } = load("components/workout/WorkoutArrangementSheets.tsx", { react: React, "react-native": native, "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@/components/workout/WorkoutText": { WorkoutText: (props) => React.createElement("Text", props) }, "@/constants/theme": { Colors } });
  let tree; await act(async () => { tree = create(React.createElement(WorkoutArrangementSheets, { controller, colors: Colors.light, exercises: [item("press"), item("row")] })); });
  assert.match(textOf(host(tree, "player-replacement-discard-warning")), /unsaved entries.*discarded/);
  assert.equal(host(tree, "player-replacement-confirm").props.accessibilityLabel, "Discard entries and replace");
  await act(async () => host(tree, "player-replacement-guidance").props.onPress()); assert.deepEqual(calls[0], ["guidance", { id: "fly", name: "Fly" }]);
  await act(async () => host(tree, "player-replacement-confirm").props.onPress()); assert.ok(calls.some((call) => call[0] === "confirm"));
  await act(async () => tree.unmount());
});

test("delayed replacement candidates are fenced after account changes", async () => {
  let resolve;
  const pending = new Promise((done) => { resolve = done; });
  const view = await harness({ candidates: () => pending });
  await view.invoke("openReplacement", "press");
  assert.equal(view.controller.busy, true);
  await view.setOwner("B");
  await act(async () => resolve([{ id: "fly", name: "Fly" }]));
  assert.equal(view.controller.picker, null); assert.equal(view.controller.review, null); assert.equal(view.controller.message, "");
  assert.equal(view.local.userId, "A"); await act(async () => view.tree.unmount());
});
test("new offline session can queue order behind its durable create before restart", async () => {
  const local = initial(); local.serverSessionId = null; local.arrangementRevision = 0;
  local.operations = [{ id: "create", type: "create", status: "pending", payload: { workoutDayId: "day", workoutDate: "2026-10-23", dayType: "upper", clientSessionId: "client" } }];
  const view = await harness({ local, online: false }); await view.invoke("move", "row", 0);
  assert.deepEqual(view.local.operations.map((operation) => operation.type), ["create", "order"]);
  assert.equal(view.local.operations[1].payload.expectedRevision, 0);
  assert.equal(view.local.effectiveWorkout.blocks[0].items[0].exercise.id, "row"); assert.deepEqual(view.local.workoutSnapshot, workout);
  await act(async () => view.tree.unmount());
});

test("delayed replacement candidates are fenced after same-account session changes", async () => {
  let resolve; const pending = new Promise((done) => { resolve = done; });
  const view = await harness({ candidates: () => pending }); await view.invoke("openReplacement", "press");
  await view.setSession("another-session"); await act(async () => resolve([{ id: "fly", name: "Fly" }]));
  assert.equal(view.controller.picker, null); assert.equal(view.controller.message, ""); await act(async () => view.tree.unmount());
});

test("inline exercise guidance keeps Close, Ask input and Send individually accessible", async () => {
  const AuthContext = React.createContext(null), calls = [];
  const nativeGuidance = { ...native, KeyboardAvoidingView: "KeyboardAvoidingView", TextInput: "TextInput" };
  const text = (props) => React.createElement("Text", props);
  const mocks = { react: React, "react-native": nativeGuidance, "@expo/vector-icons": { Ionicons: "Ionicons" }, "@/constants/theme": { Colors, Fonts },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView", useSafeAreaInsets: () => ({ top: 24, bottom: 0 }) },
    "@/components/themed-text": { ThemedText: text }, "@/components/workout/WorkoutText": { WorkoutText: text }, "@/utils/authContext": { AuthContext },
    "@/hooks/use-is-beginner": { useIsBeginner: () => false }, "@/services/exerciseService": { getExerciseById: async () => ({ id: "fly", name: "Chest Fly", howTo: "Bring your arms together." }) },
    "@/components/exercises/ContentSection": { ContentSection: "ContentSection" }, "@/components/exercises/ExerciseMedia": { ExerciseMedia: "ExerciseMedia" }, "@/components/screen-state": { ScreenState: "ScreenState" },
    "expo-router": { useRouter: () => ({ push() {} }) }, "@/services/httpClient": { HttpError }, "@/services/exerciseQaService": { listExerciseQuestions: async () => [], askExerciseQuestion: async () => ({ id: "qa", question: "How?", answer: "Slowly." }) },
  };
  mocks["@/components/exercises/ExerciseAskThread"] = load("components/exercises/ExerciseAskThread.tsx", mocks);
  const { ExerciseInfoSheet } = load("components/workout/ExerciseInfoSheet.tsx", mocks);
  let tree; await act(async () => { tree = create(React.createElement(AuthContext.Provider, { value: { user: { id: "A" } } }, React.createElement(ExerciseInfoSheet, { inline: true, visible: true, exerciseId: "fly", exerciseName: "Chest Fly", token: "token", isLoggedIn: true, colors: Colors.light, onClose: () => calls.push("close") }))); });
  assert.equal(tree.root.findAllByType("Modal").length, 0);
  for (const id of ["player-info-sheet-close", "exercise-ask-input", "exercise-ask-send"]) {
    const control = host(tree, id); assert.ok(control, id);
    for (let ancestor = control.parent; ancestor; ancestor = ancestor.parent) {
      if (ancestor.type === "Pressable") assert.equal(ancestor.props.accessible, false, `${id} must not be grouped into a parent Pressable`);
    }
  }
  const wrappers = tree.root.findAllByType("Pressable").filter((node) => node.props.accessible === false);
  assert.equal(wrappers.length, 2);
  let stopped = false; await act(async () => wrappers[1].props.onPress({ stopPropagation: () => { stopped = true; } })); assert.equal(stopped, true); assert.equal(calls.length, 0);
  await act(async () => host(tree, "player-info-sheet-close").props.onPress()); assert.deepEqual(calls, ["close"]);
  await act(async () => tree.unmount());
});
