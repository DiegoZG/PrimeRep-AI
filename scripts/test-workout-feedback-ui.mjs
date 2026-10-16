import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import ts from "typescript";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const route = "app/workout/active.tsx";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const plain = (value) => JSON.parse(JSON.stringify(value));
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const now = 1900000000000;
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

function load(file, mocks, calls, timers) {
  const module = { exports: {} };
  const output = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  class Clock extends Date { static now() { return now; } }
  vm.runInNewContext(output, {
    React, module, exports: module.exports, Date: Clock,
    console: { ...console, warn: (...args) => calls.warnings.push(args.map(String)) },
    setTimeout: (callback, delay) => timers.add("timeout", callback, delay), clearTimeout: (id) => timers.remove(id),
    setInterval: (callback, delay) => timers.add("interval", callback, delay), clearInterval: (id) => timers.remove(id),
    require: (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      calls.unexpected.push(`import:${name}:${file}`);
      throw new Error(`Unexpected import ${name} in ${file}`);
    },
  }, { filename: path.join(root, file) });
  return module.exports;
}

const exercise = (id, name) => ({ exercise: { id, name, exerciseType: "strength", primaryMuscle: "glutes", primaryMuscles: ["glutes"], secondaryMuscles: [], requiredEquipmentIds: [], loadProfile: null }, prescription: { sets: 1, reps: 8, restSeconds: 60, suggestedWeightKg: null }, exerciseRationale: "Controlled movement" });
const workout = { workoutDayId: "fixture-day", title: "Fixture workout", date: "2030-03-17", dayType: "full_body", durationMinutes: 35, isRest: false, blocks: [{ id: "main", title: "Main", items: [exercise("bridge", "Glute Bridge"), exercise("squat", "Bodyweight Squat")] }] };
const savedFeedback = { bridge: { effort: "right", rir: 2 }, squat: { effort: "easy", rir: 4 } };
const originalOperation = { id: "existing-note", type: "update_exercise_note", status: "failed", payload: { exerciseId: "squat", note: "Keep existing note" } };
const seed = (options) => ({
  userId: "fixture-owner", workoutDayId: workout.workoutDayId, workoutDate: workout.date, dayType: workout.dayType,
  workoutSnapshot: options.workout ?? workout, clientSessionId: "fixture-client", serverSessionId: "fixture-session", startedAt: now - 120000,
  currentExerciseIndex: options.index ?? 0, restEndsAt: null, restTotalSeconds: 77, restContext: null,
  sets: options.sets ?? workout.blocks[0].items.map((item) => ({ exerciseId: item.exercise.id, setNumber: 1, reps: "8", weight: "0", confirmed: true, syncing: false, syncStatus: "synced", logId: `log-${item.exercise.id}`, version: 3 })),
  operations: options.operations ?? [originalOperation], workoutNote: "Existing workout note", exerciseNotes: { squat: "Keep existing note" },
  exerciseFeedback: options.feedback ?? savedFeedback, revision: 7,
});

