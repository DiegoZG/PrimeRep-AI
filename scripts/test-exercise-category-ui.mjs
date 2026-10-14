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
const route = "app/explore/category.tsx";
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
  FlatList: (props) => React.createElement("FlatList", props, props.ListHeaderComponent, props.data.length ? props.data.map((item, index) => React.createElement(React.Fragment, { key: props.keyExtractor(item) }, props.renderItem({ item, index }))) : props.ListEmptyComponent, props.ListFooterComponent, props.refreshControl),
  StyleSheet: { create: (styles) => styles }, Platform: { OS: "ios", select: (values) => values.ios },
};
const theme = load("constants/theme.ts", { "react-native": native });
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const texts = (view) => view.tree.root.findAllByType("Text").map(textOf);
const rows = (view) => view.tree.root.findAllByType("Pressable").filter((node) => node.props.testID === "exercise-row");
const favorite = (view, id = "fixture-exercise-1") => view.tree.root.findByProps({ testID: `exercise-favorite-${id}` });
const footer = (view) => view.tree.root.findAllByType("Pressable").find((node) => node.props.testID === "category-exercise-load-more");
const retry = (view) => view.tree.root.findAllByType("Pressable").find((node) => textOf(node) === "Retry" && !node.props.testID);
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const exercise = (id = "fixture-exercise-1", extra = {}) => ({ id, name: "Fictional Bench Press", primaryMuscle: "chest", isFavorited: false, exerciseType: "strength", ...extra });
const page = (items = [], offset = 0, has_more = false) => ({ items, offset, limit: 50, total: 150, has_more });
const tap = async (node) => { assert.ok(node); assert.notEqual(node.props.disabled, true); await act(async () => node.props.onPress()); };
const close = async (view) => { await act(async () => view.tree.unmount()); };

async function category(scheme, options = {}) {
  const AuthContext = React.createContext(null), FocusContext = React.createContext(0);
  let account = { token: "fixture-token-A", user: { id: "fixture-account-A" }, isLoggedIn: true, ...options.account };
  let params = { type: "weights", ...options.params }, focus = 0;
  let dimensions = { width: options.width ?? 430, height: 932, fontScale: options.fontScale ?? 1, scale: 3 };
  let pageRequest = options.pageRequest ?? (async (params) => page(options.items ?? [], params.offset));
  let favoritesRequest = options.favoritesRequest ?? (async () => options.favoriteIds ?? []);
  let mutationRequest = options.mutationRequest ?? (async () => undefined);
  const calls = { pages: [], favorites: [], mutations: [], routes: [], backs: [] };
  const mocks = {
    react: React, "react-native": { ...native, useWindowDimensions: () => dimensions }, "@expo/vector-icons": { Ionicons: "Ionicons" }, "expo-image": { Image: "Image" },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@/constants/theme": theme,
    "@/hooks/use-color-scheme": { useColorScheme: () => scheme }, "@/utils/authContext": { AuthContext },
    "@/services/exerciseService": {
      getExercisePage: (params, token) => { calls.pages.push([plain(params), token]); return pageRequest(params, token); },
      getFavoriteExercises: (token) => { calls.favorites.push(token); return favoritesRequest(token); },
      favoriteExercise: (id, token) => { calls.mutations.push(["add", id, token]); return mutationRequest("add", id, token); },
      unfavoriteExercise: (id, token) => { calls.mutations.push(["remove", id, token]); return mutationRequest("remove", id, token); },
    },
    "expo-router": { useLocalSearchParams: () => params, useRouter: () => ({ push: (target) => calls.routes.push(plain(target)), back: () => calls.backs.push(true) }) },
    "@react-navigation/native": { useFocusEffect: (callback) => { const revision = React.useContext(FocusContext); React.useEffect(callback, [callback, revision]); } },
  };
  mocks["@/hooks/use-theme-color"] = load("hooks/use-theme-color.ts", mocks);
  mocks["@/components/themed-text"] = load("components/themed-text.tsx", mocks);
  mocks["@/components/explore"] = load("components/explore/ExerciseRow.tsx", mocks);
  mocks["@/components/exercises/CatalogPageFooter"] = load("components/exercises/CatalogPageFooter.tsx", mocks);
  mocks["@/hooks/use-exercise-pages"] = load("hooks/use-exercise-pages.ts", mocks);
  const { default: Screen } = load(route, mocks);
  const element = () => React.createElement(AuthContext.Provider, { value: account }, React.createElement(FocusContext.Provider, { value: focus }, React.createElement(Screen)));
  let tree;
  await act(async () => { tree = create(element()); });
  return {
    tree, calls, setPage: (value) => { pageRequest = value; }, setFavorites: (value) => { favoritesRequest = value; }, setMutation: (value) => { mutationRequest = value; },
    refocus: async () => { focus += 1; await act(async () => tree.update(element())); },
    account: async (token, id = "fixture-account-B") => { account = { token, user: token ? { id } : null, isLoggedIn: Boolean(token) }; await act(async () => tree.update(element())); },
    type: async (type) => { params = { type }; await act(async () => tree.update(element())); },
    resize: async (fontScale, width = dimensions.width) => { dimensions = { ...dimensions, fontScale, width }; await act(async () => tree.update(element())); },
  };
}

