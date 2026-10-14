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
const options = (tree) => tree.root.findAllByType("TouchableOpacity").filter((node) => node.props.accessibilityRole === "radio");
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
  const layout = { dimensions: { width: config.width ?? 390, height: 844, scale: 3, fontScale: config.fontScale ?? 1 }, insets: { top: 0, right: 0, left: 0, bottom: config.bottomInset ?? 34 } };
  const mocks = commonMocks(config.scheme ?? "light", calls.animations, { ...native, useWindowDimensions: () => layout.dimensions });
  mocks["react-native-safe-area-context"] = { useSafeAreaInsets: () => layout.insets };
  mocks["@/features/onboarding/constants"] = constants;
  mocks["@/utils/authContext"] = { AuthContext: React.createContext({ isBootstrapping: false, isLoggedIn: false }) };
  mocks["expo-router"] = {
    useRouter: () => ({ push: (value) => calls.routes.push(value) }),
    Stack: { Screen: ({ options }) => { React.useEffect(() => { calls.header = options; }, [options]); return null; } },
  };
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
  return { tree, calls, storage, data: () => context.getOnboardingData(), update: (field, value) => context.updateField(field, value), remount: async () => { screenKey += 1; await act(async () => tree.update(element())); }, resize: async (dimensions) => { Object.assign(layout.dimensions, dimensions); await act(async () => tree.update(element())); } };
}
function visualTree(node) {
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(visualTree);
  return { type: node.type, props: Object.fromEntries(Object.entries(node.props).filter(([key, value]) => !["accessibilityRole", "accessibilityLabel", "accessibilityState", "aria-checked", "testID"].includes(key) && !(node.type === "ScrollView" && key === "contentInsetAdjustmentBehavior") && typeof value !== "function")), children: node.children?.map(visualTree) ?? null };
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
  test(`presentation: ${scheme} normal screen layout and animations retain the original apart from inset opt-in`, async () => {
    for (const data of [{}, { varietyLevel: "consistent" }, { varietyLevel: "balanced" }, { varietyLevel: "varied" }]) {
      const current = await variety({ scheme, data });
      const baseline = await variety({ scheme, data, original: true });
      assert.deepEqual(plain(visualTree(current.tree.toJSON())), plain(visualTree(baseline.tree.toJSON())));
      assert.deepEqual(plain(current.calls.animations), plain(baseline.calls.animations));
      assert.deepEqual(plain(current.data()), plain(baseline.data()));
      assert.equal(current.tree.root.findByType("ScrollView").props.contentInsetAdjustmentBehavior, "automatic");
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
test("scope: controller and original styles stay exact; copy changes only the approved question", () => {
  const code = source(route), before = original(route);
  const controller = (input) => input.slice(input.indexOf("export default function"), input.indexOf("\n  return ("))
    .replace("  const { fontScale } = useWindowDimensions();\n  const insets = useSafeAreaInsets();\n  const largeText = fontScale > 1.3;\n", "");
  assert.equal(controller(code), controller(before));
  assert.equal(Buffer.byteLength(controller(code)), 3756);
  assert.equal(sha(controller(code)), "708988e89643d136b2443c5cbbd394b3e602f5022da2c19f90788f422b479526");
  const imports = (input) => input.slice(0, input.indexOf("export default function"));
  assert.equal(imports(code), imports(before)
    .replace('import { useRouter } from "expo-router";', 'import { Stack, useRouter } from "expo-router";')
    .replace('import { ScrollView, StyleSheet, Text, View } from "react-native";', 'import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";\nimport { useSafeAreaInsets } from "react-native-safe-area-context";'));
  for (const file of [route, cardFile]) {
    const styles = (input) => {
      let result;
      const mocks = commonMocks("light", []);
      mocks["react-native"] = { ...native, StyleSheet: { create: (value) => { result = value; return value; } } };
      for (const dependency of ["expo-router", "react-native-safe-area-context", "@/utils/onboardingContext", "@/components/selectable-option-card"]) mocks[dependency] = {};
      mocks["@/features/onboarding/constants"] = constants;
      load(file, mocks, input);
      return plain(result);
    };
    const current = styles(source(file)), prior = styles(original(file));
    for (const [key, value] of Object.entries(prior)) assert.deepEqual(current[key], value, `${file} ${key}`);
  }
  assert.equal(source("features/onboarding/constants.ts").replace('question: "How much variety do you want?"', 'question: "How would you like us to select your exercises?"'), original("features/onboarding/constants.ts"));
});

const flat = (value) => Array.isArray(value) ? Object.assign({}, ...value.map(flat)) : value ?? {};
const host = (tree, id) => tree.root.find((node) => typeof node.type === "string" && node.props.testID === id);
const descendant = (node, parent) => { for (let current = node; current; current = current.parent) if (current === parent) return true; return false; };
for (const scheme of ["light", "dark"]) {
  test(`large text: ${scheme} dimensions, safe areas and threshold retain uncapped content and reachable actions`, async () => {
    for (const config of [
      { fontScale: 1, width: 320, bottomInset: 0 },
      { fontScale: 1.3, width: 390, bottomInset: 34 },
      { fontScale: 1.31, width: 320, bottomInset: 70 },
      { fontScale: 2, width: 390, bottomInset: 34 },
      { fontScale: 3.1, width: 320, bottomInset: 0 },
      { fontScale: 3.1, width: 430, bottomInset: 70 },
    ]) {
      const view = await variety({ scheme, ...config });
      const scroll = host(view.tree, "variety-scroll");
      const expanded = config.fontScale > 1.3;
      assert.equal(view.tree.root.findAllByType("ScrollView").length, 1);
      assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
      assert.deepEqual(plain(flat(scroll.props.contentContainerStyle)), { flexGrow: 1, paddingBottom: expanded ? 0 : 120 });
      assert.equal(descendant(button(view.tree), scroll), expanded);
      assert.equal(button(view.tree).props.disabled, true);
      assert.equal(textOf(view.tree.toJSON()).includes("How much variety do you want?"), true);
      if (expanded) {
        assert.equal(view.calls.header.headerRight(), null);
        const skip = host(view.tree, "variety-skip");
        assert.ok(descendant(skip, scroll));
        assert.equal(skip.props.accessibilityRole, "button");
        assert.equal(flat(skip.props.style).minHeight, 44);
        assert.equal(flat(skip.props.style).minWidth, 44);
        const footer = scroll.findAllByType("View").find((node) => descendant(button(view.tree), node));
        assert.equal(flat(footer.props.style).paddingBottom, Math.max(24, config.bottomInset));
        const buttonBody = button(view.tree).findByType("View");
        assert.equal(flat(buttonBody.props.style).minHeight, 44);
      } else {
        assert.equal(view.tree.root.findAll((node) => node.props.testID === "variety-skip").length, 0);
        assert.equal(view.calls.header.headerRight().props.children.props.children, "Skip");
      }
      for (const choice of choices) {
        const card = option(view.tree, choice.id);
        assert.ok(descendant(card, scroll));
        assert.equal(card.props.accessibilityLabel, label(choice));
        const title = card.findAllByType("Text").find((node) => textOf(node) === choice.title);
        const description = card.findAllByType("Text").find((node) => textOf(node) === choice.description);
        assert.equal(title.parent.parent, description.parent);
        if (expanded) {
          assert.equal(flat(title.props.style).flex, 1);
          assert.equal(flat(title.props.style).minWidth, 0);
          assert.equal(flat(description.parent.props.style).minWidth, 0);
          assert.equal(description.parent.parent.children.length, 1);
          assert.equal(title.parent.children.length, 2);
          assert.equal(card.findAllByType("Text").some((node) => textOf(node) === "✓"), false);
        }
      }
      for (const node of scroll.findAll((node) => typeof node.type === "string")) {
        assert.notEqual(flat(node.props.style).position, "absolute");
        assert.notEqual(flat(node.props.style).overflow, "hidden");
      }
      for (const node of view.tree.root.findAllByType("Text")) {
        for (const prop of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(node.props[prop], undefined);
        assert.notEqual(node.props.allowFontScaling, false);
        assert.equal(flat(node.props.style).height, undefined);
      }
      await close(view.tree);
    }
  });
  test(`large text: ${scheme} mounted normal to enlarged to normal restores header and preserves selection`, async () => {
    const view = await variety({ scheme, data: { varietyLevel: "balanced", preferredName: "Alex" } });
    const before = plain(view.data());
    const animations = plain(view.calls.animations);
    const normal = plain(visualTree(view.tree.toJSON()));
    const pressHeaderSkip = () => {
      const header = view.calls.header.headerRight();
      assert.equal(header.type, "TouchableOpacity");
      assert.equal(header.props.children.props.children, "Skip");
      assert.equal(header.props.style.minHeight, 44);
      assert.equal(header.props.style.minWidth, 44);
      header.props.onPress();
    };
    pressHeaderSkip();
    await view.resize({ fontScale: 2, width: 320 });
    assert.equal(view.calls.header.headerRight(), null);
    await act(async () => host(view.tree, "variety-skip").props.onPress());
    assert.deepEqual(checked(view.tree), ["balanced"]);
    await view.resize({ fontScale: 1, width: 390 });
    pressHeaderSkip();
    assert.deepEqual(plain(visualTree(view.tree.toJSON())), normal);
    assert.deepEqual(checked(view.tree), ["balanced"]);
    assert.deepEqual(plain(view.data()), before);
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, Array(3).fill("/onboarding/final"));
    assert.deepEqual(plain(view.calls.animations.slice(0, animations.length)), animations);
    assert.deepEqual(plain(view.calls.animations.slice(animations.length)), [...animations.slice(0, 5), ...animations.slice(0, 5)]);
    await close(view.tree);
  });
  test(`large text: ${scheme} all choices retain writes, repeated actions and full Provider restore`, async () => {
    for (const choice of choices) {
      const view = await variety({ scheme, fontScale: 3.1, width: 320 });
      const before = plain(view.data());
      await act(async () => button(view.tree).props.onPress());
      assert.deepEqual(view.calls.routes, []);
      for (let index = 0; index < 2; index += 1) await act(async () => option(view.tree, choice.id).props.onPress());
      assert.deepEqual(view.calls.fields, [["varietyLevel", choice.id], ["varietyLevel", choice.id]]);
      assert.deepEqual(checked(view.tree), [choice.id]);
      for (const optionChoice of choices) assert.equal(option(view.tree, optionChoice.id).props["aria-checked"], optionChoice.id === choice.id);
      assert.deepEqual(plain(view.data()), { ...before, varietyLevel: choice.id });
      assert.equal(button(view.tree).props.disabled, false);
      for (let index = 0; index < 2; index += 1) await act(async () => button(view.tree).props.onPress());
      await act(async () => host(view.tree, "variety-skip").props.onPress());
      assert.deepEqual(view.calls.routes, ["/onboarding/training-place", "/onboarding/training-place", "/onboarding/final"]);
      const draft = plain(view.data());
      await close(view.tree);
      const restored = await variety({ scheme, fontScale: 3.1, storage: view.storage });
      assert.deepEqual(checked(restored.tree), [choice.id]);
      assert.deepEqual(plain(restored.data()), draft);
      assert.deepEqual(restored.calls.fields, []);
      await close(restored.tree);
    }
  });
  test(`large text: ${scheme} RN-web opt-in retains exactly one named, checked, tabbable radio`, () => {
    const rn = createRequire(import.meta.url)("react-native-web");
    const mocks = commonMocks(scheme, [], rn);
    const { SelectableOptionCard } = load(cardFile, mocks);
    for (const checked of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(SelectableOptionCard, { title: choices[1].title, description: choices[1].description, isSelected: checked, onPress() {}, fullWidthDescription: true, accessibilityRole: "radio", accessibilityLabel: label(choices[1]), accessibilityState: { checked }, "aria-checked": checked, testID: "variety-option-balanced" }));
      assert.match(html, new RegExp(`aria-checked="${checked}"`));
      assert.equal((html.match(/role="radio"/g) ?? []).length, 1);
      assert.equal((html.match(/tabindex="0"/g) ?? []).length, 1);
      assert.ok(html.includes(label(choices[1])));
      assert.ok(html.includes(choices[1].description));
    }
  });
}
test("scope: Provider, prior screen tests and their refined consumers stay unchanged", () => {
  for (const file of ["utils/onboardingContext.tsx", "app/onboarding/first-reason.tsx", "app/onboarding/fitness-experience/index.tsx", "app/onboarding/fitness-goal.tsx", "app/onboarding/training-frequency.tsx", "app/onboarding/workout-split/index.tsx", "app/onboarding/workout-split/custom.tsx", "scripts/test-first-reason-ui.mjs", "scripts/test-fitness-experience-ui.mjs", "scripts/test-fitness-goal-ui.mjs", "scripts/test-training-frequency-ui.mjs", "scripts/test-workout-split-ui.mjs", "scripts/test-custom-split-ui.mjs"]) assert.equal(sha(source(file)), sha(original(file)), file);
});
