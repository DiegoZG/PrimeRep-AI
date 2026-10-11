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
function load(relative, mocks) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console: { ...console, warn() {} } }, { filename });
  return module.exports;
}
const native = { ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", View: "View", Text: "Text", ScrollView: "ScrollView", StyleSheet: { create: (styles) => styles }, Platform: { select: (values) => values.ios } };
const { Colors, Fonts } = load("constants/theme.ts", { "react-native": native });
const display = load("utils/programDisplay.ts", { "@/utils/localDate": { localDateIso: () => "2026-10-11" } });
class HttpError extends Error { constructor(status) { super("Request failed"); this.status = status; } }
const plain = (value) => JSON.parse(JSON.stringify(value));
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node, pressed = false) => flat(typeof node.props.style === "function" ? node.props.style({ pressed }) : node.props.style);
const textOf = (node) => typeof node === "string" ? node : (node?.children?.map(textOf).join(node.type === "Text" ? "" : " ") ?? "").replace(/\s+/g, " ").trim();
const host = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const label = (tree, name) => tree.root.findAll((node) => typeof node.type === "string" && node.props.accessibilityLabel === name)[0];
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const parentView = (node) => { let parent = node.parent; while (parent && parent.type !== "View") parent = parent.parent; return parent; };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tap = async (node) => { assert.equal(node.props.disabled ?? false, false); await act(async () => { node.props.onPress(); }); };
const unmount = async (tree) => { await act(async () => tree.unmount()); };
const program = (extra = {}) => ({ id: "program-one", scope: "system", name: "Full Body Foundation", description: "A balanced strength plan for your training week.", goal: "build-muscle", level: "beginner", frequency: 3, durationMinutes: 35, equipmentIds: ["barbell", "unknown_equipment"], equipmentCompatible: true, missingEquipmentIds: [], matchReasons: [], aliases: [], version: 1, days: [{ id: "day-one", title: "Full Body A", exercises: [{ id: "item-one", blockType: "main", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90, exercise: { name: "Barbell Squat" } }, { id: "item-two", blockType: "accessory", sets: 2, repsMin: 10, repsMax: 10, restSeconds: 60, exercise: { name: "Standing Calf Raise" } }] }], ...extra });
const active = (extra = {}) => ({ templateId: "program-one", requiresReview: false, ...extra });
function contrast(a, b) {
  const channels = (hex) => (hex.length === 4 ? hex.slice(1).split("").map((value) => value.repeat(2)) : hex.slice(1).match(/../g)).map((value) => parseInt(value, 16));
  const luminance = (hex) => channels(hex).map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function composite(tint, background) {
  const [, r, g, b, alpha] = tint.match(/rgba\((\d+),(\d+),(\d+),([.\d]+)\)/);
  const base = background.length === 4 ? background.slice(1).split("").map((value) => value.repeat(2)) : background.slice(1).match(/../g);
  return `#${[r, g, b].map((value, i) => Math.round(Number(value) * Number(alpha) + parseInt(base[i], 16) * (1 - Number(alpha))).toString(16).padStart(2, "0")).join("")}`;
}

async function detail(options = {}) {
  const scheme = options.scheme ?? "light";
  const colors = Colors[scheme];
  const AuthContext = React.createContext(null);
  const EquipmentContext = React.createContext({ items: [{ id: "barbell", name: "Olympic barbell" }] });
  const calls = { requests: [], active: [], routes: [], alerts: [], clones: [], drafts: [], archives: [], deactivations: [], cancellations: [], installed: [], synced: [] };
  const route = { templateId: options.templateId === undefined ? "program-one" : options.templateId };
  const syncCurrentWeek = async () => { calls.synced.push("sync"); };
  let currentOptions = options;
  const mocks = {
    react: React, "react-native": { ...native, Alert: { alert: (...args) => calls.alerts.push(args) }, useWindowDimensions: () => ({ width: 375, fontScale: options.fontScale ?? 1 }) },
    "@expo/vector-icons": { Ionicons: "Ionicons" }, "@/constants/theme": { Colors, Fonts },
    "@/hooks/use-color-scheme": { useColorScheme: () => scheme }, "@/hooks/use-theme-color": { useThemeColor: () => colors.text },
    "expo-router": { useLocalSearchParams: () => route, useRouter: () => ({ push: (target) => calls.routes.push(["push", plain(target)]), replace: (target) => calls.routes.push(["replace", target]), back: () => calls.routes.push(["back"]) }) },
    "@react-navigation/native": { useFocusEffect: (callback) => React.useEffect(callback, [callback]) },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@/utils/authContext": { AuthContext }, "@/utils/equipmentContext": { EquipmentContext },
    "@/utils/programDraftContext": { useProgramDraft: () => ({ loadProgram: (value) => calls.drafts.push(plain(value)) }) },
    "@/hooks/use-workout-week": { useWorkoutWeek: () => ({ currentWeekStart: "2026-10-05", syncCurrentWeek, installWeekPlan: (value) => calls.installed.push(plain(value)) }) },
    "@/utils/programDisplay": display, "@/services/httpClient": { HttpError }, "@/services/workoutWeekService": { mapApiWeekPlan: (value) => ({ mapped: value }) },
    "@/services/programService": {
      getProgram: async (token, id) => { calls.requests.push([token, id]); return currentOptions.get ? currentOptions.get(token, id) : currentOptions.program ?? program(); },
      getActiveProgram: async (token, date) => { calls.active.push([token, date]); return currentOptions.getActive ? currentOptions.getActive(token) : currentOptions.active ?? { current: null, scheduled: null }; },
      cloneProgram: async (token, id) => { calls.clones.push([token, id]); return currentOptions.clone ? currentOptions.clone() : program({ id: "copy-one", scope: "private" }); },
      archiveProgram: async (token, id) => { calls.archives.push([token, id]); if (currentOptions.archive) await currentOptions.archive(); },
      deactivateProgram: async (token, payload) => { calls.deactivations.push([token, plain(payload)]); return currentOptions.deactivate ? currentOptions.deactivate() : { week: "rebuilt" }; },
      cancelScheduledProgram: async (token, date) => { calls.cancellations.push([token, date]); if (currentOptions.cancel) await currentOptions.cancel(); },
    },
  };
  const { ThemedText } = load("components/themed-text.tsx", mocks);
  mocks["@/components/themed-text"] = { ThemedText };
  mocks["@/components/workout/WorkoutText"] = load("components/workout/WorkoutText.tsx", mocks);
  const { default: Screen } = load("app/programs/[templateId].tsx", mocks);
  const element = (token = options.token === undefined ? "A" : options.token, userId = token) => React.createElement(AuthContext.Provider, { value: { token, user: token ? { id: userId } : null } }, React.createElement(Screen));
  let tree;
  await act(async () => { tree = create(element()); });
  return { tree, calls, colors, element, setOptions: (next) => { currentOptions = { ...currentOptions, ...next }; }, setRoute: (id) => { route.templateId = id; } };
}

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: program detail metadata and day sequence are neutral and readable`, async () => {
    const view = await detail({ scheme });
    assert.match(textOf(view.tree.root), /PrimeRep program/);
    assert.match(textOf(view.tree.root), /3 days per week · 35 min/);
    assert.match(textOf(view.tree.root), /Olympic barbell, unknown equipment/);
    const day = host(view.tree, "program-day-day-one");
    const number = text(view.tree, "1");
    assert.equal(styleOf(number).color, view.colors.text);
    assert.equal(styleOf(parentView(number)).backgroundColor, view.colors.background);
    assert.notEqual(styleOf(parentView(number)).backgroundColor, view.colors.primaryButton);
    assert.equal(styleOf(number).fontVariant[0], "tabular-nums");
    for (const content of ["A balanced strength plan for your training week.", "3 days per week · 35 min", "Build muscle", "Beginner", "2 exercises", "3 × 8–12 · 90s rest", "2 × 10 · 60s rest", "main", "accessory", "Olympic barbell, unknown equipment"]) {
      const node = text(view.tree, content);
      assert.ok(node, content);
      assert.equal(styleOf(node).color, view.colors.icon);
      assert.ok(contrast(styleOf(node).color, day.findAllByType("Text").includes(node) ? view.colors.inputBackground : view.colors.background) >= 4.5, content);
    }
    assert.equal(view.calls.requests.length, 1);
    assert.deepEqual(view.calls.active[0], ["A", "2026-10-11"]);
    assert.equal(view.calls.synced.length, 1);
    await unmount(view.tree);
  });

  test(`${scheme}: Use is the opaque main action and Customize remains neutral`, async () => {
    const view = await detail({ scheme });
    const use = host(view.tree, "program-activate");
    const customize = host(view.tree, "program-customize");
    for (const pressed of [false, true]) {
      assert.equal(styleOf(use, pressed).backgroundColor, view.colors.primaryButton);
      assert.equal(styleOf(use, pressed).opacity, undefined);
      assert.ok(contrast(styleOf(use.findByType("Text")).color, styleOf(use, pressed).backgroundColor) >= 4.5);
      assert.notEqual(styleOf(customize, pressed).backgroundColor, view.colors.primaryButton);
      assert.ok(contrast(styleOf(customize.findByType("Text")).color, styleOf(customize, pressed).backgroundColor) >= 4.5);
    }
    await tap(use);
    assert.deepEqual(view.calls.routes.at(-1), ["push", { pathname: "/programs/activate", params: { templateId: "program-one" } }]);
    await tap(host(view.tree, "program-detail-back"));
    assert.deepEqual(view.calls.routes.at(-1), ["back"]);
    assert.equal(host(view.tree, "program-detail-back").props.accessibilityLabel, "Back from Full Body Foundation");
    await unmount(view.tree);
  });

  test(`${scheme}: real current and scheduled badges keep composited contrast and equipment-review routes`, async () => {
    const view = await detail({ scheme, active: { current: active({ requiresReview: true }), scheduled: active({ requiresReview: true }) } });
    for (const [id, content, expected] of [["program-active-badge", "Current program", scheme === "light" ? "#127536" : "#6EDB91"], ["program-scheduled-badge", "Starts next week", scheme === "light" ? "#583BD0" : "#B4A5FF"]]) {
      const badge = host(view.tree, id);
      assert.equal(styleOf(text(view.tree, content)).color, expected);
      assert.ok(contrast(expected, composite(styleOf(badge).backgroundColor, view.colors.background)) >= 4.5);
      assert.ok(contrast(badge.findByType("Ionicons").props.color, composite(styleOf(badge).backgroundColor, view.colors.background)) >= 3);
    }
    assert.equal(host(view.tree, "program-activate"), undefined);
    await tap(host(view.tree, "program-review-equipment"));
    assert.deepEqual(view.calls.routes.at(-1), ["push", { pathname: "/programs/activate", params: { templateId: "program-one", applyMode: "now", review: "equipment" } }]);
    await tap(host(view.tree, "program-review-scheduled-equipment"));
    assert.deepEqual(view.calls.routes.at(-1), ["push", { pathname: "/programs/activate", params: { templateId: "program-one", applyMode: "next-week", review: "equipment" } }]);
    for (const id of ["program-deactivate", "program-cancel-scheduled"]) {
      const button = host(view.tree, id);
      assert.equal(styleOf(button).borderColor, view.colors.inputBorder);
      for (const pressed of [false, true]) assert.ok(contrast(styleOf(button.findByType("Text")).color, styleOf(button, pressed).backgroundColor) >= 4.5);
    }
    await unmount(view.tree);
  });

  test(`${scheme}: private Edit opens the same draft and Archive stays reachable and guarded`, async () => {
    const value = program({ scope: "private", equipmentIds: [] });
    const view = await detail({ scheme, program: value });
    assert.equal(textOf(host(view.tree, "program-detail-source")), "Your program");
    assert.match(textOf(view.tree.root), /Bodyweight — no equipment required/);
    assert.equal(host(view.tree, "program-customize"), undefined);
    await tap(host(view.tree, "program-edit"));
    assert.equal(view.calls.drafts[0].id, value.id);
    assert.deepEqual(view.calls.routes[0], ["push", "/programs/builder"]);
    await tap(host(view.tree, "program-archive"));
    assert.equal(view.calls.alerts[0][0], "Archive program?");
    assert.match(view.calls.alerts[0][1], /completed history stay intact/);
    assert.equal(view.calls.alerts[0][2][0].style, "cancel");
    assert.equal(view.calls.archives.length, 0);
    await act(async () => view.calls.alerts[0][2][1].onPress());
    assert.deepEqual(view.calls.archives, [["A", value.id]]);
    assert.deepEqual(view.calls.routes.at(-1), ["replace", "/programs"]);
    await unmount(view.tree);
    for (const state of [{ current: active(), scheduled: null }, { current: null, scheduled: active() }]) {
      const guarded = await detail({ scheme, program: value, active: state });
      assert.equal(host(guarded.tree, "program-archive").props.disabled, true);
      assert.equal(host(guarded.tree, "program-archive").props.accessibilityState.disabled, true);
      assert.ok(contrast(styleOf(host(guarded.tree, "program-archive").findByType("Text")).color, guarded.colors.background) >= 4.5);
      await unmount(guarded.tree);
    }
  });

  test(`${scheme}: maximum text remains uncapped in one scroll with real targets and safe-area spacing`, async () => {
    const name = "A lengthy personalized full body program with strength and conditioning";
    const view = await detail({ scheme, fontScale: 3.1, program: program({ name, scope: "private" }) });
    assert.equal(view.tree.root.findAllByType("ScrollView").length, 1);
    assert.equal(text(view.tree, "Program"), undefined);
    const scroll = host(view.tree, "program-detail-scroll");
    assert.ok(scroll.findAllByType("Text").some((node) => textOf(node) === name));
    assert.equal(textOf(host(view.tree, "program-detail-source")), "Your program");
    assert.deepEqual(Array.from(view.tree.root.findByType("SafeAreaView").props.edges), ["top", "bottom"]);
    for (const node of view.tree.root.findAllByType("Text")) {
      assert.equal(node.props.numberOfLines, undefined);
      assert.equal(node.props.maxFontSizeMultiplier, undefined);
      assert.equal(styleOf(node).lineHeight, undefined);
    }
    for (const node of view.tree.root.findAllByType("Pressable")) {
      assert.ok((styleOf(node).minHeight ?? styleOf(node).height) >= 44);
      if (styleOf(node).width) assert.ok(styleOf(node).width >= 44);
    }
    const exercise = parentView(text(view.tree, "main"));
    assert.equal(styleOf(exercise).flexDirection, "column");
    assert.equal(styleOf(exercise).alignItems, "stretch");
    await unmount(view.tree);
  });

  test(`${scheme}: loading and retry are independent neutral scrollable states with unchanged actions`, async () => {
    const request = deferred();
    const view = await detail({ scheme, get: () => request.promise });
    assert.ok(host(view.tree, "program-detail-loading"));
    assert.equal(view.tree.root.findByType("ActivityIndicator").props.color, view.colors.icon);
    assert.equal(view.tree.root.findAllByType("ScrollView").length, 1);
    await act(async () => request.reject(new Error("Offline")));
    assert.ok(host(view.tree, "program-detail-error"));
    assert.match(textOf(view.tree.root), /Check your connection and try again/);
    const errorIcon = view.tree.root.findAllByType("Ionicons").find((node) => node.props.name === "cloud-offline-outline");
    assert.equal(errorIcon.props.color, scheme === "dark" ? "#FF8B82" : "#B42318");
    assert.ok(contrast(errorIcon.props.color, view.colors.background) >= 3);
    const retry = label(view.tree, "Retry");
    for (const pressed of [false, true]) {
      assert.notEqual(styleOf(retry, pressed).backgroundColor, view.colors.primaryButton);
      assert.ok(contrast(styleOf(retry.findByType("Text")).color, styleOf(retry, pressed).backgroundColor) >= 4.5);
    }
    view.setOptions({ get: async () => program() });
    await tap(retry);
    assert.ok(host(view.tree, "program-activate"));
    assert.equal(view.calls.requests.length, 2);
    await unmount(view.tree);
  });
}

test("Customize keeps a busy neutral state, prevents UI submissions and loads a private copy", async () => {
  const copy = deferred();
  const view = await detail({ clone: () => copy.promise });
  await tap(host(view.tree, "program-customize"));
  for (const id of ["program-customize", "program-activate", "program-detail-back"]) assert.equal(host(view.tree, id).props.disabled, true);
  assert.equal(host(view.tree, "program-customize").props.accessibilityState.busy, true);
  assert.match(textOf(view.tree.root), /Creating copy…/);
  const disabledUse = host(view.tree, "program-activate");
  assert.equal(styleOf(disabledUse).backgroundColor, view.colors.inputBackground);
  assert.ok(contrast(styleOf(disabledUse.findByType("Text")).color, styleOf(disabledUse).backgroundColor) >= 4.5);
  await act(async () => copy.resolve(program({ id: "new-copy", scope: "private" })));
  assert.deepEqual(view.calls.clones, [["A", "program-one"]]);
  assert.equal(view.calls.drafts[0].id, "new-copy");
  assert.deepEqual(view.calls.routes.at(-1), ["push", "/programs/builder"]);
  await unmount(view.tree);
});

test("Failed Customize preserves the program and offers the original retryable action", async () => {
  const view = await detail({ clone: async () => { throw new Error("Offline"); } });
  await tap(host(view.tree, "program-customize"));
  assert.match(textOf(view.tree.root), /The program couldn’t be copied. Try again./);
  assert.equal(host(view.tree, "program-customize").props.disabled, false);
  assert.equal(view.calls.routes.length, 0);
  view.setOptions({ clone: async () => program({ id: "retry-copy" }) });
  await tap(host(view.tree, "program-customize"));
  assert.equal(view.calls.drafts[0].id, "retry-copy");
  await unmount(view.tree);
});

test("Stop program keeps its confirmation, week payload, mapped installation and scheduled invalidation", async () => {
  const view = await detail({ active: { current: active(), scheduled: active({ templateId: "another-program" }) } });
  await tap(host(view.tree, "program-deactivate"));
  assert.match(view.calls.alerts[0][1], /also cancels the program scheduled to start next week/);
  assert.equal(view.calls.deactivations.length, 0);
  await act(async () => view.calls.alerts[0][2][1].onPress());
  assert.deepEqual(view.calls.deactivations, [["A", { weekStart: "2026-10-05", effectiveDate: "2026-10-11" }]]);
  assert.deepEqual(view.calls.installed, [{ mapped: { week: "rebuilt" } }]);
  assert.equal(host(view.tree, "program-active-badge"), undefined);
  assert.ok(host(view.tree, "program-activate"));
  assert.equal(view.calls.routes.length, 0);
  await unmount(view.tree);
});

test("Cancel scheduled program preserves current program and uses the existing date payload", async () => {
  const view = await detail({ active: { current: active(), scheduled: active() } });
  await tap(host(view.tree, "program-cancel-scheduled"));
  assert.equal(view.calls.alerts[0][2][0].text, "Keep it");
  assert.match(view.calls.alerts[0][1], /current program and this week’s workouts will stay unchanged/);
  await act(async () => view.calls.alerts[0][2][1].onPress());
  assert.deepEqual(view.calls.cancellations, [["A", "2026-10-11"]]);
  assert.ok(host(view.tree, "program-active-badge"));
  assert.equal(host(view.tree, "program-scheduled-badge"), undefined);
  assert.equal(host(view.tree, "program-activate"), undefined);
  assert.equal(view.calls.installed.length, 0);
  await unmount(view.tree);
});

test("Archive conflict and mutation failures retain their exact messages and release disabled actions", async () => {
  const view = await detail({ program: program({ scope: "private" }), archive: async () => { throw new HttpError(409); } });
  await tap(host(view.tree, "program-archive"));
  await act(async () => view.calls.alerts.at(-1)[2][1].onPress());
  assert.match(textOf(view.tree.root), /Stop using or replace this active or scheduled program before archiving it/);
  assert.equal(host(view.tree, "program-archive").props.disabled, false);
  assert.equal(view.calls.routes.length, 0);
  view.setOptions({ archive: async () => { throw new Error("Offline"); } });
  await tap(host(view.tree, "program-archive"));
  await act(async () => view.calls.alerts.at(-1)[2][1].onPress());
  assert.match(textOf(view.tree.root), /The program couldn’t be archived. Try again./);
  await unmount(view.tree);
  for (const [id, option, expected] of [["program-deactivate", "deactivate", "The active program couldn’t be stopped. Try again."], ["program-cancel-scheduled", "cancel", "The scheduled program couldn’t be canceled. Try again."]]) {
    const failed = await detail({ active: { current: active(), scheduled: active() }, [option]: async () => { throw new Error("Offline"); } });
    await tap(host(failed.tree, id));
    await act(async () => failed.calls.alerts.at(-1)[2][1].onPress());
    assert.ok(text(failed.tree, expected));
    assert.equal(host(failed.tree, id).props.disabled, false);
    assert.equal(failed.calls.installed.length, 0);
    await unmount(failed.tree);
  }
});

test("Delayed program responses cannot appear after account or route switches", async () => {
  const stale = deferred();
  const view = await detail({ get: (token) => token === "A" ? stale.promise : program({ id: "B", name: "Account B program" }) });
  await act(async () => view.tree.update(view.element("B")));
  assert.ok(text(view.tree, "Account B program"));
  await act(async () => stale.resolve(program({ name: "Stale account A program" })));
  assert.equal(text(view.tree, "Stale account A program"), undefined);
  assert.deepEqual(view.calls.requests.map(([token]) => token), ["A", "B"]);
  const routeRequest = deferred();
  view.setOptions({ get: () => routeRequest.promise });
  view.setRoute("new-route");
  await act(async () => view.tree.update(view.element("B")));
  assert.ok(host(view.tree, "program-detail-loading"));
  assert.equal(text(view.tree, "Account B program"), undefined);
  await act(async () => routeRequest.resolve(program({ id: "new-route", name: "New route program" })));
  assert.ok(text(view.tree, "New route program"));
  await unmount(view.tree);
});

test("In-flight clone and destructive completion cannot navigate or install a week for another account", async () => {
  for (const action of ["clone", "deactivate", "archive", "cancel"]) {
    const pending = deferred();
    const options = { [action]: () => pending.promise, program: program({ scope: action === "archive" ? "private" : "system" }), active: action === "deactivate" || action === "cancel" ? { current: action === "deactivate" ? active() : null, scheduled: action === "cancel" ? active() : null } : undefined };
    const view = await detail(options);
    const id = { clone: "program-customize", deactivate: "program-deactivate", archive: "program-archive", cancel: "program-cancel-scheduled" }[action];
    await tap(host(view.tree, id));
    if (action !== "clone") await act(async () => { void view.calls.alerts.at(-1)[2][1].onPress(); });
    view.setOptions({ program: program({ id: "B", name: "Account B program" }), active: { current: null, scheduled: null } });
    await act(async () => view.tree.update(view.element("B")));
    await act(async () => pending.resolve(program({ id: "stale-copy" })));
    assert.ok(text(view.tree, "Account B program"));
    assert.equal(view.calls.routes.length, 0);
    assert.equal(view.calls.drafts.length, 0);
    assert.equal(view.calls.installed.length, 0);
    await unmount(view.tree);
  }
});

test("Missing authentication or template keeps the existing sign-in error without requests", async () => {
  for (const options of [{ token: null }, { templateId: null }]) {
    const view = await detail(options);
    assert.ok(host(view.tree, "program-detail-error"));
    assert.match(textOf(view.tree.root), /Sign in again to view this program/);
    assert.equal(view.calls.requests.length, 0);
    await unmount(view.tree);
  }
});
