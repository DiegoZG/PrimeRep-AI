import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import ts from "typescript";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "a2e1a3788420585e74e35a7286f4e79a7512aee7";
const route = "app/onboarding/variety-level.tsx";
const cardFile = "components/selectable-option-card.tsx";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const original = (file) => execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" });
const plain = (value) => JSON.parse(JSON.stringify(value));
const sha = (value) => createHash("sha256").update(value).digest("hex");
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
const constants = load("features/onboarding/constants.ts", {});
const content = constants.VARIETY_LEVEL_SCREEN;
const choices = Array.from(content.options);
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const options = (tree) => tree.root.findAllByType("TouchableOpacity");
const option = (tree, id) => options(tree).find((node) => textOf(node).includes(choices.find((choice) => choice.id === id).title));
const button = (tree) => tree.root.findByType("Pressable");
const label = (choice) => `${choice.title}. ${choice.description}`;
const checked = (tree) => choices.filter((choice) => option(tree, choice.id).props.accessibilityState?.checked).map((choice) => choice.id);
const close = async (tree) => { await act(async () => tree.unmount()); };
function animation(calls, rn = native) {
  return {
    __esModule: true, default: { View: rn.View === "View" ? "AnimatedView" : rn.View, createAnimatedComponent: (component) => component },
    useSharedValue: (value) => React.useRef({ value }).current,
    useAnimatedStyle: (fn) => new Proxy({}, { get: (_, key) => fn()[key], ownKeys: () => Reflect.ownKeys(fn()), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }),
    withTiming: (value, config) => { calls.push(["timing", value, config]); return value; },
    withDelay: (delay, value) => { calls.push(["delay", delay, value]); return value; },
    withSpring: (value, config) => { calls.push(["spring", value, config]); return value; },
    withSequence: (...values) => { calls.push(["sequence", values]); return values.at(-1); },
  };
}
function commonMocks(scheme, calls, rn = native) {
  const mocks = { react: React, "react-native": rn, "react-native-reanimated": animation(calls, rn), "@expo/vector-icons": { Ionicons: rn.View === "View" ? "Ionicons" : "span" }, "@/hooks/use-color-scheme": { useColorScheme: () => scheme } };
  for (const [alias, file] of [["@/constants/theme", "constants/theme.ts"], ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"], ["@/hooks/use-screen-transition", "hooks/use-screen-transition.ts"], ["@/components/themed-view", "components/themed-view.tsx"], ["@/components/animated-button", "components/animated-button.tsx"], ["@/components/animated-checkmark", "components/animated-checkmark.tsx"]]) mocks[alias] = load(file, mocks);
  return mocks;
}
async function variety(config = {}) {
  const calls = { fields: [], routes: [], animations: [], reads: [], stored: [], removed: [] };
  const storage = config.storage ?? { value: JSON.stringify(config.data ?? { preferredName: "Alex", reason: "structure", selectedEquipment: ["plates"], plateWeights: [5, 10], weightUnit: "KG", benchPress1RM: 100 }) };
  const mocks = commonMocks(config.scheme ?? "light", calls.animations);
  mocks["@/features/onboarding/constants"] = constants;
  mocks["@/utils/authContext"] = { AuthContext: React.createContext({ isBootstrapping: false, isLoggedIn: false }) };
  mocks["expo-router"] = { useRouter: () => ({ push: (value) => calls.routes.push(value) }) };
  mocks["@react-native-async-storage/async-storage"] = {
    getItem: async (key) => { calls.reads.push(key); return storage.value; },
    setItem: async (key, value) => { calls.stored.push({ key, value }); storage.value = value; },
    removeItem: async (key) => { calls.removed.push(key); storage.value = null; },
  };
  mocks["@/utils/onboardingContext"] = load("utils/onboardingContext.tsx", mocks);
  mocks["@/components/selectable-option-card"] = load(cardFile, mocks, config.original ? original(cardFile) : source(cardFile));
  const { OnboardingContext, OnboardingProvider } = mocks["@/utils/onboardingContext"];
  const { default: Screen } = load(route, mocks, config.original ? original(route) : source(route));
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
  return { tree, calls, storage, data: () => context.getOnboardingData(), update: (field, value) => context.updateField(field, value), remount: async () => { screenKey += 1; await act(async () => tree.update(element())); } };
}
function visualTree(node) {
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(visualTree);
  return { type: node.type, props: Object.fromEntries(Object.entries(node.props).filter(([key, value]) => !["accessibilityRole", "accessibilityLabel", "accessibilityState", "aria-checked", "testID"].includes(key) && typeof value !== "function")), children: node.children?.map(visualTree) ?? null };
}
for (const scheme of ["light", "dark"]) {
  test(`semantics: ${scheme} three named radios start unchecked, with no duplicate touchable shell`, async () => {
    const view = await variety({ scheme });
    assert.deepEqual(choices.map((choice) => choice.id), ["consistent", "balanced", "varied"]);
    assert.equal(options(view.tree).length, 3);
    for (const choice of choices) {
      const node = option(view.tree, choice.id);
      assert.equal(node.props.accessibilityLabel, label(choice));
      assert.equal(node.props.accessibilityRole, "radio");
      assert.deepEqual(plain(node.props.accessibilityState), { checked: false });
      assert.equal(node.props["aria-checked"], false);
      assert.equal(node.props.testID, `variety-option-${choice.id}`);
      assert.equal(node.props.accessibilityLabel.includes("✓"), false);
      assert.equal(node.props.onAccessibilityTap, undefined);
    }
    assert.equal(button(view.tree).props.disabled, true);
    await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    await close(view.tree);
  });
  test(`behavior: ${scheme} each choice updates only varietyLevel, persists and enables the existing Next route`, async () => {
    for (const choice of choices) {
      const view = await variety({ scheme });
      const before = plain(view.data());
      await act(async () => option(view.tree, choice.id).props.onPress());
      assert.deepEqual(view.calls.fields, [["varietyLevel", choice.id]]);
      assert.deepEqual(plain(view.data()), { ...before, varietyLevel: choice.id });
      assert.deepEqual(checked(view.tree), [choice.id]);
      assert.equal(button(view.tree).props.disabled, false);
      assert.equal(button(view.tree).props.accessibilityState.disabled, false);
      assert.equal(JSON.parse(view.calls.stored.at(-1).value).varietyLevel, choice.id);
      assert.equal(view.calls.stored.at(-1).key, "primerep.onboardingDraft.v1");
      await act(async () => button(view.tree).props.onPress());
      assert.deepEqual(view.calls.routes, ["/onboarding/training-place"]);
      await close(view.tree);
    }
  });
  test(`behavior: ${scheme} restored choices and replacement/repeated presses preserve existing call behavior`, async () => {
    for (const choice of choices) {
      const view = await variety({ scheme, data: { varietyLevel: choice.id, preferredName: "Alex" } });
      assert.deepEqual(checked(view.tree), [choice.id]);
      assert.deepEqual(view.calls.fields, []);
      assert.equal(button(view.tree).props.disabled, false);
      for (const id of ["balanced", "varied", "varied"]) await act(async () => option(view.tree, id).props.onPress());
      assert.deepEqual(view.calls.fields, [["varietyLevel", "balanced"], ["varietyLevel", "varied"], ["varietyLevel", "varied"]]);
      assert.deepEqual(checked(view.tree), ["varied"]);
      for (let index = 0; index < 2; index += 1) await act(async () => button(view.tree).props.onPress());
      assert.deepEqual(view.calls.routes, ["/onboarding/training-place", "/onboarding/training-place"]);
      await close(view.tree);
    }
  });
  test(`behavior: ${scheme} context changes retain current local gating until route remount`, async () => {
    const view = await variety({ scheme });
    await act(async () => view.update("varietyLevel", "balanced"));
    assert.equal(button(view.tree).props.disabled, true);
    assert.deepEqual(checked(view.tree), []);
    await view.remount();
    assert.deepEqual(checked(view.tree), ["balanced"]);
    assert.equal(button(view.tree).props.disabled, false);
    await act(async () => view.update("varietyLevel", ""));
    assert.deepEqual(checked(view.tree), ["balanced"]);
    await view.remount();
    assert.deepEqual(checked(view.tree), []);
    assert.equal(button(view.tree).props.disabled, true);
    await close(view.tree);
  });
  test(`persistence: ${scheme} real Provider rehydrates selected variety after full unmount`, async () => {
    const first = await variety({ scheme });
    await act(async () => option(first.tree, "varied").props.onPress());
    const before = plain(first.data());
    await close(first.tree);
    const restored = await variety({ scheme, storage: first.storage });
    assert.deepEqual(plain(restored.data()), before);
    assert.deepEqual(checked(restored.tree), ["varied"]);
    assert.deepEqual(restored.calls.fields, []);
    assert.deepEqual(restored.calls.reads, ["primerep.onboardingDraft.v1"]);
    await close(restored.tree);
  });
  test(`presentation: ${scheme} full screen host tree and animations remain equivalent to original`, async () => {
    for (const data of [{}, { varietyLevel: "consistent" }, { varietyLevel: "balanced" }, { varietyLevel: "varied" }]) {
      const current = await variety({ scheme, data });
      const baseline = await variety({ scheme, data, original: true });
      assert.deepEqual(plain(visualTree(current.tree.toJSON())), plain(visualTree(baseline.tree.toJSON())));
      assert.deepEqual(plain(current.calls.animations), plain(baseline.calls.animations));
      assert.deepEqual(plain(current.data()), plain(baseline.data()));
      await close(current.tree); await close(baseline.tree);
    }
  });
  test(`shared default: ${scheme} existing selected/tag/icon/chevron variants retain identical host props and layout`, async () => {
    const mocks = commonMocks(scheme, []);
    const current = load(cardFile, mocks).SelectableOptionCard;
    const baseline = load(cardFile, mocks, original(cardFile)).SelectableOptionCard;
    const onPress = () => {};
    for (const extra of [{}, { isSelected: true }, { tag: { text: "Popular", type: "popular" } }, { tag: { text: "Recommended", type: "recommended" } }, { tag: { text: "Powerlifting", type: "powerlifting" } }, { tag: { text: "Advanced", type: "advanced" } }, { icon: "★", showChevron: true, showCheckbox: false }, { isSelected: true, specialBackground: true, description: "More context" }]) {
      const props = { title: "An existing option", isSelected: false, onPress, ...extra };
      let a, b;
      await act(async () => { a = create(React.createElement(current, props)); b = create(React.createElement(baseline, props)); });
      assert.deepEqual(plain(a.toJSON()), plain(b.toJSON()));
      assert.equal(a.root.findByType("TouchableOpacity").props.onPress, onPress);
      assert.equal(a.root.findByType("TouchableOpacity").props.activeOpacity, 0.8);
      await close(a); await close(b);
    }
  });
  test(`web: ${scheme} actual RN-web TouchableOpacity emits labeled checked radios with existing tabbable markup`, () => {
    const rn = createRequire(import.meta.url)("react-native-web");
    const mocks = commonMocks(scheme, [], rn);
    const { SelectableOptionCard } = load(cardFile, mocks);
    for (const isSelected of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(SelectableOptionCard, { title: "Balanced", description: "A mix of exercises.", isSelected, onPress() {}, accessibilityRole: "radio", accessibilityLabel: "Balanced. A mix of exercises.", accessibilityState: { checked: isSelected }, "aria-checked": isSelected, testID: "variety-option-balanced" }));
      const host = html.match(/^<div\b[^>]*>/)?.[0];
      assert.ok(host);
      assert.match(host, /role="radio"/);
      assert.match(host, /aria-label="Balanced\. A mix of exercises\."/);
      assert.match(host, new RegExp(`aria-checked="${isSelected}"`));
      assert.match(host, /tabindex="0"/);
      assert.match(host, /data-testid="variety-option-balanced"/);
      assert.equal((html.match(/role="radio"/g) ?? []).length, 1);
      assert.equal((html.match(/tabindex="0"/g) ?? []).length, 1);
    }
    const props = { title: "An existing option", isSelected: false, onPress() {} };
    const baseline = load(cardFile, mocks, original(cardFile)).SelectableOptionCard;
    assert.equal(renderToStaticMarkup(React.createElement(SelectableOptionCard, props)), renderToStaticMarkup(React.createElement(baseline, props)));
  });
}
test("shared opt-in: native props land on the existing TouchableOpacity without a wrapper or alternative handler", async () => {
  const mocks = commonMocks("light", []);
  const { SelectableOptionCard } = load(cardFile, mocks);
  const onPress = () => {};
  const props = { title: "Balanced", isSelected: true, onPress, accessibilityLabel: "Balanced. Context.", accessibilityRole: "radio", accessibilityState: { checked: true }, "aria-checked": true, testID: "variety-option-balanced" };
  let tree;
  await act(async () => { tree = create(React.createElement(SelectableOptionCard, props)); });
  assert.equal(tree.toJSON().type, "TouchableOpacity");
  assert.equal(options(tree).length, 1);
  for (const key of ["accessibilityLabel", "accessibilityRole", "accessibilityState", "aria-checked", "testID", "onPress"]) assert.equal(tree.root.findByType("TouchableOpacity").props[key], props[key]);
  assert.equal(tree.root.findByType("TouchableOpacity").props.onAccessibilityTap, undefined);
  await close(tree);
});
test("scope: controller, styles and visible copy remain byte-identical", () => {
  const code = source(route), before = original(route);
  assert.equal(code.slice(0, code.indexOf("  return (")), before.slice(0, before.indexOf("  return (")));
  assert.equal(code.slice(code.indexOf("const styles =")), before.slice(before.indexOf("const styles =")));
  assert.equal(source("features/onboarding/constants.ts"), original("features/onboarding/constants.ts"));
  assert.equal(source(cardFile).slice(source(cardFile).indexOf("const styles =")), original(cardFile).slice(original(cardFile).indexOf("const styles =")));
});
test("scope: Provider, prior screen tests and their refined consumers stay unchanged", () => {
  for (const file of ["utils/onboardingContext.tsx", "app/onboarding/first-reason.tsx", "app/onboarding/fitness-experience/index.tsx", "app/onboarding/fitness-goal.tsx", "app/onboarding/training-frequency.tsx", "app/onboarding/workout-split/index.tsx", "app/onboarding/workout-split/custom.tsx", "scripts/test-first-reason-ui.mjs", "scripts/test-fitness-experience-ui.mjs", "scripts/test-fitness-goal-ui.mjs", "scripts/test-training-frequency-ui.mjs", "scripts/test-workout-split-ui.mjs", "scripts/test-custom-split-ui.mjs"]) assert.equal(sha(source(file)), sha(original(file)), file);
});