async function render(options = {}) {
  const calls = { saves: [], loads: [], routes: [], ids: [], storage: [], warnings: [], unexpected: [], audio: [], listeners: [], keyboard: [], haptics: [], batches: [], rowMounts: [], rowUnmounts: [] };
  const activeTimers = new Map();
  let timerId = 0;
  const timers = { add: (kind, callback, delay) => { const id = ++timerId; activeTimers.set(id, { kind, callback, delay }); return id; }, remove: (id) => activeTimers.delete(id) };
  const scheme = options.scheme ?? "light";
  const user = { id: "fixture-owner" };
  let local = plain(seed(options));
  const initial = plain(local);
  const unexpected = (name) => (...args) => { calls.unexpected.push(name); throw new Error(`Unexpected boundary ${name}: ${args.length} arguments`); };
  const subscriptions = new Set();
  const subscribe = (type) => (...args) => {
    const record = { type, event: args[0], callback: args[1] };
    subscriptions.add(record); calls.listeners.push(record);
    return { remove: () => subscriptions.delete(record) };
  };
  function Modal({ visible, children, ...props }) { return React.createElement("Modal", { ...props, visible }, visible ? children : null); }
  const native = {
    ActivityIndicator: "ActivityIndicator", View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", TextInput: "TextInput", TouchableWithoutFeedback: "TouchableWithoutFeedback", KeyboardAvoidingView: "KeyboardAvoidingView", Modal,
    StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (values) => values.ios ?? values.default },
    useWindowDimensions: () => dimensions,
    Keyboard: { dismiss: options.hostControls ? () => calls.keyboard.push("dismiss") : unexpected("keyboard.dismiss"), addListener: subscribe("keyboard") },
    AppState: { addEventListener: subscribe("appState"), currentState: "active" }, Alert: { alert: unexpected("alert") },
  };
  let dimensions = { width: 375, height: 667, fontScale: 1, scale: 2, ...options.dimensions };
  const AuthContext = React.createContext({ token: null, user });
  const EquipmentWeightsContext = React.createContext({ hasLoaded: true, error: null, dumbbellWeights: [], plateWeights: [] });
  const router = Object.fromEntries(["back", "replace", "push"].map((name) => [name, (...args) => calls.routes.push([name, plain(args)])]));
  const store = {
    loadActiveWorkout: async (owner) => { assert.equal(owner, user.id); calls.loads.push(owner); return plain(local); },
    saveActiveWorkout: async (snapshot) => { assert.equal(snapshot.userId, user.id); calls.saves.push(plain(snapshot)); local = plain(snapshot); },
    createClientId: () => { const id = `fixture-id-${calls.ids.length + 1}`; calls.ids.push(id); return id; },
    ...Object.fromEntries(["clearActiveWorkout", "continueWorkoutLogging", "queueWorkoutCompletion", "replayPendingWorkoutOperations", "retryFailedWorkoutOperations", "saveWorkoutSetEntries"].map((name) => [name, unexpected(name)])),
  };
  if (options.batchGate) store.saveWorkoutSetEntries = async (snapshot, keys, unit) => {
    calls.batches.push({ snapshot: plain(snapshot), keys: plain(keys), unit });
    const result = await options.batchGate.promise;
    if (result.workout) local = plain(result.workout);
    return result;
  };
  const sound = { unloadAsync: async () => calls.audio.push("unload"), replayAsync: unexpected("audio.replay") };
  const mocks = {
    react: React, "react-native": native, "@expo/vector-icons": { Ionicons: "Ionicons" },
    "expo-router": { useLocalSearchParams: () => ({ sessionId: "fixture-session" }), useRouter: () => router },
    "expo-status-bar": { StatusBar: "StatusBar" },
    "expo-av": { Audio: { Sound: { createAsync: async () => { calls.audio.push("load"); return { sound }; } } } },
    "expo-haptics": { NotificationFeedbackType: { Success: "Success" }, notificationAsync: options.hostControls ? async (value) => calls.haptics.push(value) : unexpected("haptics.notification") },
    "../../assets/sounds/rest-done.m4a": "mock-rest-sound",
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView", useSafeAreaInsets: () => ({ top: 47, bottom: options.bottomInset ?? 34, left: 0, right: 0 }) },
    "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@/hooks/use-workout-week": { useWorkoutWeek: () => ({ getWorkoutById: () => null, isLoading: false, refreshWeek: unexpected("refreshWeek") }) },
    "@/utils/authContext": { AuthContext }, "@/utils/equipmentWeightsContext": { EquipmentWeightsContext },
    "@/utils/activeWorkoutContext": { useActiveWorkout: () => ({ markWorkoutTerminal: terminal }) },
    "@/utils/activeWorkoutStore": store,
    "@/services/workoutWeekService": { mapApiWorkoutDay: unexpected("mapApiWorkoutDay") },
    "@/services/workoutLoggingService": Object.fromEntries(["abandonSession", "completeSession", "fetchLastSetsForExercises", "getActiveSession", "getSession", "getUserExerciseNote"].map((name) => [name, unexpected(name)])),
    "@react-native-async-storage/async-storage": { getItem: async (key) => { assert.equal(key, "primerep.weightUnit"); calls.storage.push(["read", key]); return options.unit ?? "KG"; }, setItem: unexpected("weightUnit.write") },
  };
  function terminal() { return unexpected("markWorkoutTerminal")(); }
  for (const name of ["ExerciseInfoSheet", "ExerciseListSheet", "RestTimer", "SetInputRow", "WeightUnitControl"]) mocks[`@/components/workout/${name}`] = { [name]: name };
  for (const [alias, file] of [
    ["@/constants/theme", "constants/theme.ts"], ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"],
    ["@/components/themed-text", "components/themed-text.tsx"], ["@/components/workout/WorkoutText", "components/workout/WorkoutText.tsx"],
    ["@/utils/weightUnits", "utils/weightUnits.ts"], ["@/utils/attainableLoads", "utils/attainableLoads.ts"], ["@/utils/workoutSetEntries", "utils/workoutSetEntries.ts"],
  ]) mocks[alias] = load(file, mocks, calls, timers);
  if (options.realRows) {
    const { SetInputRow: ActualRow } = load("components/workout/SetInputRow.tsx", mocks, calls, timers);
    let rowId = 0;
    function ObservedRow(props) {
      const [id] = React.useState(() => ++rowId);
      React.useEffect(() => { calls.rowMounts.push(id); return () => calls.rowUnmounts.push(id); }, [id]);
      return React.createElement(ActualRow, props);
    }
    mocks["@/components/workout/SetInputRow"] = { SetInputRow: ObservedRow };
  }
  const { default: Screen } = load(route, mocks, calls, timers);
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  const view = { tree, calls, initial, colors: mocks["@/constants/theme"].Colors[scheme], local: () => plain(local), timers: activeTimers, subscriptions };
  assert.ok(calls.loads.length >= 2, "actual requested-session and restore effects ran");
  if (!options.operations?.some((operation) => operation.type === "complete")) assert.ok(calls.saves.length > 0, "actual initial autosave ran in memory");
  assert.equal(local.clientSessionId, "fixture-client");
  assert.deepEqual(local.operations, initial.operations);
  assert.equal(visibleModals(view).length, 0);
  assert.equal(calls.unexpected.length, 0, calls.unexpected.join(","));
  view.checkpoint = plain(local);
  view.saveCheckpoint = calls.saves.length;
  view.keyboard = async (shown) => { await act(async () => { for (const listener of subscriptions) if (listener.type === "keyboard" && listener.event === (shown ? "keyboardDidShow" : "keyboardDidHide")) listener.callback(); }); };
  let windowRevision = 0;
  view.window = async (next) => { dimensions = { ...dimensions, ...next }; await act(async () => tree.update(React.createElement(Screen, { testWindowRevision: ++windowRevision }))); };
  return view;
}

