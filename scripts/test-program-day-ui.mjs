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
const base = "230569113fb6bbd5dd46a0340e6bd0533f64e930";
function load(relative, mocks) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console: { ...console, warn() {} } }, { filename });
  return module.exports;
}
const native = { Pressable: "Pressable", View: "View", Text: "Text", TextInput: "TextInput", ScrollView: "ScrollView", KeyboardAvoidingView: "KeyboardAvoidingView", TouchableWithoutFeedback: "TouchableWithoutFeedback", StyleSheet: { create: (styles) => styles }, Platform: { OS: "ios", select: (values) => values.ios } };
const { Colors, Fonts } = load("constants/theme.ts", { "react-native": native });
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node, pressed = false) => flat(typeof node.props.style === "function" ? node.props.style({ pressed }) : node.props.style);
const textOf = (node) => typeof node === "string" ? node : (node?.children?.map(textOf).join(node.type === "Text" ? "" : " ") ?? "").replace(/\s+/g, " ").trim();
const host = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const plain = (value) => JSON.parse(JSON.stringify(value));
const tap = async (node) => { assert.ok(node); assert.equal(node.props.disabled ?? false, false); await act(async () => node.props.onPress()); };
const change = async (node, value) => { await act(async () => node.props.onChangeText(value)); };
const unmount = async (tree) => { await act(async () => tree.unmount()); };
const item = (extra = {}) => ({ id: "item-one", position: 0, exerciseId: "squat", exercise: { id: "squat", name: "Barbell Squat", primaryMuscle: "quadriceps" }, blockType: "main", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90, cue: "Controlled reps", ...extra });
const program = (extra = {}) => ({ id: "program-one", scope: "private", version: 3, name: "My strength plan", description: "A balanced plan for my training week.", goal: "build-muscle", level: "beginner", durationMinutes: 35, aliases: [], days: [{ id: "day-one", position: 0, title: "Upper body", dayType: "upper", exercises: [item(), item({ id: "item-two", position: 1, exerciseId: "bridge", exercise: { id: "bridge", name: "Glute Bridge", primaryMuscle: "glutes" }, blockType: "accessory" })] }], ...extra });
function contrast(a, b) {
  const channels = (hex) => (hex.length === 4 ? hex.slice(1).split("").map((value) => value.repeat(2)) : hex.slice(1).match(/../g)).map((value) => parseInt(value, 16) / 255);
  const luminance = (hex) => channels(hex).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
async function editor(options = {}) {
  const scheme = options.scheme ?? "light";
  const colors = Colors[scheme];
  const AuthContext = React.createContext(null);
  const calls = { routes: [], keyboard: [] };
  let context;
  let routeId;
  const mocks = {
    react: React, "react-native": { ...native, useWindowDimensions: () => ({ width: options.width ?? 430, fontScale: options.fontScale ?? 1 }), Keyboard: { dismiss: () => calls.keyboard.push("dismiss") } },
    "@expo/vector-icons": { Ionicons: "Ionicons" }, "@/constants/theme": { Colors, Fonts }, "@/hooks/use-color-scheme": { useColorScheme: () => scheme }, "@/hooks/use-theme-color": { useThemeColor: () => colors.text },
    "expo-router": { useLocalSearchParams: () => ({ dayId: routeId }), useRouter: () => ({ push: (target) => calls.routes.push(["push", plain(target)]), back: () => calls.routes.push(["back"]) }) },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@/utils/authContext": { AuthContext }, "./authContext": { AuthContext },
  };
  const actualDraft = load("utils/programDraftContext.tsx", mocks);
  mocks["@/utils/programDraftContext"] = actualDraft;
  mocks["@/components/themed-text"] = load("components/themed-text.tsx", mocks);
  mocks["@/components/workout/WorkoutText"] = load("components/workout/WorkoutText.tsx", mocks);
  mocks["@/components/program"] = load("components/program/ProgramHeader.tsx", mocks);
  mocks["@/components/screen-state"] = load("components/screen-state.tsx", mocks);
  const { default: Screen } = load("app/programs/day.tsx", mocks);
  function Probe() { context = actualDraft.useProgramDraft(); return null; }
  function Boot() {
    const value = actualDraft.useProgramDraft();
    const [stage, setStage] = React.useState(0);
    React.useEffect(() => {
      if (stage === 0) setStage(1);
      else if (stage === 1) { value.loadProgram(options.program ?? program()); setStage(2); }
    }, [stage]);
    routeId ??= options.invalid ? "missing-day" : value.draft.days[0]?.localId;
    return React.createElement(React.Fragment, null, React.createElement(Probe), stage === 2 && React.createElement(Screen));
  }
  const element = (userId = "A") => React.createElement(AuthContext.Provider, { value: { token: userId, user: userId ? { id: userId } : null } }, React.createElement(actualDraft.ProgramDraftProvider, null, React.createElement(Boot)));
  let tree;
  await act(async () => { tree = create(element()); });
  return { tree, colors, calls, element, get draft() { return context.draft; }, get day() { return context.draft.days.find((day) => day.localId === routeId); }, reload: async (value) => { await act(async () => context.loadProgram(value)); } };
}

test("behavior: name and cue edits remain immediate local draft updates", async () => {
  const view = await editor();
  await change(host(view.tree, "program-day-title"), "New workout name");
  await change(host(view.tree, "program-exercise-cue-1"), "Slow descent");
  assert.equal(view.day.title, "New workout name");
  assert.equal(view.day.exercises[0].cue, "Slow descent");
  await unmount(view.tree);
});

test("behavior: numeric drafts accept digits only and commit on blur/submit", async () => {
  const view = await editor();
  const field = () => host(view.tree, "program-exercise-sets-1");
  for (const invalid of ["1.5", "-1", "abc", " 4", "4,0", "Infinity"]) { await change(field(), invalid); assert.equal(field().props.value, "3"); }
  await change(field(), "04");
  assert.equal(view.day.exercises[0].sets, 3);
  await act(async () => field().props.onBlur());
  assert.equal(view.day.exercises[0].sets, 4);
  assert.equal(field().props.value, "4");
  await change(host(view.tree, "program-exercise-rest-1"), "120");
  await act(async () => host(view.tree, "program-exercise-rest-1").props.onSubmitEditing());
  assert.equal(view.day.exercises[0].restSeconds, 120);
  await unmount(view.tree);
});

test("behavior: all valid range boundaries and min/max equality remain accepted", async () => {
  const view = await editor();
  for (const values of [[1, 1, 1, 0], [20, 100, 100, 900]]) {
    for (const [i, id] of ["sets", "reps-min", "reps-max", "rest"].entries()) await change(host(view.tree, `program-exercise-${id}-1`), String(values[i]));
    await tap(host(view.tree, "program-day-done"));
    assert.deepEqual([view.day.exercises[0].sets, view.day.exercises[0].repsMin, view.day.exercises[0].repsMax, view.day.exercises[0].restSeconds], values);
  }
  assert.equal(view.calls.routes.length, 2);
  await unmount(view.tree);
});

test("behavior: invalid/empty prescriptions retain entries and block Done", async () => {
  for (const [id, values, error] of [["sets", ["", "0", "21"], "Sets must be between 1 and 20."], ["reps-min", ["", "0", "101"], "Min reps must be between 1 and 100."], ["reps-max", ["", "0", "101"], "Max reps must be between 1 and 100."], ["rest", ["", "901"], "Rest sec must be between 0 and 900."]]) {
    for (const value of values) {
      const view = await editor();
      await change(host(view.tree, `program-exercise-${id}-1`), value);
      await tap(host(view.tree, "program-day-done"));
      assert.equal(view.calls.routes.length, 0);
      assert.equal(textOf(host(view.tree, "program-prescription-error-1")), error);
      assert.equal(host(view.tree, `program-exercise-${id}-1`).props.value, value);
      assert.equal(host(view.tree, "program-prescription-error-1").props.accessibilityRole, "alert");
      await unmount(view.tree);
    }
  }
});

test("behavior: min exceeds max error clears only after editing its row and valid retry", async () => {
  const view = await editor();
  await change(host(view.tree, "program-exercise-reps-min-1"), "13");
  await act(async () => host(view.tree, "program-exercise-reps-min-1").props.onBlur());
  assert.equal(textOf(host(view.tree, "program-prescription-error-1")), "Minimum reps cannot exceed maximum reps.");
  await change(host(view.tree, "program-exercise-sets-2"), "4");
  assert.ok(host(view.tree, "program-prescription-error-1"));
  await change(host(view.tree, "program-exercise-reps-max-1"), "15");
  assert.equal(host(view.tree, "program-prescription-error-1"), undefined);
  await tap(host(view.tree, "program-day-done"));
  assert.equal(view.day.exercises[0].repsMin, 13);
  assert.equal(view.day.exercises[0].repsMax, 15);
  assert.deepEqual(view.calls.routes, [["back"]]);
  await unmount(view.tree);
});

test("behavior: Done keeps existing sequential partial commit when a later row is invalid", async () => {
  const view = await editor();
  await change(host(view.tree, "program-exercise-sets-1"), "5");
  await change(host(view.tree, "program-exercise-sets-2"), "");
  await tap(host(view.tree, "program-day-done"));
  assert.equal(view.day.exercises[0].sets, 5);
  assert.equal(view.day.exercises[1].sets, 3);
  assert.equal(view.calls.routes.length, 0);
  assert.ok(host(view.tree, "program-prescription-error-2"));
  await unmount(view.tree);
});

test("behavior: block selection, sequential reorder and immediate removal preserve provider semantics", async () => {
  const view = await editor();
  const firstId = view.day.exercises[0].localId;
  await tap(host(view.tree, "program-exercise-block-1-accessory"));
  assert.equal(view.day.exercises[0].blockType, "accessory");
  assert.equal(host(view.tree, "program-exercise-up-1").props.disabled, true);
  assert.equal(host(view.tree, "program-exercise-down-2").props.disabled, true);
  await tap(host(view.tree, "program-exercise-down-1"));
  assert.equal(view.day.exercises[1].localId, firstId);
  assert.deepEqual(plain(view.day.exercises.map((item) => item.position)), [0, 1]);
  await tap(host(view.tree, "program-exercise-up-2"));
  assert.equal(view.day.exercises[0].localId, firstId);
  await tap(host(view.tree, "program-exercise-remove-1"));
  assert.equal(view.day.exercises.length, 1);
  assert.equal(view.day.exercises[0].exercise.name, "Glute Bridge");
  assert.equal(view.day.exercises[0].position, 0);
  await unmount(view.tree);
});

test("behavior: Add and empty-state Choose keep exact local day picker route", async () => {
  const view = await editor({ program: program({ days: [{ id: "empty", position: 0, title: "Day 1", dayType: "day_1", exercises: [] }] }) });
  const expected = ["push", { pathname: "/programs/exercise-picker", params: { dayId: view.day.localId } }];
  await tap(host(view.tree, "program-day-add-exercise"));
  const choose = view.tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === "Choose exercise");
  await tap(choose);
  assert.deepEqual(view.calls.routes, [expected, expected]);
  assert.ok(text(view.tree, "Each workout day needs at least one exercise."));
  await tap(host(view.tree, "program-day-done"));
  assert.deepEqual(view.calls.routes.at(-1), ["back"]);
  await unmount(view.tree);
});