test("scope: original Category controller/import prefix, pagination hook and shared rows/footer stay byte-exact", () => {
  const input = source(route);
  const imports = input.slice(0, input.indexOf("export default function")).replace("  ScrollView,\n", "").replace("  useWindowDimensions,\n", "");
  assert.equal(hash(imports), "273cbd410bebd1af63e7bd9ddf4313493385686db2c81d0f4513a34b446ac193");
  const controller = input.slice(input.indexOf("export default function"), input.indexOf("\n  const { fontScale }"));
  assert.equal(Buffer.byteLength(controller), 5390);
  assert.equal(hash(controller), "d2d88a6fbda5df7769157595294d9d580195ea11980a0576e02b5341572c635e");
  for (const [file, expected] of Object.entries({ "hooks/use-exercise-pages.ts": "02996015951a88622b88fc435607962e5fe88607e35cc0ee676949a0421887d9", "components/explore/ExerciseRow.tsx": "0bc14d29cd072e478af532de907737ba58beb31df2e8ae46029f87768a10df90", "components/exercises/CatalogPageFooter.tsx": "7657993c25a704a35bc2163a8590b01598f8edd0da3d7181d09f063bd2167805" })) assert.equal(hash(source(file)), expected);
});

for (const scheme of ["light", "dark"]) {
  const colors = theme.Colors[scheme];
  for (const state of ["loaded", "empty", "loading", "error"]) {
    test(`${scheme}: MAX ${state} scrolls an uncapped full-width heading with fixed Back and no nested list`, async () => {
      const options = { params: { type: "bodyweight" }, fontScale: 3.12, width: 375 };
      if (state === "loaded") options.items = [exercise()];
      if (state === "loading") options.account = { token: null, user: null, isLoggedIn: false };
      if (state === "error") options.pageRequest = async () => { throw new Error("fictional read rejected"); };
      const view = await category(scheme, options);
      const header = view.tree.root.findByProps({ testID: "category-header" });
      assert.equal(header.findAllByType("Text").length, 0);
      assert.equal(header.children.length, 1);
      const back = header.findByProps({ accessibilityLabel: "Back from exercise category" });
      assert.equal(flat(back.props.style).width, 44);
      assert.equal(flat(back.props.style).height, 44);
      assert.equal(flat(back.props.style).flexShrink, 0);
      const isList = state === "loaded" || state === "empty";
      const body = view.tree.root.findByType(isList ? "FlatList" : "ScrollView");
      assert.equal(body.findAllByProps({ accessibilityLabel: "Back from exercise category" }).length, 0);
      assert.equal(view.tree.root.findAllByType(isList ? "ScrollView" : "FlatList").length, 0);
      const headings = body.findAllByType("Text").filter((node) => textOf(node) === "Bodyweight");
      assert.equal(headings.length, 1);
      assert.equal(flat(headings[0].props.style).fontSize, 24);
      assert.equal(flat(headings[0].props.style).flex, 0);
      for (const prop of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(headings[0].props[prop], undefined);
      assert.notEqual(headings[0].props.allowFontScaling, false);
      assert.equal(body.props.contentInsetAdjustmentBehavior, "automatic");
      assert.equal(flat(body.props.contentContainerStyle).paddingHorizontal, 8);
      assert.deepEqual(plain(view.tree.root.findByType("SafeAreaView").props.edges), ["top", "bottom"]);
      if (!isList) {
        assert.equal(flat(body.props.contentContainerStyle).flexGrow, 1);
        assert.equal(body.findAllByType("View").some((node) => flat(node.props.style).flex === 1 && flat(node.props.style).justifyContent === "center"), true);
      }
      assert.deepEqual(view.calls.mutations, []);
      await close(view);
    });
  }
  test(`${scheme}: normal → MAX → normal retains one heading and does not refetch pages or favorites`, async () => {
    const view = await category(scheme, { items: [exercise()], fontScale: 1.3 });
    const header = () => view.tree.root.findByProps({ testID: "category-header" });
    assert.equal(header().findByType("Text").children[0], "Weights");
    assert.equal(flat(header().findByType("Text").props.style).fontSize, 24);
    assert.equal(flat(header().findByType("Text").props.style).minWidth, 0);
    assert.equal(view.tree.root.findByType("FlatList").props.ListHeaderComponent, null);
    await view.resize(3.12, 375);
    assert.equal(header().findAllByType("Text").length, 0);
    assert.equal(texts(view).filter((value) => value === "Weights").length, 1);
    assert.ok(view.tree.root.findByType("FlatList").props.ListHeaderComponent);
    await view.resize(1, 430);
    assert.equal(header().findByType("Text").children[0], "Weights");
    assert.equal(view.tree.root.findByType("FlatList").props.ListHeaderComponent, null);
    assert.equal(flat(view.tree.root.findByType("FlatList").props.contentContainerStyle).paddingHorizontal, 20);
    assert.equal(view.calls.pages.length, 2);
    assert.deepEqual(view.calls.favorites, ["fixture-token-A"]);
    await close(view);
  });
  test(`${scheme}: MAX error Retry is neutral, named and44-point with unchanged refresh destination`, async () => {
    const view = await category(scheme, { params: { type: "cardio" }, fontScale: 3.12, width: 320, pageRequest: async () => { throw new Error("fictional read rejected"); } });
    const action = retry(view), style = flat(action.props.style);
    assert.equal(action.props.accessibilityRole, "button");
    assert.equal(action.props.accessibilityLabel, "Retry loading exercises");
    assert.equal(style.minWidth, 44);
    assert.equal(style.minHeight, 44);
    assert.equal(style.backgroundColor, colors.inputBackground);
    assert.equal(style.borderColor, colors.inputBorder);
    assert.equal(action.findByType("Ionicons").props.name, "refresh");
    assert.equal(action.findByType("Ionicons").props.color, colors.icon);
    const label = action.findByType("Text");
    assert.equal(flat(label.props.style).color, colors.text);
    assert.equal(label.props.numberOfLines, undefined);
    assert.equal(label.props.maxFontSizeMultiplier, undefined);
    view.setPage(async () => page([exercise()]));
    await tap(action);
    assert.equal(rows(view).length, 1);
    assert.deepEqual(view.calls.pages.map(([params]) => params.offset), [0, 0]);
    assert.deepEqual(view.calls.routes, []);
    await close(view);
  });
  test(`${scheme}: route-only neutral footer preserves load-more busy/disabled and paging handlers`, async () => {
    const pending = deferred();
    const view = await category(scheme, { params: { type: "bodyweight" }, fontScale: 3.12, pageRequest: async () => page([exercise()], 0, true) });
    assert.equal(flat(footer(view).findByType("Text").props.style).color, colors.text);
    assert.equal(footer(view).props.accessibilityLabel, "Load more results");
    view.setPage(() => pending.promise);
    await act(async () => { footer(view).props.onPress(); });
    assert.equal(footer(view).props.disabled, true);
    assert.deepEqual(plain(footer(view).props.accessibilityState), { disabled: true, busy: true });
    assert.equal(footer(view).findByType("ActivityIndicator").props.color, colors.text);
    assert.equal(rows(view).length, 1);
    await act(async () => pending.resolve(page([exercise("second")], 50)));
    assert.equal(rows(view).length, 2);
    assert.equal(footer(view), undefined);
    assert.deepEqual(view.calls.pages.map(([params]) => [params.type, params.offset]), [["bodyweight", 0], ["bodyweight", 50]]);
    assert.deepEqual(view.calls.mutations, []);
    await close(view);
  });
  for (const [type, title, types] of [["weights", "Weights", ["strength", "accessory"]], ["bodyweight", "Bodyweight", ["bodyweight"]], ["cardio", "Cardio", ["cardio"]], [undefined, "Weights", ["strength", "accessory"]], ["unknown", "Exercises", ["unknown"]]]) {
    test(`${scheme}: ${String(type)} retains exact title and original filter mapping`, async () => {
      const view = await category(scheme, { params: { type } });
      assert.equal(texts(view)[0], title);
      assert.deepEqual(view.calls.pages, types.map((type) => [{ type, offset: 0, limit: 50 }, "fixture-token-A"]));
      assert.deepEqual(view.calls.favorites, ["fixture-token-A"]);
      assert.deepEqual(view.calls.mutations, []);
      await close(view);
    });
  }
  test(`${scheme}: loading, original theme and named Back perform only reads`, async () => {
    const pending = deferred();
    const view = await category(scheme, { params: { type: "cardio" }, pageRequest: () => pending.promise });
    assert.deepEqual(texts(view), ["Cardio"]);
    assert.equal(view.tree.root.findByType("ActivityIndicator").props.color, colors.primaryButton);
    const safe = view.tree.root.findByType("SafeAreaView");
    assert.deepEqual(plain(safe.props.edges), ["top", "bottom"]);
    assert.equal(flat(safe.props.style).backgroundColor, colors.background);
    const back = view.tree.root.findByProps({ accessibilityLabel: "Back from exercise category" });
    assert.equal(back.props.accessibilityRole, "button");
    assert.equal(flat(back.props.style).width, 44);
    assert.deepEqual(plain(back.props.hitSlop), { top: 10, bottom: 10, left: 10, right: 10 });
    await tap(back);
    assert.deepEqual(view.calls.backs, [true]);
    assert.deepEqual(view.calls.routes, []);
    assert.equal(view.calls.pages.length, 1);
    await act(async () => pending.resolve(page()));
    await close(view);
  });
  test(`${scheme}: empty results preserve copy, refresh and exhausted footer`, async () => {
    const view = await category(scheme);
    assert.deepEqual(texts(view), ["Weights", "No exercises found"]);
    assert.equal(rows(view).length, 0);
    assert.equal(footer(view), undefined);
    const list = view.tree.root.findByType("FlatList");
    assert.equal(flat(list.props.contentContainerStyle).paddingBottom, 40);
    assert.equal(list.props.refreshControl.props.refreshing, false);
    await act(async () => list.props.refreshControl.props.onRefresh());
    assert.equal(view.calls.pages.length, 4);
    await close(view);
  });
  test(`${scheme}: initial error exposes neutral named Retry and still retries offset zero`, async () => {
    const view = await category(scheme, { params: { type: "cardio" }, pageRequest: async () => { throw new Error("fictional read rejected"); } });
    assert.deepEqual(texts(view), ["Cardio", "Exercises couldn’t load. Check your connection and try again.", "Retry"]);
    const action = retry(view);
    assert.equal(action.props.accessibilityRole, "button");
    assert.equal(action.props.accessibilityLabel, "Retry loading exercises");
    assert.equal(flat(action.props.style).backgroundColor, colors.inputBackground);
    assert.equal(flat(action.findByType("Text").props.style).color, colors.text);
    view.setPage(async () => page([exercise()]));
    await tap(action);
    assert.equal(rows(view).length, 1);
    assert.deepEqual(view.calls.pages.map(([params]) => params.offset), [0, 0]);
    assert.deepEqual(view.calls.routes, []);
    await close(view);
  });
  test(`${scheme}: weights pages advance only unexhausted types and de-duplicate ids`, async () => {
    const view = await category(scheme, { pageRequest: async ({ type, offset }) => type === "strength" ? page([exercise("s"), exercise("shared")], offset) : page([exercise("shared"), exercise(offset ? "a2" : "a1")], offset, !offset) });
    assert.equal(rows(view).length, 3);
    assert.equal(footer(view).props.accessibilityLabel, "Load more results");
    await tap(footer(view));
    assert.deepEqual(view.calls.pages.map(([params]) => [params.type, params.offset]), [["strength", 0], ["accessory", 0], ["accessory", 50]]);
    assert.equal(rows(view).length, 4);
    assert.equal(footer(view), undefined);
    await close(view);
  });
  test(`${scheme}: append failure retains rows and footer Retry repeats failed offset`, async () => {
    const view = await category(scheme, { params: { type: "cardio" }, pageRequest: async () => page([exercise()], 0, true) });
    view.setPage(async () => { throw new Error("fictional append rejected"); });
    await tap(footer(view));
    assert.equal(rows(view).length, 1);
    assert.equal(footer(view).props.accessibilityLabel, "Retry loading more results");
    assert.equal(footer(view).props.accessibilityRole, "button");
    assert.equal(flat(footer(view).props.style).minHeight, 48);
    view.setPage(async ({ offset }) => page([exercise("second")], offset));
    await tap(footer(view));
    assert.deepEqual(view.calls.pages.map(([params]) => params.offset), [0, 50, 50]);
    assert.equal(rows(view).length, 2);
    await close(view);
  });
  test(`${scheme}: refresh failure retains loaded rows and footer Retry refreshes offset zero`, async () => {
    const view = await category(scheme, { params: { type: "cardio" }, items: [exercise()] });
    view.setPage(async () => { throw new Error("fictional refresh rejected"); });
    await act(async () => view.tree.root.findByType("RefreshControl").props.onRefresh());
    assert.equal(rows(view).length, 1);
    view.setPage(async () => page([exercise("replacement")]));
    await tap(footer(view));
    assert.deepEqual(view.calls.pages.map(([params]) => params.offset), [0, 0, 0]);
    assert.equal(rows(view)[0].props.accessibilityLabel, "Fictional Bench Press, chest");
    assert.equal(favorite(view, "replacement").props.accessibilityLabel, "Add Fictional Bench Press to favorites");
    await close(view);
  });
  test(`${scheme}: focus reloads only favorite ids, not catalog pages`, async () => {
    const view = await category(scheme, { items: [exercise()] });
    view.setFavorites(async () => ["fixture-exercise-1"]);
    await view.refocus();
    assert.equal(view.calls.pages.length, 2);
    assert.deepEqual(view.calls.favorites, ["fixture-token-A", "fixture-token-A"]);
    assert.equal(favorite(view).props.accessibilityLabel, "Remove Fictional Bench Press from favorites");
    await close(view);
  });
  test(`${scheme}: inherited guest remains loading without catalog/favorite requests`, async () => {
    const view = await category(scheme, { account: { token: null, user: null, isLoggedIn: false } });
    assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 1);
    assert.deepEqual(view.calls.pages, []);
    assert.deepEqual(view.calls.favorites, []);
    await view.refocus();
    assert.deepEqual(view.calls.pages, []);
    await view.account("fixture-token-B");
    assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 0);
    assert.equal(view.calls.pages.length, 2);
    await close(view);
  });
  test(`${scheme}: real shared row keeps inherited ellipsis and exact exercise destination`, async () => {
    const item = exercise("long", { name: "A complete deliberately long fictional exercise name", primaryMuscle: "upper back" });
    const view = await category(scheme, { items: [item] });
    const row = rows(view)[0];
    assert.equal(row.props.accessibilityRole, "button");
    assert.equal(row.props.accessibilityLabel, `${item.name}, upper back`);
    const name = row.findAllByType("Text").find((node) => textOf(node) === item.name);
    assert.equal(name.props.numberOfLines, 1);
    assert.equal(name.props.ellipsizeMode, "tail");
    await tap(row);
    assert.deepEqual(view.calls.routes, [{ pathname: "/exercises/[id]", params: { id: "long" } }]);
    assert.deepEqual(view.calls.mutations, []);
    await close(view);
  });
  test(`${scheme}: optimistic add blocks a repeated mutation and retains success`, async () => {
    const pending = deferred();
    const view = await category(scheme, { items: [exercise()], mutationRequest: () => pending.promise });
    await tap(favorite(view));
    assert.equal(favorite(view).props.disabled, true);
    assert.equal(favorite(view).props.accessibilityState.busy, true);
    assert.equal(favorite(view).props.accessibilityLabel, "Remove Fictional Bench Press from favorites");
    await act(async () => favorite(view).props.onPress());
    assert.deepEqual(view.calls.mutations, [["add", "fixture-exercise-1", "fixture-token-A"]]);
    await act(async () => pending.resolve());
    assert.equal(favorite(view).props.disabled, false);
    await close(view);
  });
  test(`${scheme}: failed optimistic removal restores the original favorite`, async () => {
    const view = await category(scheme, { items: [exercise()], favoriteIds: ["fixture-exercise-1"], mutationRequest: async () => { throw new Error("fictional mutation rejected"); } });
    await tap(favorite(view));
    assert.deepEqual(view.calls.mutations, [["remove", "fixture-exercise-1", "fixture-token-A"]]);
    assert.equal(favorite(view).props.accessibilityLabel, "Remove Fictional Bench Press from favorites");
    assert.equal(favorite(view).props.disabled, false);
    await close(view);
  });
  test(`${scheme}: late focus favorite response preserves a newer optimistic mutation`, async () => {
    const pending = deferred();
    const view = await category(scheme, { items: [exercise()] });
    view.setFavorites(() => pending.promise);
    await view.refocus();
    await tap(favorite(view));
    await act(async () => pending.resolve([]));
    assert.equal(favorite(view).props.accessibilityLabel, "Remove Fictional Bench Press from favorites");
    await close(view);
  });
  test(`${scheme}: late old-account pages and favorite ids cannot replace new-account data`, async () => {
    const pages = deferred(), ids = deferred();
    const view = await category(scheme, { params: { type: "cardio" }, pageRequest: () => pages.promise, favoritesRequest: () => ids.promise });
    view.setPage(async () => page([exercise("new")]));
    view.setFavorites(async () => []);
    await view.account("fixture-token-B");
    await act(async () => { pages.resolve(page([exercise("old")])); ids.resolve(["new"]); });
    assert.equal(rows(view).length, 1);
    assert.equal(favorite(view, "new").props.accessibilityLabel, "Add Fictional Bench Press to favorites");
    assert.deepEqual(view.calls.pages.map(([, token]) => token), ["fixture-token-A", "fixture-token-B"]);
    assert.equal(view.tree.root.findAllByProps({ testID: "exercise-favorite-old" }).length, 0);
    await close(view);
  });
  test(`${scheme}: obsolete failed favorite mutation cannot roll back the new account`, async () => {
    const pending = deferred();
    const view = await category(scheme, { items: [exercise()], mutationRequest: () => pending.promise });
    await tap(favorite(view));
    view.setFavorites(async () => ["fixture-exercise-1"]);
    await view.account("fixture-token-B");
    await act(async () => pending.reject(new Error("fictional obsolete mutation rejected")));
    assert.equal(favorite(view).props.accessibilityLabel, "Remove Fictional Bench Press from favorites");
    assert.equal(favorite(view).props.disabled, false);
    assert.equal(view.calls.mutations.length, 1);
    await close(view);
  });
  test(`${scheme}: type change fences a pending response and retains the new mapping`, async () => {
    const pending = deferred();
    const view = await category(scheme, { params: { type: "cardio" }, pageRequest: () => pending.promise });
    view.setPage(async () => page([exercise("body")]));
    await view.type("bodyweight");
    await act(async () => pending.resolve(page([exercise("old-cardio")])));
    assert.equal(texts(view)[0], "Bodyweight");
    assert.equal(favorite(view, "body").props.accessibilityRole, "button");
    assert.deepEqual(view.calls.pages.map(([params]) => params.type), ["cardio", "bodyweight"]);
    await close(view);
  });
  test(`${scheme}: token removal hides owned catalog rows and retains inherited guest loading`, async () => {
    const view = await category(scheme, { items: [exercise()] });
    await view.account(null);
    assert.equal(rows(view).length, 0);
    assert.equal(view.tree.root.findAllByType("ActivityIndicator").length, 1);
    assert.equal(view.calls.pages.length, 2);
    assert.deepEqual(view.calls.mutations, []);
    await close(view);
  });
}
