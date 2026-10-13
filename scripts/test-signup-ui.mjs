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
const base = "42b3b5270769bfce446f1fe566932dc71a43f4ff";
const original = (file) => execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" });
const source = (file) => readFileSync(path.join(root, file), "utf8");
function load(file, mocks, input = source(file)) {
  const filename = path.join(root, file);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), process: { env: {} }, console: { ...console, warn() {} } }, { filename });
  return module.exports;
}
const native = {
  Pressable: "Pressable", TouchableOpacity: "TouchableOpacity", View: "View", Text: "Text", TextInput: "TextInput", ActivityIndicator: "ActivityIndicator", ScrollView: "ScrollView", KeyboardAvoidingView: "KeyboardAvoidingView", TouchableWithoutFeedback: "TouchableWithoutFeedback",
  StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (values) => values.ios },
};
const animated = { __esModule: true, default: { createAnimatedComponent: (component) => component }, useAnimatedStyle: (callback) => callback(), useSharedValue: (value) => React.useRef({ value }).current, withTiming: (value) => value, withSpring: (value) => value };
const { Colors, Fonts } = load("constants/theme.ts", { "react-native": native });
const legal = load("constants/legal.ts", {});
const plain = (value) => JSON.parse(JSON.stringify(value));
const host = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const field = (tree, name) => tree.root.findAllByType("TextInput").find((node) => node.props.autoComplete === (name === "email" ? "email" : "password-new"));
const button = (tree) => tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityState?.busy !== undefined);
const eye = (tree) => tree.root.findAll((node) => typeof node.type === "string" && node.props.accessibilityLabel === (field(tree, "password").props.secureTextEntry ? "Show password" : "Hide password"))[0];
const unmount = async (tree) => { await act(async () => tree.unmount()); };
const tap = async (node) => { assert.ok(node); assert.equal(node.props.disabled ?? false, false); await act(async () => node.props.onPress()); };
const enter = async (tree, email, password) => { await act(async () => { field(tree, "email").props.onChangeText(email); field(tree, "password").props.onChangeText(password); }); };
const accept = (tree) => tap(host(tree, "legal-acceptance-checkbox"));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function mocksFor(scheme, options = {}) {
  const colors = Colors[scheme];
  const calls = { signup: [], routes: [], resets: 0, snapshots: 0, dismiss: 0 };
  const AuthContext = React.createContext(null);
  const OnboardingContext = React.createContext(null);
  const mocks = {
    react: React, "react-native": { ...native, Platform: { ...native.Platform, OS: options.platform ?? "ios" }, Keyboard: { dismiss: () => { calls.dismiss += 1; } } },
    "react-native-reanimated": animated, "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@expo/vector-icons": { Ionicons: "Ionicons" },
    "@/constants/theme": { Colors, Fonts }, "@/constants/legal": legal, "@/hooks/use-color-scheme": { useColorScheme: () => scheme }, "@/hooks/use-theme-color": { useThemeColor: () => colors.text },
    "@/utils/authContext": { AuthContext }, "@/utils/onboardingContext": { OnboardingContext },
    "expo-router": { useRouter: () => ({ push: (route) => calls.routes.push(route) }) },
    "@/components/themed-view": { ThemedView: (props) => React.createElement("View", props) },
  };
  mocks["@/components/themed-text"] = load("components/themed-text.tsx", mocks);
  mocks["@/components/workout/WorkoutText"] = load("components/workout/WorkoutText.tsx", mocks);
  mocks["@/components/animated-input"] = load("components/animated-input.tsx", mocks);
  mocks["@/components/animated-button"] = load("components/animated-button.tsx", mocks);
  return { mocks, calls, AuthContext, OnboardingContext, colors };
}
async function signup(options = {}) {
  const setup = mocksFor(options.scheme ?? "light", options);
  const { default: Screen } = load("app/signup.tsx", setup.mocks);
  let tree;
  await act(async () => { tree = create(React.createElement(setup.AuthContext.Provider, { value: { signUp: async (payload) => { setup.calls.signup.push(plain(payload)); return options.signup?.(payload); } } }, React.createElement(setup.OnboardingContext.Provider, { value: { getOnboardingData: () => { setup.calls.snapshots += 1; return options.snapshot ?? {}; }, resetOnboarding: () => { setup.calls.resets += 1; } } }, React.createElement(Screen)))); });
  return { ...setup, tree };
}