test("behavior: account switching hides owned day immediately and invalid route has Back", async () => {
  const view = await editor();
  await change(host(view.tree, "program-day-title"), "Private account A day");
  await act(async () => view.tree.update(view.element("B")));
  assert.equal(view.draft.days.length, 0);
  assert.equal(host(view.tree, "program-day-title"), undefined);
  assert.ok(text(view.tree, "Workout day unavailable"));
  const back = view.tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === "Back to builder");
  await tap(back);
  assert.deepEqual(view.calls.routes, [["back"]]);
  await unmount(view.tree);
  const invalid = await editor({ invalid: true });
  assert.ok(text(invalid.tree, "Return to the program builder and choose a workout day."));
  await unmount(invalid.tree);
});

test("behavior: Back retains its existing noncommitting prescription callback", async () => {
  const view = await editor();
  await change(host(view.tree, "program-exercise-sets-1"), "7");
  const back = view.tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === "Back from Workout day");
  await tap(back);
  assert.equal(view.day.exercises[0].sets, 3);
  assert.deepEqual(view.calls.routes, [["back"]]);
  await unmount(view.tree);
});

test("behavior: unsaved prescription drafts follow exercise identity through reordering", async () => {
  const view = await editor();
  const firstId = view.day.exercises[0].localId;
  await change(host(view.tree, "program-exercise-sets-1"), "6");
  await tap(host(view.tree, "program-exercise-down-1"));
  assert.equal(host(view.tree, "program-exercise-sets-2").props.value, "6");
  await tap(host(view.tree, "program-day-done"));
  assert.equal(view.day.exercises.find((item) => item.localId === firstId).sets, 6);
  await unmount(view.tree);
});

