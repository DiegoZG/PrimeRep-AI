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
const route = "app/onboarding/fitness-experience/index.tsx";
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
const content = constants.FITNESS_EXPERIENCE_SCREEN;
const choices = Array.from(content.options);
const destination = (id) => ["intermediate", "advanced"].includes(id) ? "/onboarding/fitness-experience/one-rep-max" : "/onboarding/fitness-goal";
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const button = (tree) => tree.root.findByType("Pressable");
const option = (tree, id) => tree.root.findAllByType("TouchableOpacity").find((node) => textOf(node).includes(choices.find((choice) => choice.id === id).title));
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node) => flat(node.props.style);
const unmount = async (tree) => { await act(async () => tree.unmount()); };
async function experience(options = {}) {
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
    "@react-native-async-storage/async-storage": { getItem: async () => JSON.stringify(options.data ?? { preferredName: "Diego", experienceLevel: "", reason: "structure", selectedEquipment: ["barbell"], benchPress1RM: 100 }), setItem: async (key, value) => calls.stored.push({ key, value }), removeItem: async () => {} },
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
  return { tree, calls, colors: theme.Colors[scheme], data: () => context.getOnboardingData() };
}

for (const scheme of ["light", "dark"]) {
  test(`behavior: ${scheme} the exact question, helper and four options retain their order`, async () => {
    const view = await experience({ scheme });
    assert.ok(text(view.tree, content.question));
    assert.ok(text(view.tree, content.description));
    const titles = view.tree.root.findAllByType("Text").map(textOf).filter((value) => choices.some((choice) => choice.title === value));
    assert.deepEqual(titles, choices.map((choice) => choice.title));
    for (const choice of choices) assert.ok(text(view.tree, choice.description));
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
  for (const choice of choices) {
    test(`behavior: ${scheme} ${choice.id} writes its exact experience payload and takes its existing route`, async () => {
      const view = await experience({ scheme });
      const before = JSON.parse(JSON.stringify(view.data()));
      await act(async () => option(view.tree, choice.id).props.onPress());
      assert.deepEqual(view.calls.fields, [["experienceLevel", choice.id]]);
      assert.deepEqual(JSON.parse(JSON.stringify(view.data())), { ...before, experienceLevel: choice.id });
      assert.equal(button(view.tree).props.disabled, false);
      await act(async () => button(view.tree).props.onPress());
      assert.deepEqual(view.calls.routes, [destination(choice.id)]);
      assert.equal(JSON.parse(view.calls.stored.at(-1).value).experienceLevel, choice.id);
      await unmount(view.tree);
    });
    test(`behavior: ${scheme} restored ${choice.id} enables its original route without rewriting context`, async () => {
      const view = await experience({ scheme, data: { preferredName: "María", reason: "structure", experienceLevel: choice.id, benchPress1RM: 100, selectedEquipment: ["barbell"] } });
      assert.equal(button(view.tree).props.disabled, false);
      assert.equal(view.data().experienceLevel, choice.id);
      assert.deepEqual(view.calls.fields, []);
      await act(async () => button(view.tree).props.onPress());
      assert.deepEqual(view.calls.routes, [destination(choice.id)]);
      assert.equal(view.data().reason, "structure");
      assert.equal(view.data().benchPress1RM, 100);
      assert.deepEqual(Array.from(view.data().selectedEquipment), ["barbell"]);
      await unmount(view.tree);
    });
  }
  test(`behavior: ${scheme} the empty-state handler guards navigation even when directly invoked`, async () => {
    const view = await experience({ scheme });
    assert.equal(button(view.tree).props.disabled, true);
    assert.equal(button(view.tree).props.accessibilityState.disabled, true);
    await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
  test(`behavior: ${scheme} replacement selection and repeated presses preserve the final selected route`, async () => {
    const view = await experience({ scheme, data: { experienceLevel: "intermediate", reason: "structure", weightUnit: "KG", benchPress1RM: 100 } });
    await act(async () => option(view.tree, "advanced").props.onPress());
    await act(async () => option(view.tree, "beginner").props.onPress());
    assert.deepEqual(view.calls.fields, [["experienceLevel", "advanced"], ["experienceLevel", "beginner"]]);
    assert.equal(view.data().experienceLevel, "beginner");
    assert.equal(view.data().reason, "structure");
    assert.equal(view.data().weightUnit, "KG");
    assert.equal(view.data().benchPress1RM, 100);
    for (let count = 0; count < 2; count += 1) await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.routes, ["/onboarding/fitness-goal", "/onboarding/fitness-goal"]);
    await unmount(view.tree);
  });
  test(`motion: ${scheme} the real route, checkmark and button retain their system-default configurations`, async () => {
    const view = await experience({ scheme });
    assert.deepEqual(view.calls.animations.filter((call) => call.kind === "delay").map((call) => call.delay).sort((a, b) => a - b), [200, 200, 400, 400, 600, 600, 700, 700, 800, 800, 900, 900]);
    assert.ok(view.calls.animations.some((call) => call.kind === "timing" && call.config.duration === 250));
    await act(async () => option(view.tree, "advanced").props.onPress());
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

test("scope: the complete Experience controller, motion and its own question/options stay byte-identical", () => {
  const controller = (input) => input.slice(input.indexOf("export default function FitnessExperienceScreen()"), input.indexOf("\n  return ("));
  assert.equal(controller(source(route)), controller(original(route)));
  assert.equal(JSON.stringify(content), JSON.stringify(load("features/onboarding/constants.ts", {}, original("features/onboarding/constants.ts")).FITNESS_EXPERIENCE_SCREEN));
});

const host = (tree, id) => (tree.root ?? tree).findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const card = (tree, id) => host(tree, `fitness-experience-option-${id}`).findAllByType("View")[0];
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
  test(`presentation: ${scheme} every selection has exclusive radio semantics and an unfilled neutral card`, async () => {
    const view = await experience({ scheme });
    for (const selected of choices) {
      await act(async () => host(view.tree, `fitness-experience-option-${selected.id}`).props.onPress());
      for (const choice of choices) {
        const row = host(view.tree, `fitness-experience-option-${choice.id}`);
        const checked = choice.id === selected.id;
        assert.equal(row.props.accessible, true);
        assert.equal(row.props.accessibilityRole, "radio");
        assert.equal(row.props.accessibilityState.checked, checked);
        assert.equal(row.props.accessibilityLabel, `${choice.title}. ${choice.description}`);
        assert.equal(styleOf(card(view.tree, choice.id)).borderColor, checked ? view.colors.text : view.colors.inputBorder);
        assert.equal(styleOf(card(view.tree, choice.id)).borderWidth, 1);
        assert.equal(styleOf(card(view.tree, choice.id)).backgroundColor, view.colors.inputBackground);
        assert.ok(styleOf(card(view.tree, choice.id)).minHeight >= 44);
      }
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} the actual animated check remains neutral, exclusive and hidden as decoration`, async () => {
    const view = await experience({ scheme, data: { experienceLevel: "intermediate" } });
    for (const selected of ["intermediate", "advanced", "beginner"]) {
      if (selected !== "intermediate") await act(async () => option(view.tree, selected).props.onPress());
      for (const choice of choices) {
        const indicator = host(view.tree, `fitness-experience-indicator-${choice.id}`);
        assert.equal(indicator.props.accessible, false);
        assert.equal(indicator.props.accessibilityElementsHidden, true);
        assert.equal(indicator.props.importantForAccessibility, "no-hide-descendants");
        assert.equal(styleOf(indicator).width, 20);
        assert.equal(styleOf(indicator).height, 20);
        assert.equal(styleOf(indicator).backgroundColor, undefined);
        const animatedCheck = indicator.findByType("AnimatedView");
        assert.equal(styleOf(animatedCheck).opacity, choice.id === selected ? 1 : 0);
        assert.equal(styleOf(animatedCheck).transform[0].scale, choice.id === selected ? 1 : 0);
        const check = animatedCheck.findByType("View");
        assert.equal(styleOf(check).borderColor, view.colors.text);
        assert.equal(styleOf(check).borderRightWidth, 2);
        assert.equal(styleOf(check).borderBottomWidth, 2);
        assert.equal(indicator.findAllByType("Text").length, 0);
      }
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} helper, titles and descriptions use readable neutral theme colors`, async () => {
    const view = await experience({ scheme });
    assert.equal(styleOf(view.tree.root.findAllByType("View")[0]).backgroundColor, view.colors.background);
    assert.equal(styleOf(host(view.tree, "fitness-experience-question")).color, view.colors.text);
    assert.equal(styleOf(host(view.tree, "fitness-experience-description")).color, view.colors.icon);
    assert.ok(contrast(view.colors.icon, view.colors.background) >= 4.5);
    for (const choice of choices) {
      assert.equal(styleOf(host(view.tree, `fitness-experience-title-${choice.id}`)).color, view.colors.text);
      assert.equal(styleOf(host(view.tree, `fitness-experience-description-${choice.id}`)).color, view.colors.icon);
      for (const id of [`fitness-experience-title-${choice.id}`, `fitness-experience-description-${choice.id}`]) assert.ok(contrast(styleOf(host(view.tree, id)).color, view.colors.inputBackground) >= 4.5);
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} Continue is neutral while disabled and owns purple paint only when enabled`, async () => {
    const view = await experience({ scheme });
    const disabled = button(view.tree);
    assert.equal(disabled.props.disabled, true);
    assert.equal(disabled.props.accessibilityState.disabled, true);
    assert.equal(styleOf(disabled).backgroundColor, view.colors.inputBackground);
    assert.equal(styleOf(disabled).borderColor, view.colors.inputBorder);
    assert.equal(styleOf(disabled.findByType("Text")).color, view.colors.icon);
    assert.ok(contrast(view.colors.icon, view.colors.inputBackground) >= 4.5);
    await act(async () => option(view.tree, "beginner").props.onPress());
    const action = button(view.tree);
    assert.equal(action.props.disabled, false);
    assert.equal(action.props.accessibilityState.disabled, false);
    assert.equal(action.props.testID, "fitness-experience-continue");
    assert.equal(action.props.accessibilityRole, "button");
    assert.equal(action.props.accessibilityLabel, "Continue");
    assert.equal(textOf(action), "Continue");
    assert.ok(styleOf(action).minHeight >= 56);
    assert.equal(styleOf(action).flexShrink, 0);
    assert.equal(styleOf(action).backgroundColor, view.colors.primaryButton);
    assert.equal(styleOf(action).borderColor, view.colors.primaryButton);
    assert.equal(styleOf(action).opacity, undefined);
    assert.ok(contrast(styleOf(action.findByType("Text")).color, view.colors.primaryButton) >= 4.5);
    for (const phase of ["onPressIn", "onPressOut"]) {
      await act(async () => action.props[phase]({ nativeEvent: {} }));
      assert.equal(styleOf(action).backgroundColor, view.colors.primaryButton);
      assert.equal(styleOf(action).opacity, undefined);
    }
    await unmount(view.tree);
  });
  for (const fontScale of [1, 2.4]) test(`presentation: ${scheme} font scale ${fontScale} keeps natural text and one inset-aware scroll flow`, async () => {
    const view = await experience({ scheme, fontScale });
    const scroll = host(view.tree, "fitness-experience-scroll");
    assert.equal(view.tree.root.findAllByType("ScrollView").length, 1);
    assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
    assert.equal(flat(scroll.props.contentContainerStyle).flexGrow, 1);
    assert.equal(flat(scroll.props.contentContainerStyle).flex, undefined);
    for (const choice of choices) assert.ok(host(scroll, `fitness-experience-option-${choice.id}`));
    for (const id of ["fitness-experience-question", "fitness-experience-description", "fitness-experience-continue"]) assert.ok(host(scroll, id));
    assert.equal(styleOf(button(view.tree).parent.parent).paddingBottom, 24);
    assert.equal(styleOf(button(view.tree).findByType("Text")).alignSelf, "stretch");
    assert.equal(styleOf(button(view.tree).findByType("Text")).textAlign, "center");
    assert.equal(styleOf(button(view.tree).findByType("Text")).flexShrink, 0);
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
    for (const choice of choices) {
      const copy = host(view.tree, `fitness-experience-title-${choice.id}`).parent;
      assert.equal(styleOf(copy).flex, 1);
      assert.equal(styleOf(copy).minWidth, 0);
      assert.equal(styleOf(card(view.tree, choice.id)).height, undefined);
    }
    await unmount(view.tree);
  });
}
