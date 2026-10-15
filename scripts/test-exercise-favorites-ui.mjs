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
const route = "app/explore/favorites.tsx";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const plain = (value) => JSON.parse(JSON.stringify(value));
function load(file, mocks) {
  const filename = path.join(root, file), module = { exports: {} }, fallback = createRequire(filename);
  const output = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console: { ...console, warn: () => {} } }, { filename });
  return module.exports;
}
const native = {
  ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", RefreshControl: "RefreshControl", ScrollView: "ScrollView", Text: "Text", View: "View",
  FlatList: (props) => React.createElement("FlatList", props, props.ListHeaderComponent, props.data.length ? props.data.map((item, index) => React.createElement(React.Fragment, { key: props.keyExtractor(item) }, props.renderItem({ item, index }))) : props.ListEmptyComponent, props.refreshControl),
  StyleSheet: { create: (styles) => styles }, Platform: { OS: "ios", select: (values) => values.ios },
};
const theme = load("constants/theme.ts", { "react-native": native });
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const texts = (view) => view.tree.root.findAllByType("Text").map(textOf);
const rows = (view) => view.tree.root.findAllByType("Pressable").filter((node) => node.props.testID === "exercise-row");
const favorite = (view, id = "fixture-exercise-1") => view.tree.root.findByProps({ testID: `exercise-favorite-${id}` });
const retry = (view) => view.tree.root.findAllByType("Pressable").find((node) => textOf(node) === "Retry");
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const exercise = (id = "fixture-exercise-1", extra = {}) => ({ id, name: "Fictional Bench Press", primaryMuscle: "chest", isFavorited: true, exerciseType: "strength", ...extra });
const tap = async (node) => { assert.ok(node); assert.notEqual(node.props.disabled, true); await act(async () => node.props.onPress()); };
const close = async (view) => { await act(async () => view.tree.unmount()); };

async function favorites(scheme, options = {}) {
  const AuthContext = React.createContext(null), FocusContext = React.createContext({ revision: 0, active: true });
  let account = { token: "fixture-token-A", user: { id: "fixture-account-A" }, isLoggedIn: true, ...options.account };
  let focus = { revision: 0, active: true };
  let dimensions = { width: options.width ?? 430, height: 932, fontScale: options.fontScale ?? 1, scale: 3 };
  let request = options.request ?? (async () => options.items ?? []);
  let mutation = options.mutation ?? (async () => undefined);
  const calls = { loads: [], mutations: [], routes: [], backs: [], stateWrites: [] };
  const observedReact = options.observeState ? { ...React, useState: (initial) => {
    const [value, setter] = React.useState(initial);
    const observedSetter = React.useCallback((next) => { calls.stateWrites.push(next); setter(next); }, [setter]);
    return [value, observedSetter];
  } } : React;
  const mocks = {
    react: observedReact, "react-native": { ...native, useWindowDimensions: () => dimensions }, "@expo/vector-icons": { Ionicons: "Ionicons" }, "expo-image": { Image: "Image" },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@/constants/theme": theme,
    "@/hooks/use-color-scheme": { useColorScheme: () => scheme }, "@/utils/authContext": { AuthContext },
    "@/services/exerciseService": {
      getFavoriteExerciseItems: (token) => { calls.loads.push(token); return request(token); },
      favoriteExercise: (id, token) => { calls.mutations.push(["add", id, token]); return mutation("add", id, token); },
      unfavoriteExercise: (id, token) => { calls.mutations.push(["remove", id, token]); return mutation("remove", id, token); },
    },
    "expo-router": { useRouter: () => ({ push: (target) => calls.routes.push(plain(target)), back: () => calls.backs.push(true) }) },
    "@react-navigation/native": { useFocusEffect: (callback) => { const value = React.useContext(FocusContext); React.useEffect(() => value.active ? callback() : undefined, [callback, value.revision, value.active]); } },
  };
  mocks["@/hooks/use-theme-color"] = load("hooks/use-theme-color.ts", mocks);
  mocks["@/components/themed-text"] = load("components/themed-text.tsx", mocks);
  mocks["@/components/explore"] = load("components/explore/ExerciseRow.tsx", mocks);
  const { default: Screen } = load(route, mocks);
  const Row = mocks["@/components/explore"].ExerciseRow;
  const element = () => React.createElement(AuthContext.Provider, { value: account }, React.createElement(FocusContext.Provider, { value: focus }, React.createElement(Screen)));
  let tree;
  await act(async () => { tree = create(element()); });
  return {
    tree, Row, calls, setRequest: (value) => { request = value; }, setMutation: (value) => { mutation = value; },
    refocus: async () => { focus = { revision: focus.revision + 1, active: true }; await act(async () => tree.update(element())); },
    blur: async () => { focus = { ...focus, active: false }; await act(async () => tree.update(element())); },
    account: async (token, id = "fixture-account-B") => { account = { token, user: token ? { id } : null, isLoggedIn: Boolean(token) }; await act(async () => tree.update(element())); },
    resize: async (fontScale, width = dimensions.width) => { dimensions = { ...dimensions, fontScale, width }; await act(async () => tree.update(element())); },
  };
}

