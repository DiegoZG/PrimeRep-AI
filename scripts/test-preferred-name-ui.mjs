import assert from "node:assert/strict";
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
const route = "app/onboarding/index.tsx";
const draftKey = "primerep.onboardingDraft.v1";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const unmount = async (view) => { await act(async () => view.tree.unmount()); };
const draft = { preferredName: "", lastName: "Example", workoutFrequency: 3, workoutSplit: "ai-optimized", selectedEquipment: ["plates"], dumbbellWeights: [5], plateWeights: [10], nested: { retained: true } };
function load(file, mocks) {
  const filename = path.join(root, file);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const code = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), process: { env: {} }, __DEV__: false, console: { ...console, warn() {}, error() {} } }, { filename });
  return module.exports;
}
const nativeHosts = { Pressable: "Pressable", View: "View", Text: "Text", TextInput: "TextInput", ScrollView: "ScrollView", KeyboardAvoidingView: "KeyboardAvoidingView", TouchableWithoutFeedback: "TouchableWithoutFeedback", StyleSheet: { create: (value) => value } };
async function preferredName(options = {}) {
  const calls = { routes: [], fields: [], stored: [], reads: [], removals: [], animations: [], dismissals: 0 };
  const scheme = options.scheme ?? "light";
  const storage = options.storage ?? new Map([[draftKey, JSON.stringify(options.data ?? draft)]]);
  const native = { ...nativeHosts, Platform: { OS: options.platform ?? "ios", select: (values) => values[options.platform ?? "ios"] ?? values.default }, useColorScheme: () => scheme, Keyboard: { dismiss: () => { calls.dismissals += 1; } } };
  const animated = {
    __esModule: true, default: { View: "AnimatedView", createAnimatedComponent: (component) => component },
    useSharedValue: (value) => React.useRef({ value }).current,
    useAnimatedStyle: (callback) => new Proxy({}, { get: (_, key) => callback()[key], ownKeys: () => Reflect.ownKeys(callback()), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }),
    withTiming: (value, config) => { calls.animations.push({ kind: "timing", value, config }); return value; },
    withDelay: (delay, value) => { calls.animations.push({ kind: "delay", delay }); return value; },
    withSpring: (value, config) => { calls.animations.push({ kind: "spring", value, config }); return value; },
  };
  const AuthContext = React.createContext({ isBootstrapping: false, isLoggedIn: false });
  const mocks = {
    react: React, "react-native": native, "react-native-reanimated": animated,
    "expo-router": { useRouter: () => ({ push: (value) => calls.routes.push(value) }), Stack: { Screen: (props) => React.createElement("StackScreen", props) } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 34, ...options.insets }) },
    "@/utils/authContext": { AuthContext },
    "@react-native-async-storage/async-storage": {
      getItem: async (key) => { calls.reads.push(key); return key === "@primerep/theme-preference" ? scheme : storage.get(key) ?? null; },
      setItem: async (key, value) => { storage.set(key, value); calls.stored.push({ key, value }); },
      removeItem: async (key) => { storage.delete(key); calls.removals.push(key); },
    },
  };
  for (const [alias, file] of [
    ["@/constants/theme", "constants/theme.ts"], ["@/utils/appearanceContext", "utils/appearanceContext.tsx"], ["@/hooks/use-color-scheme", "hooks/use-color-scheme.ts"], ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"], ["@/hooks/use-screen-transition", "hooks/use-screen-transition.ts"],
    ["@/components/themed-view", "components/themed-view.tsx"], ["@/components/themed-text", "components/themed-text.tsx"], ["@/components/animated-button", "components/animated-button.tsx"], ["@/components/animated-card", "components/animated-card.tsx"], ["@/components/animated-input", "components/animated-input.tsx"],
    ["@/features/onboarding/styles", "features/onboarding/styles.ts"], ["@/utils/onboardingContext", "utils/onboardingContext.tsx"],
  ]) mocks[alias] = load(file, mocks);
  const { AppearanceProvider } = mocks["@/utils/appearanceContext"];
  const { OnboardingContext, OnboardingProvider } = mocks["@/utils/onboardingContext"];
  const { default: Screen } = load(route, mocks);
  let context;
  function RestoredScreen() {
    const value = React.useContext(OnboardingContext);
    context = value;
    if (value.isRestoring) return null;
    return React.createElement(OnboardingContext.Provider, { value: { ...value, updateField: (field, next) => { calls.fields.push([field, next]); value.updateField(field, next); } } }, React.createElement(Screen));
  }
  let tree;
  await act(async () => { tree = create(React.createElement(AppearanceProvider, null, React.createElement(OnboardingProvider, null, React.createElement(RestoredScreen)))); });
  return { tree, calls, storage, colors: mocks["@/constants/theme"].Colors[scheme], data: () => plain(context.getOnboardingData()), update: (field, value) => context.updateField(field, value) };
}
const input = (view) => view.tree.root.findByType("TextInput");
const next = (view) => view.tree.root.findAllByType("Pressable").find((node) => textOf(node) === "NEXT");
const login = (view) => view.tree.root.findByProps({ testID: "onboarding-login-link" });
const change = async (view, value) => { await act(async () => input(view).props.onChangeText(value)); };
const pressNext = async (view) => { await act(async () => next(view).props.onPress()); };

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: empty first name disables actual Next and direct callback cannot write or route`, async () => {
    const view = await preferredName({ scheme }); const before = view.data();
    assert.equal(input(view).props.value, ""); assert.equal(next(view).props.disabled, true);
    assert.deepEqual(plain(next(view).props.accessibilityState), { disabled: true });
    await pressNext(view); assert.deepEqual(view.calls.fields, []); assert.deepEqual(view.calls.routes, []); assert.deepEqual(view.data(), before);
    await unmount(view);
  });
  test(`${scheme}: whitespace-only drafts remain invalid without mutating the persisted preferred name`, async () => {
    for (const value of ["   ", "\t\n"]) {
      const view = await preferredName({ scheme, data: { ...draft, preferredName: value } });
      assert.equal(input(view).props.value, value); assert.equal(next(view).props.disabled, true);
      await pressNext(view); assert.deepEqual(view.calls.fields, []); assert.deepEqual(view.calls.routes, []); assert.equal(view.data().preferredName, value); await unmount(view);
    }
  });
  test(`${scheme}: the restored real provider prefills the exact untrimmed name and retains other fields`, async () => {
    const view = await preferredName({ scheme, data: { ...draft, preferredName: "  María  " } });
    assert.equal(input(view).props.value, "  María  "); assert.equal(next(view).props.disabled, false);
    assert.deepEqual(view.calls.fields, []); assert.deepEqual(view.calls.routes, []);
    assert.equal(view.data().lastName, "Example"); assert.deepEqual(view.data().nested, { retained: true }); assert.ok(view.calls.reads.includes(draftKey)); await unmount(view);
  });
  test(`${scheme}: typing changes only local input state until Next and preserves the stored draft`, async () => {
    const view = await preferredName({ scheme }); const before = view.data(); const writes = view.calls.stored.length;
    await change(view, "Alex"); assert.equal(input(view).props.value, "Alex"); assert.equal(next(view).props.disabled, false);
    assert.deepEqual(view.data(), before); assert.equal(view.calls.stored.length, writes); assert.deepEqual(view.calls.fields, []); assert.deepEqual(view.calls.routes, []); await unmount(view);
  });
  test(`${scheme}: valid Unicode and punctuation are trimmed only on Next and route to Welcome`, async () => {
    for (const value of ["  María Nguyễn  ", "O’Neil-Sam", "A", "Alex ".repeat(20)]) {
      const view = await preferredName({ scheme }); const before = view.data(); await change(view, value); await pressNext(view);
      assert.deepEqual(view.calls.fields, [["preferredName", value.trim()]]); assert.deepEqual(view.calls.routes, ["/onboarding/welcome"]);
      assert.deepEqual(view.data(), { ...before, preferredName: value.trim() }); assert.equal(input(view).props.value, value); await unmount(view);
    }
  });
  test(`${scheme}: repeated valid Next and replacement retain the original write and navigation semantics`, async () => {
    const view = await preferredName({ scheme }); await change(view, " Alex "); await pressNext(view); await pressNext(view); await change(view, " Sam "); await pressNext(view);
    assert.deepEqual(view.calls.fields, [["preferredName", "Alex"], ["preferredName", "Alex"], ["preferredName", "Sam"]]);
    assert.deepEqual(view.calls.routes, Array(3).fill("/onboarding/welcome")); assert.equal(view.data().preferredName, "Sam"); await unmount(view);
  });
  test(`${scheme}: clearing a saved valid input gates Next without erasing the saved provider name`, async () => {
    const view = await preferredName({ scheme, data: { ...draft, preferredName: "Alex" } }); await change(view, ""); await pressNext(view);
    assert.equal(next(view).props.disabled, true); assert.equal(view.data().preferredName, "Alex"); assert.deepEqual(view.calls.fields, []); assert.deepEqual(view.calls.routes, []); await unmount(view);
  });
  test(`${scheme}: successful Next persists through the real provider and a fresh provider remount`, async () => {
    const view = await preferredName({ scheme }); await change(view, "  Alex  "); await pressNext(view); const saved = view.data(); const storage = view.storage;
    assert.deepEqual(JSON.parse(storage.get(draftKey)), saved); await unmount(view);
    const restored = await preferredName({ scheme, storage }); assert.equal(input(restored).props.value, "Alex"); assert.deepEqual(restored.data(), saved); assert.deepEqual(restored.calls.fields, []); await unmount(restored);
  });
  test(`${scheme}: later external preferred-name changes retain the original local-state snapshot quirk`, async () => {
    const view = await preferredName({ scheme, data: { ...draft, preferredName: "Alex" } }); await act(async () => view.update("preferredName", "Sam"));
    assert.equal(input(view).props.value, "Alex"); assert.equal(view.data().preferredName, "Sam"); assert.deepEqual(view.calls.routes, []);
    await pressNext(view); assert.equal(view.data().preferredName, "Alex"); assert.deepEqual(view.calls.fields, [["preferredName", "Alex"]]); await unmount(view);
  });
  test(`${scheme}: the existing-account action opens Login without committing a typed name`, async () => {
    const view = await preferredName({ scheme }); const before = view.data(); await change(view, "Uncommitted"); await act(async () => login(view).props.onPress());
    assert.deepEqual(view.calls.routes, ["/login"]); assert.deepEqual(view.calls.fields, []); assert.deepEqual(view.data(), before); assert.equal(textOf(login(view)), "Log in"); await unmount(view);
  });
  test(`${scheme}: keyboard dismissal and both platform avoidance modes preserve fields and routes`, async () => {
    for (const platform of ["ios", "android"]) {
      const view = await preferredName({ scheme, platform }); const before = view.data(); const avoid = view.tree.root.findByType("KeyboardAvoidingView");
      assert.equal(avoid.props.behavior, platform === "ios" ? "padding" : "height"); assert.equal(avoid.props.keyboardVerticalOffset, platform === "ios" ? 100 : 0);
      await act(async () => view.tree.root.findByType("TouchableWithoutFeedback").props.onPress()); assert.equal(view.calls.dismissals, 1);
      assert.deepEqual(view.data(), before); assert.deepEqual(view.calls.fields, []); assert.deepEqual(view.calls.routes, []); await unmount(view);
    }
  });
  test(`${scheme}: the actual shared input keeps native first-name hints and original theme presentation`, async () => {
    const view = await preferredName({ scheme }); const field = input(view);
    assert.equal(field.props.placeholder, "Enter your first name"); assert.equal(field.props.autoFocus, true); assert.equal(field.props.autoCapitalize, "words"); assert.equal(field.props.textContentType, "givenName");
    assert.equal(flat(field.props.style).backgroundColor, view.colors.inputBackground); assert.equal(flat(field.props.style).color, view.colors.text); assert.equal(field.props.placeholderTextColor, view.colors.icon);
    assert.equal(field.props.onSubmitEditing, undefined); assert.equal(field.props.maxLength, undefined);
    await unmount(view);
  });
  test(`${scheme}: real input focus blur, entrance timing and button press feedback keep original motion`, async () => {
    const view = await preferredName({ scheme }); await act(async () => input(view).props.onFocus({ nativeEvent: {} }));
    assert.equal(flat(input(view).props.style).borderColor, view.colors.text); assert.equal(flat(input(view).props.style).borderWidth, 2); assert.equal(flat(input(view).props.style).shadowOpacity, 0);
    assert.ok(view.calls.animations.some((a) => a.kind === "timing" && a.value === 0.6 && a.config.duration === 250));
    await act(async () => input(view).props.onBlur({ nativeEvent: {} })); assert.equal(flat(input(view).props.style).borderColor, view.colors.inputBorder); assert.equal(flat(input(view).props.style).shadowOpacity, 0);
    assert.deepEqual(view.calls.animations.filter((a) => a.kind === "delay").map((a) => a.delay), [100, 100]);
    assert.ok(view.calls.animations.some((a) => a.kind === "timing" && a.config.duration === 250));
    await act(async () => { next(view).props.onPressIn({}); }); assert.equal(flat(next(view).props.style).transform[0].scale, 0.96);
    await act(async () => { next(view).props.onPressOut({}); }); assert.equal(flat(next(view).props.style).transform[0].scale, 1); await unmount(view);
  });
  test(`${scheme}: original centered question typography and uncapped text survive presentation refinement`, async () => {
    const view = await preferredName({ scheme }); const scroll = view.tree.root.findByType("ScrollView");
    assert.equal(scroll.props.keyboardShouldPersistTaps, "handled");
    const question = view.tree.root.findAllByType("Text").find((node) => textOf(node) === "What's your first name?"); assert.ok(question); assert.equal(flat(question.props.style).fontSize, 32); assert.equal(flat(question.props.style).textAlign, "center");
    for (const node of view.tree.root.findAllByType("Text")) { assert.equal(node.props.numberOfLines, undefined); assert.notEqual(node.props.allowFontScaling, false); assert.equal(node.props.maxFontSizeMultiplier, undefined); }
    await unmount(view);
  });
}
for (const scheme of ["light", "dark"]) {
  test(`presentation: ${scheme} native field has a literal preferred-name label and stable selector`, async () => {
    const view = await preferredName({ scheme });
    assert.equal(input(view).props.accessibilityLabel, "First name"); assert.equal(input(view).props.testID, "onboarding-name-input"); await unmount(view);
  });
  test(`presentation: ${scheme} keyboard-dismiss wrapper does not merge the form accessibility nodes`, async () => {
    const view = await preferredName({ scheme });
    const wrapper = view.tree.root.findByType("TouchableWithoutFeedback"); const scroll = view.tree.root.findByType("ScrollView");
    assert.equal(wrapper.props.accessible, false); assert.deepEqual(scroll.findAllByType("TouchableWithoutFeedback"), [wrapper]);
    assert.equal(wrapper.findAllByType("ScrollView").length, 0); assert.equal(wrapper.findAllByType("Pressable").length, 0);
    assert.equal(wrapper.findAllByType("TextInput").length, 1); assert.ok(wrapper.findAllByType("Text").some((node) => textOf(node) === "What's your first name?")); await unmount(view);
  });
  test(`presentation: ${scheme} all actions share the inset-aware keyboard scroll with growing bottom space`, async () => {
    for (const bottom of [0, 34, 100]) {
      const view = await preferredName({ scheme, insets: { bottom } }); const scroll = view.tree.root.findByType("ScrollView");
      assert.equal(flat(scroll.props.style).flex, 1); assert.equal(scroll.props.testID, "onboarding-name-scroll");
      assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic"); assert.equal(scroll.props.keyboardDismissMode, "on-drag"); assert.equal(scroll.props.keyboardShouldPersistTaps, "handled");
      assert.equal(flat(scroll.props.contentContainerStyle).paddingBottom, Math.max(24, bottom + 12));
      assert.equal(scroll.findAllByType("Pressable").length, 3); assert.ok(scroll.findAllByType("TextInput").length); await unmount(view);
    }
  });
  test(`presentation: ${scheme} account prompt wraps and independent neutral Login has a 44 target and feedback`, async () => {
    const view = await preferredName({ scheme }); const action = login(view); const account = action.parent;
    assert.equal(flat(account.props.style).flexWrap, "wrap");
    const prompt = account.findAllByType("Text").find((node) => textOf(node).startsWith("Already have an account?"));
    assert.equal(flat(prompt.props.style).maxWidth, "100%"); assert.equal(action.props.accessibilityRole, "button"); assert.equal(action.props.accessibilityLabel, "Log in");
    const actionStyle = (pressed) => flat(typeof action.props.style === "function" ? action.props.style({ pressed }) : action.props.style);
    assert.ok(actionStyle(false).minHeight >= 44); assert.ok(actionStyle(false).minWidth >= 44); assert.equal(actionStyle(false).maxWidth, "100%");
    assert.equal(actionStyle(true).backgroundColor, view.colors.inputBackground); assert.equal(actionStyle(true).opacity, 0.7); assert.equal(actionStyle(false).opacity, 1); assert.equal(flat(action.findByType("Text").props.style).color, view.colors.text); await unmount(view);
  });
  test(`presentation: ${scheme} local Stack screen removes only the inherited fixed header action`, async () => {
    const view = await preferredName({ scheme }); const screen = view.tree.root.findByType("StackScreen");
    assert.deepEqual(Object.keys(screen.props.options), ["headerRight"]); assert.equal(screen.props.options.headerRight(), null); assert.deepEqual(view.calls.routes, []); assert.deepEqual(view.calls.fields, []); await unmount(view);
  });
  test(`presentation: ${scheme} growing neutral Skip preserves immediate Final routing without a name write`, async () => {
    for (const restoredName of ["", "Alex", "  María  "]) {
      const view = await preferredName({ scheme, data: { ...draft, preferredName: restoredName } }); const before = view.data(); await change(view, "Uncommitted");
      const action = view.tree.root.findByProps({ testID: "onboarding-name-skip" });
      assert.equal(textOf(action), "Skip"); assert.equal(action.props.accessibilityRole, "button"); assert.equal(action.props.accessibilityLabel, "Skip");
      const style = (pressed) => flat(typeof action.props.style === "function" ? action.props.style({ pressed }) : action.props.style);
      assert.ok(style(false).minHeight >= 44); assert.equal(style(false).height, undefined); assert.equal(style(true).backgroundColor, view.colors.inputBackground); assert.equal(style(true).opacity, 0.7); assert.equal(style(false).opacity, 1);
      assert.equal(flat(action.findByType("Text").props.style).color, view.colors.text);
      await act(async () => action.props.onPress()); assert.deepEqual(view.calls.routes, ["/onboarding/final"]); assert.deepEqual(view.calls.fields, []); assert.deepEqual(view.data(), before); await unmount(view);
    }
  });
  test(`presentation: ${scheme} primary Next is a named full-width natural 56 target without changing its copy`, async () => {
    const view = await preferredName({ scheme }); const action = next(view); const body = action.findByType("View");
    assert.equal(action.props.accessibilityRole, "button"); assert.equal(action.props.accessibilityLabel, "Next"); assert.equal(action.props.testID, "onboarding-name-next");
    assert.ok(flat(body.props.style).minHeight >= 56); assert.equal(flat(body.props.style).height, undefined); assert.equal(textOf(action), "NEXT");
    assert.equal(flat(body.props.style).backgroundColor, view.colors.primaryButton); await change(view, "Alex"); assert.equal(action.props.disabled, false); await unmount(view);
  });
}
test("scope: original preferred-name controller and shared input/styles/provider/layout bytes remain frozen", () => {
  const sha = (value) => createHash("sha256").update(value).digest("hex");
  const routeSource = source(route).replace("  const insets = useSafeAreaInsets();\n", ""); const controller = routeSource.slice(routeSource.indexOf("const OnboardingFirstScreen = () => {"), routeSource.indexOf("\n  return ("));
  assert.equal(sha(controller), "28ade4a74068464a77c4b961e0bba53461e7bcd7cbd9d5d56c48025ae153474c");
  for (const [file, hash] of Object.entries({ "components/animated-input.tsx": "efe972a84658e3581640c6c2cc30ac470bff2db8fe93cd51b4668abdd770f103", "features/onboarding/styles.ts": "d96733df9e1884352cc42568d7fba08fb3230b4f56c7f43b8749edc1ce6e9ee7", "utils/onboardingContext.tsx": "4e8d1c2948f77152251971d444ef527291609b58f0e9f12bc3a361e5828a994a", "app/onboarding/_layout.tsx": "e0a5159f1d9a2d3fca5273b54f4309a7461782872b0445f74e34ff39bf47cab2" })) assert.equal(sha(source(file)), hash, file);
  assert.ok(source("app/_layout.tsx").includes("if (isBootstrapping || (!isLoggedIn && isRestoringOnboarding))"));
});
