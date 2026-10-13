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
const base = "0c392524c88f3add3239b80ecb117cccc342f923";
const route = "app/onboarding/welcome.tsx";
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
  Pressable: "Pressable", View: "View", Text: "Text", ScrollView: "ScrollView",
  StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (values) => values.ios },
};
const theme = load("constants/theme.ts", { "react-native": native });
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const button = (tree) => tree.root.findByType("Pressable");
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node) => flat(node.props.style);
const unmount = async (tree) => { await act(async () => tree.unmount()); };
async function welcome(options = {}) {
  const calls = { routes: [], animations: [] };
  const OnboardingContext = React.createContext(null);
  const scheme = options.scheme ?? "light";
  const colors = theme.Colors[scheme ?? "light"];
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
  const mocks = {
    react: React, "react-native": native, "react-native-reanimated": animated,
    "react-native-svg": { __esModule: true, default: "Svg", G: "G", Path: "Path" },
    "@/constants/theme": theme, "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@/utils/onboardingContext": { OnboardingContext },
    "expo-router": { useRouter: () => ({ push: (value) => calls.routes.push(value) }) },
  };
  for (const [alias, file] of [
    ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"],
    ["@/hooks/use-screen-transition", "hooks/use-screen-transition.ts"],
    ["@/components/themed-view", "components/themed-view.tsx"],
    ["@/components/animated-button", "components/animated-button.tsx"],
    ["@/components/animated-card", "components/animated-card.tsx"],
    ["@/assets/svg-components/logo", "assets/svg-components/logo.tsx"],
  ]) mocks[alias] = load(file, mocks);
  const { default: Screen } = load(route, mocks, options.legacy ? original(route) : source(route));
  const data = options.data ?? { preferredName: "Diego", nested: { retained: true } };
  const render = (snapshot) => React.createElement(OnboardingContext.Provider, { value: { data: snapshot } }, React.createElement(Screen));
  let tree;
  await act(async () => { tree = create(render(data)); });
  return { tree, data, calls, colors, render };
}

for (const scheme of ["light", "dark"]) {
  for (const [name, data, expected] of [
    ["personalized", { preferredName: "Diego" }, "Diego!"],
    ["missing", {}, "there!"],
    ["empty", { preferredName: "" }, "there!"],
    ["whitespace", { preferredName: "  " }, "  !"],
    ["untrimmed", { preferredName: "  Alex  " }, "  Alex  !"],
    ["long Unicode", { preferredName: "María-Alexandria Nguyễn Constantinopoulou" }, "María-Alexandria Nguyễn Constantinopoulou!"],
  ]) test(`behavior: ${scheme} ${name} greeting keeps the original name semantics and route`, async () => {
    const snapshot = { ...data, nested: { retained: true } };
    const before = JSON.stringify(snapshot);
    const view = await welcome({ scheme, data: snapshot });
    assert.ok(text(view.tree, "Welcome to PrimeRep AI,"));
    assert.ok(text(view.tree, expected));
    assert.equal(view.calls.routes.length, 0);
    assert.equal(button(view.tree).props.disabled ?? false, false);
    await act(async () => button(view.tree).props.onPress());
    assert.deepEqual(view.calls.routes, ["/onboarding/first-reason"]);
    assert.equal(JSON.stringify(snapshot), before);
    await unmount(view.tree);
  });
}

test("behavior: live onboarding context changes the name without navigating or resetting data", async () => {
  const view = await welcome();
  const next = { preferredName: "Sam", nested: { retained: true } };
  await act(async () => view.tree.update(view.render(next)));
  assert.ok(text(view.tree, "Sam!"));
  assert.equal(text(view.tree, "Diego!"), undefined);
  assert.deepEqual(view.calls.routes, []);
  assert.deepEqual(next, { preferredName: "Sam", nested: { retained: true } });
  await unmount(view.tree);
});