test("behavior: blank or whitespace credentials keep onboarding and never call signup", async () => {
  const view = await signup();
  for (const [email, password] of [["", ""], ["user@example.com", "  "], ["  ", "password"]]) {
    await enter(view.tree, email, password);
    await tap(button(view.tree));
    assert.ok(text(view.tree, "Please enter both email and password"));
  }
  assert.deepEqual([view.calls.signup.length, view.calls.resets, view.calls.snapshots], [0, 0, 0]);
  await unmount(view.tree);
});

test("behavior: email validation retains both input drafts", async () => {
  const view = await signup();
  await enter(view.tree, "user", " original password ");
  await tap(button(view.tree));
  assert.ok(text(view.tree, "Please enter a valid email address"));
  assert.equal(field(view.tree, "email").props.value, "user");
  assert.equal(field(view.tree, "password").props.value, " original password ");
  assert.equal(view.calls.signup.length, 0);
  await unmount(view.tree);
});

test("behavior: password requires exactly the existing eight-character boundary", async () => {
  const view = await signup();
  await enter(view.tree, "user@example.com", "1234567");
  await tap(button(view.tree));
  assert.ok(text(view.tree, "Password must be at least 8 characters"));
  await enter(view.tree, "user@example.com", "12345678");
  await tap(button(view.tree));
  assert.ok(text(view.tree, "Accept the Terms of Service and acknowledge the Privacy Policy to continue."));
  assert.equal(view.calls.signup.length, 0);
  await unmount(view.tree);
});

test("behavior: acceptance remains explicit with a checked checkbox state", async () => {
  const view = await signup();
  await enter(view.tree, "user@example.com", "password");
  await tap(button(view.tree));
  assert.equal(view.calls.signup.length, 0);
  const checkbox = () => host(view.tree, "legal-acceptance-checkbox");
  assert.equal(checkbox().props.accessibilityRole, "checkbox");
  assert.equal(checkbox().props.accessibilityLabel, "Accept Terms of Service and acknowledge Privacy Policy");
  assert.deepEqual(plain(checkbox().props.accessibilityState), { checked: false, disabled: false });
  await accept(view.tree);
  assert.deepEqual(plain(checkbox().props.accessibilityState), { checked: true, disabled: false });
  await accept(view.tree);
  assert.equal(checkbox().props.accessibilityState.checked, false);
  await unmount(view.tree);
});

test("behavior: signup preserves the full snapshot, original password and legal versions", async () => {
  const snapshot = { preferredName: "  Alex  ", lastName: "  Example  ", frequency: 3, equipment: ["dumbbell"], nested: { retained: true } };
  const view = await signup({ snapshot });
  await enter(view.tree, "  user@example.com  ", " original password ");
  await accept(view.tree);
  await tap(button(view.tree));
  assert.deepEqual(view.calls.signup, [{ email: "user@example.com", password: " original password ", preferred_name: "Alex", last_name: "Example", onboarding: snapshot, legalAcceptance: { accepted: true, termsVersion: legal.TERMS_VERSION, privacyVersion: legal.PRIVACY_VERSION } }]);
  assert.deepEqual(snapshot, { preferredName: "  Alex  ", lastName: "  Example  ", frequency: 3, equipment: ["dumbbell"], nested: { retained: true } });
  assert.deepEqual([view.calls.snapshots, view.calls.resets], [1, 1]);
  assert.deepEqual(view.calls.routes, []);
  assert.equal(button(view.tree).props.disabled, true);
  await unmount(view.tree);
});

