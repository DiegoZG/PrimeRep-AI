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
const route = "app/onboarding/training-frequency.tsx";
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
const content = constants.TRAINING_FREQUENCY_SCREEN;
const choices = Array.from(content.options);
const ids = ["1-day", "2-days", "3-days", "4-days", "5-days", "6-days", "every-day"];
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const button = (tree) => tree.root.findByType("Pressable");
const option = (tree, id) => tree.root.findAllByType("TouchableOpacity").find((node) => textOf(node).includes(choices.find((choice) => choice.id === id).title));
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node) => flat(node.props.style);
const selectedIds = (tree) => choices.filter((choice) => styleOf(option(tree, choice.id).findByType("AnimatedView")).opacity === 1).map((choice) => choice.id);
const plain = (value) => JSON.parse(JSON.stringify(value));
const unmount = async (tree) => { await act(async () => tree.unmount()); };
async function frequency(options = {}) {
  const calls = { routes: [], fields: [], animations: [], stored: [], reads: [] };
  const scheme = options.scheme ?? "light";
  const animated = {
    __esModule: true, default: { View: "AnimatedView", createAnimatedComponent: (component) => component },
    useSharedValue: (value) => React.useRef({ value }).current,
    useAnimatedStyle: (callback) => new Proxy({}, {
      get: (_, key) => callback()[key], ownKeys: () => Reflect.ownKeys(callback()), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
    }),
    withTiming: (value, config) => { calls.animations.push({ kind: "timing", value, config }); return value; },
    withDelay: (delay, value, reduceMotion) => { calls.animations.push({ kind: "delay", delay, reduceMotion }); return value; },
    withSpring: (value, config) => { calls.animations.push({ kind: "spring", value, config }); return value; },
    withSequence: (...values) => { calls.animations.push({ kind: "sequence", values }); return values.at(-1); },
  };
  const AuthContext = React.createContext({ isBootstrapping: false, isLoggedIn: false });
  const mocks = {
    react: React, "react-native": { ...native, PixelRatio: { getFontScale: () => options.fontScale ?? 1 } }, "react-native-reanimated": animated,
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "@/constants/theme": theme, "@/hooks/use-color-scheme": { useColorScheme: () => scheme }, "@/features/onboarding/constants": constants,
    "@/utils/authContext": { AuthContext }, "expo-router": { useRouter: () => ({ push: (value) => calls.routes.push(value) }) },
    "@react-native-async-storage/async-storage": {
      getItem: async (key) => { calls.reads.push(key); return JSON.stringify(options.data ?? { preferredName: "Alex", reason: "structure", selectedEquipment: ["olympic_barbell"], benchPress1RM: 100 }); },
      setItem: async (key, value) => calls.stored.push({ key, value }), removeItem: async () => {},
    },
  };
  for (const [alias, file] of [
    ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"], ["@/hooks/use-screen-transition", "hooks/use-screen-transition.ts"],
    ["@/components/themed-view", "components/themed-view.tsx"], ["@/components/animated-button", "components/animated-button.tsx"],
    ["@/components/animated-checkmark", "components/animated-checkmark.tsx"], ["@/utils/onboardingContext", "utils/onboardingContext.tsx"],
  ]) mocks[alias] = load(file, mocks);
  const { OnboardingContext, OnboardingProvider } = mocks["@/utils/onboardingContext"];
  const { default: Screen } = load(route, mocks);
  let context;
  let screenKey = 0;
  function RestoredScreen() {
    context = React.useContext(OnboardingContext);
    if (context.isRestoring) return null;
    const value = { ...context, updateField: (field, value) => { calls.fields.push([field, value]); context.updateField(field, value); } };
    return React.createElement(OnboardingContext.Provider, { value }, React.createElement(Screen, { key: screenKey }));
  }
  const element = () => React.createElement(OnboardingProvider, null, React.createElement(RestoredScreen));
  let tree;
  await act(async () => { tree = create(element()); });
  return {
    tree, calls, colors: theme.Colors[scheme], data: () => context.getOnboardingData(), update: (field, value) => context.updateField(field, value),
    remount: async () => { screenKey += 1; await act(async () => tree.update(element())); },
  };
}

