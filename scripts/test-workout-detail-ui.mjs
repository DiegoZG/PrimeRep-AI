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
const source = (file) => readFileSync(path.join(root, file), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const routeFile = "app/workouts/[workoutDayId].tsx";
const weekStart = "2026-10-12";
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : ["2026-10-12T12:00:00Z"])); }
  static now() { return new Date("2026-10-12T12:00:00Z").getTime(); }
}
function load(file, mocks, globals = {}) {
  const filename = path.join(root, file);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console: { ...console, warn() {} }, Date: Clock, setInterval, clearInterval, setTimeout, clearTimeout, ...globals }, { filename });
  return module.exports;
}
function SectionList({ sections, renderSectionHeader, renderItem, ListHeaderComponent, ...props }) {
  const children = [React.createElement(React.Fragment, { key: "header" }, ListHeaderComponent?.())];
  for (const [index, section] of sections.entries()) {
    children.push(React.createElement(React.Fragment, { key: `section-${index}` }, renderSectionHeader({ section })));
    for (const [itemIndex, item] of section.data.entries()) children.push(React.createElement(React.Fragment, { key: `${index}-${itemIndex}` }, renderItem({ item, index: itemIndex, section })));
  }
  return React.createElement("SectionList", { ...props, sections }, children);
}
const native = { Pressable: "Pressable", View: "View", Text: "Text", ActivityIndicator: "ActivityIndicator", Modal: "Modal", SectionList, ScrollView: "ScrollView", StyleSheet: { create: (styles) => styles, absoluteFillObject: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } }, Platform: { OS: "ios", select: (values) => values.ios } };
const theme = load("constants/theme.ts", { "react-native": native });
const dateHelpers = load("utils/localDate.ts", {});
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const text = (view, value) => view.tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const host = (view, id) => view.tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const label = (view, value) => view.tree.root.findAll((node) => typeof node.type === "string" && node.props.accessibilityLabel === value)[0];
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const error = (status, message = "Boundary request failed") => Object.assign(new Error(message), { status });
const unmount = async (view) => { await act(async () => view.tree.unmount()); };
const tap = async (node) => { assert.ok(node); assert.notEqual(node.props.disabled, true); let rootNode = node; while (rootNode.parent) rootNode = rootNode.parent; await act(async () => { node.props.onPress(); }); await act(async () => { for (const modal of rootNode.findAllByType("Modal")) if (!modal.props.visible) modal.props.onDismiss?.(); }); };
const day = (extra = {}) => ({ workoutDayId: "day-one", slotIndex: 1, date: weekStart, durationMinutes: 35, title: "Upper body strength", dayType: "upper_body", splitKey: "upper-lower", blocks: [
  { blockType: "main", items: [{ exercise: { id: "bench", name: "Barbell bench press", primaryMuscle: "chest", imageUrl: "https://images.example.invalid/bench.png" }, prescription: { sets: 3, reps: "8-12", restSeconds: 90 }, exerciseRationale: "A fictional pressing explanation." }] },
  { blockType: "accessory", items: [{ exercise: { id: "row", name: "Cable row", primaryMuscle: "back" }, prescription: { sets: 2, reps: "10", restSeconds: 60 } }] },
], ...extra });
const plan = (days = [day()], start = weekStart) => ({ weekStart: start, weekEnd: start === weekStart ? "2026-10-18" : "2026-10-11", workouts: days });
const session = (extra = {}) => ({ id: "other-session", workoutDayId: "other-day", dayType: "lower_body", startedAt: "2026-10-12T10:00:00Z", clientSessionId: null, status: "in_progress", setLogs: [{ exerciseId: "squat", setNumber: 1 }], workoutSnapshot: { title: "Existing lower workout", exerciseBlocks: [] }, ...extra });

