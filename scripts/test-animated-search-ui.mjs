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
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "components/animated-search.tsx"), "utf8");
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
function load(file, mocks, override) {
  const filename = path.join(root, file); const module = { exports: {} }; const fallback = createRequire(filename);
  const code = ts.transpileModule(override ?? readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name) }, { filename }); return module.exports;
}
async function render(scheme, supplied = {}) {
  const calls = { animations: [], focusRequests: 0, focus: 0, blur: 0, changes: [], navigation: 0 }; let focused = false; let props; let tree;
  const mocks = { react: React, "react-native": { TextInput: "TextInput", View: "View", TouchableOpacity: "TouchableOpacity", Pressable: "Pressable", StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (value) => value.ios } }, "@expo/vector-icons": { Ionicons: "Ionicons" }, "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "react-native-reanimated": { __esModule: true, default: { View: "AnimatedView" }, useSharedValue: (value) => React.useRef({ value }).current, useAnimatedStyle: (fn) => new Proxy({}, { get: (_, key) => fn()[key], ownKeys: () => Reflect.ownKeys(fn()), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }), withSpring: (value, config) => { calls.animations.push(["spring", value, config]); return value; }, withTiming: (value, config) => { calls.animations.push(["timing", value, config]); return value; } } };
  mocks["@/constants/theme"] = load("constants/theme.ts", mocks); const { AnimatedSearch } = load("components/animated-search.tsx", mocks);
  const defaults = { value: "", onChangeText: (value) => calls.changes.push(value), onFocus: () => calls.focus++, onBlur: () => calls.blur++ };
  const input = () => tree.root.findByType("TextInput"); const sync = () => { props = input().props; };
  const node = { focus() { calls.focusRequests++; if (!focused && props.editable !== false) { focused = true; props.onFocus?.(); } }, blur() { if (focused) { focused = false; props.onBlur?.(); } } };
  await act(async () => { tree = create(React.createElement(AnimatedSearch, { ...defaults, ...supplied }), { createNodeMock: (element) => element.type === "TextInput" ? node : null }); }); sync();
  return { tree, calls, input, node, colors: mocks["@/constants/theme"].Colors[scheme], press: async (host) => { await act(async () => host.props.onPress()); sync(); }, focus: async () => { await act(async () => node.focus()); sync(); }, blur: async () => { await act(async () => node.blur()); sync(); }, update: async (next) => { await act(async () => tree.update(React.createElement(AnimatedSearch, { ...defaults, ...supplied, ...next }))); sync(); }, close: async () => { await act(async () => tree.unmount()); } };
}
for (const scheme of ["light", "dark"]) {
  test(`${scheme}: defaults and controlled text callbacks preserve exact input behavior`, async () => {
    const view = await render(scheme); const input = view.input(); assert.equal(input.props.placeholder, "Search for equipment"); assert.equal(input.props.accessibilityLabel, undefined); assert.equal(input.props.value, ""); assert.equal(input.props.editable, true); assert.equal(input.props.pointerEvents, "auto");
    await act(async () => input.props.onChangeText("  RoW  ")); assert.deepEqual(view.calls.changes, ["  RoW  "]); assert.equal(view.input().props.value, ""); await view.update({ value: "  RoW  ", accessibilityLabel: "Find equipment", testID: "fixture-search" }); assert.equal(view.input().props.value, "  RoW  "); assert.equal(view.input().props.accessibilityLabel, "Find equipment"); assert.equal(view.input().props.testID, "fixture-search"); await view.close();
  });
  test(`${scheme}: native focus and blur preserve purple focus and exact spring timing callbacks`, async () => {
    const view = await render(scheme); await view.focus(); assert.equal(view.calls.focus, 1); assert.equal(view.tree.root.findByType("Ionicons").props.color, view.colors.primaryButton);
    assert.deepEqual(JSON.parse(JSON.stringify(view.calls.animations)), [["spring", 1.02, { damping: 15, stiffness: 300 }], ["timing", 2, { duration: 200 }], ["timing", view.colors.primaryButton, { duration: 200 }]]);
    await view.blur(); assert.equal(view.calls.blur, 1); assert.equal(view.tree.root.findByType("Ionicons").props.color, view.colors.placeholder); assert.deepEqual(JSON.parse(JSON.stringify(view.calls.animations.slice(3))), [["spring", 1, { damping: 15, stiffness: 300 }], ["timing", 1, { duration: 200 }], ["timing", view.colors.inputBorder, { duration: 200 }]]); await view.close();
  });
  test(`${scheme}: navigation mode keeps original host geometry and direct navigation for either editable value`, async () => {
    for (const editable of [true, false]) { const view = await render(scheme, { editable, onPress: () => {} }); let navigation = 0; await view.update({ onPress: () => navigation++ }); const button = view.tree.root.findByType("TouchableOpacity");
      assert.equal(button.props.activeOpacity, 0.7); assert.equal(view.tree.root.findAllByType("Pressable").length, 0); assert.deepEqual(flat(button.findByType("View").props.style), { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, gap: 12, backgroundColor: view.colors.inputBackground, borderWidth: 1, borderColor: view.colors.inputBorder }); assert.deepEqual(flat(view.input().props.style), { flex: 1, fontSize: 16, fontWeight: "400", fontFamily: "system-ui", color: view.colors.text });
      assert.equal(view.input().props.editable, false); assert.equal(view.input().props.pointerEvents, "none"); await view.press(button); assert.equal(navigation, 1); assert.deepEqual(view.calls.animations, []); await view.focus(); assert.equal(view.calls.focus, 0); await view.close(); }
  });
  test(`${scheme}: read-only input retains value callbacks but native focus cannot activate`, async () => {
    const view = await render(scheme, { editable: false, value: "Saved query" }); await view.focus(); assert.equal(view.calls.focus, 0); assert.deepEqual(view.calls.animations, []); assert.equal(view.input().props.value, "Saved query"); assert.equal(view.input().props.pointerEvents, "auto"); await view.close();
  });
  test(`${scheme}: optional callbacks remain optional and focus never changes controlled value`, async () => {
    const view = await render(scheme, { onChangeText: undefined, onFocus: undefined, onBlur: undefined, value: "Original" }); await view.focus(); await view.blur(); assert.equal(view.input().props.value, "Original"); assert.equal(view.input().props.onChangeText, undefined); assert.deepEqual(view.calls.changes, []); await view.close();
  });
  test(`${scheme}: text remains naturally scalable with no caret interception or new input policy`, async () => {
    const view = await render(scheme); const props = view.input().props; for (const key of ["allowFontScaling", "maxFontSizeMultiplier", "numberOfLines", "selection", "onSelectionChange", "onTouchEnd", "onStartShouldSetResponder", "onPress", "autoFocus", "maxLength", "onSubmitEditing"]) assert.equal(props[key], undefined, key); assert.equal(flat(props.style).fontSize, 16); assert.equal(flat(props.style).fontWeight, "400"); await view.close();
  });
  test(`presentation: ${scheme} native editable target owns44 points and redistributed vertical padding without a height cap`, async () => {
    const view = await render(scheme); const inputStyle = flat(view.input().props.style); const shellStyle = flat(view.tree.root.findByType("AnimatedView").props.style); assert.ok(inputStyle.minHeight >= 44); assert.equal(inputStyle.paddingVertical, 12); assert.equal(shellStyle.paddingVertical, 0); assert.equal(inputStyle.height, undefined); assert.equal(inputStyle.maxHeight, undefined); assert.equal(shellStyle.height, undefined); assert.equal(shellStyle.maxHeight, undefined); assert.equal(shellStyle.paddingHorizontal, 16); await view.close();
  });
  test(`presentation: ${scheme} icon and padding shell focuses the actual native ref without duplicate accessibility`, async () => {
    const view = await render(scheme); const shell = view.tree.root.findByType("Pressable"); assert.equal(shell.props.accessible, false); assert.equal(shell.props.focusable, false); assert.equal(shell.props.accessibilityRole, undefined); assert.equal(shell.props.accessibilityLabel, undefined); assert.equal(shell.props.accessibilityState.disabled, false); assert.equal(view.tree.root.findByType("Ionicons").props.accessible, false); await view.press(shell); assert.equal(view.calls.focusRequests, 1); assert.equal(view.calls.focus, 1); assert.deepEqual(view.calls.changes, []); await view.close();
  });
  test(`presentation: ${scheme} repeated shell taps delegate to native focus without duplicate events or animations`, async () => {
    const view = await render(scheme); const shell = view.tree.root.findByType("Pressable"); await view.press(shell); await view.press(shell); assert.equal(view.calls.focusRequests, 2); assert.equal(view.calls.focus, 1); assert.equal(view.calls.animations.length, 3); await view.blur(); await view.press(shell); assert.equal(view.calls.focus, 2); assert.equal(view.calls.blur, 1); assert.deepEqual(view.calls.changes, []); await view.close();
  });
  test(`presentation: ${scheme} disabled editable shell cannot focus even when its callback is invoked directly`, async () => {
    const view = await render(scheme); await view.update({ editable: false }); const shells = view.tree.root.findAllByType("Pressable"); for (const shell of shells) { assert.equal(shell.props.disabled, true); assert.equal(shell.props.accessibilityState.disabled, true); await view.press(shell); } const requests = view.calls.focusRequests; assert.equal(requests, 0); assert.equal(view.calls.focus, 0); await view.update({ editable: true }); const shell = view.tree.root.findByType("Pressable"); assert.equal(shell.props.disabled, false); assert.equal(shell.props.accessibilityState.disabled, false); await view.press(shell); assert.equal(view.calls.focus, 1); await view.close();
  });
}
test("web: real RN-web SSR excludes the unnamed shell tab stop while retaining the native editable input", () => {
  const native = createRequire(import.meta.url)("react-native-web");
  const mocks = { react: React, "react-native": native, "@expo/vector-icons": { Ionicons: "span" }, "@/hooks/use-color-scheme": { useColorScheme: () => "light" }, "react-native-reanimated": { __esModule: true, default: { View: native.View }, useSharedValue: (value) => React.useRef({ value }).current, useAnimatedStyle: (fn) => fn(), withSpring: (value) => value, withTiming: (value) => value } };
  mocks["@/constants/theme"] = load("constants/theme.ts", mocks);
  const markup = (code) => { const { AnimatedSearch } = load("components/animated-search.tsx", mocks, code); return renderToStaticMarkup(React.createElement(AnimatedSearch, { value: "", accessibilityLabel: "Find equipment", testID: "actual-web-input" })); };
  const current = markup(source); const outer = current.match(/^<div\b[^>]*>/)?.[0]; assert.ok(outer); assert.match(outer, /tabindex="-1"/); assert.doesNotMatch(outer, /role=|aria-label=/);
  const input = current.match(/<input\b[^>]*>/)?.[0]; assert.ok(input); assert.match(input, /aria-label="Find equipment"/); assert.match(input, /data-testid="actual-web-input"/); assert.doesNotMatch(input, /tabindex="-1"|readonly=|disabled=/);
  const previous = markup(source.replace("      tabIndex={-1}\n", "")); assert.match(previous.match(/^<div\b[^>]*>/)?.[0] ?? "", /tabindex="0"/); assert.ok(previous.includes("<input"));
});
test("scope: public props, native focus motion and navigation JSX remain byte-identical", () => {
  const sha = (value) => createHash("sha256").update(value).digest("hex"); for (const [start, end, hash] of [["interface AnimatedSearchProps", "export function", "e456c5c8c1af4541b4a02ca2925f0b8c757fe73bc6b958e0dd9d71b5b302a754"], ["  const handleFocus", "  const content", "1ec710259a45b30d750ac3069eec552be4c37b1e2dcdac543d6de4d618e66fa0"], ["  if (onPress) {\n    // Simple", "  // Editable input", "a93c3090d7d3dcdc92bd46c5e806aeac80c85defe090e97b579e2fb4305882f5"]]) assert.equal(sha(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))), hash);
});