for (const scheme of ["light", "dark"]) {
  const label = `current ${scheme}`;
  test(`behavior: ${label} exact seven IDs, ordered titles, question and recommendation tags`, async () => {
    const view = await frequency({ scheme });
    assert.deepEqual(choices.map((choice) => choice.id), ids);
    assert.ok(text(view.tree, content.question));
    assert.ok(text(view.tree, content.description));
    assert.deepEqual(view.tree.root.findAllByType("Text").map(textOf).filter((value) => choices.some((choice) => choice.title === value)), choices.map((choice) => choice.title));
    const tagged = choices.filter((choice) => choice.tag);
    assert.deepEqual(tagged.map((choice) => [choice.id, choice.tag.text, choice.tag.type]), [["3-days", "Recommended for you", "recommended"], ["4-days", "Recommended for you", "recommended"]]);
    assert.equal(view.tree.root.findAllByType("Text").filter((node) => textOf(node) === "Recommended for you").length, 2);
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    assert.deepEqual(selectedIds(view.tree), []);
    assert.deepEqual(view.calls.reads, ["primerep.onboardingDraft.v1"]);
    await unmount(view.tree);
  });
  test(`behavior: ${label} missing, empty and undefined frequency gate direct Next invocation`, async () => {
    for (const data of [{}, { workoutFrequency: "" }, { workoutFrequency: undefined }]) {
      const view = await frequency({ scheme, data });
      assert.equal(button(view.tree).props.disabled, true);
      assert.equal(button(view.tree).props.accessibilityState.disabled, true);
      await act(async () => button(view.tree).props.onPress());
      assert.deepEqual(view.calls.fields, []);
      assert.deepEqual(view.calls.routes, []);
      await unmount(view.tree);
    }
  });
  test(`behavior: ${label} each choice writes only workoutFrequency, persists and enables exact Next route`, async () => {
    for (const choice of choices) {
      const view = await frequency({ scheme });
      const before = plain(view.data());
      await act(async () => option(view.tree, choice.id).props.onPress());
      assert.deepEqual(view.calls.fields, [["workoutFrequency", choice.id]]);
      assert.deepEqual(plain(view.data()), { ...before, workoutFrequency: choice.id });
      assert.deepEqual(selectedIds(view.tree), [choice.id]);
      assert.equal(button(view.tree).props.disabled, false);
      assert.equal(button(view.tree).props.accessibilityState.disabled, false);
      assert.deepEqual(view.calls.routes, []);
      assert.equal(view.calls.stored.at(-1).key, "primerep.onboardingDraft.v1");
      assert.equal(JSON.parse(view.calls.stored.at(-1).value).workoutFrequency, choice.id);
      await act(async () => button(view.tree).props.onPress());
      assert.deepEqual(view.calls.routes, ["/onboarding/workout-split"]);
      await unmount(view.tree);
    }
  });
  test(`behavior: ${label} all context-prefilled choices enable Next without field writes`, async () => {
    for (const choice of choices) {
      const view = await frequency({ scheme, data: { workoutFrequency: choice.id, selectedEquipment: ["plates"], plateWeights: [5, 10], weightUnit: "KG", benchPress1RM: 100 } });
      assert.equal(button(view.tree).props.disabled, false);
      assert.equal(view.data().workoutFrequency, choice.id);
      assert.deepEqual(selectedIds(view.tree), [choice.id]);
      assert.deepEqual(view.calls.fields, []);
      await act(async () => button(view.tree).props.onPress());
      assert.deepEqual(view.calls.routes, ["/onboarding/workout-split"]);
      assert.deepEqual(Array.from(view.data().plateWeights), [5, 10]);
      assert.equal(view.data().weightUnit, "KG");
      assert.equal(view.data().benchPress1RM, 100);
      await unmount(view.tree);
    }
  });
  test(`behavior: ${label} replacement, repeated selection and repeated Next preserve existing calls`, async () => {
    const view = await frequency({ scheme, data: { workoutFrequency: "1-day", reason: "structure", workoutSplit: "custom", customWorkouts: [{ id: "day", name: "Upper" }] } });
    const before = plain(view.data());
    for (const id of ["3-days", "every-day", "every-day"]) await act(async () => option(view.tree, id).props.onPress());
    assert.deepEqual(view.calls.fields, [["workoutFrequency", "3-days"], ["workoutFrequency", "every-day"], ["workoutFrequency", "every-day"]]);
    assert.deepEqual(plain(view.data()), { ...before, workoutFrequency: "every-day" });
    assert.deepEqual(selectedIds(view.tree), ["every-day"]);
    for (let count = 0; count < 2; count += 1) await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.routes, ["/onboarding/workout-split", "/onboarding/workout-split"]);
    await unmount(view.tree);
  });
  test(`behavior: ${label} post-mount context changes retain local gating until a route remount`, async () => {
    const view = await frequency({ scheme });
    await act(async () => view.update("workoutFrequency", "4-days"));
    assert.equal(view.data().workoutFrequency, "4-days");
    assert.equal(button(view.tree).props.disabled, true);
    assert.deepEqual(selectedIds(view.tree), []);
    await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.routes, []);
    await view.remount();
    assert.equal(button(view.tree).props.disabled, false);
    assert.deepEqual(selectedIds(view.tree), ["4-days"]);
    await act(async () => option(view.tree, "2-days").props.onPress());
    await act(async () => view.update("workoutFrequency", ""));
    assert.equal(button(view.tree).props.disabled, false);
    assert.deepEqual(selectedIds(view.tree), ["2-days"]);
    await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.routes, ["/onboarding/workout-split"]);
    await view.remount();
    assert.equal(button(view.tree).props.disabled, true);
    assert.deepEqual(selectedIds(view.tree), []);
    assert.deepEqual(view.calls.fields, [["workoutFrequency", "2-days"]]);
    await unmount(view.tree);
  });
  test(`behavior: ${label} selecting then remounting restores the provider draft and enabled action`, async () => {
    const view = await frequency({ scheme });
    await act(async () => option(view.tree, "6-days").props.onPress());
    const persisted = JSON.parse(view.calls.stored.at(-1).value);
    await unmount(view.tree);
    const restored = await frequency({ scheme, data: persisted });
    assert.equal(restored.data().workoutFrequency, "6-days");
    assert.deepEqual(selectedIds(restored.tree), ["6-days"]);
    assert.equal(button(restored.tree).props.disabled, false);
    assert.deepEqual(restored.calls.fields, []);
    await act(async () => button(restored.tree).props.onPress());
    assert.deepEqual(restored.calls.routes, ["/onboarding/workout-split"]);
    await unmount(restored.tree);
  });
  test(`motion: ${label} real route, transition, checkmark and button retain exact timing`, async () => {
    const view = await frequency({ scheme });
    assert.deepEqual(view.calls.animations.filter((call) => call.kind === "delay").map((call) => call.delay).sort((a, b) => a - b), [200, 200, 400, 400, 600, 600, 700, 700, 800, 800, 900, 900, 1000, 1000, 1100, 1100, 1200, 1200]);
    assert.equal(view.calls.animations.filter((call) => call.kind === "timing" && call.config.duration === 250).length, 2);
    assert.equal(view.calls.animations.filter((call) => call.kind === "timing" && call.config.duration === 400).length, 18);
    await act(async () => option(view.tree, "3-days").props.onPress());
    assert.ok(view.calls.animations.some((call) => call.kind === "sequence" && call.values.join(",") === "1.15,1"));
    assert.ok(view.calls.animations.some((call) => call.kind === "timing" && call.config.duration === 150));
    await act(async () => button(view.tree).props.onPressIn({ nativeEvent: {} }));
    assert.equal(styleOf(button(view.tree)).transform[0].scale, 0.96);
    await act(async () => button(view.tree).props.onPressOut({ nativeEvent: {} }));
    assert.equal(styleOf(button(view.tree)).transform[0].scale, 1);
    assert.deepEqual(plain(view.calls.animations.filter((call) => call.kind === "spring").map(({ value, config }) => [value, config])), [[0.96, { damping: 15, stiffness: 300 }], [1, { damping: 15, stiffness: 300 }]]);
    for (const call of view.calls.animations) assert.equal(call.reduceMotion ?? call.config?.reduceMotion, undefined);
    await unmount(view.tree);
  });
}