async function detail(options = {}) {
  const calls = { weeks: [], skips: [], durations: [], planning: [], bulk: [], additions: [], active: [], abandons: [], cleared: [], favorites: [], favorite: [], unfavorite: [], routes: [], alerts: [], loggedOut: [], stored: [], focus: [], scrolls: [], created: [] };
  const scheme = options.scheme ?? "light";
  const AuthContext = React.createContext(null);
  const storage = new Map([["@primerep/theme-preference", scheme]]);
  const route = { workoutDayId: options.id ?? "day-one", ...(options.routeWeek ? { weekStart: options.routeWeek } : {}) };
  let current = options;
  const appState = new Set(), focusEffects = new Set();
  const logging = {
    getActiveSession: async (token) => { calls.active.push(token); if (current.activeError) throw error(503); return current.activeRequest ? current.activeRequest() : current.active ?? null; },
    abandonSession: async (token, id) => { calls.abandons.push([token, id]); if (current.abandonError) throw error(503); return { ...current.active, status: "abandoned" }; },
    getSession: async () => null,
  };
  let store;
  const dragTimers = new Map(), noticeTimers = new Map(); let dragTimerId = 0, noticeTimerId = 0;
  const mocks = {
    react: React, "react-native": { ...native, useColorScheme: () => scheme, useWindowDimensions: () => ({ width: current.width ?? 430, height: current.height ?? 932, scale: 3, fontScale: current.fontScale ?? 1 }), Alert: { alert: (...args) => calls.alerts.push(args) }, AppState: { addEventListener: (_name, callback) => { appState.add(callback); return { remove: () => appState.delete(callback) }; } } },
    "@expo/vector-icons": { Ionicons: "Ionicons" }, "expo-image": { Image: "Image" }, "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "expo-router": { useLocalSearchParams: () => route, useRouter: () => ({ push: (value) => calls.routes.push(["push", plain(value)]), replace: (value) => calls.routes.push(["replace", plain(value)]), back: () => calls.routes.push(["back"]) }) },
    "@react-navigation/native": { useFocusEffect: (callback) => React.useEffect(() => { calls.focus.push("focus"); const entry = { callback, cleanup: callback() }; focusEffects.add(entry); return () => { focusEffects.delete(entry); entry.cleanup?.(); }; }, [callback]) },
    "@react-native-async-storage/async-storage": { getItem: async (key) => storage.get(key) ?? null, setItem: async (key, value) => { if (current.orderSaveFailure && key.startsWith("primerep.pre-workout-order.")) throw new Error("Storage unavailable"); calls.stored.push([key, value]); storage.set(key, value); }, removeItem: async (key) => storage.delete(key) },
    "@/utils/authContext": { AuthContext }, "./authContext": { AuthContext }, "@/utils/localDate": dateHelpers, "./localDate": dateHelpers,
    "@/constants/theme": theme, "@/services/workoutLoggingService": logging,
    "@/services/exerciseService": {
      getFavoriteExercises: async (token) => { calls.favorites.push(token); if (current.favoriteLoadError) throw error(503); return current.favoriteIds ?? []; },
      favoriteExercise: async (...args) => { calls.favorite.push(args); if (current.favoriteMutation) await current.favoriteMutation(); if (current.favoriteError) throw error(503); },
      unfavoriteExercise: async (...args) => { calls.unfavorite.push(args); if (current.favoriteMutation) await current.favoriteMutation(); if (current.favoriteError) throw error(503); },
    },
    "@/services/workoutWeekService": {
      getWorkoutWeek: async (...args) => { calls.weeks.push(args); return current.getWeek ? current.getWeek(...args) : current.plan ?? plan(); },
      skipWorkoutDay: async (...args) => { calls.skips.push(args); return current.skip ? current.skip(...args) : current.skipPlan ?? plan(); },
      applyWorkoutPlanningPreference: async (...args) => { calls.bulk.push(args); return current.bulk ? current.bulk(...args) : { weekPlan: current.plan ?? plan(), updatedWorkoutCount: 1, protectedWorkoutCount: 0 }; },
      addWorkoutExercise: async (...args) => { calls.additions.push(plain(args)); return current.add ? current.add(...args) : plan([{ ...day(), blocks: [...day().blocks, { blockType: "main", items: [{ exercise: { id: args[1].exerciseId, name: "Added curl", primaryMuscle: "biceps" }, prescription: { sets: 3, reps: "8-12", restSeconds: 90 } }] }] }]); },
      updateWorkoutPlanning: async (...args) => { calls.planning.push(args); return current.planning ? current.planning(...args) : current.planningPlan ?? plan([day({ ...args[2], durationMinutes: args[2].timeBudgetMinutes ?? 35, planningSource: "override" })]); },
      updateWorkoutDuration: async (...args) => { calls.durations.push(args); return current.duration ? current.duration(...args) : current.durationPlan ?? plan([day({ durationMinutes: args[2] })]); },
    },
  };
  mocks["@/services/httpClient"] = { HttpError: class HttpError extends Error {} };
  mocks["./httpClient"] = mocks["@/services/httpClient"];
  mocks["@/services/workoutWeekService"].mapApiWorkoutDay = (api) => ({ ...api, blocks: api.exerciseBlocks ?? [] });
  mocks["@/utils/workoutPlanning"] = load("utils/workoutPlanning.ts", mocks);
  mocks["./workoutPlanning"] = mocks["@/utils/workoutPlanning"];
  const typeCache = new Map();
  const durable = loadTypescript("utils/activeWorkoutStore.web.ts", mocks, typeCache);
  store = { ...durable, clearActiveWorkout: async (id) => { calls.cleared.push(id); return durable.clearActiveWorkout(id); } };
  mocks["@/utils/activeWorkoutStore"] = store;
  mocks["@/utils/preWorkoutOrderStore"] = loadTypescript("utils/preWorkoutOrderStore.ts", mocks, typeCache);
  mocks["@/utils/workoutArrangement"] = loadTypescript("utils/workoutArrangement.ts", mocks, typeCache);
  mocks["react-native-worklets"] = { scheduleOnRN: (callback, ...args) => callback(...args) };
  mocks["react-native-reanimated"] = { __esModule: true, default: { View: "AnimatedView" }, LinearTransition: { duration: () => ({ reduceMotion: () => ({}) }) }, ReduceMotion: { System: "system" }, useReducedMotion: () => true, useSharedValue: (value) => React.useRef({ value }).current, useAnimatedStyle: (callback) => callback(), withTiming: (value) => value };
  mocks["react-native-gesture-handler"] = { GestureDetector: "GestureDetector", Gesture: { Pan: () => ({ callbacks: {}, enabled(value) { this.isEnabled = value; return this; }, minDistance() { return this; }, onStart(callback) { this.callbacks.start = callback; return this; }, onUpdate(callback) { this.callbacks.update = callback; return this; }, onEnd(callback) { this.callbacks.end = callback; return this; }, onFinalize(callback) { this.callbacks.finalize = callback; return this; } }) } };
  mocks["react-native"].AccessibilityInfo = { announceForAccessibility: (message) => calls.focus.push(message), setAccessibilityFocus: (node) => calls.focus.push(["restore", node]) };
  mocks["react-native"].findNodeHandle = () => 123;
  mocks["react-native"].Platform = { ...native.Platform, OS: current.platform ?? "ios" };
  for (const [alias, file] of [
    ["@/utils/appearanceContext", "utils/appearanceContext.tsx"], ["@/hooks/use-color-scheme", "hooks/use-color-scheme.ts"], ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"],
    ["@/components/themed-text", "components/themed-text.tsx"], ["@/components/workout/WorkoutText", "components/workout/WorkoutText.tsx"],
    ["@/components/exercises/ContentSection", "components/exercises/ContentSection.tsx"], ["@/components/workout/CoachCard", "components/workout/CoachCard.tsx"],
    ["@/utils/workoutWeekContext", "utils/workoutWeekContext.tsx"], ["@/hooks/use-workout-week", "hooks/use-workout-week.ts"], ["@/utils/activeWorkoutContext", "utils/activeWorkoutContext.tsx"],
  ]) mocks[alias] = load(file, mocks);
  mocks["@/components/workout/workout-overview-list"] = load("components/workout/workout-overview-list.tsx", mocks, { setInterval: (callback) => { const id = ++dragTimerId; dragTimers.set(id, callback); return id; }, clearInterval: (id) => dragTimers.delete(id) });
  mocks["@/components/workout/workout-planning-sheet"] = load("components/workout/workout-planning-sheet.tsx", mocks);
  mocks["@/components/explore"] = load("components/explore/ExerciseRow.tsx", mocks);
  const { AppearanceProvider, useAppearance } = mocks["@/utils/appearanceContext"];
  const { WorkoutWeekProvider, WorkoutWeekContext } = mocks["@/utils/workoutWeekContext"];
  const { ActiveWorkoutProvider, useActiveWorkout } = mocks["@/utils/activeWorkoutContext"];
  mocks["@/components/workout/workout-info-sheet"] = load("components/workout/workout-info-sheet.tsx", mocks);
  const { default: Screen } = load(routeFile, mocks, { setTimeout: (callback, delay) => { const id = ++noticeTimerId; noticeTimers.set(id, { callback, delay }); return id; }, clearTimeout: (id) => noticeTimers.delete(id) });
  let week, active, appearance, setAuth, remount, hide, repaint;
  function Bridge() {
    week = React.useContext(WorkoutWeekContext); active = useActiveWorkout(); appearance = useAppearance();
    const [generation, setGeneration] = React.useState(0);
    const [, setPaint] = React.useState(0);
    remount = () => setGeneration((value) => value + 1); hide = () => setGeneration(-1);
    repaint = () => setPaint((value) => value + 1);
    return appearance.isReady && generation >= 0 ? React.createElement(Screen, { key: generation }) : null;
  }
  function App() {
    const [identity, setIdentity] = React.useState(options.token === null ? { token: null, user: null, isLoggedIn: false } : { token: "token-A", user: { id: "user-A" }, isLoggedIn: true });
    setAuth = (token, id) => setIdentity({ token, user: token ? { id } : null, isLoggedIn: Boolean(token) });
    const auth = React.useMemo(() => ({ ...identity, logOut: async () => { calls.loggedOut.push(identity.user?.id); setIdentity({ token: null, user: null, isLoggedIn: false }); } }), [identity]);
    return React.createElement(AuthContext.Provider, { value: auth }, React.createElement(AppearanceProvider, null, React.createElement(WorkoutWeekProvider, null, React.createElement(ActiveWorkoutProvider, null, React.createElement(Bridge)))));
  }
  let tree;
  await act(async () => { tree = create(React.createElement(App), { createNodeMock: (node) => node.type === "ScrollView" ? { getNativeScrollRef: () => ({ measureInWindow: (callback) => callback(0, 100, 375, 500) }), scrollTo: (value) => calls.scrolls.push(value) } : {} }); });
  return { tree, calls, colors: theme.Colors[scheme], route, storage, week: () => week, active: () => active, appearance: () => appearance,
    store, prestart: mocks["@/utils/preWorkoutOrderStore"], coldPrestart: () => loadTypescript("utils/preWorkoutOrderStore.ts", mocks), tickAutoScroll: async () => { await act(async () => { for (const callback of dragTimers.values()) callback(); }); },
    options: (next) => { current = { ...current, ...next }; }, install: async (next) => { await act(async () => week.installWeekPlan(next)); },
    auth: async (token, id) => { await act(async () => setAuth(token, id)); }, remount: async () => { await act(async () => remount()); },
    noticeCallbacks: () => [...noticeTimers.values()].map((entry) => entry.callback),
    authNow: (token, id) => setAuth(token, id),
    hideNow: () => hide(),
    tickNotices: async () => { await act(async () => { for (const [id, timer] of [...noticeTimers]) { noticeTimers.delete(id); timer.callback(); } }); },
    hide: async () => { await act(async () => hide()); },
    refocus: async () => { await act(async () => { for (const entry of [...focusEffects]) { entry.cleanup?.(); entry.cleanup = entry.callback(); } }); },
    changeRoute: async (next) => { Object.assign(route, next); await act(async () => repaint()); },
    confirm: async (name, title) => { const dialog = calls.alerts.findLast((entry) => !title || entry[0] === title); const button = dialog?.[2]?.find((entry) => entry.text === name); assert.ok(button, `Missing ${name} action`); await act(async () => { await button.onPress?.(); }); },
  };
}
const start = (view) => host(view, "start-workout-button");
const skip = (view) => host(view, "skip-day-button") ?? host(view, "workout-options-open");
const tapSkip = async (view) => { if (!host(view, "skip-day-button")) await tap(host(view, "workout-options-open")); await tap(host(view, "skip-day-button")); };
const duration = (view, value) => host(view, `planning-minutes-${value}`);
const choosePlanning = async (view, mode, minutes) => { await tap(host(view, "workout-planning-open")); await tap(host(view, `planning-mode-${mode}`)); if (minutes) await tap(duration(view, minutes)); await tap(host(view, "planning-apply")); };
const resetCalls = (view) => { for (const value of Object.values(view.calls)) value.length = 0; };
const activeRoute = { pathname: "/workout/active", params: { workoutDayId: "day-one", weekStart } };

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: planning sheet offers all eight budgets, keeps its draft local, and cancels without regeneration`, async () => {
    const view = await detail({ scheme, fontScale: 1.8, width: 320 });
    await tap(host(view, "workout-planning-open"));
    for (const minutes of [25, 35, 45, 60, 75, 90, 105, 120]) {
      const choice = duration(view, minutes);
      assert.equal(choice.props.accessibilityRole, "radio");
      assert.equal(choice.props.accessibilityLabel, `Up to ${minutes} minutes`);
      assert.notEqual(choice.findByType("Text").props.allowFontScaling, false);
    }
    await tap(duration(view, 120));
    assert.equal(duration(view, 120).props.accessibilityState.checked, true);
    await tap(label(view, "Close workout planning"));
    assert.deepEqual(view.calls.planning, []);
    await tap(host(view, "workout-planning-open"));
    assert.equal(duration(view, 35).props.accessibilityState.checked, true);
    await unmount(view);
  });

  test(`${scheme}: trainer-led leads with exercises and keeps the estimate behind workout details`, async () => {
    const view = await detail({ scheme, plan: plan([day({ planningMode: "trainer_led", timeBudgetMinutes: null, durationMinutes: 50, estimatedMinutes: 50 })]) });
    assert.match(textOf(view.tree.root), /Monday, Oct 12 • 2 exercises/);
    assert.equal(host(view, "workout-estimate"), undefined);
    assert.ok(text(view, "Trainer-led"));
    assert.equal(text(view, "About 50 min"), undefined);
    await tap(host(view, "workout-info-open"));
    assert.ok(text(view, "About 50 min"));
    await tap(host(view, "workout-info-close"));
    await tap(host(view, "workout-planning-open"));
    await tap(host(view, "planning-mode-time_budget"));
    assert.equal(duration(view, 35).props.accessibilityState.checked, true);
    await tap(host(view, "planning-apply"));
    await view.confirm("Rebuild workout");
    assert.equal(view.calls.planning.at(-1)[2].timeBudgetMinutes, 35);
    await unmount(view);
  });

  test(`${scheme}: planning changes require confirmation and choosing the existing option is a no-op`, async () => {
    const view = await detail({ scheme }); resetCalls(view);
    await choosePlanning(view, "time_budget", 35); assert.deepEqual(view.calls.alerts, []);
    await choosePlanning(view, "time_budget", 90);
    assert.equal(view.calls.alerts[0][0], "Rebuild this workout?");
    assert.match(view.calls.alerts[0][1], /saved order may change/);
    await view.confirm("Cancel");
    assert.deepEqual(view.calls.planning, []); assert.equal(start(view).props.disabled, false);
    await unmount(view);
  });

  test(`${scheme}: pending planning mutation is submitted once and blocks same-tick Start`, async () => {
    const pending = deferred(); const view = await detail({ scheme, planning: () => pending.promise }); resetCalls(view);
    await choosePlanning(view, "time_budget", 120);
    const confirm = view.calls.alerts.at(-1)[2][1].onPress;
    let completion;
    await act(async () => { completion = confirm(); void confirm(); start(view).props.onPress(); });
    assert.deepEqual(plain(view.calls.planning), [["token-A", "day-one", { planningMode: "time_budget", timeBudgetMinutes: 120 }, { weekStart, effectiveDate: weekStart }]]);
    assert.equal(start(view).props.disabled, true); assert.equal(skip(view).props.disabled, true);
    assert.deepEqual(view.calls.routes, []); assert.deepEqual(view.calls.created, []);
    await act(async () => { pending.resolve(plan([day({ planningMode: "time_budget", timeBudgetMinutes: 120, durationMinutes: 120, planningSource: "override" })])); await completion; });
    assert.equal(start(view).props.disabled, false); assert.match(textOf(view.tree.root), /Up to 120 min/);
    await unmount(view);
  });

  test(`${scheme}: a rejected budget leaves the existing workout and saved order intact`, async () => {
    const failure = Object.assign(new Error("too short"), { status: 409, payload: { detail: { code: "workout_time_budget_too_short", minimumUsefulMinutes: 40 } } });
    const view = await detail({ scheme, planning: async () => { throw failure; } });
    await tap(host(view, "workout-overview-up-row"));
    await choosePlanning(view, "time_budget", 25); await view.confirm("Rebuild workout");
    assert.match(view.calls.alerts.at(-1)[1], /at least about 40 minutes/);
    assert.deepEqual(overviewIds(view), ["row", "bench"]);
    assert.equal(start(view).props.disabled, false);
    await unmount(view);
  });

  test(`${scheme}: server-locked and past workouts do not offer planning edits`, async () => {
    for (const extra of [{ planningEditable: false }, { date: "2026-10-11" }]) {
      const view = await detail({ scheme, plan: plan([day(extra)]) });
      assert.equal(host(view, "workout-planning-open").props.disabled, true);
      assert.deepEqual(view.calls.planning, []); await unmount(view);
    }
  });
}

test("late planning confirmation after account ABA cannot mutate a workout", async () => {
  const view = await detail(); await choosePlanning(view, "trainer_led");
  const confirm = view.calls.alerts.at(-1)[2][1].onPress;
  await view.auth("token-B", "user-B"); await view.auth("token-A", "user-A");
  await act(async () => { await confirm(); });
  assert.deepEqual(view.calls.planning, []); await unmount(view);
});

test("a late planning response after account switch never installs its old plan", async () => {
  const pending = deferred(); const view = await detail({ planning: () => pending.promise });
  await choosePlanning(view, "trainer_led"); let completion;
  await act(async () => { completion = view.calls.alerts.at(-1)[2][1].onPress(); });
  await view.auth("token-B", "user-B");
  await act(async () => { pending.resolve(plan([day({ title: "Old account planning result", planningMode: "trainer_led" })])); await completion; });
  assert.equal(text(view, "Old account planning result"), undefined);
  assert.deepEqual(view.calls.routes, []); await unmount(view);
});

test("planning metadata changes reset a saved order even when exercise IDs and targets match", async () => {
  const view = await detail(); await tap(host(view, "workout-overview-up-row"));
  await view.install(plan([day({ planningMode: "trainer_led", timeBudgetMinutes: null, durationMinutes: 35, planningSource: "override" })]));
  assert.deepEqual(overviewIds(view), ["bench", "row"]);
  assert.match(textOf(host(view, "workout-overview-order-message")), /Exercise order reset/);
  await unmount(view);
});

test("an uncertain planning response blocks new Starts until the authoritative week is refreshed", async () => {
  const view = await detail({ planning: async () => { throw new Error("Response lost"); } });
  await choosePlanning(view, "trainer_led"); await view.confirm("Rebuild workout");
  assert.equal(view.week().planningRefreshRequired, true); assert.equal(start(view).props.disabled, true);
  const before = view.calls.active.length;
  await act(async () => { await start(view).props.onPress(); }); assert.equal(view.calls.active.length, before);
  view.options({ getWeek: async () => plan([day({ planningMode: "trainer_led", timeBudgetMinutes: null, planningSource: "override" })]) });
  await tap(host(view, "workout-planning-refresh"));
  assert.equal(view.week().planningRefreshRequired, false); assert.equal(start(view).props.disabled, false);
  assert.ok(text(view, "Trainer-led")); await unmount(view);
});

test("legacy saved exercise order survives equivalent server metadata but an explicit planning change invalidates it", async () => {
  const view = await detail(); await tap(host(view, "workout-overview-up-row"));
  const stored = [...view.storage.entries()].find(([key]) => key.startsWith("primerep.pre-workout-order."));
  const fingerprint = JSON.parse(JSON.parse(stored[1]).fingerprint);
  assert.equal("planningMode" in fingerprint, false);
  await view.install(plan([day({ planningMode: "time_budget", timeBudgetMinutes: 35, planningSource: "default" })]));
  assert.deepEqual(overviewIds(view), ["row", "bench"]);
  await view.install(plan([day({ planningMode: "time_budget", timeBudgetMinutes: 35, planningSource: "override" })]));
  assert.deepEqual(overviewIds(view), ["bench", "row"]);
  assert.match(textOf(host(view, "workout-overview-order-message")), /Exercise order reset/);
  await unmount(view);
});

test("bulk planning completion belongs to the account provider after Settings unmount and pending reads cannot clear its barrier", async () => {
  const pending = deferred(); const view = await detail({ bulk: () => pending.promise }); let completion;
  await act(async () => { completion = view.week().applyPlanningPreference({ weekStart, effectiveDate: weekStart }); });
  assert.equal(view.week().planningRefreshRequired, true);
  await view.hide(); const count = view.calls.weeks.length;
  await act(async () => { assert.equal(await view.week().refreshWeek(), null); });
  assert.equal(view.calls.weeks.length, count); assert.equal(view.week().planningRefreshRequired, true);
  await act(async () => { pending.resolve({ weekPlan: plan([day({ planningMode: "trainer_led", timeBudgetMinutes: null, title: "Committed trainer plan" })]), updatedWorkoutCount: 1, protectedWorkoutCount: 0 }); await completion; });
  assert.equal(view.week().planningRefreshRequired, false);
  assert.equal(view.week().weekPlan.workouts[0].title, "Committed trainer plan");
  await view.remount(); assert.ok(text(view, "Committed trainer plan")); await unmount(view);
});

test("a bulk timeout after Back still blocks new Starts until an authoritative post-mutation refresh", async () => {
  const pending = deferred(); const view = await detail({ bulk: () => pending.promise }); let completion;
  await act(async () => { completion = view.week().applyPlanningPreference({ weekStart, effectiveDate: weekStart }).catch(() => null); });
  await view.hide();
  await act(async () => { pending.reject(new Error("Lost response after commit")); await completion; });
  assert.equal(view.week().planningRefreshRequired, true);
  await view.remount(); assert.equal(start(view).props.disabled, true);
  view.options({ getWeek: async () => plan([day({ planningMode: "trainer_led", timeBudgetMinutes: null, planningSource: "default" })]) });
  await tap(host(view, "workout-planning-refresh"));
  assert.equal(view.week().planningRefreshRequired, false); assert.equal(start(view).props.disabled, false);
  await unmount(view);
});

test("a stale old-account bulk reply cannot cancel the new account's pending read after ABA", async () => {
  const pending = deferred(); const view = await detail({ bulk: () => pending.promise }); let completion;
  await act(async () => { completion = view.week().applyPlanningPreference({ weekStart, effectiveDate: weekStart }).catch(() => null); });
  await view.auth("token-B", "user-B"); await view.auth("token-A", "user-A");
  const fresh = deferred(); view.options({ getWeek: () => fresh.promise }); let read;
  await act(async () => { read = view.week().refreshWeek(); });
  await act(async () => { pending.reject(new Error("Old account response")); await completion; });
  await act(async () => { fresh.resolve(plan([day({ title: "New account authority" })])); await read; });
  assert.equal(view.week().weekPlan.workouts[0].title, "New account authority");
  assert.equal(view.week().planningRefreshRequired, false); await unmount(view);
});

test("maximum text keeps the planning title in the scroll body and a compact close bar above reachable budgets", async () => {
  const view = await detail({ scheme: "dark", width: 390, height: 844, fontScale: 3.2 });
  await tap(host(view, "workout-planning-open"));
  const modal = view.tree.root.findByType("Modal");
  const heading = modal.findAllByType("Text").find((node) => textOf(node) === "Workout planning");
  assert.equal(heading.parent.type, "ScrollView");
  assert.equal(heading.props.numberOfLines, undefined); assert.notEqual(heading.props.allowFontScaling, false);
  const close = label(view, "Close workout planning");
  assert.equal(flat(close.props.style).minHeight, 44);
  assert.equal(flat(close.parent.props.style).paddingVertical, 0);
  assert.equal(close.parent.findAllByType("Text").length, 0);
  assert.ok(duration(view, 120)); await tap(duration(view, 120));
  assert.equal(duration(view, 120).props.accessibilityState.checked, true);
  await unmount(view);
});

test("returning to a cached overview discovers a locally started workout without a provider hint and locks planning", async () => {
  const view = await detail();
  assert.equal(view.active().activeWorkout, null);
  const local = { userId: "user-A", workoutDayId: "day-one", workoutDate: weekStart, dayType: "upper_body", workoutSnapshot: day(), effectiveWorkout: day(),
    clientSessionId: "unannounced-local-session", serverSessionId: null, startedAt: Clock.now(), currentExerciseIndex: 0,
    restEndsAt: null, restTotalSeconds: 0, restContext: null, revision: 1, operations: [],
    sets: [{ exerciseId: "bench", setNumber: 1, reps: "8", weight: "20", confirmed: true, logId: "saved-set", syncing: false, syncStatus: "synced" }] };
  await view.store.saveActiveWorkout(local);
  assert.equal(view.active().activeWorkout, null);
  await view.refocus();
  const planning = host(view, "workout-planning-open");
  assert.equal(planning.props.disabled, true);
  assert.equal(planning.findAllByType("Ionicons").length, 0);
  await act(async () => planning.props.onPress());
  assert.equal(view.tree.root.findAllByType("Modal").length, 0);
  assert.deepEqual(view.calls.planning, []);
  assert.equal((await view.store.loadActiveWorkout("user-A")).sets[0].logId, "saved-set");
  await view.store.clearActiveWorkout("user-A"); await view.refocus();
  assert.equal(host(view, "workout-planning-open").props.disabled, false);
  await view.store.saveActiveWorkout({ ...local, clientSessionId: "other-day-local", workoutDayId: "other-day" }); await view.refocus();
  assert.equal(host(view, "workout-planning-open").props.disabled, false);
  await unmount(view);
});

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: actual loaded plan renders real shared rows, prescriptions and unchanged theme`, async () => {
    const view = await detail({ scheme });
    assert.ok(text(view, "Upper body strength")); assert.ok(text(view, "Main Lifts")); assert.ok(text(view, "Accessories"));
    assert.ok(text(view, "Barbell bench press")); assert.ok(text(view, "Cable row")); assert.ok(text(view, "8-12")); assert.ok(text(view, "90s"));
    assert.equal(view.tree.root.findAllByType("Pressable").filter((node) => node.props.testID === "exercise-row").length, 2);
    assert.equal(flat(view.tree.root.findByType("SafeAreaView").props.style).backgroundColor, view.colors.background);
    assert.equal(flat(start(view).props.style).backgroundColor, view.colors.primaryButton);
    assert.ok(host(view, "workout-planning-open")); assert.match(textOf(view.tree.root), /Up to 35 min/);
    assert.deepEqual(view.calls.skips, []); assert.deepEqual(view.calls.durations, []); assert.deepEqual(view.calls.routes, []);
    await unmount(view);
  });
  test(`${scheme}: no active session opens exact current workout and week route without mutation`, async () => {
    const view = await detail({ scheme }); resetCalls(view); await tap(start(view));
    assert.deepEqual(view.calls.active, ["token-A"]); assert.deepEqual(view.calls.routes, [["push", activeRoute]]); assert.deepEqual(view.calls.abandons, []); assert.deepEqual(view.calls.cleared, []); await unmount(view);
  });
  test(`${scheme}: matching active day opens workout route without abandon or different-session dialog`, async () => {
    const view = await detail({ scheme, active: session({ workoutDayId: "day-one" }) }); resetCalls(view); await tap(start(view));
    assert.deepEqual(view.calls.routes, [["push", { pathname: "/workout/active", params: { sessionId: "other-session" } }]]); assert.deepEqual(view.calls.alerts, []); assert.deepEqual(view.calls.abandons, []); await unmount(view);
  });
  test(`${scheme}: different active workout offers named Resume with exact session route and no discard`, async () => {
    const view = await detail({ scheme, active: session() }); resetCalls(view); await tap(start(view));
    const [title, message, buttons] = view.calls.alerts[0]; assert.equal(title, "Existing lower workout is in progress"); assert.match(message, /^1 set logged\. Resume it/); assert.equal(buttons[1].style, "destructive");
    await view.confirm("Resume Existing lower workout"); assert.deepEqual(view.calls.routes, [["push", { pathname: "/workout/active", params: { sessionId: "other-session" } }]]); assert.deepEqual(view.calls.abandons, []); assert.deepEqual(view.calls.cleared, []); await unmount(view);
  });
  test(`${scheme}: active snapshot fallback and plural/no-set progress labels remain factual`, async () => {
    for (const logs of [[], [{}, {}]]) { const view = await detail({ scheme, active: session({ workoutSnapshot: null, setLogs: logs }) }); resetCalls(view); await tap(start(view)); assert.equal(view.calls.alerts[0][0], "lower body workout is in progress"); assert.ok(view.calls.alerts[0][1].startsWith(logs.length ? "2 sets logged." : "No sets logged yet.")); await unmount(view); }
  });
  test(`${scheme}: confirmed Abandon clears only current owner, marks real active provider terminal and starts`, async () => {
    const view = await detail({ scheme, active: session() }); assert.equal(view.active().activeWorkout.sessionId, "other-session"); resetCalls(view); await tap(start(view)); await view.confirm("Abandon & Start");
    assert.deepEqual(view.calls.abandons, [["token-A", "other-session"]]); assert.deepEqual(view.calls.cleared, ["user-A"]); assert.equal(view.active().activeWorkout, null); assert.deepEqual(view.calls.routes, [["push", activeRoute]]); await unmount(view);
  });
  test(`${scheme}: abandon failure keeps active workout and prevents start, clear and navigation`, async () => {
    const view = await detail({ scheme, active: session(), abandonError: true }); resetCalls(view); await tap(start(view)); await view.confirm("Abandon & Start");
    assert.equal(view.calls.alerts.at(-1)[0], "Couldn't abandon workout"); assert.equal(view.active().activeWorkout.sessionId, "other-session"); assert.deepEqual(view.calls.cleared, []); assert.deepEqual(view.calls.routes, []); await unmount(view);
  });
  test(`${scheme}: active-session lookup failure does not start or abandon`, async () => {
    const view = await detail({ scheme, activeError: true }); resetCalls(view); await tap(start(view)); assert.equal(view.calls.alerts[0][0], "Couldn’t start workout"); assert.deepEqual(view.calls.routes, []); assert.deepEqual(view.calls.abandons, []); await unmount(view);
  });
  test(`${scheme}: Skip confirmation can cancel without calling mutation`, async () => {
    const view = await detail({ scheme }); resetCalls(view); await tapSkip(view); assert.equal(view.calls.alerts[0][0], "Skip Workout"); assert.match(view.calls.alerts[0][1], /Upper body strength/); await view.confirm("Cancel"); assert.deepEqual(view.calls.skips, []); assert.deepEqual(view.calls.routes, []); await unmount(view);
  });
  test(`${scheme}: confirmed Skip uses same slot from returned plan rather than old context`, async () => {
    const returned = plan([day({ workoutDayId: "new-slot", title: "Replacement", slotIndex: 1 }), day({ workoutDayId: "first", slotIndex: 0 })], "2026-10-19");
    const view = await detail({ scheme, skipPlan: returned }); resetCalls(view); await tapSkip(view); await view.confirm("Skip", "Skip Workout"); assert.deepEqual(view.calls.skips, [["token-A", "day-one", weekStart]]); assert.deepEqual(view.calls.routes, [["replace", { pathname: "/workouts/[workoutDayId]", params: { workoutDayId: "new-slot", weekStart: "2026-10-19" } }]]); assert.equal(view.calls.skips.length, 1); await unmount(view);
  });
  test(`${scheme}: Skip fallback prefers today, then upcoming, then first slot, then Back for empty`, async () => {
    const variants = [
      [[day({ workoutDayId: "past", slotIndex: 0, date: "2026-10-11" }), day({ workoutDayId: "today", slotIndex: 4 })], "today"],
      [[day({ workoutDayId: "past", slotIndex: 0, date: "2026-10-11" }), day({ workoutDayId: "upcoming", slotIndex: 4, date: "2026-10-14" })], "upcoming"],
      [[day({ workoutDayId: "last", slotIndex: 4, date: "2026-10-10" }), day({ workoutDayId: "first", slotIndex: 0, date: "2026-10-09" })], "first"], [[], null],
    ];
    for (const [days, expected] of variants) { const view = await detail({ scheme, skipPlan: plan(days) }); resetCalls(view); await tapSkip(view); await view.confirm("Skip", "Skip Workout"); assert.deepEqual(view.calls.routes, expected ? [["replace", { pathname: "/workouts/[workoutDayId]", params: { workoutDayId: expected, weekStart } }]] : [["back"]]); await unmount(view); }
  });
  test(`${scheme}: Skip network failure preserves the plan, stops busy state and does not navigate`, async () => {
    const view = await detail({ scheme, skip: async () => { throw error(503); } }); resetCalls(view); await tapSkip(view); await view.confirm("Skip", "Skip Workout"); assert.equal(view.week().error, "Boundary request failed"); assert.equal(skip(view).props.disabled, false); assert.deepEqual(view.calls.routes, []); assert.ok(text(view, "Upper body strength")); await unmount(view);
  });
  test(`${scheme}: program workout locks duration and retains original prescriptions and Start`, async () => {
    const view = await detail({ scheme, plan: plan([day({ programActivationId: "activation-one" })]) }); assert.ok(host(view, "program-duration-locked")); await tap(host(view, "workout-info-open")); assert.ok(text(view, "Duration and set targets come from your active program.")); await tap(host(view, "workout-info-close")); assert.equal(duration(view, 25), undefined); assert.ok(text(view, "8-12")); assert.ok(start(view)); assert.deepEqual(view.calls.durations, []); await unmount(view);
  });
  test(`${scheme}: stale Skip retains provider plus missing-ID refresh and no mutation retry before Home OK`, async () => {
    const view = await detail({ scheme, skip: async () => { throw error(404); } }); resetCalls(view); view.options({ getWeek: async () => plan([day({ workoutDayId: "replacement" })]) }); await tapSkip(view); await view.confirm("Skip", "Skip Workout"); assert.equal(view.calls.skips.length, 1); assert.deepEqual(view.calls.weeks, [["token-A", weekStart, false], ["token-A", weekStart, false]]); assert.equal(view.calls.alerts.at(-1)[0], "Plan Refreshed"); assert.deepEqual(view.calls.routes, []); await view.confirm("OK", "Plan Refreshed"); assert.deepEqual(view.calls.routes, [["replace", "/(tabs)"]]); assert.equal(view.week().staleIdRefreshed, false); await unmount(view);
  });
  test(`${scheme}: pending initial week shows actual loading state and named Back`, async () => {
    const pending = deferred(); const view = await detail({ scheme, getWeek: () => pending.promise }); assert.ok(text(view, "Loading workout...")); assert.equal(start(view), undefined); await tap(label(view, "Back from workout")); assert.deepEqual(view.calls.routes, [["back"]]); await act(async () => pending.resolve(plan())); assert.ok(start(view)); await unmount(view);
  });
  test(`${scheme}: missing ID retries refresh once then shows actual unavailable Back actions`, async () => {
    const view = await detail({ scheme, id: "absent", plan: plan() }); assert.ok(text(view, "Workout not found")); assert.ok(text(view, "This workout may have been removed or updated.")); assert.equal(view.calls.weeks.length, 2); assert.equal(start(view), undefined); await tap(label(view, "Back from unavailable workout")); await tap(view.tree.root.findAllByType("Pressable").find((node) => textOf(node) === "Go Back")); assert.deepEqual(view.calls.routes, [["back"], ["back"]]); await unmount(view);
  });
  test(`${scheme}: an empty-block workout retains loaded title, duration and original Start behavior`, async () => {
    const view = await detail({ scheme, plan: plan([day({ blocks: [] })]) }); assert.ok(text(view, "Upper body strength")); assert.equal(view.tree.root.findAllByType("AnimatedView").filter((node) => node.props.testID?.startsWith("workout-overview-card-")).length, 0); assert.ok(start(view)); resetCalls(view); await tap(start(view)); assert.deepEqual(view.calls.routes, [["push", activeRoute]]); await unmount(view);
  });
  test(`${scheme}: long title stays exact and uncapped while real row and exercise navigation stay intact`, async () => {
    const title = "Upper body strength with a deliberately long fictional workout title and accessories"; const view = await detail({ scheme, plan: plan([day({ title })]) }); const heading = text(view, title); assert.ok(heading); assert.equal(heading.props.numberOfLines, undefined); assert.notEqual(heading.props.allowFontScaling, false); await tap(label(view, "Barbell bench press, chest")); assert.deepEqual(view.calls.routes, [["push", { pathname: "/exercises/[id]", params: { id: "bench" } }]]); await unmount(view);
  });
  test(`${scheme}: historical ID never uses current-week collision; original focused resync can make it unavailable`, async () => {
    const pending = deferred(), historical = "2026-10-05"; const view = await detail({ scheme, routeWeek: historical, getWeek: (_token, requested) => requested === historical ? pending.promise : plan([day({ title: "Current-week collision" })]) }); assert.equal(start(view), undefined); assert.equal(text(view, "Current-week collision"), undefined); assert.ok(text(view, "Loading workout...")); await act(async () => pending.resolve(plan([day({ title: "Historical snapshot", date: historical })], historical))); console.log(JSON.stringify({ probe: "historical-focused-resync", scheme, weeks: view.calls.weeks, visibleTitle: text(view, "Historical snapshot") ? "historical" : text(view, "Workout not found") ? "unavailable" : "other", providerWeek: view.week().weekPlan?.weekStart })); assert.equal(start(view), undefined); assert.equal(text(view, "Current-week collision"), undefined); assert.ok(text(view, "Workout not found")); assert.deepEqual(view.calls.weeks, [["token-A", weekStart, false], ["token-A", historical, false], ["token-A", weekStart, false]]); assert.deepEqual(view.calls.routes, []); await unmount(view);
  });
  test(`${scheme}: real Week provider fences an obsolete account response and current account owns the displayed snapshot`, async () => {
    const pending = deferred(); const view = await detail({ scheme, getWeek: (token) => token === "token-A" ? pending.promise : plan([day({ title: "Account B workout" })]) }); await view.auth("token-B", "user-B"); assert.ok(text(view, "Account B workout")); await act(async () => pending.resolve(plan([day({ title: "Obsolete account A workout" })]))); assert.equal(text(view, "Obsolete account A workout"), undefined); assert.ok(text(view, "Account B workout")); resetCalls(view); await tap(start(view)); assert.deepEqual(view.calls.active, ["token-B"]); await unmount(view);
  });
  test(`${scheme}: real row toggles UI without navigation; deferred original capture can repeat favorite transport`, async () => {
    const view = await detail({ scheme }); resetCalls(view); await tap(host(view, "exercise-favorite-bench")); assert.deepEqual(view.calls.favorite, [["bench", "token-A"]]); assert.equal(host(view, "exercise-favorite-bench").props.accessibilityLabel, "Remove Barbell bench press from favorites"); await tap(host(view, "exercise-favorite-bench")); console.log(JSON.stringify({ probe: "deferred-original-favorite-action", scheme, favorite: view.calls.favorite, unfavorite: view.calls.unfavorite, label: host(view, "exercise-favorite-bench").props.accessibilityLabel })); assert.deepEqual(view.calls.favorite, [["bench", "token-A"], ["bench", "token-A"]]); assert.deepEqual(view.calls.unfavorite, []); assert.equal(host(view, "exercise-favorite-bench").props.accessibilityLabel, "Add Barbell bench press to favorites"); assert.deepEqual(view.calls.routes, []); await unmount(view);
  });
  test(`${scheme}: delayed failed toggle restores captured favorite snapshot and records existing transport choice`, async () => {
    const pending = deferred(); const view = await detail({ scheme, favoriteIds: ["bench"], favoriteMutation: () => pending.promise }); resetCalls(view); await tap(host(view, "exercise-favorite-bench")); assert.equal(host(view, "exercise-favorite-bench").props.accessibilityLabel, "Add Barbell bench press to favorites"); await act(async () => pending.reject(error(503))); console.log(JSON.stringify({ probe: "delayed-original-favorite-rollback", scheme, favorite: view.calls.favorite, unfavorite: view.calls.unfavorite, label: host(view, "exercise-favorite-bench").props.accessibilityLabel })); assert.deepEqual(view.calls.favorite, [["bench", "token-A"]]); assert.deepEqual(view.calls.unfavorite, []); assert.equal(host(view, "exercise-favorite-bench").props.accessibilityLabel, "Remove Barbell bench press from favorites"); assert.deepEqual(view.calls.routes, []); await unmount(view);
  });
  test(`${scheme}: optional real Coach/rationale sections and equipment/rotation notices preserve content`, async () => {
    const view = await detail({ scheme, plan: plan([day({ workoutIntent: "Fictional focus", unavailableMuscles: ["calves"], deferredMuscles: ["forearms"] })]) }); assert.equal(text(view, "Fictional focus"), undefined); await tap(host(view, "workout-info-open")); assert.ok(text(view, "Fictional focus")); assert.ok(text(view, "We couldn't add calves with your current equipment.")); assert.ok(text(view, "forearms will be prioritized in your next custom workout.")); await tap(host(view, "workout-info-close")); const title = text(view, "Why this exercise"); let toggle = title.parent; while (toggle && toggle.type !== "Pressable") toggle = toggle.parent; await tap(toggle); assert.ok(text(view, "A fictional pressing explanation.")); await tap(toggle); assert.equal(text(view, "A fictional pressing explanation."), undefined); await unmount(view);
  });
  test(`${scheme}: explicit no-token screen context makes no session/favorite/week requests`, async () => {
    const view = await detail({ scheme, token: null }); assert.deepEqual(view.calls.weeks, []); assert.deepEqual(view.calls.active, []); assert.deepEqual(view.calls.favorites, []); assert.equal(start(view), undefined); await unmount(view);
  });
  test(`${scheme}: initial no-plan fetch error preserves existing header-only controller quirk`, async () => {
    const view = await detail({ scheme, getWeek: async () => { throw error(503, "Offline fixture"); } }); assert.equal(view.week().weekPlan, null); assert.equal(view.week().error, "Offline fixture"); assert.equal(view.week().isLoading, false); assert.equal(text(view, "Loading workout..."), undefined); assert.equal(text(view, "Workout not found"), undefined); assert.equal(start(view), undefined); assert.ok(text(view, "Workout")); assert.equal(view.calls.weeks.length, 1); await unmount(view);
  });
  test(`${scheme}: real appearance change and screen remount retain real plan and make no mutations`, async () => {
    const view = await detail({ scheme }); const before = plain(view.week().weekPlan); await act(async () => view.appearance().setPreference(scheme === "light" ? "dark" : "light")); assert.equal(flat(view.tree.root.findByType("SafeAreaView").props.style).backgroundColor, theme.Colors[scheme === "light" ? "dark" : "light"].background); await view.remount(); assert.deepEqual(plain(view.week().weekPlan), before); assert.deepEqual(view.calls.skips, []); assert.deepEqual(view.calls.durations, []); assert.deepEqual(view.calls.abandons, []); assert.deepEqual(view.calls.routes, []); await unmount(view);
  });
}

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: Start is a named growing button in a solid footer sibling without an absolute overlay`, async () => {
    const view = await detail({ scheme });
    const footer = host(view, "workout-start-footer");
    const list = host(view, "workout-detail-list");
    assert.equal(footer.parent.type, "SafeAreaView");
    assert.equal(footer.parent.children.at(-1), footer);
    assert.equal(list.findAllByProps({ testID: "start-workout-button" }).length, 0);
    assert.deepEqual(plain(footer.parent.props.edges), ["top", "bottom"]);
    const footerStyle = flat(footer.props.style);
    for (const key of ["position", "bottom", "left", "right"]) assert.equal(footerStyle[key], undefined);
    assert.equal(footerStyle.backgroundColor, view.colors.background);
    assert.equal(footerStyle.flexShrink, 0);
    assert.equal(footerStyle.paddingBottom, 12);
    assert.equal(flat(list.props.style).flex, 1);
    assert.equal(list.props.contentInsetAdjustmentBehavior, "automatic");
    assert.equal(flat(list.props.contentContainerStyle).paddingBottom, 24);
    const button = start(view), label = button.findByType("Text");
    assert.equal(button.props.accessibilityRole, "button");
    assert.equal(button.props.accessibilityLabel, "Start Workout");
    assert.equal(button.props.disabled, false);
    assert.equal(flat(button.props.style).minHeight, 56);
    assert.equal(flat(button.props.style).backgroundColor, view.colors.primaryButton);
    assert.equal(flat(label.props.style).flexShrink, 1);
    assert.equal(flat(label.props.style).minWidth, 0);
    assert.equal(flat(label.props.style).textAlign, "center");
    assert.equal(flat(label.props.style).fontFamily, theme.Fonts.sans);
    assert.notEqual(label.props.allowFontScaling, false);
    for (const key of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(label.props[key], undefined);
    assert.deepEqual(view.calls.skips, []);
    assert.deepEqual(view.calls.durations, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view);
  });
  test(`${scheme}: Skip keeps its existing test ID, named button and neutral minimum target`, async () => {
    const view = await detail({ scheme });
    await tap(host(view, "workout-options-open"));
    const button = host(view, "skip-day-button");
    assert.equal(button.props.testID, "skip-day-button");
    assert.equal(button.props.accessibilityRole, "button");
    assert.equal(button.props.accessibilityLabel, "Skip Day");
    assert.equal(flat(button.props.style).minHeight, 44);
    assert.deepEqual(plain(button.props.accessibilityState), { disabled: false, busy: false });
    assert.deepEqual(view.calls.skips, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view);
  });
  test(`${scheme}: loading/unavailable states retain both safe edges and the actual Go Back action name`, async () => {
    const pending = deferred();
    const loading = await detail({ scheme, getWeek: () => pending.promise });
    assert.deepEqual(plain(loading.tree.root.findByType("SafeAreaView").props.edges), ["top", "bottom"]);
    assert.ok(text(loading, "Loading workout..."));
    await act(async () => pending.resolve(plan()));
    await unmount(loading);
    const view = await detail({ scheme, id: "fictional-missing-workout" });
    assert.ok(text(view, "Workout not found"));
    assert.deepEqual(plain(view.tree.root.findByType("SafeAreaView").props.edges), ["top", "bottom"]);
    const button = label(view, "Go Back");
    assert.equal(button.props.accessibilityRole, "button");
    assert.equal(flat(button.props.style).minHeight, 44);
    resetCalls(view);
    await tap(button);
    assert.deepEqual(view.calls.routes, [["back"]]);
    await unmount(view);
  });
  test(`${scheme}: prescription fields keep complete 10-15 and 75s values in natural wrapping groups`, async () => {
    const item = { ...day().blocks[0].items[0], prescription: { sets: 3, reps: "10-15", restSeconds: 75 } };
    const view = await detail({ scheme, plan: plan([day({ blocks: [{ blockType: "main", items: [item] }] })]) });
    const group = text(view, "Reps").parent;
    const container = group.parent;
    assert.equal(flat(container.props.style).flexWrap, "wrap");
    assert.equal(container.children.length, 3);
    assert.deepEqual(container.children.map((child) => child.findAllByType("Text").map(textOf)), [["Sets", "3"], ["Reps", "10-15"], ["Rest", "75s"]]);
    for (const field of container.children) {
      const style = flat(field.props.style);
      assert.equal(style.flexShrink, 0);
      for (const node of field.findAllByType("Text")) {
        assert.notEqual(node.props.allowFontScaling, false);
        for (const key of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(node.props[key], undefined);
      }
    }
    assert.deepEqual(view.calls.durations, []);
    assert.deepEqual(view.calls.skips, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view);
  });
  test(`${scheme}: enlarged loaded heading scrolls while the fixed Back bar and normal heading are retained`, async () => {
    for (const [fontScale, width] of [[1, 430], [1.3, 375], [1.31, 320], [3.1, 375]]) {
      const title = "Full Body with a long unchanged workout title";
      const view = await detail({ scheme, fontScale, width, plan: plan([day({ title })]) });
      const list = host(view, "workout-detail-list");
      const expanded = fontScale > 1.3;
      const heading = host(view, expanded ? "workout-scroll-heading" : "workout-header-heading");
      assert.ok(heading);
      assert.equal(list.findAllByProps({ testID: "workout-scroll-heading" }).length, expanded ? 1 : 0);
      assert.equal(host(view, expanded ? "workout-header-heading" : "workout-scroll-heading"), undefined);
      assert.ok(text(view, title));
      assert.ok(text(view, "Monday, Oct 12 • 2 exercises"));
      assert.equal(heading.findAllByType("Text").map(textOf).filter((value) => value === title).length, 1);
      for (const node of heading.findAllByType("Text")) {
        assert.notEqual(node.props.allowFontScaling, false);
        for (const key of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(node.props[key], undefined);
      }
      const back = label(view, "Back from workout details");
      assert.equal(list.findAllByProps({ accessibilityLabel: "Back from workout details" }).length, 0);
      assert.equal(back.props.accessibilityRole, "button");
      if (expanded) {
        assert.equal(flat(back.props.style).width, 44);
        assert.equal(flat(back.props.style).height, 44);
        assert.equal(back.parent.children.length, 2);
        assert.equal(flat(back.parent.props.style).paddingVertical, 8);
        assert.equal(heading.parent.children[0], heading);
      } else {
        assert.equal(back.parent.children.includes(heading), true);
      }
      assert.equal(host(view, "workout-start-footer").parent.type, "SafeAreaView");
      assert.deepEqual(view.calls.skips, []);
      assert.deepEqual(view.calls.durations, []);
      assert.deepEqual(view.calls.routes, []);
      await unmount(view);
    }
  });
  test(`${scheme}: section names and counts remain uncapped in a naturally wrapping header`, async () => {
    const first = day().blocks[0].items[0];
    const view = await detail({ scheme, fontScale: 3.1, width: 320, plan: plan([day({ blocks: [{ blockType: "main", items: [first, { ...first, exercise: { ...first.exercise, id: "another-bench" } }] }] })]) });
    const title = text(view, "Main Lifts");
    const header = title.parent.parent;
    const count = text(view, "2 exercises");
    assert.equal(count.parent.parent, header);
    assert.equal(flat(header.props.style).flexDirection, "row");
    assert.equal(flat(header.props.style).flexWrap, "wrap");
    assert.equal(flat(header.props.style).gap, 8);
    assert.equal(flat(title.props.style).flexShrink, 1);
    assert.equal(flat(title.props.style).minWidth, 0);
    assert.equal(flat(count.parent.props.style).maxWidth, "100%");
    for (const node of [title, count]) {
      assert.notEqual(node.props.allowFontScaling, false);
      for (const key of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(node.props[key], undefined);
    }
    assert.deepEqual(view.calls.skips, []);
    assert.deepEqual(view.calls.durations, []);
    await unmount(view);
  });
}


const overviewIds = (view) => view.tree.root.findAllByType("AnimatedView").filter((node) => node.props.testID?.startsWith("workout-overview-card-")).map((node) => node.props.testID.replace("workout-overview-card-", ""));
const gestureFor = (view, id) => host(view, `workout-overview-handle-${id}`).parent.parent.props.gesture;

test("overview accessible moves cross role headings, persist across navigation, and only Start creates the ordered draft", async () => {
  const view = await detail(); resetCalls(view);
  await tap(host(view, "workout-overview-up-row"));
  assert.deepEqual(overviewIds(view), ["row", "bench"]);
  assert.deepEqual(plain(view.week().weekPlan), plan());
  assert.equal(await view.store.loadActiveWorkout("user-A"), null);
  assert.deepEqual(view.calls.active, []); assert.deepEqual(view.calls.routes, []);
  const headings = host(view, "workout-detail-list").findAllByType("Text").map(textOf).filter((text) => text === "Accessories" || text === "Main Lifts");
  assert.deepEqual(headings, ["Accessories", "Main Lifts"]);
  await view.remount(); assert.deepEqual(overviewIds(view), ["row", "bench"]);
  await tap(start(view));
  const draft = await view.store.loadActiveWorkout("user-A");
  assert.deepEqual(Array.from(draft.operations.map((operation) => operation.type)), ["create", "order"]);
  assert.equal(draft.currentExerciseId, "row"); assert.equal(draft.operations[1].payload.expectedRevision, 0);
  assert.equal(draft.operations[1].payload.applyRevisedTargets, false);
  assert.deepEqual(plain(draft.workoutSnapshot), day()); assert.deepEqual(view.calls.routes, [["push", activeRoute]]);
  await unmount(view);
});

test("overview drag uses measured variable-height cards and leaves favorite and detail controls independent", async () => {
  const view = await detail(); resetCalls(view);
  await act(async () => {
    host(view, "workout-overview-card-bench").props.onLayout({ nativeEvent: { layout: { y: 100, height: 160 } } });
    host(view, "workout-overview-card-row").props.onLayout({ nativeEvent: { layout: { y: 340, height: 370 } } });
    host(view, "workout-detail-list").props.onLayout({ nativeEvent: { layout: { height: 500 } } });
    host(view, "workout-detail-list").props.onContentSizeChange(375, 900);
  });
  const gesture = gestureFor(view, "row");
  await act(async () => { gesture.callbacks.start({ absoluteY: 470 }); gesture.callbacks.update({ absoluteY: 220, translationY: -250 }); });
  assert.equal(host(view, "workout-detail-list").props.scrollEnabled, false);
  await act(async () => gesture.callbacks.end({ absoluteY: 220 }));
  assert.deepEqual(overviewIds(view), ["row", "bench"]);
  assert.equal(host(view, "workout-detail-list").props.scrollEnabled, true);
  assert.equal(await view.store.loadActiveWorkout("user-A"), null);
  await tap(view.tree.root.findAllByType("Pressable").find((node) => node.props.testID === "exercise-row" && node.props.accessibilityLabel?.includes("Cable row")) ?? view.tree.root.findAllByType("Pressable").filter((node) => node.props.testID === "exercise-row")[0]);
  assert.ok(view.calls.routes.some((route) => route[1]?.pathname === "/exercises/[id]"));
  await unmount(view);
});

test("overview edge auto-scroll can carry a lower card to the top without starting a session", async () => {
  const view = await detail(); resetCalls(view);
  const list = host(view, "workout-detail-list");
  await act(async () => {
    host(view, "workout-overview-card-bench").props.onLayout({ nativeEvent: { layout: { y: 100, height: 180 } } });
    host(view, "workout-overview-card-row").props.onLayout({ nativeEvent: { layout: { y: 800, height: 300 } } });
    list.props.onLayout({ nativeEvent: { layout: { height: 500 } } }); list.props.onContentSizeChange(375, 1500); list.props.onScroll({ nativeEvent: { contentOffset: { y: 600 } } });
  });
  const gesture = gestureFor(view, "row");
  await act(async () => { gesture.callbacks.start({ absoluteY: 450 }); gesture.callbacks.update({ absoluteY: 105, translationY: -345 }); });
  for (let i = 0; i < 30; i++) await view.tickAutoScroll();
  assert.ok(view.calls.scrolls.length > 0); assert.equal(view.calls.scrolls.at(-1).y, 0);
  await act(async () => gesture.callbacks.end({ absoluteY: 105 }));
  assert.deepEqual(overviewIds(view), ["row", "bench"]); assert.equal(await view.store.loadActiveWorkout("user-A"), null);
  await unmount(view);
});

test("overview keeps order through harmless metadata refresh and explicitly resets changed prescriptions", async () => {
  const view = await detail(); await tap(host(view, "workout-overview-up-row"));
  const metadata = day(); metadata.blocks[0].items[0].exercise.imageUrl = "https://example.invalid/new.png";
  await view.install(plan([metadata])); assert.deepEqual(overviewIds(view), ["row", "bench"]);
  const changed = day(); changed.blocks[0].items[0].prescription.sets = 5;
  await view.install(plan([changed])); assert.deepEqual(overviewIds(view), ["bench", "row"]);
  assert.match(textOf(host(view, "workout-overview-order-message")), /Exercise order reset/);
  await unmount(view);
});

test("overview duplicate Start is synchronous and late lookup after Back cannot create a ghost workout", async () => {
  const view = await detail(); const pending = deferred(); view.options({ activeRequest: () => pending.promise }); resetCalls(view);
  const startAction = start(view).props.onPress;
  await act(async () => { startAction(); startAction(); });
  assert.equal(view.calls.active.length, 1);
  await tap(label(view, "Back from workout details")); await unmount(view);
  await act(async () => pending.resolve(null));
  assert.equal(await view.store.loadActiveWorkout("user-A"), null);
  assert.deepEqual(view.calls.routes, [["back"]]);
});

test("overview late Start lookup cannot claim the previous account after switching users", async () => {
  const view = await detail(); const pending = deferred(); view.options({ activeRequest: () => pending.promise }); resetCalls(view);
  await tap(start(view)); await view.auth("token-B", "user-B");
  await act(async () => pending.resolve(null));
  assert.equal(await view.store.loadActiveWorkout("user-A"), null); assert.equal(await view.store.loadActiveWorkout("user-B"), null);
  assert.deepEqual(view.calls.routes, []); await unmount(view);
});

test("overview applies selected order to matching active exercises and explicitly reviews replaced membership", async () => {
  const apiDay = { ...day(), exerciseBlocks: day().blocks };
  const active = session({ id: "active-one", workoutDayId: "day-one", workoutDate: weekStart, arrangementRevision: 2, clientSessionId: "active-client", effectiveWorkout: apiDay, workoutSnapshot: apiDay, setLogs: [{ id: "log", exerciseId: "bench", setNumber: 1, reps: 8, weightKg: 20, version: 1 }], deletedSetLogs: [], exerciseFeedback: [] });
  const view = await detail({ active }); await tap(host(view, "workout-overview-up-row")); resetCalls(view); await tap(start(view));
  const durable = await view.store.loadActiveWorkout("user-A");
  assert.equal(durable.serverSessionId, "active-one"); assert.equal(durable.operations.some((operation) => operation.type === "create"), false);
  assert.deepEqual(Array.from(durable.operations.find((operation) => operation.type === "order").payload.exerciseIds), ["row", "bench"]);
  assert.equal(durable.sets.find((set) => set.exerciseId === "bench" && set.setNumber === 1).logId, "log");
  assert.deepEqual(view.calls.routes, [["push", { pathname: "/workout/active", params: { sessionId: "active-one" } }]]); await unmount(view);
  const changed = { ...apiDay, exerciseBlocks: [{ blockType: "main", items: [{ ...day().blocks[0].items[0], exercise: { id: "fly", name: "Fly" } }] }, day().blocks[1]] };
  const conflict = await detail({ active: { ...active, effectiveWorkout: changed } }); await tap(host(conflict, "workout-overview-up-row")); resetCalls(conflict); await tap(start(conflict));
  assert.equal(conflict.calls.alerts[0][0], "Workout already changed"); assert.deepEqual(conflict.calls.routes, []);
  await conflict.confirm("Resume active workout"); assert.deepEqual(conflict.calls.routes, [["push", { pathname: "/workout/active", params: { sessionId: "active-one" } }]]);
  await unmount(conflict);
});

test("overview old Start request stays cancelled after route A to B to A", async () => {
  const view = await detail({ plan: plan([day(), day({ workoutDayId: "day-two", slotIndex: 2, title: "Other workout" })]) });
  const pending = deferred(); view.options({ activeRequest: () => pending.promise }); resetCalls(view);
  await tap(start(view)); await view.changeRoute({ workoutDayId: "day-two" }); await view.changeRoute({ workoutDayId: "day-one" });
  await act(async () => pending.resolve(null));
  assert.equal(await view.store.loadActiveWorkout("user-A"), null); assert.deepEqual(view.calls.routes, []); await unmount(view);
});

test("overview terminal handoff shows finished notice and never offers an active-session Resume", async () => {
  const view = await detail(); resetCalls(view);
  view.prestart.prepareWorkoutStart = async () => { throw new view.prestart.PreWorkoutOrderConflict("Finished during handoff", "completed-session", true); };
  await tap(start(view));
  assert.equal(view.calls.alerts[0][0], "Workout already finished");
  assert.equal(view.calls.alerts[0][2].some((button) => /Resume/.test(button.text)), false);
  assert.deepEqual(view.calls.routes, []); assert.equal(await view.store.loadActiveWorkout("user-A"), null);
  await view.confirm("Back to workouts");
  assert.deepEqual(view.calls.routes, [["replace", "/(tabs)"]]); assert.equal(view.calls.weeks.length, 1);
  assert.equal(await view.store.loadActiveWorkout("user-A"), null); await unmount(view);
});

const addParams = (exerciseId = "curl") => ({ workoutDayId: "day-one", exerciseId, expectedExerciseIds: ["bench", "row"], weekStart, effectiveDate: weekStart, allowOverBudget: false });
const appendedPlan = (previous = day(), id = "curl") => plan([{ ...previous, blocks: [...previous.blocks, { blockType: "main", items: [{ exercise: { id, name: `Added ${id}`, primaryMuscle: "biceps" }, prescription: { sets: 3, reps: "8-12", restSeconds: 90 } }] }] }]);

test("overview Add exercise is a list-footer action that routes only an eligible current workout", async () => {
  const view = await detail(); const button = host(view, "workout-add-exercise"); assert.ok(button); assert.equal(button.props.disabled, false);
  assert.ok(flat(button.props.style({ pressed: false })).minHeight >= 44);
  await tap(button); assert.deepEqual(view.calls.routes, [["push", `/workout/exercise-picker?workoutDayId=day-one&weekStart=${weekStart}`]]); await unmount(view);
  const program = await detail({ plan: plan([day({ programActivationId: "program" })]) }); assert.equal(host(program, "workout-add-exercise"), undefined); await unmount(program);
  const locked = await detail({ plan: plan([day({ planningEditable: false })]) }); assert.equal(host(locked, "workout-add-exercise").props.disabled, true); await unmount(locked);
});

test("adding appends to canonical source but preserves the user's different order before installing and starting", async () => {
  const view = await detail(); await tap(host(view, "workout-overview-up-row"));
  let result; await act(async () => { result = await view.week().addExercise(addParams()); });
  assert.equal(result.orderPreservationFailed, false); assert.deepEqual(view.calls.additions[0][1].expectedExerciseIds, ["bench", "row"]);
  assert.deepEqual(overviewIds(view), ["row", "bench", "curl"]);
  assert.equal(await view.store.loadActiveWorkout("user-A"), null);
  assert.deepEqual(plain((await view.prestart.loadPreWorkoutOrder("user-A", view.week().weekPlan.workouts[0])).exerciseIds), ["row", "bench", "curl"]);
  await tap(start(view)); const active = await view.store.loadActiveWorkout("user-A");
  assert.deepEqual(active.effectiveWorkout.blocks.flatMap((block) => block.items.map((item) => item.exercise.id)), ["row", "bench", "curl"]);
  assert.equal(active.sets.filter((set) => set.exerciseId === "curl").length, 3); await unmount(view);
});

test("an add that committed before losing its reply preserves the chosen order after refresh and a cold cache load", async () => {
  for (const original of [day(), day({ planningMode: "trainer_led", timeBudgetMinutes: null, planningSource: "default", durationMinutes: 50 })]) {
    let committed; const view = await detail({ plan: plan([original]), add: async () => { committed = appendedPlan(original); committed.workouts[0].durationMinutes = original.planningMode === "trainer_led" ? 60 : original.durationMinutes; throw new Error("Response lost after commit"); } });
    await tap(host(view, "workout-overview-up-row"));
    const originalRaw = [...view.storage.entries()].find(([key]) => key.startsWith("primerep.pre-workout-order."))[1];
    await act(async () => { await view.week().addExercise(addParams()).catch(() => {}); });
    assert.equal(view.week().planningRefreshRequired, true);
    view.options({ getWeek: async () => committed }); await tap(host(view, "workout-planning-refresh"));
    assert.deepEqual(overviewIds(view), ["row", "bench", "curl"]);
    const cold = view.coldPrestart(); assert.deepEqual(plain((await cold.loadPreWorkoutOrder("user-A", committed.workouts[0])).exerciseIds), ["row", "bench", "curl"]);
    assert.equal([...view.storage.entries()].find(([key]) => key.startsWith("primerep.pre-workout-order."))[1], originalRaw);
    const changed = plain(committed.workouts[0]); changed.blocks[0].items[0].prescription.sets = 9;
    assert.equal((await cold.loadPreWorkoutOrder("user-A", changed)).invalidated, true);
    await unmount(view);
  }
});

test("lost-reply append recovery supports normalized legacy metadata and more than one appended default row", async () => {
  const view = await detail(); await tap(host(view, "workout-overview-up-row"));
  const next = appendedPlan(day(), "curl").workouts[0];
  const more = appendedPlan(next, "fly").workouts[0]; Object.assign(more, { planningMode: "time_budget", planningSource: "default", timeBudgetMinutes: 35 });
  const recovered = await view.coldPrestart().loadPreWorkoutOrder("user-A", more);
  assert.deepEqual(plain(recovered.exerciseIds), ["row", "bench", "curl", "fly"]);
  for (const extra of [{ planningMode: "trainer_led", timeBudgetMinutes: null }, { timeBudgetMinutes: 60, durationMinutes: 60 }, { planningSource: "override" }]) assert.equal((await view.coldPrestart().loadPreWorkoutOrder("user-A", { ...more, ...extra })).invalidated, true);
  await unmount(view);
});

test("a stale add source marks refresh required while a budget rejection safely retains the existing workout", async () => {
  for (const code of ["workout_changed", "workout_time_budget_exceeded"]) {
    const failure = Object.assign(new Error(code), { status: 409, payload: { detail: { code, message: code } } });
    const view = await detail({ add: async () => { throw failure; } });
    await act(async () => { await view.week().addExercise(addParams()).catch(() => {}); });
    assert.equal(view.week().planningRefreshRequired, code === "workout_changed");
    assert.deepEqual(overviewIds(view), ["bench", "row"]); assert.equal(await view.store.loadActiveWorkout("user-A"), null); await unmount(view);
  }
});

test("storage failure after a committed add installs the authoritative result and returns a truthful warning", async () => {
  const view = await detail(); await tap(host(view, "workout-overview-up-row")); view.options({ orderSaveFailure: true });
  let result; await act(async () => { result = await view.week().addExercise(addParams()); });
  assert.equal(result.orderPreservationFailed, true); assert.equal(view.week().weekPlan.workouts[0].blocks.at(-1).items[0].exercise.id, "curl");
  assert.equal(view.week().planningRefreshRequired, false); assert.deepEqual(overviewIds(view), ["row", "bench", "curl"]); await unmount(view);
});

test("an add continues in the provider after Back and its pending barrier prevents a premature Start", async () => {
  const pending = deferred(), view = await detail({ add: () => pending.promise }); let completion;
  await tap(host(view, "workout-overview-up-row"));
  await act(async () => { completion = view.week().addExercise(addParams()); }); await view.hide();
  assert.equal(view.week().planningRefreshRequired, true);
  await act(async () => { pending.resolve(appendedPlan()); await completion; });
  await view.remount(); assert.deepEqual(overviewIds(view), ["row", "bench", "curl"]); assert.equal(start(view).props.disabled, false); await unmount(view);
});

test("natural duplicate retries never duplicate the appended exercise or its saved order", async () => {
  let saved; const view = await detail({ add: async () => saved ??= appendedPlan() }); await tap(host(view, "workout-overview-up-row"));
  await act(async () => { await view.week().addExercise(addParams()); await view.week().addExercise(addParams()); });
  assert.deepEqual(overviewIds(view), ["row", "bench", "curl"]); assert.equal(overviewIds(view).filter((id) => id === "curl").length, 1); await unmount(view);
});

const contrastRatio = (first, second) => {
  const light = (color) => { const hex = color.length === 4 ? `#${[...color.slice(1)].map((part) => part + part).join("")}` : color; return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255).map((part) => part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4).reduce((sum, part, index) => sum + part * [0.2126, 0.7152, 0.0722][index], 0); };
  const [high, low] = [light(first), light(second)].sort((a, b) => b - a); return (high + 0.05) / (low + 0.05);
};
for (const scheme of ["light", "dark"]) {
  test(`${scheme}: exercise-first toolbar removes permanent prose, leads with counts and keeps readable action text`, async () => {
    const view = await detail({ scheme, plan: plan([day({ workoutIntent: "Detailed coach focus", unavailableMuscles: ["calves"], deferredMuscles: ["forearms"] })]) });
    for (const hidden of ["Choose your exercise order", "Detailed coach focus", "Workout details", "We couldn't add calves with your current equipment."]) assert.equal(text(view, hidden), undefined);
    assert.equal(host(view, "workout-estimate-toggle"), undefined); assert.equal(host(view, "skip-day-button"), undefined);
    const toolbar = host(view, "workout-overview-toolbar");
    assert.ok(toolbar.findByProps({ testID: "workout-add-exercise" })); assert.ok(toolbar.findByProps({ testID: "workout-planning-open" })); assert.ok(toolbar.findByProps({ testID: "workout-info-open" }));
    assert.ok(text(view, "Monday, Oct 12 • 2 exercises"));
    const addText = host(view, "workout-add-exercise").findAllByType("Text").find((node) => textOf(node) === "Add");
    assert.ok(contrastRatio(flat(addText.props.style).color, view.colors.background) >= 4.5);
    await tap(host(view, "workout-info-open"));
    for (const expected of ["Detailed coach focus", "We couldn't add calves with your current equipment.", "forearms will be prioritized in your next custom workout.", "Includes preparation and rest. Your pace may vary."]) assert.ok(text(view, expected));
    assert.deepEqual(view.calls.planning, []); assert.deepEqual(view.calls.additions, []); assert.deepEqual(view.calls.skips, []);
    await tap(host(view, "workout-info-close")); assert.equal(text(view, "Detailed coach focus"), undefined);
    assert.ok(view.calls.focus.some((entry) => Array.isArray(entry) && entry[0] === "restore")); await unmount(view);
  });
}

