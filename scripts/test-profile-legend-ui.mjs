import assert from "node:assert/strict";
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
const route = "app/(tabs)/profile.tsx";
const legend = "Filled: one or more completed workouts · Outline: this week";
const previousLegend = "Purple: a completed workout · Outline: this week";
const currentOutline = "borderColor: week.is_current && week.completed_workouts > 0 ? colors.text : colors.primaryButton";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const textOf = (node) => typeof node === "string" ? node : node.children.map(textOf).join("");
const sha = (value) => createHash("sha256").update(value).digest("hex");
function load(file, mocks) {
  const filename = path.join(root, file);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const code = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name) }, { filename });
  return module.exports;
}
const weeks = [
  { week_start: "2026-09-07", completed_workouts: 0, is_current: false },
  { week_start: "2026-09-14", completed_workouts: 1, is_current: false },
  { week_start: "2026-09-21", completed_workouts: 3, is_current: false },
];
async function render({ scheme, fontScale = 1, currentIndex = 2, missing = false }) {
  const calls = { routes: [], logout: 0, unregister: 0 };
  const refresh = async () => {};
  const AuthContext = React.createContext({ token: "in-memory-fixture", logOut: async () => { calls.logout++; } });
  const NotificationsContext = React.createContext({ unregisterCurrentDevice: async () => { calls.unregister++; } });
  const weekly = weeks.map((week, index) => ({ ...week, is_current: index === currentIndex }));
  const data = { achievements: missing ? null : { weekly_activity: weekly, total_completed: 4, current_active_weeks: 2, items: [] }, stats: null, history: [] };
  const native = { View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", RefreshControl: "RefreshControl", ActivityIndicator: "ActivityIndicator", StyleSheet: { create: (value) => value, hairlineWidth: 1 }, Platform: { select: (value) => value.ios }, useWindowDimensions: () => ({ width: 375, height: 812, fontScale }) };
  const mocks = {
    react: React, "react-native": native, "@expo/vector-icons": { Ionicons: "Ionicons" }, "expo-image": { Image: "Image" },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "expo-router": { useRouter: () => ({ push: (target) => calls.routes.push(target) }), useFocusEffect: (callback) => React.useEffect(callback, [callback]) },
    "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@/utils/authContext": { AuthContext }, "@/utils/notificationsContext": { NotificationsContext },
    "@/utils/profileContext": { useProfile: () => ({ profile: { preferred_name: "Fixture", last_name: "Profile", email: "fixture@example.invalid", weight: null, age: null, gender: null }, avatar: null, loading: false, error: null, refresh }) },
    "@/hooks/use-account-resource": { useAccountResource: () => ({ data, error: null, refresh }) },
    "@/services/accountScope": { accountRequestGuard: () => () => true },
    "@/services/profileService": { getAchievements: () => { throw new Error("Unexpected service call"); } },
    "@/services/workoutLoggingService": { getStats: () => { throw new Error("Unexpected service call"); }, listCompletedSessions: () => { throw new Error("Unexpected service call"); } },
    "@/utils/weightUnits": { loadWeightUnit: async () => "LB" },
  };
  mocks["@/constants/theme"] = load("constants/theme.ts", mocks);
  mocks["@/hooks/use-theme-color"] = { useThemeColor: (_, name) => mocks["@/constants/theme"].Colors[scheme][name] };
  mocks["@/components/themed-text"] = load("components/themed-text.tsx", mocks);
  mocks["./themed-text"] = mocks["@/components/themed-text"];
  mocks["@/components/profile-ui"] = load("components/profile-ui.tsx", mocks);
  mocks["@/components/screen-state"] = load("components/screen-state.tsx", mocks);
  const { default: Screen } = load(route, mocks);
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  return { tree, calls, weekly, colors: mocks["@/constants/theme"].Colors[scheme], close: async () => { await act(async () => tree.unmount()); } };
}
for (const scheme of ["light", "dark"]) {
  test(`${scheme}: weekly legend and contrasting current outline describe zero, one and multiple completions`, async () => {
    for (const currentIndex of [0, 1, 2]) {
      const view = await render({ scheme, currentIndex });
      assert.equal(view.tree.root.findAllByType("Text").filter((node) => textOf(node) === legend).length, 1);
      for (const week of view.weekly) {
        const label = `Week of ${week.week_start}: ${week.completed_workouts} completed workouts${week.is_current ? ", this week" : ""}`;
        const cell = view.tree.root.findByProps({ accessibilityLabel: label });
        assert.equal(cell.props.accessible, true);
        const bar = cell.children.find((node) => typeof node !== "string" && node.type === "View");
        assert.ok(bar);
        const style = flat(bar.props.style);
        assert.equal(style.backgroundColor, week.completed_workouts ? view.colors.primaryButton : view.colors.inputBorder);
        assert.equal(style.borderWidth, week.is_current ? 2 : 0);
        assert.equal(style.borderColor, week.is_current && week.completed_workouts > 0 ? view.colors.text : view.colors.primaryButton);
        assert.equal(style.height, 27);
        assert.equal(style.width, "100%");
        assert.equal(style.borderRadius, 5);
        if (week.is_current && week.completed_workouts > 0) assert.notEqual(style.borderColor, style.backgroundColor);
        if (week.is_current && week.completed_workouts === 0) {
          assert.equal(style.borderColor, view.colors.primaryButton);
          assert.equal(style.backgroundColor, view.colors.inputBorder);
        }
      }
      assert.equal(view.tree.root.findByProps({ accessibilityLabel: "4 Workouts" }).props.accessibilityLabel, "4 Workouts");
      assert.ok(view.tree.root.findByProps({ accessibilityLabel: "Unavailable PRs this week" }));
      assert.deepEqual(view.calls, { routes: [], logout: 0, unregister: 0 });
      await view.close();
    }
  });
  test(`${scheme}: longer legend is uncapped and retains the existing adaptive metric and body-stat layouts`, async () => {
    for (const fontScale of [1, 1.3, 1.31, 2]) {
      const view = await render({ scheme, fontScale });
      const label = view.tree.root.findAllByType("Text").find((node) => textOf(node) === legend);
      assert.ok(label);
      assert.equal(flat(label.props.style).color, view.colors.icon);
      assert.equal(flat(label.props.style).fontSize, 12);
      assert.equal(flat(label.props.style).lineHeight, 18);
      for (const key of ["numberOfLines", "allowFontScaling", "maxFontSizeMultiplier", "ellipsizeMode"]) assert.equal(label.props[key], undefined);
      const direction = fontScale > 1.3 ? "column" : "row";
      const metrics = view.tree.root.findByProps({ accessibilityLabel: "4 Workouts" }).parent;
      assert.equal(flat(metrics.props.style).flexDirection, direction);
      const weight = view.tree.root.findAllByType("Text").find((node) => textOf(node) === "Weight");
      assert.equal(flat(weight.parent.parent.parent.props.style).flexDirection, direction);
      await view.close();
    }
  });
  test(`${scheme}: missing achievements retain unknown metrics and the training-rhythm fallback`, async () => {
    const view = await render({ scheme, missing: true });
    const texts = view.tree.root.findAllByType("Text").map(textOf);
    assert.ok(texts.includes("Your training rhythm will appear here."));
    assert.ok(!texts.includes(legend));
    assert.equal(view.tree.root.findAllByType("View").filter((node) => node.props.accessibilityLabel?.startsWith("Week of ")).length, 0);
    assert.ok(view.tree.root.findByProps({ accessibilityLabel: "Unavailable Workouts" }));
    assert.deepEqual(view.calls, { routes: [], logout: 0, unregister: 0 });
    await view.close();
  });
  test(`${scheme}: Profile edit, settings, achievements and history destinations stay unchanged`, async () => {
    const view = await render({ scheme });
    for (const testID of ["profile-settings-button", "profile-edit", "profile-edit-body", "profile-achievements", "profile-workout-history"]) await act(async () => view.tree.root.findByProps({ testID }).props.onPress());
    assert.deepEqual(Array.from(view.calls.routes), ["/settings", "/profile/edit", "/profile/edit", "/profile/achievements", "/workout/history"]);
    assert.equal(view.calls.logout, 0);
    assert.equal(view.calls.unregister, 0);
    await view.close();
  });
}
test("scope: only the legend and completed-current-week outline change; controller, shared components and business tests stay frozen", () => {
  assert.equal(source(route).split(legend).length, 2);
  assert.equal(source(route).split(currentOutline).length, 2);
  const profile = source(route).replace("    <ScrollView\n      // Recreate native text measurements when Dynamic Type changes while this tab stays mounted.\n      key={fontScale}\n      contentContainerStyle=", "    <ScrollView contentContainerStyle=");
  assert.equal(sha(profile.replace(legend, previousLegend).replace(currentOutline, "borderColor: colors.primaryButton")), "cb9fbb83c18c5ab9987d4766fe5b88d8bf23dc3cdf5383dfb631508da063e306");
  assert.equal(sha(source("scripts/test-profile.mjs")), "34cc03b830b84cf25576dec7332c154419cb151277548481a978a0858516d441");
  assert.equal(sha(source("components/profile-ui.tsx")), "71dba99a5759d5e5a10e8c429d20ded233f5b5e7a34a5a5638f3a3522e7da0a0");
});
