import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const babel = require("@babel/core"), compilerRuntime = require("react/compiler-runtime");
const source = (file) => readFileSync(path.join(root, file), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const plain = (value) => JSON.parse(JSON.stringify(value));
const editorFile = "components/equipment-weight-editor.tsx";
const outputs = new Map();
function emitted(file, compiled) {
  const key = `${compiled}:${file}`;
  if (!outputs.has(key)) outputs.set(key, babel.transformSync(source(file), {
    filename: path.join(root, file), configFile: false, babelrc: false,
    presets: [[require.resolve("babel-preset-expo"), { jsxRuntime: "classic", enableBabelRuntime: false, worklets: false, reanimated: false }]],
    caller: { name: "metro", bundler: "metro", platform: "ios", engine: "hermes", isDev: true, isServer: false, isReactServer: false, isNodeModule: false, supportsStaticESM: false, supportsReactCompiler: compiled },
  }).code);
  return outputs.get(key);
}
function load(file, mocks, compiled, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(emitted(file, compiled), { React, __DEV__: true, Error, console, module, exports: module.exports, require: (name) => {
    assert.ok(Object.hasOwn(mocks, name), `Unmocked module in ${file}: ${name}`);
    return mocks[name];
  }, ...globals }, { filename: path.join(root, file) });
  return module.exports;
}
const native = { ActivityIndicator: "ActivityIndicator", ScrollView: "ScrollView", Text: "Text", TouchableOpacity: "TouchableOpacity", View: "View", StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (values) => values.ios } };
const hosts = [
  { slice: "U36", file: "app/settings/dumbbells.tsx", kind: "dumbbell", mode: "settings", field: "dumbbellWeights", other: "plateWeights", title: "Dumbbells" },
  { slice: "U37", file: "app/settings/plates.tsx", kind: "plate", mode: "settings", field: "plateWeights", other: "dumbbellWeights", title: "Plates" },
  { slice: "U42", file: "app/onboarding/training-place/edit-dumbbells.tsx", kind: "dumbbell", mode: "onboarding", field: "dumbbellWeights", other: "plateWeights", title: "Dumbbells" },
  { slice: "U43", file: "app/onboarding/training-place/edit-plates.tsx", kind: "plate", mode: "onboarding", field: "plateWeights", other: "dumbbellWeights", title: "Plates" },
];
const optionsFor = (host) => host.kind === "dumbbell" ? [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125] : [1.25, 2.5, 5, 10, 15, 20, 25, 35, 45, 50];
const weights = (extra = {}) => ({ dumbbellWeights: [2.5, 10], plateWeights: [5, 20], ...extra });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const styleOf = (node) => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
const byID = (view, testID) => view.tree.root.findByProps({ testID });
const inside = (node, ancestor) => { for (let parent = node.parent; parent; parent = parent.parent) if (parent === ancestor) return true; return false; };
const glyphContainer = (node) => node.findAllByType("View").find((child) => child.props.importantForAccessibility === "no-hide-descendants");
const target = (node) => { assert.ok(styleOf(node).minHeight >= 44); assert.ok(styleOf(node).minWidth >= 44); assert.equal(styleOf(node).height, undefined); };
const uncapped = (node) => { assert.notEqual(node.props.allowFontScaling, false); assert.equal(node.props.maxFontSizeMultiplier, undefined); assert.equal(node.props.numberOfLines, undefined); assert.notEqual(node.props.adjustsFontSizeToFit, true); assert.equal(styleOf(node).height, undefined); assert.equal(styleOf(node).maxHeight, undefined); };
const texts = (view) => view.tree.root.findAllByType("Text").map(textOf);
const touch = (view, label) => view.tree.root.findAllByType("TouchableOpacity").find((node) => node.props.accessibilityLabel === label);
const saveButton = (view) => touch(view, `Save ${view.host.title}`);
const backButton = (view) => touch(view, `Back from ${view.host.title}`);
const allButton = (view) => view.tree.root.findAllByType("TouchableOpacity").find((node) => ["Select all", "Deselect all"].includes(textOf(node)));
const rows = (view) => view.tree.root.findAllByType("TouchableOpacity").filter((node) => node.findAllByType("Text").some((text) => /^\d+(\.\d+)? lb$/.test(textOf(text))));
const row = (view, weight) => rows(view).find((node) => node.findAllByType("Text").some((text) => textOf(text) === `${weight} lb`));
const selected = (view) => rows(view).filter((node) => node.findByType(view.Checkmark).props.visible).map((node) => Number(textOf(node.findAllByType("Text").find((text) => /^\d+(\.\d+)? lb$/.test(textOf(text)))).slice(0, -3)));
const tap = async (view, node) => { assert.ok(node); assert.notEqual(node.props.disabled, true); await view.run(() => { void node.props.onPress(); }); };
const settle = async (view, pending, value, reject = false) => view.run(() => reject ? pending.reject(value) : pending.resolve(value));
const close = async (view) => view.run(() => view.tree.unmount());
class BoundedRenderError extends Error { constructor() { super("Equipment editor fixture stopped after12 provider renders in one action"); this.name = "BoundedRenderError"; } }

