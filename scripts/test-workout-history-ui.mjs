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
import ts from "typescript";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const route = "app/workout/history.tsx";
const originalControllerSHA256 = "379e5152133fc7305a6482d967bccd8f65b30d80338eec4bb2295d60e5b961ad";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
function load(file, mocks) {
  const filename = path.join(root, file);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console }, { filename });
  return module.exports;
}
const native = {
  ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", View: "View",
  StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (values) => values.ios },
};
const theme = load("constants/theme.ts", { "react-native": native });
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const visibleText = (tree) => tree.root.findAllByType("Text").map(textOf);
const cards = (tree) => tree.root.findAllByType("Pressable").filter((node) => node.props.testID?.startsWith("history-session-"));
const card = (tree, id) => cards(tree).find((node) => node.props.testID === `history-session-${id}`);
const back = (tree) => tree.root.findByProps({ accessibilityLabel: "Back from Workout History" });
const retry = (tree) => tree.root.findAllByType("Pressable").find((node) => textOf(node) === "Retry");
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const session = (extra = {}) => ({ id: "fixture-session-A", workoutDayId: "fixture-day-A", workoutDate: "2026-10-04", dayType: "upper", completedAt: "2026-10-04T18:00:00Z", setCount: 1, title: "Upper A", totalVolumeKg: 1234.6, ...extra });
const result = (items, total = items.length) => ({ items, total });
const close = async (view) => { await act(async () => view.tree.unmount()); };

async function history(scheme, config = {}) {
  const AuthContext = React.createContext(null);
  const FocusContext = React.createContext(0);
  const requests = [], pushes = [], backs = [];
  let request = config.request ?? (async () => result(config.items ?? []));
  let account = { token: Object.hasOwn(config, "token") ? config.token : "fixture-token-A", user: { id: "fixture-account-A", weight_unit: "LB" } };
  let focus = 0;
  let dimensions = { width: config.width ?? 390, height: 844, fontScale: config.fontScale ?? 1, scale: 3 };
  const mocks = {
    react: React, "react-native": { ...native, useWindowDimensions: () => dimensions }, "@expo/vector-icons": { Ionicons: "Ionicons" },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@/constants/theme": theme, "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@/utils/authContext": { AuthContext },
    "@/services/workoutLoggingService": { listCompletedSessions: (...args) => { requests.push(args); return request(...args); } },
    "expo-router": {
      useRouter: () => ({ push: (target) => pushes.push(target), back: () => backs.push(true) }),
      useFocusEffect: (callback) => { const revision = React.useContext(FocusContext); React.useEffect(callback, [callback, revision]); },
    },
  };
  mocks["@/hooks/use-theme-color"] = load("hooks/use-theme-color.ts", mocks);
  mocks["@/components/themed-text"] = load("components/themed-text.tsx", mocks);
  const { default: Screen } = load(route, mocks);
  const element = () => React.createElement(AuthContext.Provider, { value: account }, React.createElement(FocusContext.Provider, { value: focus }, React.createElement(Screen)));
  let tree;
  await act(async () => { tree = create(element()); });
  return {
    tree, requests, pushes, backs,
    setRequest: (value) => { request = value; },
    refocus: async () => { focus += 1; await act(async () => tree.update(element())); },
    resize: async (fontScale, width = dimensions.width) => { dimensions = { ...dimensions, fontScale, width }; await act(async () => tree.update(element())); },
    setAccount: async (token, id = "fixture-account-B") => { account = { token, user: { id, weight_unit: "LB" } }; await act(async () => tree.update(element())); },
  };
}

