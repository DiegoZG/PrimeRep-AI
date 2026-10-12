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
const base = "4bbabb8114191e59119a0a34513a92f5ac43c34b";
const original = (file) => execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" });
const source = (file) => readFileSync(path.join(root, file), "utf8");
function load(file, mocks, input = source(file)) {
  const filename = path.join(root, file);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console: { ...console, warn() {} } }, { filename });
  return module.exports;
}
const native = {
  Pressable: "Pressable", View: "View", Text: "Text", TextInput: "TextInput", ActivityIndicator: "ActivityIndicator", ScrollView: "ScrollView", KeyboardAvoidingView: "KeyboardAvoidingView", TouchableWithoutFeedback: "TouchableWithoutFeedback",
  StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (values) => values.ios },
};
const animated = { __esModule: true, default: { createAnimatedComponent: (component) => component }, useAnimatedStyle: (callback) => callback(), useSharedValue: (value) => React.useRef({ value }).current, withTiming: (value) => value, withSpring: (value) => value };
const { Colors, Fonts } = load("constants/theme.ts", { "react-native": native });
const plain = (value) => JSON.parse(JSON.stringify(value));
const host = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const unmount = async (tree) => { await act(async () => tree.unmount()); };
const tap = async (node) => { assert.ok(node); assert.equal(node.props.disabled ?? false, false); await act(async () => node.props.onPress()); };
const enter = async (tree, email, password) => { await act(async () => { host(tree, "email-input").props.onChangeText(email); host(tree, "password-input").props.onChangeText(password); }); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function mocksFor(scheme, options = {}) {
  const colors = Colors[scheme];
  const calls = { login: [], routes: [], dismiss: 0 };
  const AuthContext = React.createContext(null);
  const mocks = {
    react: React, "react-native": { ...native, Platform: { ...native.Platform, OS: options.platform ?? "ios" }, Keyboard: { dismiss: () => { calls.dismiss += 1; } } },
    "react-native-reanimated": animated, "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@expo/vector-icons": { Ionicons: "Ionicons" },
    "@/constants/theme": { Colors, Fonts }, "@/hooks/use-color-scheme": { useColorScheme: () => scheme }, "@/hooks/use-theme-color": { useThemeColor: () => colors.text },
    "@/utils/authContext": { AuthContext },
    "expo-router": { useRouter: () => ({ push: (route) => calls.routes.push(route) }), useLocalSearchParams: () => ({ passwordReset: options.passwordReset }) },
    "@/components/themed-view": { ThemedView: (props) => React.createElement("View", props) },
  };
  mocks["@/components/themed-text"] = load("components/themed-text.tsx", mocks);
  mocks["@/components/workout/WorkoutText"] = load("components/workout/WorkoutText.tsx", mocks);
  mocks["@/components/animated-input"] = load("components/animated-input.tsx", mocks);
  mocks["@/components/animated-button"] = load("components/animated-button.tsx", mocks);
  return { mocks, calls, AuthContext, colors };
}
async function login(options = {}) {
  const setup = mocksFor(options.scheme ?? "light", options);
  const { default: Screen } = load("app/login.tsx", setup.mocks);
  let tree;
  await act(async () => { tree = create(React.createElement(setup.AuthContext.Provider, { value: { logIn: async (payload) => { setup.calls.login.push(plain(payload)); return options.login?.(payload); } } }, React.createElement(Screen))); });
  return { ...setup, tree };
}

test("behavior: missing or whitespace credentials never call authentication", async () => {
  const view = await login();
  for (const [email, password] of [["", ""], ["user@example.com", "  "], ["  ", "password"]]) {
    await enter(view.tree, email, password);
    await tap(host(view.tree, "login-button"));
    assert.ok(text(view.tree, "Please enter both email and password"));
  }
  assert.equal(view.calls.login.length, 0);
  await unmount(view.tree);
});

test("behavior: invalid email keeps exact validation and retains both inputs", async () => {
  const view = await login();
  await enter(view.tree, "user", " private draft ");
  await tap(host(view.tree, "login-button"));
  assert.ok(text(view.tree, "Please enter a valid email address"));
  assert.equal(host(view.tree, "email-input").props.value, "user");
  assert.equal(host(view.tree, "password-input").props.value, " private draft ");
  assert.equal(view.calls.login.length, 0);
  await unmount(view.tree);
});

test("behavior: valid login trims email only and leaves root navigation in control", async () => {
  const view = await login();
  await enter(view.tree, "  user@example.com  ", " original password ");
  await tap(host(view.tree, "login-button"));
  assert.deepEqual(view.calls.login, [{ email: "user@example.com", password: " original password " }]);
  assert.deepEqual(view.calls.routes, []);
  assert.equal(host(view.tree, "login-button").props.disabled, true);
  await unmount(view.tree);
});

test("behavior: submitting disables input, visibility and every navigation action", async () => {
  const request = deferred();
  const view = await login({ login: () => request.promise });
  await enter(view.tree, "user@example.com", "password");
  await act(async () => { void host(view.tree, "login-button").props.onPress(); });
  assert.equal(host(view.tree, "email-input").props.editable, false);
  assert.equal(host(view.tree, "password-input").props.editable, false);
  for (const node of view.tree.root.findAllByType("Pressable")) assert.equal(node.props.disabled, true);
  assert.deepEqual(plain(host(view.tree, "login-button").props.accessibilityState), { disabled: true, busy: true });
  assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 1);
  await act(async () => request.reject(new Error("Network request failed")));
  assert.ok(text(view.tree, "Network request failed"));
  assert.equal(host(view.tree, "login-button").props.disabled, false);
  assert.equal(host(view.tree, "password-input").props.value, "password");
  await unmount(view.tree);
});