async function screen(host, scheme, options = {}) {
  const compiled = options.compiled ?? true, AuthContext = React.createContext(null);
  let account = { token: host.mode === "settings" ? "fixture-token-A" : null, isBootstrapping: false, isLoggedIn: host.mode === "settings" };
  let read = options.read ?? (async () => weights(options.weights));
  let write = options.write ?? (async (_token, value) => value);
  let ready = false, budget = 12, onboarding, persisted, previousUpdate;
  const calls = { requests: [], storage: [], routes: [], alerts: [], warnings: [], renderCount: 0, maxFlushRenders: 0, identities: [], caught: [] };
  const run = async (callback) => { budget = 12; const start = calls.renderCount; await act(async () => callback()); calls.maxFlushRenders = Math.max(calls.maxFlushRenders, calls.renderCount - start); };
  const mocks = {
    react: React, "react/compiler-runtime": compilerRuntime,
    "react-native": { ...native, useWindowDimensions: () => options.dimensions ?? { width: 390, height: 844, scale: 3, fontScale: 1 }, Alert: { alert: (...args) => calls.alerts.push(plain(args)) } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => options.insets ?? { top: 47, bottom: 34, left: 0, right: 0 } },
    "react-native-reanimated": { __esModule: true, default: { View: "Animated.View" }, useSharedValue: (value) => React.useRef({ value }).current, useAnimatedStyle: (compute) => compute(), withTiming: (value) => value, withSequence: (...values) => values.at(-1) },
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "expo-router": { useRouter: () => ({ back: () => calls.routes.push(["back"]) }) },
    "@/utils/authContext": { AuthContext },
    "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@react-native-async-storage/async-storage": {
      getItem: async (key) => { calls.storage.push(["get", key]); return options.stored === undefined ? null : JSON.stringify(options.stored); },
      setItem: async (key, value) => { calls.storage.push(["set", key, JSON.parse(value)]); },
      removeItem: async (key) => { calls.storage.push(["remove", key]); },
    },
    "./httpClient": { requestJson: (url, args) => {
      assert.equal(url, "/v1/users/me/equipment-weights");
      calls.requests.push([url, plain(args)]);
      if (args.method === "GET") return read(args.token);
      assert.equal(args.method, "PUT"); return write(args.token, args.body);
    } },
  };
  const consoleMock = { ...console, warn: (...args) => calls.warnings.push(args) };
  mocks["@/constants/theme"] = load("constants/theme.ts", mocks, compiled);
  mocks["@/hooks/use-theme-color"] = load("hooks/use-theme-color.ts", mocks, compiled);
  mocks["@/components/themed-view"] = load("components/themed-view.tsx", mocks, compiled);
  mocks["@/components/animated-checkmark"] = load("components/animated-checkmark.tsx", mocks, compiled);
  mocks["@/services/equipmentWeightsService"] = load("services/equipmentWeightsService.ts", mocks, compiled);
  const draft = load("utils/onboardingContext.tsx", mocks, compiled), saved = load("utils/equipmentWeightsContext.tsx", mocks, compiled, { console: consoleMock });
  mocks["@/utils/onboardingContext"] = draft; mocks["@/utils/equipmentWeightsContext"] = saved;
  mocks["@/components/equipment-weight-editor"] = load(editorFile, mocks, compiled);
  const { default: Screen } = load(host.file, mocks, compiled);
  class Boundary extends React.Component {
    state = { error: null };
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error) { calls.caught.push({ name: error.name, message: error.message }); }
    render() { return this.state.error ? React.createElement("BoundedStop") : this.props.children; }
  }
  function Probe() {
    onboarding = React.useContext(draft.OnboardingContext); persisted = React.useContext(saved.EquipmentWeightsContext);
    if (ready) {
      calls.renderCount += 1;
      calls.identities.push(previousUpdate === onboarding.updateField);
      previousUpdate = onboarding.updateField;
      if (--budget < 0) throw new BoundedRenderError();
    }
    return null;
  }
  const element = () => React.createElement(AuthContext.Provider, { value: account }, React.createElement(Boundary, null, React.createElement(draft.OnboardingProvider, null, React.createElement(saved.EquipmentWeightsProvider, null, React.createElement(Probe), ready && React.createElement(Screen)))));
  let tree;
  await run(() => { tree = create(element()); });
  if (options.seed) await run(() => onboarding.updateMultipleFields(options.seed));
  ready = true;
  await run(() => tree.update(element()));
  return {
    tree, host, calls, run, Checkmark: mocks["@/components/animated-checkmark"].AnimatedCheckmark,
    get draft() { return onboarding.data; }, get persisted() { return persisted; }, get bounded() { return tree.root.findAllByType("BoundedStop").length > 0; },
    setRead: (next) => { read = next; }, setWrite: (next) => { write = next; },
    refresh: () => run(() => persisted.refresh()),
    account: (token, isBootstrapping = false) => { account = { token, isLoggedIn: Boolean(token), isBootstrapping }; return run(() => tree.update(element())); },
  };
}