test("behavior: missing and whitespace names use the email prefix and nullable last name", async () => {
  for (const snapshot of [{}, { preferredName: "  ", lastName: "  ", retained: "value" }]) {
    const view = await signup({ snapshot });
    await enter(view.tree, " user@example.com ", "password");
    await accept(view.tree);
    await tap(button(view.tree));
    assert.equal(view.calls.signup[0].preferred_name, "user");
    assert.equal(view.calls.signup[0].last_name, null);
    assert.deepEqual(view.calls.signup[0].onboarding, snapshot);
    await unmount(view.tree);
  }
});

test("behavior: pending signup disables fields and all actions without resetting onboarding", async () => {
  const request = deferred();
  const view = await signup({ signup: () => request.promise });
  await enter(view.tree, "user@example.com", "password");
  await accept(view.tree);
  await act(async () => { void button(view.tree).props.onPress(); });
  for (const name of ["email", "password"]) assert.equal(field(view.tree, name).props.editable, false);
  for (const node of view.tree.root.findAll((node) => typeof node.type === "string" && node.type !== "TouchableWithoutFeedback" && typeof node.props.onPress === "function")) {
    assert.equal(node.props.disabled, true);
    assert.equal(node.props.accessibilityState.disabled, true);
  }
  assert.deepEqual(plain(button(view.tree).props.accessibilityState), { disabled: true, busy: true });
  assert.deepEqual(plain(host(view.tree, "legal-acceptance-checkbox").props.accessibilityState), { checked: true, disabled: true });
  assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 1);
  assert.equal(view.calls.resets, 0);
  await act(async () => request.resolve());
  assert.equal(view.calls.resets, 1);
  assert.equal(button(view.tree).props.disabled, true);
  assert.deepEqual(view.calls.routes, []);
  await unmount(view.tree);
});

test("behavior: deferred rejection retains drafts and consent and permits a deferred retry", async () => {
  const first = deferred();
  const second = deferred();
  let attempts = 0;
  const view = await signup({ signup: () => ++attempts === 1 ? first.promise : second.promise });
  await enter(view.tree, " user@example.com ", " original password ");
  await accept(view.tree);
  await act(async () => { void button(view.tree).props.onPress(); });
  await act(async () => first.reject(new Error("Email already exists")));
  assert.ok(text(view.tree, "Email already exists"));
  assert.equal(field(view.tree, "email").props.value, " user@example.com ");
  assert.equal(field(view.tree, "password").props.value, " original password ");
  assert.equal(host(view.tree, "legal-acceptance-checkbox").props.accessibilityState.checked, true);
  assert.equal(button(view.tree).props.disabled, false);
  assert.equal(view.calls.resets, 0);
  await act(async () => { void button(view.tree).props.onPress(); });
  assert.equal(text(view.tree, "Email already exists"), undefined);
  assert.equal(button(view.tree).props.disabled, true);
  assert.deepEqual(view.calls.signup[0], view.calls.signup[1]);
  assert.equal(view.calls.resets, 0);
  await act(async () => second.resolve());
  assert.equal(view.calls.resets, 1);
  await unmount(view.tree);
});

test("behavior: fallback failure keeps onboarding and restores navigation actions", async () => {
  const view = await signup({ signup: () => Promise.reject({}) });
  await enter(view.tree, "user@example.com", "password");
  await accept(view.tree);
  await tap(button(view.tree));
  assert.ok(text(view.tree, "Failed to create account. Please try again."));
  assert.equal(view.calls.resets, 0);
  for (const node of view.tree.root.findAll((node) => typeof node.type === "string" && node.type !== "TouchableWithoutFeedback" && typeof node.props.onPress === "function")) assert.equal(node.props.disabled, false);
  await unmount(view.tree);
});

test("behavior: password visibility retains the original draft and accessible names", async () => {
  const view = await signup();
  await enter(view.tree, "user@example.com", "my draft");
  assert.equal(field(view.tree, "password").props.secureTextEntry, true);
  await tap(eye(view.tree));
  assert.equal(field(view.tree, "password").props.secureTextEntry, false);
  assert.equal(eye(view.tree).props.accessibilityLabel, "Hide password");
  assert.equal(field(view.tree, "password").props.value, "my draft");
  await tap(eye(view.tree));
  assert.equal(field(view.tree, "password").props.secureTextEntry, true);
  await unmount(view.tree);
});

