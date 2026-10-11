import assert from "node:assert/strict";
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
function load(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console }, { filename });
  return module.exports;
}
const native = { ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", View: "View", Text: "Text", ScrollView: "ScrollView", StyleSheet: { create: (styles) => styles }, Platform: { select: (values) => values.ios } };
const { Colors, Fonts } = load("constants/theme.ts", { "react-native": native });
const units = load("utils/weightUnits.ts", { "@react-native-async-storage/async-storage": { getItem: async () => "LB" } });
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node, pressed = false) => flat(typeof node.props.style === "function" ? node.props.style({ pressed }) : node.props.style);
const textOf = (node) => typeof node === "string" ? node : (node?.children?.map(textOf).join(" ") ?? "").replace(/\s+/g, " ").trim();
const host = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
const session = (extra = {}) => ({
  id: "session-A", status: "completed", workoutNote: "A saved workout note.",
  summary: { title: "Lower A", durationSeconds: 262, completedSetCount: 3, totalVolumeKg: 1651.0762268 },
  workoutSnapshot: { exerciseBlocks: [{ items: [{ exercise: { id: "bridge", name: "Glute Bridge" } }, { exercise: { id: "squat", name: "Squat" } }] }] },
  setLogs: [{ id: "second", exerciseId: "bridge", setNumber: 2, reps: 8, weightKg: 40 }, { id: "first", exerciseId: "bridge", setNumber: 1, reps: 10, weightKg: 20 }, { id: "bodyweight", exerciseId: "squat", setNumber: 1, reps: 6, weightKg: null }],
  ...extra,
});
function contrast(a, b) {
  const luminance = (hex) => (hex.length === 4 ? hex.slice(1).split("").map((value) => value.repeat(2)) : hex.slice(1).match(/../g)).map((value) => parseInt(value, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

async function summaryView(scheme, { response = session(), request, unit = "LB", fontScale = 1, width = 375, privacy = "unaccepted", share } = {}) {
  const colors = Colors[scheme];
  const AuthContext = React.createContext(null);
  const FocusContext = React.createContext(0);
  const RouteContext = React.createContext("session-A");
  const pushes = [], replacements = [], shares = [], alerts = [], requests = [], reconciles = [];
  let getHandler = request ?? (async () => response);
  let shareHandler = share ?? (async () => undefined);
  const mocks = { react: React, "react-native": { ...native, useWindowDimensions: () => ({ width, fontScale }), Alert: { alert: (...args) => alerts.push(args) }, Share: { share: (payload) => { shares.push(payload); return shareHandler(payload); } } }, "@expo/vector-icons": { Ionicons: "Ionicons" }, "@/constants/theme": { Colors, Fonts }, "@/hooks/use-theme-color": { useThemeColor: () => colors.text } };
  const { ThemedText } = load("components/themed-text.tsx", mocks);
  const { WorkoutText } = load("components/workout/WorkoutText.tsx", { ...mocks, "@/components/themed-text": { ThemedText } });
  const { default: Screen } = load("app/workout/summary.tsx", {
    ...mocks, "@/components/workout/WorkoutText": { WorkoutText }, "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "expo-router": { useRouter: () => ({ push: (target) => pushes.push(target), replace: (target) => replacements.push(target) }), useLocalSearchParams: () => ({ sessionId: React.useContext(RouteContext) }), useFocusEffect: (callback) => { const focus = React.useContext(FocusContext); React.useEffect(callback, [callback, focus]); } },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@/utils/authContext": { AuthContext }, "@/constants/legal": { PRIVACY_VERSION: "approved-policy" },
    "@/utils/weightUnits": { ...units, loadWeightUnit: async () => unit },
    "@/services/workoutLoggingService": { getSession: (token, id) => { requests.push({ token, id }); return getHandler(token, id); } },
    "@/services/health/exportSync": { reconcileAppleHealthExport: (token, id, current) => { reconciles.push({ token, id, current }); return Promise.resolve(); } },
  });
  const element = ({ account = "A", route = "session-A", focus = 0, accepted = privacy } = {}) => React.createElement(AuthContext.Provider, { value: { token: `token-${account}`, user: { id: account, privacy_accepted_version: accepted } } }, React.createElement(RouteContext.Provider, { value: route }, React.createElement(FocusContext.Provider, { value: focus }, React.createElement(Screen))));
  let tree;
  await act(async () => { tree = create(element()); });
  return { tree, element, pushes, replacements, shares, alerts, requests, reconciles, setRequest: (value) => { getHandler = value; }, setShare: (value) => { shareHandler = value; } };
}

for (const scheme of ["light", "dark"]) {
  const colors = Colors[scheme];
  test(`${scheme}: restrained status, neutral metrics and secondary actions retain primary Done`, async () => {
    const view = await summaryView(scheme);
    const header = host(view.tree, "summary-header");
    const success = header.findByType("Ionicons");
    assert.equal(success.props.name, "checkmark-circle-outline");
    assert.notEqual(success.props.color, colors.primaryButton);
    assert.ok(contrast(success.props.color, colors.background) >= 3);
    for (const id of ["duration", "sets", "volume", "note"]) {
      const card = host(view.tree, `summary-stat-${id}`);
      assert.equal(card.props.accessible, true);
      assert.equal(styleOf(card).flexBasis, "48%");
      assert.equal(card.findByType("Ionicons").props.color, colors.icon);
      for (const text of card.findAllByType("Text")) assert.ok(contrast(styleOf(text).color, colors.inputBackground) >= 4.5);
    }
    for (const id of ["summary-share", "summary-detail-session-A", "summary-done"]) {
      const action = host(view.tree, id);
      assert.ok(styleOf(action).minHeight >= 44);
      assert.equal(action.props.accessibilityRole, "button");
      assert.ok(action.props.accessibilityLabel);
      assert.equal(styleOf(action.findByType("Text")).textAlign, "center");
      if (id !== "summary-done") {
        assert.notEqual(styleOf(action).backgroundColor, colors.primaryButton);
        assert.equal(styleOf(action.findByType("Text")).color, colors.text);
        assert.ok(styleOf(action, true).opacity < 1);
      } else for (const pressed of [false, true]) assert.ok(contrast("#FFFFFF", styleOf(action, pressed).backgroundColor) >= 4.5);
    }
    await act(async () => host(view.tree, "summary-detail-session-A").props.onPress());
    assert.equal(view.pushes[0].pathname, "/workout/history/[sessionId]");
    assert.equal(view.pushes[0].params.sessionId, "session-A");
    await act(async () => host(view.tree, "summary-done").props.onPress());
    assert.equal(view.replacements[0], "/(tabs)");
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: canonical totals, note and sorted weighted/bodyweight logs remain exact in LB and KG`, async () => {
    for (const unit of ["LB", "KG"]) {
      const view = await summaryView(scheme, { unit });
      assert.match(textOf(host(view.tree, "summary-stat-duration")), /4m 22s/);
      assert.match(textOf(host(view.tree, "summary-stat-sets")), /Sets 3/);
      assert.match(textOf(host(view.tree, "summary-stat-volume")), unit === "LB" ? /3,640 lb/ : /1,651 kg/);
      const bridge = textOf(host(view.tree, "summary-exercise-bridge"));
      assert.match(bridge, unit === "LB" ? /Set 1\s*: 44\.1 lb × 10 Set 2\s*: 88\.2 lb × 8/ : /Set 1\s*: 20 kg × 10 Set 2\s*: 40 kg × 8/);
      assert.match(textOf(host(view.tree, "summary-exercise-squat")), /Bodyweight × 6/);
      assert.match(textOf(host(view.tree, "summary-note")), /A saved workout note/);
      for (const text of host(view.tree, "summary-exercise-bridge").findAllByType("Text")) assert.equal(styleOf(text).color, colors.text);
      assert.equal(view.requests.length, 1);
      assert.equal(view.reconciles.length, 0);
      await act(async () => view.tree.unmount());
    }
  });

  test(`${scheme}: share payload excludes notes and keeps native failure retry unchanged`, async () => {
    const view = await summaryView(scheme, { unit: "KG", share: async () => { throw new Error("cancelled"); } });
    await act(async () => host(view.tree, "summary-share").props.onPress());
    assert.equal(view.shares[0].title, "Lower A");
    assert.equal(view.shares[0].message, "Lower A\n4m 22s · 3 sets · 1,651 kg total volume\nGlute Bridge, Squat\n\nCompleted with PrimeRep.");
    assert.ok(!view.shares[0].message.includes("saved workout note"));
    assert.equal(view.alerts[0][0], "Couldn't Share Workout");
    assert.equal(view.alerts[0][2][0].style, "cancel");
    view.setShare(async () => undefined);
    await act(async () => view.alerts[0][2][1].onPress());
    assert.equal(view.shares.length, 2);
    assert.equal(view.shares[1].message, view.shares[0].message);
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: large fonts, narrow screens and long metrics use natural single-column wrapping`, async () => {
    const long = session({ summary: { title: "A long saved workout title that should wrap without truncation", durationSeconds: 720001, completedSetCount: 12345678, totalVolumeKg: 987654321098765 }, workoutNote: "A long note remains visible and wraps using native typography." });
    for (const size of [{ fontScale: 3 }, { width: 320 }, { response: long }]) {
      const view = await summaryView(scheme, size);
      assert.equal(styleOf(host(view.tree, "summary-stat-volume")).flexBasis, "100%");
      assert.equal(host(view.tree, "summary-scroll").props.contentContainerStyle.flexGrow, 1);
      for (const text of view.tree.root.findAllByType("Text")) {
        assert.equal(text.props.numberOfLines, undefined);
        assert.equal(text.props.maxFontSizeMultiplier, undefined);
        assert.equal(styleOf(text).lineHeight, undefined);
      }
      assert.equal(styleOf(host(view.tree, "summary-share").findByType("Text")).flexShrink, 1);
      await act(async () => view.tree.unmount());
    }
  });

  test(`${scheme}: zero-set, loading and unavailable states preserve truthful data and Home action`, async () => {
    const zero = await summaryView(scheme, { response: session({ setLogs: [], workoutNote: null, summary: { title: "Empty workout", durationSeconds: 0, completedSetCount: 0, totalVolumeKg: 0 } }) });
    assert.match(textOf(host(zero.tree, "summary-empty-sets")), /No sets were logged/);
    assert.match(textOf(host(zero.tree, "summary-stat-duration")), /0s/);
    assert.match(textOf(host(zero.tree, "summary-stat-volume")), /0 lb/);
    assert.equal(host(zero.tree, "summary-note"), undefined);
    assert.match(textOf(host(zero.tree, "summary-stat-note")), /—/);
    await act(async () => zero.tree.unmount());
    const pending = deferred();
    const unavailable = await summaryView(scheme, { request: () => pending.promise });
    assert.ok(host(unavailable.tree, "summary-loading"));
    assert.equal(unavailable.tree.root.findByType("ActivityIndicator").props.color, colors.icon);
    await act(async () => pending.reject(new Error("offline")));
    assert.ok(host(unavailable.tree, "summary-unavailable"));
    const home = host(unavailable.tree, "summary-unavailable-home");
    assert.ok(styleOf(home).minHeight >= 44);
    assert.equal(styleOf(home.findByType("Text")).color, colors.text);
    await act(async () => home.props.onPress());
    assert.equal(unavailable.replacements[0], "/(tabs)");
    await act(async () => unavailable.tree.unmount());
    const active = await summaryView(scheme, { response: session({ status: "in_progress" }) });
    assert.ok(host(active.tree, "summary-unavailable"));
    assert.equal(host(active.tree, "summary-metrics"), undefined);
    await act(async () => active.tree.unmount());
  });

  test(`${scheme}: correction return refreshes canonical totals; failed refresh keeps saved summary honest`, async () => {
    const view = await summaryView(scheme);
    const pending = deferred();
    view.setRequest(() => pending.promise);
    await act(async () => view.tree.update(view.element({ focus: 1 })));
    assert.match(textOf(view.tree.root), /Refreshing workout/);
    assert.match(textOf(host(view.tree, "summary-stat-sets")), /Sets 3/);
    await act(async () => pending.resolve(session({ summary: { title: "Lower A", durationSeconds: 262, completedSetCount: 4, totalVolumeKg: 1700 } })));
    assert.match(textOf(host(view.tree, "summary-stat-sets")), /Sets 4/);
    view.setRequest(async () => { throw new Error("offline"); });
    await act(async () => view.tree.update(view.element({ focus: 2 })));
    const error = host(view.tree, "summary-refresh-error");
    assert.match(textOf(error), /Couldn’t refresh totals/);
    assert.ok(styleOf(error).minHeight >= 44);
    assert.ok(contrast(styleOf(error.findByType("Text")).color, colors.background) >= 4.5);
    assert.match(textOf(host(view.tree, "summary-stat-sets")), /Sets 4/);
    await act(async () => error.props.onPress());
    assert.equal(view.pushes.at(-1).params.sessionId, "session-A");
    await act(async () => view.tree.unmount());
  });
}

test("delayed account, route and blurred focus responses cannot replace the current owned summary", async () => {
  const pending = [];
  const view = await summaryView("light", { request: (token, id) => { const request = deferred(); pending.push({ token, id, ...request }); return request.promise; } });
  await act(async () => view.tree.update(view.element({ account: "B", route: "session-B" })));
  await act(async () => pending[0].resolve(session({ summary: { title: "Old account", durationSeconds: 1, completedSetCount: 1, totalVolumeKg: 1 } })));
  assert.ok(!textOf(view.tree.root).includes("Old account"));
  await act(async () => pending[1].resolve(session({ id: "session-B", summary: { title: "Current account", durationSeconds: 1, completedSetCount: 1, totalVolumeKg: 1 } })));
  assert.match(textOf(view.tree.root), /Current account/);
  await act(async () => view.tree.update(view.element({ account: "B", route: "session-C" })));
  assert.equal(host(view.tree, "summary-detail-session-B"), undefined);
  await act(async () => view.tree.update(view.element({ account: "B", route: "session-C", focus: 1 })));
  await act(async () => pending[2].resolve(session({ id: "session-C", summary: { title: "Stale focus", durationSeconds: 1, completedSetCount: 1, totalVolumeKg: 1 } })));
  assert.ok(!textOf(view.tree.root).includes("Stale focus"));
  await act(async () => pending[3].resolve(session({ id: "session-C" })));
  assert.ok(host(view.tree, "summary-detail-session-C"));
  await act(async () => view.tree.unmount());
});

test("Health reconciliation retains completed-status, policy and cancellation gates", async () => {
  const view = await summaryView("light", { privacy: "approved-policy" });
  assert.equal(view.reconciles.length, 1);
  assert.equal(view.reconciles[0].token, "token-A");
  assert.equal(view.reconciles[0].id, "A");
  assert.equal(view.reconciles[0].current(), true);
  await act(async () => view.tree.unmount());
  assert.equal(view.reconciles[0].current(), false);
  const active = await summaryView("light", { privacy: "approved-policy", response: session({ status: "abandoned" }) });
  assert.equal(active.reconciles.length, 0);
  await act(async () => active.tree.unmount());
});
