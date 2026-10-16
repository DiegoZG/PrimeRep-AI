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
const base = "6ffc2364bf5203127b71829f4c527583b6063460";
const route = "app/onboarding/workout-split/add-workout-modal.tsx";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const original = (file) => execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" });
const sha = (value) => createHash("sha256").update(value).digest("hex");
const plain = (value) => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; };
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const native = {
  View: "View", Text: "Text", ScrollView: "ScrollView", Switch: "Switch", TouchableOpacity: "TouchableOpacity", TouchableWithoutFeedback: "TouchableWithoutFeedback", Pressable: "Pressable",
  StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (values) => values.ios ?? values.default },
};
function load(file, mocks, input = source(file)) {
  const module = { exports: {} };
  const output = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  class Clock extends Date { static now() { return 1900000000000; } }
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected boundary/import: ${name} in ${file}`);
  }, console: { ...console, warn() {} }, Date: Clock }, { filename: path.join(root, file) });
  return module.exports;
}
const theme = load("constants/theme.ts", { "react-native": native });
const constants = load("features/onboarding/constants.ts", {});
const content = constants.ADD_WORKOUT_MODAL;
const helpers = load("features/onboarding/workout-split-helpers.ts", {});
const splits = content.workoutSplitOptions.filter((option) => option.id !== "core");
const muscles = content.customMuscleGroups;
const seed = { preferredName: "Alex", reason: "structure", selectedEquipment: ["barbell"], workoutSplit: "custom", notificationsEnabled: true, customWorkouts: [] };
const existing = { id: "keep-A", name: "Pull", type: "workout-split", muscleGroups: ["back", "biceps"] };
const custom = { id: "keep-B", name: "Saved custom name", type: "custom", muscleGroups: ["quads", "calves"] };
const controls = (tree) => tree.root.findAll((node) => typeof node.type === "string" && ["TouchableOpacity", "Pressable"].includes(node.type));
const choice = (tree, name) => controls(tree).reverse().find((node) => node.props.accessibilityLabel === name || node.findAllByType("Text").some((text) => textOf(text) === name));
const action = (view) => choice(view.tree, view.params.workoutId ? "Update" : "Add");
const selected = (node) => node.props.accessibilityState?.checked ?? node.findAllByType("AnimatedView").some((child) => flat(child.props.style).opacity === 1);
const core = (tree) => tree.root.findByType("Switch");
const tap = async (node) => { assert.equal(typeof node.props.onPress, "function"); await act(async () => node.props.onPress()); };
const toggleCore = async (view, value) => { assert.equal(core(view.tree).props.disabled, false); await act(async () => core(view.tree).props.onValueChange(value)); };
const unmount = async (view) => { await act(async () => view.tree.unmount()); };
const tab = async (view, name) => tap(choice(view.tree, name));
const unchanged = (view) => {
  assert.deepEqual(view.calls.fields, []);
  assert.deepEqual(view.calls.stored, []);
  assert.deepEqual(view.data(), view.initial);
};
async function render(options = {}) {
  const calls = { fields: [], stored: [], routes: [], reads: [], animations: [], helperBuilds: [], helperInfers: [] };
  const scheme = options.scheme ?? "light";
  const params = options.params ?? {};
  const AuthContext = React.createContext({ isBootstrapping: false, isLoggedIn: false });
  const storage = new Map([["primerep.onboardingDraft.v1", JSON.stringify({ ...seed, ...options.data })], ["@primerep/theme-preference", scheme]]);
  const animated = {
    __esModule: true, default: { View: "AnimatedView", createAnimatedComponent: (component) => component },
    useSharedValue: (value) => React.useRef({ value }).current,
    useAnimatedStyle: (callback) => new Proxy({}, { get: (_, key) => callback()[key], ownKeys: () => Reflect.ownKeys(callback()), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }),
    withTiming: (value, config) => { calls.animations.push({ kind: "timing", value, config: plain(config) }); return value; },
    withDelay: (delay, value) => { calls.animations.push({ kind: "delay", delay }); return value; },
    withSequence: (...values) => { calls.animations.push({ kind: "sequence", values }); return values.at(-1); },
  };
  const mocks = {
    react: React, "react-native": { ...native, useColorScheme: () => scheme, useWindowDimensions: () => ({ width: options.width ?? 375, height: 812, fontScale: options.fontScale ?? 1 }) }, "react-native-reanimated": animated,
    "@/constants/theme": theme, "@/features/onboarding/constants": constants, "@/utils/authContext": { AuthContext },
    "expo-router": { router: { back: () => calls.routes.push("back"), canGoBack: () => options.canGoBack ?? true }, useLocalSearchParams: () => params },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }), SafeAreaView: "SafeAreaView" },
    "@react-native-async-storage/async-storage": {
      getItem: async (key) => { calls.reads.push(key); const captured = storage.get(key) ?? null; if (key === "primerep.onboardingDraft.v1" && options.restoreGate) await options.restoreGate; return captured; },
      setItem: async (key, value) => { calls.stored.push([key, value]); storage.set(key, value); },
      removeItem: async (key) => { calls.stored.push([key, null]); storage.delete(key); },
    },
    "@/features/onboarding/workout-split-helpers": {
      ...helpers,
      buildMuscleGroupsFromSplitSelection: (...args) => { calls.helperBuilds.push(args); return helpers.buildMuscleGroupsFromSplitSelection(...args); },
      inferSplitSelectionFromMuscleGroups: (...args) => { calls.helperInfers.push(plain(args)); return helpers.inferSplitSelectionFromMuscleGroups(...args); },
    },
  };
  for (const [alias, file] of [
    ["@/utils/appearanceContext", "utils/appearanceContext.tsx"], ["@/hooks/use-color-scheme", "hooks/use-color-scheme.ts"], ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"],
    ["@/components/themed-view", "components/themed-view.tsx"], ["@/components/animated-checkmark", "components/animated-checkmark.tsx"], ["@/utils/onboardingContext", "utils/onboardingContext.tsx"],
  ]) mocks[alias] = load(file, mocks);
  const { OnboardingContext, OnboardingProvider } = mocks["@/utils/onboardingContext"];
  const { AppearanceProvider, useAppearance } = mocks["@/utils/appearanceContext"];
  const { default: Screen } = load(route, mocks);
  let context, appearance;
  function RestoredScreen() {
    context = React.useContext(OnboardingContext);
    appearance = useAppearance();
    const auth = React.useContext(AuthContext);
    if ((!options.mountBeforeRestore && context.isRestoring) || !appearance.isReady || (options.hideCompletedAuth && auth.isLoggedIn && auth.hasCompletedOnboarding)) return null;
    const value = { ...context, updateField: (field, next) => { calls.fields.push([field, plain(next)]); context.updateField(field, next); } };
    return React.createElement(OnboardingContext.Provider, { value }, React.createElement(Screen));
  }
  let setAuth;
  function AuthBoundary() {
    const [auth, updateAuth] = React.useState({ isBootstrapping: false, isLoggedIn: false, hasCompletedOnboarding: false });
    setAuth = updateAuth;
    return React.createElement(AuthContext.Provider, { value: auth }, React.createElement(AppearanceProvider, null, React.createElement(OnboardingProvider, null, React.createElement(RestoredScreen))));
  }
  let tree;
  await act(async () => {
    const element = React.createElement(AuthBoundary);
    tree = create(options.strict ? React.createElement(React.StrictMode, null, element) : element);
  });
  const initial = plain(context.getOnboardingData());
  calls.stored.length = 0;
  const view = { tree, calls, params, initial, data: () => plain(context.getOnboardingData()), colors: theme.Colors[scheme], storage, appearance: () => appearance, restoring: () => context.isRestoring };
  view.restore = async (release) => { await act(async () => release()); assert.equal(context.isRestoring, false); view.initial = plain(context.getOnboardingData()); calls.stored.length = 0; };
  view.auth = async (next) => { await act(async () => setAuth((previous) => ({ ...previous, ...next }))); };
  return view;
}

for (const scheme of ["light", "dark"]) {
  test(`behavior: ${scheme} restores real providers, labels and disabled native Core without inputs`, async () => {
    const view = await render({ scheme });
    assert.ok(view.calls.reads.includes("primerep.onboardingDraft.v1"));
    assert.ok(view.calls.reads.includes("@primerep/theme-preference"));
    assert.equal(view.appearance().colorScheme, scheme);
    assert.equal(flat(view.tree.root.findAllByType("View")[0].props.style).backgroundColor, view.colors.background);
    for (const label of [content.title, content.description, ...content.tabs.map((item) => item.label), ...content.workoutSplitOptions.flatMap((item) => [item.title, item.description])]) assert.ok(view.tree.root.findAllByType("Text").some((node) => textOf(node) === label));
    assert.equal(core(view.tree).props.disabled, true);
    assert.equal(core(view.tree).props.value, false);
    assert.equal(view.tree.root.findAllByType("TextInput").length, 0);
    assert.equal(view.tree.root.findAllByType("KeyboardAvoidingView").length, 0);
    unchanged(view);
    await unmount(view);
  });
  test(`behavior: ${scheme} empty Add remains faded and enabled then dismisses without a write`, async () => {
    const view = await render({ scheme });
    assert.notEqual(action(view).props.disabled, true);
    assert.equal(flat(action(view).findByType("Text").props.style).opacity, 0.5);
    await tap(action(view));
    unchanged(view);
    assert.deepEqual(view.calls.routes, ["back"]);
    await unmount(view);
  });
  test(`behavior: ${scheme} each split adds its title and actual helper muscles with Core off and on`, async () => {
    for (const option of splits) for (const withCore of [false, true]) {
      const view = await render({ scheme, data: { customWorkouts: [custom] } });
      await tap(choice(view.tree, option.title));
      assert.equal(selected(choice(view.tree, option.title)), true);
      assert.equal(core(view.tree).props.disabled, false);
      if (withCore) await toggleCore(view, true);
      unchanged(view);
      await tap(action(view));
      const expected = { id: "workout-1900000000000", name: option.title, type: "workout-split", muscleGroups: plain(helpers.buildMuscleGroupsFromSplitSelection(option.id, withCore)) };
      assert.deepEqual(view.calls.fields, [["customWorkouts", [custom, expected]]]);
      assert.deepEqual(view.calls.helperBuilds, [[option.id, withCore]]);
      assert.deepEqual(view.data().customWorkouts, [custom, expected]);
      assert.deepEqual(view.calls.routes, ["back"]);
      assert.equal(view.data().preferredName, "Alex");
      assert.equal(view.data().notificationsEnabled, true);
      assert.equal(view.calls.stored.length, 1);
      assert.deepEqual(JSON.parse(view.calls.stored[0][1]), view.data());
      if (option.id === "full-body" && withCore) assert.equal(expected.muscleGroups.filter((id) => id === "abs").length, 1);
      await unmount(view);
    }
  });
  test(`behavior: ${scheme} split choices are exclusive, toggle off, and Core persists between different splits`, async () => {
    const view = await render({ scheme });
    await tap(choice(view.tree, "Push"));
    await toggleCore(view, true);
    await tap(choice(view.tree, "Pull"));
    assert.equal(selected(choice(view.tree, "Push")), false);
    assert.equal(selected(choice(view.tree, "Pull")), true);
    assert.equal(core(view.tree).props.value, true);
    await tap(choice(view.tree, "Pull"));
    assert.equal(core(view.tree).props.value, false);
    assert.equal(core(view.tree).props.disabled, true);
    for (const option of splits) assert.equal(selected(choice(view.tree, option.title)), false);
    unchanged(view);
    await unmount(view);
  });
  test(`behavior: ${scheme} Core row press is inert and native switch can toggle back off`, async () => {
    const view = await render({ scheme });
    await tap(choice(view.tree, "Core"));
    assert.equal(core(view.tree).props.value, false);
    await tap(choice(view.tree, "Legs"));
    await toggleCore(view, true);
    await tap(choice(view.tree, "Core"));
    assert.equal(core(view.tree).props.value, true);
    await toggleCore(view, false);
    assert.equal(core(view.tree).props.value, false);
    unchanged(view);
    await unmount(view);
  });
  test(`behavior: ${scheme} tabs retain independent unsaved split/Core and custom muscle drafts`, async () => {
    const view = await render({ scheme });
    await tap(choice(view.tree, "Upper body"));
    await toggleCore(view, true);
    await tab(view, "Custom");
    await tap(choice(view.tree, "Chest"));
    await tap(choice(view.tree, "Forearms"));
    await tab(view, "Workout split");
    assert.equal(selected(choice(view.tree, "Upper body")), true);
    assert.equal(core(view.tree).props.value, true);
    await tab(view, "Custom");
    assert.equal(selected(choice(view.tree, "Chest")), true);
    assert.equal(selected(choice(view.tree, "Forearms")), true);
    unchanged(view);
    await tap(action(view));
    assert.deepEqual(view.data().customWorkouts[0], { id: "workout-1900000000000", name: "Custom", type: "custom", muscleGroups: ["chest", "forearms"] });
    assert.deepEqual(view.calls.helperBuilds, []);
    await unmount(view);
  });
  test(`behavior: ${scheme} all 15 muscles independently toggle and a full selection has no cap`, async () => {
    const view = await render({ scheme });
    await tab(view, "Custom");
    assert.equal(muscles.length, 15);
    for (const muscle of muscles) {
      await tap(choice(view.tree, muscle.name));
      assert.equal(selected(choice(view.tree, muscle.name)), true);
      await tap(choice(view.tree, muscle.name));
      assert.equal(selected(choice(view.tree, muscle.name)), false);
      await tap(choice(view.tree, muscle.name));
    }
    for (const muscle of muscles) assert.equal(selected(choice(view.tree, muscle.name)), true);
    unchanged(view);
    await tap(action(view));
    assert.deepEqual(view.data().customWorkouts[0].muscleGroups, plain(muscles.map((item) => item.id)));
    assert.equal(view.data().customWorkouts[0].name, "Custom");
    await unmount(view);
  });
  test(`behavior: ${scheme} removing/reselecting a muscle keeps Set insertion order`, async () => {
    const view = await render({ scheme });
    await tab(view, "Custom");
    for (const name of ["Chest", "Back", "Biceps", "Back", "Back"]) await tap(choice(view.tree, name));
    await tap(action(view));
    assert.deepEqual(view.data().customWorkouts[0].muscleGroups, ["chest", "biceps", "back"]);
    await unmount(view);
  });
  test(`behavior: ${scheme} empty Custom Add dismisses without a mutation`, async () => {
    const view = await render({ scheme });
    await tab(view, "Custom");
    assert.notEqual(action(view).props.disabled, true);
    await tap(action(view));
    unchanged(view);
    assert.deepEqual(view.calls.routes, ["back"]);
    await unmount(view);
  });
  test(`behavior: ${scheme} every edit split preserves saved Core and pure initial/helper inference`, async () => {
    for (const option of splits) for (const withCore of [false, true]) {
      const saved = { ...existing, name: "Old label", muscleGroups: plain(helpers.buildMuscleGroupsFromSplitSelection(option.id, withCore)) };
      const view = await render({ scheme, data: { customWorkouts: [custom, saved] }, params: { workoutId: saved.id, workoutName: "Ignored route name", workoutType: "custom", muscleGroups: "ignored" } });
      assert.equal(selected(choice(view.tree, option.title)), true);
      assert.equal(core(view.tree).props.value, withCore);
      assert.deepEqual(view.calls.helperInfers, [[saved.muscleGroups], [saved.muscleGroups]]);
      unchanged(view);
      await tap(action(view));
      assert.deepEqual(view.data().customWorkouts, [custom, { ...saved, name: option.title, muscleGroups: plain(helpers.buildMuscleGroupsFromSplitSelection(option.id, withCore)) }]);
      assert.equal(view.calls.fields.length, 1);
      assert.deepEqual(view.calls.routes, ["back"]);
      await unmount(view);
    }
  });
  test(`behavior: ${scheme} editing custom preselects muscles and updates in place with derived name`, async () => {
    const view = await render({ scheme, data: { customWorkouts: [existing, custom] }, params: { workoutId: custom.id } });
    assert.equal(view.tree.root.findAllByType("Switch").length, 0);
    for (const muscle of muscles) assert.equal(selected(choice(view.tree, muscle.name)), custom.muscleGroups.includes(muscle.id));
    await tap(choice(view.tree, "Calves"));
    await tap(choice(view.tree, "Abs"));
    unchanged(view);
    await tap(action(view));
    assert.deepEqual(view.data().customWorkouts, [existing, { ...custom, name: "Custom", muscleGroups: ["quads", "abs"] }]);
    assert.deepEqual(view.calls.helperBuilds, []);
    assert.equal(view.calls.fields.length, 1);
    await unmount(view);
  });
  test(`behavior: ${scheme} saved split Core can be explicitly turned off and restored locally before Update`, async () => {
    const saved = { ...existing, muscleGroups: ["back", "biceps", "abs", "lower-back"] };
    const view = await render({ scheme, data: { customWorkouts: [custom, saved] }, params: { workoutId: saved.id } });
    assert.equal(core(view.tree).props.value, true);
    await toggleCore(view, false);
    assert.equal(core(view.tree).props.value, false);
    await toggleCore(view, true);
    unchanged(view);
    await tap(action(view));
    assert.deepEqual(view.data().customWorkouts, [custom, saved]);
    assert.deepEqual(view.calls.helperBuilds, [["pull", true]]);
    await unmount(view);
  });
  test(`behavior: ${scheme} changing edit type preserves ID and neighbor order`, async () => {
    const view = await render({ scheme, data: { customWorkouts: [existing, custom] }, params: { workoutId: existing.id } });
    await tab(view, "Custom");
    await tap(choice(view.tree, "Trapezius"));
    await tap(action(view));
    assert.deepEqual(view.data().customWorkouts, [{ id: existing.id, name: "Custom", type: "custom", muscleGroups: ["trapezius"] }, custom]);
    await unmount(view);
  });
  test(`behavior: ${scheme} cleared existing Update stays enabled and dismisses without writes`, async () => {
    for (const saved of [existing, custom]) {
      const view = await render({ scheme, data: { customWorkouts: [saved] }, params: { workoutId: saved.id } });
      if (saved.type === "custom") for (const id of saved.muscleGroups) await tap(choice(view.tree, muscles.find((item) => item.id === id).name));
      else await tap(choice(view.tree, "Pull"));
      assert.notEqual(action(view).props.disabled, true);
      assert.equal(flat(action(view).findByType("Text").props.style).opacity, 0.5);
      await tap(action(view));
      unchanged(view);
      assert.deepEqual(view.calls.routes, ["back"]);
      await unmount(view);
    }
  });
  test(`behavior: ${scheme} missing edit ID uses Update label and appends only with a selection`, async () => {
    for (const hasSelection of [false, true]) {
      const view = await render({ scheme, data: { customWorkouts: [existing] }, params: { workoutId: "missing", workoutName: "Ignored", workoutType: "custom", muscleGroups: "chest" } });
      assert.ok(action(view));
      assert.equal(core(view.tree).props.disabled, true);
      if (hasSelection) await tap(choice(view.tree, "Push"));
      await tap(action(view));
      if (hasSelection) assert.deepEqual(view.data().customWorkouts, [existing, { id: "workout-1900000000000", name: "Push", type: "workout-split", muscleGroups: ["chest", "shoulders", "triceps"] }]);
      else unchanged(view);
      assert.deepEqual(view.calls.routes, ["back"]);
      await unmount(view);
    }
  });
  test(`behavior: ${scheme} backdrop cancel and inner propagation preserve unsaved payload`, async () => {
    const view = await render({ scheme });
    await tap(choice(view.tree, "Legs"));
    let stopped = false;
    await act(async () => view.tree.root.findByType("TouchableWithoutFeedback").props.onPress({ stopPropagation: () => { stopped = true; } }));
    assert.equal(stopped, true);
    assert.deepEqual(view.calls.routes, []);
    const backdrop = controls(view.tree).find((node) => node.props.activeOpacity === 1 && flat(node.props.style).flex === 1);
    await tap(backdrop);
    unchanged(view);
    assert.deepEqual(view.calls.routes, ["back"]);
    await unmount(view);
    const noBack = await render({ scheme, canGoBack: false });
    assert.equal(controls(noBack.tree).find((node) => node.props.activeOpacity === 1 && flat(node.props.style).flex === 1).props.onPress, undefined);
    await tap(action(noBack));
    unchanged(noBack);
    assert.deepEqual(noBack.calls.routes, ["back"]);
    await unmount(noBack);
  });
  test(`behavior: ${scheme} remount discards local choices and retains the stored provider draft`, async () => {
    const view = await render({ scheme });
    await tap(choice(view.tree, "Push"));
    await toggleCore(view, true);
    await tab(view, "Custom");
    await tap(choice(view.tree, "Chest"));
    unchanged(view);
    const draft = JSON.parse(view.storage.get("primerep.onboardingDraft.v1"));
    await unmount(view);
    const fresh = await render({ scheme, data: draft });
    assert.equal(core(fresh.tree).props.disabled, true);
    assert.equal(core(fresh.tree).props.value, false);
    await tab(fresh, "Custom");
    for (const muscle of muscles) assert.equal(selected(choice(fresh.tree, muscle.name)), false);
    unchanged(fresh);
    await unmount(fresh);
  });
  test(`motion: ${scheme} modal delay/timing and real checkmark feedback retain original values`, async () => {
    const view = await render({ scheme });
    assert.deepEqual(view.calls.animations.filter((call) => call.kind === "delay"), [{ kind: "delay", delay: 100 }, { kind: "delay", delay: 100 }]);
    assert.ok(view.calls.animations.some((call) => call.kind === "timing" && call.value === 1 && call.config.duration === 300));
    assert.ok(view.calls.animations.some((call) => call.kind === "timing" && call.value === 0 && call.config.duration === 300));
    view.calls.animations.length = 0;
    await tap(choice(view.tree, "Push"));
    assert.deepEqual(view.calls.animations, [{ kind: "timing", value: 1.15, config: { duration: theme.AnimationTiming.fast } }, { kind: "timing", value: 1, config: { duration: theme.AnimationTiming.fast } }, { kind: "sequence", values: [1.15, 1] }]);
    await unmount(view);
  });
}

test("scope: reversing only the approved lazy initializer restores the exact original controller and whole route", () => {
  const input = source(route);
  const lazy = '  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(() => {\n    const splitId = editingWorkout?.type === "workout-split"\n      ? inferSplitSelectionFromMuscleGroups(editingWorkout.muscleGroups).splitId\n      : undefined;\n    return new Set(splitId ? [splitId] : []);\n  });';
  const previous = '  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(\n    new Set()\n  );';
  assert.equal(input.split(lazy).length, 2);
  assert.equal(sha(input), "4684c8d1bcc7bc6c8e18a7338258a9bff5e4f4270798d0b1e3ac29221f2f6e75");
  const restored = input.replace(lazy, previous);
  const controller = restored.slice(restored.indexOf("export default function"), restored.indexOf("\n  return ("));
  assert.equal(controller.length, 4922);
  assert.equal(sha(controller), "98fc19ab4e69f40751478ece21f2826a54967907ff5afadd450f28a300f8c58f");
  assert.equal(sha(restored), "83a76c1c20cd7dfa2fa65872cf5c8dcb488061ab88f78fb64d26fad8dbfff16b");
  assert.equal(sha(input.slice(0, input.indexOf("export default function"))), "68390b11cccf6dcb6244d9d39b68b9d933124909592e107a0437b7d7425aa5b0");
  assert.equal(sha(input.slice(input.indexOf("\n  return ("))), "5da0ccb748323bc5d5c78cc4c59b57d2263ed3aa53fa269ff34b7605a7c76dca");
  assert.equal(sha(original(route)), "83a76c1c20cd7dfa2fa65872cf5c8dcb488061ab88f78fb64d26fad8dbfff16b");
});
test("scope: only this modal's constant section and real helper mappings match baseline", () => {
  const baseline = load("features/onboarding/constants.ts", {}, original("features/onboarding/constants.ts"));
  assert.deepEqual(plain(content), plain(baseline.ADD_WORKOUT_MODAL));
  const baselineHelpers = load("features/onboarding/workout-split-helpers.ts", {}, original("features/onboarding/workout-split-helpers.ts"));
  assert.deepEqual(plain(helpers.WORKOUT_SPLIT_MUSCLE_GROUP_MAP), plain(baselineHelpers.WORKOUT_SPLIT_MUSCLE_GROUP_MAP));
  assert.equal(splits.length, 5);
  assert.equal(content.tabs.length, 2);
  assert.equal(muscles.length, 15);
});
test("appearance: live real-provider theme change preserves local selections and onboarding payload", async () => {
  const view = await render({ scheme: "light" });
  await tap(choice(view.tree, "Push"));
  await toggleCore(view, true);
  await act(async () => view.appearance().setPreference("dark"));
  assert.equal(view.appearance().colorScheme, "dark");
  assert.equal(flat(view.tree.root.findAllByType("View")[0].props.style).backgroundColor, theme.Colors.dark.background);
  assert.equal(selected(choice(view.tree, "Push")), true);
  assert.equal(core(view.tree).props.value, true);
  assert.deepEqual(view.data(), view.initial);
  assert.deepEqual(view.calls.fields, []);
  assert.deepEqual(view.calls.stored, [["@primerep/theme-preference", "dark"]]);
  assert.deepEqual(view.calls.routes, []);
  await unmount(view);
});

for (const scheme of ["light", "dark"]) for (const option of splits) test(`regression: ${scheme} editing ${option.id} preserves saved Core after passive effects`, async () => {
  const saved = { ...existing, muscleGroups: plain(helpers.buildMuscleGroupsFromSplitSelection(option.id, true)) };
  const view = await render({ scheme, data: { customWorkouts: [custom, saved] }, params: { workoutId: saved.id } });
  try {
    unchanged(view);
    assert.equal(selected(choice(view.tree, option.title)), true);
    assert.equal(core(view.tree).props.disabled, false);
    assert.equal(core(view.tree).props.value, true);
  } finally { await unmount(view); }
});

for (const scheme of ["light", "dark"]) test(`regression: ${scheme} unchanged Update preserves saved Core in the virtual provider payload`, async () => {
  const saved = { ...existing, name: "Push", muscleGroups: plain(helpers.buildMuscleGroupsFromSplitSelection("push", true)) };
  const view = await render({ scheme, data: { customWorkouts: [custom, saved] }, params: { workoutId: saved.id } });
  try {
    unchanged(view);
    await tap(action(view));
    assert.deepEqual(view.calls.fields, [["customWorkouts", [custom, saved]]]);
    assert.deepEqual(view.data().customWorkouts, [custom, saved]);
  } finally { await unmount(view); }
});

for (const scheme of ["light", "dark"]) test(`regression: ${scheme} StrictMode passive replay retains saved upper-body Core without a draft write`, async () => {
  const saved = { ...existing, muscleGroups: plain(helpers.buildMuscleGroupsFromSplitSelection("upper-body", true)) };
  const view = await render({ scheme, strict: true, data: { customWorkouts: [saved] }, params: { workoutId: saved.id } });
  try { unchanged(view); assert.equal(core(view.tree).props.value, true); }
  finally { await unmount(view); }
});

for (const scheme of ["light", "dark"]) for (const groups of [["abs", "lower-back"], ["unknown-muscle", "abs", "lower-back"]]) test(`invariant: ${scheme} unmatched saved split ${groups.join("+")} keeps Core off and empty Update inert`, async () => {
  const saved = { ...existing, muscleGroups: groups };
  const view = await render({ scheme, data: { customWorkouts: [custom, saved] }, params: { workoutId: saved.id } });
  try {
    assert.equal(helpers.inferSplitSelectionFromMuscleGroups(groups).splitId, undefined);
    for (const option of splits) assert.equal(selected(choice(view.tree, option.title)), false);
    assert.equal(core(view.tree).props.value, false); assert.equal(core(view.tree).props.disabled, true);
    assert.equal(flat(action(view).findByType("Text").props.style).opacity, 0.5); unchanged(view);
    await tap(action(view)); unchanged(view); assert.deepEqual(view.calls.routes, ["back"]);
  } finally { await unmount(view); }
});

for (const [mountBeforeRestore, strict] of [[false, false], [true, false], [true, true]]) test(`delayed actual provider restore mounted${Number(mountBeforeRestore)} strict${Number(strict)} preserves saved Core`, async () => {
  const gate = deferred(), saved = { ...existing, muscleGroups: plain(helpers.buildMuscleGroupsFromSplitSelection("upper-body", true)) };
  const view = await render({ scheme: strict ? "dark" : "light", restoreGate: gate.promise, mountBeforeRestore, strict, data: { customWorkouts: [custom, saved] }, params: { workoutId: saved.id } });
  try {
    assert.equal(view.restoring(), true);
    if (mountBeforeRestore) { assert.equal(core(view.tree).props.value, false); assert.equal(core(view.tree).props.disabled, true); }
    else assert.equal(view.tree.root.findAllByType("Switch").length, 0);
    await view.restore(gate.resolve);
    assert.equal(selected(choice(view.tree, "Upper body")), true); assert.equal(core(view.tree).props.value, true); unchanged(view);
  } finally { await unmount(view); }
});

for (const scheme of ["light", "dark"]) test(`batched ${scheme} double current other-option handler preserves empty-selection Core invariant`, async () => {
  const saved = { ...existing, muscleGroups: plain(helpers.buildMuscleGroupsFromSplitSelection("upper-body", true)) };
  const view = await render({ scheme, data: { customWorkouts: [saved] }, params: { workoutId: saved.id } });
  try {
    assert.equal(core(view.tree).props.value, true);
    const pull = choice(view.tree, "Pull"); await act(async () => { pull.props.onPress(); pull.props.onPress(); });
    for (const option of splits) assert.equal(selected(choice(view.tree, option.title)), false);
    assert.equal(core(view.tree).props.value, false); assert.equal(core(view.tree).props.disabled, true); unchanged(view);
  } finally { await unmount(view); }
});

for (const scheme of ["light", "dark"]) test(`saved Core ${scheme} explicit deselect/reselect, tabs and cancel retain existing semantics`, async () => {
  const saved = { ...existing, muscleGroups: plain(helpers.buildMuscleGroupsFromSplitSelection("upper-body", true)) };
  const view = await render({ scheme, data: { customWorkouts: [custom, saved] }, params: { workoutId: saved.id } });
  try {
    assert.equal(core(view.tree).props.value, true);
    await tap(choice(view.tree, "Upper body")); assert.equal(core(view.tree).props.disabled, true); assert.equal(core(view.tree).props.value, false);
    await tap(choice(view.tree, "Upper body")); assert.equal(core(view.tree).props.value, false);
    await toggleCore(view, true); await tap(choice(view.tree, "Pull")); assert.equal(core(view.tree).props.value, true);
    await tab(view, "Custom"); await tap(choice(view.tree, "Chest")); await tab(view, "Workout split"); assert.equal(selected(choice(view.tree, "Pull")), true); assert.equal(core(view.tree).props.value, true);
    const backdrop = controls(view.tree).find((node) => node.props.activeOpacity === 1 && flat(node.props.style).flex === 1); await tap(backdrop);
    unchanged(view); assert.deepEqual(view.calls.routes, ["back"]);
  } finally { await unmount(view); }
});

for (const scheme of ["light", "dark"]) test(`mock completed identity ${scheme} hides editor and rejects delayed prior guest restoration`, async () => {
  const gate = deferred(), saved = { ...existing, muscleGroups: plain(helpers.buildMuscleGroupsFromSplitSelection("upper-body", true)) };
  const view = await render({ scheme, restoreGate: gate.promise, mountBeforeRestore: true, hideCompletedAuth: true, data: { customWorkouts: [saved] }, params: { workoutId: saved.id } });
  try {
    assert.equal(view.tree.root.findAllByType("Switch").length, 1);
    await view.auth({ isLoggedIn: true, hasCompletedOnboarding: true }); assert.equal(view.tree.root.findAllByType("Switch").length, 0);
    await act(async () => gate.resolve());
    assert.deepEqual(view.data().customWorkouts, []); assert.deepEqual(view.calls.fields, []);
    assert.ok(view.calls.stored.some(([key, value]) => key === "primerep.onboardingDraft.v1" && value === null));
  } finally { await unmount(view); }
});

test("pure initializer inference is counted twice only on initial valid edit and does not mutate helper data", async () => {
  const saved = { ...existing, muscleGroups: plain(helpers.buildMuscleGroupsFromSplitSelection("upper-body", true)) }, mapping = plain(helpers.WORKOUT_SPLIT_MUSCLE_GROUP_MAP);
  const view = await render({ data: { customWorkouts: [saved] }, params: { workoutId: saved.id } });
  try {
    assert.deepEqual(view.calls.helperInfers, [[saved.muscleGroups], [saved.muscleGroups]]);
    await tap(choice(view.tree, "Pull")); await toggleCore(view, false);
    assert.deepEqual(view.calls.helperInfers, [[saved.muscleGroups], [saved.muscleGroups]]);
    assert.deepEqual(plain(helpers.WORKOUT_SPLIT_MUSCLE_GROUP_MAP), mapping); unchanged(view);
  } finally { await unmount(view); }
});