test("behavior: independent legal links and login keep exact routes without accepting terms", async () => {
  const view = await signup();
  for (const id of ["signup-terms-link", "signup-privacy-link"]) {
    const link = host(view.tree, id);
    assert.equal(link.props.accessibilityRole, "link");
    assert.equal(link.findAll((node) => node.props.testID === "legal-acceptance-checkbox").length, 0);
    await tap(link);
    assert.equal(host(view.tree, "legal-acceptance-checkbox").props.accessibilityState.checked, false);
  }
  const loginLink = view.tree.root.findAll((node) => typeof node.type === "string" && typeof node.props.onPress === "function" && textOf(node) === "Log in")[0];
  await tap(loginLink);
  assert.deepEqual(view.calls.routes, ["/legal/terms", "/legal/privacy", "/login"]);
  assert.deepEqual([view.calls.signup.length, view.calls.resets], [0, 0]);
  await accept(view.tree);
  await tap(host(view.tree, "signup-terms-link"));
  assert.equal(host(view.tree, "legal-acceptance-checkbox").props.accessibilityState.checked, true);
  await unmount(view.tree);
});

test("scope: signup state and controller, merged Login and all shared dependencies stay byte-identical", () => {
  const controller = (input) => input.slice(input.indexOf("const SignUpScreen = () => {"), input.indexOf("\n  return ("));
  assert.equal(controller(source("app/signup.tsx")), controller(original("app/signup.tsx")));
  for (const file of ["app/login.tsx", "app/forgot-password.tsx", "app/_layout.tsx", "utils/authContext.tsx", "utils/onboardingContext.tsx", "services/authService.ts", "components/animated-input.tsx", "components/animated-button.tsx", "components/workout/WorkoutText.tsx", "components/themed-text.tsx", "constants/theme.ts", "constants/legal.ts", "constants/legal-release.json", "package.json", "package-lock.json"]) assert.equal(source(file), original(file), file);
});

const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node, pressed = false) => flat(typeof node.props.style === "function" ? node.props.style({ pressed }) : node.props.style);

for (const scheme of ["light", "dark"]) test(`presentation: ${scheme} form has visible labels, neutral links and one primary action`, async () => {
  const view = await signup({ scheme });
  for (const name of ["Email", "Password"]) {
    assert.ok(text(view.tree, name));
    const input = field(view.tree, name.toLowerCase());
    assert.equal(input.props.accessibilityLabel, name);
    assert.equal(input.props.placeholderTextColor, view.colors.icon);
    assert.equal(styleOf(input).minHeight, 56);
    assert.equal(styleOf(input).borderColor, view.colors.inputBorder);
  }
  assert.equal(field(view.tree, "email").props.placeholder, "Email address");
  assert.equal(field(view.tree, "password").props.placeholder, "Password");
  assert.equal(styleOf(button(view.tree)).backgroundColor, view.colors.primaryButton);
  assert.equal(textOf(button(view.tree)), "Sign up");
  assert.equal(button(view.tree).props.accessibilityLabel, "Sign up");
  assert.equal(button(view.tree).props.accessibilityRole, "button");
  for (const id of ["signup-terms-link", "signup-privacy-link", "signup-login-link"]) {
    const link = host(view.tree, id);
    assert.ok(styleOf(link).minHeight >= 44);
    assert.ok(styleOf(link).minWidth >= 44);
    assert.equal(link.props.accessibilityRole, "link");
    assert.equal(styleOf(link.findByType("Text")).color, view.colors.text);
    assert.equal(styleOf(link.findByType("Text")).textDecorationLine, "underline");
    assert.notEqual(styleOf(link, true).backgroundColor, undefined);
    assert.notEqual(styleOf(link, true).backgroundColor, view.colors.primaryButton);
  }
  const checkbox = host(view.tree, "legal-acceptance-checkbox");
  assert.equal(styleOf(checkbox).width, 44);
  assert.equal(styleOf(checkbox).height, 44);
  assert.equal(styleOf(checkbox).marginTop, undefined);
  assert.equal(styleOf(checkbox).marginBottom, undefined);
  assert.notEqual(styleOf(checkbox, true).backgroundColor, undefined);
  await accept(view.tree);
  const checkedBox = host(view.tree, "legal-acceptance-checkbox").findByType("View");
  assert.equal(styleOf(checkedBox).backgroundColor, view.colors.text);
  assert.equal(styleOf(checkedBox).borderColor, view.colors.text);
  assert.equal(checkedBox.findByType("Ionicons").props.color, view.colors.background);
  assert.deepEqual(plain(view.tree.root.findByType("SafeAreaView").props.edges), ["top", "bottom"]);
  await unmount(view.tree);
});