test("behavior: fallback failure, retry and exact recovery/signup routes stay available", async () => {
  let attempts = 0;
  const view = await login({ login: () => { if (++attempts === 1) return Promise.reject({}); } });
  await enter(view.tree, "user@example.com", "password");
  await tap(host(view.tree, "login-button"));
  assert.ok(text(view.tree, "Invalid email or password"));
  await tap(host(view.tree, "forgot-password-link"));
  const others = view.tree.root.findAllByType("Pressable").filter((node) => ["Sign up", "Go back to onboarding"].includes(textOf(node)));
  assert.equal(others.length, 2);
  for (const node of others) await tap(node);
  assert.deepEqual(view.calls.routes, ["/forgot-password", "/onboarding", "/onboarding"]);
  await tap(host(view.tree, "login-button"));
  assert.equal(view.calls.login.length, 2);
  assert.equal(text(view.tree, "Invalid email or password"), undefined);
  await unmount(view.tree);
});

test("behavior: password visibility retains draft and exposes exact accessible names", async () => {
  const view = await login();
  await enter(view.tree, "user@example.com", "my draft");
  const eye = () => view.tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === (host(view.tree, "password-input").props.secureTextEntry ? "Show password" : "Hide password"));
  assert.equal(host(view.tree, "password-input").props.secureTextEntry, true);
  await tap(eye());
  assert.equal(host(view.tree, "password-input").props.secureTextEntry, false);
  assert.equal(host(view.tree, "password-input").props.value, "my draft");
  await tap(eye());
  assert.equal(host(view.tree, "password-input").props.secureTextEntry, true);
  await unmount(view.tree);
});

test("behavior: password-updated notice is present only for exact success param", async () => {
  for (const value of [undefined, "success", "other"]) {
    const view = await login({ passwordReset: value });
    const message = text(view.tree, "Your password was updated. Sign in with your new password.");
    assert.equal(Boolean(message), value === "success");
    if (message) assert.equal(message.props.accessibilityRole, "alert");
    await unmount(view.tree);
  }
});

test("scope: login controller and all other callers remain byte-identical to merged main", () => {
  const controller = (input) => input.slice(input.indexOf("  const handleLogin = async () => {"), input.indexOf("\n  return ("));
  assert.equal(controller(source("app/login.tsx")), controller(original("app/login.tsx")));
  const signupController = (input) => input.slice(input.indexOf("const SignUpScreen = () => {"), input.indexOf("\n  return ("));
  const signupBaseline = execFileSync("git", ["show", "42b3b5270769bfce446f1fe566932dc71a43f4ff:app/signup.tsx"], { cwd: root, encoding: "utf8" });
  assert.equal(signupController(source("app/signup.tsx")), signupController(signupBaseline));
  for (const file of ["app/forgot-password.tsx", "app/_layout.tsx", "utils/authContext.tsx", "services/authService.ts", "components/animated-button.tsx", "components/workout/WorkoutText.tsx", "constants/theme.ts", "package.json", "package-lock.json"]) assert.equal(source(file), original(file), file);
});

