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
const inside = (node, ancestor) => { for (let parent = node.parent; parent; parent = parent.parent) if (parent === ancestor) return true; return false; };
const hostParent = (node) => { let parent = node.parent; while (parent && typeof parent.type !== "string") parent = parent.parent; return parent; };
for (const scheme of ["light", "dark"]) {
  for (const state of ["missing", "loading", "error", "empty", "loaded"]) {
    test(`${scheme}: ${state} normal/MAX transition has one growing scroll body and fixed Back`, async () => {
      const pending = deferred();
      const options = state === "missing" ? { missingDay: true } : state === "loading" ? { request: () => pending.promise } : state === "error" ? { request: async () => { throw new Error("fixture unavailable"); } } : state === "loaded" ? { items: [exercise()] } : {};
      const view = await picker(scheme, { ...options, title: "A complete uncapped workout day title" });
      const originalCalls = plain(view.calls.pages), before = plain(view.draft);
      assert.equal(host(view, "program-exercise-picker-title"), undefined);
      const normalTitle = view.tree.root.findAllByType("Text").find((node) => textOf(node) === "Choose exercise");
      assert.equal(normalTitle.props.numberOfLines, 1);
      await view.resize(1.3);
      assert.equal(host(view, "program-exercise-picker-title"), undefined);
      for (const width of [320, 375, 430]) {
        await view.resize(3.12, width);
        const scrolls = view.tree.root.findAllByType("ScrollView"), scroll = host(view, "program-exercise-picker-scroll");
        assert.equal(scrolls.length, 1);
        assert.equal(scrolls[0], scroll);
        assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
        assert.equal(scroll.props.keyboardShouldPersistTaps, "handled");
        assert.equal(scroll.props.keyboardDismissMode, "on-drag");
        assert.equal(flat(scroll.props.contentContainerStyle).flexGrow, 1);
        assert.equal(flat(scroll.props.contentContainerStyle).paddingHorizontal, 8);
        assert.ok(flat(scroll.props.contentContainerStyle).paddingBottom >= 32);
        assert.deepEqual(plain(view.tree.root.findByType("SafeAreaView").props.edges), ["top", "bottom"]);
        const back = host(view, "program-exercise-picker-back"), title = host(view, "program-exercise-picker-title");
        assert.equal(back.props.accessibilityLabel, "Back from Choose exercise");
        assert.equal(back.props.accessibilityRole, "button");
        assert.equal(flat(back.props.style).width, 44);
        assert.equal(flat(back.props.style).height, 44);
        assert.equal(inside(back, scroll), false);
        assert.ok(inside(title, scroll));
        assert.equal(title.props.accessibilityRole, "header");
        assert.equal(textOf(title), "Choose exercise");
        assert.equal(flat(title.props.style).fontSize, 22);
        const uncapped = [title];
        if (state !== "missing") {
          const day = host(view, "program-exercise-picker-day"), tile = host(view, "custom-exercise-create");
          assert.equal(textOf(day), "A complete uncapped workout day title");
          assert.ok(inside(day, scroll));
          assert.ok(inside(search(view), scroll));
          assert.ok(inside(tile, scroll));
          assert.equal(flat(tile.props.style).flexDirection, "column");
          assert.equal(flat(tile.props.style).alignItems, "stretch");
          const copy = tile.findAllByType("Text").find((node) => textOf(node) === "Create custom exercise");
          const copyContainer = hostParent(copy);
          assert.equal(flat(copyContainer.props.style).minWidth, 0);
          assert.equal(flat(copyContainer.props.style).alignSelf, "stretch");
          assert.notEqual(host(view, "program-exercise-custom-decoration"), copyContainer);
          uncapped.push(day, ...tile.findAllByType("Text"));
        } else assert.equal(search(view), undefined);
        for (const text of uncapped) {
          assert.equal(text.props.numberOfLines, undefined);
          assert.notEqual(text.props.allowFontScaling, false);
          assert.equal(text.props.maxFontSizeMultiplier, undefined);
          assert.equal(text.props.ellipsizeMode, undefined);
        }
        const stateID = state === "missing" ? null : state === "loaded" ? null : `program-exercise-picker-${state}`;
        if (stateID) assert.ok(inside(host(view, stateID), scroll));
        if (state === "missing") assert.ok(texts(view).includes("Workout day unavailable"));
        if (state === "loaded") assert.ok(inside(rows(view)[0], scroll));
      }
      await view.resize(1.31);
      assert.ok(host(view, "program-exercise-picker-title"));
      await view.resize(1);
      assert.equal(host(view, "program-exercise-picker-title"), undefined);
      assert.equal(host(view, "program-exercise-picker-back"), undefined);
      assert.equal(view.tree.root.findAllByType("Text").find((node) => textOf(node) === "Choose exercise").props.numberOfLines, 1);
      assert.deepEqual(view.calls.pages, originalCalls);
      assert.deepEqual(plain(view.draft), before);
      assert.deepEqual(view.calls.routes, []);
      assert.deepEqual(view.calls.favorites, []);
      await close(view);
    });
  }
  test(`${scheme}: enlarged controls preserve debounce/custom route/selection and missing-day Back semantics`, async () => {
    const item = exercise(), view = await picker(scheme, { fontScale: 3.12, items: [item] });
    await view.change("  bench  ");
    await view.tick(249);
    assert.equal(view.calls.pages.length, 1);
    await view.tick(1);
    assert.deepEqual(view.calls.pages.at(-1)[0], { q: "bench", offset: 0, limit: 50 });
    const before = plain(view.draft);
    await tap(host(view, "custom-exercise-create"));
    assert.deepEqual(view.calls.routes, [["push", { pathname: "/programs/custom-exercise", params: { dayId: view.dayId } }]]);
    assert.deepEqual(plain(view.draft), before);
    await tap(row(view, item.id));
    assert.deepEqual(view.calls.routes.at(-1), ["back"]);
    const selected = view.tree.root.findAllByType("Ionicons").find((node) => node.props.size === 18);
    assert.equal(selected.props.name, "checkmark");
    assert.equal(selected.props.color, "#168A3D");
    assert.equal(flat(selected.parent.props.style).backgroundColor, "#E5F8EB");
    assert.deepEqual(view.calls.favorites, []);
    await close(view);
    const missing = await picker(scheme, { fontScale: 3.12, missingDay: true });
    await tap(host(missing, "program-exercise-picker-back"));
    await tap(missing.tree.root.findByProps({ accessibilityLabel: "Back to builder" }));
    assert.deepEqual(missing.calls.routes, [["back"], ["replace", "/programs/builder"]]);
    await close(missing);
  });
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const route = "app/programs/exercise-picker.tsx";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const plain = (value) => JSON.parse(JSON.stringify(value));
function load(file, mocks, globals = {}) {
  const filename = path.join(root, file), module = { exports: {} }, fallback = createRequire(filename);
  const output = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console, ...globals }, { filename });
  return module.exports;
}
const native = { ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", TextInput: "TextInput", View: "View", StyleSheet: { create: (styles) => styles }, Platform: { OS: "ios", select: (values) => values.ios } };
const theme = load("constants/theme.ts", { "react-native": native });
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const texts = (view) => view.tree.root.findAllByType("Text").map(textOf);
const host = (view, id) => view.tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const rows = (view) => view.tree.root.findAllByType(view.Row);
const row = (view, id) => rows(view).find((node) => node.props.id === id).findByType("Pressable");
const search = (view) => host(view, "program-exercise-search");
const footer = (view) => host(view, "program-exercise-load-more");
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const exercise = (id = "fixture-exercise-1", extra = {}) => ({ id, name: "Fictional Bench Press", primaryMuscle: "chest", exerciseType: "strength", isFavorited: false, ...extra });
const page = (items = [], offset = 0, has_more = false) => ({ items, offset, limit: 50, total: 150, has_more });
const tap = async (node) => { assert.ok(node); assert.notEqual(node.props.disabled, true); await act(async () => node.props.onPress()); };
const close = async (view) => { await act(async () => view.tree.unmount()); };

async function picker(scheme, options = {}) {
  const AuthContext = React.createContext(null);
  let dimensions = { width: options.width ?? 430, height: 932, scale: 3, fontScale: options.fontScale ?? 1 };
  let account = { token: "fixture-token-A", user: { id: "fixture-account-A" }, ...options.account };
  let request = options.request ?? (async (params) => page(options.items ?? [], params.offset));
  let context, dayId, ready = false, now = 0, timerId = 0;
  const timers = new Map(), calls = { pages: [], routes: [], favorites: [], timerClear: [] };
  const globals = {
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay, due: now + delay }); return id; },
    clearTimeout: (id) => { calls.timerClear.push(id); timers.delete(id); },
  };
  const mocks = {
    react: React, "react-native": { ...native, useWindowDimensions: () => dimensions }, "@expo/vector-icons": { Ionicons: "Ionicons" }, "expo-image": { Image: "Image" },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@/constants/theme": theme, "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@/utils/authContext": { AuthContext }, "./authContext": { AuthContext },
    "@/services/exerciseService": {
      getExercisePage: (params, token) => { calls.pages.push([plain(params), token]); return request(params, token); },
      getFavoriteExercises: (...args) => { calls.favorites.push(args); return Promise.resolve([]); },
      favoriteExercise: (...args) => { calls.favorites.push(args); return Promise.resolve(); },
      unfavoriteExercise: (...args) => { calls.favorites.push(args); return Promise.resolve(); },
    },
    "expo-router": { useLocalSearchParams: () => ({ dayId }), useRouter: () => ({ push: (target) => calls.routes.push(["push", plain(target)]), replace: (target) => calls.routes.push(["replace", target]), back: () => calls.routes.push(["back"]) }) },
  };
  mocks["@/hooks/use-theme-color"] = load("hooks/use-theme-color.ts", mocks);
  mocks["@/components/themed-text"] = load("components/themed-text.tsx", mocks);
  mocks["@/components/explore"] = load("components/explore/ExerciseRow.tsx", mocks);
  mocks["@/components/program"] = load("components/program/ProgramHeader.tsx", mocks);
  mocks["@/components/screen-state"] = load("components/screen-state.tsx", mocks);
  mocks["@/components/exercises/CatalogPageFooter"] = load("components/exercises/CatalogPageFooter.tsx", mocks);
  mocks["@/utils/exerciseTracking"] = load("utils/exerciseTracking.ts", mocks);
  mocks["@/hooks/use-exercise-pages"] = load("hooks/use-exercise-pages.ts", mocks);
  const actualDraft = load("utils/programDraftContext.tsx", mocks);
  mocks["@/utils/programDraftContext"] = actualDraft;
  const { default: Screen } = load(route, mocks, globals);
  function Probe() { context = actualDraft.useProgramDraft(); return null; }
  const element = () => React.createElement(AuthContext.Provider, { value: account }, React.createElement(actualDraft.ProgramDraftProvider, null, React.createElement(Probe), ready && React.createElement(Screen)));
  let tree;
  await act(async () => { tree = create(element()); });
  const createDay = async (title = "Fixture day") => {
    await act(async () => context.addDay());
    dayId = context.draft.days.at(-1).localId;
    await act(async () => context.updateDay(dayId, { title }));
    await act(async () => tree.update(element()));
  };
  if (!options.missingDay) {
    await createDay(options.title ?? "Fixture day");
    for (const item of options.selected ?? []) await act(async () => context.addExercise(dayId, item));
  } else dayId = "fixture-missing-day";
  ready = true;
  await act(async () => tree.update(element()));
  return {
    tree, calls, timers, Row: mocks["@/components/explore"].ExerciseRow,
    get dayId() { return dayId; }, get draft() { return context.draft; }, get day() { return context.draft.days.find((day) => day.localId === dayId); },
    setRequest: (value) => { request = value; },
    change: async (value) => { await act(async () => search({ tree }).props.onChangeText(value)); },
    tick: async (milliseconds) => { now += milliseconds; await act(async () => { for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.callback(); } }); },
    createDay,
    resize: async (fontScale, width = dimensions.width) => { dimensions = { ...dimensions, fontScale, width }; await act(async () => tree.update(element())); },
    account: async (token, id = "fixture-account-B") => { account = { token, user: token ? { id } : null }; await act(async () => tree.update(element())); },
  };
}