const hosts = (view, type) => view.tree.root.findAllByType(type);
const visibleModals = (view) => hosts(view, "Modal").filter((node) => node.props.visible);
const byId = (view, id) => hosts(view, "Pressable").find((node) => node.props.testID === id);
const modal = (view) => { assert.equal(visibleModals(view).length, 1); return visibleModals(view)[0]; };
const named = (view, name) => modal(view).findAllByType("Pressable").find((node) => node.findAllByType("Text").some((text) => textOf(text) === name));
const rir = (view, value) => named(view, String(value));
const effort = (view, value) => byId(view, `player-feedback-effort-${value}`);
const tap = async (node) => { assert.ok(node); assert.equal(typeof node.props.onPress, "function"); await act(async () => node.props.onPress()); };
const open = async (view) => { const id = workout.blocks[0].items[view.checkpoint.currentExerciseIndex].exercise.id; await tap(byId(view, `player-feedback-${id}`)); return modal(view); };
const isSelected = (view, node) => flat(node.props.style).backgroundColor === view.colors.primaryButton;
function unchanged(view) { assert.deepEqual(view.local(), view.checkpoint); assert.equal(view.calls.saves.length, view.saveCheckpoint); assert.deepEqual(view.calls.routes, []); assert.deepEqual(view.calls.unexpected, []); }
function preservedExceptFeedback(view) {
  const baseline = plain(view.checkpoint), current = view.local();
  for (const object of [baseline, current]) { delete object.revision; delete object.exerciseFeedback; delete object.operations; }
  assert.deepEqual(current, baseline);
  assert.deepEqual(view.calls.routes, []); assert.deepEqual(view.calls.unexpected, []);
}
async function unmount(view) {
  await act(async () => view.tree.unmount());
  assert.equal(view.timers.size, 0); assert.equal(view.subscriptions.size, 0);
  assert.deepEqual(view.calls.audio, ["load", "unload"]);
  assert.deepEqual(view.calls.unexpected, []); assert.deepEqual(view.calls.warnings, []);
}

