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
const base = "e68e9de49bca3965e4c6d0b0e26cb9c6ed1fda1e";
const route = "app/onboarding/fitness-experience/one-rep-max.tsx";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const original = (file) => execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" });
function load(file, mocks, input = source(file), probes = {}) {
  const filename = path.join(root, file);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), process: { env: {} }, console: { ...console, warn() {} }, ...probes }, { filename });
  return module.exports;
}
const native = {
  Pressable: "Pressable", TouchableOpacity: "TouchableOpacity", TouchableWithoutFeedback: "TouchableWithoutFeedback", KeyboardAvoidingView: "KeyboardAvoidingView", View: "View", Text: "Text", TextInput: "TextInput", ScrollView: "ScrollView",
  StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (values) => values.ios },
};
const theme = load("constants/theme.ts", { "react-native": native });
const constants = load("features/onboarding/constants.ts", {});
const content = constants.ONE_REP_MAX_SCREEN;
const exercises = Array.from(content.exercises);
const fields = ["benchPress1RM", "backSquat1RM", "deadlift1RM"];
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const button = (tree) => tree.root.findByType("Pressable");
const input = (tree, index) => tree.root.findAllByType("TextInput")[index];
const unit = (tree, value) => tree.root.findAllByType("TouchableOpacity").find((node) => textOf(node) === value);
const calculator = (tree) => tree.root.findAllByType("TouchableOpacity").find((node) => node.props.accessibilityLabel === "Open one-rep max calculator");
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node) => flat(node.props.style);
const plain = (value) => JSON.parse(JSON.stringify(value));
const unmount = async (tree) => { await act(async () => tree.unmount()); };
async function oneRepMax(options = {}) {
  const calls = { routes: [], fields: [], animations: [], stored: [], keyboard: 0 };
  const scheme = options.scheme ?? "light";
  const platform = options.platform ?? "ios";
  const animated = {
    __esModule: true,
    default: { View: "AnimatedView", createAnimatedComponent: (component) => component },
    useSharedValue: (value) => React.useRef({ value }).current,
    useAnimatedStyle: (callback) => new Proxy({}, {
      get: (_, key) => callback()[key], ownKeys: () => Reflect.ownKeys(callback()),
      getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
    }),
    withTiming: (value, config) => { calls.animations.push({ kind: "timing", value, config }); return value; },
    withDelay: (delay, value, reduceMotion) => { calls.animations.push({ kind: "delay", delay, reduceMotion }); return value; },
    withSpring: (value, config) => { calls.animations.push({ kind: "spring", value, config }); return value; },
  };
  const AuthContext = React.createContext({ isBootstrapping: false, isLoggedIn: false });
  const mocks = {
    react: React, "react-native": { ...native, Platform: { ...native.Platform, OS: platform }, PixelRatio: { getFontScale: () => options.fontScale ?? 1 }, Keyboard: { dismiss: () => { calls.keyboard += 1; } } }, "react-native-reanimated": animated,
    "@/constants/theme": theme, "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@/features/onboarding/constants": constants, "@/utils/authContext": { AuthContext },
    "@expo/vector-icons/Entypo": { __esModule: true, default: "Entypo" },
    "@react-native-async-storage/async-storage": { getItem: async () => JSON.stringify(options.data ?? { preferredName: "Diego", weightUnit: "LB", experienceLevel: "advanced", reason: "structure", selectedEquipment: ["barbell"] }), setItem: async (key, value) => calls.stored.push({ key, value }), removeItem: async () => {} },
    "expo-router": { useRouter: () => ({ push: (value) => calls.routes.push(value) }) },
  };
  for (const [alias, file] of [
    ["@/utils/weightConversion", "utils/weightConversion.ts"],
    ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"],
    ["@/hooks/use-screen-transition", "hooks/use-screen-transition.ts"],
    ["@/components/themed-view", "components/themed-view.tsx"],
    ["@/components/animated-button", "components/animated-button.tsx"],
    ["@/components/animated-input", "components/animated-input.tsx"],
    ["@/utils/onboardingContext", "utils/onboardingContext.tsx"],
  ]) mocks[alias] = load(file, mocks);
  const { OnboardingContext, OnboardingProvider } = mocks["@/utils/onboardingContext"];
  let handlers;
  const instrumented = source(route).replace("\n  return (", "\n  captureController({ handleOpenCalculator });\n  return (");
  const { default: Screen } = load(route, mocks, instrumented, { captureController: (value) => { handlers = value; } });
  let context;
  function RestoredScreen() {
    context = React.useContext(OnboardingContext);
    if (context.isRestoring) return null;
    const value = { ...context, updateField: (field, value) => { calls.fields.push([field, value]); context.updateField(field, value); } };
    return React.createElement(OnboardingContext.Provider, { value }, React.createElement(Screen));
  }
  let tree;
  await act(async () => { tree = create(React.createElement(OnboardingProvider, null, React.createElement(RestoredScreen))); });
  return { tree, calls, colors: theme.Colors[scheme], data: () => context.getOnboardingData(), apply: (value) => context.updateMultipleFields(value), calculatorHandler: (...args) => handlers.handleOpenCalculator(...args) };
}