for (const scheme of ["light", "dark"]) test(`presentation: ${scheme} actual auth inputs retain drafts with neutral focus and blur`, async () => {
  const view = await signup({ scheme });
  await enter(view.tree, "user@example.com", "password draft");
  for (const name of ["email", "password"]) {
    const input = () => field(view.tree, name);
    await act(async () => input().props.onFocus({ nativeEvent: {} }));
    assert.equal(styleOf(input()).borderColor, view.colors.text);
    assert.equal(styleOf(input()).borderWidth, 2);
    assert.equal(styleOf(input()).shadowOpacity, 0);
    assert.equal(styleOf(input()).elevation, 0);
    await act(async () => input().props.onBlur({ nativeEvent: {} }));
    assert.equal(styleOf(input()).borderColor, view.colors.inputBorder);
    assert.equal(styleOf(input()).borderWidth, 1);
  }
  assert.equal(field(view.tree, "email").props.value, "user@example.com");
  assert.equal(field(view.tree, "password").props.value, "password draft");
  await unmount(view.tree);
});

test("presentation: password eye is centered in a scalable 44-point rail", async () => {
  const view = await signup();
  const style = styleOf(host(view.tree, "password-visibility-button"));
  assert.equal(style.top, 0);
  assert.equal(style.bottom, 0);
  assert.ok(style.width >= 44);
  assert.ok(style.minHeight >= 44);
  assert.equal(style.alignItems, "center");
  assert.equal(style.justifyContent, "center");
  assert.equal(styleOf(field(view.tree, "password")).height, undefined);
  assert.ok(styleOf(field(view.tree, "password")).paddingRight > style.width);
  assert.notEqual(styleOf(eye(view.tree), true).backgroundColor, undefined);
  assert.equal(view.tree.root.findAllByType("Ionicons").length, 1);
  await unmount(view.tree);
});

test("presentation: iOS and Android keyboard handling retains first-tap actions and outside drafts", async () => {
  for (const platform of ["ios", "android"]) {
    const view = await signup({ platform });
    await enter(view.tree, "user@example.com", "password draft");
    const scroll = host(view.tree, "signup-scroll");
    assert.equal(scroll.props.keyboardShouldPersistTaps, "always");
    assert.equal(scroll.props.keyboardDismissMode, platform === "ios" ? "interactive" : "on-drag");
    assert.equal(scroll.props.automaticallyAdjustKeyboardInsets, undefined);
    assert.equal(view.tree.root.findByType("KeyboardAvoidingView").props.behavior, platform === "ios" ? "padding" : undefined);
    assert.equal(styleOf({ props: { style: scroll.props.contentContainerStyle } }).flexGrow, 1);
    const target = {};
    await act(async () => scroll.props.onTouchEnd({ target: {}, currentTarget: target }));
    assert.equal(view.calls.dismiss, 0);
    await tap(eye(view.tree));
    assert.equal(field(view.tree, "password").props.secureTextEntry, false);
    await tap(host(view.tree, "signup-terms-link"));
    assert.deepEqual(view.calls.routes, ["/legal/terms"]);
    await act(async () => scroll.props.onTouchEnd({ target, currentTarget: target }));
    const background = view.tree.root.findByType("TouchableWithoutFeedback");
    assert.equal(background.props.accessible, false);
    await act(async () => background.props.onPress());
    assert.equal(view.calls.dismiss, 2);
    assert.equal(field(view.tree, "password").props.value, "password draft");
    await unmount(view.tree);
  }
});

