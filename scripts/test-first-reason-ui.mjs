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
const route = "app/onboarding/first-reason.tsx";
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
const choices = constants.REASON_SCREEN.options;
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const button = (tree) => tree.root.findByType("Pressable");
const option = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && typeof node.props.onPress === "function").find((node) => textOf(node).includes(choices.find((choice) => choice.id === id).title));
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node) => flat(node.props.style);
const unmount = async (tree) => { await act(async () => tree.unmount()); };
async function firstReason(options = {}) {
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
  };
  const AuthContext = React.createContext({ isBootstrapping: false, isLoggedIn: false });
  const mocks = {
    react: React, "react-native": { ...native, PixelRatio: { getFontScale: () => options.fontScale ?? 1 } }, "react-native-reanimated": animated,
    "@/constants/theme": theme, "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@/features/onboarding/constants": constants, "@/utils/authContext": { AuthContext },
    "@react-native-async-storage/async-storage": { getItem: async () => JSON.stringify(options.data ?? { preferredName: "Diego", reason: "", selectedEquipment: ["barbell"] }), setItem: async (key, value) => calls.stored.push({ key, value }), removeItem: async () => {} },
    "expo-router": { useRouter: () => ({ push: (value) => calls.routes.push(value) }) },
  };
  for (const [alias, file] of [
    ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"],
    ["@/hooks/use-screen-transition", "hooks/use-screen-transition.ts"],
    ["@/components/themed-view", "components/themed-view.tsx"],
    ["@/components/animated-button", "components/animated-button.tsx"],
    ["@/utils/onboardingContext", "utils/onboardingContext.tsx"],
  ]) mocks[alias] = load(file, mocks);
  const { OnboardingContext, OnboardingProvider } = mocks["@/utils/onboardingContext"];
  const { default: Screen } = load(route, mocks, options.legacy ? original(route) : source(route));
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

for (const legacy of [true, false]) for (const scheme of ["light", "dark"]) {
  const label = `${legacy ? "baseline" : "current"} ${scheme}`;
  test(`behavior: ${label} all five original titles and descriptions retain their order`, async () => {
    const view = await firstReason({ legacy, scheme });
    assert.ok(text(view.tree, constants.REASON_SCREEN.question));
    const titles = view.tree.root.findAllByType("Text").map(textOf).filter((value) => choices.some((choice) => choice.title === value));
    assert.deepEqual(titles, Array.from(choices, (choice) => choice.title));
    for (const choice of choices) assert.ok(text(view.tree, choice.description));
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
  for (const choice of choices) test(`behavior: ${label} ${choice.id} writes only its exact reason and advances to Body Stats`, async () => {
    const view = await firstReason({ legacy, scheme });
    const before = JSON.parse(JSON.stringify(view.data()));
    await act(async () => option(view.tree, choice.id).props.onPress());
    assert.deepEqual(view.calls.fields, [["reason", choice.id]]);
    assert.deepEqual(JSON.parse(JSON.stringify(view.data())), { ...before, reason: choice.id });
    assert.equal(button(view.tree).props.disabled, false);
    await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.routes, ["/onboarding/body-stats"]);
    assert.equal(JSON.parse(view.calls.stored.at(-1).value).reason, choice.id);
    await unmount(view.tree);
  });
  test(`behavior: ${label} the empty-state handler guards navigation even when invoked directly`, async () => {
    const view = await firstReason({ legacy, scheme });
    assert.equal(button(view.tree).props.disabled, true);
    assert.equal(button(view.tree).props.accessibilityState.disabled, true);
    await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    await unmount(view.tree);
  });
  test(`behavior: ${label} a restored selection, replacement and repeated presses retain the existing controller semantics`, async () => {
    const data = { preferredName: "María", reason: "personalized", selectedEquipment: ["barbell"], weightUnit: "KG" };
    const view = await firstReason({ legacy, scheme, data });
    assert.equal(button(view.tree).props.disabled, false);
    assert.deepEqual(view.calls.fields, []);
    await act(async () => option(view.tree, "improve").props.onPress());
    await act(async () => option(view.tree, "structure").props.onPress());
    assert.deepEqual(view.calls.fields, [["reason", "improve"], ["reason", "structure"]]);
    assert.equal(view.data().reason, "structure");
    assert.deepEqual(Array.from(view.data().selectedEquipment), ["barbell"]);
    assert.equal(view.data().weightUnit, "KG");
    for (let count = 0; count < 2; count += 1) await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.routes, ["/onboarding/body-stats", "/onboarding/body-stats"]);
    await unmount(view.tree);
  });
}