for (const scheme of ["light", "dark"]) {
  test(`behavior: ${scheme} question, helper, calculator, exercise order and empty inputs retain their original content`, async () => {
    const view = await oneRepMax({ scheme });
    for (const value of [content.question, content.description, content.calculatorSection.heading]) assert.ok(text(view.tree, value));
    const names = view.tree.root.findAllByType("Text").map(textOf).filter((value) => exercises.some((exercise) => exercise.name === value));
    assert.deepEqual(names, exercises.map((exercise) => exercise.name));
    for (let index = 0; index < 3; index += 1) {
      assert.equal(input(view.tree, index).props.value, "");
      assert.equal(input(view.tree, index).props.keyboardType, "numeric");
    }
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
  for (const [index, field] of fields.entries()) {
    test(`behavior: ${scheme} ${field} writes only its positive decimal and upper-bound value`, async () => {
      const view = await oneRepMax({ scheme });
      const before = plain(view.data());
      await act(async () => input(view.tree, index).props.onChangeText("100.5"));
      assert.deepEqual(view.calls.fields, [[field, 100.5]]);
      assert.deepEqual(plain(view.data()), { ...before, [field]: 100.5 });
      assert.equal(input(view.tree, index).props.value, "100.5");
      await act(async () => input(view.tree, index).props.onChangeText("1500"));
      assert.deepEqual(view.calls.fields.at(-1), [field, 1500]);
      assert.equal(JSON.parse(view.calls.stored.at(-1).value)[field], 1500);
      await unmount(view.tree);
    });
    test(`behavior: ${scheme} ${field} keeps existing empty, zero, negative, over-limit and partial parseFloat semantics`, async () => {
      for (const [typed, expected, displayed] of [["", undefined, ""], ["0", undefined, "0"], ["-5", undefined, "-5"], ["1501", undefined, "1501"], [".", undefined, "."], ["invalid", undefined, "invalid"], ["100.5kg", 100.5, "100.5"]]) {
        const view = await oneRepMax({ scheme });
        await act(async () => input(view.tree, index).props.onChangeText(typed));
        assert.deepEqual(view.calls.fields, [[field, expected]]);
        assert.equal(view.data()[field], expected);
        assert.equal(input(view.tree, index).props.value, displayed);
        await unmount(view.tree);
      }
    });
  }
  test(`behavior: ${scheme} restored values and external calculator context updates sync all three inputs`, async () => {
    const view = await oneRepMax({ scheme, data: { weightUnit: "KG", benchPress1RM: 100, backSquat1RM: 140, deadlift1RM: 180, reason: "structure" } });
    assert.deepEqual([0, 1, 2].map((index) => input(view.tree, index).props.value), ["100", "140", "180"]);
    await act(async () => view.apply({ benchPress1RM: 113, backSquat1RM: 0, deadlift1RM: undefined }));
    assert.deepEqual([0, 1, 2].map((index) => input(view.tree, index).props.value), ["113", "", ""]);
    assert.equal(view.data().weightUnit, "KG");
    assert.equal(view.data().reason, "structure");
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} LB to KG and back keeps original body-weight and three-max rounding`, async () => {
    const view = await oneRepMax({ scheme, data: { weightUnit: "LB", weight: 220.5, benchPress1RM: 225, backSquat1RM: 315, deadlift1RM: 405, reason: "structure" } });
    await act(async () => unit(view.tree, "KG").props.onPress());
    assert.deepEqual(view.calls.fields, [["weightUnit", "KG"], ["weight", 100], ["benchPress1RM", 102.1], ["backSquat1RM", 142.9], ["deadlift1RM", 183.7]]);
    assert.deepEqual([0, 1, 2].map((index) => input(view.tree, index).props.value), ["102.1", "142.9", "183.7"]);
    await act(async () => unit(view.tree, "LB").props.onPress());
    assert.deepEqual(view.calls.fields.slice(-5), [["weightUnit", "LB"], ["weight", 220.5], ["benchPress1RM", 225.1], ["backSquat1RM", 315], ["deadlift1RM", 405]]);
    assert.equal(view.data().reason, "structure");
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} KG to LB converts body weight and all three restored maxima`, async () => {
    const view = await oneRepMax({ scheme, data: { weightUnit: "KG", weight: 70, benchPress1RM: 100, backSquat1RM: 140, deadlift1RM: 180 } });
    await act(async () => unit(view.tree, "LB").props.onPress());
    assert.deepEqual(view.calls.fields, [["weightUnit", "LB"], ["weight", 154.3], ["benchPress1RM", 220.5], ["backSquat1RM", 308.6], ["deadlift1RM", 396.8]]);
    assert.deepEqual([0, 1, 2].map((index) => input(view.tree, index).props.value), ["220.5", "308.6", "396.8"]);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} selecting the current unit does not rewrite context or persistence`, async () => {
    const view = await oneRepMax({ scheme, data: { weightUnit: "KG", weight: 70, benchPress1RM: 100 } });
    const before = plain(view.data());
    const writes = view.calls.stored.length;
    await act(async () => unit(view.tree, "KG").props.onPress());
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(plain(view.data()), before);
    assert.equal(view.calls.stored.length, writes);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} unit switching preserves existing optional and provisional invalid-field conversion semantics`, async () => {
    const view = await oneRepMax({ scheme });
    for (const [index, value] of [[0, "-5"], [1, "0"], [2, "1501"]]) await act(async () => input(view.tree, index).props.onChangeText(value));
    view.calls.fields.length = 0;
    await act(async () => unit(view.tree, "KG").props.onPress());
    assert.deepEqual(view.calls.fields, [["weightUnit", "KG"], ["weight", undefined], ["benchPress1RM", -5], ["backSquat1RM", undefined], ["deadlift1RM", 680.8]]);
    assert.deepEqual([0, 1, 2].map((index) => input(view.tree, index).props.value), ["-5", "", "680.8"]);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} optional blank maxima still allow repeated exact Fitness Goal navigation`, async () => {
    const view = await oneRepMax({ scheme });
    const before = plain(view.data());
    assert.equal(button(view.tree).props.disabled ?? false, false);
    for (let count = 0; count < 2; count += 1) await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.routes, ["/onboarding/fitness-goal", "/onboarding/fitness-goal"]);
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(plain(view.data()), before);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} the visible calculator and actual optional exercise handler keep their existing URLs`, async () => {
    const view = await oneRepMax({ scheme });
    await act(async () => calculator(view.tree).props.onPress());
    for (const exercise of exercises) await act(async () => view.calculatorHandler(exercise.id));
    assert.deepEqual(view.calls.routes, ["/onboarding/fitness-experience/calculator-modal", ...exercises.map((exercise) => `/onboarding/fitness-experience/calculator-modal?exercise=${exercise.id}`)]);
    assert.deepEqual(view.calls.fields, []);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} existing background dismissal and iOS keyboard avoidance remain wired`, async () => {
    const view = await oneRepMax({ scheme });
    const avoiding = view.tree.root.findByType("KeyboardAvoidingView");
    assert.equal(avoiding.props.behavior, "padding");
    assert.equal(avoiding.props.keyboardVerticalOffset, 100);
    assert.equal(view.tree.root.findByType("ScrollView").props.keyboardShouldPersistTaps, "handled");
    await act(async () => view.tree.root.findByType("TouchableWithoutFeedback").props.onPress());
    assert.equal(view.calls.keyboard, 1);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
  test(`motion: ${scheme} real screen, input focus and button keep their system-default configurations`, async () => {
    const view = await oneRepMax({ scheme });
    assert.deepEqual(view.calls.animations.filter((call) => call.kind === "delay").map((call) => call.delay).sort((a, b) => a - b), [200, 200, 400, 400, 600, 600, 800, 800]);
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

test("behavior: existing Android keyboard height behavior and zero offset remain unchanged", async () => {
  const view = await oneRepMax({ platform: "android" });
  const avoiding = view.tree.root.findByType("KeyboardAvoidingView");
  assert.equal(avoiding.props.behavior, "height");
  assert.equal(avoiding.props.keyboardVerticalOffset, 0);
  await unmount(view.tree);
});

test("scope: complete One Rep Max controller, conversion, validation, motion and its own content remain byte-identical", () => {
  const controller = (input) => input.slice(input.indexOf("export default function OneRepMaxScreen()"), input.indexOf("\n  return ("));
  assert.equal(controller(source(route)), controller(original(route)));
  assert.equal(JSON.stringify(content), JSON.stringify(load("features/onboarding/constants.ts", {}, original("features/onboarding/constants.ts")).ONE_REP_MAX_SCREEN));
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
  test(`presentation: ${scheme} calculator is neutral and units expose gray selected segments with readable labels`, async () => {
    const view = await oneRepMax({ scheme });
    const control = host(view.tree, "one-rep-max-calculator");
    assert.equal(control.props.accessibilityRole, "button");
    assert.equal(control.props.accessibilityLabel, "Open one-rep max calculator");
    assert.ok(styleOf(control).minHeight >= 44);
    assert.ok(styleOf(control).minWidth >= 44);
    assert.equal(styleOf(control).backgroundColor, view.colors.inputBackground);
    assert.equal(styleOf(control).borderColor, view.colors.inputBorder);
    const icon = control.findByType("Entypo");
    assert.equal(icon.props.color, view.colors.text);
    assert.equal(icon.parent.props.accessible, false);
    assert.equal(icon.parent.props.accessibilityElementsHidden, true);
    assert.equal(icon.parent.props.importantForAccessibility, "no-hide-descendants");
    for (const selected of ["LB", "KG"]) {
      await act(async () => unit(view.tree, selected).props.onPress());
      for (const value of ["LB", "KG"]) {
        const segment = host(view.tree, `one-rep-max-unit-${value}`);
        assert.equal(segment.props.accessibilityRole, "button");
        assert.equal(segment.props.accessibilityLabel, `Use ${value === "LB" ? "pounds" : "kilograms"} for body weight and one-rep maxes`);
        assert.equal(segment.props.accessibilityState.selected, value === selected);
        assert.ok(styleOf(segment).minHeight >= 44);
        assert.equal(styleOf(segment).backgroundColor, value === selected ? view.colors.inputBorder : undefined);
        assert.equal(styleOf(segment.findByType("Text")).color, view.colors.text);
        assert.ok(contrast(view.colors.text, value === selected ? view.colors.inputBorder : view.colors.inputBackground) >= 4.5);
      }
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} all three individually named inputs reuse real neutral focus and update their unit names`, async () => {
    const view = await oneRepMax({ scheme });
    for (const selected of ["LB", "KG"]) {
      await act(async () => unit(view.tree, selected).props.onPress());
      for (const [index, exercise] of exercises.entries()) {
        const field = host(view.tree, `one-rep-max-input-${exercise.id}`);
        assert.equal(field.props.accessibilityLabel, `${exercise.name} one-rep max, ${selected === "LB" ? "pounds" : "kilograms"}`);
        assert.equal(field.props.keyboardType, "numeric");
        assert.equal(field.parent.props.authPresentation, true);
        assert.equal(field.props.placeholderTextColor, view.colors.icon);
        await act(async () => field.props.onFocus({ nativeEvent: {} }));
        assert.equal(styleOf(input(view.tree, index)).borderColor, view.colors.text);
        assert.equal(styleOf(input(view.tree, index)).borderWidth, 2);
        assert.equal(styleOf(input(view.tree, index)).shadowOpacity, 0);
        assert.equal(styleOf(input(view.tree, index)).elevation, 0);
        await act(async () => field.props.onBlur({ nativeEvent: {} }));
        assert.equal(styleOf(input(view.tree, index)).borderColor, view.colors.inputBorder);
        assert.equal(styleOf(input(view.tree, index)).borderWidth, 1);
      }
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} the background does not merge controls and optional Continue is a keyboard-aware in-flow sibling`, async () => {
    const view = await oneRepMax({ scheme });
    const dismiss = view.tree.root.findByType("TouchableWithoutFeedback");
    assert.equal(dismiss.props.accessible, false);
    const scroll = host(view.tree, "one-rep-max-scroll");
    assert.equal(dismiss.parent, scroll);
    assert.ok(host(dismiss, "one-rep-max-question"));
    assert.ok(host(dismiss, "one-rep-max-input-bench-press"));
    assert.equal(host(dismiss, "one-rep-max-continue"), undefined);
    assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
    assert.equal(scroll.props.keyboardShouldPersistTaps, "handled");
    assert.equal(scroll.props.keyboardDismissMode, "on-drag");
    assert.equal(flat(scroll.props.contentContainerStyle).flexGrow, 1);
    assert.equal(flat(scroll.props.contentContainerStyle).flex, undefined);
    assert.equal(styleOf(scroll).flex, 1);
    for (const id of ["one-rep-max-question", "one-rep-max-description", "one-rep-max-calculator", ...exercises.map((exercise) => `one-rep-max-input-${exercise.id}`)]) assert.ok(host(scroll, id));
    const action = button(view.tree);
    const footer = action.parent.parent;
    assert.equal(host(scroll, "one-rep-max-continue"), undefined);
    assert.equal(footer.parent, scroll.parent);
    assert.equal(scroll.parent.type, "View");
    assert.equal(scroll.parent.parent.type, "KeyboardAvoidingView");
    assert.equal(styleOf(scroll.parent).flex, 1);
    assert.deepEqual(scroll.parent.children.map((node) => node.type), ["ScrollView", "View"]);
    assert.equal(styleOf(footer).backgroundColor, view.colors.background);
    assert.equal(styleOf(footer).position, undefined);
    assert.equal(styleOf(footer).height, undefined);
    assert.equal(styleOf(action).height, undefined);
    assert.equal(action.props.testID, "one-rep-max-continue");
    assert.equal(action.props.accessibilityRole, "button");
    assert.equal(action.props.accessibilityLabel, "Continue");
    assert.equal(textOf(action), "Continue");
    assert.equal(action.props.disabled ?? false, false);
    assert.equal(styleOf(action).backgroundColor, view.colors.primaryButton);
    assert.ok(styleOf(action).minHeight >= 56);
    assert.equal(styleOf(action).flexShrink, 0);
    assert.equal(styleOf(action.findByType("Text")).alignSelf, "stretch");
    assert.equal(styleOf(action.findByType("Text")).textAlign, "center");
    assert.equal(styleOf(action.findByType("Text")).flexShrink, 0);
    assert.ok(contrast(styleOf(action.findByType("Text")).color, view.colors.primaryButton) >= 4.5);
    for (const phase of ["onPressIn", "onPressOut"]) {
      await act(async () => action.props[phase]({ nativeEvent: {} }));
      assert.equal(styleOf(action).backgroundColor, view.colors.primaryButton);
      assert.equal(styleOf(action).opacity, undefined);
    }
    assert.equal(styleOf(action.parent.parent).paddingBottom, 24);
    await unmount(view.tree);
  });
  for (const fontScale of [1, 2.4]) test(`presentation: ${scheme} font scale ${fontScale} keeps stacked full-width fields and uncapped natural text`, async () => {
    const view = await oneRepMax({ scheme, fontScale });
    const scroll = host(view.tree, "one-rep-max-scroll");
    assert.equal(view.tree.root.findAllByType("ScrollView").length, 1);
    assert.equal(styleOf(host(view.tree, "one-rep-max-description")).color, view.colors.icon);
    assert.ok(contrast(view.colors.icon, view.colors.background) >= 4.5);
    for (const exercise of exercises) {
      const label = host(view.tree, `one-rep-max-label-${exercise.id}`);
      const field = host(view.tree, `one-rep-max-input-${exercise.id}`);
      assert.notEqual(styleOf(label.parent).flexDirection, "row");
      assert.equal(styleOf(field.parent.parent).width, "100%");
      assert.equal(styleOf(field).flex, 1);
      assert.equal(styleOf(field).minWidth, 0);
      assert.equal(styleOf(field).width, undefined);
      assert.ok(styleOf(field).minHeight >= 56);
    }
    for (const node of scroll.findAll((node) => typeof node.type === "string")) {
      assert.notEqual(styleOf(node).position, "absolute");
      assert.notEqual(styleOf(node).overflow, "hidden");
    }
    for (const node of [...view.tree.root.findAllByType("Text"), ...view.tree.root.findAllByType("TextInput")]) {
      for (const prop of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(node.props[prop], undefined);
      assert.notEqual(node.props.allowFontScaling, false);
      for (const prop of ["lineHeight", "height", "textTransform"]) assert.equal(styleOf(node)[prop], undefined);
      assert.equal(styleOf(node).fontFamily, theme.Fonts.sans);
    }
    await unmount(view.tree);
  });
}