for (const scheme of ["light", "dark"]) {
  test(`UI ${scheme}: neutral readable initials/Add and selected blocks stay explicit at 44 points`, async () => {
    const view = await editor({ scheme });
    const add = host(view.tree, "program-day-add-exercise");
    assert.ok(styleOf(add).minHeight >= 44);
    for (const pressed of [false, true]) {
      assert.notEqual(styleOf(add, pressed).backgroundColor, view.colors.primaryButton);
      assert.equal(styleOf(add.findByType("Text")).color, view.colors.text);
      const selected = host(view.tree, "program-exercise-block-1-main");
      const style = styleOf(selected, pressed);
      assert.equal(selected.props.accessibilityState.selected, true);
      assert.ok(style.minHeight >= 44);
      assert.notEqual(style.backgroundColor, view.colors.primaryButton);
      assert.ok(contrast(style.borderColor, style.backgroundColor) >= 3);
      assert.ok(contrast(styleOf(selected.findByType("Text")).color, style.backgroundColor) >= 4.5);
      assert.ok(selected.findByType("Ionicons"));
    }
    const initials = text(view.tree, "BS");
    assert.equal(styleOf(initials).color, view.colors.text);
    assert.notEqual(styleOf(initials.parent).backgroundColor, "rgba(0,212,255,0.11)");
    await unmount(view.tree);
  });

  test(`UI ${scheme}: fields, cues, danger and disabled controls retain contrast`, async () => {
    const view = await editor({ scheme });
    for (const id of ["program-day-title", "program-exercise-sets-1", "program-exercise-reps-min-1", "program-exercise-reps-max-1", "program-exercise-rest-1", "program-exercise-cue-1"]) {
      const field = host(view.tree, id);
      assert.equal(styleOf(field).color, view.colors.text);
      assert.ok(styleOf(field).minHeight >= 44);
    }
    assert.equal(host(view.tree, "program-day-title").props.placeholderTextColor, view.colors.icon);
    for (const label of ["Sets", "Min reps", "Max reps", "Rest sec", "quadriceps"]) {
      const node = text(view.tree, label);
      assert.equal(styleOf(node).color, view.colors.icon);
      assert.ok(contrast(styleOf(node).color, view.colors.inputBackground) >= 4.5);
    }
    const disabled = host(view.tree, "program-exercise-up-1");
    assert.equal(disabled.props.accessibilityState.disabled, true);
    assert.equal(styleOf(disabled).opacity, undefined);
    assert.equal(disabled.findByType("Ionicons").props.color, view.colors.icon);
    const done = host(view.tree, "program-day-done");
    for (const pressed of [false, true]) {
      assert.equal(styleOf(done, pressed).backgroundColor, view.colors.primaryButton);
      assert.equal(styleOf(done, pressed).opacity, undefined);
      assert.deepEqual(plain(styleOf(done, pressed).transform), [{ scale: pressed ? 0.99 : 1 }]);
      assert.ok(styleOf(done, pressed).minHeight >= 44);
      assert.ok(contrast(styleOf(done.findByType("Text")).color, styleOf(done, pressed).backgroundColor) >= 4.5);
    }
    const danger = scheme === "light" ? "#B42318" : "#FF8B82";
    assert.equal(host(view.tree, "program-exercise-remove-1").findByType("Ionicons").props.color, danger);
    await change(host(view.tree, "program-exercise-sets-1"), "0");
    await tap(host(view.tree, "program-day-done"));
    assert.equal(styleOf(host(view.tree, "program-prescription-error-1")).color, danger);
    assert.ok(contrast(danger, view.colors.inputBackground) >= 4.5);
    await unmount(view.tree);
  });

  test(`UI ${scheme}: empty/unavailable actions are neutral and keep exact guidance`, async () => {
    const view = await editor({ scheme, invalid: true });
    const back = view.tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === "Back to builder");
    assert.ok(styleOf(back).minHeight >= 44);
    for (const pressed of [false, true]) assert.notEqual(styleOf(back, pressed).backgroundColor, view.colors.primaryButton);
    assert.ok(text(view.tree, "Return to the program builder and choose a workout day."));
    await unmount(view.tree);
  });
}

