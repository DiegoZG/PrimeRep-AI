import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plain = (value) => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function load(file, mocks, globals = {}) {
  const filename = path.join(root, file), module = { exports: {} }, fallback = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console, ...globals }, { filename });
  return module.exports;
}
const exercise = (id, extra = {}) => ({ id, name: id === "private-curl" ? "My custom curl" : `Exercise ${id}`, primaryMuscle: "biceps", isFavorite: false, ...extra });
const day = (extra = {}) => ({ workoutDayId: "day-A", date: "2026-10-24", title: "Upper A", durationMinutes: 35, blocks: [{ blockType: "main", items: [{ exercise: exercise("bench"), prescription: { sets: 4, reps: "6-10", restSeconds: 120 } }] }], ...extra });
const host = (view, id) => view.tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const row = (view, id) => view.tree.root.findAllByType("Pressable").find((node) => node.props.testID === "exercise-row" && node.props.accessibilityLabel.startsWith(exercise(id).name));
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const tap = async (node) => { assert.ok(node); assert.notEqual(node.props.disabled, true); await act(async () => node.props.onPress()); };
async function picker(options = {}) {
  const calls = { routes: [], adds: [], pages: [], alerts: [], refreshes: [] }, AuthContext = React.createContext(null);
  const timers = new Map(); let nextTimer = 0, now = 0, changeAuth, hide;
  const native = { Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", TextInput: "TextInput", View: "View", ActivityIndicator: "ActivityIndicator", StyleSheet: { create: (styles) => styles }, Platform: { select: (values) => values.ios }, Alert: { alert: (...args) => calls.alerts.push(args) } };
  const mocks = { react: React, "react-native": native, "@expo/vector-icons": { Ionicons: "Ionicons" }, "expo-image": { Image: "Image" }, "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "expo-router": { useLocalSearchParams: () => ({ workoutDayId: "day-A", weekStart: "2026-10-19" }), useRouter: () => ({ back: () => calls.routes.push("back") }) },
    "@react-navigation/native": { useFocusEffect: (callback) => React.useEffect(callback, [callback]) },
    "@/utils/authContext": { AuthContext }, "@/utils/localDate": { localDateIso: () => "2026-10-24" },
    "@/utils/activeWorkoutContext": { useActiveWorkout: () => ({ activeWorkout: options.active ?? null }) },
    "@/utils/activeWorkoutStore": { loadActiveWorkout: async () => options.local ?? null },
    "@/hooks/use-color-scheme": { useColorScheme: () => options.scheme ?? "light" },
    "@/components/screen-state": { ScreenState: "ScreenState" }, "@/components/workout/WorkoutText": { WorkoutText: (props) => React.createElement("Text", props) },
    "@/services/exerciseService": { getExercisePage: async (...args) => { calls.pages.push(plain(args)); return options.request ? options.request(...args) : { items: options.items ?? [exercise("private-curl")], offset: args[0].offset, limit: 50, has_more: false }; } },
  };
  const workout = options.missing ? null : day(options.day);
  const week = { weekPlan: { weekStart: "2026-10-19", workouts: workout ? [workout] : [] }, getWorkoutById: () => workout, planningRefreshRequired: false,
    refreshWeek: async (value) => { calls.refreshes.push(value); week.planningRefreshRequired = false; },
    addExercise: async (params) => { calls.adds.push(plain(params)); try { return options.add ? await options.add(params) : { weekPlan: week.weekPlan }; } catch (error) { if (options.barrierOnError) week.planningRefreshRequired = true; throw error; } },
  };
  mocks["@/hooks/use-workout-week"] = { useWorkoutWeek: () => week };
  mocks["@/constants/theme"] = load("constants/theme.ts", mocks);
  mocks["@/utils/exerciseTracking"] = load("utils/exerciseTracking.ts", mocks);
  mocks["@/utils/workoutPlanning"] = load("utils/workoutPlanning.ts", mocks);
  mocks["@/components/explore"] = load("components/explore/ExerciseRow.tsx", mocks);
  mocks["@/components/exercises/CatalogPageFooter"] = load("components/exercises/CatalogPageFooter.tsx", mocks);
  mocks["@/hooks/use-exercise-pages"] = load("hooks/use-exercise-pages.ts", mocks);
  const { default: Screen } = load("app/workout/exercise-picker.tsx", mocks, { setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; }, clearTimeout: (id) => timers.delete(id) });
  function App() { const [identity, setIdentity] = React.useState({ user: { id: "user-A" }, token: "token-A" }); const [visible, setVisible] = React.useState(true); changeAuth = setIdentity; hide = () => setVisible(false); return React.createElement(AuthContext.Provider, { value: identity }, visible ? React.createElement(Screen) : null); }
  let tree; await act(async () => { tree = create(React.createElement(App)); });
  return { tree, calls, week, tick: async (amount) => { now += amount; await act(async () => { for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); } }); },
    confirm: async (name) => { const entry = calls.alerts.at(-1)?.[2].find((button) => button.text === name); assert.ok(entry); await act(async () => { await entry.onPress?.(); }); },
    auth: async (id) => { await act(async () => changeAuth({ user: { id }, token: `token-${id}` })); }, hide: async () => { await act(async () => hide()); } };
}
const close = async (view) => { await act(async () => view.tree.unmount()); };

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: workout-only picker exposes defaults, own custom catalog and exact canonical source IDs`, async () => {
    const view = await picker({ scheme }); assert.match(textOf(view.tree.root), /3 sets, 8–12 reps, 90s rest/);
    await tap(row(view, "private-curl"));
    assert.deepEqual(view.calls.adds, [{ workoutDayId: "day-A", exerciseId: "private-curl", expectedExerciseIds: ["bench"], weekStart: "2026-10-19", effectiveDate: "2026-10-24", allowOverBudget: false }]);
    assert.deepEqual(view.calls.routes, ["back"]); await close(view);
  });
}

test("already-added and reference-only exercises stay visible but cannot be added", async () => {
  const view = await picker({ items: [exercise("bench"), exercise("hold", { contentVersion: "v1", trackingMode: "duration" })] });
  assert.equal(row(view, "bench").props.disabled, true); assert.equal(row(view, "hold").props.disabled, true);
  await act(async () => { row(view, "bench").props.onPress(); row(view, "hold").props.onPress(); });
  assert.deepEqual(view.calls.adds, []); await close(view);
});

test("search is debounced, pagination and failed catalog retry use the shared catalog flow", async () => {
  let fail = true; const view = await picker({ request: async (params) => { if (fail) throw new Error("Offline"); return { items: [exercise("private-curl")], offset: params.offset, limit: 50, has_more: params.offset === 0 }; } });
  const state = view.tree.root.findByType("ScreenState"); assert.equal(state.props.kind, "error");
  fail = false; await act(async () => state.props.onAction());
  await act(async () => host(view, "workout-exercise-search").props.onChangeText(" curl "));
  await view.tick(249); assert.equal(view.calls.pages.length, 2); await view.tick(1); assert.equal(view.calls.pages.at(-1)[0].q, "curl");
  await tap(host(view, "workout-exercise-load-more")); assert.equal(view.calls.pages.at(-1)[0].offset, 50);
  await close(view);
});

test("exceeding a time budget requires explicit Add anyway and retries the same source without trimming", async () => {
  const failure = Object.assign(new Error("Over budget"), { status: 409, payload: { detail: { code: "workout_time_budget_exceeded", estimatedMinutes: 65, timeBudgetMinutes: 35 } } });
  const view = await picker({ add: async (params) => { if (!params.allowOverBudget) throw failure; return { weekPlan: {} }; } });
  await tap(row(view, "private-curl")); assert.match(view.calls.alerts[0][1], /65 minutes.*35-minute budget/);
  assert.deepEqual(view.calls.routes, []); await view.confirm("Cancel"); assert.equal(view.calls.adds.length, 1);
  await tap(row(view, "private-curl")); await view.confirm("Add anyway");
  assert.equal(view.calls.adds.length, 3); assert.deepEqual(view.calls.adds[2], { ...view.calls.adds[1], allowOverBudget: true });
  assert.deepEqual(view.calls.routes, ["back"]); await close(view);
});

test("pending adds suppress double taps and a late response after Back cannot navigate a second time", async () => {
  const pending = deferred(); const view = await picker({ add: () => pending.promise });
  await act(async () => { row(view, "private-curl").props.onPress(); row(view, "private-curl").props.onPress(); });
  assert.equal(view.calls.adds.length, 1); await view.hide();
  await act(async () => { pending.resolve({ weekPlan: {} }); }); assert.deepEqual(view.calls.routes, []); await close(view);
});

test("saved-order storage failure is reported as an added exercise, not a failed add", async () => {
  const view = await picker({ add: async () => ({ weekPlan: {}, orderPreservationFailed: true }) });
  await tap(row(view, "private-curl")); assert.deepEqual(view.calls.routes, ["back"]);
  assert.equal(view.calls.alerts[0][0], "Exercise added"); assert.match(view.calls.alerts[0][1], /previous order could not be saved/); await close(view);
});

test("unknown or stale failures expose recovery without claiming a successful add", async () => {
  const view = await picker({ barrierOnError: true, add: async () => { throw new Error("Refresh to confirm the latest workout."); } });
  await tap(row(view, "private-curl")); assert.deepEqual(view.calls.routes, []);
  assert.ok(host(view, "workout-exercise-add-message")); assert.ok(host(view, "workout-exercise-refresh")); await close(view);
});

test("program, past, local-started and server-locked picker routes cannot add exercises", async () => {
  for (const options of [{ day: { programActivationId: "program" } }, { day: { date: "2026-10-23" } }, { local: { workoutDayId: "day-A" } }, { day: { planningEditable: false } }]) {
    const view = await picker(options); assert.equal(row(view, "private-curl").props.disabled, true);
    await act(async () => row(view, "private-curl").props.onPress()); assert.deepEqual(view.calls.adds, []); await close(view);
  }
});

test("all heading and guidance content scrolls while Back stays a 44-point action", async () => {
  const view = await picker(); const scroll = host(view, "workout-exercise-picker-scroll"), back = host(view, "workout-exercise-picker-back");
  assert.equal(scroll.props.keyboardShouldPersistTaps, "handled"); assert.equal(scroll.props.keyboardDismissMode, "on-drag");
  assert.equal(back.props.style.minHeight, 44); assert.equal(back.parent.parent.type, "SafeAreaView");
  const title = scroll.findAllByType("Text").find((node) => textOf(node) === "Add exercise"); assert.equal(title.props.numberOfLines, undefined);
  await close(view);
});
