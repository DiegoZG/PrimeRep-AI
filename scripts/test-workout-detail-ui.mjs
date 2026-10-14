import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import ts from "typescript";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (file) => readFileSync(path.join(root, file), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const routeFile = "app/workouts/[workoutDayId].tsx";
const weekStart = "2026-10-12";
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : ["2026-10-12T12:00:00Z"])); }
  static now() { return new Date("2026-10-12T12:00:00Z").getTime(); }
}
function load(file, mocks) {
  const filename = path.join(root, file);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console: { ...console, warn() {} }, Date: Clock }, { filename });
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
const native = { Pressable: "Pressable", View: "View", Text: "Text", ActivityIndicator: "ActivityIndicator", SectionList, StyleSheet: { create: (styles) => styles, absoluteFillObject: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } }, Platform: { OS: "ios", select: (values) => values.ios } };
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
const tap = async (node) => { assert.ok(node); assert.notEqual(node.props.disabled, true); await act(async () => { node.props.onPress(); }); };
const day = (extra = {}) => ({ workoutDayId: "day-one", slotIndex: 1, date: weekStart, durationMinutes: 35, title: "Upper body strength", dayType: "upper_body", splitKey: "upper-lower", blocks: [
  { blockType: "main", items: [{ exercise: { id: "bench", name: "Barbell bench press", primaryMuscle: "chest", imageUrl: "https://images.example.invalid/bench.png" }, prescription: { sets: 3, reps: "8-12", restSeconds: 90 }, exerciseRationale: "A fictional pressing explanation." }] },
  { blockType: "accessory", items: [{ exercise: { id: "row", name: "Cable row", primaryMuscle: "back" }, prescription: { sets: 2, reps: "10", restSeconds: 60 } }] },
], ...extra });
const plan = (days = [day()], start = weekStart) => ({ weekStart: start, weekEnd: start === weekStart ? "2026-10-18" : "2026-10-11", workouts: days });
const session = (extra = {}) => ({ id: "other-session", workoutDayId: "other-day", dayType: "lower_body", startedAt: "2026-10-12T10:00:00Z", clientSessionId: null, status: "in_progress", setLogs: [{ exerciseId: "squat", setNumber: 1 }], workoutSnapshot: { title: "Existing lower workout", exerciseBlocks: [] }, ...extra });