test("UI: adaptive prescription layout keeps 4/2/1 readable columns and uncapped text", async () => {
  for (const [width, fontScale, expected] of [[430, 1, "23%"], [375, 1, "48%"], [430, 1.5, "48%"], [430, 3, "100%"]]) {
    const view = await editor({ width, fontScale });
    const field = host(view.tree, "program-exercise-sets-1");
    assert.equal(styleOf(field.parent).width, expected);
    assert.ok(styleOf(field).minHeight >= 52);
    assert.equal(styleOf(text(view.tree, "Sets")).fontSize, 14);
    for (const node of view.tree.root.findAllByType("Text")) {
      assert.equal(node.props.numberOfLines, undefined);
      assert.equal(node.props.maxFontSizeMultiplier, undefined);
      assert.equal(styleOf(node).lineHeight, undefined);
    }
    for (const id of ["program-day-back", "program-day-done", "program-exercise-remove-1", "program-exercise-up-1", "program-exercise-down-1"]) assert.ok(styleOf(host(view.tree, id)).minHeight >= 44 || styleOf(host(view.tree, id)).height >= 44);
    assert.deepEqual(plain(host(view.tree, "program-day-safe-area").props.edges), ["top", "bottom"]);
    await unmount(view.tree);
  }
});

test("UI: outside/drag dismissal and first-tap Done preserve entries and validation", async () => {
  const view = await editor();
  const scroll = host(view.tree, "program-day-scroll");
  assert.equal(scroll.props.keyboardShouldPersistTaps, "always");
  assert.equal(scroll.props.keyboardDismissMode, "interactive");
  await change(host(view.tree, "program-exercise-sets-1"), "5");
  const header = host(view.tree, "program-day-header");
  for (const node of [scroll, header]) {
    const count = view.calls.keyboard.length;
    node.props.onTouchEnd({ target: 1, currentTarget: 2 });
    assert.equal(view.calls.keyboard.length, count);
    node.props.onTouchEnd({ target: 2, currentTarget: 2 });
    assert.equal(view.calls.keyboard.length, count + 1);
  }
  const body = view.tree.root.findAllByType("TouchableWithoutFeedback");
  assert.ok(body.length >= 2);
  for (const node of body) { assert.equal(node.props.accessible, false); node.props.onPress(); }
  assert.equal(host(view.tree, "program-exercise-sets-1").props.value, "5");
  await tap(host(view.tree, "program-day-done"));
  assert.equal(view.calls.keyboard.at(-1), "dismiss");
  assert.equal(view.day.exercises[0].sets, 5);
  assert.deepEqual(view.calls.routes, [["back"]]);
  await change(host(view.tree, "program-exercise-reps-min-1"), "");
  await tap(host(view.tree, "program-day-done"));
  await act(async () => host(view.tree, "program-exercise-reps-min-1").props.onBlur());
  assert.equal(host(view.tree, "program-exercise-reps-min-1").props.value, "");
  assert.ok(host(view.tree, "program-prescription-error-1"));
  assert.equal(view.calls.routes.length, 1);
  await unmount(view.tree);
});

test("UI: full validation controller and shared contracts remain byte-identical", () => {
  const source = readFileSync(path.join(root, "app/programs/day.tsx"), "utf8");
  const baseline = execFileSync("git", ["show", `${base}:app/programs/day.tsx`], { cwd: root, encoding: "utf8" });
  const section = (value) => value.slice(value.indexOf("  const { draft, updateDay"), value.indexOf("  if (!day) return"));
  assert.equal(section(source), section(baseline));
  assert.equal(source.slice(source.indexOf("type PrescriptionKey"), source.indexOf("export default")), baseline.slice(baseline.indexOf("type PrescriptionKey"), baseline.indexOf("export default")));
  for (const file of ["utils/programDraftContext.tsx", "components/program/ProgramHeader.tsx", "components/screen-state.tsx", "constants/theme.ts", "services/programService.ts", "package.json"]) assert.equal(readFileSync(path.join(root, file), "utf8"), execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" }));
});