test("read-only Info omits absent sections and puts its maximum-text heading inside the scroll body", async () => {
  const view = await detail({ fontScale: 3.2, width: 390, plan: plan([day({ workoutIntent: "", deferredMuscles: [], unavailableMuscles: [] })]) });
  const before = plain([...view.storage]); await tap(host(view, "workout-info-open"));
  const modal = view.tree.root.findAllByType("Modal").find((node) => node.props.visible);
  const title = text(view, "Workout information"), scroll = host(view, "workout-info-scroll");
  let titleParent = title.parent; while (titleParent && typeof titleParent.type !== "string") titleParent = titleParent.parent; assert.equal(titleParent, scroll); assert.equal(title.props.numberOfLines, undefined); assert.notEqual(title.props.allowFontScaling, false);
  for (const absent of ["Today's focus", "Equipment update", "Muscle rotation"]) assert.equal(text(view, absent), undefined);
  assert.equal(modal.props.animationType, "none");
  const close = host(view, "workout-info-close"); assert.equal(flat(close.props.style).minHeight, 44);
  await tap(close); assert.deepEqual(plain([...view.storage]), before); await unmount(view);
});

test("only one overlay owns presentation and iOS waits for native dismissal before reopening or showing mode confirmation", async () => {
  const view = await detail(); await tap(host(view, "workout-info-open"));
  await act(async () => host(view, "workout-planning-open").props.onPress());
  assert.equal(view.tree.root.findAllByType("Modal").filter((node) => node.props.visible).length, 1);
  await act(async () => host(view, "workout-info-close").props.onPress());
  await act(async () => host(view, "workout-planning-open").props.onPress());
  assert.equal(view.tree.root.findAllByType("Modal").filter((node) => node.props.visible).length, 0);
  await act(async () => view.tree.root.findByType("Modal").props.onDismiss());
  await tap(host(view, "workout-planning-open")); await tap(duration(view, 60));
  await act(async () => host(view, "planning-apply").props.onPress());
  assert.deepEqual(view.calls.alerts, []);
  await act(async () => view.tree.root.findByType("Modal").props.onDismiss());
  assert.equal(view.calls.alerts.at(-1)[0], "Rebuild this workout?"); await view.confirm("Cancel");
  assert.deepEqual(view.calls.planning, []); await unmount(view);
});