async function detail(options = {}) {
  const calls = { weeks: [], skips: [], durations: [], active: [], abandons: [], cleared: [], favorites: [], favorite: [], unfavorite: [], routes: [], alerts: [], loggedOut: [], stored: [], focus: [] };
  const scheme = options.scheme ?? "light";
  const AuthContext = React.createContext(null);
  const storage = new Map([["@primerep/theme-preference", scheme]]);
  const route = { workoutDayId: options.id ?? "day-one", ...(options.routeWeek ? { weekStart: options.routeWeek } : {}) };
  let current = options;
  const appState = new Set();
  const logging = {
    getActiveSession: async (token) => { calls.active.push(token); if (current.activeError) throw error(503); return current.active ?? null; },
    abandonSession: async (token, id) => { calls.abandons.push([token, id]); if (current.abandonError) throw error(503); return { ...current.active, status: "abandoned" }; },
    getSession: async () => null,
  };
  const store = { loadActiveWorkout: async () => null, clearActiveWorkout: async (id) => { calls.cleared.push(id); } };
  const mocks = {
    react: React, "react-native": { ...native, useColorScheme: () => scheme, useWindowDimensions: () => ({ width: current.width ?? 430, height: current.height ?? 932, scale: 3, fontScale: current.fontScale ?? 1 }), Alert: { alert: (...args) => calls.alerts.push(args) }, AppState: { addEventListener: (_name, callback) => { appState.add(callback); return { remove: () => appState.delete(callback) }; } } },
    "@expo/vector-icons": { Ionicons: "Ionicons" }, "expo-image": { Image: "Image" }, "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "expo-router": { useLocalSearchParams: () => route, useRouter: () => ({ push: (value) => calls.routes.push(["push", plain(value)]), replace: (value) => calls.routes.push(["replace", plain(value)]), back: () => calls.routes.push(["back"]) }) },
    "@react-navigation/native": { useFocusEffect: (callback) => React.useEffect(() => { calls.focus.push("focus"); return callback(); }, [callback]) },
    "@react-native-async-storage/async-storage": { getItem: async (key) => storage.get(key) ?? null, setItem: async (key, value) => { calls.stored.push([key, value]); storage.set(key, value); } },
    "@/utils/authContext": { AuthContext }, "./authContext": { AuthContext }, "@/utils/localDate": dateHelpers, "./localDate": dateHelpers,
    "@/constants/theme": theme, "@/services/workoutLoggingService": logging, "@/utils/activeWorkoutStore": store,
    "@/services/exerciseService": {
      getFavoriteExercises: async (token) => { calls.favorites.push(token); if (current.favoriteLoadError) throw error(503); return current.favoriteIds ?? []; },
      favoriteExercise: async (...args) => { calls.favorite.push(args); if (current.favoriteMutation) await current.favoriteMutation(); if (current.favoriteError) throw error(503); },
      unfavoriteExercise: async (...args) => { calls.unfavorite.push(args); if (current.favoriteMutation) await current.favoriteMutation(); if (current.favoriteError) throw error(503); },
    },
    "@/services/workoutWeekService": {
      getWorkoutWeek: async (...args) => { calls.weeks.push(args); return current.getWeek ? current.getWeek(...args) : current.plan ?? plan(); },
      skipWorkoutDay: async (...args) => { calls.skips.push(args); return current.skip ? current.skip(...args) : current.skipPlan ?? plan(); },
      updateWorkoutDuration: async (...args) => { calls.durations.push(args); return current.duration ? current.duration(...args) : current.durationPlan ?? plan([day({ durationMinutes: args[2] })]); },
    },
  };
  for (const [alias, file] of [
    ["@/utils/appearanceContext", "utils/appearanceContext.tsx"], ["@/hooks/use-color-scheme", "hooks/use-color-scheme.ts"], ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"],
    ["@/components/themed-text", "components/themed-text.tsx"], ["@/components/workout/WorkoutText", "components/workout/WorkoutText.tsx"],
    ["@/components/exercises/ContentSection", "components/exercises/ContentSection.tsx"], ["@/components/workout/CoachCard", "components/workout/CoachCard.tsx"],
    ["@/utils/workoutWeekContext", "utils/workoutWeekContext.tsx"], ["@/hooks/use-workout-week", "hooks/use-workout-week.ts"], ["@/utils/activeWorkoutContext", "utils/activeWorkoutContext.tsx"],
  ]) mocks[alias] = load(file, mocks);
  mocks["@/components/explore"] = load("components/explore/ExerciseRow.tsx", mocks);
  const { AppearanceProvider, useAppearance } = mocks["@/utils/appearanceContext"];
  const { WorkoutWeekProvider, WorkoutWeekContext } = mocks["@/utils/workoutWeekContext"];
  const { ActiveWorkoutProvider, useActiveWorkout } = mocks["@/utils/activeWorkoutContext"];
  const { default: Screen } = load(routeFile, mocks);
  let week, active, appearance, setAuth, remount, repaint;
  function Bridge() {
    week = React.useContext(WorkoutWeekContext); active = useActiveWorkout(); appearance = useAppearance();
    const [generation, setGeneration] = React.useState(0);
    const [, setPaint] = React.useState(0);
    remount = () => setGeneration((value) => value + 1);
    repaint = () => setPaint((value) => value + 1);
    return appearance.isReady ? React.createElement(Screen, { key: generation }) : null;
  }
  function App() {
    const [identity, setIdentity] = React.useState(options.token === null ? { token: null, user: null, isLoggedIn: false } : { token: "token-A", user: { id: "user-A" }, isLoggedIn: true });
    setAuth = (token, id) => setIdentity({ token, user: token ? { id } : null, isLoggedIn: Boolean(token) });
    const auth = React.useMemo(() => ({ ...identity, logOut: async () => { calls.loggedOut.push(identity.user?.id); setIdentity({ token: null, user: null, isLoggedIn: false }); } }), [identity]);
    return React.createElement(AuthContext.Provider, { value: auth }, React.createElement(AppearanceProvider, null, React.createElement(WorkoutWeekProvider, null, React.createElement(ActiveWorkoutProvider, null, React.createElement(Bridge)))));
  }
  let tree;
  await act(async () => { tree = create(React.createElement(App)); });
  return { tree, calls, colors: theme.Colors[scheme], route, storage, week: () => week, active: () => active, appearance: () => appearance,
    options: (next) => { current = { ...current, ...next }; }, install: async (next) => { await act(async () => week.installWeekPlan(next)); },
    auth: async (token, id) => { await act(async () => setAuth(token, id)); }, remount: async () => { await act(async () => remount()); },
    changeRoute: async (next) => { Object.assign(route, next); await act(async () => repaint()); },
    confirm: async (name, title) => { const dialog = calls.alerts.findLast((entry) => !title || entry[0] === title); const button = dialog?.[2]?.find((entry) => entry.text === name); assert.ok(button, `Missing ${name} action`); await act(async () => { await button.onPress?.(); }); },
  };
}
const start = (view) => host(view, "start-workout-button");
const skip = (view) => host(view, "skip-day-button");
const duration = (view, value) => view.tree.root.findAllByType("Pressable").find((node) => textOf(node) === String(value));
const resetCalls = (view) => { for (const value of Object.values(view.calls)) value.length = 0; };
const activeRoute = { pathname: "/workout/active", params: { workoutDayId: "day-one", weekStart } };

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: actual loaded plan renders real shared rows, prescriptions and unchanged theme`, async () => {
    const view = await detail({ scheme });
    assert.ok(text(view, "Upper body strength")); assert.ok(text(view, "Main Lifts")); assert.ok(text(view, "Accessories"));
    assert.ok(text(view, "Barbell bench press")); assert.ok(text(view, "Cable row")); assert.ok(text(view, "8-12")); assert.ok(text(view, "90s"));
    assert.equal(view.tree.root.findAllByType("Pressable").filter((node) => node.props.testID === "exercise-row").length, 2);
    assert.equal(flat(view.tree.root.findByType("SafeAreaView").props.style).backgroundColor, view.colors.background);
    assert.equal(flat(start(view).props.style).backgroundColor, view.colors.primaryButton);
    for (const value of [25, 35, 45, 60]) assert.equal(flat(duration(view, value).props.style).backgroundColor, value === 35 ? view.colors.primaryButton : view.colors.inputBackground);
    assert.deepEqual(view.calls.skips, []); assert.deepEqual(view.calls.durations, []); assert.deepEqual(view.calls.routes, []);
    await unmount(view);
  });
  test(`${scheme}: no active session opens exact current workout and week route without mutation`, async () => {
    const view = await detail({ scheme }); resetCalls(view); await tap(start(view));
    assert.deepEqual(view.calls.active, ["token-A"]); assert.deepEqual(view.calls.routes, [["push", activeRoute]]); assert.deepEqual(view.calls.abandons, []); assert.deepEqual(view.calls.cleared, []); await unmount(view);
  });
  test(`${scheme}: matching active day opens workout route without abandon or different-session dialog`, async () => {
    const view = await detail({ scheme, active: session({ workoutDayId: "day-one" }) }); resetCalls(view); await tap(start(view));
    assert.deepEqual(view.calls.routes, [["push", activeRoute]]); assert.deepEqual(view.calls.alerts, []); assert.deepEqual(view.calls.abandons, []); await unmount(view);
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
    const view = await detail({ scheme, activeError: true }); resetCalls(view); await tap(start(view)); assert.equal(view.calls.alerts[0][0], "Couldn't check active workout"); assert.deepEqual(view.calls.routes, []); assert.deepEqual(view.calls.abandons, []); await unmount(view);
  });
  test(`${scheme}: Skip confirmation can cancel without calling mutation`, async () => {
    const view = await detail({ scheme }); resetCalls(view); await tap(skip(view)); assert.equal(view.calls.alerts[0][0], "Skip Workout"); assert.match(view.calls.alerts[0][1], /Upper body strength/); await view.confirm("Cancel"); assert.deepEqual(view.calls.skips, []); assert.deepEqual(view.calls.routes, []); await unmount(view);
  });
  test(`${scheme}: confirmed Skip uses same slot from returned plan rather than old context`, async () => {
    const returned = plan([day({ workoutDayId: "new-slot", title: "Replacement", slotIndex: 1 }), day({ workoutDayId: "first", slotIndex: 0 })], "2026-10-19");
    const view = await detail({ scheme, skipPlan: returned }); resetCalls(view); await tap(skip(view)); await view.confirm("Skip", "Skip Workout"); assert.deepEqual(view.calls.skips, [["token-A", "day-one", weekStart]]); assert.deepEqual(view.calls.routes, [["replace", { pathname: "/workouts/[workoutDayId]", params: { workoutDayId: "new-slot", weekStart: "2026-10-19" } }]]); assert.equal(view.calls.skips.length, 1); await unmount(view);
  });
  test(`${scheme}: Skip fallback prefers today, then upcoming, then first slot, then Back for empty`, async () => {
    const variants = [
      [[day({ workoutDayId: "past", slotIndex: 0, date: "2026-10-11" }), day({ workoutDayId: "today", slotIndex: 4 })], "today"],
      [[day({ workoutDayId: "past", slotIndex: 0, date: "2026-10-11" }), day({ workoutDayId: "upcoming", slotIndex: 4, date: "2026-10-14" })], "upcoming"],
      [[day({ workoutDayId: "last", slotIndex: 4, date: "2026-10-10" }), day({ workoutDayId: "first", slotIndex: 0, date: "2026-10-09" })], "first"], [[], null],
    ];
    for (const [days, expected] of variants) { const view = await detail({ scheme, skipPlan: plan(days) }); resetCalls(view); await tap(skip(view)); await view.confirm("Skip", "Skip Workout"); assert.deepEqual(view.calls.routes, expected ? [["replace", { pathname: "/workouts/[workoutDayId]", params: { workoutDayId: expected, weekStart } }]] : [["back"]]); await unmount(view); }
  });
  test(`${scheme}: Skip network failure preserves the plan, stops busy state and does not navigate`, async () => {
    const view = await detail({ scheme, skip: async () => { throw error(503); } }); resetCalls(view); await tap(skip(view)); await view.confirm("Skip", "Skip Workout"); assert.equal(view.week().error, "Boundary request failed"); assert.equal(skip(view).props.disabled, false); assert.deepEqual(view.calls.routes, []); assert.ok(text(view, "Upper body strength")); await unmount(view);
  });
  test(`${scheme}: current duration is a no-op and other options require cancellable confirmation`, async () => {
    const view = await detail({ scheme }); resetCalls(view); await tap(duration(view, 35)); assert.deepEqual(view.calls.alerts, []); await tap(duration(view, 45)); assert.equal(view.calls.alerts[0][0], "Update Duration"); assert.match(view.calls.alerts[0][1], /45 minutes.*regenerate/); await view.confirm("Cancel"); assert.deepEqual(view.calls.durations, []); await unmount(view);
  });
  test(`${scheme}: confirmed duration mutation uses exact week and disables actual controls while pending`, async () => {
    const pending = deferred(); const view = await detail({ scheme, duration: () => pending.promise }); resetCalls(view); await tap(duration(view, 60));
    const button = view.calls.alerts[0][2].find((entry) => entry.text === "Update"); let completion; await act(async () => { completion = button.onPress(); });
    assert.deepEqual(view.calls.durations, [["token-A", "day-one", 60, weekStart]]); assert.equal(skip(view).props.disabled, true); assert.equal(duration(view, 25).props.accessibilityState.busy, true);
    await act(async () => { pending.resolve(plan([day({ durationMinutes: 60 })])); await completion; }); assert.equal(skip(view).props.disabled, false); assert.match(textOf(view.tree.root), /60 min/); assert.deepEqual(view.calls.routes, []); await unmount(view);
  });
  test(`${scheme}: program workout locks duration and retains original prescriptions and Start`, async () => {
    const view = await detail({ scheme, plan: plan([day({ programActivationId: "activation-one" })]) }); assert.ok(host(view, "program-duration-locked")); assert.ok(text(view, "Duration and set targets come from your active program.")); assert.equal(duration(view, 25), undefined); assert.ok(text(view, "8-12")); assert.ok(start(view)); assert.deepEqual(view.calls.durations, []); await unmount(view);
  });
  test(`${scheme}: stale Skip retains provider plus missing-ID refresh and no mutation retry before Home OK`, async () => {
    const view = await detail({ scheme, skip: async () => { throw error(404); } }); resetCalls(view); view.options({ getWeek: async () => plan([day({ workoutDayId: "replacement" })]) }); await tap(skip(view)); await view.confirm("Skip", "Skip Workout"); assert.equal(view.calls.skips.length, 1); assert.deepEqual(view.calls.weeks, [["token-A", weekStart, false], ["token-A", weekStart, false]]); assert.equal(view.calls.alerts.at(-1)[0], "Plan Refreshed"); assert.deepEqual(view.calls.routes, []); await view.confirm("OK", "Plan Refreshed"); assert.deepEqual(view.calls.routes, [["replace", "/(tabs)"]]); assert.equal(view.week().staleIdRefreshed, false); await unmount(view);
  });
  test(`${scheme}: stale duration refresh uses same week and keeps the stale notification contract`, async () => {
    const view = await detail({ scheme, duration: async () => { throw error(404); } }); resetCalls(view); view.options({ getWeek: async () => plan([day({ workoutDayId: "replacement" })]) }); await tap(duration(view, 45)); await view.confirm("Update", "Update Duration"); assert.equal(view.calls.durations.length, 1); assert.deepEqual(view.calls.weeks, [["token-A", weekStart, false], ["token-A", weekStart, false]]); assert.equal(view.calls.alerts.at(-1)[0], "Plan Refreshed"); await view.confirm("OK", "Plan Refreshed"); assert.deepEqual(view.calls.routes, [["replace", "/(tabs)"]]); await unmount(view);
  });
  test(`${scheme}: pending initial week shows actual loading state and named Back`, async () => {
    const pending = deferred(); const view = await detail({ scheme, getWeek: () => pending.promise }); assert.ok(text(view, "Loading workout...")); assert.equal(start(view), undefined); await tap(label(view, "Back from workout")); assert.deepEqual(view.calls.routes, [["back"]]); await act(async () => pending.resolve(plan())); assert.ok(start(view)); await unmount(view);
  });
  test(`${scheme}: missing ID retries refresh once then shows actual unavailable Back actions`, async () => {
    const view = await detail({ scheme, id: "absent", plan: plan() }); assert.ok(text(view, "Workout not found")); assert.ok(text(view, "This workout may have been removed or updated.")); assert.equal(view.calls.weeks.length, 2); assert.equal(start(view), undefined); await tap(label(view, "Back from unavailable workout")); await tap(view.tree.root.findAllByType("Pressable").find((node) => textOf(node) === "Go Back")); assert.deepEqual(view.calls.routes, [["back"], ["back"]]); await unmount(view);
  });
  test(`${scheme}: an empty-block workout retains loaded title, duration and original Start behavior`, async () => {
    const view = await detail({ scheme, plan: plan([day({ blocks: [] })]) }); assert.ok(text(view, "Upper body strength")); assert.equal(view.tree.root.findAllByType("SectionList")[0].props.sections.length, 0); assert.ok(start(view)); resetCalls(view); await tap(start(view)); assert.deepEqual(view.calls.routes, [["push", activeRoute]]); await unmount(view);
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
    const view = await detail({ scheme, plan: plan([day({ workoutIntent: "Fictional focus", unavailableMuscles: ["calves"], deferredMuscles: ["forearms"] })]) }); assert.ok(text(view, "Fictional focus")); assert.ok(text(view, "We couldn't add calves with your current equipment.")); assert.ok(text(view, "forearms will be prioritized in your next custom workout.")); const title = text(view, "Why this exercise"); let toggle = title.parent; while (toggle && toggle.type !== "Pressable") toggle = toggle.parent; await tap(toggle); assert.ok(text(view, "A fictional pressing explanation.")); await tap(toggle); assert.equal(text(view, "A fictional pressing explanation."), undefined); await unmount(view);
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

test("scope: own 9605-byte controller, helper prefix and protected ExerciseRow stay unchanged", () => {
  const input = source(routeFile), controller = input.slice(input.indexOf("export default function WorkoutDayDetailScreen()"), input.indexOf("\n  // Render section header"));
  assert.equal(Buffer.byteLength(controller), 9605);
  assert.equal(sha(controller), "00b0eb5c47ee3bafd142b10dba0dc58d5c36897d675ec2b5eac5df1a27a55da9");
  assert.equal(sha(input.slice(0, input.indexOf("export default function WorkoutDayDetailScreen()")).replace("  useWindowDimensions,\n", "")), "04e4a1ed9bbb492ef04f99e12317325ca37306c1c1a5fc03edfd17d96846082d");
  assert.equal(sha(source("components/explore/ExerciseRow.tsx")), "0bc14d29cd072e478af532de907737ba58beb31df2e8ae46029f87768a10df90");
});
console.log(JSON.stringify({ routeSha256: sha(source(routeFile)), controllerSha256: sha(source(routeFile).slice(source(routeFile).indexOf("export default function WorkoutDayDetailScreen()"), source(routeFile).indexOf("\n  // Render section header"))), exerciseRowSha256: sha(source("components/explore/ExerciseRow.tsx")) }));

test("scope: original 59 baseline tests retain only the approved UI hook mock and prefix normalization", () => {
  const input = source("scripts/test-workout-detail-ui.mjs");
  const prior = input.slice(0, input.indexOf('\n\ntest("scope: original 59')) + "\n";
  const restored = prior
    .replace(" useWindowDimensions: () => ({ width: current.width ?? 430, height: current.height ?? 932, scale: 3, fontScale: current.fontScale ?? 1 }),", "")
    .replace('.replace("  useWindowDimensions,\\n", "")', "");
  assert.equal(sha(restored), "7e923be88d705018b1ee98ae1021c2ca531ada9fa37ea431e16a1f0744088353");
});

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
    assert.equal(button.props.disabled, undefined);
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
  test(`${scheme}: minute buttons announce one selection while existing pending disabled/busy behavior is retained`, async () => {
    const pending = deferred();
    const view = await detail({ scheme, duration: () => pending.promise });
    for (const value of [25, 35, 45, 60]) {
      const button = duration(view, value);
      assert.equal(button.props.accessibilityRole, "button");
      assert.equal(button.props.accessibilityLabel, `${value} minutes`);
      assert.deepEqual(plain(button.props.accessibilityState), { disabled: false, busy: false, selected: value === 35 });
      assert.equal(flat(button.props.style).minHeight, 44);
      assert.equal(flat(button.props.style).minWidth, 44);
    }
    await tap(duration(view, 60));
    const update = view.calls.alerts.at(-1)[2].find((entry) => entry.text === "Update");
    let completion;
    await act(async () => { completion = update.onPress(); });
    for (const value of [25, 35, 45, 60]) {
      assert.equal(duration(view, value).props.disabled, true);
      assert.deepEqual(plain(duration(view, value).props.accessibilityState), { disabled: true, busy: true, selected: value === 35 });
    }
    assert.equal(skip(view).props.disabled, true);
    assert.deepEqual(plain(skip(view).props.accessibilityState), { disabled: true, busy: true });
    assert.equal(start(view).props.disabled, undefined);
    await act(async () => { pending.resolve(plan([day({ durationMinutes: 60 })])); await completion; });
    for (const value of [25, 35, 45, 60]) assert.equal(duration(view, value).props.accessibilityState.selected, value === 60);
    assert.deepEqual(view.calls.durations, [["token-A", "day-one", 60, weekStart]]);
    await unmount(view);
  });
  test(`${scheme}: Skip keeps its existing test ID, named button and neutral minimum target`, async () => {
    const view = await detail({ scheme });
    const button = skip(view);
    assert.equal(button.props.testID, "skip-day-button");
    assert.equal(button.props.accessibilityRole, "button");
    assert.equal(button.props.accessibilityLabel, "Skip Day");
    assert.equal(flat(button.props.style).minHeight, 44);
    assert.equal(flat(button.props.style).backgroundColor, view.colors.inputBackground);
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
    assert.equal(flat(container.props.style).gap, 16);
    assert.equal(container.children.length, 3);
    assert.deepEqual(container.children.map((child) => child.findAllByType("Text").map(textOf)), [["Sets", "3"], ["Reps", "10-15"], ["Rest", "75s"]]);
    for (const field of container.children) {
      const style = flat(field.props.style);
      assert.equal(style.flexGrow, 1);
      assert.equal(style.flexShrink, 0);
      assert.equal(style.flexBasis, "auto");
      assert.equal(style.minWidth, 80);
      assert.equal(style.flex, undefined);
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
      assert.ok(text(view, "Monday, Oct 12 • 35 min"));
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
        assert.equal(back.parent.children.length, 1);
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
