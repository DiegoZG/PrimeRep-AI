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
const base = "6ffc2364bf5203127b71829f4c527583b6063460";
const route = "app/onboarding/training-place/index.tsx";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const original = (file) => execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" });
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
const content = constants.TRAINING_PLACE_SCREEN;
const expectedContent = {
  title: "Training Place", step: 8, totalSteps: 9, question: "Where do you exercise?",
  description: "Select the equipment you have access to. You can also change this later.",
  options: [
    { id: "large-gym", title: "Large Gym", description: "Full fitness clubs such as Anytime, Fitness First, Golds, Planet Fitness, etc." },
    { id: "small-gym", title: "Small Gym", description: "Compact gym with limited equipment" },
    { id: "garage-gym", title: "Garage Gym", description: "Barbells, squat rack, dumbbells and more." },
  ],
};
const choices = expectedContent.options;
const plain = (value) => JSON.parse(JSON.stringify(value));
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const button = (tree) => tree.root.findByType("Pressable");
const option = (tree, id) => tree.root.findAllByType("TouchableOpacity").find((node) => textOf(node).includes(choices.find((choice) => choice.id === id).title));
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node) => flat(node.props.style);
const unmount = async (tree) => { await act(async () => tree.unmount()); };
const destination = (id) => ({ pathname: "/onboarding/training-place/equipment", params: { gymType: id } });
async function place(options = {}) {
  const calls = { routes: [], fields: [], animations: [], stored: [] };
  const scheme = options.scheme ?? "light";
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
    withSequence: (...values) => { calls.animations.push({ kind: "sequence", values }); return values.at(-1); },
  };
  const AuthContext = React.createContext({ isBootstrapping: false, isLoggedIn: false });
  const mocks = {
    react: React, "react-native": { ...native, PixelRatio: { getFontScale: () => options.fontScale ?? 1 }, useColorScheme: () => scheme },
    "react-native-reanimated": animated, "@expo/vector-icons": { Ionicons: "Ionicons" },
    "@/constants/theme": theme, "@/features/onboarding/constants": constants, "@/utils/authContext": { AuthContext },
    "@react-native-async-storage/async-storage": {
      getItem: async (key) => key === "@primerep/theme-preference" ? "system" : JSON.stringify(options.data ?? { preferredName: "Alex", trainingPlace: "", reason: "structure", selectedEquipment: ["barbell"], benchPress1RM: 100 }),
      setItem: async (key, value) => calls.stored.push({ key, value }), removeItem: async () => {},
    },
    "expo-router": { useRouter: () => ({ push: (value) => calls.routes.push(plain(value)) }) },
  };
  for (const [alias, file] of [
    ["@/utils/appearanceContext", "utils/appearanceContext.tsx"],
    ["@/hooks/use-color-scheme", "hooks/use-color-scheme.ts"],
    ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"],
    ["@/hooks/use-screen-transition", "hooks/use-screen-transition.ts"],
    ["@/components/themed-view", "components/themed-view.tsx"],
    ["@/components/animated-button", "components/animated-button.tsx"],
    ["@/components/animated-checkmark", "components/animated-checkmark.tsx"],
    ["@/components/selectable-option-card", "components/selectable-option-card.tsx"],
    ["@/utils/onboardingContext", "utils/onboardingContext.tsx"],
  ]) mocks[alias] = load(file, mocks);
  const { OnboardingContext, OnboardingProvider } = mocks["@/utils/onboardingContext"];
  const { AppearanceProvider } = mocks["@/utils/appearanceContext"];
  const { default: Screen } = load(route, mocks);
  let context;
  function RestoredScreen() {
    context = React.useContext(OnboardingContext);
    if (context.isRestoring) return null;
    const value = { ...context, updateField: (field, value) => { calls.fields.push([field, value]); context.updateField(field, value); } };
    return React.createElement(OnboardingContext.Provider, { value }, React.createElement(Screen));
  }
  let tree;
  await act(async () => { tree = create(React.createElement(AppearanceProvider, null, React.createElement(OnboardingProvider, null, React.createElement(RestoredScreen)))); });
  return { tree, calls, colors: theme.Colors[scheme], data: () => context.getOnboardingData(), update: (field, value) => context.updateField(field, value) };
}