for (const platform of ["android", "web"]) {
  test(`${platform}: a closed Info sheet can reopen without an iOS-only callback dependency`, async () => {
    const view = await detail({ platform }); await tap(host(view, "workout-info-open"));
    await act(async () => host(view, "workout-info-close").props.onPress());
    if (platform === "web") { const closing = view.tree.root.findByType("Modal"); assert.equal(closing.props.visible, false); await act(async () => closing.props.onDismiss()); }
    else assert.equal(view.tree.root.findAllByType("Modal").length, 0);
    await tap(host(view, "workout-planning-open")); assert.equal(view.tree.root.findAllByType("Modal").filter((node) => node.props.visible).length, 1);
    await tap(label(view, "Close workout planning")); await tap(host(view, "workout-info-open"));
    assert.ok(text(view, "Workout information")); await unmount(view);
  });
}

test("blurring before native planning dismissal cancels only the queued confirmation and releases Start", async () => {
  const view = await detail(); await tap(host(view, "workout-planning-open")); await tap(duration(view, 60));
  await act(async () => host(view, "planning-apply").props.onPress());
  assert.equal(start(view).props.disabled, true);
  await view.refocus();
  await act(async () => view.tree.root.findByType("Modal").props.onDismiss());
  assert.deepEqual(view.calls.alerts, []); assert.deepEqual(view.calls.planning, []);
  assert.equal(start(view).props.disabled, false);
  await tap(host(view, "workout-overview-up-row")); assert.equal(view.noticeCallbacks().length, 1);
  await view.refocus(); assert.equal(view.noticeCallbacks().length, 0);
  assert.equal(host(view, "workout-overview-order-message"), undefined); await unmount(view);
});