test("scope: complete Training Frequency controller and motion stay byte-identical", () => {
  const controller = (input) => input.slice(input.indexOf("export default function TrainingFrequencyScreen()"), input.indexOf("\n  return ("));
  assert.equal(controller(source(route)), controller(original(route)));
  const imports = (input) => input.slice(0, input.indexOf("export default function TrainingFrequencyScreen()"));
  const expected = imports(original(route))
    .replace('import { ScrollView, StyleSheet, Text, View } from "react-native";', 'import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";')
    .replace('import { SelectableOptionCard } from "@/components/selectable-option-card";', 'import { AnimatedCheckmark } from "@/components/animated-checkmark";');
  assert.equal(imports(source(route)), expected);
});
test("scope: only Training Frequency content is frozen to its original exact object", () => {
  assert.deepEqual(plain(content), plain(load("features/onboarding/constants.ts", {}, original("features/onboarding/constants.ts")).TRAINING_FREQUENCY_SCREEN));
});

const host = (tree, id) => (tree.root ?? tree).findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const card = (tree, id) => host(tree, `training-frequency-option-${id}`).findAllByType("View")[0];
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
  test(`presentation: ${scheme} all seven choices expose exclusive radio state and visible neutral selection`, async () => {
    const view = await frequency({ scheme });
    for (const selected of [null, ...choices]) {
      if (selected) await act(async () => option(view.tree, selected.id).props.onPress());
      for (const choice of choices) {
        const checked = choice.id === selected?.id;
        const row = host(view.tree, `training-frequency-option-${choice.id}`);
        assert.equal(row.props.accessible, true);
        assert.equal(row.props.accessibilityRole, "radio");
        assert.equal(row.props.accessibilityState.checked, checked);
        assert.equal(row.props.accessibilityLabel, `${choice.title}${choice.tag ? `. ${choice.tag.text}` : ""}`);
        assert.equal(styleOf(card(view.tree, choice.id)).backgroundColor, view.colors.inputBackground);
        assert.equal(styleOf(card(view.tree, choice.id)).borderColor, checked ? view.colors.icon : view.colors.inputBorder);
        assert.equal(styleOf(card(view.tree, choice.id)).borderWidth, 2);
        assert.ok(styleOf(card(view.tree, choice.id)).minHeight >= 44);
        const indicator = host(view.tree, `training-frequency-indicator-${choice.id}`);
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
        assert.ok(contrast(view.colors.icon, view.colors.inputBackground) >= 3);
      }
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} question, helper and exact recommendation tags remain readable`, async () => {
    const view = await frequency({ scheme });
    const question = host(view.tree, "training-frequency-question");
    assert.equal(question.props.accessibilityRole, "header");
    assert.equal(styleOf(question).fontSize, 28);
    assert.equal(styleOf(question).fontWeight, "600");
    assert.equal(styleOf(question).color, view.colors.text);
    const helper = host(view.tree, "training-frequency-description");
    assert.equal(textOf(helper), content.description);
    assert.equal(styleOf(helper).color, view.colors.icon);
    assert.ok(contrast(view.colors.icon, view.colors.background) >= 4.5);
    for (const choice of choices) {
      const title = host(view.tree, `training-frequency-title-${choice.id}`);
      assert.equal(textOf(title), choice.title);
      assert.equal(styleOf(title).color, view.colors.text);
      assert.ok(contrast(styleOf(title).color, view.colors.inputBackground) >= 4.5);
      if (choice.tag) {
        const tag = host(view.tree, `training-frequency-tag-${choice.id}`);
        const label = host(view.tree, `training-frequency-tag-text-${choice.id}`);
        assert.equal(styleOf(tag).backgroundColor, view.colors.inputBorder);
        assert.equal(styleOf(tag).alignSelf, "flex-start");
        assert.equal(styleOf(tag).maxWidth, "100%");
        assert.equal(textOf(label), choice.tag.text);
        assert.ok(contrast(styleOf(label).color, styleOf(tag).backgroundColor) >= 4.5);
      }
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} actual Continue target is neutral disabled and owns enabled purple`, async () => {
    const view = await frequency({ scheme });
    const action = button(view.tree);
    assert.equal(action.props.testID, "training-frequency-continue");
    assert.equal(action.props.accessibilityRole, "button");
    assert.equal(action.props.accessibilityLabel, "Continue");
    assert.equal(textOf(action), "Continue");
    assert.ok(styleOf(action).minHeight >= 56);
    assert.equal(styleOf(action).flexShrink, 0);
    assert.equal(styleOf(action).backgroundColor, view.colors.inputBackground);
    assert.equal(styleOf(action).borderColor, view.colors.inputBorder);
    assert.equal(styleOf(action.findByType("Text")).color, view.colors.icon);
    await act(async () => option(view.tree, "3-days").props.onPress());
    assert.equal(styleOf(action).backgroundColor, view.colors.primaryButton);
    assert.equal(styleOf(action).borderColor, view.colors.primaryButton);
    assert.ok(contrast(styleOf(action.findByType("Text")).color, view.colors.primaryButton) >= 4.5);
    for (const phase of ["onPressIn", "onPressOut"]) {
      await act(async () => action.props[phase]({ nativeEvent: {} }));
      assert.equal(styleOf(action).backgroundColor, view.colors.primaryButton);
      assert.equal(styleOf(action).opacity, undefined);
    }
    for (const node of view.tree.root.findAll((node) => typeof node.type === "string")) {
      for (const property of ["color", "backgroundColor", "borderColor"]) if (styleOf(node)[property] === view.colors.primaryButton) assert.equal(node.props.testID, "training-frequency-continue");
    }
    await unmount(view.tree);
  });
  test(`presentation: ${scheme} normal and maximum text keep all choices and growing Continue in one scroll`, async () => {
    for (const fontScale of [1, 3.1]) {
      const view = await frequency({ scheme, fontScale });
      const scroll = host(view.tree, "training-frequency-scroll");
      assert.equal(view.tree.root.findAllByType("ScrollView").length, 1);
      assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
      assert.equal(flat(scroll.props.contentContainerStyle).flexGrow, 1);
      assert.equal(flat(scroll.props.contentContainerStyle).flex, undefined);
      for (const id of ["training-frequency-question", "training-frequency-description", "training-frequency-continue", ...choices.map((choice) => `training-frequency-option-${choice.id}`)]) assert.ok(host(scroll, id));
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
        const copy = host(view.tree, `training-frequency-title-${choice.id}`).parent;
        assert.equal(styleOf(copy).flex, 1);
        assert.equal(styleOf(copy).minWidth, 0);
        assert.equal(styleOf(card(view.tree, choice.id)).height, undefined);
      }
      await unmount(view.tree);
    }
  });
}
