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
const base = "e6e13d361b9212fbd754b1b3e53af0d182bfdd13";
function load(relative, mocks, globals = {}) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console: { ...console, warn() {} }, ...globals }, { filename });
  return module.exports;
}
const native = { Pressable: "Pressable", View: "View", Text: "Text", TextInput: "TextInput", ScrollView: "ScrollView", Modal: "Modal", KeyboardAvoidingView: "KeyboardAvoidingView", TouchableWithoutFeedback: "TouchableWithoutFeedback", StyleSheet: { create: (styles) => styles, absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } }, Platform: { OS: "ios", select: (values) => values.ios } };
const { Colors, Fonts } = load("constants/theme.ts", { "react-native": native });
const display = load("utils/programDisplay.ts", { "@/utils/localDate": { localDateIso: () => "2026-10-11" } });
class HttpError extends Error { constructor(status) { super("Request failed"); this.status = status; } }
const plain = (value) => JSON.parse(JSON.stringify(value));
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node, pressed = false) => flat(typeof node.props.style === "function" ? node.props.style({ pressed }) : node.props.style);
const textOf = (node) => typeof node === "string" ? node : (node?.children?.map(textOf).join(node.type === "Text" ? "" : " ") ?? "").replace(/\s+/g, " ").trim();
const host = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const gestureOf = (node) => { let parent = node; while (parent && parent.type !== "GestureDetector") parent = parent.parent; assert.ok(parent); return parent.props.gesture; };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tap = async (node) => { assert.ok(node); assert.equal(node.props.disabled ?? false, false); await act(async () => { node.props.onPress(); }); };
const change = async (node, value) => { await act(async () => node.props.onChangeText(value)); };
const unmount = async (tree) => { await act(async () => tree.unmount()); };
const item = (extra = {}) => ({ id: "item-one", position: 0, exerciseId: "squat", exercise: { id: "squat", name: "Barbell Squat" }, blockType: "main", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90, cue: "Controlled reps", ...extra });
const program = (extra = {}) => ({ id: "program-one", scope: "private", version: 3, name: "My strength plan", description: "A balanced plan for my training week.", goal: "build-muscle", level: "beginner", durationMinutes: 35, aliases: ["strength"], days: [{ id: "day-one", position: 0, title: "Upper body", dayType: "upper", exercises: [item()] }, { id: "day-two", position: 1, title: "Lower body", dayType: "lower", exercises: [item({ id: "item-two", exerciseId: "bridge", exercise: { id: "bridge", name: "Glute Bridge" } })] }], ...extra });
function contrast(a, b) {
  const channels = (hex) => (hex.length === 4 ? hex.slice(1).split("").map((value) => value.repeat(2)) : hex.slice(1).match(/../g)).map((value) => parseInt(value, 16) / 255);
  const luminance = (hex) => channels(hex).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

async function builder(options = {}) {
  let current = options;
  const scheme = options.scheme ?? "light";
  const colors = Colors[scheme];
  const AuthContext = React.createContext(null);
  const calls = { routes: [], creates: [], updates: [], loads: [], alerts: [], keyboard: [], haptics: [], announcements: [], focus: [], timing: [], gestures: [] };
  const timers = new Map();
  let timerId = 0;
  let context;
  const globals = { setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; }, clearTimeout: (id) => timers.delete(id) };
  const mocks = {
    react: React,
    "react-native": { ...native, useWindowDimensions: () => ({ width: options.width ?? 375, fontScale: options.fontScale ?? 1 }), Alert: { alert: (...args) => calls.alerts.push(args) }, Keyboard: { dismiss: () => calls.keyboard.push("dismiss") }, findNodeHandle: () => 7, AccessibilityInfo: { announceForAccessibility: (value) => calls.announcements.push(value), isScreenReaderEnabled: async () => current.screenReader ?? false, setAccessibilityFocus: (node) => calls.focus.push(node) } },
    "@expo/vector-icons": { Ionicons: "Ionicons" }, "@/constants/theme": { Colors, Fonts },
    "@/hooks/use-color-scheme": { useColorScheme: () => scheme }, "@/hooks/use-theme-color": { useThemeColor: () => colors.text },
    "expo-router": { useRouter: () => ({ push: (target) => calls.routes.push(["push", plain(target)]), replace: (target) => calls.routes.push(["replace", plain(target)]), back: () => calls.routes.push(["back"]) }) },
    "expo-haptics": { ImpactFeedbackStyle: { Light: "Light" }, impactAsync: async (style) => { calls.haptics.push(style); } },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@/utils/authContext": { AuthContext }, "./authContext": { AuthContext },
    "react-native-worklets": { scheduleOnRN: (callback, ...args) => callback(...args) },
    "react-native-reanimated": { default: { View: "AnimatedView" }, __esModule: true, useSharedValue: (initial) => React.useRef({ value: initial }).current, useReducedMotion: () => options.reduceMotion ?? false, withTiming: (value, config) => { calls.timing.push([value, plain(config)]); return value; }, interpolateColor: (value, range, colors) => value ? colors[1] : colors[0], useAnimatedStyle: (callback) => callback(), ReduceMotion: { System: "system" }, LinearTransition: { duration: (duration) => ({ reduceMotion: (reduceMotion) => ({ duration, reduceMotion }) }) } },
    "react-native-gesture-handler": { GestureDetector: "GestureDetector", Gesture: { Pan: () => { const gesture = { callbacks: {}, minDistance(value) { this.distance = value; return this; }, onStart(callback) { this.callbacks.start = callback; return this; }, onUpdate(callback) { this.callbacks.update = callback; return this; }, onEnd(callback) { this.callbacks.end = callback; return this; }, onFinalize(callback) { this.callbacks.finalize = callback; return this; } }; calls.gestures.push(gesture); return gesture; } } },
    "@/utils/programDisplay": display, "@/services/httpClient": { HttpError },
    "@/services/programService": {
      createProgram: async (token, payload) => { calls.creates.push([token, plain(payload)]); return current.create ? current.create(payload) : program({ ...payload, id: "saved-one" }); },
      updateProgram: async (token, id, payload) => { calls.updates.push([token, id, plain(payload)]); return current.update ? current.update(payload) : program({ ...payload, id }); },
    },
  };
  const actualDraft = load("utils/programDraftContext.tsx", mocks);
  mocks["@/utils/programDraftContext"] = { useProgramDraft: () => { const value = actualDraft.useProgramDraft(); return { ...value, loadProgram: (saved) => { calls.loads.push(plain(saved)); value.loadProgram(saved); } }; } };
  mocks["@/components/themed-text"] = load("components/themed-text.tsx", mocks);
  mocks["@/components/workout/WorkoutText"] = load("components/workout/WorkoutText.tsx", mocks);
  mocks["@/components/program"] = load("components/program/ProgramHeader.tsx", mocks);
  const { default: Screen } = load("app/programs/builder.tsx", mocks, globals);
  function Probe() { context = actualDraft.useProgramDraft(); return null; }
  function Boot() {
    const value = actualDraft.useProgramDraft();
    const [stage, setStage] = React.useState(0);
    React.useEffect(() => {
      if (stage === 0) setStage(1);
      else if (stage === 1) { if (!options.empty) value.loadProgram(options.program ?? program(), options.asCopy ?? false); setStage(2); }
    }, [stage]);
    return React.createElement(React.Fragment, null, React.createElement(Probe), stage === 2 && React.createElement(Screen));
  }
  const element = (token = options.token === undefined ? "A" : options.token, userId = token) => React.createElement(AuthContext.Provider, { value: { token, user: token ? { id: userId } : null } }, React.createElement(actualDraft.ProgramDraftProvider, null, React.createElement(Boot)));
  let tree;
  await act(async () => { tree = create(element(), { createNodeMock: () => ({}) }); });
  return { tree, calls, colors, element, get draft() { return context.draft; }, setOptions: (next) => { current = { ...current, ...next }; }, updateDraft: async (values) => { await act(async () => context.updateMetadata(values)); }, runTimers: async (maximum = Infinity) => { await act(async () => { for (const [id, timer] of [...timers]) if (timer.delay <= maximum) { timers.delete(id); timer.callback(); } }); }, timers };
}

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: selected choices stay neutral, explicit, readable and 44-point`, async () => {
    const view = await builder({ scheme });
    for (const id of ["program-goal-build-muscle", "program-level-beginner", "program-duration-35"]) {
      const selected = host(view.tree, id);
      assert.equal(selected.props.accessibilityState.selected, true);
      assert.ok(selected.findByType("Ionicons"));
      assert.ok(styleOf(selected).minHeight >= 44);
      for (const pressed of [false, true]) {
        const style = styleOf(selected, pressed);
        assert.notEqual(style.backgroundColor, view.colors.primaryButton);
        assert.equal(style.opacity, undefined);
        assert.ok(contrast(style.borderColor, style.backgroundColor) >= 3);
        assert.ok(contrast(styleOf(selected.findByType("Text")).color, style.backgroundColor) >= 4.5);
        assert.ok(contrast(selected.findByType("Ionicons").props.color, style.backgroundColor) >= 3);
      }
    }
    await tap(host(view.tree, "program-duration-60"));
    assert.equal(view.draft.durationMinutes, 60);
    assert.equal(host(view.tree, "program-duration-35").props.accessibilityState.selected, false);
    await unmount(view.tree);
  });

  test(`${scheme}: inputs, helper text, day numbering and Add stay neutral without faded values`, async () => {
    const view = await builder({ scheme });
    for (const id of ["program-name-input", "program-description-input", "program-aliases-input"]) {
      const field = host(view.tree, id);
      assert.equal(styleOf(field).color, view.colors.text);
      assert.equal(field.props.placeholderTextColor, view.colors.icon);
      assert.ok(styleOf(field).minHeight >= 44);
    }
    for (const content of ["Separate alternate names with commas.", "1 exercise", "Repeats every week"]) {
      const node = text(view.tree, content);
      assert.ok(node, content);
      assert.equal(styleOf(node).color, view.colors.icon);
      assert.ok(contrast(styleOf(node).color, view.colors.inputBackground) >= 4.5);
    }
    assert.equal(styleOf(text(view.tree, "1")).color, view.colors.text);
    const add = host(view.tree, "program-add-day");
    assert.ok(styleOf(add).minWidth >= 44 && styleOf(add).minHeight >= 44);
    for (const pressed of [false, true]) assert.notEqual(styleOf(add, pressed).backgroundColor, view.colors.primaryButton);
    await unmount(view.tree);
  });

  test(`${scheme}: options preserve positions, disable boundary moves and retain readable destruction`, async () => {
    const view = await builder({ scheme });
    await tap(host(view.tree, "program-day-menu-1"));
    assert.equal(view.calls.keyboard.at(-1), "dismiss");
    assert.equal(host(view.tree, "program-day-move-earlier").props.disabled, true);
    assert.equal(host(view.tree, "program-day-move-later").props.disabled, false);
    assert.match(textOf(view.tree.root), /Position 1 of 2/);
    for (const id of ["program-day-move-earlier", "program-day-move-later", "program-day-request-remove", "program-day-options-cancel"]) {
      const action = host(view.tree, id);
      assert.ok(styleOf(action).minHeight >= 44);
      for (const pressed of [false, true]) { assert.equal(styleOf(action, pressed).opacity, undefined); assert.ok(contrast(styleOf(action.findByType("Text")).color, styleOf(action, pressed).backgroundColor) >= 4.5); }
    }
    assert.equal(styleOf(host(view.tree, "program-day-request-remove").findByType("Text")).color, scheme === "light" ? "#B42318" : "#FF8B82");
    assert.ok(host(view.tree, "program-day-options-scroll"));
    await tap(host(view.tree, "program-day-options-cancel"));
    assert.equal(view.draft.days.length, 2);
    await unmount(view.tree);
  });

  test(`${scheme}: large text uses native metrics, wrapping rows and scrollable bounded options`, async () => {
    const longName = "Upper body strength and controlled compound movements";
    const view = await builder({ scheme, fontScale: 3.1, width: 320, program: program({ days: [{ ...program().days[0], title: longName }] }) });
    assert.ok(host(view.tree, "program-builder-title"));
    assert.equal(text(view.tree, longName).props.numberOfLines, undefined);
    for (const node of view.tree.root.findAllByType("Text")) { assert.equal(node.props.maxFontSizeMultiplier, undefined); assert.equal(styleOf(node).lineHeight, undefined); }
    const main = host(view.tree, "program-builder-day-open-1");
    assert.ok(styleOf(main).minHeight >= 44);
    const card = host(view.tree, "program-builder-day-1");
    const row = card.findAllByType("View").find((node) => styleOf(node).paddingHorizontal === 7 && styleOf(node).flexDirection === "column");
    assert.ok(row);
    for (const id of ["program-day-handle-1", "program-day-menu-1", "program-builder-back"]) assert.ok(styleOf(host(view.tree, id)).minHeight >= 44 || styleOf(host(view.tree, id)).height >= 44);
    await tap(host(view.tree, "program-day-menu-1"));
    const sheet = host(view.tree, "program-day-options-scroll").parent;
    assert.equal(styleOf(sheet).maxHeight, "85%");
    assert.equal(text(view.tree, longName).props.numberOfLines, undefined);
    await unmount(view.tree);
  });

  test(`${scheme}: Create/Save is the only filled main action and busy controls remain readable`, async () => {
    const pending = deferred();
    const view = await builder({ scheme, update: () => pending.promise });
    const save = host(view.tree, "program-save");
    for (const pressed of [false, true]) {
      assert.equal(styleOf(save, pressed).backgroundColor, view.colors.primaryButton);
      assert.ok(contrast(styleOf(save.findByType("Text")).color, styleOf(save, pressed).backgroundColor) >= 4.5);
      assert.deepEqual(plain(styleOf(save, pressed).transform), [{ scale: pressed ? 0.99 : 1 }]);
    }
    await tap(save);
    const busy = host(view.tree, "program-save");
    assert.equal(busy.props.disabled, true);
    assert.equal(busy.props.accessibilityState.busy, true);
    assert.equal(styleOf(busy).opacity, undefined);
    assert.equal(styleOf(busy).backgroundColor, view.colors.inputBackground);
    for (const pressed of [false, true]) assert.deepEqual(plain(styleOf(busy, pressed).transform), [{ scale: 1 }]);
    assert.ok(contrast(styleOf(busy.findByType("Text")).color, styleOf(busy).backgroundColor) >= 4.5);
    assert.equal(host(view.tree, "program-builder-back").props.disabled, true);
    await act(async () => busy.props.onPress());
    assert.equal(view.calls.updates.length, 1);
    await act(async () => pending.reject(new Error("offline")));
    for (const pressed of [false, true]) assert.deepEqual(plain(styleOf(host(view.tree, "program-save"), pressed).transform), [{ scale: pressed ? 0.99 : 1 }]);
    const error = host(view.tree, "program-builder-error");
    assert.equal(styleOf(error).color, scheme === "light" ? "#B42318" : "#FF8B82");
    assert.ok(contrast(styleOf(error).color, view.colors.background) >= 4.5);
    await unmount(view.tree);
  });
}

test("Keyboard outside/drag dismissal preserves text and Save runs on its first handled tap", async () => {
  const view = await builder();
  const scroll = host(view.tree, "program-builder-scroll");
  assert.equal(scroll.props.keyboardShouldPersistTaps, "always");
  assert.equal(scroll.props.keyboardDismissMode, "interactive");
  await change(host(view.tree, "program-name-input"), "My revised plan");
  const wrappers = view.tree.root.findAllByType("TouchableWithoutFeedback");
  assert.equal(wrappers.length, 2);
  for (const wrapper of wrappers) assert.equal(wrapper.props.accessible, false);
  const wrapper = wrappers[1];
  await act(async () => wrapper.props.onPress());
  assert.equal(view.draft.name, "My revised plan");
  const header = host(view.tree, "program-builder-header");
  let count = view.calls.keyboard.length;
  await act(async () => header.props.onTouchEnd({ target: 1, currentTarget: 2 }));
  assert.equal(view.calls.keyboard.length, count);
  await act(async () => header.props.onTouchEnd({ target: 2, currentTarget: 2 }));
  assert.equal(view.calls.keyboard.length, count + 1);
  count = view.calls.keyboard.length;
  await act(async () => wrappers[0].props.onPress());
  assert.equal(view.calls.keyboard.length, count + 1);
  const start = view.calls.keyboard.length;
  await act(async () => scroll.props.onTouchEnd({ target: 1, currentTarget: 2 }));
  assert.equal(view.calls.keyboard.length, start);
  await act(async () => scroll.props.onTouchEnd({ target: 2, currentTarget: 2 }));
  assert.equal(view.calls.keyboard.length, start + 1);
  await tap(host(view.tree, "program-save"));
  assert.equal(view.calls.updates.length, 1);
  assert.equal(view.calls.updates[0][2].name, "My revised plan");
  assert.equal(view.calls.keyboard.at(-1), "dismiss");
  await unmount(view.tree);
});

test("Metadata and aliases keep actual draft payload normalization and create navigation", async () => {
  const view = await builder({ asCopy: true });
  await change(host(view.tree, "program-name-input"), "  My new plan  ");
  await change(host(view.tree, "program-description-input"), "  New clear training description  ");
  await change(host(view.tree, "program-aliases-input"), " push pull , , ppl , ");
  await tap(host(view.tree, "program-goal-general-fitness"));
  await tap(host(view.tree, "program-level-intermediate"));
  await tap(host(view.tree, "program-duration-45"));
  await tap(host(view.tree, "program-save"));
  assert.deepEqual(view.calls.creates[0], ["A", { name: "My new plan", description: "New clear training description", goal: "general-fitness", level: "intermediate", durationMinutes: 45, aliases: ["push pull", "ppl"], days: [{ title: "Upper body", dayType: "upper", exercises: [{ blockType: "main", exerciseId: "squat", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90, cue: "Controlled reps" }] }, { title: "Lower body", dayType: "lower", exercises: [{ blockType: "main", exerciseId: "bridge", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90, cue: "Controlled reps" }] }] }]);
  assert.equal(view.calls.updates.length, 0);
  assert.deepEqual(view.calls.routes, [["replace", { pathname: "/programs/[templateId]", params: { templateId: "saved-one" } }]]);
  await unmount(view.tree);
});

test("Current and scheduled saves retain revision and explicit now/next-week choices", async () => {
  for (const flag of ["isActive", "isScheduled"]) {
    const view = await builder({ program: program({ [flag]: true }) });
    await tap(host(view.tree, "program-save"));
    assert.equal(view.calls.updates[0][1], "program-one");
    assert.equal(view.calls.updates[0][2].version, 3);
    assert.equal(view.calls.loads[0][flag], true);
    const [title, message, buttons] = view.calls.alerts[0];
    assert.equal(title, "Update scheduled workouts?");
    assert.match(message, /unfinished workouts/);
    assert.deepEqual(plain(buttons.map((button) => button.text)), ["Next week", "Apply now"]);
    await act(async () => buttons[0].onPress());
    await act(async () => buttons[1].onPress());
    assert.deepEqual(view.calls.routes, [["replace", { pathname: "/programs/activate", params: { templateId: "program-one", applyMode: "next-week" } }], ["replace", { pathname: "/programs/activate", params: { templateId: "program-one", applyMode: "now" } }]]);
    await unmount(view.tree);
  }
});

test("Existing validation blocks invalid drafts without API writes", async () => {
  const cases = [
    [program({ name: "x" }), "Give your program a name."],
    [program({ description: "short" }), "Add a short description so the plan is clear."],
    [program({ days: [] }), "Add at least one workout day."],
    [program({ days: [{ ...program().days[0], title: " " }] }), "Every workout day needs a name."],
    [program({ days: [{ ...program().days[0], exercises: [] }] }), "Add at least one exercise to every workout day."],
    ...[[{ sets: 21 }, "Sets must be between 1 and 20."], [{ repsMin: 0 }, "Reps must be between 1 and 100."], [{ repsMax: 101 }, "Reps must be between 1 and 100."], [{ repsMin: 13, repsMax: 12 }, "Minimum reps cannot exceed maximum reps."], [{ restSeconds: 901 }, "Rest must be between 0 and 900 seconds."]].map(([extra, message]) => [program({ days: [{ ...program().days[0], exercises: [item(extra)] }] }), message]),
  ];
  for (const [fixture, message] of cases) {
    const view = await builder({ program: fixture });
    await tap(host(view.tree, "program-save"));
    assert.equal(textOf(host(view.tree, "program-builder-error")), message);
    assert.equal(view.calls.updates.length + view.calls.creates.length, 0);
    await unmount(view.tree);
  }
});

test("Failed saves keep the draft, distinguish 409 and allow an unchanged retry", async () => {
  for (const error of [new HttpError(409), new Error("offline")]) {
    let failing = true;
    const view = await builder({ update: () => { if (failing) throw error; return program(); } });
    await tap(host(view.tree, "program-save"));
    assert.match(textOf(host(view.tree, "program-builder-error")), error instanceof HttpError ? /changed elsewhere/ : /couldn’t be saved/);
    assert.equal(view.draft.name, "My strength plan");
    assert.equal(view.calls.loads.length, 0);
    assert.equal(view.calls.routes.length, 0);
    failing = false;
    await tap(host(view.tree, "program-save"));
    assert.deepEqual(view.calls.updates[0], view.calls.updates[1]);
    assert.equal(host(view.tree, "program-builder-error"), undefined);
    await unmount(view.tree);
  }
});

test("Pending saves cannot load, navigate or expose errors after account switch or unmount", async () => {
  for (const end of ["switch", "unmount"]) for (const outcome of ["resolve", "reject"]) {
    const pending = deferred();
    const view = await builder({ update: () => pending.promise });
    await tap(host(view.tree, "program-save"));
    if (end === "switch") await act(async () => view.tree.update(view.element("B")));
    else await unmount(view.tree);
    await act(async () => outcome === "resolve" ? pending.resolve(program({ name: "Other account result" })) : pending.reject(new Error("offline")));
    assert.equal(view.calls.loads.length, 0);
    assert.equal(view.calls.routes.length, 0);
    if (end === "switch") { assert.equal(view.draft.name, ""); assert.equal(host(view.tree, "program-builder-error"), undefined); await unmount(view.tree); }
  }
});

test("Missing authentication preserves Back without sending a program mutation", async () => {
  const view = await builder({ token: null });
  await tap(host(view.tree, "program-save"));
  assert.equal(view.calls.creates.length + view.calls.updates.length, 0);
  await tap(host(view.tree, "program-builder-back"));
  assert.deepEqual(view.calls.routes, [["back"]]);
  await unmount(view.tree);
});

test("Add keeps seven-day cap and day navigation uses the existing draft local ID", async () => {
  const view = await builder({ empty: true });
  for (let i = 0; i < 7; i++) await tap(host(view.tree, "program-add-day"));
  assert.equal(view.draft.days.length, 7);
  assert.equal(host(view.tree, "program-add-day").props.disabled, true);
  assert.equal(host(view.tree, "program-add-day").props.accessibilityState.disabled, true);
  await tap(host(view.tree, "program-builder-day-open-1"));
  assert.deepEqual(view.calls.routes, [["push", { pathname: "/programs/day", params: { dayId: view.draft.days[0].localId } }]]);
  await unmount(view.tree);
});

test("Options reorder uses actual sequential draft updates and accessible feedback", async () => {
  const view = await builder();
  const firstId = view.draft.days[0].localId;
  await tap(host(view.tree, "program-day-menu-1"));
  await tap(host(view.tree, "program-day-move-later"));
  assert.deepEqual(plain(view.draft.days.map((day) => [day.title, day.position])), [["Lower body", 0], ["Upper body", 1]]);
  assert.equal(view.draft.days[1].localId, firstId);
  assert.equal(host(view.tree, "program-day-options-cancel"), undefined);
  await view.runTimers(80);
  assert.deepEqual(view.calls.announcements, ["Upper body moved to position 2 of 2."]);
  assert.deepEqual(view.calls.haptics, ["Light"]);
  await tap(host(view.tree, "program-day-menu-2"));
  assert.equal(host(view.tree, "program-day-move-later").props.disabled, true);
  await tap(host(view.tree, "program-day-move-earlier"));
  assert.equal(view.draft.days[0].title, "Upper body");
  await unmount(view.tree);
  assert.equal(view.timers.size <= 2, true);
});

test("Remove requires confirmation, Cancel/backdrop preserve the draft, and confirm removes only its day", async () => {
  const view = await builder();
  await tap(host(view.tree, "program-day-menu-1"));
  await tap(host(view.tree, "program-day-request-remove"));
  assert.equal(view.draft.days.length, 2);
  assert.match(textOf(view.tree.root), /Remove Upper body\?.*all of its exercises/);
  await tap(host(view.tree, "program-day-confirm-cancel"));
  assert.equal(view.draft.days.length, 2);
  await tap(host(view.tree, "program-day-menu-1"));
  await tap(host(view.tree, "program-day-options-backdrop"));
  assert.equal(view.draft.days.length, 2);
  await tap(host(view.tree, "program-day-menu-1"));
  await tap(host(view.tree, "program-day-request-remove"));
  await tap(host(view.tree, "program-day-confirm-remove"));
  assert.deepEqual(view.draft.days.map((day) => [day.title, day.position]), [["Lower body", 0]]);
  assert.equal(host(view.tree, "program-day-confirm-remove"), undefined);
  await unmount(view.tree);
});

test("Measured drag stride, accessible moves and reduced-motion cancellation keep existing physics", async () => {
  for (const reduceMotion of [false, true]) {
    const view = await builder({ reduceMotion, program: program({ days: [...program().days, { ...program().days[0], id: "day-three", position: 2, title: "Full body" }] }) });
    const first = host(view.tree, "program-builder-day-1");
    await act(async () => first.props.onLayout({ nativeEvent: { layout: { height: 139 } } }));
    let gesture = gestureOf(host(view.tree, "program-day-handle-1"));
    assert.equal(gesture.distance, 3);
    await act(async () => gesture.callbacks.start());
    assert.equal(view.tree.root.findByType("ScrollView").props.scrollEnabled, false);
    await act(async () => gesture.callbacks.update({ translationY: 300 }));
    await act(async () => gesture.callbacks.end({ translationY: 300 }));
    await act(async () => gesture.callbacks.finalize({}, true));
    assert.deepEqual(plain(view.draft.days.map((day) => day.title)), ["Lower body", "Full body", "Upper body"]);
    assert.ok(view.calls.timing.some(([, config]) => config.duration === (reduceMotion ? 0 : 210)));
    await view.runTimers(210);
    assert.equal(view.tree.root.findByType("ScrollView").props.scrollEnabled, true);
    const handle = host(view.tree, "program-day-handle-3");
    assert.deepEqual(plain(handle.props.accessibilityActions), [{ name: "decrement", label: "Move earlier" }]);
    await act(async () => handle.props.onAccessibilityAction({ nativeEvent: { actionName: "decrement" } }));
    assert.deepEqual(plain(view.draft.days.map((day) => day.title)), ["Lower body", "Upper body", "Full body"]);
    gesture = gestureOf(host(view.tree, "program-day-handle-1"));
    await act(async () => gesture.callbacks.start());
    await act(async () => gesture.callbacks.finalize({}, false));
    assert.equal(view.tree.root.findByType("ScrollView").props.scrollEnabled, true);
    assert.equal(view.draft.days[0].title, "Lower body");
    assert.ok(view.calls.timing.some(([, config]) => config.duration === (reduceMotion ? 0 : 140)));
    await unmount(view.tree);
  }
});

test("Builder controller, gesture worklets, draft context and shared contracts stay byte-identical", () => {
  const baseline = execFileSync("git", ["show", `${base}:app/programs/builder.tsx`], { cwd: root, encoding: "utf8" });
  const current = readFileSync(path.join(root, "app/programs/builder.tsx"), "utf8");
  const between = (value, start, end) => value.slice(value.indexOf(start), value.indexOf(end, value.indexOf(start)));
  assert.equal(between(current, "  const { token, user }", "  return (\n    <SafeAreaView"), between(baseline, "  const { token, user }", "  return (\n    <SafeAreaView"));
  assert.equal(between(current, "  const translateY =", "  const handle = ("), between(baseline, "  const translateY =", "\n  return (\n    <Animated.View").trimEnd() + "\n\n");
  for (const file of ["utils/programDraftContext.tsx", "components/program/ProgramHeader.tsx", "constants/theme.ts", "services/programService.ts", "package.json"]) assert.equal(readFileSync(path.join(root, file), "utf8"), execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" }));
});