for (const scheme of ["light", "dark"]) {
  test(`behavior: ${scheme} exact question, helper and three ordered choices`, async () => {
    const view = await place({ scheme });
    assert.ok(text(view.tree, expectedContent.question));
    assert.ok(text(view.tree, expectedContent.description));
    const titles = view.tree.root.findAllByType("Text").map(textOf).filter((value) => choices.some((choice) => choice.title === value));
    assert.deepEqual(titles, choices.map((choice) => choice.title));
    for (const choice of choices) assert.ok(text(view.tree, choice.description));
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} all three choices write only trainingPlace, persist and route with exact gymType`, async () => {
    for (const choice of choices) {
      const view = await place({ scheme });
      const before = plain(view.data());
      await act(async () => option(view.tree, choice.id).props.onPress());
      assert.deepEqual(view.calls.fields, [["trainingPlace", choice.id]]);
      assert.deepEqual(plain(view.data()), { ...before, trainingPlace: choice.id });
      assert.equal(button(view.tree).props.disabled, false);
      await act(async () => button(view.tree).props.onPress());
      assert.deepEqual(view.calls.routes, [destination(choice.id)]);
      assert.equal(JSON.parse(view.calls.stored.at(-1).value).trainingPlace, choice.id);
      await unmount(view.tree);
    }
  });
  test(`behavior: ${scheme} all restored choices enable navigation without field writes`, async () => {
    for (const choice of choices) {
      const view = await place({ scheme, data: { preferredName: "Alex", trainingPlace: choice.id, benchPress1RM: 100, selectedEquipment: ["barbell"], workoutFrequency: 4 } });
      assert.equal(button(view.tree).props.disabled, false);
      assert.deepEqual(view.calls.fields, []);
      await act(async () => button(view.tree).props.onPress());
      assert.deepEqual(view.calls.routes, [destination(choice.id)]);
      assert.equal(view.data().benchPress1RM, 100);
      assert.equal(view.data().workoutFrequency, 4);
      assert.deepEqual(Array.from(view.data().selectedEquipment), ["barbell"]);
      await unmount(view.tree);
    }
  });
  test(`behavior: ${scheme} empty selection gates both button and directly invoked handler`, async () => {
    const view = await place({ scheme });
    assert.equal(button(view.tree).props.disabled, true);
    assert.equal(button(view.tree).props.accessibilityState.disabled, true);
    await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} replacement and repeated taps retain writes and routing`, async () => {
    const view = await place({ scheme, data: { trainingPlace: choices[0].id, reason: "structure", weightUnit: "KG", workoutFrequency: 4 } });
    for (const id of [choices[1].id, choices[2].id, choices[2].id]) await act(async () => option(view.tree, id).props.onPress());
    assert.deepEqual(view.calls.fields, [["trainingPlace", choices[1].id], ["trainingPlace", choices[2].id], ["trainingPlace", choices[2].id]]);
    assert.equal(view.data().trainingPlace, choices[2].id);
    assert.equal(view.data().reason, "structure");
    assert.equal(view.data().weightUnit, "KG");
    assert.equal(view.data().workoutFrequency, 4);
    for (let count = 0; count < 2; count += 1) await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.routes, [destination(choices[2].id), destination(choices[2].id)]);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} later context updates retain local selection and exact route params`, async () => {
    const view = await place({ scheme });
    await act(async () => view.update("trainingPlace", choices[0].id));
    assert.equal(view.data().trainingPlace, choices[0].id);
    assert.equal(button(view.tree).props.disabled, true);
    await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.routes, []);
    await act(async () => option(view.tree, choices[1].id).props.onPress());
    await act(async () => view.update("trainingPlace", ""));
    assert.equal(button(view.tree).props.disabled, false);
    await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.routes, [destination(choices[1].id)]);
    await unmount(view.tree);
  });
  test(`motion: ${scheme} real screen, checkmark and button retain configurations`, async () => {
    const view = await place({ scheme });
    assert.deepEqual(view.calls.animations.filter((call) => call.kind === "delay").map((call) => call.delay).sort((a, b) => a - b), [200, 200, 400, 400, 600, 600, 700, 700, 800, 800]);
    assert.ok(view.calls.animations.some((call) => call.kind === "timing" && call.config.duration === 250));
    await act(async () => option(view.tree, choices[0].id).props.onPress());
    assert.ok(view.calls.animations.some((call) => call.kind === "sequence" && call.values.join(",") === "1.15,1"));
    assert.ok(view.calls.animations.some((call) => call.kind === "timing" && call.config.duration === 150));
    await act(async () => button(view.tree).props.onPressIn({ nativeEvent: {} }));
    assert.equal(styleOf(button(view.tree)).transform[0].scale, 0.96);
    await act(async () => button(view.tree).props.onPressOut({ nativeEvent: {} }));
    assert.equal(styleOf(button(view.tree)).transform[0].scale, 1);
    for (const call of view.calls.animations) assert.equal(call.reduceMotion ?? call.config?.reduceMotion, undefined);
    await unmount(view.tree);
  });
}

test("scope: complete training-place controller/motion and only its own content stay identical", () => {
  const controller = (input) => input.slice(input.indexOf("export default function TrainingPlaceScreen()"), input.indexOf("\n  return ("));
  assert.equal(controller(source(route)), controller(original(route)));
  assert.deepEqual(plain(content), expectedContent);
  assert.deepEqual(plain(load("features/onboarding/constants.ts", {}, original("features/onboarding/constants.ts")).TRAINING_PLACE_SCREEN), expectedContent);
});

const host = (tree, id) => (tree.root ?? tree).findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const card = (tree, id) => host(tree, `training-place-option-${id}`).findAllByType("View")[0];
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
  test(`presentation: ${scheme} radios group exact content with an exclusive checked state and hidden decoration`, async () => {
    const view = await place({ scheme });
    for (const selected of [null, ...choices.map((choice) => choice.id)]) {
      if (selected) await act(async () => option(view.tree, selected).props.onPress());
      for (const choice of choices) {
        const control = option(view.tree, choice.id);
        assert.equal(control.props.accessible, true);
        assert.equal(control.props.accessibilityRole, "radio");
        assert.deepEqual(plain(control.props.accessibilityState), { checked: choice.id === selected });
        assert.equal(control.props.accessibilityLabel, `${choice.title}. ${choice.description}`);
        const indicator = host(view.tree, `training-place-indicator-${choice.id}`);
        assert.equal(indicator.props.accessible, false);
        assert.equal(indicator.props.accessibilityElementsHidden, true);
        assert.equal(indicator.props.importantForAccessibility, "no-hide-descendants");
        assert.equal(styleOf(indicator.findByType("AnimatedView")).opacity, choice.id === selected ? 1 : 0);
      }
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} selected cards retain neutral paint and readable title/helper/check contrast`, async () => {
    const view = await place({ scheme });
    assert.ok(contrast(styleOf(text(view.tree, expectedContent.description)).color, view.colors.background) >= 4.5);
    for (const selected of [null, ...choices.map((choice) => choice.id)]) {
      if (selected) await act(async () => option(view.tree, selected).props.onPress());
      for (const choice of choices) {
        const style = styleOf(card(view.tree, choice.id));
        assert.equal(style.backgroundColor, view.colors.inputBackground);
        assert.equal(style.borderWidth, 2);
        assert.equal(style.borderColor, selected === choice.id ? view.colors.icon : view.colors.inputBorder);
        assert.equal(styleOf(host(view.tree, `training-place-title-${choice.id}`)).color, view.colors.text);
        assert.equal(styleOf(host(view.tree, `training-place-option-description-${choice.id}`)).color, view.colors.icon);
        assert.ok(contrast(view.colors.text, style.backgroundColor) >= 4.5);
        assert.ok(contrast(view.colors.icon, style.backgroundColor) >= 4.5);
        if (choice.id === selected) {
          assert.ok(contrast(style.borderColor, style.backgroundColor) >= 3);
          const check = host(view.tree, `training-place-indicator-${choice.id}`).findAllByType("View")[1];
          assert.equal(styleOf(check).borderColor, view.colors.icon);
          assert.ok(contrast(styleOf(check).borderColor, style.backgroundColor) >= 3);
        }
      }
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} actual Continue is neutral when disabled and purple when enabled`, async () => {
    const view = await place({ scheme });
    const control = button(view.tree);
    assert.equal(control.props.testID, "training-place-continue");
    assert.equal(control.props.accessibilityRole, "button");
    assert.equal(control.props.accessibilityLabel, "Continue");
    assert.equal(styleOf(control).backgroundColor, view.colors.inputBackground);
    assert.equal(styleOf(control).borderColor, view.colors.inputBorder);
    assert.equal(styleOf(control).opacity, undefined);
    assert.equal(styleOf(text(view.tree, "Continue")).color, view.colors.icon);
    assert.ok(contrast(view.colors.icon, view.colors.inputBackground) >= 4.5);
    await act(async () => option(view.tree, choices[0].id).props.onPress());
    assert.equal(styleOf(control).backgroundColor, view.colors.primaryButton);
    assert.equal(styleOf(control).borderColor, view.colors.primaryButton);
    assert.equal(styleOf(text(view.tree, "Continue")).color, "#FFFFFF");
    assert.ok(contrast("#FFFFFF", view.colors.primaryButton) >= 4.5);
    assert.equal(control.props.accessibilityState.disabled, false);
    assert.equal(styleOf(control).minHeight, 56);
    assert.equal(styleOf(control).flexShrink, 0);
    assert.equal(styleOf(control).paddingHorizontal, 20);
    assert.equal(styleOf(control).height, undefined);
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} inset-aware scroller contains growing cards and actual Continue at normal and enlarged font settings`, async () => {
    for (const fontScale of [1, 3.2]) {
      const view = await place({ scheme, fontScale });
      const scroll = host(view.tree, "training-place-scroll");
      assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
      assert.equal(flat(scroll.props.contentContainerStyle).flexGrow, 1);
      assert.equal(flat(scroll.props.contentContainerStyle).paddingBottom, undefined);
      assert.ok(scroll.findAllByType("Pressable").includes(button(view.tree)));
      assert.equal(scroll.findAllByType("TouchableOpacity").length, 3);
      assert.equal(scroll.children.length, 2);
      assert.equal(scroll.children[1].findByType("Pressable"), button(view.tree));
      const footer = styleOf(scroll.children[1]);
      assert.equal(footer.paddingBottom, 24);
      assert.equal(footer.position, undefined);
      assert.equal(footer.height, undefined);
      for (const node of scroll.findAllByType("Text")) {
        for (const prop of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(node.props[prop], undefined);
        assert.notEqual(node.props.allowFontScaling, false);
        for (const key of ["height", "maxHeight", "lineHeight", "textTransform"]) assert.equal(styleOf(node)[key], undefined);
      }
      assert.equal(styleOf(text(view.tree, expectedContent.question)).fontSize, 28);
      assert.equal(styleOf(text(view.tree, expectedContent.question)).fontWeight, "600");
      for (const choice of choices) {
        const style = styleOf(card(view.tree, choice.id));
        assert.equal(style.minHeight, 44);
        assert.equal(style.height, undefined);
        const row = styleOf(card(view.tree, choice.id).children[0]);
        assert.equal(row.alignItems, "flex-start");
        const copy = styleOf(card(view.tree, choice.id).children[0].children[0]);
        assert.equal(copy.flex, 1);
        assert.equal(copy.minWidth, 0);
        assert.equal(styleOf(host(view.tree, `training-place-indicator-${choice.id}`)).flexShrink, 0);
      }
      const label = styleOf(text(view.tree, "Continue"));
      assert.equal(label.alignSelf, "stretch");
      assert.equal(label.textAlign, "center");
      assert.equal(label.flexShrink, 0);
      await unmount(view.tree);
    }
  });
}