test("scope: the complete First Reason controller and motion configuration stay byte-identical", () => {
  const controller = (input) => input.slice(input.indexOf("export default function FirstReasonScreen()"), input.indexOf("\n  return ("));
  assert.equal(controller(source(route)), controller(original(route)));
  assert.equal(JSON.stringify(constants.REASON_SCREEN), JSON.stringify(load("features/onboarding/constants.ts", {}, original("features/onboarding/constants.ts")).REASON_SCREEN));
});

test("motion: the real route, transition and shared button preserve system-default animation behavior", async () => {
  const view = await firstReason();
  assert.deepEqual(view.calls.animations.filter((call) => call.kind === "delay").map((call) => call.delay).sort((a, b) => a - b), [200, 200, 400, 400, 500, 500, 600, 600, 700, 700, 800, 800]);
  assert.ok(view.calls.animations.some((call) => call.kind === "timing" && call.config.duration === 250));
  await act(async () => button(view.tree).props.onPressIn({ nativeEvent: {} }));
  assert.equal(styleOf(button(view.tree)).transform[0].scale, 0.96);
  await act(async () => button(view.tree).props.onPressOut({ nativeEvent: {} }));
  assert.equal(styleOf(button(view.tree)).transform[0].scale, 1);
  for (const call of view.calls.animations) assert.equal(call.reduceMotion ?? call.config?.reduceMotion, undefined);
  await unmount(view.tree);
});