for (const scheme of ["light", "dark"]) {
  test(`original ${scheme}: full route restores existing offline session; sheet opens only through actual Feedback action`, async () => {
    const view = await render({ scheme });
    try {
      const sheet = await open(view);
      assert.equal(sheet.props.transparent, true); assert.equal(sheet.props.animationType, "none");
      const text = textOf(sheet); assert.match(text, /How did that feel\?/); assert.match(text, /Optional RIR/);
      assert.equal(sheet.findAllByType("ScrollView").length, 1);
      for (const value of [0, 1, 2, 3, 4, 5]) { const style = flat(rir(view, value).props.style); assert.equal(style.minWidth, 44); assert.equal(style.minHeight, 44); assert.equal(style.width, undefined); assert.equal(style.height, undefined); }
      assert.equal(flat(named(view, "Cancel").props.style).minHeight, 44);
      assert.equal(flat(byId(view, "player-save-feedback").props.style).minHeight, 44);
      assert.equal(effort(view, "easy").props.accessibilityRole, "button");
      const title = sheet.findAllByType("Text").find((node) => textOf(node) === "How did that feel?");
      assert.equal(flat(title.props.style).lineHeight, undefined); assert.equal(title.props.maxFontSizeMultiplier, undefined);
      unchanged(view);
    } finally { await unmount(view); }
  });
  test(`original ${scheme}: saved feedback prefill and exclusive effort changes remain editor-local`, async () => {
    const view = await render({ scheme });
    try {
      await open(view); assert.equal(isSelected(view, effort(view, "right")), true); assert.equal(isSelected(view, rir(view, 2)), true);
      for (const value of ["easy", "right", "hard"]) {
        await tap(effort(view, value)); await tap(effort(view, value));
        for (const candidate of ["easy", "right", "hard"]) assert.equal(isSelected(view, effort(view, candidate)), candidate === value);
      }
      unchanged(view);
    } finally { await unmount(view); }
  });
  test(`original ${scheme}: all optional RIR values including zero toggle off without storage or queue changes`, async () => {
    const view = await render({ scheme, feedback: {} });
    try {
      await open(view);
      for (const value of [0, 1, 2, 3, 4, 5]) {
        await tap(rir(view, value));
        for (const candidate of [0, 1, 2, 3, 4, 5]) assert.equal(isSelected(view, rir(view, candidate)), candidate === value);
        await tap(rir(view, value));
        for (const candidate of [0, 1, 2, 3, 4, 5]) assert.equal(isSelected(view, rir(view, candidate)), false);
      }
      unchanged(view);
    } finally { await unmount(view); }
  });
  for (const close of ["Cancel", "requestClose"]) test(`original ${scheme}: ${close} discards unsaved feedback on reopen without feedback persistence`, async () => {
    const view = await render({ scheme });
    try {
      await open(view); await tap(effort(view, "hard")); await tap(rir(view, 0));
      if (close === "Cancel") await tap(named(view, "Cancel")); else await act(async () => modal(view).props.onRequestClose());
      assert.equal(visibleModals(view).length, 0); unchanged(view);
      await open(view); assert.equal(isSelected(view, effort(view, "right")), true); assert.equal(isSelected(view, rir(view, 2)), true); assert.equal(isSelected(view, rir(view, 0)), false);
      unchanged(view);
    } finally { await unmount(view); }
  });
  test(`original ${scheme}: empty Save enqueues exact nullable feedback and closes without required-choice validation`, async () => {
    const view = await render({ scheme, feedback: { squat: savedFeedback.squat } });
    try {
      await open(view); const ids = view.calls.ids.length; const button = byId(view, "player-save-feedback"); assert.notEqual(button.props.disabled, true);
      await tap(button); assert.equal(visibleModals(view).length, 0);
      assert.equal(view.calls.ids.length, ids + 1);
      assert.deepEqual(view.local().operations, [originalOperation, { id: view.calls.ids.at(-1), type: "update_exercise_feedback", status: "pending", payload: { exerciseId: "bridge", effort: null, rir: null } }]);
      assert.deepEqual(view.local().exerciseFeedback, { squat: savedFeedback.squat, bridge: { effort: null, rir: null } });
      preservedExceptFeedback(view);
    } finally { await unmount(view); }
  });
  test(`original ${scheme}: selected Save preserves zero and all unrelated session data then reopens the saved draft`, async () => {
    const view = await render({ scheme });
    try {
      await open(view); await tap(effort(view, "hard")); await tap(rir(view, 0)); const ids = view.calls.ids.length;
      await tap(byId(view, "player-save-feedback")); assert.equal(visibleModals(view).length, 0); assert.equal(view.calls.ids.length, ids + 1);
      assert.deepEqual(view.local().operations, [originalOperation, { id: view.calls.ids.at(-1), type: "update_exercise_feedback", status: "pending", payload: { exerciseId: "bridge", effort: "hard", rir: 0 } }]);
      assert.deepEqual(view.local().exerciseFeedback, { ...savedFeedback, bridge: { effort: "hard", rir: 0 } });
      preservedExceptFeedback(view);
      const beforeReopen = view.local(), saves = view.calls.saves.length;
      await open(view); assert.equal(isSelected(view, effort(view, "hard")), true); assert.equal(isSelected(view, rir(view, 0)), true);
      assert.deepEqual(view.local(), beforeReopen); assert.equal(view.calls.saves.length, saves);
    } finally { await unmount(view); }
  });
  test(`original ${scheme}: current second exercise saves its own feedback, leaves first feedback and queued note intact`, async () => {
    const view = await render({ scheme, index: 1, feedback: { ...savedFeedback, squat: { effort: "easy", rir: 0 } } });
    try {
      await open(view); assert.equal(isSelected(view, rir(view, 0)), true);
      await tap(effort(view, "right")); await tap(rir(view, 5)); await tap(byId(view, "player-save-feedback"));
      assert.deepEqual(view.local().operations, [originalOperation, { id: view.calls.ids.at(-1), type: "update_exercise_feedback", status: "pending", payload: { exerciseId: "squat", effort: "right", rir: 5 } }]);
      assert.deepEqual(view.local().exerciseFeedback, { bridge: savedFeedback.bridge, squat: { effort: "right", rir: 5 } });
      preservedExceptFeedback(view);
    } finally { await unmount(view); }
  });
}