test("scope: original Favorites6278-byte controller/restored imports and shared presentation stay byte-exact", () => {
  const input = source(route);
  const imports = input.slice(0, input.indexOf("export default function")).replace("  ScrollView,\n", "").replace("  useWindowDimensions,\n", "");
  assert.equal(hash(imports), "23a86b89220c8e607e53a9255003ff3d31adc8c991579bb971a5a414d0596fd2");
  const controller = input.slice(input.indexOf("export default function"), input.indexOf("\n  const { fontScale }"));
  assert.equal(Buffer.byteLength(controller), 6278);
  assert.equal(hash(controller), "925efc658c8867937767284e15bf6e0c72e8c4e2c206d4c5751015b6147a36d5");
  for (const [file, expected] of Object.entries({ "components/explore/ExerciseRow.tsx": "0bc14d29cd072e478af532de907737ba58beb31df2e8ae46029f87768a10df90", "components/themed-text.tsx": "06d02c5a33dd258563726e8586a4b588e2df7c087ac291be6a225f89bf1ac974", "constants/theme.ts": "0e4066b19531c70b14aeb5656a6f0de16b37f56ad410b87c2f923168cebfcad1" })) assert.equal(hash(source(file)), expected);
});

for (const scheme of ["light", "dark"]) {
  const colors = theme.Colors[scheme];
  for (const state of ["guest", "loading", "error", "empty", "loaded"]) {
    test(`${scheme}: MAX ${state} has one growing body, full-width uncapped heading and fixed Back`, async () => {
      const options = { fontScale: 3.12, width: 375 };
      if (state === "guest") options.account = { token: null, user: null, isLoggedIn: false };
      if (state === "loading") options.request = () => new Promise(() => {});
      if (state === "error") options.request = async () => { throw new Error("fictional read rejected"); };
      if (state === "loaded") options.items = [exercise()];
      const view = await favorites(scheme, options);
      const header = view.tree.root.findByProps({ testID: "favorites-header" });
      assert.equal(header.findAllByType("Text").length, 0);
      assert.equal(header.children.length, 1);
      const back = header.findByProps({ accessibilityLabel: "Back from favorites" });
      assert.equal(flat(back.props.style).width, 44);
      assert.equal(flat(back.props.style).height, 44);
      assert.equal(flat(back.props.style).flexShrink, 0);
      const listState = state === "empty" || state === "loaded";
      const body = view.tree.root.findByType(listState ? "FlatList" : "ScrollView");
      assert.equal(view.tree.root.findAllByType(listState ? "ScrollView" : "FlatList").length, 0);
      assert.equal(body.findAllByProps({ accessibilityLabel: "Back from favorites" }).length, 0);
      assert.equal(body.props.contentInsetAdjustmentBehavior, "automatic");
      assert.equal(flat(body.props.contentContainerStyle).paddingHorizontal, 8);
      const heading = body.findAllByType("Text").find((node) => textOf(node) === "Favorites");
      assert.ok(heading);
      assert.equal(flat(heading.props.style).fontSize, 24);
      assert.notEqual(heading.props.allowFontScaling, false);
      for (const prop of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(heading.props[prop], undefined);
      const titleContainer = body.findAllByType("View").find((node) => flat(node.props.style).flexDirection === "column");
      assert.equal(flat(titleContainer.props.style).alignItems, "stretch");
      assert.equal(flat(titleContainer.props.style).flex, 0);
      if (!listState) assert.equal(flat(body.props.contentContainerStyle).flexGrow, 1);
      if (state === "guest" || state === "empty") {
        const expected = state === "guest" ? "Sign in to save favorites" : "No favorites yet";
        const copy = body.findAllByType("Text").find((node) => textOf(node) === expected);
        assert.ok(copy);
        assert.equal(flat(copy.props.style).fontSize, 20);
        assert.equal(flat(copy.props.style).textAlign, "center");
        const container = body.findAllByType("View").find((node) => flat(node.props.style).paddingHorizontal === 0 && node.findAllByType("Text").some((text) => textOf(text) === expected));
        assert.ok(container);
      }
      assert.deepEqual(plain(view.tree.root.findByType("SafeAreaView").props.edges), ["top", "bottom"]);
      assert.deepEqual(view.calls.mutations, []);
      await close(view);
    });
  }
  test(`${scheme}: mounted normal → MAX → normal keeps title24 and does not reload account data`, async () => {
    const view = await favorites(scheme, { fontScale: 1.3 });
    const header = () => view.tree.root.findByProps({ testID: "favorites-header" });
    assert.equal(flat(header().findByType("Text").props.style).fontSize, 24);
    assert.equal(view.tree.root.findByType("FlatList").props.ListHeaderComponent, null);
    await view.resize(3.12, 375);
    assert.equal(header().findAllByType("Text").length, 0);
    assert.equal(texts(view).filter((text) => text === "Favorites").length, 1);
    await view.resize(1, 430);
    assert.equal(flat(header().findByType("Text").props.style).fontSize, 24);
    assert.equal(view.tree.root.findByType("FlatList").props.ListHeaderComponent, null);
    assert.equal(flat(view.tree.root.findByType("FlatList").props.contentContainerStyle).paddingHorizontal, 20);
    assert.deepEqual(view.calls.loads, ["fixture-token-A"]);
    await close(view);
  });
  test(`${scheme}: only decorative heart icon/tile accessibility is hidden, never heading or copy`, async () => {
    for (const guest of [false, true]) {
      const view = await favorites(scheme, { fontScale: 3.12, account: guest ? { token: null, user: null, isLoggedIn: false } : undefined });
      const heart = view.tree.root.findByProps({ name: "heart" });
      assert.equal(heart.props.color, "#FF4B4B");
      assert.equal(heart.props.accessible, false);
      assert.equal(heart.props.accessibilityElementsHidden, true);
      assert.equal(heart.props.importantForAccessibility, "no-hide-descendants");
      const outline = view.tree.root.findByProps({ name: "heart-outline" });
      const tile = outline.parent;
      assert.equal(tile.props.accessible, false);
      assert.equal(tile.props.accessibilityElementsHidden, true);
      assert.equal(tile.props.importantForAccessibility, "no-hide-descendants");
      assert.equal(tile.findAllByType("Text").length, 0);
      for (const node of view.tree.root.findAllByType("Text")) {
        for (let parent = node; parent; parent = parent.parent) assert.notEqual(parent.props.accessibilityElementsHidden, true);
      }
      await close(view);
    }
  });
  test(`${scheme}: MAX Retry is neutral named44-point and retains its loading/return path`, async () => {
    const view = await favorites(scheme, { fontScale: 3.12, width: 320, request: async () => { throw new Error("fictional read rejected"); } });
    const action = retry(view), style = flat(action.props.style);
    assert.equal(action.props.accessibilityRole, "button");
    assert.equal(action.props.accessibilityLabel, "Retry loading favorites");
    assert.equal(style.minWidth, 44);
    assert.equal(style.minHeight, 44);
    assert.equal(style.borderColor, colors.inputBorder);
    assert.equal(style.backgroundColor, colors.inputBackground);
    assert.equal(action.findByType("Ionicons").props.color, colors.icon);
    assert.equal(action.findByType("Ionicons").props.name, "refresh");
    assert.equal(flat(action.findByType("Text").props.style).color, colors.text);
    const pending = deferred();
    view.setRequest(() => pending.promise);
    await act(async () => { action.props.onPress(); });
    assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 1);
    assert.equal(retry(view), undefined);
    await act(async () => pending.resolve([]));
    assert.ok(texts(view).includes("No favorites yet"));
    assert.equal(view.calls.loads.length, 2);
    assert.deepEqual(view.calls.routes, []);
    await close(view);
  });
  test(`${scheme}: MAX populated nested callbacks still preserve row routes and favorite behavior in renderer`, async () => {
    const view = await favorites(scheme, { fontScale: 3.12, width: 375, items: [exercise("a"), exercise("b")] });
    await tap(rows(view)[0]);
    await tap(favorite(view, "b"));
    assert.deepEqual(view.calls.routes, [{ pathname: "/exercises/[id]", params: { id: "a" } }]);
    assert.deepEqual(view.calls.mutations, [["remove", "b", "fixture-token-A"]]);
    assert.equal(rows(view).length, 1);
    assert.equal(rows(view)[0].findAllByType("Text").find((node) => textOf(node) === "Fictional Bench Press").props.numberOfLines, 1);
    await close(view);
  });
  test(`${scheme}: guest copy remains non-loading and makes no service call`, async () => {
    const view = await favorites(scheme, { account: { token: null, user: null, isLoggedIn: false } });
    assert.deepEqual(texts(view), ["Favorites", "Sign in to save favorites", "Create an account to save your favorite exercises and access them anytime"]);
    assert.deepEqual(view.calls.loads, []);
    assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 0);
    await view.refocus();
    assert.deepEqual(view.calls.loads, []);
    await view.account("fixture-token-B");
    assert.deepEqual(view.calls.loads, ["fixture-token-B"]);
    assert.ok(texts(view).includes("No favorites yet"));
    await close(view);
  });
  test(`${scheme}: deferred loading preserves red heart, original heading and named Back`, async () => {
    const pending = deferred(), view = await favorites(scheme, { request: () => pending.promise });
    assert.deepEqual(texts(view), ["Favorites"]);
    assert.equal(view.tree.root.findByType("ActivityIndicator").props.color, colors.primaryButton);
    const heading = view.tree.root.findByType("Text");
    assert.equal(flat(heading.props.style).fontSize, 24);
    assert.equal(heading.props.numberOfLines, undefined);
    assert.equal(view.tree.root.findByProps({ name: "heart" }).props.color, "#FF4B4B");
    const safe = view.tree.root.findByType("SafeAreaView");
    assert.deepEqual(plain(safe.props.edges), ["top", "bottom"]);
    assert.equal(flat(safe.props.style).backgroundColor, colors.background);
    const back = view.tree.root.findByProps({ accessibilityLabel: "Back from favorites" });
    assert.equal(back.props.accessibilityRole, "button");
    assert.equal(flat(back.props.style).width, 44);
    assert.equal(flat(back.props.style).height, 44);
    assert.deepEqual(plain(back.props.hitSlop), { top: 10, bottom: 10, left: 10, right: 10 });
    await tap(back);
    assert.deepEqual(view.calls.backs, [true]);
    assert.deepEqual(view.calls.loads, ["fixture-token-A"]);
    await act(async () => pending.resolve([]));
    await close(view);
  });
  test(`${scheme}: empty copy and shared theme remain faithful without an extra action`, async () => {
    const view = await favorites(scheme);
    assert.deepEqual(texts(view), ["Favorites", "No favorites yet", "Tap the heart on any exercise to add it to your favorites"]);
    assert.equal(rows(view).length, 0);
    assert.equal(view.tree.root.findByProps({ name: "heart-outline" }).props.size, 56);
    const list = view.tree.root.findByType("FlatList");
    assert.equal(flat(list.props.contentContainerStyle).paddingBottom, 40);
    assert.equal(list.props.refreshControl.props.tintColor, colors.primaryButton);
    assert.deepEqual(view.calls.mutations, []);
    await close(view);
  });
  test(`${scheme}: failure exposes neutral named Retry and reloads the same account`, async () => {
    const view = await favorites(scheme, { request: async () => { throw new Error("fictional read rejected"); } });
    assert.deepEqual(texts(view), ["Favorites", "Failed to load favorites", "Retry"]);
    assert.equal(retry(view).props.accessibilityRole, "button");
    assert.equal(retry(view).props.accessibilityLabel, "Retry loading favorites");
    assert.equal(flat(retry(view).props.style).backgroundColor, colors.inputBackground);
    assert.equal(flat(retry(view).findByType("Text").props.style).color, colors.text);
    view.setRequest(async () => [exercise()]);
    await tap(retry(view));
    assert.equal(rows(view).length, 1);
    assert.deepEqual(view.calls.loads, ["fixture-token-A", "fixture-token-A"]);
    assert.deepEqual(view.calls.routes, []);
    await close(view);
  });
  test(`${scheme}: repeated Retry failure retains exact copy and no navigation`, async () => {
    const view = await favorites(scheme, { request: async () => { throw new Error("fictional read rejected"); } });
    await tap(retry(view));
    assert.equal(view.calls.loads.length, 2);
    assert.deepEqual(texts(view), ["Favorites", "Failed to load favorites", "Retry"]);
    assert.deepEqual(view.calls.routes, []);
    await close(view);
  });
  test(`${scheme}: response order, complete row names and exercise destinations remain exact`, async () => {
    const items = [exercise("a", { name: "First exercise" }), exercise("b", { name: "Second exercise", primaryMuscle: "legs" })];
    const view = await favorites(scheme, { items });
    assert.deepEqual(rows(view).map((row) => row.props.accessibilityLabel), ["First exercise, chest", "Second exercise, legs"]);
    for (const row of rows(view)) await tap(row);
    assert.deepEqual(view.calls.routes, items.map((item) => ({ pathname: "/exercises/[id]", params: { id: item.id } })));
    assert.deepEqual(view.calls.mutations, []);
    assert.equal(rows(view)[0].findAllByType("Text").find((node) => textOf(node) === "First exercise").props.numberOfLines, 1);
    await close(view);
  });
  test(`${scheme}: optimistic removal disappears immediately and duplicate callback is fenced`, async () => {
    const pending = deferred(), view = await favorites(scheme, { items: [exercise()], mutation: () => pending.promise });
    const toggle = view.tree.root.findByType(view.Row).props.onToggleFavorite;
    await tap(favorite(view));
    assert.equal(rows(view).length, 0);
    assert.ok(texts(view).includes("No favorites yet"));
    await act(async () => { toggle("fixture-exercise-1"); });
    assert.deepEqual(view.calls.mutations, [["remove", "fixture-exercise-1", "fixture-token-A"]]);
    await act(async () => pending.resolve());
    assert.equal(rows(view).length, 0);
    assert.deepEqual(view.calls.routes, []);
    await close(view);
  });
  test(`${scheme}: failed removal restores its original row and favorite state`, async () => {
    const view = await favorites(scheme, { items: [exercise()], mutation: async () => { throw new Error("fictional mutation rejected"); } });
    await tap(favorite(view));
    assert.equal(rows(view).length, 1);
    assert.equal(favorite(view).props.accessibilityLabel, "Remove Fictional Bench Press from favorites");
    assert.equal(favorite(view).props.disabled, false);
    assert.deepEqual(view.calls.mutations, [["remove", "fixture-exercise-1", "fixture-token-A"]]);
    await close(view);
  });
  test(`${scheme}: nested favorite and row handlers remain distinct without a mocked navigation side effect`, async () => {
    const view = await favorites(scheme, { items: [exercise("a"), exercise("b")] });
    await tap(rows(view)[0]);
    assert.equal(view.calls.routes.length, 1);
    await tap(favorite(view, "b"));
    assert.equal(view.calls.routes.length, 1);
    assert.deepEqual(view.calls.mutations, [["remove", "b", "fixture-token-A"]]);
    assert.equal(rows(view).length, 1);
    await close(view);
  });
  test(`${scheme}: focus reload hides rows until the replacement response settles`, async () => {
    const view = await favorites(scheme, { items: [exercise("old")] }), pending = deferred();
    view.setRequest(() => pending.promise);
    await view.refocus();
    assert.equal(rows(view).length, 0);
    assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 1);
    await act(async () => pending.resolve([exercise("new")]));
    assert.ok(favorite(view, "new"));
    assert.deepEqual(view.calls.loads, ["fixture-token-A", "fixture-token-A"]);
    await close(view);
  });
  test(`${scheme}: pull refresh keeps rows and exposes refreshing until successful replacement`, async () => {
    const view = await favorites(scheme, { items: [exercise("old")] }), pending = deferred();
    view.setRequest(() => pending.promise);
    await act(async () => view.tree.root.findByType("RefreshControl").props.onRefresh());
    assert.equal(rows(view).length, 1);
    assert.equal(view.tree.root.findByType("RefreshControl").props.refreshing, true);
    await act(async () => pending.resolve([exercise("new")]));
    assert.equal(view.tree.root.findByType("RefreshControl").props.refreshing, false);
    assert.ok(favorite(view, "new"));
    await close(view);
  });
  test(`${scheme}: inherited refresh error replaces visible rows with Retry`, async () => {
    const view = await favorites(scheme, { items: [exercise()] });
    view.setRequest(async () => { throw new Error("fictional refresh rejected"); });
    await act(async () => view.tree.root.findByType("RefreshControl").props.onRefresh());
    assert.equal(rows(view).length, 0);
    assert.deepEqual(texts(view), ["Favorites", "Failed to load favorites", "Retry"]);
    view.setRequest(async () => []);
    await tap(retry(view));
    assert.ok(texts(view).includes("No favorites yet"));
    assert.equal(view.calls.loads.length, 3);
    await close(view);
  });
  test(`${scheme}: late old-account success or error cannot replace new account rows`, async () => {
    for (const reject of [false, true]) {
      const pending = deferred(), view = await favorites(scheme, { request: () => pending.promise });
      view.setRequest(async () => [exercise("new-account")]);
      await view.account("fixture-token-B");
      await act(async () => reject ? pending.reject(new Error("fictional old read rejected")) : pending.resolve([exercise("old-account")]));
      assert.ok(favorite(view, "new-account"));
      assert.equal(rows(view).length, 1);
      assert.equal(retry(view), undefined);
      assert.deepEqual(view.calls.loads, ["fixture-token-A", "fixture-token-B"]);
      await close(view);
    }
  });
  test(`${scheme}: obsolete failed mutation cannot restore the old account snapshot`, async () => {
    const pending = deferred(), view = await favorites(scheme, { items: [exercise("old")], mutation: () => pending.promise });
    await tap(favorite(view, "old"));
    view.setRequest(async () => [exercise("new")]);
    await view.account("fixture-token-B");
    await act(async () => pending.reject(new Error("fictional obsolete mutation rejected")));
    assert.equal(rows(view).length, 1);
    assert.ok(favorite(view, "new"));
    assert.equal(view.tree.root.findAllByProps({ testID: "exercise-favorite-old" }).length, 0);
    await close(view);
  });
  test(`${scheme}: pending refresh respects a newer optimistic removal`, async () => {
    const view = await favorites(scheme, { items: [exercise()] }), pending = deferred();
    view.setRequest(() => pending.promise);
    await act(async () => view.tree.root.findByType("RefreshControl").props.onRefresh());
    await tap(favorite(view));
    await act(async () => pending.resolve([exercise()]));
    assert.equal(rows(view).length, 0);
    assert.ok(texts(view).includes("No favorites yet"));
    await close(view);
  });
  test(`${scheme}: blur cancellation prevents pending request state writes and allows fresh focus`, async () => {
    const pending = deferred(), view = await favorites(scheme, { observeState: true, request: () => pending.promise });
    await view.blur();
    const writes = view.calls.stateWrites.length;
    await act(async () => pending.resolve([exercise("stale")]));
    assert.equal(view.calls.stateWrites.length, writes);
    assert.equal(rows(view).length, 0);
    view.setRequest(async () => [exercise("fresh")]);
    await view.refocus();
    assert.ok(favorite(view, "fresh"));
    assert.equal(view.calls.loads.length, 2);
    await close(view);
  });
  test(`${scheme}: unmount cancellation prevents the pending request from writing state`, async () => {
    const pending = deferred(), view = await favorites(scheme, { observeState: true, request: () => pending.promise });
    await close(view);
    const writes = view.calls.stateWrites.length;
    await act(async () => pending.resolve([exercise()]));
    assert.equal(view.calls.stateWrites.length, writes);
    assert.deepEqual(view.calls.mutations, []);
  });
  test(`${scheme}: inherited parallel-removal rollback can restore another successful removal`, async () => {
    const pending = deferred();
    const view = await favorites(scheme, { items: [exercise("a"), exercise("b")], mutation: (_action, id) => id === "a" ? pending.promise : Promise.resolve() });
    await tap(favorite(view, "a"));
    await tap(favorite(view, "b"));
    assert.equal(rows(view).length, 0);
    await act(async () => pending.reject(new Error("fictional first removal rejected")));
    assert.equal(rows(view).length, 2);
    assert.ok(favorite(view, "a"));
    assert.ok(favorite(view, "b"));
    assert.deepEqual(view.calls.mutations.map(([action, id]) => [action, id]), [["remove", "a"], ["remove", "b"]]);
    await close(view);
  });
}