test("scope: reconstruct original imports and pin unchanged options/controllers, four hosts and shared modules", () => {
  const input = source(editorFile), editorStart = input.indexOf("export function EquipmentWeightEditor"), settingsStart = input.indexOf("export function EquipmentWeightSettingsEditor");
  const imports = input.slice(0, input.indexOf("export const DUMBBELL_WEIGHTS"));
  for (const addition of ["  useWindowDimensions,\n", 'import { useSafeAreaInsets } from "react-native-safe-area-context";\n']) assert.equal(imports.split(addition).length, 2);
  for (const [value, bytes, expected] of [
    [imports.replace("  useWindowDimensions,\n", "").replace('import { useSafeAreaInsets } from "react-native-safe-area-context";\n', ""), 652, "0ed4a8ce9e7e198b819b39633c443f42ee6a3701e294ea7d59b7ef0ee6a8532f"],
    [input.slice(input.indexOf("export const DUMBBELL_WEIGHTS"), editorStart), 338, "006db819507821cf343b68dc7ff917c95a9ddbd0b6775f9f6414d7cce9991ede"],
    [input.slice(editorStart, input.indexOf("  const insets = useSafeAreaInsets();", editorStart)), 1952, "36ca0e3f6d5209005bd91916e5f0cfd689c82c256609260a679f242316a2cbde"],
    [input.slice(settingsStart, input.indexOf("  if (!persisted.hasLoaded)", settingsStart)), 229, "d30fe01d3b50af004b9af23e4232b416134f912bdbaa9667903bf124121f346e"],
  ]) { assert.equal(Buffer.byteLength(value), bytes); assert.equal(hash(value), expected); }
  assert.equal(input.slice(input.indexOf("  const insets = useSafeAreaInsets();", editorStart), input.indexOf("  return (", editorStart)), "  const insets = useSafeAreaInsets();\n  const { fontScale } = useWindowDimensions();\n  const largeText = fontScale > 1.3;\n\n");
  for (const [file, expected] of Object.entries({
    "app/settings/dumbbells.tsx": "2a60d63e8c00e75b440d48c2a0487fa6331da9fa5a2fc8678336ad442f67e580",
    "app/settings/plates.tsx": "8ed11da55c75f51fad75369dec5c03fac87f11f114acc3f933487793e81a50ad",
    "app/onboarding/training-place/edit-dumbbells.tsx": "7964fc253f6c23923d2b7bb608ce2b8710f856b3363fa39579923dd4bf7b2bbd",
    "app/onboarding/training-place/edit-plates.tsx": "b0019538bb6e545bf47f87d5a3d4f766e9148b183c6bf039a7b74ac42283bea8",
    "utils/onboardingContext.tsx": "4e8d1c2948f77152251971d444ef527291609b58f0e9f12bc3a361e5828a994a",
    "utils/equipmentWeightsContext.tsx": "8866ed699b4de2fca8a86001b7846872e8975132ddc4f1e186a0cfe496508a9f",
    "services/equipmentWeightsService.ts": "2feab29cb3a1ad4ddd14e8371502866167a7241a603c94bb8e2c4182a104a5ad",
    "components/animated-checkmark.tsx": "27c0f4a1c077fdfde335ffa69f6f6c28430b9390966f74af69e3bea94508f578",
    "components/themed-view.tsx": "b95ec1df30abf73d26593db2b6e6280af33b39f3f3b6d960765e99fb6f6843c8",
    "hooks/use-theme-color.ts": "49ec7d86e952e315f8172e7994a879d3c63023f2955f667fedba6ab5c89c1710",
    "constants/theme.ts": "0e4066b19531c70b14aeb5656a6f0de16b37f56ad410b87c2f923168cebfcad1",
    "app/onboarding/training-place/_layout.tsx": "e53a9b21736623f8c8c3fdb75769f847bf92b6e7574df49613623f4cb3d27b52",
    "app.json": "7c3697289889a0b98f502fbdc54edc756392e32536edced909f98554a5160eb2",
  })) assert.equal(hash(source(file)), expected, file);
});