for (const scheme of ["light", "dark"]) {
  test(`presentation ${scheme}: one content-height bounded sheet has safe bottom padding and uncapped wrapping 44-min controls`, async () => {
    for (const bottomInset of [0, 34]) {
      const view = await render({ scheme, bottomInset });
      try {
        const sheet = await open(view), scroll = sheet.findByType("ScrollView");
        const style = flat(scroll.props.style), content = flat(scroll.props.contentContainerStyle);
        assert.equal(style.flexGrow, 0); assert.equal(style.maxHeight, "90%"); assert.equal(style.height, undefined);
        assert.equal(style.backgroundColor, view.colors.background); assert.equal(style.padding, undefined); assert.equal(style.paddingBottom, undefined);
        assert.equal(content.paddingHorizontal, 20); assert.equal(content.paddingTop, 20); assert.equal(content.paddingBottom, Math.max(bottomInset, 20)); assert.equal(content.gap, 14);
        assert.equal(scroll.props.contentInsetAdjustmentBehavior, undefined);
        assert.equal(flat(scroll.parent.props.style).flex, 1); assert.equal(flat(scroll.parent.props.style).justifyContent, "flex-end");
        assert.equal(scroll.props.accessibilityViewIsModal, true); assert.notEqual(scroll.props.accessible, true);
        assert.equal(sheet.findAllByType("ScrollView").length, 1);
        const title = scroll.findAllByType("Text").find((node) => textOf(node) === "How did that feel?");
        assert.equal(title.props.accessibilityRole, "header");
        for (const text of scroll.findAllByType("Text")) { assert.notEqual(text.props.allowFontScaling, false); assert.equal(text.props.maxFontSizeMultiplier, undefined); assert.equal(text.props.numberOfLines, undefined); assert.equal(flat(text.props.style).lineHeight, undefined); }
        const controls = [...["easy", "right", "hard"].map((value) => effort(view, value)), ...[0, 1, 2, 3, 4, 5].map((value) => rir(view, value)), named(view, "Cancel"), byId(view, "player-save-feedback")];
        for (const control of controls) { const target = flat(control.props.style); assert.equal(target.minWidth, 44); assert.equal(target.minHeight, 44); assert.equal(target.width, undefined); assert.equal(target.height, undefined); assert.equal(control.props.accessibilityRole, "button"); assert.ok(scroll.findAllByType("Pressable").includes(control)); assert.equal(flat(control.parent.props.style).flexWrap, "wrap"); }
        for (const value of ["easy", "right", "hard"]) { const target = flat(effort(view, value).props.style); assert.equal(target.flexBasis, "auto"); assert.equal(target.maxWidth, "100%"); }
        assert.equal(named(view, "Cancel").props.accessibilityLabel, "Cancel exercise feedback");
        assert.equal(byId(view, "player-save-feedback").props.accessibilityLabel, "Save exercise feedback");
        assert.notEqual(byId(view, "player-save-feedback").props.disabled, true); assert.equal(byId(view, "player-save-feedback").props.accessibilityState?.busy, undefined);
        unchanged(view);
      } finally { await unmount(view); }
    }
  });
  test(`presentation ${scheme}: accurate effort and nullable RIR selected states include zero and preserve meaningful accent`, async () => {
    const view = await render({ scheme, feedback: {} });
    try {
      await open(view);
      for (const value of ["easy", "right", "hard"]) {
        assert.equal(effort(view, value).props.accessibilityLabel, value[0].toUpperCase() + value.slice(1));
        assert.equal(effort(view, value).props.accessibilityState.selected, false);
      }
      for (const value of [0, 1, 2, 3, 4, 5]) {
        assert.equal(rir(view, value).props.testID, `player-feedback-rir-${value}`);
        assert.equal(rir(view, value).props.accessibilityLabel, `${value} ${value === 1 ? "rep" : "reps"} in reserve`);
        assert.equal(rir(view, value).props.accessibilityState.selected, false);
      }
      for (const value of ["easy", "right", "hard"]) {
        await tap(effort(view, value));
        for (const candidate of ["easy", "right", "hard"]) assert.equal(effort(view, candidate).props.accessibilityState.selected, candidate === value);
        assert.equal(flat(effort(view, value).props.style).backgroundColor, view.colors.primaryButton);
      }
      await tap(rir(view, 0)); assert.equal(rir(view, 0).props.accessibilityState.selected, true); assert.equal(flat(rir(view, 0).props.style).backgroundColor, view.colors.primaryButton);
      await tap(rir(view, 0));
      for (const value of [0, 1, 2, 3, 4, 5]) assert.equal(rir(view, value).props.accessibilityState.selected, false);
      assert.equal(flat(named(view, "Save").findByType("Text").props.style).color, view.colors.primaryButton);
      unchanged(view);
    } finally { await unmount(view); }
  });
}

const enteredRow = { exerciseId: "bridge", setNumber: 1, reps: "9", weight: "25", confirmed: false, hasUnsavedInput: true, syncing: false, syncStatus: "synced", logId: null };
const mainScroll = (view) => { const scroll = hosts(view, "ScrollView").find((node) => node.props.keyboardShouldPersistTaps === "always"); assert.ok(scroll); return scroll; };

