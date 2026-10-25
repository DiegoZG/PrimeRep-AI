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

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flatStyle = (style, pressed = false) => {
  const resolved = typeof style === "function" ? style({ pressed }) : style;
  return Object.assign({}, ...(Array.isArray(resolved) ? resolved.flat(Infinity) : [resolved]).filter(Boolean));
};
function load(relative, mocks) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const require = (name) => name in mocks ? mocks[name] : fallback(name);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require, console, setTimeout }, { filename });
  return module.exports;
}
const theme = load("constants/theme.ts", { "react-native": { Platform: { select: (choices) => choices.ios } } });
const homeStyles = load("styles/home.styles.ts", {
  "react-native": { Dimensions: { get: () => ({ width: 375 }) }, StyleSheet: { create: (styles) => styles } },
  "@/constants/theme": theme,
});
const navigation = load("utils/coachNavigation.ts", {});
const dashboard = load("utils/homeDashboard.ts", { "@/utils/coachNavigation": navigation });
const title = "Upper body strength with deliberately long workout names";
const target = { type: "planned_workout", workoutDayId: "next", weekStart: "2026-10-05" };
const planned = { type: "planned_workout", title, body: "A complete description of the next planned workout.", target };
const caughtUp = { type: "caught_up", title: "All done", body: "", target: { type: "none" } };
const workout = (id, date, name = title) => ({ workoutDayId: id, date, title: name, dayType: "upper_body", durationMinutes: 35, blocks: [{ items: [{ exercise: { name: "Bench Press" } }] }] });
const weeks = ["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"].map((week_start, index) => ({ week_start, completed_workouts: index, is_current: index === 3 }));

async function renderHome(scheme, options = {}) {
  const colors = theme.Colors[scheme];
  const AuthContext = React.createContext({ token: "token-a", user: { id: "a", preferred_name: "Alex" } });
  const EquipmentWeightsContext = React.createContext({ dumbbellWeights: [5, 10], plateWeights: [5, 10] });
  const navigations = [], marks = [], refreshes = [], presentations = [];
  const dimensions = { width: options.width ?? 375, fontScale: options.fontScale ?? 1 };
  let scrollMounts = 0;
  const next = { data: options.next ?? planned, loading: false, error: null, ...options.nextResource };
  const coach = { data: options.coach ?? null, loading: false, error: null, ...options.coachResource };
  const achievements = { data: { total_completed: options.completed ?? 4, weekly_activity: weeks }, loading: false, error: null, ...options.trendResource };
  const workouts = options.workouts ?? [workout("done", "2026-10-09", "Completed session"), workout("next", "2026-10-10")];
  const refresh = (name) => async () => { refreshes.push(name); };
  const refreshStats = refresh("stats");
  const refreshActive = refresh("active");
  const resources = new Map([[next, refresh("next")], [coach, refresh("coach")], [achievements, refresh("trend")]]);
  const week = { weekPlan: { weekStart: "2026-10-05" }, currentWeekStart: "2026-10-05", isLoading: false, error: null, refreshWeek: refresh("week"), getSortedWorkouts: () => workouts, getExerciseCount: () => 1, syncCurrentWeek: async () => {}, ...options.week };
  const router = { push: (href) => navigations.push(href) };
  function FlatList({ data, renderItem, ...props }) {
    return React.createElement("FlatList", props, data.map((item, index) => React.createElement(React.Fragment, { key: item.workoutDayId }, renderItem({ item, index }))));
  }
  function ScrollView({ children, ...props }) {
    React.useEffect(() => { scrollMounts += 1; }, []);
    return React.createElement("ScrollView", props, children);
  }
  const { default: Home } = load("app/(tabs)/index.tsx", {
    react: React,
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "@react-navigation/native": { useFocusEffect: (callback) => React.useEffect(callback, [callback]) },
    "expo-router": { useRouter: () => router },
    "react-native": { ActivityIndicator: "ActivityIndicator", Alert: { alert() {} }, FlatList, Pressable: "Pressable", RefreshControl: "RefreshControl", ScrollView, Share: { share: async () => {} }, Text: "Text", View: "View", useWindowDimensions: () => dimensions },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@/components/animated-card": { AnimatedCard: "AnimatedCard" },
    "@/components/home": { WorkoutCardMenu: "WorkoutCardMenu" },
    "@/components/themed-text": { ThemedText: "ThemedText" },
    "@/constants/theme": theme,
    "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@/hooks/use-stats": { useStats: () => ({ stats: options.stats === undefined ? { streak: 0, totalCompleted: 4, prsThisWeek: 0 } : options.stats, refresh: refreshStats }) },
    "@/hooks/use-account-resource": { useAccountResource: (loader) => { const resource = loader.name === "loadHomeCoachAction" ? next : loader.name === "loadHomeCoachItem" ? coach : achievements; return { ...resource, refresh: resources.get(resource) }; } },
    "@/hooks/use-workout-week": { useWorkoutWeek: () => week },
    "@/services/accountScope": { accountRequestGuard: () => () => true },
    "@/services/coachService": { getCoachFeed: async () => ({}), markCoachItemRead: async (...args) => { marks.push(args); if (options.markFails) throw new Error("offline"); } },
    "@/services/profileService": { getAchievements: async () => ({}) },
    "@/utils/activeWorkoutContext": { useActiveWorkout: () => ({ activeWorkout: options.active ?? null, refreshActiveWorkout: refreshActive }) },
    "@/utils/authContext": { AuthContext },
    "@/utils/coachItemBody": { coachItemPresentation: (...args) => { presentations.push(args); return { body: "Use your equipment-aware target." }; } },
    "@/utils/coachNavigation": navigation,
    "@/utils/equipmentWeightsContext": { EquipmentWeightsContext },
    "@/utils/homeDashboard": dashboard,
    "@/utils/workoutPlanning": load("utils/workoutPlanning.ts", {}),
    "@/utils/localDate": { localDateIso: () => "2026-10-10" },
    "@/utils/weightUnits": { loadWeightUnit: async () => options.weightUnit ?? "LB" },
    "@/styles/home.styles": homeStyles,
  });
  let tree;
  await act(async () => { tree = create(React.createElement(Home)); });
  refreshes.length = 0;
  return {
    tree, colors, navigations, marks, refreshes, presentations,
    scrollMounts: () => scrollMounts,
    changeFontScale: async (fontScale) => { dimensions.fontScale = fontScale; await act(async () => tree.update(React.createElement(Home))); },
  };
}
const byId = (tree, testID) => tree.root.findByProps({ testID });
const unmount = async (tree) => act(async () => tree.unmount());