for (const scheme of ["light", "dark"]) test(`legacy: AnimatedInput omitted and false match historical ${scheme} focus, blur and error trees`, async () => {
  for (const error of [false, true]) for (const optIn of [undefined, false]) {
    const setup = mocksFor(scheme);
    const { AnimatedInput: Current } = load("components/animated-input.tsx", setup.mocks);
    const { AnimatedInput: Legacy } = load("components/animated-input.tsx", setup.mocks, original("components/animated-input.tsx"));
    const originalProps = { testID: "field", value: "draft", error, style: { paddingRight: 48 } };
    const props = { ...originalProps, ...(optIn === undefined ? {} : { authPresentation: false }) };
    const callbacks = [[], []];
    const trees = [];
    for (const [index, Component] of [Current, Legacy].entries()) {
      await act(async () => { trees.push(create(React.createElement(Component, { ...(index === 0 ? props : originalProps), onFocus: () => callbacks[index].push("focus"), onBlur: () => callbacks[index].push("blur") }))); });
    }
    assert.equal(host(trees[0], "field").props.authPresentation, undefined);
    assert.deepEqual(plain(trees[0].toJSON()), plain(trees[1].toJSON()));
    for (const phase of ["onFocus", "onBlur"]) {
      for (const tree of trees) await act(async () => host(tree, "field").props[phase]({ nativeEvent: {} }));
      assert.deepEqual(plain(trees[0].toJSON()), plain(trees[1].toJSON()));
    }
    assert.deepEqual(callbacks[0], ["focus", "blur"]);
    assert.deepEqual(callbacks[0], callbacks[1]);
    for (const tree of trees) await unmount(tree);
  }
});

const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node, pressed = false) => flat(typeof node.props.style === "function" ? node.props.style({ pressed }) : node.props.style);

for (const scheme of ["light", "dark"]) test(`presentation: ${scheme} Login keeps purple only on Sign in and visible field names`, async () => {
  const view = await login({ scheme });
  for (const name of ["Email", "Password"]) {
    assert.ok(text(view.tree, name));
    const input = host(view.tree, `${name.toLowerCase()}-input`);
    assert.equal(input.props.accessibilityLabel, name);
    assert.equal(input.props.placeholder, name);
    assert.equal(input.props.placeholderTextColor, view.colors.icon);
    assert.equal(styleOf(input).minHeight, 56);
    assert.equal(input.props.authPresentation, undefined);
  }
  assert.equal(styleOf(host(view.tree, "login-button")).backgroundColor, view.colors.primaryButton);
  assert.equal(textOf(host(view.tree, "login-button")), "Sign in");
  for (const id of ["forgot-password-link", "signup-link", "onboarding-return-link"]) {
    const action = host(view.tree, id);
    assert.ok(styleOf(action).minHeight >= 44);
    assert.equal(action.props.accessibilityRole, "button");
    assert.notEqual(styleOf(action, true).backgroundColor, view.colors.primaryButton);
    assert.notEqual(styleOf(action.findByType("Text")).color, view.colors.primaryButton);
  }
  assert.deepEqual(plain(view.tree.root.findByType("SafeAreaView").props.edges), ["top", "bottom"]);
  await unmount(view.tree);
});

for (const scheme of ["light", "dark"]) test(`presentation: ${scheme} opt-in input focus and error stay neutral/semantic without a halo`, async () => {
  const setup = mocksFor(scheme);
  const { AnimatedInput } = load("components/animated-input.tsx", setup.mocks);
  for (const error of [false, true]) {
    let tree;
    await act(async () => { tree = create(React.createElement(AnimatedInput, { testID: "field", authPresentation: true, error, value: "draft" })); });
    const field = () => host(tree, "field");
    const danger = scheme === "dark" ? "#FF8B82" : "#B42318";
    assert.equal(styleOf(field()).borderColor, error ? danger : setup.colors.inputBorder);
    await act(async () => field().props.onFocus({ nativeEvent: {} }));
    assert.equal(styleOf(field()).borderColor, error ? danger : setup.colors.text);
    assert.equal(styleOf(field()).borderWidth, 2);
    assert.equal(styleOf(field()).shadowOpacity, 0);
    assert.equal(styleOf(field()).elevation, 0);
    assert.equal(field().props.value, "draft");
    await act(async () => field().props.onBlur({ nativeEvent: {} }));
    assert.equal(styleOf(field()).borderWidth, 1);
    assert.equal(styleOf(field()).borderColor, error ? danger : setup.colors.inputBorder);
    await unmount(tree);
  }
});