const host = (tree, id) => (tree.root ?? tree).findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const card = (tree, id) => host(tree, `first-reason-option-${id}`).findAllByType("View")[0];
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
  test(`presentation: ${scheme} each choice has exclusive radio semantics and a neutral check`, async () => {
    const view = await firstReason({ scheme });
    for (const selected of choices) {
      await act(async () => host(view.tree, `first-reason-option-${selected.id}`).props.onPress());
      for (const choice of choices) {
        const row = host(view.tree, `first-reason-option-${choice.id}`);
        const checked = choice.id === selected.id;
        assert.equal(row.props.accessible, true);
        assert.equal(row.props.accessibilityRole, "radio");
        assert.equal(row.props.accessibilityState.checked, checked);
        assert.equal(row.props.accessibilityLabel, `${choice.title}. ${choice.description}`);
        assert.equal(styleOf(card(view.tree, choice.id)).borderColor, checked ? view.colors.text : view.colors.inputBorder);
        assert.equal(styleOf(card(view.tree, choice.id)).borderWidth, 1);
        assert.equal(styleOf(card(view.tree, choice.id)).backgroundColor, view.colors.inputBackground);
        assert.ok(styleOf(card(view.tree, choice.id)).minHeight >= 44);
        const indicator = host(view.tree, `first-reason-indicator-${choice.id}`);
        assert.equal(indicator.props.accessible, false);
        assert.equal(indicator.props.accessibilityElementsHidden, true);
        assert.equal(indicator.props.importantForAccessibility, "no-hide-descendants");
        assert.equal(indicator.children.length, checked ? 1 : 0);
        if (checked) assert.equal(styleOf(indicator.children[0]).borderColor, view.colors.text);
      }
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} a restored selection has exactly one checked radio before interaction`, async () => {
    const view = await firstReason({ scheme, data: { reason: "personalized" } });
    assert.deepEqual(Array.from(choices).filter((choice) => host(view.tree, `first-reason-option-${choice.id}`).props.accessibilityState.checked).map((choice) => choice.id), ["personalized"]);
    assert.equal(host(view.tree, "first-reason-indicator-personalized").children.length, 1);
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} neutral text passes contrast and Continue owns the sole purple paint`, async () => {
    const view = await firstReason({ scheme });
    assert.equal(styleOf(view.tree.root.findAllByType("View")[0]).backgroundColor, view.colors.background);
    for (const choice of choices) {
      assert.equal(styleOf(host(view.tree, `first-reason-title-${choice.id}`)).color, view.colors.text);
      assert.equal(styleOf(host(view.tree, `first-reason-description-${choice.id}`)).color, view.colors.icon);
      for (const id of [`first-reason-title-${choice.id}`, `first-reason-description-${choice.id}`]) assert.ok(contrast(styleOf(host(view.tree, id)).color, view.colors.inputBackground) >= 4.5);
    }
    const disabledAction = button(view.tree);
    assert.equal(disabledAction.props.disabled, true);
    assert.equal(disabledAction.props.accessibilityState.disabled, true);
    assert.equal(styleOf(disabledAction).backgroundColor, view.colors.inputBackground);
    assert.equal(styleOf(disabledAction).borderColor, view.colors.inputBorder);
    assert.equal(styleOf(disabledAction.findByType("Text")).color, view.colors.icon);
    assert.ok(contrast(styleOf(disabledAction.findByType("Text")).color, view.colors.inputBackground) >= 4.5);
    await act(async () => host(view.tree, "first-reason-option-beginner").props.onPress());
    const action = button(view.tree);
    assert.equal(action.props.disabled, false);
    assert.equal(action.props.accessibilityState.disabled, false);
    assert.equal(action.props.testID, "first-reason-continue");
    assert.equal(action.props.accessibilityRole, "button");
    assert.equal(action.props.accessibilityLabel, "Continue");
    assert.equal(textOf(action), "Continue");
    assert.ok(styleOf(action).minHeight >= 56);
    assert.equal(styleOf(action).flexShrink, 0);
    assert.equal(styleOf(action.findByType("Text")).alignSelf, "stretch");
    assert.equal(styleOf(action.findByType("Text")).textAlign, "center");
    assert.equal(styleOf(action.findByType("Text")).flexShrink, 0);
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
  for (const fontScale of [1, 2.4]) test(`presentation: ${scheme} font scale ${fontScale} retains natural text and one inset-aware scroll flow`, async () => {
    const view = await firstReason({ scheme, fontScale });
    const scroll = host(view.tree, "first-reason-scroll");
    assert.equal(view.tree.root.findAllByType("ScrollView").length, 1);
    assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
    assert.equal(flat(scroll.props.contentContainerStyle).flexGrow, 1);
    assert.equal(flat(scroll.props.contentContainerStyle).flex, undefined);
    for (const choice of choices) assert.ok(host(scroll, `first-reason-option-${choice.id}`));
    assert.ok(host(scroll, "first-reason-question"));
    assert.ok(host(scroll, "first-reason-continue"));
    assert.equal(styleOf(button(view.tree).findByType("Text")).alignSelf, "stretch");
    assert.equal(styleOf(button(view.tree).findByType("Text")).flexShrink, 0);
    assert.equal(styleOf(button(view.tree).parent.parent).paddingBottom, 24);
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
      const copy = host(view.tree, `first-reason-title-${choice.id}`).parent;
      assert.equal(styleOf(copy).flex, 1);
      assert.equal(styleOf(copy).minWidth, 0);
      assert.equal(styleOf(card(view.tree, choice.id)).height, undefined);
    }
    await unmount(view.tree);
  });
}