test("compiler qualification: actual app enables compiler and Expo preset emits caches only when enabled", () => {
  assert.equal(JSON.parse(source("app.json")).expo.experiments.reactCompiler, true);
  for (const file of [editorFile, "utils/onboardingContext.tsx"]) {
    assert.equal(emitted(file, false).includes("react/compiler-runtime"), false);
    assert.equal(emitted(file, true).includes("react/compiler-runtime"), true);
  }
});

for (const scheme of ["light", "dark"]) for (const host of hosts) {
  if (host.mode === "settings") {
    test(`${host.slice} ${scheme}: actual route/providers/service render all lb options and original header in both transform modes`, async () => {
      for (const compiled of [false, true]) {
        const view = await screen(host, scheme, { compiled });
        assert.equal(view.bounded, false); assert.deepEqual(view.calls.caught, []);
        assert.equal(rows(view).length, optionsFor(host).length);
        assert.deepEqual(rows(view).map((node) => textOf(node.findAllByType("Text").find((text) => /^\d+(\.\d+)? lb$/.test(textOf(text))))), optionsFor(host).map((weight) => `${weight} lb`));
        assert.deepEqual(selected(view), weights()[host.field]);
        assert.ok(texts(view).includes(host.title)); assert.ok(backButton(view)); assert.ok(saveButton(view));
        assert.equal(textOf(allButton(view)), "Select all");
        assert.deepEqual(view.calls.requests, [["/v1/users/me/equipment-weights", { method: "GET", token: "fixture-token-A" }]]);
        await close(view);
      }
    });

    test(`${host.slice} ${scheme}: toggles remain local and Save sends sorted selected kind while preserving the other kind`, async () => {
      const view = await screen(host, scheme, { weights: { [host.field]: [] } });
      const [first, second] = optionsFor(host);
      await tap(view, row(view, second)); await tap(view, row(view, first));
      assert.equal(view.calls.requests.length, 1);
      await tap(view, saveButton(view));
      assert.deepEqual(view.calls.requests[1], ["/v1/users/me/equipment-weights", { method: "PUT", token: "fixture-token-A", body: weights({ [host.field]: [first, second] }) }]);
      assert.deepEqual(view.calls.routes, [["back"]]); await close(view);
    });

    test(`${host.slice} ${scheme}: Select all and Deselect all keep exact option sets and Back does not save`, async () => {
      const view = await screen(host, scheme);
      await tap(view, allButton(view)); assert.deepEqual(selected(view), optionsFor(host)); assert.equal(textOf(allButton(view)), "Deselect all");
      await tap(view, allButton(view)); assert.deepEqual(selected(view), []); assert.equal(textOf(allButton(view)), "Select all");
      await tap(view, backButton(view)); assert.deepEqual(view.calls.routes, [["back"]]); assert.equal(view.calls.requests.length, 1); await close(view);
    });

    test(`${host.slice} ${scheme}: initial loading has spinner and no editor Back before successful resource`, async () => {
      const pending = deferred(), view = await screen(host, scheme, { read: () => pending.promise });
      assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 1); assert.equal(backButton(view), undefined); assert.equal(rows(view).length, 0);
      await settle(view, pending, weights()); assert.equal(rows(view).length, optionsFor(host).length); await close(view);
    });

    test(`${host.slice} ${scheme}: failed load keeps exact combined Retry and calls actual provider/service again`, async () => {
      const view = await screen(host, scheme, { read: async () => { throw Error("fixture load failure"); } });
      assert.ok(texts(view).includes("Could not load equipment weights. Tap to retry.")); assert.equal(backButton(view), undefined);
      view.setRead(async () => weights()); await tap(view, view.tree.root.findByType("TouchableOpacity"));
      assert.equal(view.calls.requests.length, 2); assert.equal(rows(view).length, optionsFor(host).length); await close(view);
    });

    test(`${host.slice} ${scheme}: pending Save disables only Save while Back/rows/all remain active and submitted arrays stay captured`, async () => {
      const pending = deferred(), view = await screen(host, scheme, { write: () => pending.promise });
      await tap(view, saveButton(view));
      assert.equal(textOf(saveButton(view)), "Saving…"); assert.deepEqual(plain(saveButton(view).props.accessibilityState), { disabled: true, busy: true });
      assert.notEqual(backButton(view).props.disabled, true); assert.notEqual(allButton(view).props.disabled, true); assert.notEqual(row(view, optionsFor(host)[0]).props.disabled, true);
      await tap(view, allButton(view)); assert.deepEqual(selected(view), optionsFor(host));
      await tap(view, row(view, optionsFor(host)[0])); assert.equal(selected(view).length, optionsFor(host).length - 1);
      assert.deepEqual(view.calls.requests[1][1].body, weights());
      await settle(view, pending, weights()); assert.equal(saveButton(view).props.disabled, false); assert.deepEqual(view.calls.routes, [["back"]]); await close(view);
    });

    test(`${host.slice} ${scheme}: failed Save alerts then retries same original payload`, async () => {
      const view = await screen(host, scheme, { write: async () => { throw Error("fixture write failure"); } });
      await tap(view, saveButton(view)); assert.deepEqual(view.calls.alerts, [["Could not save", "Please try again."]]); assert.deepEqual(view.calls.routes, []);
      assert.equal(saveButton(view).props.disabled, false); view.setWrite(async (_token, value) => value); await tap(view, saveButton(view));
      assert.deepEqual(view.calls.requests[1], view.calls.requests[2]); assert.deepEqual(view.calls.routes, [["back"]]); await close(view);
    });

    test(`${host.slice} ${scheme}: resource refresh does not reset local selections and Save uses current other-kind context`, async () => {
      const view = await screen(host, scheme), first = optionsFor(host)[0]; await tap(view, row(view, first));
      const local = selected(view), refreshed = weights({ [host.field]: [], [host.other]: [5] });
      view.setRead(async () => refreshed); await view.refresh(); assert.deepEqual(selected(view), local);
      await tap(view, saveButton(view)); assert.deepEqual(view.calls.requests.at(-1)[1].body, { ...refreshed, [host.field]: local }); await close(view);
    });

    for (const reject of [false, true]) test(`${host.slice} ${scheme}: token A→B→A fences stale GET ${reject ? "failure" : "success"} before current resource appears`, async () => {
      const old = deferred(), current = deferred(); let readsA = 0;
      const view = await screen(host, scheme, { read: (token) => token === "fixture-token-A" ? ++readsA === 1 ? old.promise : current.promise : Promise.resolve(weights()) });
      await view.account("fixture-token-B"); await view.account("fixture-token-A");
      await settle(view, old, reject ? Error("stale fixture read") : weights({ [host.field]: optionsFor(host) }), reject); assert.equal(rows(view).length, 0);
      await settle(view, current, weights()); assert.deepEqual(selected(view), weights()[host.field]); await close(view);
    });

    for (const reject of [false, true]) test(`${host.slice} ${scheme}: inherited stale PUT ${reject ? "failure" : "success"} after token A→B→A still resolves editor Back`, async () => {
      const pending = deferred(), view = await screen(host, scheme, { write: () => pending.promise }); await tap(view, saveButton(view));
      await view.account("fixture-token-B"); await view.account("fixture-token-A"); await settle(view, pending, reject ? Error("stale fixture write") : weights({ [host.field]: optionsFor(host) }), reject);
      assert.deepEqual(view.calls.routes, [["back"]]); assert.deepEqual(view.calls.alerts, []); assert.deepEqual(plain(view.persisted[host.field]), weights()[host.field]); await close(view);
    });

    test(`${host.slice} ${scheme}: inherited pending Save completion after unmount still calls captured Back`, async () => {
      const pending = deferred(), view = await screen(host, scheme, { write: () => pending.promise }); await tap(view, saveButton(view)); await close(view);
      await settle(view, pending, weights()); assert.deepEqual(view.calls.routes, [["back"]]); assert.deepEqual(view.calls.alerts, []);
    });
  } else {
    test(`${host.slice} ${scheme}: compiler-enabled real provider preserves explicit empty initial selection and automatically persists only fixture storage`, async (t) => {
      const view = await screen(host, scheme);
      assert.equal(view.bounded, false); assert.deepEqual(view.calls.caught, []); assert.deepEqual(selected(view), []);
      assert.equal(textOf(allButton(view)), "Select all"); assert.equal(saveButton(view), undefined); assert.equal(backButton(view), undefined);
      assert.ok(texts(view).includes(host.title)); assert.equal(rows(view).length, optionsFor(host).length); assert.deepEqual(view.calls.requests, []);
      const writes = view.calls.storage.filter(([method]) => method === "set"); assert.ok(writes.length > 0); assert.deepEqual(writes.at(-1)[2][host.field], []);
      assert.ok(view.calls.identities.slice(1).every(Boolean));
      t.diagnostic(JSON.stringify({ slice: host.slice, scheme, compiled: true, providerRenders: view.calls.renderCount, maximumRendersPerAction: view.calls.maxFlushRenders, fixtureStorageWrites: writes.length, updateFieldIdentityChangesAfterFirst: view.calls.identities.slice(1).filter((same) => !same).length }));
      await close(view);
    });

    test(`${host.slice} ${scheme}: undefined field defaults to all through real provider API and keeps the other kind`, async () => {
      const view = await screen(host, scheme, { seed: { [host.field]: undefined, [host.other]: [5] } });
      assert.equal(view.bounded, false); assert.deepEqual(selected(view), optionsFor(host)); assert.deepEqual(plain(view.draft[host.field]), optionsFor(host)); assert.deepEqual(plain(view.draft[host.other]), [5]);
      assert.equal(textOf(allButton(view)), "Deselect all"); assert.deepEqual(view.calls.requests, []); await close(view);
    });

    test(`${host.slice} ${scheme}: restored custom draft keeps sorted automatic selection updates and untouched fields`, async () => {
      const initial = [optionsFor(host)[2], optionsFor(host)[0]], view = await screen(host, scheme, { stored: { [host.field]: initial, [host.other]: [5], preferredName: "Fixture guest" } });
      assert.deepEqual(selected(view), [...initial].sort((a, b) => a - b)); assert.equal(view.draft.preferredName, "Fixture guest");
      await tap(view, row(view, optionsFor(host)[1])); assert.deepEqual(plain(view.draft[host.field]), optionsFor(host).slice(0, 3));
      await tap(view, allButton(view)); assert.deepEqual(plain(view.draft[host.field]), optionsFor(host));
      await tap(view, allButton(view)); assert.deepEqual(plain(view.draft[host.field]), []); assert.deepEqual(plain(view.draft[host.other]), [5]);
      assert.deepEqual(view.calls.requests, []); assert.deepEqual(view.calls.routes, []); assert.equal(view.bounded, false); await close(view);
    });

    test(`${host.slice} ${scheme}: compiler-disabled real-provider loop is stopped within a bounded fixture, not reported as native failure`, async (t) => {
      const view = await screen(host, scheme, { compiled: false });
      assert.equal(view.bounded, true); assert.ok(view.calls.caught.some(({ name }) => name === "BoundedRenderError"));
      assert.ok(view.calls.renderCount > 12 && view.calls.renderCount < 20); assert.ok(view.calls.identities.slice(1).some((same) => !same));
      assert.ok(view.calls.storage.filter(([method]) => method === "set").length >= 5); assert.deepEqual(view.calls.requests, []);
      t.diagnostic(JSON.stringify({ slice: host.slice, scheme, compiled: false, boundedStop: true, providerRenders: view.calls.renderCount, maximumRendersPerAction: view.calls.maxFlushRenders, fixtureStorageWrites: view.calls.storage.filter(([method]) => method === "set").length, updateFieldIdentityChangesAfterFirst: view.calls.identities.slice(1).filter((same) => !same).length }));
      await close(view);
    });
  }
}

