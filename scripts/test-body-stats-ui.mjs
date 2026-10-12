import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
const base = "9f2811810329482b6871f11558f3e23c1bc1e65b";
const route = "app/onboarding/body-stats.tsx";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const original = (file) => execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" });
function load(file, mocks, input = source(file)) {
  const filename = path.join(root, file);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console: { ...console, warn() {} } }, { filename });
  return module.exports;
}
const native = {
  Pressable: "Pressable", TouchableOpacity: "TouchableOpacity", TouchableWithoutFeedback: "TouchableWithoutFeedback", KeyboardAvoidingView: "KeyboardAvoidingView", View: "View", Text: "Text", TextInput: "TextInput", ScrollView: "ScrollView",
  StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (values) => values.ios },
};
const theme = load("constants/theme.ts", { "react-native": native });
const constants = load("features/onboarding/constants.ts", {});
const content = constants.BODY_STATS_SCREEN;
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const button = (tree) => tree.root.findByType("Pressable");
const input = (tree, index) => tree.root.findAllByType("TextInput")[index];
const trigger = (tree) => tree.root.findAllByType("TouchableOpacity")[0];
const genderChoice = (tree, name) => tree.root.findAllByType("TouchableOpacity").find((node) => node !== trigger(tree) && (node.props.accessibilityLabel === name || textOf(node) === name));
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node) => flat(typeof node.props.style === "function" ? node.props.style({ pressed: false }) : node.props.style);
const plain = (value) => JSON.parse(JSON.stringify(value));
const unmount = async (tree) => { await act(async () => tree.unmount()); };
const change = async (tree, index, value) => { await act(async () => input(tree, index).props.onChangeText(value)); };
const toggle = async (view) => {
  const controls = view.tree.root.findAllByType("TouchableOpacity").filter((node) => ["LB", "KG"].includes(textOf(node)));
  const next = controls.find((node) => textOf(node) !== view.data().weightUnit) ?? controls[0];
  await act(async () => next.props.onPress());
};
async function body(options = {}) {
  const calls = { routes: [], fields: [], animations: [], stored: [], conversions: [], keyboard: 0 };
  const scheme = options.scheme ?? "light";
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
    react: React, "react-native": { ...native, Platform: { ...native.Platform, OS: options.platform ?? "ios" }, Keyboard: { dismiss: () => { calls.keyboard += 1; } } }, "react-native-reanimated": animated,
    "@/constants/theme": theme, "@/hooks/use-color-scheme": { useColorScheme: () => scheme }, "@/features/onboarding/constants": constants,
    "@/utils/authContext": { AuthContext }, "expo-router": { useRouter: () => ({ push: (value) => calls.routes.push(value) }) },
    "@react-native-async-storage/async-storage": { getItem: async () => JSON.stringify(options.data ?? { preferredName: "Alex", reason: "structure", selectedEquipment: ["barbell"] }), setItem: async (key, value) => calls.stored.push({ key, value }), removeItem: async () => {} },
  };
  for (const [alias, file] of [
    ["@/utils/weightConversion", "utils/weightConversion.ts"], ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"], ["@/hooks/use-screen-transition", "hooks/use-screen-transition.ts"],
    ["@/components/themed-view", "components/themed-view.tsx"], ["@/components/animated-button", "components/animated-button.tsx"], ["@/components/animated-input", "components/animated-input.tsx"],
    ["@/components/animated-card", "components/animated-card.tsx"], ["@/utils/onboardingContext", "utils/onboardingContext.tsx"],
  ]) mocks[alias] = load(file, mocks);
  const conversion = mocks["@/utils/weightConversion"].convertWeight;
  mocks["@/utils/weightConversion"] = { convertWeight: (...args) => { calls.conversions.push(args); return conversion(...args); } };
  const { OnboardingContext, OnboardingProvider } = mocks["@/utils/onboardingContext"];
  const { default: Screen } = load(route, mocks);
  let context;
  function RestoredScreen() {
    context = React.useContext(OnboardingContext);
    if (context.isRestoring) return null;
    const value = { ...context, updateField: (field, value) => { calls.fields.push([field, value]); context.updateField(field, value); } };
    return React.createElement(OnboardingContext.Provider, { value }, React.createElement(Screen));
  }
  let tree;
  await act(async () => { tree = create(React.createElement(OnboardingProvider, null, React.createElement(RestoredScreen))); });
  return { tree, calls, colors: theme.Colors[scheme], data: () => context.getOnboardingData(), update: (field, value) => context.updateField(field, value) };
}