for (const scheme of ["light", "dark"]) {
  test(`host baseline ${scheme}: normal fixed chrome and aligned legend retain real logger access`, async () => {
    const view = await render({ scheme });
    try {
      const scroll = mainScroll(view), finish = byId(view, "player-finish"), list = byId(view, "player-exercise-list-button");
      assert.equal(hosts(view, "ScrollView").length, 1);
      assert.equal(scroll.findAllByType("Pressable").includes(finish), false);
      assert.equal(scroll.findAllByType("Pressable").includes(list), false);
      assert.ok(scroll.findAllByType("Pressable").includes(byId(view, "player-feedback-bridge")));
      assert.equal(scroll.props.keyboardDismissMode, "interactive");
      assert.equal(hosts(view, "KeyboardAvoidingView")[0].props.behavior, "padding");
      assert.equal(hosts(view, "Text").filter((node) => node.props.maxFontSizeMultiplier !== undefined).length, 0);
      const initials = hosts(view, "Text").filter((node) => node.props.allowFontScaling === false);
      assert.equal(initials.length, 1); assert.equal(initials[0].props.accessible, false);
      assert.equal(flat(hosts(view, "Text").find((node) => textOf(node) === "SET").props.style).width, 36);
      await tap(list); assert.equal(hosts(view, "ExerciseListSheet")[0].props.visible, true);
      await act(async () => hosts(view, "ExerciseListSheet")[0].props.onClose());
      assert.equal(hosts(view, "ExerciseListSheet")[0].props.visible, false);
      await open(view); assert.equal(modal(view).findAllByType("ScrollView").length, 1);
      await tap(named(view, "Cancel")); unchanged(view);
    } finally { await unmount(view); }
  });
  test(`host baseline ${scheme}: keyboard save callback fires once, stays outside body and exposes busy resolution`, async () => {
    const gate = deferred(), view = await render({ scheme, hostControls: true, realRows: true, sets: [enteredRow], batchGate: gate });
    try {
      assert.ok(byId(view, "player-save-entered-sets"));
      await view.keyboard(true);
      const save = byId(view, "player-save-entered-sets");
      assert.equal(mainScroll(view).findAllByType("Pressable").includes(save), false);
      await tap(save);
      assert.equal(view.calls.batches.length, 1); assert.deepEqual(view.calls.keyboard, ["dismiss"]);
      assert.equal(byId(view, "player-save-entered-sets").props.disabled, true);
      assert.equal(byId(view, "player-save-entered-sets").props.accessibilityState.busy, true);
      await view.window({ fontScale: 3.1 });
      assert.equal(mainScroll(view).findAllByType("Pressable").includes(byId(view, "player-save-entered-sets")), false);
      assert.equal(byId(view, "player-save-entered-sets").props.accessibilityState.busy, true);
      assert.equal(view.calls.batches.length, 1);
      const batch = view.calls.batches[0];
      assert.deepEqual(batch.keys, ["bridge:1"]); assert.equal(batch.unit, "KG");
      assert.equal(batch.snapshot.sets[0].weight, "25"); assert.equal(batch.snapshot.sets[0].reps, "9");
      assert.equal(batch.snapshot.restTotalSeconds, 77); assert.deepEqual(batch.snapshot.exerciseFeedback, savedFeedback);
      const saved = { ...batch.snapshot, sets: batch.snapshot.sets.map((set) => ({ ...set, confirmed: true, hasUnsavedInput: false })), revision: batch.snapshot.revision + 1 };
      await act(async () => gate.resolve({ workout: saved, issues: {}, savedCount: 1 }));
      assert.equal(view.calls.batches.length, 1); assert.deepEqual(view.calls.haptics, ["Success"]);
      assert.equal(byId(view, "player-save-entered-sets"), undefined);
      assert.equal(byId(view, "player-finish").props.disabled, false);
      assert.equal(byId(view, "player-finish").props.accessibilityState.busy, false);
      assert.equal(view.local().restTotalSeconds, 77); assert.deepEqual(view.local().exerciseFeedback, savedFeedback);
      assert.deepEqual(view.calls.unexpected, []);
    } finally { await unmount(view); }
  });
  test(`host baseline ${scheme}: live font and short-window transitions preserve actual row mount and typed draft`, async () => {
    const view = await render({ scheme, hostControls: true, realRows: true, sets: [{ ...enteredRow, weight: "", reps: "", hasUnsavedInput: false }] });
    try {
      const input = (id) => hosts(view, "TextInput").find((node) => node.props.testID === id);
      await act(async () => input("player-weight-input-bridge-1").props.onChangeText("31.5"));
      await act(async () => input("player-reps-input-bridge-1").props.onChangeText("11"));
      const mounts = [...view.calls.rowMounts], snapshot = view.local(); assert.equal(mounts.length, 1);
      for (const [fontScale, height] of [[1, 667], [1.3, 667], [1.31, 667], [3.1, 667], [1, 561], [1, 560], [1, 400], [1, 667]]) {
        await view.window({ fontScale, height });
        const expanded = fontScale > 1.3 || height - 47 - 34 < 480;
        const scroll = mainScroll(view);
        assert.equal(scroll.props.testID, "player-main-scroll");
        assert.equal(scroll.findAllByType("Pressable").includes(byId(view, "player-finish")), expanded);
        assert.equal(scroll.findAllByType("Pressable").includes(byId(view, "player-exercise-list-button")), expanded);
        const label = hosts(view, "Text").find((node) => textOf(node) === (expanded ? "#" : "SET"));
        assert.equal(flat(label.props.style).width, 36); assert.equal(label.props.accessibilityLabel, expanded ? "Set" : undefined);
        assert.equal(label.props.maxFontSizeMultiplier, undefined);
        const weight = hosts(view, "Text").find((node) => textOf(node) === (expanded ? "KG" : "Weight"));
        assert.equal(flat(weight.props.style).textTransform, expanded ? "none" : "uppercase");
        assert.equal(hosts(view, "Text").some((node) => node.props.maxFontSizeMultiplier !== undefined), false);
        assert.deepEqual(view.calls.rowMounts, mounts); assert.deepEqual(view.calls.rowUnmounts, []);
        assert.equal(input("player-weight-input-bridge-1").props.value, "31.5"); assert.equal(input("player-reps-input-bridge-1").props.value, "11");
        assert.deepEqual(view.local(), snapshot);
      }
      await view.keyboard(true); assert.ok(byId(view, "player-save-entered-sets"));
      await view.window({ fontScale: 3.1 });
      assert.equal(mainScroll(view).findAllByType("Pressable").includes(byId(view, "player-save-entered-sets")), false);
      assert.deepEqual(view.calls.rowMounts, mounts); assert.deepEqual(view.calls.rowUnmounts, []);
      assert.deepEqual(view.calls.unexpected, []);
    } finally { await unmount(view); }
  });
  test(`host baseline ${scheme}: pending and failed finish retain blocked body with available Continue and Retry`, async () => {
    for (const status of ["pending", "failed"]) {
      const completion = { id: "existing-complete", type: "complete", status, payload: {} };
      const view = await render({ scheme, operations: [originalOperation, completion] });
      try {
        const finish = byId(view, "player-finish");
        assert.equal(textOf(finish), "Retry Finish"); assert.equal(finish.props.disabled, false); assert.equal(finish.props.accessibilityState.busy, false);
        assert.ok(byId(view, "player-continue-logging")); assert.equal(typeof byId(view, "player-continue-logging").props.onPress, "function");
        assert.ok(hosts(view, "View").some((node) => node.props.pointerEvents === "none"));
        assert.equal(mainScroll(view).findAllByType("Pressable").includes(finish), false);
        await view.window({ fontScale: 3.1 });
        assert.ok(mainScroll(view).findAllByType("Pressable").includes(byId(view, "player-finish")));
        assert.equal(byId(view, "player-finish").props.disabled, false);
        assert.equal(byId(view, "player-finish").props.accessibilityState.busy, false);
        const blocked = hosts(view, "View").find((node) => node.props.pointerEvents === "none");
        assert.equal(blocked.findAllByType("Pressable").includes(byId(view, "player-continue-logging")), false);
        await view.keyboard(true); assert.equal(byId(view, "player-save-entered-sets"), undefined);
        assert.deepEqual(view.local().operations, [originalOperation, completion]); assert.deepEqual(view.calls.routes, []); assert.deepEqual(view.calls.unexpected, []);
      } finally { await unmount(view); }
    }
  });
  test(`host ${scheme}: expanded unit legend retains each/total equipment meaning and full accessible label`, async () => {
    for (const unit of ["LB", "KG"]) for (const [label, equipment, loadProfile, short] of [
      ["Weight", ["dumbbells"], { implement_count: 1 }, unit],
      ["Weight each", ["dumbbells"], null, `${unit} each`],
      ["Total weight", ["olympic_barbell"], null, `Total ${unit}`],
    ]) {
      const snapshot = plain(workout);
      Object.assign(snapshot.blocks[0].items[0].exercise, { requiredEquipmentIds: equipment, loadProfile });
      const view = await render({ scheme, unit, workout: snapshot });
      try {
        const normal = hosts(view, "Text").find((node) => textOf(node) === label);
        assert.ok(normal); assert.equal(normal.props.accessibilityLabel, undefined);
        assert.equal(flat(normal.props.style).textTransform, "uppercase");
        await view.window({ fontScale: 3.1 });
        const expanded = hosts(view, "Text").find((node) => node.props.accessibilityLabel === `${label} (${unit})`);
        assert.ok(expanded); assert.equal(textOf(expanded), short);
        assert.equal(expanded.props.maxFontSizeMultiplier, undefined); assert.notEqual(expanded.props.allowFontScaling, false);
        assert.equal(flat(expanded.props.style).textTransform, "none");
        let column = expanded.parent;
        while (column && column.type !== "View") column = column.parent;
        assert.deepEqual(flat(column.props.style), { flex: 1, marginRight: 8 });
        unchanged(view);
      } finally { await unmount(view); }
    }
  });
}

