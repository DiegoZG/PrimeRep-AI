import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
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
const base = "6ffc2364bf5203127b71829f4c527583b6063460";
const route = "app/onboarding/workout-split/custom.tsx";
const baseline = process.argv.includes("--baseline");
const source = (file) => readFileSync(path.join(root, file), "utf8");
const original = (file) => execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" });
const routeSource = baseline ? original(route) : source(route);
function load(file, mocks, input = source(file)) {
  const filename = path.join(root, file);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), process: { env: {} }, console: { ...console, warn() {} } }, { filename });
  return module.exports;
}
const native = {
  Pressable: "Pressable", TouchableOpacity: "TouchableOpacity", View: "View", Text: "Text", ScrollView: "ScrollView",
  StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (values) => values.ios },
};
const theme = load("constants/theme.ts", { "react-native": native });
const constants = load("features/onboarding/constants.ts", {});
const content = constants.CUSTOM_SPLIT_SCREEN;
const muscles = Array.from(constants.ADD_WORKOUT_MODAL.customMuscleGroups);
const draftKey = "primerep.onboardingDraft.v1";
const themeKey = "@primerep/theme-preference";
const modal = "/onboarding/workout-split/add-workout-modal";
const validation = "Add at least one workout day to continue.";
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const controls = (tree) => tree.root.findAll((node) => ["Pressable", "TouchableOpacity"].includes(node.type));
const continueButton = (tree) => controls(tree).find((node) => textOf(node).toLowerCase() === "continue");
const addButton = (tree) => controls(tree).find((node) => textOf(node).toLowerCase() === "add workout");
const removeButton = (tree, name) => controls(tree).find((node) => node.props.accessibilityLabel === `Remove ${name}` || node.props.accessibilityLabel?.startsWith(`Remove ${name}, workout `));
const editButtons = (tree) => controls(tree).filter((node) => node !== continueButton(tree) && node !== addButton(tree) && !node.props.accessibilityLabel?.startsWith("Remove "));
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node) => flat(typeof node.props.style === "function" ? node.props.style({ pressed: false }) : node.props.style);
const plain = (value) => JSON.parse(JSON.stringify(value));
const press = async (node) => { await act(async () => node.props.onPress()); };
const userPress = async (node) => { if (!node.props.disabled) await press(node); };
const unmount = async (tree) => { await act(async () => tree.unmount()); };
const workouts = [
  { id: "day-a", name: "Upper body", type: "workout-split", muscleGroups: ["chest", "back", "shoulders", "biceps", "triceps"] },
  { id: "day-b", name: "Legs and core", type: "custom", muscleGroups: ["quads", "glutes", "lower-back", "abs", "future-muscle"] },
  { id: "day-c", name: "Recovery accessories", type: "custom", muscleGroups: ["calves", "forearms"] },
];
const unrelated = {
  preferredName: "Alex", lastName: "Rivera", email: "alex@example.test", age: 35, gender: "Other", weight: 82, weightUnit: "KG", reason: "structure", fitnessGoal: "build-muscle", experienceLevel: "advanced", workoutFrequency: 7,
  workoutSplit: "upper-lower", varietyLevel: "balanced", trainingPlace: "garage-gym", selectedEquipment: ["barbell", "dumbbell"], dumbbellWeights: [5, 10], plateWeights: [2.5, 20], preferredWorkoutTime: "18:30", notificationsEnabled: true,
  benchPress1RM: 100, backSquat1RM: 150, deadlift1RM: 180, extensionField: { nested: ["preserve", 17] },
};
async function custom(options = {}) {
  const calls = { routes: [], fields: [], animations: [], stored: [], reads: [], removed: [] };
  const scheme = options.scheme ?? "light";
  const storage = options.storage ?? new Map([[draftKey, JSON.stringify(options.data ?? { ...unrelated, customWorkouts: [] })], [themeKey, scheme]]);
  const animated = {
    __esModule: true, default: { View: "AnimatedView", createAnimatedComponent: (component) => component },
    useSharedValue: (value) => React.useRef({ value }).current,
    useAnimatedStyle: (callback) => new Proxy({}, { get: (_, key) => callback()[key], ownKeys: () => Reflect.ownKeys(callback()), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }),
    withTiming: (value, config) => { calls.animations.push({ kind: "timing", value, config }); return value; },
    withDelay: (delay, value, reduceMotion) => { calls.animations.push({ kind: "delay", delay, reduceMotion }); return value; },
    withSpring: (value, config) => { calls.animations.push({ kind: "spring", value, config }); return value; },
  };
  const AuthContext = React.createContext({ isBootstrapping: false, isLoggedIn: false });
  const mocks = {
    react: React, "react-native": { ...native, useColorScheme: () => options.systemScheme ?? scheme, PixelRatio: { getFontScale: () => options.fontScale ?? 1 } }, "react-native-reanimated": animated,
    "@expo/vector-icons": { Ionicons: "Ionicons" }, "@/constants/theme": theme, "@/features/onboarding/constants": constants, "@/utils/authContext": { AuthContext },
    "@react-native-async-storage/async-storage": {
      getItem: async (key) => { calls.reads.push(key); return storage.get(key) ?? null; },
      setItem: async (key, value) => { calls.stored.push({ key, value }); storage.set(key, value); },
      removeItem: async (key) => { calls.removed.push(key); storage.delete(key); },
    },
    "expo-router": { useRouter: () => ({ push: (value) => calls.routes.push(value) }) },
  };
  for (const [alias, file] of [
    ["@/utils/appearanceContext", "utils/appearanceContext.tsx"], ["@/hooks/use-color-scheme", "hooks/use-color-scheme.ts"], ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"],
    ["@/hooks/use-screen-transition", "hooks/use-screen-transition.ts"], ["@/components/themed-view", "components/themed-view.tsx"], ["@/components/animated-button", "components/animated-button.tsx"], ["@/utils/onboardingContext", "utils/onboardingContext.tsx"],
  ]) mocks[alias] = load(file, mocks);
  const { OnboardingContext, OnboardingProvider } = mocks["@/utils/onboardingContext"];
  const { AppearanceProvider, useAppearance } = mocks["@/utils/appearanceContext"];
  const { default: Screen } = load(route, mocks, routeSource);
  let context, appearance, remount;
  function RestoredScreen() {
    context = React.useContext(OnboardingContext);
    appearance = useAppearance();
    const [generation, setGeneration] = React.useState(0);
    remount = () => setGeneration((value) => value + 1);
    if (context.isRestoring || !appearance.isReady) return null;
    const value = { ...context, updateField: (field, next) => { calls.fields.push([field, next]); context.updateField(field, next); } };
    return React.createElement(OnboardingContext.Provider, { value }, React.createElement(Screen, { key: generation }));
  }
  let tree;
  await act(async () => { tree = create(React.createElement(AppearanceProvider, null, React.createElement(OnboardingProvider, null, React.createElement(RestoredScreen)))); });
  return { tree, calls, storage, colors: theme.Colors[scheme], data: () => context.getOnboardingData(), update: (field, value) => context.updateField(field, value), remount: () => remount(), appearance: () => appearance };
}

