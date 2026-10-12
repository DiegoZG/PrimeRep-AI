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
const route = "app/onboarding/fitness-goal.tsx";
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
const content = constants.FITNESS_GOAL_SCREEN;
const choices = Array.from(content.options);
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const button = (tree) => tree.root.findByType("Pressable");
const option = (tree, id) => tree.root.findAllByType("TouchableOpacity").find((node) => textOf(node).includes(choices.find((choice) => choice.id === id).title));
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node) => flat(node.props.style);
const unmount = async (tree) => { await act(async () => tree.unmount()); };
async function goal(options = {}) {
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
    react: React, "react-native": { ...native, PixelRatio: { getFontScale: () => options.fontScale ?? 1 } }, "react-native-reanimated": animated,
    "@/constants/theme": theme, "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@/features/onboarding/constants": constants, "@/utils/authContext": { AuthContext },
    "@react-native-async-storage/async-storage": { getItem: async () => JSON.stringify(options.data ?? { preferredName: "Alex", fitnessGoal: "", reason: "structure", selectedEquipment: ["barbell"], benchPress1RM: 100 }), setItem: async (key, value) => calls.stored.push({ key, value }), removeItem: async () => {} },
    "expo-router": { useRouter: () => ({ push: (value) => calls.routes.push(value) }) },
  };
  for (const [alias, file] of [
    ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"],
    ["@/hooks/use-screen-transition", "hooks/use-screen-transition.ts"],
    ["@/components/themed-view", "components/themed-view.tsx"],
    ["@/components/animated-button", "components/animated-button.tsx"],
    ["@/components/animated-checkmark", "components/animated-checkmark.tsx"],
    ["@/utils/onboardingContext", "utils/onboardingContext.tsx"],
  ]) mocks[alias] = load(file, mocks);
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
  test(`behavior: ${scheme} exact question, descriptions, tags and four ordered choices`, async () => {
    const view = await goal({ scheme });
    assert.ok(text(view.tree, content.question));
    assert.ok(text(view.tree, content.description));
    const titles = view.tree.root.findAllByType("Text").map(textOf).filter((value) => choices.some((choice) => choice.title === value));
    assert.deepEqual(titles, choices.map((choice) => choice.title));
    for (const choice of choices) {
      assert.ok(text(view.tree, choice.description));
      if (choice.tag) assert.ok(text(view.tree, choice.tag.text));
    }
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} all four choices write only fitnessGoal, persist and route`, async () => {
    for (const choice of choices) {
      const view = await goal({ scheme });
      const before = JSON.parse(JSON.stringify(view.data()));
      await act(async () => option(view.tree, choice.id).props.onPress());
      assert.deepEqual(view.calls.fields, [["fitnessGoal", choice.id]]);
      assert.deepEqual(JSON.parse(JSON.stringify(view.data())), { ...before, fitnessGoal: choice.id });
      assert.equal(button(view.tree).props.disabled, false);
      await act(async () => button(view.tree).props.onPress());
      assert.deepEqual(view.calls.routes, ["/onboarding/training-frequency"]);
      assert.equal(JSON.parse(view.calls.stored.at(-1).value).fitnessGoal, choice.id);
      await unmount(view.tree);
    }
  });
  test(`behavior: ${scheme} all restored choices enable navigation without field writes`, async () => {
    for (const choice of choices) {
      const view = await goal({ scheme, data: { preferredName: "Alex", fitnessGoal: choice.id, benchPress1RM: 100, selectedEquipment: ["barbell"] } });
      assert.equal(button(view.tree).props.disabled, false);
      assert.equal(view.data().fitnessGoal, choice.id);
      assert.deepEqual(view.calls.fields, []);
      await act(async () => button(view.tree).props.onPress());
      assert.deepEqual(view.calls.routes, ["/onboarding/training-frequency"]);
      assert.equal(view.data().benchPress1RM, 100);
      assert.deepEqual(Array.from(view.data().selectedEquipment), ["barbell"]);
      await unmount(view.tree);
    }
  });
  test(`behavior: ${scheme} empty selection gates both button and directly invoked handler`, async () => {
    const view = await goal({ scheme });
    assert.equal(button(view.tree).props.disabled, true);
    assert.equal(button(view.tree).props.accessibilityState.disabled, true);
    await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} replacement and repeated taps preserve existing writes and routing`, async () => {
    const view = await goal({ scheme, data: { fitnessGoal: choices[0].id, reason: "structure", weightUnit: "KG", benchPress1RM: 100 } });
    for (const id of [choices[1].id, choices[3].id, choices[3].id]) await act(async () => option(view.tree, id).props.onPress());
    assert.deepEqual(view.calls.fields, [["fitnessGoal", choices[1].id], ["fitnessGoal", choices[3].id], ["fitnessGoal", choices[3].id]]);
    assert.equal(view.data().fitnessGoal, choices[3].id);
    assert.equal(view.data().reason, "structure");
    assert.equal(view.data().weightUnit, "KG");
    assert.equal(view.data().benchPress1RM, 100);
    for (let count = 0; count < 2; count += 1) await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.routes, ["/onboarding/training-frequency", "/onboarding/training-frequency"]);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} context updates after mounting retain local selection gating`, async () => {
    const view = await goal({ scheme });
    await act(async () => view.update("fitnessGoal", choices[0].id));
    assert.equal(view.data().fitnessGoal, choices[0].id);
    assert.equal(button(view.tree).props.disabled, true);
    await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.routes, []);
    await act(async () => option(view.tree, choices[1].id).props.onPress());
    await act(async () => view.update("fitnessGoal", ""));
    assert.equal(button(view.tree).props.disabled, false);
    await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.routes, ["/onboarding/training-frequency"]);
    await unmount(view.tree);
  });
  test(`motion: ${scheme} real screen, checkmark and button retain their configurations`, async () => {
    const view = await goal({ scheme });
    assert.deepEqual(view.calls.animations.filter((call) => call.kind === "delay").map((call) => call.delay).sort((a, b) => a - b), [200, 200, 400, 400, 600, 600, 700, 700, 800, 800, 900, 900]);
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

test("scope: complete Goal controller, motion and only its own content stay byte-identical", () => {
  const controller = (input) => input.slice(input.indexOf("export default function FitnessGoalScreen()"), input.indexOf("\n  return ("));
  assert.equal(controller(source(route)), controller(original(route)));
  assert.equal(JSON.stringify(content), JSON.stringify(load("features/onboarding/constants.ts", {}, original("features/onboarding/constants.ts")).FITNESS_GOAL_SCREEN));
});

const host = (tree, id) => (tree.root ?? tree).findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const card = (tree, id) => host(tree, `fitness-goal-option-${id}`).findAllByType("View")[0];
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
  test(`presentation: ${scheme} selection has exclusive radio/check semantics and stable neutral borders`, async () => {
    const view = await goal({ scheme });
    for (const selected of [null, ...choices]) {
      if (selected) await act(async () => option(view.tree, selected.id).props.onPress());
      for (const choice of choices) {
        const checked = choice.id === selected?.id;
        const row = host(view.tree, `fitness-goal-option-${choice.id}`);
        assert.equal(row.props.accessible, true);
        assert.equal(row.props.accessibilityRole, "radio");
        assert.equal(row.props.accessibilityState.checked, checked);
        assert.equal(row.props.accessibilityLabel, `${choice.title}. ${choice.description}${choice.tag ? `. ${choice.tag.text}` : ""}`);
        assert.equal(styleOf(card(view.tree, choice.id)).borderColor, checked ? view.colors.icon : view.colors.inputBorder);
        assert.equal(styleOf(card(view.tree, choice.id)).borderWidth, 2);
        assert.equal(styleOf(card(view.tree, choice.id)).backgroundColor, view.colors.inputBackground);
        assert.ok(styleOf(card(view.tree, choice.id)).minHeight >= 44);
        const indicator = host(view.tree, `fitness-goal-indicator-${choice.id}`);
        assert.equal(indicator.props.accessible, false);
        assert.equal(indicator.props.accessibilityElementsHidden, true);
        assert.equal(indicator.props.importantForAccessibility, "no-hide-descendants");
        assert.equal(styleOf(indicator).flexShrink, 0);
        const animatedCheck = indicator.findByType("AnimatedView");
        assert.equal(styleOf(animatedCheck).opacity, checked ? 1 : 0);
        assert.equal(styleOf(animatedCheck).transform[0].scale, checked ? 1 : 0);
        const check = animatedCheck.findByType("View");
        assert.equal(styleOf(check).borderColor, view.colors.icon);
        assert.equal(styleOf(check).borderRightWidth, 2);
        assert.equal(styleOf(check).borderBottomWidth, 2);
        assert.equal(indicator.findAllByType("Text").length, 0);
      }
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} helper, descriptions and tags have readable neutral contrast`, async () => {
    const view = await goal({ scheme });
    assert.equal(styleOf(host(view.tree, "fitness-goal-question")).fontWeight, "600");
    assert.equal(styleOf(host(view.tree, "fitness-goal-question")).color, view.colors.text);
    assert.equal(styleOf(host(view.tree, "fitness-goal-description")).color, view.colors.icon);
    assert.ok(contrast(view.colors.icon, view.colors.background) >= 4.5);
    for (const choice of choices) {
      const title = host(view.tree, `fitness-goal-title-${choice.id}`);
      const detail = host(view.tree, `fitness-goal-option-description-${choice.id}`);
      assert.equal(styleOf(title).color, view.colors.text);
      assert.equal(styleOf(detail).color, view.colors.icon);
      for (const copy of [title, detail]) assert.ok(contrast(styleOf(copy).color, view.colors.inputBackground) >= 4.5);
      if (choice.tag) {
        const tag = host(view.tree, `fitness-goal-tag-${choice.id}`);
        const label = host(view.tree, `fitness-goal-tag-text-${choice.id}`);
        assert.equal(styleOf(tag).backgroundColor, view.colors.inputBorder);
        assert.equal(styleOf(tag).alignSelf, "flex-start");
        assert.equal(styleOf(tag).maxWidth, "100%");
        assert.equal(textOf(label), choice.tag.text);
        assert.ok(contrast(styleOf(label).color, styleOf(tag).backgroundColor) >= 4.5);
      }
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} actual Continue owns purple only when enabled and retains press feedback`, async () => {
    const view = await goal({ scheme });
    const action = button(view.tree);
    assert.equal(action.props.testID, "fitness-goal-continue");
    assert.equal(action.props.accessibilityRole, "button");
    assert.equal(action.props.accessibilityLabel, "Continue");
    assert.equal(textOf(action), "Continue");
    assert.ok(styleOf(action).minHeight >= 56);
    assert.equal(styleOf(action).flexShrink, 0);
    assert.equal(styleOf(action).backgroundColor, view.colors.inputBackground);
    assert.equal(styleOf(action).borderColor, view.colors.inputBorder);
    assert.equal(styleOf(action.findByType("Text")).color, view.colors.icon);
    await act(async () => option(view.tree, choices[0].id).props.onPress());
    assert.equal(styleOf(action).backgroundColor, view.colors.primaryButton);
    assert.equal(styleOf(action).borderColor, view.colors.primaryButton);
    assert.ok(contrast(styleOf(action.findByType("Text")).color, view.colors.primaryButton) >= 4.5);
    for (const phase of ["onPressIn", "onPressOut"]) {
      await act(async () => action.props[phase]({ nativeEvent: {} }));
      assert.equal(styleOf(action).backgroundColor, view.colors.primaryButton);
      assert.equal(styleOf(action).opacity, undefined);
    }
    for (const node of view.tree.root.findAll((node) => typeof node.type === "string")) {
      for (const property of ["color", "backgroundColor", "borderColor"]) {
        if (styleOf(node)[property] === view.colors.primaryButton) assert.equal(node.props.testID, "fitness-goal-continue");
      }
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} normal and large text keep tags, cards and Continue in one natural scroll flow`, async () => {
    for (const fontScale of [1, 2.4]) {
      const view = await goal({ scheme, fontScale });
      const scroll = host(view.tree, "fitness-goal-scroll");
      assert.equal(view.tree.root.findAllByType("ScrollView").length, 1);
      assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
      assert.equal(flat(scroll.props.contentContainerStyle).flexGrow, 1);
      assert.equal(flat(scroll.props.contentContainerStyle).flex, undefined);
      for (const id of ["fitness-goal-question", "fitness-goal-description", "fitness-goal-continue", ...choices.map((choice) => `fitness-goal-option-${choice.id}`)]) assert.ok(host(scroll, id));
      for (const node of scroll.findAll((node) => typeof node.type === "string")) {
        assert.notEqual(styleOf(node).position, "absolute");
        assert.notEqual(styleOf(node).overflow, "hidden");
      }
      for (const node of view.tree.root.findAllByType("Text")) {
        for (const prop of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(node.props[prop], undefined);
        assert.notEqual(node.props.allowFontScaling, false);
        for (const prop of ["lineHeight", "height", "textTransform"]) assert.equal(styleOf(node)[prop], undefined);
        assert.equal(styleOf(node).fontFamily, theme.Fonts.sans);
      }
      const actionText = button(view.tree).findByType("Text");
      assert.equal(styleOf(actionText).alignSelf, "stretch");
      assert.equal(styleOf(actionText).textAlign, "center");
      for (const choice of choices) {
        const copy = host(view.tree, `fitness-goal-title-${choice.id}`).parent;
        assert.equal(styleOf(copy).flex, 1);
        assert.equal(styleOf(copy).minWidth, 0);
        assert.equal(styleOf(card(view.tree, choice.id)).height, undefined);
      }
      await unmount(view.tree);
    }
  });
}