test("presentation: password eye occupies a centered 44-point rail independent of font size", async () => {
  const view = await login();
  const eye = host(view.tree, "password-visibility-button");
  const style = styleOf(eye);
  assert.equal(style.top, 0);
  assert.equal(style.bottom, 0);
  assert.ok(style.width >= 44);
  assert.ok(style.minHeight >= 44);
  assert.equal(style.alignItems, "center");
  assert.equal(style.justifyContent, "center");
  assert.equal(styleOf(host(view.tree, "password-input")).height, undefined);
  assert.ok(styleOf(host(view.tree, "password-input")).paddingRight > style.width);
  assert.notEqual(styleOf(eye, true).backgroundColor, undefined);
  await unmount(view.tree);
});

test("presentation: iOS and Android keyboard layout permits first-tap controls and retained outside drafts", async () => {
  for (const platform of ["ios", "android"]) {
    const view = await login({ platform });
    const scroll = host(view.tree, "login-scroll");
    assert.equal(scroll.props.keyboardShouldPersistTaps, "always");
    assert.equal(scroll.props.keyboardDismissMode, platform === "ios" ? "interactive" : "on-drag");
    assert.equal(scroll.props.automaticallyAdjustKeyboardInsets, undefined);
    assert.equal(view.tree.root.findByType("KeyboardAvoidingView").props.behavior, platform === "ios" ? "padding" : undefined);
    assert.equal(styleOf({ props: { style: scroll.props.contentContainerStyle } }).flexGrow, 1);
    await enter(view.tree, "user@example.com", "draft");
    await act(async () => scroll.props.onTouchEnd({ target: 2, currentTarget: 1 }));
    assert.equal(view.calls.dismiss, 0);
    await act(async () => scroll.props.onTouchEnd({ target: 1, currentTarget: 1 }));
    await act(async () => view.tree.root.findByType("TouchableWithoutFeedback").props.onPress());
    assert.equal(view.calls.dismiss, 2);
    assert.equal(host(view.tree, "password-input").props.value, "draft");
    await tap(host(view.tree, "forgot-password-link"));
    assert.deepEqual(view.calls.routes, ["/forgot-password"]);
    await unmount(view.tree);
  }
});

test("presentation: title, notices and form actions remain uncapped and naturally sized", async () => {
  const view = await login({ passwordReset: "success" });
  await tap(host(view.tree, "login-button"));
  for (const node of view.tree.root.findAllByType("Text")) {
    assert.equal(styleOf(node).lineHeight, undefined);
    assert.equal(node.props.maxFontSizeMultiplier, undefined);
    assert.equal(node.props.numberOfLines, undefined);
    assert.equal(node.props.adjustsFontSizeToFit, undefined);
  }
  assert.equal(styleOf(host(view.tree, "password-reset-success")).color, view.colors.text);
  assert.equal(styleOf(host(view.tree, "login-error")).color, "#B42318");
  assert.equal(host(view.tree, "login-error").props.accessibilityRole, "alert");
  assert.equal(view.tree.root.findAllByType("Ionicons").length, 1);
  await unmount(view.tree);
});

test("scope: neutral input opt-in stays exclusive to the three approved screens without changing controllers", () => {
  const route = source("app/login.tsx");
  const state = (input) => input.slice(input.indexOf("  const [email"), input.indexOf("\n  return ("));
  assert.equal(state(route), state(original("app/login.tsx")));
  const callers = execFileSync("rg", ["-l", "authPresentation", "app", "components"], { cwd: root, encoding: "utf8" }).trim().split("\n").sort();
  assert.deepEqual(callers, ["app/login.tsx", "app/onboarding/fitness-experience/one-rep-max.tsx", "app/signup.tsx", "components/animated-input.tsx"]);
  const oneRepMax = "app/onboarding/fitness-experience/one-rep-max.tsx";
  const controller = (input) => input.slice(input.indexOf("export default function OneRepMaxScreen()"), input.indexOf("\n  return ("));
  const baseline = execFileSync("git", ["show", `e68e9de49bca3965e4c6d0b0e26cb9c6ed1fda1e:${oneRepMax}`], { cwd: root, encoding: "utf8" });
  assert.equal(controller(source(oneRepMax)), controller(baseline));
});