const layouts = [
  { name: "normal home indicator", dimensions: { width: 430, height: 932, scale: 3, fontScale: 1 }, insets: { top: 59, bottom: 34, left: 0, right: 0 }, large: false },
  { name: "normal zero insets", dimensions: { width: 375, height: 667, scale: 2, fontScale: 1 }, insets: { top: 0, bottom: 0, left: 0, right: 0 }, large: false },
  { name: "MAX compact", dimensions: { width: 375, height: 667, scale: 2, fontScale: 3.1 }, insets: { top: 20, bottom: 0, left: 0, right: 0 }, large: true },
  { name: "MAX home indicator", dimensions: { width: 430, height: 932, scale: 3, fontScale: 3.1 }, insets: { top: 59, bottom: 34, left: 0, right: 0 }, large: true },
];

for (const scheme of ["light", "dark"]) for (const host of hosts) {
  const ink = scheme === "light" ? "#11181C" : "#ECEDEE", border = scheme === "light" ? "#E5E5E5" : "#3A3A3A";
  for (const layout of layouts) test(`${host.slice} ${scheme} ${layout.name}: neutral bulk action, real targets, inset ownership and uncapped scroll title`, async () => {
    const view = await screen(host, scheme, layout), scroll = byID(view, "equipment-weight-scroll");
    assert.equal(view.bounded, false); assert.deepEqual(view.calls.caught, []);
    assert.equal(styleOf(scroll).flex, 1);
    assert.equal(scroll.props.contentInsetAdjustmentBehavior, host.mode === "settings" ? "never" : "automatic");
    const scrollStyle = Object.assign({}, ...scroll.props.contentContainerStyle.flat(Infinity).filter(Boolean));
    assert.equal(scrollStyle.paddingBottom, host.mode === "settings" ? 40 + layout.insets.bottom : 40);
    const shell = view.tree.root.findAllByType("View").find((node) => styleOf(node).flex === 1 && node.findAllByProps({ testID: "equipment-weight-scroll" }).length > 0);
    assert.ok(shell); assert.equal(styleOf(shell).paddingTop, host.mode === "settings" ? layout.insets.top : undefined);
    const heading = view.tree.root.findAllByType("Text").filter((node) => textOf(node) === host.title);
    assert.equal(heading.length, 1); assert.equal(heading[0].props.accessibilityRole, "header"); uncapped(heading[0]);
    assert.equal(inside(heading[0], scroll), host.mode === "onboarding" || layout.large);
    assert.equal(styleOf(heading[0]).fontSize, host.mode === "onboarding" || layout.large ? 28 : 20);
    const bodyHeader = allButton(view).parent;
    assert.equal(styleOf(bodyHeader).flexWrap, "wrap");
    assert.equal(styleOf(bodyHeader).flexDirection, layout.large ? "column" : "row");
    assert.equal(styleOf(bodyHeader).columnGap, 12); assert.equal(styleOf(bodyHeader).rowGap, 8);
    target(allButton(view)); assert.equal(allButton(view).props.accessibilityRole, "button");
    assert.equal(allButton(view).props.accessibilityLabel, `Select all ${host.title.toLowerCase()}`);
    assert.equal(styleOf(allButton(view).findByType("Text")).color, ink); uncapped(allButton(view).findByType("Text"));
    assert.equal(styleOf(allButton(view)).maxWidth, "100%");
    if (host.mode === "settings") {
      target(backButton(view)); target(saveButton(view));
      assert.equal(backButton(view).props.accessibilityRole, "button"); assert.equal(saveButton(view).props.accessibilityRole, "button");
      assert.equal(backButton(view).props.hitSlop, 10); assert.equal(saveButton(view).props.hitSlop, 10);
      assert.equal(styleOf(saveButton(view).findByType("Text")).color, "#6a4ff5"); uncapped(saveButton(view).findByType("Text"));
      assert.equal(inside(saveButton(view), scroll), false); assert.equal(saveButton(view).parent, backButton(view).parent);
      assert.equal(styleOf(saveButton(view).parent).paddingTop, undefined);
      assert.equal(saveButton(view).parent.findAllByType("Text").some((node) => textOf(node) === host.title), !layout.large);
    } else { assert.equal(backButton(view), undefined); assert.equal(saveButton(view), undefined); }
    const initial = host.mode === "settings" ? weights()[host.field] : [];
    for (const weight of optionsFor(host)) {
      const item = row(view, weight), selectedInitially = initial.includes(weight), glyph = glyphContainer(item);
      target(item); assert.equal(item.props.accessible, true); assert.equal(item.props.accessibilityRole, "checkbox");
      assert.equal(item.props.accessibilityLabel, `${weight} lb`); assert.deepEqual(plain(item.props.accessibilityState), { checked: selectedInitially });
      assert.equal(item.findByType(view.Checkmark).props.visible, selectedInitially);
      assert.equal(glyph.props.accessibilityElementsHidden, true);
      const icon = item.findByType(view.Checkmark).findByType("Ionicons");
      assert.equal(icon.props.name, "checkmark"); assert.equal(icon.props.size, 16); assert.equal(icon.props.color, "#FFFFFF");
      assert.equal(icon.props.accessible, false); assert.equal(icon.props.allowFontScaling, false);
      assert.equal(item.findAllByType("Text").some((node) => textOf(node) === "✓"), false);
      assert.equal(styleOf(glyph).backgroundColor, selectedInitially ? "#6a4ff5" : "transparent");
      assert.equal(styleOf(glyph).borderColor, selectedInitially ? "#6a4ff5" : border);
      uncapped(item.findAllByType("Text").find((node) => textOf(node) === `${weight} lb`));
    }
    await tap(view, allButton(view)); assert.deepEqual(selected(view), optionsFor(host));
    assert.equal(allButton(view).props.accessibilityLabel, `Deselect all ${host.title.toLowerCase()}`);
    assert.equal(styleOf(allButton(view).findByType("Text")).color, ink);
    assert.ok(rows(view).every((node) => node.props.accessibilityState.checked === true));
    await tap(view, row(view, optionsFor(host)[0]));
    assert.equal(row(view, optionsFor(host)[0]).props.accessibilityState.checked, false);
    assert.equal(allButton(view).props.accessibilityLabel, `Select all ${host.title.toLowerCase()}`);
    assert.ok(rows(view).slice(1).every((node) => node.props.accessibilityState.checked === true));
    await close(view);
  });

  if (host.mode === "settings") {
    for (const layout of [layouts[0], layouts[2]]) test(`${host.slice} ${scheme} ${layout.name}: loading and Retry retain original no-Back branch and service transitions`, async () => {
      const pending = deferred(), retry = deferred(), view = await screen(host, scheme, { ...layout, read: () => pending.promise });
      assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 1);
      assert.equal(backButton(view), undefined); assert.equal(saveButton(view), undefined); assert.equal(rows(view).length, 0);
      assert.equal(view.tree.root.findAllByProps({ testID: "equipment-weight-scroll" }).length, 0);
      await settle(view, pending, Error("fixture load failure"), true);
      assert.deepEqual(texts(view), ["Could not load equipment weights. Tap to retry."]);
      assert.equal(backButton(view), undefined); assert.equal(saveButton(view), undefined);
      const retryButton = view.tree.root.findByType("TouchableOpacity");
      assert.notEqual(retryButton.props.disabled, true); assert.equal(styleOf(retryButton.findByType("Text")).color, "#6a4ff5");
      view.setRead(() => retry.promise); await tap(view, retryButton);
      assert.equal(view.calls.requests.length, 2); assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 1);
      assert.equal(backButton(view), undefined); await settle(view, retry, weights());
      assert.equal(rows(view).length, optionsFor(host).length); assert.deepEqual(selected(view), weights()[host.field]);
      assert.equal(inside(view.tree.root.findAllByType("Text").find((node) => textOf(node) === host.title), byID(view, "equipment-weight-scroll")), layout.large);
      await close(view);
    });

    test(`${host.slice} ${scheme} MAX: pending Save retains reachable wrapping label and only disables Save`, async () => {
      const pending = deferred(), view = await screen(host, scheme, { ...layouts[2], write: () => pending.promise });
      await tap(view, saveButton(view)); assert.equal(textOf(saveButton(view)), "Saving…");
      target(saveButton(view)); uncapped(saveButton(view).findByType("Text"));
      assert.deepEqual(plain(saveButton(view).props.accessibilityState), { disabled: true, busy: true });
      assert.equal(saveButton(view).props.disabled, true); assert.equal(styleOf(saveButton(view)).flexShrink, 1);
      assert.equal(inside(byID(view, "equipment-weight-title"), byID(view, "equipment-weight-scroll")), true);
      assert.notEqual(backButton(view).props.disabled, true); assert.notEqual(allButton(view).props.disabled, true);
      assert.ok(rows(view).every((node) => node.props.disabled !== true));
      await tap(view, allButton(view)); await tap(view, row(view, optionsFor(host)[0]));
      assert.deepEqual(view.calls.requests[1][1].body, weights());
      await tap(view, backButton(view)); assert.deepEqual(view.calls.routes, [["back"]]);
      await settle(view, pending, weights()); assert.deepEqual(view.calls.routes, [["back"], ["back"]]);
      assert.equal(saveButton(view).props.disabled, false); await close(view);
    });

    test(`${host.slice} ${scheme}: large title breakpoint is strict and does not cap scaling`, async () => {
      for (const fontScale of [1.3, 1.3001]) {
        const view = await screen(host, scheme, { dimensions: { width: 375, height: 667, scale: 2, fontScale } });
        const title = view.tree.root.findAllByType("Text").find((node) => textOf(node) === host.title);
        assert.equal(inside(title, byID(view, "equipment-weight-scroll")), fontScale > 1.3); uncapped(title); await close(view);
      }
    });
  }
}