test("presentation: full exact legal phrase and all text wrap with uncapped natural metrics", async () => {
  const view = await signup();
  const checkbox = host(view.tree, "legal-acceptance-checkbox");
  assert.equal(textOf(checkbox.parent), "I agree to the Terms of Service and acknowledge the Privacy Policy");
  const content = host(view.tree, "signup-terms-link").parent;
  assert.equal(styleOf(content).flexWrap, "wrap");
  for (const node of content.findAllByType("Text")) assert.equal(styleOf(node).flexShrink, 1);
  for (const id of ["signup-terms-link", "signup-privacy-link"]) assert.equal(styleOf(host(view.tree, id)).maxWidth, "100%");
  await tap(button(view.tree));
  for (const node of view.tree.root.findAllByType("Text")) {
    assert.equal(styleOf(node).lineHeight, undefined);
    assert.equal(node.props.maxFontSizeMultiplier, undefined);
    assert.equal(node.props.numberOfLines, undefined);
    assert.equal(node.props.adjustsFontSizeToFit, undefined);
    assert.notEqual(node.props.allowFontScaling, false);
  }
  assert.ok(text(view.tree, "Create account"));
  assert.ok(text(view.tree, "Join PrimeRep AI and start your journey"));
  await unmount(view.tree);
});

test("presentation: validation feedback is a readable alert in both themes", async () => {
  for (const scheme of ["light", "dark"]) {
    const view = await signup({ scheme });
    await tap(button(view.tree));
    const message = host(view.tree, "signup-error");
    assert.equal(message.props.accessibilityRole, "alert");
    assert.equal(styleOf(message).color, scheme === "dark" ? "#FF8B82" : "#B42318");
    assert.equal(textOf(message), "Please enter both email and password");
    await unmount(view.tree);
  }
});

test("presentation: pending spinner and primary action retain full contrast in both themes", async () => {
  for (const scheme of ["light", "dark"]) {
    const request = deferred();
    const view = await signup({ scheme, signup: () => request.promise });
    await enter(view.tree, "user@example.com", "password");
    await accept(view.tree);
    await act(async () => { void button(view.tree).props.onPress(); });
    assert.equal(styleOf(button(view.tree)).opacity, undefined);
    assert.equal(styleOf(button(view.tree)).backgroundColor, view.colors.primaryButton);
    assert.equal(button(view.tree).props.disabled, true);
    assert.deepEqual(plain(button(view.tree).props.accessibilityState), { disabled: true, busy: true });
    assert.equal(view.tree.root.findByType("ActivityIndicator").props.color, "#FFFFFF");
    await act(async () => request.reject(new Error("offline")));
    await unmount(view.tree);
  }
});

test("scope: neutral input opt-in is limited to the five approved screens and untouched input", () => {
  const callers = execFileSync("rg", ["-l", "authPresentation", "app", "components"], { cwd: root, encoding: "utf8" }).trim().split("\n").sort();
  assert.deepEqual(callers, ["app/login.tsx", "app/onboarding/body-stats.tsx", "app/onboarding/fitness-experience/one-rep-max.tsx", "app/onboarding/index.tsx", "app/signup.tsx", "components/animated-input.tsx"]);
  const oneRepMax = "app/onboarding/fitness-experience/one-rep-max.tsx";
  const controller = (input) => input.slice(input.indexOf("export default function OneRepMaxScreen()"), input.indexOf("\n  return ("));
  const baseline = execFileSync("git", ["show", `e68e9de49bca3965e4c6d0b0e26cb9c6ed1fda1e:${oneRepMax}`], { cwd: root, encoding: "utf8" });
  assert.equal(controller(source(oneRepMax)), controller(baseline));
  const bodyStats = "app/onboarding/body-stats.tsx";
  const bodyController = (input) => input.slice(0, input.indexOf("\n  return ("));
  const bodyBaseline = execFileSync("git", ["show", `9f2811810329482b6871f11558f3e23c1bc1e65b:${bodyStats}`], { cwd: root, encoding: "utf8" });
  assert.equal(bodyController(source(bodyStats)), bodyController(bodyBaseline));
});