test("native sheet hosts stay mounted and private content disappears across account loading before dismissal completes", async () => {
  const view = await detail({ plan: plan([day({ workoutIntent: "Private A coach content" })]) });
  await tap(host(view, "workout-info-open")); const originalHost = view.tree.root.findByType("Modal");
  await view.auth(null, null);
  const closingHost = view.tree.root.findByType("Modal"); assert.equal(closingHost, originalHost); assert.equal(closingHost.props.visible, false);
  assert.equal(text(view, "Private A coach content"), undefined);
  await act(async () => closingHost.props.onDismiss());
  view.options({ getWeek: async () => plan([day({ workoutIntent: "Private B coach content" })]) });
  await view.auth("token-B", "user-B"); await tap(host(view, "workout-info-open"));
  assert.ok(text(view, "Private B coach content")); assert.equal(text(view, "Private A coach content"), undefined); await unmount(view);
});

test("Skip is a lightweight menu action and remains available for programs with unchanged cancellation and payload", async () => {
  const view = await detail({ plan: plan([day({ programActivationId: "program-one" })]) });
  await tap(host(view, "workout-options-open")); assert.ok(host(view, "workout-options-menu"));
  assert.equal(host(view, "skip-day-button").props.disabled, false); assert.equal(view.tree.root.findAllByType("Modal").length, 0);
  await tap(host(view, "skip-day-button")); assert.equal(host(view, "workout-options-menu"), undefined);
  assert.equal(view.calls.alerts.at(-1)[0], "Skip Workout"); await view.confirm("Cancel"); assert.deepEqual(view.calls.skips, []);
  await tapSkip(view); await view.confirm("Skip", "Skip Workout"); assert.deepEqual(view.calls.skips, [["token-A", "day-one", weekStart]]); await unmount(view);
});