for (const scheme of ["light", "dark"]) {
  test(`behavior: ${scheme} blank defaults retain required gating, labels and numeric keyboards`, async () => {
    const view = await body({ scheme });
    assert.ok(text(view.tree, content.manualSection.heading));
    for (const name of ["Gender", "Weight", "Age"]) assert.ok(text(view.tree, name));
    assert.equal(input(view.tree, 0).props.value, "");
    assert.equal(input(view.tree, 1).props.value, "");
    assert.equal(view.data().weightUnit, "LB");
    assert.equal(button(view.tree).props.disabled, true);
    for (const field of view.tree.root.findAllByType("TextInput")) assert.equal(field.props.keyboardType, "numeric");
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} every restored gender and truthy numeric prefill remain local`, async () => {
    for (const gender of content.genderOptions) {
      const view = await body({ scheme, data: { gender, weight: 81.6, weightUnit: "KG", age: 35 } });
      assert.equal(textOf(trigger(view.tree)).startsWith(gender), true);
      assert.equal(input(view.tree, 0).props.value, "81.6");
      assert.equal(input(view.tree, 1).props.value, "35");
      assert.equal(button(view.tree).props.disabled, false);
      assert.deepEqual(view.calls.fields, []);
      await unmount(view.tree);
    }
    const zero = await body({ scheme, data: { weight: 0, age: 0 } });
    assert.equal(input(zero.tree, 0).props.value, "");
    assert.equal(input(zero.tree, 1).props.value, "");
    await unmount(zero.tree);
  });
  test(`behavior: ${scheme} exact ordered gender options write once and close without changing unrelated fields`, async () => {
    const view = await body({ scheme });
    for (const selected of content.genderOptions) {
      await act(async () => trigger(view.tree).props.onPress());
      assert.deepEqual(view.tree.root.findAllByType("TouchableOpacity").filter((node) => node !== trigger(view.tree) && content.genderOptions.some((name) => node.props.accessibilityLabel === name || textOf(node) === name)).map((node) => node.props.accessibilityLabel ?? textOf(node)), Array.from(content.genderOptions));
      await act(async () => genderChoice(view.tree, selected).props.onPress());
      assert.equal(view.data().gender, selected);
      assert.equal(genderChoice(view.tree, selected), undefined);
      assert.equal(view.data().reason, "structure");
    }
    assert.deepEqual(view.calls.fields, Array.from(content.genderOptions, (name) => ["gender", name]));
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} weight retains strict Number validation, positive values and inclusive 700 bound`, async () => {
    for (const [value, expected] of [["0.01", 0.01], ["700", 700], [" 180.5 ", 180.5], ["1e2", 100], ["0x10", 16], ["", undefined], [" ", undefined], ["0", undefined], ["-1", undefined], ["701", undefined], ["Infinity", undefined], ["1e309", undefined], ["NaN", undefined], ["12abc", undefined]]) {
      const view = await body({ scheme });
      await change(view.tree, 0, value);
      assert.equal(view.data().weight, expected, value);
      assert.deepEqual(view.calls.fields, [["weight", expected]], value);
      assert.equal(view.data().weightUnit, "LB");
      assert.equal(button(view.tree).props.disabled, true);
      await unmount(view.tree);
    }
  });
  test(`behavior: ${scheme} invalid weight preserves the existing context-sync clearing transition`, async () => {
    const view = await body({ scheme, data: { gender: "Male", weight: 180, age: 35 } });
    await change(view.tree, 0, "12abc");
    assert.equal(view.data().weight, undefined);
    assert.equal(input(view.tree, 0).props.value, "");
    assert.equal(button(view.tree).props.disabled, true);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} age keeps exact integer bounds and each existing live error`, async () => {
    for (const [value, expected, error] of [["13", 13, null], ["120", 120, null], ["2e1", 20, null], [" 35 ", 35, null], ["", undefined, null], [" ", undefined, null], ["12", undefined, "You need to be at least 13 to use PrimeRep."], ["-1", undefined, "You need to be at least 13 to use PrimeRep."], ["121", undefined, "Enter an age between 13 and 120."], ["35.5", undefined, "Enter your age in whole years."], ["Infinity", undefined, "Enter your age in whole years."], ["NaN", undefined, "Enter your age in whole years."]]) {
      const view = await body({ scheme, data: { gender: "Other", weight: 180 } });
      await change(view.tree, 1, value);
      const field = input(view.tree, 1);
      assert.equal(view.data().age, expected, value);
      assert.deepEqual(view.calls.fields, [["age", expected]], value);
      assert.equal(field.props.value, value);
      assert.equal(field.props["aria-invalid"], Boolean(error));
      assert.equal(field.props.accessibilityHint, error ?? "Enter your age in whole years");
      if (error) assert.equal(text(view.tree, error).props.accessibilityLiveRegion, "polite");
      assert.equal(button(view.tree).props.disabled, expected === undefined);
      await unmount(view.tree);
    }
  });
  test(`behavior: ${scheme} unit conversion updates body plus all three maxima with original rounding`, async () => {
    const view = await body({ scheme, data: { gender: "Female", weight: 180, weightUnit: "LB", age: 35, benchPress1RM: 100, backSquat1RM: 225, deadlift1RM: 315, reason: "structure" } });
    await toggle(view);
    assert.deepEqual(view.calls.fields, [["weightUnit", "KG"], ["weight", 81.6], ["benchPress1RM", 45.4], ["backSquat1RM", 102.1], ["deadlift1RM", 142.9]]);
    assert.equal(input(view.tree, 0).props.value, "81.6");
    assert.equal(view.data().reason, "structure");
    view.calls.fields.length = 0;
    await toggle(view);
    assert.deepEqual(view.calls.fields, [["weightUnit", "LB"], ["weight", 179.9], ["benchPress1RM", 100.1], ["backSquat1RM", 225.1], ["deadlift1RM", 315]]);
    assert.equal(input(view.tree, 0).props.value, "179.9");
    assert.equal(JSON.parse(view.calls.stored.at(-1).value).weightUnit, "LB");
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} empty unit switch preserves undefined and nonnumeric maxima`, async () => {
    const view = await body({ scheme, data: { benchPress1RM: undefined, backSquat1RM: "draft", deadlift1RM: 0 } });
    await toggle(view);
    assert.deepEqual(view.calls.fields, [["weightUnit", "KG"], ["weight", undefined], ["benchPress1RM", undefined], ["backSquat1RM", "draft"], ["deadlift1RM", 0]]);
    assert.equal(input(view.tree, 0).props.value, "");
    assert.equal(view.data().age, undefined);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} provisional invalid unit switches keep parseFloat and rounded-zero semantics`, async () => {
    const partial = await body({ scheme });
    await change(partial.tree, 0, "12abc");
    assert.equal(input(partial.tree, 0).props.value, "12abc");
    partial.calls.fields.length = 0;
    await toggle(partial);
    assert.equal(partial.data().weight, 5.4);
    assert.equal(input(partial.tree, 0).props.value, "5.4");
    assert.equal(partial.calls.fields.length, 5);
    await unmount(partial.tree);
    const rounded = await body({ scheme, data: { gender: "Male", age: 35, weight: 0.01 } });
    await toggle(rounded);
    assert.equal(rounded.data().weight, 0);
    assert.equal(input(rounded.tree, 0).props.value, "");
    assert.equal(button(rounded.tree).props.disabled, true);
    await unmount(rounded.tree);
  });
  test(`behavior: ${scheme} context changes synchronize only weight/unit and remount restores all fields`, async () => {
    const view = await body({ scheme, data: { gender: "Male", age: 35, weight: 180 } });
    await act(async () => { view.update("weight", 82); view.update("weightUnit", "KG"); view.update("gender", "Female"); view.update("age", 40); });
    assert.equal(input(view.tree, 0).props.value, "82");
    assert.equal(input(view.tree, 1).props.value, "35");
    assert.equal(textOf(trigger(view.tree)).startsWith("Male"), true);
    assert.deepEqual(view.calls.fields, []);
    const snapshot = plain(view.data());
    await unmount(view.tree);
    const restored = await body({ scheme, data: snapshot });
    assert.equal(input(restored.tree, 0).props.value, "82");
    assert.equal(input(restored.tree, 1).props.value, "40");
    assert.equal(textOf(trigger(restored.tree)).startsWith("Female"), true);
    await unmount(restored.tree);
  });
  test(`behavior: ${scheme} Continue guards every missing/invalid field and preserves exact valid route`, async () => {
    for (const data of [{}, { gender: "Male", weight: 180 }, { weight: 180, age: 35 }, { gender: "Other", weight: 701, age: 35 }, { gender: "Female", weight: 180, age: 12 }]) {
      const view = await body({ scheme, data });
      await act(async () => button(view.tree).props.onPress());
      assert.equal(button(view.tree).props.disabled, true);
      assert.deepEqual(view.calls.routes, []);
      await unmount(view.tree);
    }
    const valid = await body({ scheme, data: { gender: "Prefer not to say", weight: 700, age: 120 } });
    for (let i = 0; i < 2; i++) await act(async () => button(valid.tree).props.onPress());
    assert.deepEqual(valid.calls.routes, ["/onboarding/fitness-experience", "/onboarding/fitness-experience"]);
    assert.deepEqual(valid.calls.fields, []);
    await unmount(valid.tree);
  });
  test(`behavior: ${scheme} background dismiss closes the picker and keeps iOS keyboard settings`, async () => {
    const view = await body({ scheme });
    await act(async () => trigger(view.tree).props.onPress());
    assert.ok(genderChoice(view.tree, "Male"));
    await act(async () => view.tree.root.findByType("TouchableWithoutFeedback").props.onPress());
    assert.equal(view.calls.keyboard, 1);
    assert.equal(genderChoice(view.tree, "Male"), undefined);
    assert.equal(view.tree.root.findByType("KeyboardAvoidingView").props.behavior, "padding");
    assert.equal(view.tree.root.findByType("KeyboardAvoidingView").props.keyboardVerticalOffset, 100);
    assert.equal(view.tree.root.findByType("ScrollView").props.keyboardShouldPersistTaps, "handled");
    assert.deepEqual(view.calls.fields, []);
    await unmount(view.tree);
  });
  test(`motion: ${scheme} real cards, controller, input and button retain original timing`, async () => {
    const view = await body({ scheme });
    assert.deepEqual(view.calls.animations.filter((call) => call.kind === "delay").map((call) => call.delay).sort((a, b) => a - b), [0, 0, 0, 0, 200, 200, 500, 500]);
    assert.equal(view.calls.animations.filter((call) => call.kind === "timing" && call.config.duration === 400).length, 4);
    assert.equal(view.calls.animations.filter((call) => call.kind === "timing" && call.config.duration === 250).length, 6);
    await act(async () => input(view.tree, 0).props.onFocus({ nativeEvent: {} }));
    await act(async () => input(view.tree, 0).props.onBlur({ nativeEvent: {} }));
    assert.ok(view.calls.animations.some((call) => call.kind === "timing" && call.value === 0.6 && call.config.duration === 250));
    await act(async () => button(view.tree).props.onPressIn({ nativeEvent: {} }));
    assert.equal(styleOf(button(view.tree)).transform[0].scale, 0.96);
    await act(async () => button(view.tree).props.onPressOut({ nativeEvent: {} }));
    assert.equal(styleOf(button(view.tree)).transform[0].scale, 1);
    for (const call of view.calls.animations) assert.equal(call.reduceMotion ?? call.config?.reduceMotion, undefined);
    await unmount(view.tree);
  });
}

test("behavior: Android retains keyboard height behavior and zero offset", async () => {
  const view = await body({ platform: "android" });
  assert.equal(view.tree.root.findByType("KeyboardAvoidingView").props.behavior, "height");
  assert.equal(view.tree.root.findByType("KeyboardAvoidingView").props.keyboardVerticalOffset, 0);
  await unmount(view.tree);
});
test("scope: complete body imports/controller and motion stay byte-identical", () => {
  const controller = (input) => input.slice(0, input.indexOf("\n  return ("));
  assert.equal(controller(source(route)), controller(original(route)));
});
test("scope: only the approved body description may change in its own content object", () => {
  const baseline = plain(load("features/onboarding/constants.ts", {}, original("features/onboarding/constants.ts")).BODY_STATS_SCREEN);
  const current = plain(content);
  assert.ok([baseline.manualSection.description, "We use gender, weight and age to personalise your workouts."].includes(current.manualSection.description));
  current.manualSection.description = baseline.manualSection.description;
  assert.deepEqual(current, baseline);
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
for (const scheme of ["light", "dark"]) {
  test(`presentation: ${scheme} factual copy, neutral helper and system text grow naturally`, async () => {
    const view = await body({ scheme });
    assert.equal(textOf(host(view.tree, "body-stats-description")), "We use gender, weight and age to personalise your workouts.");
    assert.equal(styleOf(host(view.tree, "body-stats-description")).color, view.colors.icon);
    assert.ok(contrast(view.colors.icon, view.colors.background) >= 4.5);
    const heading = styleOf(host(view.tree, "body-stats-heading"));
    assert.equal(heading.fontSize, 26);
    assert.equal(heading.fontWeight, "600");
    for (const node of view.tree.root.findAllByType("Text")) {
      assert.equal(styleOf(node).fontFamily, theme.Fonts.sans);
      for (const property of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(node.props[property], undefined);
      assert.notEqual(node.props.allowFontScaling, false);
      for (const property of ["lineHeight", "height", "textTransform"]) assert.equal(styleOf(node)[property], undefined);
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} gender exposes expanded choices and a neutral selected check`, async () => {
    const view = await body({ scheme, data: { gender: "Other" } });
    const control = host(view.tree, "body-stats-gender");
    assert.equal(control.props.accessibilityRole, "button");
    assert.equal(control.props.accessibilityLabel, "Gender, Other");
    assert.equal(control.props.accessibilityState.expanded, false);
    assert.ok(styleOf(control).minHeight >= 44);
    await act(async () => control.props.onPress());
    assert.equal(control.props.accessibilityState.expanded, true);
    const inner = control.findByType("View");
    assert.equal(styleOf(inner).borderColor, view.colors.text);
    assert.ok(styleOf(inner).minHeight >= 56);
    for (const [index, name] of content.genderOptions.entries()) {
      const row = host(view.tree, `body-stats-gender-option-${index}`);
      assert.equal(row.props.accessibilityRole, "radio");
      assert.equal(row.props.accessibilityLabel, name);
      assert.deepEqual(plain(row.props.accessibilityState), { selected: name === "Other", checked: name === "Other" });
      assert.ok(styleOf(row).minHeight >= 44);
      assert.equal(styleOf(row.findByType("Text")).color, view.colors.text);
      const decoration = row.findAllByType("View")[0];
      assert.equal(decoration.props.accessibilityElementsHidden, true);
      assert.equal(decoration.props.importantForAccessibility, "no-hide-descendants");
      assert.equal(decoration.findAllByType("View").length, name === "Other" ? 2 : 1);
      if (name === "Other") assert.equal(styleOf(decoration.findAllByType("View")[1]).borderColor, view.colors.text);
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} unit segments preserve selected no-ops and convert each value exactly once`, async () => {
    const view = await body({ scheme, data: { weight: 180, benchPress1RM: 100, backSquat1RM: 225, deadlift1RM: 315 } });
    for (const selected of ["LB", "KG"]) {
      const row = host(view.tree, `body-stats-unit-${selected.toLowerCase()}`);
      assert.equal(row.props.accessibilityRole, "button");
      assert.equal(row.props.accessibilityState.selected, true);
      assert.equal(styleOf(row).backgroundColor, view.colors.inputBorder);
      assert.ok(styleOf(row).minHeight >= 44);
      assert.equal(styleOf(row.findByType("Text")).color, view.colors.text);
      assert.ok(contrast(view.colors.text, view.colors.inputBorder) >= 4.5);
      view.calls.fields.length = 0;
      view.calls.conversions.length = 0;
      await act(async () => row.props.onPress());
      assert.deepEqual(view.calls.fields, []);
      assert.deepEqual(view.calls.conversions, []);
      const requested = selected === "LB" ? "KG" : "LB";
      const other = host(view.tree, `body-stats-unit-${requested.toLowerCase()}`);
      assert.equal(other.props.accessibilityLabel, `Use ${requested === "LB" ? "pounds" : "kilograms"} for body weight and one-rep maxes`);
      await act(async () => other.props.onPress());
      assert.equal(view.calls.fields.length, 5);
      assert.equal(view.calls.conversions.length, 4);
      assert.deepEqual(view.calls.conversions.map((args) => args.slice(1)), Array.from({ length: 4 }, () => [selected, requested]));
      assert.equal(view.data().weightUnit, requested);
      assert.equal(other.props.accessibilityState.selected, true);
      assert.equal(row.props.accessibilityState.selected, false);
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} full-width named inputs reuse neutral focus and semantic age errors`, async () => {
    const view = await body({ scheme });
    const danger = scheme === "dark" ? "#FF8B82" : "#B42318";
    for (const [index, name] of [[0, "Weight in pounds"], [1, "Age"]]) {
      const field = () => input(view.tree, index);
      assert.equal(field().props.accessibilityLabel, name);
      assert.equal(styleOf(field()).width, "100%");
      assert.ok(styleOf(field()).minHeight >= 56);
      await act(async () => field().props.onFocus({ nativeEvent: {} }));
      assert.equal(styleOf(field()).borderColor, view.colors.text);
      assert.equal(styleOf(field()).borderWidth, 2);
      assert.equal(styleOf(field()).shadowOpacity, 0);
      assert.equal(styleOf(field()).elevation, 0);
      await act(async () => field().props.onBlur({ nativeEvent: {} }));
      assert.equal(styleOf(field()).borderColor, view.colors.inputBorder);
    }
    await toggle(view);
    assert.equal(input(view.tree, 0).props.accessibilityLabel, "Weight in kilograms");
    await change(view.tree, 1, "12");
    assert.equal(input(view.tree, 1).props["aria-invalid"], true);
    assert.equal(styleOf(input(view.tree, 1)).borderColor, danger);
    assert.equal(styleOf(host(view.tree, "body-stats-age-error")).color, danger);
    assert.ok(contrast(danger, view.colors.background) >= 4.5);
    assert.equal(host(view.tree, "body-stats-age-error").props.accessibilityLiveRegion, "polite");
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} actual Continue has natural 56-point sizing and owns enabled purple`, async () => {
    const view = await body({ scheme });
    const action = button(view.tree);
    assert.equal(action.props.testID, "body-stats-continue");
    assert.equal(action.props.accessibilityRole, "button");
    assert.equal(action.props.accessibilityLabel, "Continue");
    assert.equal(textOf(action), "Continue");
    assert.ok(styleOf(action).minHeight >= 56);
    assert.equal(styleOf(action).flexShrink, 0);
    assert.equal(styleOf(action).backgroundColor, view.colors.inputBackground);
    assert.equal(styleOf(action).borderColor, view.colors.inputBorder);
    assert.equal(styleOf(action.findByType("Text")).color, view.colors.icon);
    assert.equal(styleOf(action.findByType("Text")).alignSelf, "stretch");
    assert.equal(styleOf(action.findByType("Text")).textAlign, "center");
    await act(async () => trigger(view.tree).props.onPress());
    await act(async () => genderChoice(view.tree, "Male").props.onPress());
    await change(view.tree, 0, "180");
    await change(view.tree, 1, "35");
    assert.equal(styleOf(action).backgroundColor, view.colors.primaryButton);
    assert.ok(contrast(styleOf(action.findByType("Text")).color, view.colors.primaryButton) >= 4.5);
    assert.equal(action.props.accessibilityState.disabled, false);
    for (const node of view.tree.root.findAll((node) => typeof node.type === "string")) {
      for (const property of ["color", "backgroundColor", "borderColor"]) if (styleOf(node)[property] === view.colors.primaryButton) assert.equal(node.props.testID, "body-stats-continue");
    }
    await unmount(view.tree);
  });
}
test("presentation: content-only dismissal lives inside the inset scroller and Continue remains its KAV sibling on both platforms", async () => {
  for (const platform of ["ios", "android"]) {
    const view = await body({ platform });
    const scroll = host(view.tree, "body-stats-scroll");
    const footer = host(view.tree, "body-stats-footer");
    const dismiss = view.tree.root.findByType("TouchableWithoutFeedback");
    const avoiding = view.tree.root.findByType("KeyboardAvoidingView");
    assert.equal(scroll.parent, avoiding);
    assert.equal(footer.parent, avoiding);
    assert.equal(dismiss.parent, scroll);
    assert.equal(dismiss.props.accessible, false);
    assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
    assert.equal(scroll.props.keyboardShouldPersistTaps, "handled");
    assert.equal(scroll.props.keyboardDismissMode, "on-drag");
    assert.equal(styleOf(scroll).flex, 1);
    assert.equal(flat(scroll.props.contentContainerStyle).flexGrow, 1);
    assert.ok(host(dismiss, "body-stats-age-input"));
    assert.ok(host(dismiss, "body-stats-weight-input"));
    assert.equal(host(scroll, "body-stats-continue"), undefined);
    for (const node of [footer, button(view.tree)]) for (const property of ["height", "position", "overflow"]) assert.equal(styleOf(node)[property], undefined);
    assert.equal(avoiding.props.behavior, platform === "ios" ? "padding" : "height");
    assert.equal(avoiding.props.keyboardVerticalOffset, platform === "ios" ? 100 : 0);
    await unmount(view.tree);
  }
});