for (const scheme of ["light", "dark"]) {
  test(`behavior: ${scheme} restored empty or omitted workouts gate the actual button without writes`, async () => {
    for (const data of [{ ...unrelated }, { ...unrelated, customWorkouts: [] }]) {
      const view = await custom({ scheme, data });
      assert.ok(text(view.tree, content.question));
      assert.ok(text(view.tree, content.description));
      assert.equal(continueButton(view.tree).props.disabled, true);
      assert.equal(continueButton(view.tree).props.accessibilityState.disabled, true);
      assert.equal(text(view.tree, validation).props.accessibilityLiveRegion, "polite");
      await userPress(continueButton(view.tree));
      assert.deepEqual(view.calls.fields, []);
      assert.deepEqual(view.calls.routes, []);
      assert.equal(editButtons(view.tree).length, 0);
      await unmount(view.tree);
    }
  });
  test(`behavior: ${scheme} directly invoked empty Continue preserves the existing ungated controller`, async () => {
    const view = await custom({ scheme });
    const before = plain(view.data());
    await press(continueButton(view.tree));
    assert.deepEqual(view.calls.fields, [["workoutSplit", "custom"]]);
    assert.deepEqual(view.calls.routes, ["/onboarding/variety-level"]);
    assert.deepEqual(plain(view.data()), { ...before, workoutSplit: "custom" });
    assert.equal(continueButton(view.tree).props.disabled, true);
    assert.ok(text(view.tree, validation));
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} Add from empty or populated lists routes exactly without data writes`, async () => {
    for (const days of [[], workouts]) {
      const view = await custom({ scheme, data: { ...unrelated, customWorkouts: days } });
      const before = plain(view.data());
      const writes = view.calls.stored.length;
      await press(addButton(view.tree));
      await press(addButton(view.tree));
      assert.deepEqual(view.calls.routes, [modal, modal]);
      assert.deepEqual(view.calls.fields, []);
      assert.deepEqual(plain(view.data()), before);
      assert.equal(view.calls.stored.length, writes);
      await unmount(view.tree);
    }
  });
  test(`behavior: ${scheme} each edit retains exact ID/name/type/comma-separated muscle parameters`, async () => {
    const view = await custom({ scheme, data: { ...unrelated, customWorkouts: workouts } });
    const before = plain(view.data());
    const writes = view.calls.stored.length;
    for (const [index, day] of workouts.entries()) {
      assert.ok(text(view.tree, `${day.name} - Workout ${index + 1}`));
      await press(editButtons(view.tree)[index]);
    }
    assert.deepEqual(plain(view.calls.routes), workouts.map((day) => ({ pathname: modal, params: { workoutId: day.id, workoutName: day.name, workoutType: day.type, muscleGroups: day.muscleGroups.join(",") } })));
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(plain(view.data()), before);
    assert.equal(view.calls.stored.length, writes);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} equal names retain ID-based edit and removal behavior`, async () => {
    const sameName = workouts.map((day) => ({ ...day, name: "Same name" }));
    const view = await custom({ scheme, data: { customWorkouts: sameName } });
    await press(editButtons(view.tree)[1]);
    assert.equal(view.calls.routes[0].params.workoutId, "day-b");
    const removals = controls(view.tree).filter((node) => node.props.accessibilityLabel?.startsWith("Remove Same name"));
    await press(removals[1]);
    assert.deepEqual(plain(view.data().customWorkouts).map((day) => day.id), ["day-a", "day-c"]);
    await press(editButtons(view.tree)[0]);
    assert.equal(view.calls.routes[1].params.workoutId, "day-a");
    assert.equal(editButtons(view.tree).length, 2);
    assert.deepEqual(plain(view.calls.fields), [["customWorkouts", [sameName[0], sameName[2]]]]);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} removing a middle ID keeps order, all unrelated fields and renumbers cards`, async () => {
    const view = await custom({ scheme, data: { ...unrelated, customWorkouts: workouts } });
    const before = plain(view.data());
    await press(removeButton(view.tree, workouts[1].name));
    const expected = [workouts[0], workouts[2]];
    assert.deepEqual(plain(view.calls.fields), [["customWorkouts", expected]]);
    assert.deepEqual(plain(view.data()), { ...before, customWorkouts: expected });
    assert.deepEqual(view.calls.routes, []);
    assert.ok(text(view.tree, `${workouts[2].name} - Workout 2`));
    assert.equal(text(view.tree, `${workouts[1].name} - Workout 2`), undefined);
    assert.equal(continueButton(view.tree).props.disabled, false);
    assert.equal(text(view.tree, validation), undefined);
    assert.deepEqual(JSON.parse(view.storage.get(draftKey)), plain(view.data()));
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} deleting the last day restores validation and disabled button without changing split`, async () => {
    const view = await custom({ scheme, data: { ...unrelated, customWorkouts: [workouts[0]] } });
    const before = plain(view.data());
    await press(removeButton(view.tree, workouts[0].name));
    assert.deepEqual(plain(view.data()), { ...before, customWorkouts: [] });
    assert.deepEqual(plain(view.calls.fields), [["customWorkouts", []]]);
    assert.equal(continueButton(view.tree).props.disabled, true);
    assert.equal(continueButton(view.tree).props.accessibilityState.disabled, true);
    assert.ok(text(view.tree, validation));
    await userPress(continueButton(view.tree));
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} one or many days enable Continue regardless of frequency and retain order`, async () => {
    const many = Array.from({ length: 9 }, (_, index) => ({ ...workouts[index % 3], id: `ordered-${index}` }));
    for (const [days, frequency] of [[[workouts[0]], undefined], [[workouts[1]], 7], [many, 1]]) {
      const view = await custom({ scheme, data: { ...unrelated, workoutFrequency: frequency, customWorkouts: days } });
      const before = plain(view.data());
      assert.equal(editButtons(view.tree).length, days.length);
      assert.equal(continueButton(view.tree).props.disabled, false);
      assert.equal(continueButton(view.tree).props.accessibilityState.disabled, false);
      assert.equal(text(view.tree, validation), undefined);
      await userPress(continueButton(view.tree));
      await userPress(continueButton(view.tree));
      assert.deepEqual(view.calls.fields, [["workoutSplit", "custom"], ["workoutSplit", "custom"]]);
      assert.deepEqual(view.calls.routes, ["/onboarding/variety-level", "/onboarding/variety-level"]);
      assert.deepEqual(plain(view.data()), { ...before, workoutSplit: "custom" });
      assert.deepEqual(JSON.parse(view.storage.get(draftKey)), plain(view.data()));
      await unmount(view.tree);
    }
  });
  test(`behavior: ${scheme} every muscle label and unknown-ID fallback remain in original order`, async () => {
    const ids = [...muscles.map((muscle) => muscle.id), "future-muscle"];
    const view = await custom({ scheme, data: { customWorkouts: [{ ...workouts[0], muscleGroups: ids }] } });
    const expected = [...muscles.map((muscle) => muscle.name), "future-muscle"].join(", ");
    assert.ok(text(view.tree, expected));
    await press(editButtons(view.tree)[0]);
    assert.equal(view.calls.routes[0].params.muscleGroups, ids.join(","));
    assert.deepEqual(plain(view.data().customWorkouts[0].muscleGroups), ids);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} modal-return context updates, route remount and full provider restore retain edits`, async () => {
    const view = await custom({ scheme });
    await act(async () => view.update("customWorkouts", workouts));
    assert.equal(continueButton(view.tree).props.disabled, false);
    const edited = workouts.map((day, index) => index === 1 ? { ...day, name: "Edited name", muscleGroups: ["back", "future-muscle"] } : day);
    await act(async () => view.update("customWorkouts", edited));
    await act(async () => view.remount());
    assert.ok(text(view.tree, "Edited name - Workout 2"));
    await press(editButtons(view.tree)[1]);
    assert.deepEqual(plain(view.calls.routes[0].params), { workoutId: "day-b", workoutName: "Edited name", workoutType: "custom", muscleGroups: "back,future-muscle" });
    await press(removeButton(view.tree, workouts[0].name));
    await press(continueButton(view.tree));
    const snapshot = plain(view.data());
    assert.deepEqual(JSON.parse(view.storage.get(draftKey)), snapshot);
    await unmount(view.tree);
    const restored = await custom({ scheme, storage: view.storage });
    assert.deepEqual(plain(restored.data()), snapshot);
    assert.ok(text(restored.tree, "Edited name - Workout 1"));
    assert.equal(continueButton(restored.tree).props.disabled, false);
    assert.deepEqual(restored.calls.fields, []);
    assert.deepEqual(restored.calls.routes, []);
    await unmount(restored.tree);
  });
  test(`behavior: ${scheme} real Appearance provider controls theme and persists changes without touching onboarding`, async () => {
    const view = await custom({ scheme, systemScheme: scheme === "light" ? "dark" : "light" });
    const before = plain(view.data());
    assert.equal(view.appearance().colorScheme, scheme);
    assert.equal(styleOf(text(view.tree, content.question)).color, view.colors.text);
    const next = scheme === "light" ? "dark" : "light";
    await act(async () => view.appearance().setPreference(next));
    assert.equal(view.storage.get(themeKey), next);
    assert.equal(view.appearance().colorScheme, next);
    assert.equal(styleOf(text(view.tree, content.question)).color, theme.Colors[next].text);
    assert.deepEqual(plain(view.data()), before);
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    assert.ok(view.calls.reads.includes(draftKey));
    assert.ok(view.calls.reads.includes(themeKey));
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} existing screen/question/description/add timings and button spring remain exact`, async () => {
    const view = await custom({ scheme });
    const timing = view.calls.animations.filter((call) => call.kind === "timing");
    assert.deepEqual(plain(timing), [
      { kind: "timing", value: 1, config: { duration: 250 } }, { kind: "timing", value: 0, config: { duration: 250 } },
      ...Array.from({ length: 3 }, () => [{ kind: "timing", value: 1, config: { duration: 400 } }, { kind: "timing", value: 0, config: { duration: 400 } }]).flat(),
    ]);
    assert.deepEqual(view.calls.animations.filter((call) => call.kind === "delay").map((call) => call.delay), [200, 200, 400, 400, 600, 600]);
    await act(async () => addButton(view.tree).props.onPressIn({ nativeEvent: {} }));
    assert.equal(styleOf(addButton(view.tree)).transform[0].scale, 0.96);
    await act(async () => addButton(view.tree).props.onPressOut({ nativeEvent: {} }));
    assert.equal(styleOf(addButton(view.tree)).transform[0].scale, 1);
    assert.deepEqual(plain(view.calls.animations.filter((call) => call.kind === "spring")), [{ kind: "spring", value: 0.96, config: { damping: 15, stiffness: 300 } }, { kind: "spring", value: 1, config: { damping: 15, stiffness: 300 } }]);
    for (const call of view.calls.animations) assert.equal(call.reduceMotion ?? call.config?.reduceMotion, undefined);
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
}

test("scope: own 3021-byte controller remains exactly frozen without constraining other screens", () => {
  const controller = (input) => input.slice(input.indexOf("export default function CustomSplitScreen()"), input.indexOf("\n  return ("));
  const current = controller(source(route));
  assert.equal(Buffer.byteLength(current), 3021);
  assert.equal(createHash("sha256").update(current).digest("hex"), "61e7252e9c440aa5486341ac04d404a1bcf9b486ce9213b9f7d72fe0a2209b75");
  assert.equal(current, controller(original(route)));
});
test("scope: only the Custom Split content object remains frozen", () => {
  const prior = load("features/onboarding/constants.ts", {}, original("features/onboarding/constants.ts"));
  assert.deepEqual(plain(content), plain(prior.CUSTOM_SPLIT_SCREEN));
});

const host = (tree, id) => (tree.root ?? tree).findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const luminance = (hex) => {
  const value = hex.replace("#", "");
  const expanded = value.length === 3 ? [...value].map((digit) => digit + digit).join("") : value;
  const channels = [0, 2, 4].map((start) => parseInt(expanded.slice(start, start + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
};
if (!baseline) {
  for (const scheme of ["light", "dark"]) {
    test(`presentation: ${scheme} factual copy uses readable native typography without scaling or line caps`, async () => {
      const view = await custom({ scheme, data: { ...unrelated, customWorkouts: workouts } });
      const heading = host(view.tree, "custom-split-heading");
      assert.equal(textOf(heading), content.question);
      assert.equal(styleOf(heading).fontSize, 26);
      assert.equal(styleOf(heading).fontWeight, "600");
      const helper = host(view.tree, "custom-split-description");
      assert.equal(textOf(helper), content.description);
      assert.equal(styleOf(helper).color, view.colors.icon);
      assert.ok(contrast(styleOf(helper).color, view.colors.background) >= 4.5);
      for (const node of view.tree.root.findAllByType("Text")) {
        assert.equal(styleOf(node).fontFamily, theme.Fonts.sans);
        for (const property of ["lineHeight", "height", "textTransform"]) assert.equal(styleOf(node)[property], undefined);
        for (const property of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(node.props[property], undefined);
        assert.notEqual(node.props.allowFontScaling, false);
      }
      await unmount(view.tree);
    });
    test(`presentation: ${scheme} long muscle lists use legible text with the exact unknown-ID fallback`, async () => {
      const ids = [...muscles.map((muscle) => muscle.id), "future-muscle-with-a-long-name"];
      const view = await custom({ scheme, data: { customWorkouts: [{ ...workouts[0], muscleGroups: ids }] } });
      const labels = host(view.tree, "custom-split-muscles-day-a");
      assert.equal(textOf(labels), [...muscles.map((muscle) => muscle.name), ids.at(-1)].join(", "));
      assert.equal(styleOf(labels).fontSize, 15);
      assert.equal(styleOf(labels).color, view.colors.icon);
      assert.ok(contrast(styleOf(labels).color, view.colors.inputBackground) >= 4.5);
      assert.equal(labels.props.selectable, true);
      assert.equal(view.tree.root.findAllByType("Text").some((node) => textOf(node) === "?"), false);
      await unmount(view.tree);
    });
    test(`presentation: ${scheme} duplicate long titles have distinct named 44-point targets and press feedback`, async () => {
      const name = "Upper body strength and accessories with an intentionally long workout name";
      const days = workouts.slice(0, 2).map((day) => ({ ...day, name }));
      const view = await custom({ scheme, data: { customWorkouts: days } });
      const title = host(view.tree, "custom-split-title-day-a");
      assert.equal(textOf(title), `${name} - Workout 1`);
      assert.equal(styleOf(title).flex, 1);
      assert.equal(styleOf(title).minWidth, 0);
      const edit = host(view.tree, "custom-split-edit-day-a");
      const remove = host(view.tree, "custom-split-remove-day-a");
      for (const [index, day] of days.entries()) {
        for (const action of ["Edit", "Remove"]) {
          const control = host(view.tree, `custom-split-${action.toLowerCase()}-${day.id}`);
          assert.equal(control.props.accessibilityRole, "button");
          assert.equal(control.props.accessibilityLabel, `${action} ${name}, workout ${index + 1}`);
          assert.ok(styleOf(control).minHeight >= 44);
          assert.equal(control.findAll((node) => typeof node.type === "string" && ["Pressable", "TouchableOpacity"].includes(node.type)).length, 1);
          assert.equal(typeof control.props.style, "function");
          assert.equal(flat(control.props.style({ pressed: true })).opacity, 0.7);
          assert.equal(flat(control.props.style({ pressed: false })).opacity, 1);
        }
      }
      assert.ok(styleOf(remove).minWidth >= 44);
      assert.equal(edit.findAll((node) => node === remove).length, 0);
      assert.equal(remove.findAll((node) => node === edit).length, 0);
      assert.equal(textOf(edit).endsWith("Edit workout"), true);
      await press(edit);
      assert.equal(view.calls.routes[0].params.workoutName, name);
      await press(remove);
      assert.deepEqual(plain(view.data().customWorkouts), [days[1]]);
      await unmount(view.tree);
    });
    test(`presentation: ${scheme} Add workout is a named neutral 56-point action with readable text`, async () => {
      const view = await custom({ scheme });
      const add = addButton(view.tree);
      assert.equal(add.props.testID, "custom-split-add");
      assert.equal(add.props.accessibilityRole, "button");
      assert.equal(add.props.accessibilityLabel, "Add workout");
      assert.equal(textOf(add), "Add workout");
      assert.ok(styleOf(add).minHeight >= 56);
      assert.equal(styleOf(add).backgroundColor, view.colors.inputBackground);
      assert.equal(styleOf(add).borderColor, view.colors.inputBorder);
      assert.equal(styleOf(add.findByType("Text")).color, view.colors.text);
      assert.ok(contrast(styleOf(add.findByType("Text")).color, styleOf(add).backgroundColor) >= 4.5);
      await unmount(view.tree);
    });
    test(`presentation: ${scheme} Continue owns enabled purple and empty validation uses readable semantic color`, async () => {
      const view = await custom({ scheme });
      const action = continueButton(view.tree);
      assert.equal(action.props.testID, "custom-split-continue");
      assert.equal(action.props.accessibilityRole, "button");
      assert.equal(action.props.accessibilityLabel, "Continue");
      assert.equal(textOf(action), "Continue");
      assert.ok(styleOf(action).minHeight >= 56);
      assert.equal(styleOf(action).backgroundColor, view.colors.inputBackground);
      assert.equal(styleOf(action).borderColor, view.colors.inputBorder);
      assert.equal(styleOf(action).opacity, undefined);
      const label = action.findByType("Text");
      assert.equal(styleOf(label).color, view.colors.icon);
      assert.equal(styleOf(label).alignSelf, "stretch");
      assert.equal(styleOf(label).textAlign, "center");
      const error = host(view.tree, "custom-split-validation");
      assert.equal(textOf(error), validation);
      assert.equal(error.props.accessibilityLiveRegion, "polite");
      assert.equal(styleOf(error).color, scheme === "dark" ? "#FF8B82" : "#B42318");
      assert.ok(contrast(styleOf(error).color, view.colors.background) >= 4.5);
      await act(async () => view.update("customWorkouts", workouts));
      assert.equal(styleOf(action).backgroundColor, view.colors.primaryButton);
      assert.ok(contrast(styleOf(action.findByType("Text")).color, view.colors.primaryButton) >= 4.5);
      for (const node of view.tree.root.findAll((node) => typeof node.type === "string")) {
        for (const property of ["color", "backgroundColor", "borderColor"]) if (styleOf(node)[property] === view.colors.primaryButton) assert.equal(node.props.testID, "custom-split-continue");
      }
      await unmount(view.tree);
    });
  }
  test("presentation: an inset-aware growing scroller contains all cards, Add and Continue without clipping", async () => {
    for (const count of [0, 1, 9]) {
      const days = Array.from({ length: count }, (_, index) => ({ ...workouts[index % 3], id: `ordered-${index}` }));
      const view = await custom({ data: { customWorkouts: days } });
      const scroll = host(view.tree, "custom-split-scroll");
      assert.equal(scroll.type, "ScrollView");
      assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
      assert.equal(styleOf(scroll).flex, 1);
      assert.equal(flat(scroll.props.contentContainerStyle).flexGrow, 1);
      assert.ok(host(scroll, "custom-split-add"));
      assert.ok(host(scroll, "custom-split-continue"));
      assert.equal(editButtons(view.tree).length, count);
      for (const node of [scroll, host(view.tree, "custom-split-footer"), continueButton(view.tree), ...editButtons(view.tree)]) {
        for (const property of ["height", "position", "overflow"]) assert.equal(styleOf(node)[property], undefined);
      }
      await unmount(view.tree);
    }
  });
}