test("pending overlay actions are cancelled on account ABA and old Skip confirmations cannot mutate the new lifetime", async () => {
  const view = await detail(); await tap(host(view, "workout-planning-open")); await tap(duration(view, 60));
  await act(async () => { host(view, "planning-apply").props.onPress(); view.authNow("token-B", "user-B"); });
  const closing = view.tree.root.findAllByType("Modal").find((node) => !node.props.visible); if (closing) await act(async () => closing.props.onDismiss());
  assert.deepEqual(view.calls.alerts, []); await view.auth("token-A", "user-A");
  await tapSkip(view); const staleSkip = view.calls.alerts.at(-1)[2].find((entry) => entry.text === "Skip").onPress;
  await view.auth("token-B", "user-B"); await view.auth("token-A", "user-A");
  await act(async () => staleSkip()); assert.deepEqual(view.calls.skips, []); await unmount(view);
});

test("dismissing a reset notice changes presentation only and success acknowledgement never changes list layout", async () => {
  const view = await detail(); await tap(host(view, "workout-overview-up-row"));
  const acknowledgement = host(view, "workout-overview-order-message"); assert.equal(acknowledgement.parent, host(view, "workout-start-footer"));
  assert.equal(acknowledgement.props.pointerEvents, "none"); assert.equal(flat(acknowledgement.props.style).position, "absolute");
  const staleTimer = view.noticeCallbacks()[0]; const changed = day(); changed.blocks[0].items[0].prescription.sets = 9;
  await view.install(plan([changed])); assert.match(textOf(host(view, "workout-overview-order-message")), /Exercise order reset/);
  await act(async () => staleTimer()); assert.ok(host(view, "workout-overview-order-message"));
  const before = plain([...view.storage]); await tap(host(view, "workout-order-dismiss"));
  assert.equal(host(view, "workout-overview-order-message"), undefined); assert.deepEqual(plain([...view.storage]), before);
  assert.deepEqual(overviewIds(view), ["bench", "row"]); await unmount(view);
});

test("order errors persist with actionable read-only details while the refresh barrier and over-budget warning stay visible", async () => {
  const view = await detail({ orderSaveFailure: true, plan: plan([day({ planningMode: "time_budget", timeBudgetMinutes: 35, estimatedMinutes: 65 })]) });
  assert.ok(host(view, "workout-over-budget-notice")); await tap(host(view, "workout-overview-up-row")); await view.tickNotices();
  assert.match(textOf(host(view, "workout-overview-order-message")), /Check exercise order/);
  await tap(host(view, "workout-order-details")); assert.match(textOf(view.tree.root), /Couldn’t save that order/);
  await tap(host(view, "workout-info-close")); assert.ok(host(view, "workout-overview-order-message"));
  await act(async () => view.week().markPlanningRefreshRequired());
  assert.ok(host(view, "workout-planning-refresh")); assert.equal(start(view).props.disabled, true); assert.ok(host(view, "workout-info-open"));
  assert.deepEqual(view.calls.planning, []); assert.deepEqual(view.calls.additions, []); await unmount(view);
});