test("behavior: the real shared button retains repeated presses and press feedback callbacks", async () => {
  const view = await welcome();
  await act(async () => button(view.tree).props.onPressIn({ nativeEvent: {} }));
  assert.equal(styleOf(button(view.tree)).transform[0].scale, 0.96);
  await act(async () => button(view.tree).props.onPressOut({ nativeEvent: {} }));
  assert.equal(styleOf(button(view.tree)).transform[0].scale, 1);
  for (let count = 0; count < 2; count += 1) await act(async () => button(view.tree).props.onPress());
  assert.deepEqual(view.calls.routes, ["/onboarding/first-reason", "/onboarding/first-reason"]);
  await unmount(view.tree);
});

test("scope: the complete Welcome controller and motion configuration stay byte-identical", () => {
  const controller = (input) => input.slice(input.indexOf("export default function WelcomeScreen()"), input.indexOf("\n  return ("));
  assert.equal(controller(source(route)), controller(original(route)));
});

test("scope: merged auth, shared providers, theme, services and package/legal bytes stay unchanged; First Reason keeps its controller", () => {
  for (const file of ["app/signup.tsx", "app/login.tsx", "app/forgot-password.tsx", "app/_layout.tsx", "app/onboarding/_layout.tsx", "utils/authContext.tsx", "utils/onboardingContext.tsx", "components/animated-input.tsx", "components/animated-button.tsx", "components/animated-card.tsx", "components/themed-view.tsx", "components/themed-text.tsx", "components/workout/WorkoutText.tsx", "hooks/use-screen-transition.ts", "hooks/use-theme-color.ts", "hooks/use-color-scheme.ts", "assets/svg-components/logo.tsx", "constants/theme.ts", "constants/legal.ts", "constants/legal-release.json", "services/authService.ts", "package.json", "package-lock.json"]) assert.equal(source(file), original(file), file);
  const nameController = (input) => {
    const withoutInsets = input.replace("  const insets = useSafeAreaInsets();\n", "");
    return withoutInsets.slice(withoutInsets.indexOf("const OnboardingFirstScreen = () => {"), withoutInsets.indexOf("\n  return ("));
  };
  assert.equal(nameController(source("app/onboarding/index.tsx")), nameController(original("app/onboarding/index.tsx")));
  const reasonController = (input) => input.slice(input.indexOf("export default function FirstReasonScreen()"), input.indexOf("\n  return ("));
  assert.equal(reasonController(source("app/onboarding/first-reason.tsx")), reasonController(original("app/onboarding/first-reason.tsx")));
});

