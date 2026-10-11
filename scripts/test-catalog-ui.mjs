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
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console: { ...console, warn() {} } }, { filename });
  return module.exports;
}
const native = { ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", View: "View", Text: "Text", ScrollView: "ScrollView", StyleSheet: { create: (styles) => styles }, Platform: { select: (values) => values.ios }, useWindowDimensions: () => ({ width: 375, fontScale: 1 }) };
const { Colors, Fonts } = load("constants/theme.ts", { "react-native": native });
const display = load("utils/programDisplay.ts", { "@/utils/localDate": { localDateIso: () => "2026-10-11" } });
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node, pressed = false) => flat(typeof node.props.style === "function" ? node.props.style({ pressed }) : node.props.style);
const textOf = (node) => typeof node === "string" ? node : (node?.children?.map(textOf).join(" ") ?? "").replace(/\s+/g, " ").trim();
const host = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const summary = (id, extra = {}) => ({ id, name: "Three-day strength and conditioning program with a longer name", description: "Progressive training", scope: "system", frequency: 3, durationMinutes: 35, goal: "build-muscle", level: "no-experience", equipmentCompatible: true, missingEquipmentIds: [], matchReasons: ["Matches your training days"], ...extra });
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
function contrast(a, b) {
  const luminance = (hex) => (hex.length === 4 ? hex.slice(1).split("").map((value) => value.repeat(2)) : hex.slice(1).match(/../g)).map((value) => parseInt(value, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

async function catalog(scheme, { route = {}, fontScale = 1, response = { items: [summary("one")], total: 1 }, active = { current: null, scheduled: null }, list, equipment = [{ id: "barbell", name: "Barbell" }, { id: "long", name: "A long localized equipment name that needs to wrap on a narrow screen" }] } = {}) {
  const colors = Colors[scheme];
  const AuthContext = React.createContext({ token: "A", user: { id: "A" } });
  const EquipmentContext = React.createContext({ items: equipment });
  const calls = [];
  const pushes = [];
  let resets = 0, backs = 0;
  let listHandler = list ?? (async () => response);
  const mocks = { react: React, "react-native": { ...native, useWindowDimensions: () => ({ width: 375, fontScale }) }, "@expo/vector-icons": { Ionicons: "Ionicons" }, "@/constants/theme": { Colors, Fonts }, "@/hooks/use-color-scheme": { useColorScheme: () => scheme }, "@/hooks/use-theme-color": { useThemeColor: () => colors.text }, "@/utils/programDisplay": display };
  const { ThemedText } = load("components/themed-text.tsx", mocks);
  mocks["@/components/themed-text"] = { ThemedText };
  const { ProgramCard } = load("components/program/ProgramCard.tsx", mocks);
  const { default: Screen } = load("app/programs/index.tsx", { ...mocks, "@/components/program": { ProgramCard }, "expo-router": { useRouter: () => ({ push: (target) => pushes.push(target), back: () => backs++ }), useLocalSearchParams: () => route }, "@react-navigation/native": { useFocusEffect: (callback) => React.useEffect(callback, [callback]) }, "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@/utils/authContext": { AuthContext }, "@/utils/equipmentContext": { EquipmentContext }, "@/utils/programDraftContext": { useProgramDraft: () => ({ resetDraft: () => resets++ }) }, "@/services/programService": { listPrograms: (token, filters) => { calls.push({ token, ...filters }); return listHandler(token, filters); }, getActiveProgram: async () => active } });
  const element = (account = "A") => React.createElement(AuthContext.Provider, { value: { token: account, user: { id: account } } }, React.createElement(Screen));
  let tree;
  await act(async () => { tree = create(element()); });
  return { tree, calls, pushes, element, setList: (handler) => { listHandler = handler; }, get resets() { return resets; }, get backs() { return backs; } };
}

for (const scheme of ["light", "dark"]) {
  const colors = Colors[scheme];
  test(`${scheme}: catalog scopes and filters are neutral, checked and real 44-point controls`, async () => {
    const view = await catalog(scheme);
    const selected = host(view.tree, "program-filter-scope-all");
    assert.equal(selected.props.accessibilityState.selected, true);
    assert.notEqual(styleOf(selected).backgroundColor, colors.primaryButton);
    assert.equal(styleOf(selected).borderColor, colors.icon);
    assert.ok(styleOf(selected).minHeight >= 44);
    assert.ok(styleOf(selected, true).opacity < 1);
    assert.equal(selected.findByType("Ionicons").props.name, "checkmark");
    const label = selected.findByType("Text");
    assert.equal(styleOf(label).color, colors.text);
    assert.ok(contrast(styleOf(label).color, styleOf(selected).backgroundColor) >= 4.5);
    assert.ok(contrast(styleOf(selected).borderColor, styleOf(selected).backgroundColor) >= 3);
    const toggle = host(view.tree, "program-filters-toggle");
    assert.ok(styleOf(toggle).minHeight >= 44);
    await act(async () => toggle.props.onPress());
    assert.equal(host(view.tree, "program-filters-toggle").props.accessibilityState.expanded, true);
    const panel = host(view.tree, "program-filters-panel");
    for (const button of panel.findAllByType("Pressable")) assert.ok(styleOf(button).minHeight >= 44);
    for (const node of panel.findAllByType("Text")) {
      assert.equal(node.props.numberOfLines, undefined);
      assert.equal(node.props.maxFontSizeMultiplier, undefined);
      assert.equal(styleOf(node).lineHeight, undefined);
      if (["Goal", "Experience", "Schedule", "Equipment"].includes(textOf(node))) assert.ok(contrast(styleOf(node).color, colors.background) >= 4.5);
    }
    const scroll = host(view.tree, "program-catalog-scroll");
    assert.ok(scroll.findAll((node) => node === panel).length);
    assert.equal(view.tree.root.findAllByType("ScrollView").filter((node) => !node.props.horizontal).length, 1);
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: scope, goal, level, schedule and equipment retain exact query semantics`, async () => {
    const view = await catalog(scheme, { route: { recommended: "true", scope: "private" } });
    assert.equal(view.calls[0].scope, "private");
    assert.equal(view.calls[0].recommended, true);
    assert.match(textOf(view.tree.root), /Recommended for you/);
    await act(async () => host(view.tree, "program-filter-scope-system").props.onPress());
    assert.equal(view.calls.at(-1).scope, "system");
    assert.equal(view.calls.at(-1).recommended, undefined);
    await act(async () => host(view.tree, "program-filters-toggle").props.onPress());
    for (const [id, key, value] of [["goal-build-muscle", "goal", "build-muscle"], ["level-beginner", "level", "beginner"], ["frequency-3", "frequency", 3], ["duration-35", "maxDurationMinutes", 35]]) {
      await act(async () => host(view.tree, `program-filter-${id}`).props.onPress());
      assert.equal(view.calls.at(-1)[key], value);
      assert.equal(host(view.tree, `program-filter-${id}`).props.accessibilityState.selected, true);
      await act(async () => host(view.tree, `program-filter-${id}`).props.onPress());
      assert.equal(view.calls.at(-1)[key], undefined);
    }
    await act(async () => host(view.tree, "program-filter-equipment-barbell").props.onPress());
    await act(async () => host(view.tree, "program-filter-equipment-long").props.onPress());
    assert.deepEqual(Array.from(view.calls.at(-1).equipmentIds), ["barbell", "long"]);
    assert.match(host(view.tree, "program-filters-toggle").props.accessibilityLabel, /2 selected/);
    await act(async () => host(view.tree, "program-filter-equipment-barbell").props.onPress());
    assert.deepEqual(Array.from(view.calls.at(-1).equipmentIds), ["long"]);
    assert.equal(view.calls.at(-1).limit, 20);
    assert.equal(view.calls.at(-1).offset, 0);
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: program status, equipment, match reasons, back and draft-reset routes stay intact`, async () => {
    const view = await catalog(scheme, { response: { items: [summary("active"), summary("scheduled", { equipmentCompatible: false, missingEquipmentIds: ["barbell"] })], total: 2 }, active: { current: { templateId: "active" }, scheduled: { templateId: "scheduled" } } });
    assert.match(host(view.tree, "program-card-active").props.accessibilityLabel, /Active$/);
    assert.match(host(view.tree, "program-card-scheduled").props.accessibilityLabel, /1 item missing, Starts next week$/);
    assert.match(textOf(host(view.tree, "program-card-active")), /Matches your training days/);
    await act(async () => host(view.tree, "program-card-scheduled").props.onPress());
    assert.equal(view.pushes.at(-1).pathname, "/programs/[templateId]");
    assert.equal(view.pushes.at(-1).params.templateId, "scheduled");
    await act(async () => view.tree.root.findByProps({ accessibilityLabel: "Back from Programs" }).props.onPress());
    assert.equal(view.backs, 1);
    await act(async () => host(view.tree, "program-catalog-create").props.onPress());
    assert.equal(view.resets, 1);
    assert.equal(view.pushes.at(-1), "/programs/builder");
    assert.equal(styleOf(host(view.tree, "program-catalog-create")).height, 44);
    for (const pressed of [false, true]) assert.ok(contrast("#FFF", styleOf(host(view.tree, "program-catalog-create"), pressed).backgroundColor) >= 4.5);
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: pagination is deduplicated and busy with retryable partial failure`, async () => {
    const pending = deferred();
    const view = await catalog(scheme, { response: { items: [summary("one")], total: 3 } });
    view.setList(() => pending.promise);
    await act(async () => host(view.tree, "program-load-more").props.onPress());
    assert.equal(host(view.tree, "program-load-more").props.disabled, true);
    assert.equal(host(view.tree, "program-load-more").props.accessibilityState.busy, true);
    assert.equal(view.calls.at(-1).offset, 1);
    await act(async () => pending.resolve({ items: [summary("one"), summary("two")], total: 3 }));
    assert.equal(view.tree.root.findAll((node) => node.type === "Pressable" && node.props.testID === "program-card-one").length, 1);
    assert.ok(host(view.tree, "program-card-two"));
    const more = host(view.tree, "program-load-more");
    assert.ok(styleOf(more).minHeight >= 44);
    assert.equal(styleOf(more.findByType("Text")).color, colors.text);
    view.setList(async () => { throw new Error("offline"); });
    await act(async () => more.props.onPress());
    assert.ok(host(view.tree, "program-card-one"));
    assert.match(textOf(view.tree.root), /Programs couldn’t load/);
    const error = view.tree.root.findAllByType("Text").find((node) => node.props.accessibilityRole === "alert");
    assert.ok(contrast(styleOf(error).color, colors.background) >= 4.5);
    assert.equal(host(view.tree, "program-load-more").props.disabled, false);
    view.setList(async () => ({ items: [summary("three")], total: 3 }));
    await act(async () => host(view.tree, "program-load-more").props.onPress());
    assert.equal(view.calls.at(-1).offset, 2);
    assert.ok(host(view.tree, "program-card-three"));
    assert.equal(host(view.tree, "program-load-more"), undefined);
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: loading, empty Build and neutral error Retry stay reachable in the scroller`, async () => {
    const request = deferred();
    const view = await catalog(scheme, { list: () => request.promise });
    assert.ok(host(view.tree, "program-catalog-loading"));
    await act(async () => request.reject(new Error("offline")));
    const retry = host(view.tree, "program-catalog-error-action");
    assert.equal(retry.props.accessibilityLabel, "Retry");
    assert.ok(styleOf(retry).minHeight >= 44);
    assert.equal(styleOf(retry.findByType("Text")).color, colors.text);
    view.setList(async () => ({ items: [], total: 0 }));
    await act(async () => retry.props.onPress());
    const build = host(view.tree, "program-catalog-empty-action");
    assert.ok(build);
    for (const pressed of [false, true]) assert.ok(contrast(styleOf(build.findByType("Text")).color, styleOf(build, pressed).backgroundColor) >= 4.5);
    await act(async () => build.props.onPress());
    assert.equal(view.resets, 1);
    assert.equal(view.pushes.at(-1), "/programs/builder");
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: maximum text wraps filters and header inside one scroll owner without caps`, async () => {
    const view = await catalog(scheme, { fontScale: 3 });
    await act(async () => host(view.tree, "program-filters-toggle").props.onPress());
    const scrolls = view.tree.root.findAllByType("ScrollView");
    assert.equal(scrolls.filter((node) => !node.props.horizontal).length, 1);
    assert.equal(scrolls.filter((node) => node.props.horizontal).length, 1);
    const rootScroll = host(view.tree, "program-catalog-scroll");
    assert.ok(rootScroll.findAllByType("Text").some((node) => textOf(node) === "Programs"));
    assert.ok(rootScroll.findAll((node) => node.props.testID === "program-filters-panel").length);
    assert.ok(rootScroll.findAll((node) => node.props.testID === "program-card-one").length);
    const long = host(view.tree, "program-filter-equipment-long");
    assert.equal(styleOf(long).maxWidth, 335);
    assert.equal(styleOf(long.findByType("Text")).flexShrink, 1);
    assert.ok(long.findByType("Text").props.numberOfLines === undefined);
    for (const node of view.tree.root.findAllByType("Text")) {
      assert.ok(node.props.maxFontSizeMultiplier == null || node.props.maxFontSizeMultiplier === 0);
      assert.ok(node.props.numberOfLines == null || node.props.numberOfLines === 0);
    }
    assert.equal(styleOf(rootScroll).height, undefined);
    assert.ok(styleOf(host(view.tree, "program-filters-close")).minHeight >= 44);
    assert.equal(styleOf(host(view.tree, "program-filters-close").findByType("Text")).flexShrink, 1);
    const queryCount = view.calls.length;
    await act(async () => host(view.tree, "program-filters-close").props.onPress());
    assert.equal(host(view.tree, "program-filters-panel"), undefined);
    assert.equal(view.calls.length, queryCount);
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: delayed account and superseded-filter responses remain fenced`, async () => {
    const requests = [];
    const view = await catalog(scheme, { list: (token, filters) => { const request = deferred(); requests.push({ token, filters, ...request }); return request.promise; } });
    await act(async () => view.tree.update(view.element("B")));
    await act(async () => requests.find((request) => request.token === "A").resolve({ items: [summary("old-account")], total: 1 }));
    assert.equal(host(view.tree, "program-card-old-account"), undefined);
    await act(async () => requests.find((request) => request.token === "B").resolve({ items: [summary("new-account")], total: 1 }));
    assert.ok(host(view.tree, "program-card-new-account"));
    await act(async () => host(view.tree, "program-filter-scope-system").props.onPress());
    const system = requests.at(-1);
    await act(async () => host(view.tree, "program-filter-scope-private").props.onPress());
    const mine = requests.at(-1);
    await act(async () => system.resolve({ items: [summary("stale-filter")], total: 1 }));
    assert.equal(host(view.tree, "program-card-stale-filter"), undefined);
    await act(async () => mine.resolve({ items: [summary("mine", { scope: "private" })], total: 1 }));
    assert.ok(host(view.tree, "program-card-mine"));
    await act(async () => view.tree.unmount());
  });
}