for (const scheme of ["light", "dark"]) {
  test(`Home cards use neutral surfaces with wrapping titles and retained carousel/menu contracts in ${scheme}`, async () => {
    const { tree, colors, navigations } = await renderHome(scheme);
    const cards = tree.root.findAllByProps({ testID: "workout-card" });
    for (const card of cards) {
      assert.match(card.props.accessibilityLabel, /1 exercise$/);
      const style = flatStyle(card.props.style({ pressed: false }));
      assert.equal(style.backgroundColor, colors.inputBackground);
      assert.equal(style.height, undefined);
      assert.ok(style.minHeight >= 160);
      const texts = card.findAllByType("Text");
      const name = texts.find((node) => node.props.children === title || node.props.children === "Completed session");
      assert.equal(name.props.numberOfLines, undefined);
      assert.equal(flatStyle(name.props.style).color, colors.text);
      assert.equal(flatStyle(card.findAllByProps({ testID: "home-workout-options" })[0].props.style).minHeight, 44);
    }
    assert.equal(flatStyle(cards[0].props.style({ pressed: false })).borderColor, colors.inputBorder);
    assert.equal(flatStyle(cards[1].props.style({ pressed: false })).borderColor, colors.primaryButton);
    const today = cards[1].findAllByType("Text").find((text) => text.props.children === "Today");
    assert.equal(flatStyle(today.props.style).color, colors.text);
    const list = tree.root.findByType("FlatList");
    assert.equal(list.props.snapToInterval, homeStyles.CARD_WIDTH + homeStyles.CARD_GAP);
    await act(async () => cards[0].props.onPress());
    assert.equal(navigations[0].params.workoutDayId, "done");
    await act(async () => cards[0].findByProps({ testID: "home-workout-options" }).props.onPress());
    const menu = tree.root.findByType("WorkoutCardMenu");
    assert.ok(menu.props.items.some((item) => item.testID === "home-share-workout"));
    assert.equal(menu.props.items.some((item) => item.id === "regenerate"), false);
    await act(async () => cards[1].findByProps({ testID: "home-workout-options" }).props.onPress());
    assert.ok(tree.root.findByType("WorkoutCardMenu").props.items.some((item) => item.id === "regenerate"));
    await unmount(tree);
  });

  test(`Home primary actions stay readable and local Resume wins offline in ${scheme}`, async () => {
    const active = { title, sessionId: "session", workoutDayId: "active", completedSets: 2, totalSets: 4 };
    const { tree, navigations } = await renderHome(scheme, { active, nextResource: { error: new Error("offline") } });
    const action = byId(tree, "home-resume-workout");
    assert.notEqual(flatStyle(action.props.style).backgroundColor, flatStyle(action.props.style, true).backgroundColor);
    for (const text of action.findAllByType("ThemedText")) {
      assert.equal(flatStyle(text.props.style).color, "#FFFFFF");
      assert.equal(text.props.numberOfLines, undefined);
    }
    assert.equal(tree.root.findAllByProps({ testID: "home-next-error" }).length, 0);
    await act(async () => action.props.onPress());
    assert.equal(navigations[0].pathname, "/workout/active");
    assert.equal(navigations[0].params.sessionId, "session");
    await unmount(tree);
    const first = await renderHome(scheme, { completed: 0 });
    const next = byId(first.tree, "home-next-workout");
    assert.notEqual(flatStyle(next.props.style).backgroundColor, flatStyle(next.props.style, true).backgroundColor);
    assert.match(next.props.accessibilityLabel, /^Open your first workout:/);
    await act(async () => next.props.onPress());
    assert.equal(first.navigations[0].pathname, "/workouts/[workoutDayId]");
    await unmount(first.tree);
  });

  test(`Home remounts only measured content for live font changes and invalidates old menu anchors in ${scheme}`, async () => {
    const active = { title, sessionId: "session", workoutDayId: "active", completedSets: 2, totalSets: 4 };
    const result = await renderHome(scheme, { active });
    const { tree, changeFontScale, scrollMounts, refreshes } = result;
    assert.equal(scrollMounts(), 1);
    await act(async () => tree.root.findAllByProps({ testID: "home-workout-options" })[0].props.onPress());
    assert.ok(tree.root.findByType("WorkoutCardMenu"));
    await changeFontScale(1);
    assert.equal(scrollMounts(), 1);
    assert.ok(tree.root.findByType("WorkoutCardMenu"));
    await changeFontScale(3.1);
    assert.equal(scrollMounts(), 2);
    assert.equal(tree.root.findAllByType("WorkoutCardMenu").length, 0);
    assert.equal(flatStyle(byId(tree, "home-live-stats").props.style).flexDirection, "column");
    assert.ok(byId(tree, "home-resume-workout"));
    assert.deepEqual(refreshes, []);
    await unmount(tree);
  });

  test(`Home adapts stats, headers and trend labels without font caps in ${scheme}`, async () => {
    const { tree } = await renderHome(scheme, { fontScale: 3.1, width: 375 });
    assert.equal(flatStyle(byId(tree, "home-live-stats").props.style).flexDirection, "column");
    const trend = byId(tree, "home-four-week-trend");
    const columns = trend.findAllByProps({ accessible: true });
    assert.equal(columns.length, 4);
    assert.match(columns[3].props.accessibilityLabel, /week in progress/);
    for (const text of tree.root.findAll((node) => node.type === "Text" || node.type === "ThemedText")) {
      assert.equal(text.props.maxFontSizeMultiplier, undefined);
      assert.equal(text.props.numberOfLines, undefined);
    }
    assert.equal(homeStyles.styles.sectionHeader.flexWrap, "wrap");
    assert.equal(homeStyles.styles.sectionHeaderPadded.flexWrap, "wrap");
    await unmount(tree);
    const ordinary = await renderHome(scheme);
    assert.equal(flatStyle(byId(ordinary.tree, "home-live-stats").props.style).flexDirection, "row");
    assert.equal(byId(ordinary.tree, "home-stat-streak").props.children, "0");
    await unmount(ordinary.tree);
    const unknown = await renderHome(scheme, { stats: null });
    assert.equal(byId(unknown.tree, "home-stat-streak").props.children, "—");
    await unmount(unknown.tree);
  });

  test(`Home retains first, complete, unavailable and independent loading/retry states in ${scheme}`, async () => {
    for (const [completed, id] of [[0, "home-first-workout"], [4, "home-week-complete"]]) {
      const { tree } = await renderHome(scheme, { completed, next: caughtUp });
      assert.ok(byId(tree, id));
      await unmount(tree);
    }
    const unavailable = await renderHome(scheme, { next: { type: "caught_up", target: { type: "none" } }, stats: null, trendResource: { data: null } });
    assert.ok(byId(unavailable.tree, "home-next-unavailable"));
    await unmount(unavailable.tree);
    const failures = await renderHome(scheme, { nextResource: { error: "offline" }, coachResource: { error: "offline" }, trendResource: { error: "offline" }, week: { error: "offline", getSortedWorkouts: () => [] } });
    for (const id of ["home-next-retry", "home-coach-retry", "home-trend-retry", "home-week-retry"]) {
      const button = byId(failures.tree, id);
      assert.ok(flatStyle(button.props.style).minHeight >= 44);
      assert.equal(flatStyle(button.props.style, true).backgroundColor, failures.colors.inputBorder);
      assert.equal(flatStyle(button.findByType(id === "home-week-retry" ? "Text" : "ThemedText").props.style).color, failures.colors.text);
      await act(async () => button.props.onPress());
    }
    assert.deepEqual(failures.refreshes, ["next", "coach", "trend", "week"]);
    await unmount(failures.tree);
    const loading = await renderHome(scheme, { nextResource: { loading: true }, coachResource: { loading: true }, trendResource: { loading: true } });
    for (const id of ["home-next-loading", "home-coach-loading", "home-trend-loading"]) assert.ok(byId(loading.tree, id));
    await unmount(loading.tree);
  });

  test(`Home quiet Coach/history actions and refresh retain navigation even if read-mark fails in ${scheme}`, async () => {
    const coach = { id: "coach-1", title: "A useful Coach action", body: "", target: { type: "settings", section: "training_preferences" } };
    const { tree, navigations, marks, refreshes, colors, presentations } = await renderHome(scheme, { coach, markFails: true });
    const action = byId(tree, "home-coach-action");
    assert.notEqual(flatStyle(action.props.style).backgroundColor, flatStyle(action.props.style, true).backgroundColor);
    assert.equal(flatStyle(byId(tree, "home-trend-history").props.style, true).backgroundColor, colors.inputBorder);
    assert.equal(action.findAllByType("Ionicons").at(-1).props.color, colors.icon);
    assert.equal(presentations.length > 0, true);
    assert.equal(presentations.at(-1)[1], "LB");
    await act(async () => action.props.onPress());
    assert.equal(navigations[0], "/settings/training-preferences");
    assert.deepEqual(marks[0], ["token-a", "coach-1", "primaryAction"]);
    assert.equal(refreshes.includes("coach"), false);
    assert.ok(byId(tree, "home-coach-action"));
    await act(async () => byId(tree, "home-trend-history").props.onPress());
    assert.equal(navigations[1], "/workout/history");
    await act(async () => tree.root.findByType("ScrollView").props.refreshControl.props.onRefresh());
    assert.deepEqual(refreshes, ["week", "active", "stats", "next", "coach", "trend"]);
    await unmount(tree);
    const metric = await renderHome(scheme, { coach, weightUnit: "KG" });
    assert.equal(metric.presentations.at(-1)[1], "KG");
    assert.deepEqual(Array.from(metric.presentations.at(-1)[2]), [5, 10]);
    await act(async () => byId(metric.tree, "home-coach-action").props.onPress());
    assert.deepEqual(metric.refreshes, ["coach"]);
    await unmount(metric.tree);
  });
}

for (const scheme of ["light", "dark"]) {
  test(`Home trainer-led accessibility has no fake time or stray suffix in ${scheme}`, async () => {
    const trainer = { ...workout("next", "2026-10-10"), planningMode: "trainer_led", timeBudgetMinutes: null, estimatedMinutes: 55 };
    const view = await renderHome(scheme, { workouts: [trainer] });
    const card = view.tree.root.findAllByProps({ testID: "workout-card" }).find((node) => typeof node.type === "string");
    assert.match(card.props.accessibilityLabel, /Trainer-led/);
    assert.doesNotMatch(card.props.accessibilityLabel, /minutes|exercisesutes|undefined/);
    await act(async () => view.tree.unmount());
  });
}