test("scope: original controller/restored imports/provider/hook and shared UI remain byte-exact", () => {
  const input = source(route), controller = input.slice(input.indexOf("export default function"), input.indexOf("\n  const { fontScale }"));
  const imports = input.slice(0, input.indexOf("export default function"));
  assert.equal(imports.split(", useWindowDimensions").length, 2);
  const restoredImports = imports.replace(", useWindowDimensions", "");
  assert.equal(Buffer.byteLength(restoredImports), 968);
  assert.equal(hash(restoredImports), "c39342880dbf9860a7d538155acc0b1ee0e5fc75404631c8da3663697bdacab0");
  assert.equal(Buffer.byteLength(controller), 929);
  assert.equal(hash(controller), "25e593af7e343da30d047555413edfd5b71fe8c1a726baa7740b54302d81342a");
  for (const [file, expected] of Object.entries({ "utils/programDraftContext.tsx": "762761a628fe5b6e8c17548100230bc5f7b8ec7ed183c9791d38014817fbb76c", "hooks/use-exercise-pages.ts": "02996015951a88622b88fc435607962e5fe88607e35cc0ee676949a0421887d9", "components/program/ProgramHeader.tsx": "4959bd4948aa81d28b342aefdd513a6e14797bdd7d5b7f726c658ec7c70cb434", "components/screen-state.tsx": "31bb083f19309cf2e44f2b93ddde2266fd57e40cc8191b3e57305c8320d4158f", "components/explore/ExerciseRow.tsx": "0bc14d29cd072e478af532de907737ba58beb31df2e8ae46029f87768a10df90", "utils/exerciseTracking.ts": "aa6f39ee8ea4c96f80f023fdb2b05934fa69922684c54460f1406c5b0c8b46e6" })) assert.equal(hash(source(file)), expected);
});