test("motion: real Welcome, logo card, transition and button keep system-default Reanimated configs", async () => {
  const view = await welcome();
  await act(async () => button(view.tree).props.onPressIn({ nativeEvent: {} }));
  assert.deepEqual(view.calls.animations.filter((call) => call.kind === "delay").map((call) => call.delay).sort((a, b) => a - b), [100, 100, 300, 300, 600, 600, 900, 900]);
  for (const call of view.calls.animations) assert.equal(call.reduceMotion ?? call.config?.reduceMotion, undefined);
  assert.ok(view.calls.animations.some((call) => call.kind === "timing" && call.config.duration === 250));
  assert.ok(view.calls.animations.some((call) => call.kind === "spring"));
  await unmount(view.tree);
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
  test(`presentation: ${scheme} neutral real logo and name give only Continue the primary color`, async () => {
    const view = await welcome({ scheme });
    assert.equal(styleOf(view.tree.root.findAllByType("View")[0]).backgroundColor, view.colors.background);
    const svg = view.tree.root.findByType("Svg");
    assert.equal(svg.props.width, 144);
    assert.equal(svg.props.height, 176);
    assert.equal(svg.props.viewBox, "0 0 300 366");
    assert.equal(svg.findByType("G").props.fill, view.colors.text);
    for (const property of ["shadowColor", "shadowOpacity", "shadowRadius", "elevation", "boxShadow"]) assert.equal(styleOf(svg)[property], undefined);
    assert.equal(styleOf(host(view.tree, "welcome-greeting")).color, view.colors.icon);
    assert.equal(styleOf(host(view.tree, "welcome-name")).color, view.colors.text);
    assert.equal(styleOf(host(view.tree, "welcome-greeting")).fontSize, 28);
    assert.equal(styleOf(host(view.tree, "welcome-name")).fontSize, 32);
    for (const id of ["welcome-greeting", "welcome-name"]) assert.ok(contrast(styleOf(host(view.tree, id)).color, view.colors.background) >= 4.5);
    assert.equal(styleOf(button(view.tree)).backgroundColor, view.colors.primaryButton);
    await unmount(view.tree);
  });

  test(`presentation: ${scheme} Continue exposes a natural 56-point action and remains legible during press feedback`, async () => {
    const view = await welcome({ scheme });
    assert.equal(button(view.tree).props.testID, "welcome-continue");
    assert.equal(button(view.tree).props.accessibilityRole, "button");
    assert.equal(button(view.tree).props.accessibilityLabel, "Continue");
    assert.equal(textOf(button(view.tree)), "Continue");
    assert.ok(styleOf(button(view.tree)).minHeight >= 56);
    assert.equal(styleOf(button(view.tree)).height, undefined);
    for (const phase of ["onPressIn", "onPressOut"]) {
      await act(async () => button(view.tree).props[phase]({ nativeEvent: {} }));
      assert.equal(styleOf(button(view.tree)).backgroundColor, view.colors.primaryButton);
      assert.equal(styleOf(button(view.tree)).opacity, undefined);
      assert.ok(contrast(styleOf(button(view.tree).findByType("Text")).color, view.colors.primaryButton) >= 4.5);
    }
    await unmount(view.tree);
  });

  test(`presentation: ${scheme} greeting, name and action share one growing native scroll surface`, async () => {
    const view = await welcome({ scheme });
    const scroll = host(view.tree, "welcome-scroll");
    assert.equal(view.tree.root.findAllByType("ScrollView").length, 1);
    assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
    assert.equal(flat(scroll.props.contentContainerStyle).flexGrow, 1);
    assert.equal(flat(scroll.props.contentContainerStyle).flex, undefined);
    for (const id of ["welcome-greeting", "welcome-name", "welcome-continue"]) assert.ok(host(scroll, id));
    const content = host(view.tree, "welcome-greeting").parent.parent.parent;
    assert.equal(styleOf(content).flexGrow, 1);
    assert.equal(styleOf(content).flex, undefined);
    assert.equal(styleOf(content).paddingHorizontal, 24);
    for (const node of scroll.findAll((node) => typeof node.type === "string")) {
      assert.notEqual(styleOf(node).position, "absolute");
      assert.notEqual(styleOf(node).overflow, "hidden");
    }
    assert.equal(styleOf(host(view.tree, "welcome-continue").parent.parent).paddingBottom, 24);
    await unmount(view.tree);
  });

  test(`presentation: ${scheme} long personalized text keeps uncapped native metrics and full-width wrapping`, async () => {
    const name = "María-Alexandria Nguyễn Constantinopoulou";
    const view = await welcome({ scheme, data: { preferredName: name } });
    assert.equal(textOf(host(view.tree, "welcome-name")), `${name}!`);
    for (const node of view.tree.root.findAllByType("Text")) {
      assert.equal(node.props.numberOfLines, undefined);
      assert.equal(node.props.maxFontSizeMultiplier, undefined);
      assert.equal(node.props.adjustsFontSizeToFit, undefined);
      assert.notEqual(node.props.allowFontScaling, false);
      assert.equal(styleOf(node).lineHeight, undefined);
      assert.equal(styleOf(node).height, undefined);
      assert.equal(styleOf(node).textTransform, undefined);
      assert.equal(styleOf(node).fontFamily, theme.Fonts.sans);
    }
    for (const id of ["welcome-greeting", "welcome-name"]) assert.equal(styleOf(host(view.tree, id).parent).width, "100%");
    await unmount(view.tree);
  });
}

test("presentation: the real existing logo is hidden as decoration without changing its shared SVG source", async () => {
  const view = await welcome();
  const wrapper = view.tree.root.findByType("Svg").parent.parent;
  assert.equal(wrapper.props.accessible, false);
  assert.equal(wrapper.props.accessibilityElementsHidden, true);
  assert.equal(wrapper.props.importantForAccessibility, "no-hide-descendants");
  assert.equal(source("assets/svg-components/logo.tsx"), original("assets/svg-components/logo.tsx"));
  await unmount(view.tree);
});