test("scope: actual History load, focus and auth controller remains byte-exact", () => {
  const input = source(route);
  const controller = input.slice(input.indexOf("export default function WorkoutHistoryScreen()"), input.indexOf("\n  const { fontScale }"));
  assert.equal(Buffer.byteLength(controller), 661);
  assert.equal(createHash("sha256").update(controller).digest("hex"), originalControllerSHA256);
  const originalImports = input.slice(0, input.indexOf("export default function")).replace("ScrollView, useWindowDimensions, View", "ScrollView, View");
  assert.equal(createHash("sha256").update(originalImports).digest("hex"), "0a0033cd1cf68730aaffb2d0abd0951146fb150db931d7cc24450ebabe90b3d2");
});
for (const scheme of ["light", "dark"]) {
  const colors = theme.Colors[scheme];
  for (const state of ["loading", "empty", "error", "loaded"]) {
    test(`${scheme}: MAX ${state} places the uncapped heading and state in one body scroll with fixed Back`, async () => {
      const config = { fontScale: 3.12, width: 320 };
      if (state === "loading") config.token = null;
      if (state === "error") config.request = async () => { throw new Error("fictional fixture read rejected"); };
      if (state === "loaded") config.items = [session()];
      const view = await history(scheme, config);
      const header = view.tree.root.findByProps({ testID: "history-header" });
      const scroll = view.tree.root.findByType("ScrollView");
      assert.equal(view.tree.root.findAllByType("ScrollView").length, 1);
      assert.equal(header.findAllByType("Text").length, 0);
      assert.equal(header.findByProps({ accessibilityLabel: "Back from Workout History" }), back(view.tree));
      assert.equal(scroll.findAllByType("Pressable").includes(back(view.tree)), false);
      assert.equal(scroll.findAllByType("Text").filter((node) => textOf(node) === "Workout History").length, 1);
      assert.equal(flat(back(view.tree).props.style).minWidth, 44);
      assert.equal(flat(back(view.tree).props.style).minHeight, 44);
      assert.equal(flat(back(view.tree).props.style).flexShrink, 0);
      assert.equal(flat(scroll.props.contentContainerStyle).flexGrow, 1);
      assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
      for (const node of scroll.findAllByType("Text")) {
        for (const prop of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(node.props[prop], undefined);
        assert.notEqual(node.props.allowFontScaling, false);
      }
      if (state === "loading" || state === "empty" || state === "error") {
        const stateView = scroll.findAllByType("View").find((node) => flat(node.props.style).justifyContent === "center");
        assert.equal(flat(stateView.props.style).alignItems, "center");
        assert.equal(flat(stateView.props.style).flex, 1);
      }
      await act(async () => back(view.tree).props.onPress());
      assert.deepEqual(view.backs, [true]);
      assert.deepEqual(view.pushes, []);
      assert.equal(view.requests.length, state === "loading" ? 0 : 1);
      await close(view);
    });
  }
  test(`${scheme}: mounted normal → MAX → normal keeps one exact title and does not refetch`, async () => {
    const view = await history(scheme, { items: [session()], fontScale: 1.3 });
    const header = () => view.tree.root.findByProps({ testID: "history-header" });
    assert.equal(header().findAllByType("Text").length, 1);
    assert.equal(flat(header().findByType("Text").props.style).minWidth, 0);
    await view.resize(3.12, 320);
    assert.equal(header().findAllByType("Text").length, 0);
    assert.equal(view.tree.root.findByType("ScrollView").findAllByType("Text").filter((node) => textOf(node) === "Workout History").length, 1);
    await view.resize(1, 390);
    assert.equal(header().findAllByType("Text").length, 1);
    assert.equal(view.tree.root.findByType("ScrollView").findAllByType("Text").filter((node) => textOf(node) === "Workout History").length, 0);
    assert.equal(view.requests.length, 1);
    await close(view);
  });
  test(`${scheme}: responsive title/date/count/volume hierarchy keeps the exact full row name and route`, async () => {
    const item = session({ title: "A deliberately long workout title that remains fully present", setCount: 1234, totalVolumeKg: 9876543.7 });
    for (const fontScale of [1, 3.12]) {
      const view = await history(scheme, { items: [item], fontScale, width: 320 });
      const row = card(view.tree, item.id);
      const content = row.findAllByType("View")[0];
      const metadata = row.findAllByType("View")[1];
      assert.equal(flat(content.props.style).flex, fontScale > 1.3 ? undefined : 1);
      assert.equal(flat(content.props.style).minWidth, 0);
      assert.deepEqual(metadata.findAllByType("Text").map(textOf), fontScale > 1.3 ? ["2026-10-04", "· 1234 sets", "9,876,544 kg"] : ["2026-10-04 · 1234 sets", "9,876,544 kg"]);
      assert.equal(flat(metadata.props.style).flexWrap, "wrap");
      assert.equal(flat(metadata.props.style).flexDirection, "row");
      assert.equal(content.findAllByType("Text")[0].parent.parent, content);
      assert.equal(row.children.length, 2);
      assert.equal(row.findByType("Ionicons").props.name, "chevron-forward");
      assert.equal(flat(row.props.style).flexDirection, fontScale > 1.3 ? "column" : "row");
      assert.equal(flat(row.props.style).alignItems, fontScale > 1.3 ? "stretch" : "center");
      assert.equal(flat(row.findByType("Ionicons").props.style).alignSelf, fontScale > 1.3 ? "flex-end" : undefined);
      assert.equal(flat(row.findByType("Ionicons").props.style).marginLeft, fontScale > 1.3 ? 0 : 8);
      assert.equal(row.props.accessibilityRole, "button");
      assert.equal(row.props.accessibilityLabel, `${item.title}. 2026-10-04 · 1234 sets. 9,876,544 kg.`);
      assert.equal(flat(row.props.style).minHeight, 44);
      await act(async () => row.props.onPress());
      assert.deepEqual(plain(view.pushes), [{ pathname: "/workout/history/[sessionId]", params: { sessionId: item.id } }]);
      await close(view);
    }
  });
  test(`${scheme}: MAX Retry has a neutral icon/text border, full name and 44-point target`, async () => {
    const view = await history(scheme, { fontScale: 3.12, width: 320, request: async () => { throw new Error("fictional fixture read rejected"); } });
    const action = retry(view.tree), style = flat(action.props.style);
    assert.equal(action.props.accessibilityRole, "button");
    assert.equal(action.props.accessibilityLabel, "Retry workout history");
    assert.equal(style.minWidth, 44);
    assert.equal(style.minHeight, 44);
    assert.equal(style.borderColor, colors.inputBorder);
    assert.equal(style.backgroundColor, colors.inputBackground);
    assert.equal(action.findByType("Ionicons").props.name, "refresh");
    assert.equal(action.findByType("Ionicons").props.color, colors.icon);
    assert.equal(flat(action.findByType("Text").props.style).color, colors.text);
    await act(async () => action.props.onPress());
    assert.equal(view.requests.length, 2);
    assert.deepEqual(view.pushes, []);
    await close(view);
  });
  test(`${scheme}: normal and MAX use the same scalable 24-point heading; MAX card reserves no chevron width`, async () => {
    const view = await history(scheme, { items: [session({ title: "Foundation Workout", workoutDate: "2026-10-12" })], width: 375 });
    const heading = () => view.tree.root.findAllByType("Text").find((node) => textOf(node) === "Workout History");
    const scrollStyle = () => flat(view.tree.root.findByType("ScrollView").props.contentContainerStyle);
    assert.equal(flat(heading().props.style).fontSize, 24);
    assert.equal(scrollStyle().paddingHorizontal, 20);
    assert.equal(scrollStyle().paddingVertical, 20);
    assert.equal(flat(cards(view.tree)[0].props.style).flexDirection, "row");
    await view.resize(3.12);
    assert.equal(flat(heading().props.style).fontSize, 24);
    assert.equal(scrollStyle().paddingHorizontal, 8);
    const row = cards(view.tree)[0];
    const [title, date, count, volume] = row.findAllByType("Text");
    assert.deepEqual([title, date, count, volume].map(textOf), ["Foundation Workout", "2026-10-12", "· 1 sets", "1,235 kg"]);
    for (const node of [date, count, volume]) assert.equal(flat(node.props.style).fontSize, 16);
    assert.equal(375 - 2 * scrollStyle().paddingHorizontal - 2 * flat(row.props.style).padding, 327);
    assert.equal(flat(row.props.style).flexDirection, "column");
    assert.equal(flat(row.findAllByType("View")[0].props.style).flex, undefined);
    assert.equal(flat(row.findByType("Ionicons").props.style).alignSelf, "flex-end");
    assert.equal(row.props.accessibilityLabel, "Foundation Workout. 2026-10-12 · 1 sets. 1,235 kg.");
    await view.resize(1);
    assert.deepEqual(cards(view.tree)[0].findAllByType("Text").map(textOf), ["Foundation Workout", "2026-10-12 · 1 sets", "1,235 kg"]);
    assert.equal(view.requests.length, 1);
    await close(view);
  });
  test(`${scheme}: loading performs exactly one mocked read and retains the named Back action`, async () => {
    const pending = deferred();
    const view = await history(scheme, { request: () => pending.promise });
    assert.deepEqual(view.requests, [["fixture-token-A"]]);
    assert.equal(view.tree.root.findByType("ActivityIndicator").props.color, colors.primaryButton);
    assert.deepEqual(visibleText(view.tree), ["Workout History"]);
    assert.equal(back(view.tree).props.accessibilityRole, "button");
    assert.equal(back(view.tree).props.hitSlop, 10);
    await act(async () => back(view.tree).props.onPress());
    assert.deepEqual(view.backs, [true]);
    assert.deepEqual(view.pushes, []);
    assert.deepEqual(view.requests, [["fixture-token-A"]]);
    await act(async () => pending.resolve(result([])));
    await close(view);
  });
  test(`${scheme}: empty response preserves current copy, theme and top/bottom safe area`, async () => {
    const view = await history(scheme);
    assert.deepEqual(visibleText(view.tree), ["Workout History", "No completed workouts yet", "Your completed workouts will appear here."]);
    assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 0);
    assert.equal(view.tree.root.findAllByType("ScrollView").length, 1);
    const safe = view.tree.root.findByType("SafeAreaView");
    assert.equal(flat(safe.props.style).backgroundColor, colors.background);
    assert.deepEqual(plain(safe.props.edges), ["top", "bottom"]);
    assert.equal(flat(view.tree.root.findAllByType("Text")[0].props.style).color, colors.text);
    assert.equal(view.requests.length, 1);
    await close(view);
  });
  test(`${scheme}: rejection exposes current Retry; retry loads then renders returned sessions`, async () => {
    const failed = deferred(), retried = deferred();
    const view = await history(scheme, { request: () => failed.promise });
    await act(async () => failed.reject(new Error("fictional fixture read rejected")));
    assert.deepEqual(visibleText(view.tree), ["Workout History", "Couldn’t load your history.", "Retry"]);
    assert.equal(flat(retry(view.tree).findByType("Text").props.style).color, colors.text);
    assert.equal(retry(view.tree).props.accessibilityRole, "button");
    view.setRequest(() => retried.promise);
    await act(async () => retry(view.tree).props.onPress());
    assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 1);
    assert.equal(retry(view.tree), undefined);
    assert.deepEqual(view.requests, [["fixture-token-A"], ["fixture-token-A"]]);
    await act(async () => retried.resolve(result([session()])));
    assert.equal(cards(view.tree).length, 1);
    assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 0);
    assert.deepEqual(view.pushes, []);
    await close(view);
  });
  test(`${scheme}: a repeated rejection retains the same error and Retry controller`, async () => {
    const view = await history(scheme, { request: async () => { throw new Error("fictional fixture read rejected"); } });
    await act(async () => retry(view.tree).props.onPress());
    assert.equal(view.requests.length, 2);
    assert.deepEqual(visibleText(view.tree), ["Workout History", "Couldn’t load your history.", "Retry"]);
    assert.deepEqual(view.backs, []);
    assert.deepEqual(view.pushes, []);
    await close(view);
  });
  test(`${scheme}: title, raw date, set count and rounded kilograms retain response order and exact session routes`, async () => {
    const items = [session(), session({ id: "fixture-session-B", title: "Lower B", workoutDate: "2026-10-01", setCount: 0, totalVolumeKg: 0.4 }), session({ id: "fixture-session-C", title: "Upper C", workoutDate: "2026-10-02", setCount: 12, totalVolumeKg: 999.5 })];
    const view = await history(scheme, { request: async () => result(items, 99) });
    assert.deepEqual(cards(view.tree).map((node) => node.props.testID), items.map((item) => `history-session-${item.id}`));
    assert.deepEqual(visibleText(view.tree), ["Workout History", "Upper A", "2026-10-04 · 1 sets", "1,235 kg", "Lower B", "2026-10-01 · 0 sets", "0 kg", "Upper C", "2026-10-02 · 12 sets", "1,000 kg"]);
    for (const item of items) {
      const row = card(view.tree, item.id);
      assert.equal(flat(row.props.style).backgroundColor, colors.inputBackground);
      assert.equal(flat(row.props.style).borderColor, colors.inputBorder);
      await act(async () => row.props.onPress());
    }
    await act(async () => card(view.tree, items[0].id).props.onPress());
    assert.deepEqual(plain(view.pushes), [...items, items[0]].map((item) => ({ pathname: "/workout/history/[sessionId]", params: { sessionId: item.id } })));
    assert.deepEqual(view.requests, [["fixture-token-A"]]);
    assert.equal(view.tree.root.findAllByType("Pressable").length, 4);
    assert.deepEqual(view.backs, []);
    await close(view);
  });
  test(`${scheme}: focus reload calls the same current token and replaces results after loading`, async () => {
    const view = await history(scheme, { items: [session()] });
    const refreshed = deferred();
    view.setRequest(() => refreshed.promise);
    await view.refocus();
    assert.deepEqual(view.requests, [["fixture-token-A"], ["fixture-token-A"]]);
    assert.equal(cards(view.tree).length, 0);
    assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 1);
    await act(async () => refreshed.resolve(result([session({ id: "fixture-refreshed", title: "Refreshed history" })])));
    assert.equal(card(view.tree, "fixture-refreshed") !== undefined, true);
    assert.equal(card(view.tree, "fixture-session-A"), undefined);
    await close(view);
  });
  test(`${scheme}: inherited no-token state remains loading without a service call until a token appears`, async () => {
    const view = await history(scheme, { token: null });
    assert.deepEqual(view.requests, []);
    assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 1);
    assert.deepEqual(visibleText(view.tree), ["Workout History"]);
    await view.refocus();
    assert.deepEqual(view.requests, []);
    await view.setAccount("fixture-token-B");
    assert.deepEqual(view.requests, [["fixture-token-B"]]);
    assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 0);
    await close(view);
  });
  test(`${scheme}: inherited token removal leaves already loaded rows instead of fencing account data`, async () => {
    const view = await history(scheme, { items: [session()] });
    await view.setAccount(null);
    assert.equal(cards(view.tree).length, 1);
    assert.equal(card(view.tree, "fixture-session-A") !== undefined, true);
    assert.deepEqual(view.requests, [["fixture-token-A"]]);
    await close(view);
  });
  test(`${scheme}: inherited late old-account response can replace the newer account result`, async () => {
    const first = deferred(), second = deferred();
    const view = await history(scheme, { request: () => first.promise });
    view.setRequest(() => second.promise);
    await view.setAccount("fixture-token-B");
    assert.deepEqual(view.requests, [["fixture-token-A"], ["fixture-token-B"]]);
    await act(async () => second.resolve(result([session({ id: "fixture-new-account", title: "New account result" })])));
    assert.equal(card(view.tree, "fixture-new-account") !== undefined, true);
    await act(async () => first.resolve(result([session({ id: "fixture-old-account", title: "Late old account result" })])));
    assert.equal(card(view.tree, "fixture-old-account") !== undefined, true);
    assert.equal(card(view.tree, "fixture-new-account"), undefined);
    await close(view);
  });
  test(`${scheme}: real ThemedText retains uncapped duplicate long titles and inherited row typography`, async () => {
    const title = "A long saved workout title with repeated words and extra detail that must remain present without a truncation prop";
    const view = await history(scheme, { items: [session({ title }), session({ id: "fixture-other-long-title", title })] });
    assert.equal(visibleText(view.tree).filter((value) => value === title).length, 2);
    for (const node of view.tree.root.findAllByType("Text")) {
      assert.notEqual(node.props.allowFontScaling, false);
      for (const prop of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(node.props[prop], undefined);
    }
    const header = view.tree.root.findAllByType("Text")[0];
    assert.equal(flat(header.props.style).fontSize, 24);
    assert.equal(flat(header.props.style).lineHeight, 32);
    for (const row of cards(view.tree)) {
      const [name, metadata, volume] = row.findAllByType("Text");
      assert.equal(flat(name.props.style).fontSize, 17);
      assert.equal(flat(name.props.style).fontWeight, "600");
      assert.equal(flat(name.props.style).color, colors.text);
      assert.equal(flat(metadata.props.style).color, colors.placeholder);
      assert.equal(flat(volume.props.style).color, colors.placeholder);
      assert.equal(row.props.accessibilityRole, "button");
    }
    assert.equal(view.tree.root.findByType("ScrollView").props.contentInsetAdjustmentBehavior, "automatic");
    await close(view);
  });
}