for (const scheme of ["light", "dark"]) {
  const colors = theme.Colors[scheme];
  test(`${scheme}: missing day retains exact builder/Back routes and unconditional catalog read`, async () => {
    const view = await picker(scheme, { missingDay: true });
    assert.ok(texts(view).includes("Workout day unavailable"));
    assert.equal(host(view, "custom-exercise-create"), undefined);
    await tap(view.tree.root.findByProps({ accessibilityLabel: "Back to builder" }));
    await tap(view.tree.root.findByProps({ accessibilityLabel: "Back from Choose exercise" }));
    assert.deepEqual(view.calls.routes, [["replace", "/programs/builder"], ["back"]]);
    assert.deepEqual(view.calls.pages, [[{ offset: 0, limit: 50 }, "fixture-token-A"]]);
    assert.equal(view.draft.days.length, 0);
    await close(view);
  });
  test(`${scheme}: loading and empty preserve actual shared state copy and original chrome`, async () => {
    const pending = deferred(), view = await picker(scheme, { request: () => pending.promise });
    assert.ok(host(view, "program-exercise-picker-loading"));
    assert.ok(texts(view).includes("Loading exercises…"));
    assert.deepEqual(plain(view.tree.root.findByType("SafeAreaView").props.edges), ["top", "bottom"]);
    assert.equal(search(view).props.accessibilityLabel, "Search exercises");
    assert.equal(search(view).props.placeholder, "Search by exercise name");
    await act(async () => pending.resolve(page()));
    assert.ok(host(view, "program-exercise-picker-empty"));
    assert.ok(texts(view).includes("No exercises found"));
    assert.ok(texts(view).includes("Try another term or create your own exercise."));
    const header = view.tree.root.findAllByType("Text").find((node) => textOf(node) === "Choose exercise");
    assert.equal(header.props.numberOfLines, 1);
    assert.equal(footer(view), undefined);
    await close(view);
  });
  test(`${scheme}: private-create tile uses neutral theme colors and exact unsaved day route`, async () => {
    const view = await picker(scheme), before = plain(view.draft), tile = host(view, "custom-exercise-create");
    assert.equal(tile.props.accessibilityRole, "button");
    assert.equal(tile.props.accessibilityLabel, "Create a custom exercise");
    assert.equal(flat(tile.props.style).minHeight, 72);
    assert.equal(flat(tile.props.style).borderColor, colors.inputBorder);
    assert.equal(tile.findAllByType("Ionicons").find((node) => node.props.name === "add").props.color, colors.text);
    assert.equal(flat(tile.findAllByType("View")[0].props.style).backgroundColor, colors.inputBackground);
    assert.ok(texts(view).includes("Private to your account"));
    await tap(tile);
    assert.deepEqual(view.calls.routes, [["push", { pathname: "/programs/custom-exercise", params: { dayId: view.dayId } }]]);
    assert.deepEqual(plain(view.draft), before);
    assert.deepEqual(view.calls.favorites, []);
    await close(view);
  });
  test(`${scheme}: selection writes only actual local draft defaults and returns once`, async () => {
    const item = exercise(), view = await picker(scheme, { items: [item] });
    const badge = view.tree.root.findAllByType("Ionicons").find((node) => node.props.size === 18);
    assert.equal(badge.props.name, "add");
    assert.equal(badge.props.color, colors.text);
    assert.equal(flat(badge.parent.props.style).backgroundColor, colors.inputBackground);
    await tap(row(view, item.id));
    assert.equal(view.day.exercises.length, 1);
    const added = view.day.exercises[0];
    assert.deepEqual([added.exerciseId, added.position, added.blockType, added.sets, added.repsMin, added.repsMax, added.restSeconds], [item.id, 0, "main", 3, 8, 12, 90]);
    assert.deepEqual(view.calls.routes, [["back"]]);
    const selected = row(view, item.id);
    assert.equal(selected.props.disabled, true);
    assert.match(selected.props.accessibilityLabel, /already added/);
    await act(async () => selected.props.onPress());
    assert.equal(view.day.exercises.length, 1);
    assert.deepEqual(view.calls.routes, [["back"]]);
    assert.deepEqual(view.calls.favorites, []);
    await close(view);
  });
  test(`${scheme}: existing selection remains meaningful green and cannot be added twice`, async () => {
    const item = exercise(), view = await picker(scheme, { items: [item], selected: [item] });
    const badge = view.tree.root.findAllByType("Ionicons").find((node) => node.props.size === 18);
    assert.equal(badge.props.name, "checkmark");
    assert.equal(badge.props.color, "#168A3D");
    assert.equal(flat(badge.parent.props.style).backgroundColor, "#E5F8EB");
    assert.equal(badge.parent.props.importantForAccessibility, "no-hide-descendants");
    await act(async () => row(view, item.id).props.onPress());
    assert.equal(view.day.exercises.length, 1);
    assert.deepEqual(view.calls.routes, []);
    await close(view);
  });
  test(`${scheme}: local neutral accents preserve shared error action palette and copy`, async () => {
    const view = await picker(scheme, { request: async () => { throw new Error("fixture unavailable"); } });
    assert.ok(host(view, "program-exercise-picker-error"));
    const retry = view.tree.root.findByProps({ accessibilityLabel: "Retry" });
    assert.equal(flat(retry.props.style).backgroundColor, colors.primaryButton);
    assert.equal(flat(retry.findByType("Text").props.style).color, "#FFFFFF");
    assert.equal(textOf(retry), "Retry");
    assert.ok(texts(view).includes("Exercises unavailable"));
    const tile = host(view, "custom-exercise-create"), icon = tile.findAllByType("Ionicons").find((node) => node.props.name === "add");
    assert.equal(icon.props.color, colors.text);
    assert.equal(flat(icon.parent.props.style).backgroundColor, colors.inputBackground);
    assert.deepEqual(view.calls.routes, []);
    assert.deepEqual(view.calls.favorites, []);
    await close(view);
  });
  test(`${scheme}: reviewed duration/distance references are disabled with exact reason and no add badge`, async () => {
    for (const trackingMode of ["duration", "distance"]) {
      const item = exercise("reference", { contentVersion: "fixture-reviewed", trackingMode }), view = await picker(scheme, { items: [item] });
      const control = row(view, item.id);
      assert.equal(control.props.disabled, true);
      assert.match(control.props.accessibilityLabel, /Reference only — tracking not supported/);
      assert.ok(texts(view).includes("Reference only — tracking not supported"));
      assert.equal(view.tree.root.findAllByType("Ionicons").filter((node) => node.props.size === 18).length, 0);
      await act(async () => control.props.onPress());
      assert.equal(view.day.exercises.length, 0);
      assert.deepEqual(view.calls.routes, []);
      await close(view);
    }
  });
  test(`${scheme}: reviewed reps and legacy timed exercises retain existing eligibility`, async () => {
    for (const extra of [{ contentVersion: "fixture-reviewed", trackingMode: "reps" }, { trackingMode: "duration" }]) {
      const item = exercise("eligible", extra), view = await picker(scheme, { items: [item] });
      await tap(row(view, item.id));
      assert.equal(view.day.exercises[0].exerciseId, item.id);
      assert.deepEqual(view.calls.routes, [["back"]]);
      await close(view);
    }
  });
  test(`${scheme}: 250ms search trims query, replaces stale timers and clears after debounce`, async () => {
    const view = await picker(scheme);
    await view.change("s");
    await view.change(" sq ");
    assert.equal(search(view).props.value, " sq ");
    assert.equal(view.timers.size, 1);
    assert.equal([...view.timers.values()][0].delay, 250);
    await view.tick(249);
    assert.equal(view.calls.pages.length, 1);
    await view.tick(1);
    assert.deepEqual(view.calls.pages.at(-1), [{ q: "sq", offset: 0, limit: 50 }, "fixture-token-A"]);
    await tap(view.tree.root.findByProps({ accessibilityLabel: "Clear exercise search" }));
    assert.equal(search(view).props.value, "");
    assert.equal(view.calls.pages.length, 2);
    await view.tick(250);
    assert.deepEqual(view.calls.pages.at(-1), [{ offset: 0, limit: 50 }, "fixture-token-A"]);
    assert.equal(view.calls.pages.length, 3);
    await close(view);
  });
  test(`${scheme}: inherited one-character search fetches unfiltered data; equivalent trimmed query does not reload`, async () => {
    const view = await picker(scheme);
    await view.change(" x "); await view.tick(250);
    assert.deepEqual(view.calls.pages.at(-1), [{ offset: 0, limit: 50 }, "fixture-token-A"]);
    assert.equal(view.calls.pages.length, 2);
    await view.change("x  "); await view.tick(250);
    assert.equal(view.calls.pages.length, 2);
    await close(view);
  });
  test(`${scheme}: unmount clears pending debounce without a later catalog read`, async () => {
    const view = await picker(scheme);
    await view.change("squat");
    assert.equal(view.timers.size, 1);
    await close(view);
    assert.equal(view.timers.size, 0);
    await view.tick(1000);
    assert.equal(view.calls.pages.length, 1);
    assert.ok(view.calls.timerClear.length >= 2);
  });
  test(`${scheme}: initial error Retry preserves shared state and current zero-offset refresh`, async () => {
    const view = await picker(scheme, { request: async () => { throw new Error("fictional read rejected"); } });
    assert.ok(host(view, "program-exercise-picker-error"));
    assert.ok(texts(view).includes("Exercises unavailable"));
    assert.ok(texts(view).includes("Exercises couldn’t load. Check your connection and try again."));
    view.setRequest(async () => page([exercise()]));
    await tap(view.tree.root.findByProps({ accessibilityLabel: "Retry" }));
    assert.equal(rows(view).length, 1);
    assert.deepEqual(view.calls.pages.map(([params]) => params.offset), [0, 0]);
    assert.deepEqual(view.calls.routes, []);
    await close(view);
  });
  test(`${scheme}: paging de-duplicates rows and append failure retries unchanged offset`, async () => {
    const view = await picker(scheme, { request: async () => page([exercise("a")], 0, true) });
    view.setRequest(async () => { throw new Error("fictional append rejected"); });
    await tap(footer(view));
    assert.equal(rows(view).length, 1);
    assert.equal(footer(view).props.accessibilityLabel, "Retry loading more results");
    view.setRequest(async ({ offset }) => page([exercise("a"), exercise("b")], offset));
    await tap(footer(view));
    assert.equal(rows(view).length, 2);
    assert.deepEqual(view.calls.pages.map(([params]) => params.offset), [0, 50, 50]);
    assert.equal(footer(view), undefined);
    assert.deepEqual(view.calls.favorites, []);
    await close(view);
  });
  test(`${scheme}: pending old search response cannot overwrite new query rows`, async () => {
    const first = deferred(), second = deferred(), view = await picker(scheme);
    view.setRequest(() => first.promise); await view.change("squat"); await view.tick(250);
    view.setRequest(() => second.promise); await view.change("press"); await view.tick(250);
    await act(async () => second.resolve(page([exercise("new")] )));
    await act(async () => first.resolve(page([exercise("old")] )));
    assert.deepEqual(rows(view).map((node) => node.props.id), ["new"]);
    assert.equal(search(view).props.value, "press");
    await close(view);
  });
  test(`${scheme}: account changes clear owned draft/day and fence old catalog responses`, async () => {
    const pending = deferred(), view = await picker(scheme, { selected: [exercise("selected-A")], request: () => pending.promise });
    view.setRequest(async () => page([exercise("new-B")]));
    await view.account("fixture-token-B");
    assert.equal(view.draft.days.length, 0);
    assert.ok(texts(view).includes("Workout day unavailable"));
    await view.createDay("Account B day");
    await act(async () => pending.resolve(page([exercise("old-A")])));
    assert.deepEqual(rows(view).map((node) => node.props.id), ["new-B"]);
    assert.equal(view.day.exercises.length, 0);
    assert.deepEqual(view.calls.pages.map(([, token]) => token), ["fixture-token-A", "fixture-token-B"]);
    assert.deepEqual(view.calls.favorites, []);
    await close(view);
  });
  test(`${scheme}: guest local renderer day retains loading with no catalog/favorite call`, async () => {
    const view = await picker(scheme, { account: { token: null, user: null } });
    assert.ok(host(view, "program-exercise-picker-loading"));
    assert.equal(view.draft.days.length, 1);
    assert.deepEqual(view.calls.pages, []);
    assert.deepEqual(view.calls.favorites, []);
    await close(view);
  });
  test(`${scheme}: no favorite controls and inherited shared-row/header truncation stay unchanged`, async () => {
    const view = await picker(scheme, { items: [exercise()] });
    assert.equal(view.tree.root.findAll((node) => node.props.testID?.startsWith("exercise-favorite-")).length, 0);
    assert.equal(rows(view)[0].props.canFavorite, false);
    assert.equal(rows(view)[0].props.showFavoriteControl, false);
    assert.equal(rows(view)[0].props.isFavorite, false);
    assert.equal(row(view, "fixture-exercise-1").findAllByType("Text").find((node) => textOf(node) === "Fictional Bench Press").props.numberOfLines, 1);
    assert.deepEqual(view.calls.favorites, []);
    await close(view);
  });
  test(`${scheme}: inherited same-render repeated handler de-duplicates draft but can repeat Back`, async () => {
    const item = exercise(), view = await picker(scheme, { items: [item] }), handler = row(view, item.id).props.onPress;
    await act(async () => { handler(); handler(); });
    assert.equal(view.day.exercises.length, 1);
    assert.deepEqual(view.calls.routes, [["back"], ["back"]]);
    await close(view);
  });
}
