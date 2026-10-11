import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
function load(relative, mocks) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console: { ...console, warn() {} } }, { filename });
  return module.exports;
}
const native = { ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", View: "View", Text: "Text", ScrollView: "ScrollView", StyleSheet: { create: (styles) => styles }, Platform: { select: (values) => values.ios } };
const { Colors, Fonts } = load("constants/theme.ts", { "react-native": native });
const localDates = load("utils/localDate.ts", {});
const plain = (value) => JSON.parse(JSON.stringify(value));
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node, pressed = false) => flat(typeof node.props.style === "function" ? node.props.style({ pressed }) : node.props.style);
const textOf = (node) => typeof node === "string" ? node : (node?.children?.map(textOf).join(node.type === "Text" ? "" : " ") ?? "").replace(/\s+/g, " ").trim();
const host = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const parentView = (node) => { let parent = node.parent; while (parent && parent.type !== "View") parent = parent.parent; return parent; };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tap = async (node) => { assert.ok(node); assert.equal(node.props.disabled ?? false, false); await act(async () => { node.props.onPress(); }); };
const unmount = async (tree) => { await act(async () => tree.unmount()); };
const program = (extra = {}) => ({ id: "program-one", version: 3, name: "Full Body Foundation", frequency: 3, days: [{ id: "day-one", exercises: [{ exerciseId: "squat", exercise: { name: "Barbell Squat" } }, { exerciseId: "press", exercise: { name: "Bench Press" } }] }], ...extra });
const exercise = (id, name = id) => ({ id, name });
const conflict = (extra = {}) => ({ templateExerciseId: "item-one", templateDayId: "day-one", originalExerciseId: "squat", missingEquipmentIds: ["barbell", "unknown_equipment"], suggestedExerciseId: "bodyweight", suggestedExercise: exercise("bodyweight", "Bodyweight Squat"), alternatives: [exercise("bodyweight", "Bodyweight Squat"), exercise("lunge", "Reverse Lunge")], ...extra });
const preview = (extra = {}) => ({ scheduleImpact: { scheduledDates: ["2026-10-12", "2026-10-14", "2026-10-16"], preservedWorkoutDayIds: ["saved-one"], replacedWorkoutDayIds: ["pending-one", "pending-two"] }, equipmentConflicts: [], ...extra });
function contrast(a, b) {
  const channels = (hex) => (hex.length === 4 ? hex.slice(1).split("").map((value) => value.repeat(2)) : hex.slice(1).match(/../g)).map((value) => parseInt(value, 16) / 255);
  const luminance = (hex) => channels(hex).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

async function activation(options = {}) {
  let current = options;
  const scheme = options.scheme ?? "light";
  const colors = Colors[scheme];
  const AuthContext = React.createContext(null);
  const EquipmentContext = React.createContext({ items: [{ id: "barbell", name: "Olympic barbell" }] });
  const route = { templateId: options.templateId === undefined ? "program-one" : options.templateId, applyMode: options.mode, review: options.review };
  const calls = { loads: [], active: [], previews: [], activations: [], operations: [], installed: [], refreshed: [], routes: [], sync: [] };
  const week = { weekStart: "2026-10-05", workouts: [{ date: "2026-10-05" }, { date: "2026-10-07" }, { date: "2026-10-09" }] };
  const syncCurrentWeek = async () => { calls.sync.push("sync"); };
  const mocks = {
    react: React, "react-native": { ...native, useWindowDimensions: () => ({ width: options.width ?? 375, fontScale: options.fontScale ?? 1 }) },
    "@expo/vector-icons": { Ionicons: "Ionicons" }, "@/constants/theme": { Colors, Fonts },
    "@/hooks/use-color-scheme": { useColorScheme: () => scheme }, "@/hooks/use-theme-color": { useThemeColor: () => colors.text },
    "expo-router": { useLocalSearchParams: () => route, useRouter: () => ({ replace: (target) => calls.routes.push(["replace", target]), back: () => calls.routes.push(["back"]) }) },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@/utils/authContext": { AuthContext }, "@/utils/equipmentContext": { EquipmentContext },
    "@/hooks/use-workout-week": { useWorkoutWeek: () => ({ weekPlan: current.week === undefined ? week : current.week, currentWeekStart: "2026-10-05", syncCurrentWeek, installWeekPlan: (value) => calls.installed.push(plain(value)), refreshWeek: (value) => calls.refreshed.push(plain(value)) }) },
    "@/utils/localDate": { localDateIso: () => current.today ?? "2026-10-11", nextLocalMondayIso: () => current.monday ?? "2026-10-12" },
    "@/utils/programDisplay": { WEEKDAY_LABELS: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], todayIso: () => current.today ?? "2026-10-11" },
    "@/services/workoutWeekService": { mapApiWeekPlan: (value) => plain(value) },
    "@/services/programService": {
      getProgram: async (token, id) => { calls.loads.push([token, id]); return current.get ? current.get(token, id) : current.program ?? program(); },
      getActiveProgram: async (token, date) => { calls.active.push([token, date]); return current.getActive ? current.getActive(token) : current.active ?? { current: null, scheduled: null }; },
      previewProgramActivation: async (token, id, payload) => { calls.previews.push([token, id, plain(payload)]); return current.preview ? current.preview(payload) : current.result ?? preview(); },
      createProgramOperationId: () => { const id = `operation-${calls.operations.length + 1}`; calls.operations.push(id); return id; },
      activateProgram: async (token, id, payload) => { calls.activations.push([token, id, plain(payload)]); return current.activate ? current.activate(payload) : { weekPlan: { weekStart: "2026-10-05", workouts: [] } }; },
    },
  };
  mocks["@/components/themed-text"] = load("components/themed-text.tsx", mocks);
  mocks["@/components/workout/WorkoutText"] = load("components/workout/WorkoutText.tsx", mocks);
  const { default: Screen } = load("app/programs/activate.tsx", mocks);
  const element = (token = options.token === undefined ? "A" : options.token, userId = token) => React.createElement(AuthContext.Provider, { value: { token, user: token ? { id: userId } : null } }, React.createElement(Screen));
  let tree;
  await act(async () => { tree = create(element()); });
  return { tree, calls, colors, element, setOptions: (next) => { current = { ...current, ...next }; }, setRoute: (next) => Object.assign(route, next) };
}

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: weekdays are distinct neutral 44-point choices and require exact frequency`, async () => {
    const view = await activation({ scheme });
    const selected = host(view.tree, "activation-weekday-0");
    assert.equal(textOf(selected), "Mon");
    assert.equal(selected.props.accessibilityRole, "checkbox");
    assert.equal(selected.props.accessibilityLabel, "Mon");
    assert.equal(selected.props.accessibilityState.checked, true);
    assert.ok(selected.findByType("Ionicons"));
    for (const pressed of [false, true]) {
      assert.notEqual(styleOf(selected, pressed).backgroundColor, view.colors.primaryButton);
      assert.ok(contrast(styleOf(selected.findByType("Text")).color, styleOf(selected, pressed).backgroundColor) >= 4.5);
      assert.ok(contrast(selected.findByType("Ionicons").props.color, styleOf(selected, pressed).backgroundColor) >= 3);
      assert.ok(contrast(styleOf(selected, pressed).borderColor, styleOf(selected, pressed).backgroundColor) >= 3);
      assert.equal(styleOf(selected, pressed).opacity, undefined);
    }
    for (let i = 0; i < 7; i++) { const day = host(view.tree, `activation-weekday-${i}`); assert.ok(styleOf(day).minWidth >= 44); assert.ok(styleOf(day).minHeight >= 44); }
    assert.equal(styleOf(selected).flexBasis * 7 + 3 * 6 <= 375 - 44, true);
    await tap(host(view.tree, "activation-weekday-1"));
    assert.equal(host(view.tree, "activation-weekday-1").props.accessibilityState.checked, false);
    await tap(selected);
    assert.equal(host(view.tree, "activation-preview").props.disabled, true);
    assert.equal(host(view.tree, "activation-preview").props.accessibilityState.disabled, true);
    await tap(host(view.tree, "activation-weekday-1"));
    assert.equal(host(view.tree, "activation-preview").props.disabled, false);
    await tap(host(view.tree, "activation-preview"));
    assert.deepEqual(view.calls.previews[0], ["A", "program-one", { weekStart: "2026-10-05", effectiveDate: "2026-10-11", weekdays: [1, 2, 4], applyMode: "now" }]);
    await unmount(view.tree);
  });

  test(`${scheme}: mode choices wrap consequences, keep selection and use one opaque primary`, async () => {
    const view = await activation({ scheme });
    for (const id of ["activation-mode-now", "activation-mode-next-week"]) {
      const node = host(view.tree, id);
      assert.ok(styleOf(node).minHeight >= 44);
      for (const pressed of [false, true]) {
        assert.notEqual(styleOf(node, pressed).backgroundColor, view.colors.primaryButton);
        assert.equal(styleOf(node, pressed).opacity, undefined);
        for (const copy of node.findAllByType("Text")) assert.ok(contrast(styleOf(copy).color, styleOf(node, pressed).backgroundColor) >= 4.5);
        assert.ok(contrast(node.findByType("Ionicons").props.color, styleOf(node, pressed).backgroundColor) >= 3);
        if (node.props.accessibilityState.selected) assert.ok(contrast(styleOf(node, pressed).borderColor, styleOf(node, pressed).backgroundColor) >= 3);
      }
    }
    assert.match(textOf(view.tree.root), /Replace unfinished workouts.*Keep this week as it is/);
    const action = host(view.tree, "activation-preview");
    for (const pressed of [false, true]) { assert.equal(styleOf(action, pressed).backgroundColor, view.colors.primaryButton); assert.ok(contrast(styleOf(action.findByType("Text")).color, styleOf(action, pressed).backgroundColor) >= 4.5); }
    await tap(host(view.tree, "activation-mode-next-week"));
    assert.equal(host(view.tree, "activation-mode-next-week").props.accessibilityState.selected, true);
    await tap(host(view.tree, "activation-preview"));
    assert.equal(view.calls.previews[0][2].effectiveDate, "2026-10-12");
    assert.equal(view.calls.previews[0][2].applyMode, "next-week");
    assert.equal(textOf(host(view.tree, "activation-target-week")), "Week of Oct 12");
    assert.match(textOf(view.tree.root), /Mon, Oct 12, Wed, Oct 14, Fri, Oct 16/);
    assert.match(textOf(view.tree.root), /1 existing workouts stay unchanged · 2 unfinished workouts replaced/);
    const calendar = host(view.tree, "activation-review").findAllByType("Ionicons").find((node) => node.props.name === "calendar-outline");
    assert.equal(calendar.props.color, view.colors.icon);
    await unmount(view.tree);
  });

  test(`${scheme}: real current, scheduled and equipment success remain semantic and readable`, async () => {
    const view = await activation({ scheme, active: { current: { templateId: "program-one" }, scheduled: { templateId: "program-one" } } });
    for (const id of ["activation-current-program", "activation-scheduled-program"]) {
      const status = host(view.tree, id);
      assert.ok(contrast(styleOf(status.findByType("Text")).color, view.colors.background) >= 4.5);
      assert.ok(contrast(status.findByType("Ionicons").props.color, view.colors.background) >= 3);
      assert.notEqual(styleOf(status.findByType("Text")).color, view.colors.text);
    }
    await tap(host(view.tree, "activation-preview"));
    const copy = text(view.tree, "Your equipment supports every exercise.");
    assert.equal(styleOf(copy).color, scheme === "light" ? "#127536" : "#6EDB91");
    assert.ok(contrast(styleOf(copy).color, view.colors.background) >= 4.5);
    assert.equal(host(view.tree, "activation-confirm").props.disabled, false);
    await unmount(view.tree);
  });

  test(`${scheme}: equipment rows stack Suggested and retain deduplication and same-day exclusion`, async () => {
    const conflicts = [conflict(), conflict({ templateExerciseId: "item-two", originalExerciseId: "press", suggestedExerciseId: "pushup", suggestedExercise: exercise("pushup", "Push Up"), alternatives: [exercise("bodyweight", "Bodyweight Squat"), exercise("row", "Inverted Row")] })];
    const view = await activation({ scheme, result: preview({ equipmentConflicts: conflicts }) });
    await tap(host(view.tree, "activation-preview"));
    assert.equal(view.tree.root.findAll((node) => node.type === "Pressable" && node.props.testID === "activation-suggested-item-one-bodyweight").length, 1);
    const suggestion = host(view.tree, "activation-suggested-item-one-bodyweight");
    assert.equal(suggestion.props.accessibilityState.checked, true);
    assert.equal(parentView(suggestion.findAllByType("Text")[0]), parentView(suggestion.findAllByType("Text")[1]));
    assert.match(textOf(host(view.tree, "activation-conflict-1")), /Barbell Squat.*Olympic barbell, unknown equipment/);
    for (const pressed of [false, true]) {
      assert.notEqual(styleOf(suggestion, pressed).backgroundColor, view.colors.primaryButton);
      for (const copy of suggestion.findAllByType("Text")) assert.ok(contrast(styleOf(copy).color, styleOf(suggestion, pressed).backgroundColor) >= 4.5);
      assert.ok(contrast(suggestion.findByType("Ionicons").props.color, styleOf(suggestion, pressed).backgroundColor) >= 3);
      assert.ok(contrast(styleOf(suggestion, pressed).borderColor, styleOf(suggestion, pressed).backgroundColor) >= 3);
    }
    const duplicate = host(view.tree, "activation-alternative-item-two-bodyweight");
    assert.equal(duplicate.props.disabled, true);
    assert.match(duplicate.props.accessibilityLabel, /already selected in this workout/);
    assert.ok(contrast(styleOf(duplicate.findByType("Text")).color, styleOf(duplicate).backgroundColor) >= 4.5);
    await tap(host(view.tree, "activation-alternative-item-one-lunge"));
    await tap(host(view.tree, "activation-alternative-item-two-bodyweight"));
    await tap(host(view.tree, "activation-confirm"));
    assert.deepEqual(view.calls.activations[0][2].substitutions, { "item-one": "lunge", "item-two": "bodyweight" });
    await unmount(view.tree);
  });

  test(`${scheme}: unresolved equipment stays visible, amber and blocks final activation`, async () => {
    const view = await activation({ scheme, result: preview({ equipmentConflicts: [conflict({ suggestedExercise: null, suggestedExerciseId: null, alternatives: [] })] }) });
    await tap(host(view.tree, "activation-preview"));
    const notice = host(view.tree, "activation-unresolved-item-one");
    assert.match(textOf(notice), /No compatible replacement is available from your saved equipment/);
    const warning = scheme === "light" ? "#9A3412" : "#FDBA74";
    assert.equal(styleOf(notice.findByType("Text")).color, warning);
    assert.ok(contrast(warning, view.colors.background) >= 4.5);
    assert.ok(contrast(notice.findByType("Ionicons").props.color, view.colors.background) >= 3);
    assert.equal(host(view.tree, "activation-unresolved-summary").props.accessibilityRole, "alert");
    const confirm = host(view.tree, "activation-confirm");
    assert.equal(confirm.props.disabled, true);
    assert.equal(styleOf(confirm).backgroundColor, view.colors.inputBackground);
    assert.ok(contrast(styleOf(confirm.findByType("Text")).color, styleOf(confirm).backgroundColor) >= 4.5);
    await act(async () => confirm.props.onPress());
    assert.equal(view.calls.activations.length, 0);
    assert.match(textOf(host(view.tree, "activation-error")), /Choose a replacement for every unavailable exercise/);
    assert.ok(contrast(styleOf(host(view.tree, "activation-error")).color, view.colors.background) >= 4.5);
    await unmount(view.tree);
  });

  test(`${scheme}: maximum native text and long names remain uncapped in the safe-area scroll`, async () => {
    const name = "A longer strength and conditioning program for all your selected training days";
    const view = await activation({ scheme, fontScale: 3.12, program: program({ name }), result: preview({ equipmentConflicts: [conflict({ suggestedExercise: exercise("bodyweight", "A longer equipment-aware alternative exercise with instructions") })] }) });
    assert.equal(textOf(host(view.tree, "activation-program-name")), name);
    assert.deepEqual(plain(view.tree.root.findByType("SafeAreaView").props.edges), ["top", "bottom"]);
    const back = host(view.tree, "activation-back");
    assert.equal(back.props.accessibilityLabel, "Back from Use this program");
    assert.equal(styleOf(back).height, 44);
    assert.equal(styleOf(back).width, 44);
    assert.equal(text(view.tree, "Use program"), undefined);
    const day = host(view.tree, "activation-weekday-0");
    assert.ok(styleOf(day).flexBasis > 44);
    assert.equal(styleOf(day.parent).flexWrap, "wrap");
    assert.equal(styleOf(host(view.tree, "activation-mode-now").parent).flexDirection, "column");
    const scroll = host(view.tree, "activation-scroll");
    assert.ok(scroll.props.contentContainerStyle.paddingBottom >= 24);
    await tap(host(view.tree, "activation-preview"));
    for (const node of view.tree.root.findAllByType("Text")) {
      assert.equal(node.props.numberOfLines, undefined);
      assert.equal(node.props.maxFontSizeMultiplier, undefined);
      assert.equal(node.props.allowFontScaling, undefined);
      assert.equal(styleOf(node).lineHeight, undefined);
      assert.equal(styleOf(node).fontFamily, undefined);
    }
    await tap(host(view.tree, "activation-back"));
    assert.deepEqual(view.calls.routes.at(-1), ["back"]);
    await unmount(view.tree);
  });

  test(`${scheme}: loading and unavailable states remain scrollable with neutral Back and semantic error`, async () => {
    const pending = deferred();
    const view = await activation({ scheme, get: () => pending.promise });
    assert.ok(host(view.tree, "activation-loading"));
    assert.equal(view.tree.root.findByType("ActivityIndicator").props.color, view.colors.icon);
    assert.equal(host(view.tree, "activation-back").props.accessibilityLabel, "Back from Use program");
    await act(async () => pending.reject(new Error("offline")));
    assert.match(textOf(view.tree.root), /Program unavailable.*This program couldn’t load/);
    const icon = view.tree.root.findAllByType("Ionicons").find((node) => node.props.name === "cloud-offline-outline");
    assert.equal(icon.props.color, scheme === "light" ? "#B42318" : "#FF8B82");
    assert.ok(contrast(icon.props.color, view.colors.background) >= 3);
    const back = view.tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === "Go back");
    assert.ok(styleOf(back).minHeight >= 44);
    await tap(back);
    assert.deepEqual(view.calls.routes.at(-1), ["back"]);
    await unmount(view.tree);
  });
}

test("Week-derived selections and fallback weekday order preserve one, three and seven day frequencies", async () => {
  for (const [frequency, week, expected] of [[3, undefined, [0, 2, 4]], [3, null, [0, 3, 6]], [1, null, [0]], [7, null, [0, 1, 2, 3, 4, 5, 6]]]) {
    const view = await activation({ program: program({ frequency }), week });
    const checked = Array.from({ length: 7 }, (_, i) => host(view.tree, `activation-weekday-${i}`).props.accessibilityState.checked ? i : null).filter((value) => value !== null);
    assert.deepEqual(checked, expected);
    await unmount(view.tree);
  }
});

test("Preview failure preserves selections and Retry rebuilds the same schedule without activating", async () => {
  let failures = 1;
  const view = await activation({ preview: () => { if (failures--) throw new Error("offline"); return preview(); } });
  await tap(host(view.tree, "activation-preview"));
  assert.match(textOf(host(view.tree, "activation-error")), /schedule preview couldn’t load/);
  assert.equal(host(view.tree, "activation-weekday-0").props.accessibilityState.checked, true);
  await tap(host(view.tree, "activation-preview-retry"));
  assert.deepEqual(view.calls.previews[0], view.calls.previews[1]);
  assert.ok(host(view.tree, "activation-review"));
  assert.equal(host(view.tree, "activation-error"), undefined);
  assert.equal(view.calls.activations.length, 0);
  await unmount(view.tree);
});

test("Preview busy state disables all input choices and is released without contrast fading", async () => {
  const pending = deferred();
  const view = await activation({ preview: () => pending.promise });
  await tap(host(view.tree, "activation-preview"));
  const action = host(view.tree, "activation-preview");
  assert.equal(action.props.accessibilityState.busy, true);
  assert.equal(action.props.disabled, true);
  for (const id of ["activation-weekday-0", "activation-mode-next-week"]) { assert.equal(host(view.tree, id).props.disabled, true); assert.equal(styleOf(host(view.tree, id)).opacity, undefined); }
  await act(async () => pending.resolve(preview()));
  assert.equal(host(view.tree, "activation-weekday-0").props.disabled, false);
  await unmount(view.tree);
});

test("Equipment-review route automatically previews once per input and can retry a failed read", async () => {
  let fail = true;
  const view = await activation({ review: "equipment", mode: "next-week", preview: () => { if (fail) throw new Error("offline"); return preview(); } });
  assert.equal(view.calls.previews.length, 1);
  assert.equal(view.calls.previews[0][2].applyMode, "next-week");
  await act(async () => view.tree.update(view.element()));
  assert.equal(view.calls.previews.length, 1);
  fail = false;
  await tap(host(view.tree, "activation-preview-retry"));
  assert.equal(view.calls.previews.length, 2);
  await tap(host(view.tree, "activation-mode-now"));
  assert.equal(view.calls.previews.length, 3);
  assert.equal(view.calls.previews[2][2].applyMode, "now");
  await unmount(view.tree);
});

test("Activation uses the stable operation on retry then installs the canonical current week", async () => {
  let fail = true;
  const view = await activation({ activate: () => { if (fail) throw new Error("offline"); return { weekPlan: { weekStart: "2026-10-05", workouts: [{ id: "canonical" }] } }; } });
  await tap(host(view.tree, "activation-preview"));
  await tap(host(view.tree, "activation-confirm"));
  assert.match(textOf(host(view.tree, "activation-error")), /current schedule is unchanged/);
  assert.equal(view.calls.installed.length, 0);
  assert.equal(view.calls.routes.length, 0);
  fail = false;
  await tap(host(view.tree, "activation-confirm"));
  assert.deepEqual(view.calls.activations[0], ["A", "program-one", { weekStart: "2026-10-05", effectiveDate: "2026-10-11", weekdays: [0, 2, 4], templateVersion: 3, substitutions: {}, applyMode: "now", clientOperationId: "operation-1" }]);
  assert.equal(view.calls.activations[1][2].clientOperationId, "operation-1");
  assert.equal(view.calls.operations.length, 1);
  assert.deepEqual(view.calls.installed, [{ weekStart: "2026-10-05", workouts: [{ id: "canonical" }] }]);
  assert.deepEqual(view.calls.routes, [["replace", "/(tabs)"]]);
  await unmount(view.tree);
});

test("Changing replacement input resets the operation while preserving the reviewed schedule", async () => {
  const view = await activation({ result: preview({ equipmentConflicts: [conflict()] }), activate: () => { throw new Error("offline"); } });
  await tap(host(view.tree, "activation-preview"));
  await tap(host(view.tree, "activation-confirm"));
  await tap(host(view.tree, "activation-alternative-item-one-lunge"));
  await tap(host(view.tree, "activation-confirm"));
  assert.equal(view.calls.activations[1][2].clientOperationId, "operation-2");
  assert.equal(view.calls.previews.length, 1);
  assert.deepEqual(view.calls.activations[1][2].substitutions, { "item-one": "lunge" });
  await unmount(view.tree);
});

test("Next-week activation leaves the visible week untouched; mismatched current response refreshes it", async () => {
  for (const [mode, responseWeek, installs, refreshes] of [["next-week", "2026-10-12", 0, 0], ["now", "2026-10-12", 0, 1]]) {
    const view = await activation({ mode, activate: () => ({ weekPlan: { weekStart: responseWeek, workouts: [] } }) });
    await tap(host(view.tree, "activation-preview"));
    await tap(host(view.tree, "activation-confirm"));
    assert.equal(view.calls.installed.length, installs);
    assert.equal(view.calls.refreshed.length, refreshes);
    if (refreshes) assert.deepEqual(view.calls.refreshed[0], { weekStart: "2026-10-05" });
    assert.deepEqual(view.calls.routes.at(-1), ["replace", "/(tabs)"]);
    await unmount(view.tree);
  }
});

test("In-flight activation fences repeated taps, choices and Back until confirmation", async () => {
  const pending = deferred();
  const view = await activation({ activate: () => pending.promise });
  await tap(host(view.tree, "activation-preview"));
  await tap(host(view.tree, "activation-confirm"));
  const confirm = host(view.tree, "activation-confirm");
  assert.equal(confirm.props.disabled, true);
  assert.equal(confirm.props.accessibilityState.busy, true);
  assert.equal(host(view.tree, "activation-back").props.disabled, true);
  assert.equal(host(view.tree, "activation-mode-next-week").props.disabled, true);
  await act(async () => confirm.props.onPress());
  assert.equal(view.calls.activations.length, 1);
  await act(async () => pending.resolve({ weekPlan: { weekStart: "2026-10-05", workouts: [] } }));
  assert.equal(view.calls.installed.length, 1);
  assert.equal(view.calls.routes.length, 1);
  await unmount(view.tree);
});

test("Delayed program loads cannot cross account or route boundaries", async () => {
  for (const accountSwitch of [true, false]) {
    const pending = deferred();
    const view = await activation({ get: (token, id) => token === "A" && id === "program-one" ? pending.promise : program({ id, name: "Current owner program" }) });
    if (!accountSwitch) view.setRoute({ templateId: "program-two" });
    await act(async () => view.tree.update(view.element(accountSwitch ? "B" : "A")));
    await act(async () => pending.resolve(program({ name: "Stale program" })));
    assert.equal(text(view.tree, "Stale program"), undefined);
    assert.equal(textOf(host(view.tree, "activation-program-name")), "Current owner program");
    await unmount(view.tree);
  }
});

test("Stale preview completions are discarded after account, route or local-date changes", async () => {
  for (const change of ["account", "route", "date"]) {
    const pending = deferred();
    const view = await activation({ preview: () => pending.promise });
    await tap(host(view.tree, "activation-preview"));
    if (change === "route") view.setRoute({ templateId: "program-two" });
    if (change === "date") view.setOptions({ today: "2026-10-12" });
    await act(async () => view.tree.update(view.element(change === "account" ? "B" : "A")));
    await act(async () => pending.resolve(preview()));
    assert.equal(host(view.tree, "activation-review"), undefined);
    assert.equal(view.calls.activations.length, 0);
    await unmount(view.tree);
  }
});

test("Stale activation confirmations cannot install or navigate after account, route or unmount", async () => {
  for (const change of ["account", "route", "unmount"]) {
    const pending = deferred();
    const view = await activation({ activate: () => pending.promise });
    await tap(host(view.tree, "activation-preview"));
    await tap(host(view.tree, "activation-confirm"));
    if (change === "route") view.setRoute({ templateId: "program-two" });
    if (change === "unmount") await unmount(view.tree);
    else await act(async () => view.tree.update(view.element(change === "account" ? "B" : "A")));
    await act(async () => pending.resolve({ weekPlan: { weekStart: "2026-10-05", workouts: [] } }));
    assert.equal(view.calls.installed.length, 0);
    assert.equal(view.calls.refreshed.length, 0);
    assert.equal(view.calls.routes.length, 0);
    if (change !== "unmount") await unmount(view.tree);
  }
});

test("Missing authentication and template preserve unavailable state without server requests", async () => {
  for (const options of [{ token: null }, { templateId: null }]) {
    const view = await activation(options);
    assert.match(textOf(view.tree.root), /Program unavailable/);
    assert.equal(view.calls.loads.length, 0);
    assert.equal(view.calls.previews.length, 0);
    await unmount(view.tree);
  }
});

test("Next Monday stays local across Sunday, Monday, year and DST boundaries", () => {
  for (const [year, month, day, expected] of [[2026, 9, 11, "2026-10-12"], [2026, 9, 12, "2026-10-19"], [2026, 11, 31, "2027-01-04"], [2026, 2, 8, "2026-03-09"], [2026, 10, 1, "2026-11-02"]]) {
    assert.equal(localDates.nextLocalMondayIso(new Date(year, month, day, 12)), expected);
  }
});

test("Controller and equipment-choice contracts are byte-identical to the approved base", () => {
  const baseline = execFileSync("git", ["show", "e8fd225053493f3af5a0eb5c8f7c7c8a96aa257f:app/programs/activate.tsx"], { cwd: root, encoding: "utf8" });
  const current = readFileSync(path.join(root, "app/programs/activate.tsx"), "utf8");
  const controller = (value, end) => value.slice(value.indexOf("  const { token, user }"), value.indexOf(end));
  assert.equal(controller(current, "  const dark ="), controller(baseline, "  if (loading ||"));
  const defaultDays = (value) => value.slice(value.indexOf("function defaultWeekdays"), value.indexOf("export default"));
  assert.equal(defaultDays(current), defaultDays(baseline));
  const choices = (value) => value.slice(value.indexOf("              const suggestedId"), value.indexOf("              return <View"));
  assert.equal(choices(current), choices(baseline));
  for (const fragment of ['const usedInDay = preview.equipmentConflicts.some((other) => other.templateDayId === conflict.templateDayId && other.templateExerciseId !== conflict.templateExerciseId && substitutions[other.templateExerciseId] === exercise.id);', 'onPress={() => setSubstitutions((current) => ({ ...current, [conflict.templateExerciseId]: exercise.id }))}', 'onPress={() => void buildPreview()}', 'onPress={() => void submit()}']) assert.ok(current.includes(fragment));
});