test("scope: adaptive host only; exact original controller, footer callbacks, body and all modals remain pinned", () => {
  const input = source(route), start = input.indexOf('\n      <Modal transparent visible={feedbackEditorVisible}'), end = input.indexOf('\n      </Modal>', start) + '\n      </Modal>'.length;
  const baseline = execFileSync("git", ["show", `084d5407ddaed88a6a50754ac6b17c533ca2061f:${route}`], { cwd: root, encoding: "utf8" });
  const prior = execFileSync("git", ["show", `f55fad5baecc5263d8cba9cd2d770242936c8268:${route}`], { cwd: root, encoding: "utf8" });
  const declarations = input.indexOf('\n  const header = <>');
  const modals = input.indexOf('\n      <Modal visible={finishReviewVisible}');
  assert.equal(sha(input), "a3b92bca1b4ce520587ff271bfaabd207c3f5950b0ffc4b8934742d2c2585044");
  const controller = input.slice(0, declarations)
    .replace("TouchableWithoutFeedback, useWindowDimensions, View", "TouchableWithoutFeedback, View")
    .replace('  const { fontScale, height } = useWindowDimensions();\n  const expandedLayout = fontScale > 1.3 || height - insets.top - insets.bottom < 480;\n', "");
  assert.equal(sha(controller), "c91540ac1ac7d1826e135d69b2ea214a1a40b44868d1666040ef1a486a8a2be9");
  assert.equal(sha(input.slice(modals)), "6ecbe55d61b8d5a8207141ec86b03c1e5a3b5b3c5a6cabeaa0e1ee409a1dd758");
  assert.equal(sha(input.slice(start, end)), "17ac41278e4848b6792ff326d457edf618775cfc0880151bafa1b6b2caa4cb7f");
  const oldStart = prior.indexOf('\n      <Modal transparent visible={feedbackEditorVisible}'), oldEnd = prior.indexOf('\n      </Modal>', oldStart) + '\n      </Modal>'.length;
  const baseStart = baseline.indexOf('\n      <Modal transparent visible={feedbackEditorVisible}'), baseEnd = baseline.indexOf('\n      </Modal>', baseStart) + '\n      </Modal>'.length;
  assert.equal(sha(baseline), "83422e821a9b0a6a21fd1919fd00c174ef54c57e7e6a196b979969ab757d35c4");
  assert.equal(sha(prior), "e0cd91d9bc7d98c7e784a93d40b7877e04ae7157dd30da10a1e2d46d47e6fe7b");
  assert.equal(baseline.slice(0, baseStart) + prior.slice(oldStart, oldEnd) + baseline.slice(baseEnd), prior);
  assert.equal(sha(baseline.slice(0, baseStart)), "b918ee626e7697981dda2719b1dba98ba6e3cdb2e4031b2eb057c6d71fd3d8b3");
  assert.equal(sha(prior.slice(oldStart, oldEnd)), "d1bc6864f80731e918e41335f11a575af92c6be4bd26ce498f75b4ae229d18b2");
  assert.equal(sha(input.slice(end)), "f15fdcd2063be04e3152543ffc41f6ae82251eafc354cc878448daca797027bc");
  const footerStart = input.indexOf('  const footer = (\n') + '  const footer = (\n'.length;
  const footer = input.slice(footerStart, input.indexOf('\n  );', footerStart)).replace('!expandedLayout && keyboardVisible', 'keyboardVisible');
  assert.equal(footer, baseline.slice(baseline.indexOf('      {/* Finish button */}\n') + '      {/* Finish button */}\n'.length, baseline.indexOf('      </KeyboardAvoidingView>')).trimEnd());
  const originalBody = baseline.slice(baseline.indexOf('      {/* Main content */}'), baseline.indexOf('      {/* Finish button */}'));
  const body = input.slice(input.indexOf('      {/* Main content */}'), input.indexOf('      {!expandedLayout ? <View key="fixed-footer">'))
    .replace('        key="main-scroll"\n        testID="player-main-scroll"\n', '')
    .replace('        {expandedLayout ? <View key="scroll-header" style={{ marginHorizontal: -20, marginTop: -20, marginBottom: 20 }}>{header}</View> : null}\n', '')
    .replace(' key="logger-body"', '')
    .replace('        {expandedLayout ? <View key="scroll-footer" style={{ marginHorizontal: -20, marginBottom: -20, marginTop: 20 }}>{footer}</View> : null}\n', '')
    .replace('<ThemedText allowFontScaling={false} accessible={false}', '<ThemedText maxFontSizeMultiplier={1.5}')
    .replace('<ThemedText accessibilityLabel={expandedLayout ? "Set" : undefined} style={{ width: 36, fontSize: 11, color: colors.placeholder }}>{expandedLayout ? "#" : "SET"}</ThemedText>', '<ThemedText maxFontSizeMultiplier={1.5} style={{ width: 36, fontSize: 11, color: colors.placeholder }}>SET</ThemedText>')
    .replace('                      accessibilityLabel={expandedLayout ? `${weightColumnLabel} (${weightUnit})` : undefined}\n', '')
    .replace('                    <ThemedText\n                      style={{', '                    <ThemedText\n                      maxFontSizeMultiplier={1.5}\n                      style={{')
    .replace('{expandedLayout ? weightColumnLabel === "Weight each" ? `${weightUnit} each` : weightColumnLabel === "Total weight" ? `Total ${weightUnit}` : weightUnit : weightColumnLabel}', '{weightColumnLabel}')
    .replace('                  <ThemedText\n                    style={{', '                  <ThemedText\n                    maxFontSizeMultiplier={1.5}\n                    style={{')
    .replaceAll('textTransform: expandedLayout ? "none" : "uppercase"', 'textTransform: "uppercase"');
  assert.equal(body, originalBody);
  const pins = {
    "components/workout/WorkoutText.tsx": "2de5b96d2f8fb77aecda9a4d0f4f7bd2f29641cfe089e6888fa50d550e9c1a91",
    "components/workout/SetInputRow.tsx": "c721dcd2f9d312ade3abba0a1e84a6657740ccc84b32190cc3980fd6298365eb",
    "components/workout/RestTimer.tsx": "df0b8931a2f72386f25568e3167cbe1e5af07fcf5681430df57c58a5168d8e49",
    "components/workout/WeightUnitControl.tsx": "6376eb95119857104f3e69c6a7f6911acc350fb41ca3a153203d1a3533f8a192",
    "utils/activeWorkoutStore.ts": "c93add73bdd282ab9ae7da46344418763b03daaf70d3c070b26fce07d53ff6a1",
    "utils/activeWorkoutStore.native.ts": "ec4cc5211d414d10b9603937f4b57d3eed086b9f2efb640b57c81c9598aebd66",
    "utils/activeWorkoutStore.web.ts": "39507cd269d66ccaae5922ca0515138ace2ba1d8da58c682ab6b283d67fe24d4",
    "utils/workoutSetEntries.ts": "1ba9456e8314d2fcdba1d46363477a089b3cc457a96a2f15c2a2b15d49baf770",
    "services/workoutLoggingService.ts": "746cc8cd633864e72f69062fa0b514244b397fbee6dfcdefbdba2e1b7bf1e1af",
    "utils/activeWorkoutContext.tsx": "98f4e24bed888a885b9618fbfc02ea3b8df89b2134b5469df614d13debefb666",
    "constants/theme.ts": "0e4066b19531c70b14aeb5656a6f0de16b37f56ad410b87c2f923168cebfcad1",
  };
  for (const [file, expected] of Object.entries(pins)) assert.equal(sha(source(file)), expected, file);
});
