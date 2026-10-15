import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import ts from "typescript";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const route = "app/programs/custom-exercise.tsx";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const plain = (value) => JSON.parse(JSON.stringify(value));
function load(file, mocks, globals = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => {
    assert.ok(name in mocks, `Unmocked module in ${file}: ${name}`);
    return mocks[name];
  }, console, ...globals }, { filename: path.join(root, file) });
  return module.exports;
}
const native = { ActivityIndicator: "ActivityIndicator", KeyboardAvoidingView: "KeyboardAvoidingView", Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", TextInput: "TextInput", View: "View", StyleSheet: { create: (styles) => styles }, Platform: { OS: "ios", select: (values) => values.ios } };
const theme = load("constants/theme.ts", { "react-native": native });
const taxonomy = load("constants/exerciseTaxonomy.ts", {});
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const inside = (node, ancestor) => { for (let parent = node.parent; parent; parent = parent.parent) if (parent === ancestor) return true; return false; };
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const texts = (view) => view.tree.root.findAllByType("Text").map(textOf);
const host = (view, id) => view.tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === `custom-exercise-${id}`)[0];
const equipmentRows = (view) => view.tree.root.findAll((node) => node.type === "Pressable" && node.props.accessibilityRole === "checkbox");
const back = (view) => view.tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel?.startsWith("Back from "));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const exercise = (extra = {}) => ({ id: "fixture-custom-1", name: "Fixture custom row", exerciseType: "accessory", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipmentIds: ["fixture-equipment-1"], instructions: "Fixture setup cues", imageUrl: "fixture://image", isFavorited: true, ...extra });
const equipment = Array.from({ length: 45 }, (_, index) => ({ id: `fixture-equipment-${index + 1}`, name: `Fixture station ${String(index + 1).padStart(2, "0")}` }));
const change = async (view, id, value) => { await act(async () => host(view, id).props.onChangeText(value)); };
const tap = async (node) => { assert.ok(node); assert.notEqual(node.props.disabled, true); await act(async () => node.props.onPress()); };
const pressSave = (view) => tap(host(view, "save"));
const close = async (view) => { await act(async () => view.tree.unmount()); };
const settle = async (pending, value, reject = false) => { await act(async () => reject ? pending.reject(value) : pending.resolve(value)); };
const defaultPayload = { name: "Fixture name", exerciseType: "strength", primaryMuscle: "chest", secondaryMuscles: [], equipmentIds: [], instructions: null };

async function form(scheme, options = {}) {
  const AuthContext = React.createContext(null), EquipmentContext = React.createContext(null);
  let dimensions = { width: options.width ?? 430, height: 932, scale: 3, fontScale: options.fontScale ?? 1 };
  let account = { token: "fixture-token-A", user: { id: "fixture-account-A" }, ...options.account };
  let params = { exerciseId: options.exerciseId }, ready = false, context, dayId;
  let read = options.read ?? (async () => exercise());
  let createExercise = options.create ?? (async () => exercise());
  let updateExercise = options.update ?? (async () => exercise());
  const calls = { reads: [], creates: [], updates: [], routes: [], warnings: [], backFrames: [] };
  const mocks = {
    react: React, "react-native": { ...native, useWindowDimensions: () => dimensions, Pressable: (props) => {
      if (props.testID === "custom-exercise-back") calls.backFrames.push({ disabled: props.disabled, state: plain(props.accessibilityState) });
      return React.createElement("Pressable", props);
    } }, "@expo/vector-icons": { Ionicons: "Ionicons" },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@/constants/theme": theme, "@/constants/exerciseTaxonomy": taxonomy,
    "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@/utils/authContext": { AuthContext }, "./authContext": { AuthContext },
    "@/utils/equipmentContext": { EquipmentContext },
    "@/services/exerciseService": {
      getExerciseById: (...args) => { calls.reads.push(plain(args)); return read(...args); },
      createCustomExercise: (...args) => { calls.creates.push(plain(args)); return createExercise(...args); },
      updateCustomExercise: (...args) => { calls.updates.push(plain(args)); return updateExercise(...args); },
    },
    "expo-router": { useLocalSearchParams: () => params, useRouter: () => ({ back: () => calls.routes.push(["back"]), dismiss: (count) => calls.routes.push(["dismiss", count]) }) },
  };
  mocks["@/hooks/use-theme-color"] = load("hooks/use-theme-color.ts", mocks);
  mocks["@/components/themed-text"] = load("components/themed-text.tsx", mocks);
  mocks["@/components/program"] = load("components/program/ProgramHeader.tsx", mocks);
  mocks["@/components/screen-state"] = load("components/screen-state.tsx", mocks);
  const actualDraft = load("utils/programDraftContext.tsx", mocks);
  mocks["@/utils/programDraftContext"] = actualDraft;
  const { default: Screen } = load(route, mocks, { console: { ...console, warn: (...args) => calls.warnings.push(args) } });
  function Probe() { context = actualDraft.useProgramDraft(); return null; }
  const element = () => React.createElement(AuthContext.Provider, { value: account }, React.createElement(EquipmentContext.Provider, { value: { items: options.equipment ?? equipment } }, React.createElement(actualDraft.ProgramDraftProvider, null, React.createElement(Probe), ready && React.createElement(Screen))));
  let tree;
  await act(async () => { tree = create(element()); });
  if (!options.noDay) {
    await act(async () => context.addDay());
    dayId = context.draft.days.at(-1).localId;
    await act(async () => context.updateDay(dayId, { title: "Fixture local day" }));
    params.dayId = dayId;
  }
  ready = true;
  await act(async () => tree.update(element()));
  return {
    tree, calls,
    get draft() { return context.draft; }, get dayId() { return dayId; }, get day() { return context.draft.days.find((day) => day.localId === dayId); },
    setRead: (next) => { read = next; }, setCreate: (next) => { createExercise = next; }, setUpdate: (next) => { updateExercise = next; },
    params: async (next) => { params = { ...params, ...next }; await act(async () => tree.update(element())); },
    account: async (token, id = "fixture-account-B") => { account = { token, user: token ? { id } : null }; await act(async () => tree.update(element())); },
    resize: async (fontScale, width = dimensions.width) => { dimensions = { ...dimensions, fontScale, width }; await act(async () => tree.update(element())); },
  };
}

test("scope: original imports/controller and protected shared modules remain byte-exact", () => {
  const input = source(route), start = input.indexOf("export default function"), end = input.indexOf("\n  const { fontScale } = useWindowDimensions();");
  const addedImport = ", useWindowDimensions";
  assert.equal(input.slice(0, start).split(addedImport).length, 2);
  const imports = input.slice(0, start).replace(addedImport, ""), controller = input.slice(start, end);
  assert.equal(Buffer.byteLength(imports), 1211);
  assert.equal(hash(imports), "31257928105ab7819305ce11fa68687ee2373473ea4c9d86ede084ee9718e96d");
  assert.equal(Buffer.byteLength(controller), 6550);
  assert.equal(hash(controller), "86e136a8bc5aee82984b5aca049502d70851f2576f680537d09648d2a43afe46");
  assert.ok(input.includes("\n  if (loading || loadedKey !== requestKey) {"));
  assert.ok(input.includes("\n  if (isEditing && loadError) {"));
  assert.ok(input.includes('actionLabel="Retry" onAction={() => setLoadRevision((value) => value + 1)}'));
  assert.ok(input.includes("\n  const formDisabled = saving || loadedKey !== requestKey;"));
  for (const [file, expected] of Object.entries({
    "components/program/ProgramHeader.tsx": "4959bd4948aa81d28b342aefdd513a6e14797bdd7d5b7f726c658ec7c70cb434",
    "components/screen-state.tsx": "31bb083f19309cf2e44f2b93ddde2266fd57e40cc8191b3e57305c8320d4158f",
    "components/themed-text.tsx": "06d02c5a33dd258563726e8586a4b588e2df7c087ac291be6a225f89bf1ac974",
    "constants/theme.ts": "0e4066b19531c70b14aeb5656a6f0de16b37f56ad410b87c2f923168cebfcad1",
    "constants/exerciseTaxonomy.ts": "bbd0025826396b6ee0a4f36c2ec3f435c75e8db445e2a489040551c759d44bd3",
    "services/exerciseService.ts": "9694d499b0535ee43b23594833aa2e09f4c9f390a7dd3ef8ce84e2451558f5e2",
    "utils/programDraftContext.tsx": "762761a628fe5b6e8c17548100230bc5f7b8ec7ed183c9791d38014817fbb76c",
    "utils/authContext.tsx": "b1f62934043ff5894ed0f5a4f9e201f66bc6801a3bc4a6ca29c5509a7df2bb28",
    "utils/equipmentContext.tsx": "1bd981c6e20e570793aa837c5588a2894664a66301bfce72868f4b3607476cd1",
    "interfaces/programs.ts": "ecfa361e7084ab41441cb1306c680de791c0fcd42bf7bceb7ff1caab4e8178cf",
  })) assert.equal(hash(source(file)), expected, file);
});

for (const scheme of ["light", "dark"]) {
  for (const state of ["create", "edit", "loading", "error"]) test(`${scheme}: ${state} normal/large transitions retain shared normal header and fixed44-point Back outside the growing scroll`, async () => {
    const pending = deferred();
    const view = await form(scheme, state === "create" ? {} : { exerciseId: "fixture-edit-1", read: state === "loading" ? () => pending.promise : state === "error" ? async () => { throw new Error("fixture unavailable"); } : async () => exercise() });
    const title = state === "create" ? "Custom exercise" : "Edit exercise";
    const normalTitle = () => view.tree.root.findAllByType("Text").find((node) => textOf(node) === title);
    assert.equal(normalTitle().props.numberOfLines, 1);
    assert.equal(host(view, "back"), undefined);
    await view.resize(1.3);
    assert.equal(host(view, "title"), undefined);
    for (const width of [430, 375]) for (const fontScale of [1.31, 3.12]) {
      await view.resize(fontScale, width);
      const scroll = host(view, "scroll"), fixedBack = host(view, "back"), heading = host(view, "title"), subtitle = host(view, "subtitle");
      assert.equal(view.tree.root.findAllByType("ScrollView").length, 1);
      assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
      assert.equal(scroll.props.keyboardShouldPersistTaps, "handled");
      assert.equal(scroll.props.keyboardDismissMode, "on-drag");
      assert.equal(flat(scroll.props.contentContainerStyle).flexGrow, 1);
      assert.equal(flat(scroll.props.contentContainerStyle).paddingHorizontal, 8);
      assert.ok(flat(scroll.props.contentContainerStyle).paddingBottom >= 32);
      assert.deepEqual(plain(view.tree.root.findByType("SafeAreaView").props.edges), ["top", "bottom"]);
      assert.equal(flat(fixedBack.props.style).width, 44);
      assert.equal(flat(fixedBack.props.style).height, 44);
      assert.equal(fixedBack.props.accessibilityLabel, `Back from ${title}`);
      assert.equal(fixedBack.props.accessibilityRole, "button");
      assert.equal(inside(fixedBack, scroll), false);
      assert.equal(inside(heading, scroll), true);
      assert.equal(inside(subtitle, scroll), true);
      assert.equal(textOf(heading), title);
      assert.equal(textOf(subtitle), "Private to your account");
      assert.equal(heading.props.accessibilityRole, "header");
      for (const node of [heading, subtitle]) for (const prop of ["numberOfLines", "ellipsizeMode", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(node.props[prop], undefined);
      const stateID = state === "loading" ? "loading" : state === "error" ? "load-error" : null;
      if (stateID) assert.equal(inside(host(view, stateID), scroll), true);
      else {
        assert.equal(view.tree.root.findByType("KeyboardAvoidingView").props.behavior, "padding");
        for (const id of ["name", "type-strength", "muscle-chest", "bodyweight", "equipment-search", "instructions", "save"]) assert.equal(inside(host(view, id), scroll), true);
      }
    }
    await tap(host(view, "back"));
    assert.deepEqual(view.calls.routes, [["back"]]);
    await view.resize(1);
    assert.equal(host(view, "title"), undefined);
    assert.equal(host(view, "back"), undefined);
    assert.equal(normalTitle().props.numberOfLines, 1);
    if (state === "loading") {
      await view.resize(3.12, 375);
      await settle(pending, exercise());
      assert.equal(host(view, "loading"), undefined);
      assert.equal(host(view, "name").props.value, "Fixture custom row");
      assert.equal(textOf(host(view, "title")), "Edit exercise");
    }
    await close(view);
  });

  test(`${scheme}: enlarged error Retry keeps actual shared palette and hydrates without conditional hooks`, async () => {
    const view = await form(scheme, { fontScale: 3.12, width: 375, exerciseId: "fixture-edit-1", read: async () => { throw new Error("fixture unavailable"); } });
    const retry = view.tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === "Retry");
    assert.equal(flat(retry.props.style).backgroundColor, theme.Colors[scheme].primaryButton);
    assert.equal(flat(retry.findByType("Text").props.style).color, "#FFFFFF");
    view.setRead(async () => exercise());
    await tap(retry);
    assert.equal(host(view, "load-error"), undefined);
    assert.equal(host(view, "name").props.value, "Fixture custom row");
    assert.equal(textOf(host(view, "title")), "Edit exercise");
    assert.equal(view.calls.reads.length, 2);
    await close(view);
  });

  for (const editing of [false, true]) test(`${scheme}: enlarged ${editing ? "edit" : "create"} preserves validation and Save/Back disable across size changes`, async () => {
    const pending = deferred();
    const view = await form(scheme, { fontScale: 3.12, width: 375, exerciseId: editing ? "fixture-edit-1" : undefined, create: () => pending.promise, update: () => pending.promise });
    await change(view, "name", " ");
    await pressSave(view);
    assert.equal(textOf(host(view, "error")), "Enter an exercise name.");
    await change(view, "name", "Fixture name");
    await pressSave(view);
    assert.equal(host(view, "back").props.disabled, true);
    assert.deepEqual(plain(host(view, "back").props.accessibilityState), { disabled: true });
    assert.equal(host(view, "save").props.disabled, true);
    await view.resize(1);
    assert.equal(back(view).props.disabled, true);
    await view.resize(3.12, 430);
    assert.equal(host(view, "back").props.disabled, true);
    await change(view, "name", "Active field while saving");
    assert.equal(host(view, "name").props.value, "Active field while saving");
    await settle(pending, exercise());
    assert.equal(host(view, "back").props.disabled, false);
    assert.equal(host(view, "save").props.disabled, false);
    assert.deepEqual(view.calls.routes, editing ? [["back"]] : [["dismiss", 2]]);
    assert.equal(view.day.exercises.length, 1);
    await close(view);
  });

  test(`${scheme}: enlarged account transition fences pending save and resets actual provider`, async () => {
    const pending = deferred(), view = await form(scheme, { fontScale: 3.12, width: 375, create: () => pending.promise });
    await change(view, "name", "Fixture name");
    await pressSave(view);
    await view.account("fixture-token-B");
    await settle(pending, exercise());
    assert.deepEqual(view.calls.routes, []);
    assert.equal(view.draft.days.length, 0);
    assert.equal(host(view, "name").props.value, "");
    assert.equal(host(view, "back").props.disabled, false);
    assert.equal(textOf(host(view, "title")), "Custom exercise");
    await close(view);
  });

  test(`${scheme}: enlarged loading/error Back stays enabled through pre-effect render with an older pending Save`, async () => {
    const saving = deferred(), loading = deferred();
    const view = await form(scheme, { fontScale: 3.12, width: 375, create: () => saving.promise, read: () => loading.promise });
    await change(view, "name", "Fixture name");
    await pressSave(view);
    assert.equal(host(view, "back").props.disabled, true);
    const firstStateFrame = view.calls.backFrames.length;
    await view.params({ exerciseId: "fixture-edit-loading" });
    assert.ok(host(view, "loading"));
    assert.ok(view.calls.backFrames.length > firstStateFrame);
    for (const frame of view.calls.backFrames.slice(firstStateFrame)) {
      assert.equal(frame.disabled, false);
      assert.deepEqual(frame.state, { disabled: false });
    }
    await settle(loading, new Error("fixture unavailable"), true);
    assert.ok(host(view, "load-error"));
    assert.equal(host(view, "back").props.disabled, false);
    await tap(host(view, "back"));
    assert.deepEqual(view.calls.routes, [["back"]]);
    await close(view);
    await settle(saving, exercise());
    assert.deepEqual(view.calls.routes, [["back"]]);
  });

  test(`${scheme}: choices use neutral selection with an explicit check and minimum44-point targets`, async () => {
    const view = await form(scheme), colors = theme.Colors[scheme];
    const assertChoice = (id, selected) => {
      const node = host(view, id), style = flat(node.props.style), icons = node.findAllByType("Ionicons");
      assert.equal(style.minHeight, 44);
      assert.equal(style.borderColor, selected ? colors.text : colors.inputBorder);
      assert.equal(style.backgroundColor, selected ? scheme === "dark" ? "#2B3033" : "#F1F3F5" : colors.inputBackground);
      assert.equal(flat(node.findByType("Text").props.style).color, colors.text);
      assert.equal(node.props.accessibilityRole, "button");
      assert.equal(node.props.accessibilityState.selected, selected);
      assert.equal(icons.length, selected ? 1 : 0);
      if (selected) {
        assert.equal(icons[0].props.name, "checkmark");
        assert.equal(icons[0].props.color, colors.text);
      }
    };
    assertChoice("type-strength", true);
    assertChoice("type-accessory", false);
    assertChoice("muscle-chest", true);
    assertChoice("secondary-biceps", false);
    await tap(host(view, "type-cardio"));
    assertChoice("type-strength", false);
    assertChoice("type-cardio", true);
    await tap(host(view, "secondary-biceps"));
    assertChoice("secondary-biceps", true);
    await tap(host(view, "secondary-biceps"));
    assertChoice("secondary-biceps", false);
    await close(view);
  });

  test(`${scheme}: neutral Bodyweight/equipment checks preserve selection while Save retains purple`, async () => {
    const view = await form(scheme), colors = theme.Colors[scheme];
    const bodyweight = () => host(view, "bodyweight"), row = () => host(view, "equipment-fixture-equipment-1");
    assert.equal(flat(bodyweight().props.style).borderColor, colors.text);
    assert.equal(bodyweight().findByType("Ionicons").props.name, "checkmark-circle");
    assert.equal(bodyweight().findByType("Ionicons").props.color, colors.text);
    assert.equal(row().findByType("Ionicons").props.name, "square-outline");
    assert.equal(row().findByType("Ionicons").props.color, colors.placeholder);
    await tap(row());
    assert.equal(row().props.accessibilityRole, "checkbox");
    assert.equal(row().props.accessibilityState.checked, true);
    assert.equal(row().findByType("Ionicons").props.name, "checkbox");
    assert.equal(row().findByType("Ionicons").props.color, colors.text);
    assert.equal(bodyweight().props.accessibilityState.selected, false);
    assert.equal(flat(bodyweight().props.style).borderColor, colors.inputBorder);
    assert.equal(bodyweight().findByType("Ionicons").props.name, "ellipse-outline");
    assert.equal(bodyweight().findByType("Ionicons").props.color, colors.placeholder);
    await tap(bodyweight());
    assert.equal(bodyweight().props.accessibilityState.selected, true);
    assert.equal(row().props.accessibilityState.checked, false);
    assert.equal(flat(host(view, "save").props.style).backgroundColor, "#6a4ff5");
    assert.equal(flat(host(view, "save").findByType("Text").props.style).color, "#FFF");
    await close(view);
  });

  test(`${scheme}: create renders actual taxonomy, field limits, shared title and one primary action`, async () => {
    const view = await form(scheme);
    assert.deepEqual(view.calls.reads, []);
    assert.ok(texts(view).includes("Custom exercise"));
    assert.ok(texts(view).includes("Private to your account"));
    assert.equal(host(view, "name").props.maxLength, 120);
    assert.equal(host(view, "instructions").props.maxLength, 4000);
    assert.equal(host(view, "instructions").props.multiline, true);
    assert.equal(view.tree.root.findByType("KeyboardAvoidingView").props.behavior, "padding");
    assert.equal(view.tree.root.findByType("ScrollView").props.keyboardShouldPersistTaps, "handled");
    assert.equal(textOf(host(view, "save")), "Save and add");
    assert.equal(flat(host(view, "save").props.style).backgroundColor, theme.Colors[scheme].primaryButton);
    for (const [prefix, choices, selected] of [["type", taxonomy.EXERCISE_TYPE_OPTIONS, "strength"], ["muscle", taxonomy.EXERCISE_PRIMARY_MUSCLE_OPTIONS, "chest"], ["secondary", taxonomy.EXERCISE_SECONDARY_MUSCLE_OPTIONS.filter(({ value }) => value !== "chest"), null]]) {
      for (const item of choices) {
        const choice = host(view, `${prefix}-${item.value}`);
        assert.equal(choice.props.accessibilityLabel, item.label);
        assert.equal(choice.props.accessibilityRole, "button");
        assert.equal(choice.props.accessibilityState.selected, selected === item.value);
      }
    }
    assert.deepEqual(plain(host(view, "save").props.accessibilityState), { disabled: false, busy: false });
    await close(view);
  });

  test(`${scheme}: primary selection excludes that secondary and retains other selected muscles`, async () => {
    const view = await form(scheme);
    await tap(host(view, "secondary-back"));
    await tap(host(view, "secondary-biceps"));
    await tap(host(view, "muscle-back"));
    assert.equal(host(view, "secondary-back"), undefined);
    assert.equal(host(view, "secondary-biceps").props.accessibilityState.selected, true);
    assert.equal(host(view, "secondary-chest").props.accessibilityState.selected, false);
    await tap(host(view, "muscle-chest"));
    assert.equal(host(view, "secondary-back").props.accessibilityState.selected, false);
    await tap(host(view, "secondary-biceps"));
    assert.equal(host(view, "secondary-biceps").props.accessibilityState.selected, false);
    await close(view);
  });

  test(`${scheme}: all type choices and independent bodyweight/equipment selections preserve semantics`, async () => {
    const view = await form(scheme);
    for (const item of taxonomy.EXERCISE_TYPE_OPTIONS) {
      await tap(host(view, `type-${item.value}`));
      for (const other of taxonomy.EXERCISE_TYPE_OPTIONS) assert.equal(host(view, `type-${other.value}`).props.accessibilityState.selected, other.value === item.value);
    }
    assert.equal(host(view, "bodyweight").props.accessibilityState.selected, true);
    await tap(host(view, "equipment-fixture-equipment-1"));
    await tap(host(view, "equipment-fixture-equipment-2"));
    assert.equal(host(view, "bodyweight").props.accessibilityState.selected, false);
    assert.equal(host(view, "equipment-fixture-equipment-1").props.accessibilityState.checked, true);
    await tap(host(view, "equipment-fixture-equipment-1"));
    assert.equal(host(view, "equipment-fixture-equipment-1").props.accessibilityState.checked, false);
    await tap(host(view, "bodyweight"));
    assert.equal(host(view, "bodyweight").props.accessibilityState.selected, true);
    assert.ok(equipmentRows(view).every((node) => node.props.accessibilityState.checked === false));
    assert.equal(host(view, "type-cardio").props.accessibilityState.selected, true);
    await close(view);
  });

  test(`${scheme}: equipment uses trimmed case-insensitive filter before first-40 slice`, async () => {
    const view = await form(scheme);
    assert.equal(equipmentRows(view).length, 40);
    assert.equal(host(view, "equipment-fixture-equipment-41"), undefined);
    await change(view, "equipment-search", "  STATION 4  ");
    assert.deepEqual(equipmentRows(view).map((node) => node.props.accessibilityLabel), equipment.slice(39).map((item) => item.name));
    await change(view, "equipment-search", "no fixture matches");
    assert.equal(equipmentRows(view).length, 0);
    assert.ok(host(view, "bodyweight"));
    await change(view, "equipment-search", "");
    assert.equal(equipmentRows(view).length, 40);
    await close(view);
  });

  for (const [label, field, value, error] of [
    ["blank name", "name", "   ", "Enter an exercise name."],
    ["overlong name", "name", "x".repeat(121), "Exercise names must be 120 characters or fewer."],
    ["overlong raw instructions", "instructions", " ".repeat(4001), "Instructions must be 4,000 characters or fewer."],
  ]) test(`${scheme}: ${label} blocks service calls and exposes the exact alert`, async () => {
    const view = await form(scheme);
    await change(view, "name", "Fixture name");
    await change(view, field, value);
    await pressSave(view);
    assert.equal(textOf(host(view, "error")), error);
    assert.equal(host(view, "error").props.accessibilityRole, "alert");
    assert.deepEqual(view.calls.creates, []);
    assert.deepEqual(view.calls.routes, []);
    await close(view);
  });

  test(`${scheme}: 31 equipment items block save, then 30 pass unchanged`, async () => {
    const view = await form(scheme);
    await change(view, "name", "Fixture name");
    for (const item of equipment.slice(0, 31)) await tap(host(view, `equipment-${item.id}`));
    await pressSave(view);
    assert.equal(textOf(host(view, "error")), "Choose no more than 30 equipment items.");
    assert.deepEqual(view.calls.creates, []);
    await tap(host(view, "equipment-fixture-equipment-31"));
    await pressSave(view);
    assert.deepEqual(view.calls.creates, [["fixture-token-A", { ...defaultPayload, equipmentIds: equipment.slice(0, 30).map((item) => item.id) }]]);
    assert.equal(host(view, "error"), undefined);
    await close(view);
  });

  test(`${scheme}: create trims name, normalizes blank instructions and attaches server result through actual provider`, async () => {
    const created = exercise(), view = await form(scheme, { create: async () => created });
    await change(view, "name", "  Fixture name  ");
    await change(view, "instructions", " \n ");
    await pressSave(view);
    assert.deepEqual(view.calls.creates, [["fixture-token-A", defaultPayload]]);
    assert.deepEqual(view.calls.updates, []);
    assert.deepEqual(view.calls.routes, [["dismiss", 2]]);
    assert.equal(view.day.exercises.length, 1);
    const attached = view.day.exercises[0];
    assert.equal(attached.exerciseId, created.id);
    assert.equal(attached.blockType, "main");
    assert.equal(attached.sets, 3);
    assert.equal(attached.repsMin, 8);
    assert.equal(attached.repsMax, 12);
    assert.equal(attached.restSeconds, 90);
    assert.deepEqual(plain(attached.exercise), { id: created.id, name: created.name, exerciseType: created.exerciseType, primaryMuscle: created.primaryMuscle, secondaryMuscles: created.secondaryMuscles, equipmentIds: created.equipmentIds, imageUrl: created.imageUrl, isFavorited: created.isFavorited, source: "custom", isEditable: true });
    await close(view);
  });

  test(`${scheme}: populated create sends exact taxonomy/equipment arrays and trimmed instructions`, async () => {
    const view = await form(scheme);
    await change(view, "name", "Fixture name");
    await tap(host(view, "type-bodyweight"));
    await tap(host(view, "muscle-quads"));
    await tap(host(view, "secondary-glutes"));
    await tap(host(view, "secondary-full_body"));
    await tap(host(view, "equipment-fixture-equipment-3"));
    await change(view, "instructions", "  Setup\nMove slowly.  ");
    await pressSave(view);
    assert.deepEqual(view.calls.creates, [["fixture-token-A", { name: "Fixture name", exerciseType: "bodyweight", primaryMuscle: "quads", secondaryMuscles: ["glutes", "full_body"], equipmentIds: ["fixture-equipment-3"], instructions: "Setup\nMove slowly." }]]);
    await close(view);
  });

  test(`${scheme}: accepted name/instructions limits retain 120/4000 characters`, async () => {
    const view = await form(scheme);
    await change(view, "name", "n".repeat(120));
    await change(view, "instructions", "i".repeat(4000));
    await pressSave(view);
    assert.deepEqual(view.calls.creates, [["fixture-token-A", { ...defaultPayload, name: "n".repeat(120), instructions: "i".repeat(4000) }]]);
    await close(view);
  });

  test(`${scheme}: edit waits for actual loading state, hydrates fields and updates with Back without a day`, async () => {
    const pending = deferred(), view = await form(scheme, { exerciseId: "fixture-edit-1", noDay: true, read: () => pending.promise });
    assert.deepEqual(view.calls.reads, [["fixture-edit-1", "fixture-token-A"]]);
    assert.ok(host(view, "loading"));
    assert.ok(texts(view).includes("Loading exercise…"));
    assert.equal(host(view, "save"), undefined);
    await settle(pending, exercise());
    assert.equal(host(view, "name").props.value, "Fixture custom row");
    assert.equal(host(view, "instructions").props.value, "Fixture setup cues");
    assert.equal(host(view, "type-accessory").props.accessibilityState.selected, true);
    assert.equal(host(view, "muscle-back").props.accessibilityState.selected, true);
    assert.equal(host(view, "secondary-biceps").props.accessibilityState.selected, true);
    assert.equal(host(view, "equipment-fixture-equipment-1").props.accessibilityState.checked, true);
    assert.equal(textOf(host(view, "save")), "Save changes");
    await change(view, "name", "  Edited fixture  ");
    await pressSave(view);
    assert.deepEqual(view.calls.updates, [["fixture-token-A", "fixture-edit-1", { name: "Edited fixture", exerciseType: "accessory", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipmentIds: ["fixture-equipment-1"], instructions: "Fixture setup cues" }]]);
    assert.deepEqual(view.calls.creates, []);
    assert.deepEqual(view.calls.routes, [["back"]]);
    assert.equal(view.draft.days.length, 0);
    await close(view);
  });

  test(`${scheme}: edit with day attaches returned exercise and uses Back`, async () => {
    const view = await form(scheme, { exerciseId: "fixture-edit-1" });
    await pressSave(view);
    assert.equal(view.day.exercises[0].exerciseId, "fixture-custom-1");
    assert.deepEqual(view.calls.routes, [["back"]]);
    await close(view);
  });

  test(`${scheme}: edit preserves taxonomy fallbacks, legacy instructions and inherited secondary duplicates`, async () => {
    const view = await form(scheme, { exerciseId: "fixture-edit-1", read: async () => exercise({ exerciseType: "unsupported", primaryMuscle: "unsupported", secondaryMuscles: ["unsupported", "chest", "biceps", "biceps"], instructions: null, howTo: "Legacy fixture cues" }) });
    assert.equal(host(view, "type-strength").props.accessibilityState.selected, true);
    assert.equal(host(view, "muscle-chest").props.accessibilityState.selected, true);
    assert.equal(host(view, "secondary-chest"), undefined);
    assert.equal(host(view, "instructions").props.value, "Legacy fixture cues");
    await pressSave(view);
    assert.deepEqual(view.calls.updates[0][2].secondaryMuscles, ["chest", "biceps", "biceps"]);
    await close(view);
  });

  test(`${scheme}: edit excludes valid loaded primary from secondary and blank legacy cues normalize null`, async () => {
    const view = await form(scheme, { exerciseId: "fixture-edit-1", read: async () => exercise({ secondaryMuscles: ["back", "biceps", "unsupported"], instructions: null, howTo: undefined }) });
    assert.equal(host(view, "instructions").props.value, "");
    await pressSave(view);
    assert.deepEqual(view.calls.updates[0][2].secondaryMuscles, ["biceps"]);
    assert.equal(view.calls.updates[0][2].instructions, null);
    await close(view);
  });

  test(`${scheme}: failed load preserves shared error/Retry copy then reloads exact ID/token`, async () => {
    const view = await form(scheme, { exerciseId: "fixture-edit-1", read: async () => { throw new Error("fixture load failure"); } });
    assert.ok(host(view, "load-error"));
    assert.ok(texts(view).includes("Exercise unavailable"));
    assert.ok(texts(view).includes("This custom exercise couldn’t load. Check your connection and try again."));
    assert.equal(host(view, "save"), undefined);
    view.setRead(async () => exercise());
    await tap(view.tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === "Retry"));
    assert.deepEqual(view.calls.reads, [["fixture-edit-1", "fixture-token-A"], ["fixture-edit-1", "fixture-token-A"]]);
    assert.equal(host(view, "name").props.value, "Fixture custom row");
    await close(view);
  });

  test(`${scheme}: guest edit shows exact sign-in error and Retry performs no service call`, async () => {
    const view = await form(scheme, { exerciseId: "fixture-edit-1", account: { token: null, user: null } });
    assert.ok(texts(view).includes("Sign in again to edit this exercise."));
    await tap(view.tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === "Retry"));
    assert.deepEqual(view.calls.reads, []);
    assert.deepEqual(view.calls.updates, []);
    await tap(back(view));
    assert.deepEqual(view.calls.routes, [["back"]]);
    await close(view);
  });

  for (const [label, options] of [["guest create", { account: { token: null, user: null } }], ["create without day or exercise ID", { noDay: true }]]) {
    test(`${scheme}: ${label} keeps visible Save as guarded no-op`, async () => {
      const view = await form(scheme, options);
      await change(view, "name", "Fixture name");
      assert.equal(host(view, "save").props.disabled, false);
      await pressSave(view);
      assert.deepEqual(view.calls.creates, []);
      assert.deepEqual(view.calls.routes, []);
      assert.equal(host(view, "error"), undefined);
      await close(view);
    });
  }

  test(`${scheme}: idle Back delegates shared header callback without saving`, async () => {
    const view = await form(scheme);
    await change(view, "name", "Unsaved fixture");
    await tap(back(view));
    assert.deepEqual(view.calls.routes, [["back"]]);
    assert.deepEqual(view.calls.creates, []);
    assert.equal(view.day.exercises.length, 0);
    await close(view);
  });

  test(`${scheme}: failed save restores Save/Back and exact alert; retry clears error and saves`, async () => {
    const view = await form(scheme, { create: async () => { throw new Error("fixture save failure"); } });
    await change(view, "name", "Fixture name");
    await pressSave(view);
    assert.equal(textOf(host(view, "error")), "The exercise couldn’t be saved. Check your connection and try again.");
    assert.equal(view.calls.warnings.length, 1);
    assert.equal(view.calls.warnings[0][0], "Custom exercise couldn't be saved");
    assert.equal(host(view, "save").props.disabled, false);
    assert.equal(back(view).props.disabled, false);
    assert.deepEqual(view.calls.routes, []);
    assert.equal(view.day.exercises.length, 0);
    view.setCreate(async () => exercise());
    await pressSave(view);
    assert.equal(view.calls.creates.length, 2);
    assert.equal(host(view, "error"), undefined);
    assert.deepEqual(view.calls.routes, [["dismiss", 2]]);
    await close(view);
  });

  test(`${scheme}: pending save disables only Save/Back, guards duplicate calls and retains original submitted values`, async () => {
    const pending = deferred(), view = await form(scheme, { create: () => pending.promise });
    await change(view, "name", "Fixture name");
    await pressSave(view);
    assert.deepEqual(plain(host(view, "save").props.accessibilityState), { disabled: true, busy: true });
    assert.equal(textOf(host(view, "save")), "Saving…");
    assert.equal(back(view).props.disabled, true);
    await act(async () => host(view, "save").props.onPress());
    assert.equal(view.calls.creates.length, 1);
    for (const id of ["name", "instructions", "equipment-search"]) assert.notEqual(host(view, id).props.editable, false);
    await change(view, "name", "Edited while saving");
    await change(view, "instructions", "Active field");
    await change(view, "equipment-search", "station 01");
    await tap(host(view, "type-cardio"));
    await tap(host(view, "muscle-quads"));
    await tap(host(view, "secondary-glutes"));
    await tap(host(view, "equipment-fixture-equipment-1"));
    await tap(host(view, "bodyweight"));
    assert.equal(host(view, "name").props.value, "Edited while saving");
    assert.deepEqual(view.calls.creates, [["fixture-token-A", defaultPayload]]);
    await settle(pending, exercise());
    assert.equal(host(view, "save").props.disabled, false);
    assert.equal(back(view).props.disabled, false);
    assert.deepEqual(view.calls.routes, [["dismiss", 2]]);
    await close(view);
  });

  for (const reject of [false, true]) test(`${scheme}: stale load ${reject ? "failure" : "success"} cannot cross exercise request changes`, async () => {
    const old = deferred(), current = deferred();
    const view = await form(scheme, { exerciseId: "fixture-edit-old", read: (id) => id === "fixture-edit-old" ? old.promise : current.promise });
    await view.params({ exerciseId: "fixture-edit-current" });
    await settle(old, reject ? new Error("stale fixture") : exercise({ name: "Stale fixture" }), reject);
    assert.ok(host(view, "loading"));
    assert.equal(host(view, "load-error"), undefined);
    await settle(current, exercise({ name: "Current fixture" }));
    assert.equal(host(view, "name").props.value, "Current fixture");
    assert.deepEqual(view.calls.reads, [["fixture-edit-old", "fixture-token-A"], ["fixture-edit-current", "fixture-token-A"]]);
    await close(view);
  });

  test(`${scheme}: account change resets form/provider and fences stale load response`, async () => {
    const old = deferred(), current = deferred();
    const view = await form(scheme, { exerciseId: "fixture-edit-1", read: (_id, token) => token === "fixture-token-A" ? old.promise : current.promise });
    await view.account("fixture-token-B");
    assert.equal(view.draft.days.length, 0);
    await settle(old, exercise({ name: "Account A fixture" }));
    assert.ok(host(view, "loading"));
    await settle(current, exercise({ name: "Account B fixture" }));
    assert.equal(host(view, "name").props.value, "Account B fixture");
    assert.deepEqual(view.calls.reads, [["fixture-edit-1", "fixture-token-A"], ["fixture-edit-1", "fixture-token-B"]]);
    await close(view);
  });

  test(`${scheme}: token refresh on same user resets form but keeps provider day`, async () => {
    const view = await form(scheme);
    await change(view, "name", "Unsaved fixture");
    await tap(host(view, "type-cardio"));
    await tap(host(view, "equipment-fixture-equipment-1"));
    await view.account("fixture-token-refreshed", "fixture-account-A");
    assert.equal(host(view, "name").props.value, "");
    assert.equal(host(view, "type-strength").props.accessibilityState.selected, true);
    assert.equal(host(view, "bodyweight").props.accessibilityState.selected, true);
    assert.equal(view.day.exercises.length, 0);
    await close(view);
  });

  for (const reject of [false, true]) test(`${scheme}: account change fences pending save ${reject ? "failure" : "success"}`, async () => {
    const pending = deferred(), view = await form(scheme, { create: () => pending.promise });
    await change(view, "name", "Fixture name");
    await pressSave(view);
    await view.account("fixture-token-B");
    await settle(pending, reject ? new Error("stale save fixture") : exercise(), reject);
    assert.deepEqual(view.calls.routes, []);
    assert.deepEqual(view.calls.warnings, []);
    assert.equal(host(view, "error"), undefined);
    assert.equal(host(view, "name").props.value, "");
    assert.equal(view.draft.days.length, 0);
    await close(view);
  });

  for (const operation of ["load", "save"]) for (const reject of [false, true]) test(`${scheme}: unmounted ${operation} ignores late ${reject ? "failure" : "success"}`, async () => {
    const pending = deferred();
    const view = await form(scheme, operation === "load" ? { exerciseId: "fixture-edit-1", read: () => pending.promise } : { create: () => pending.promise });
    if (operation === "save") { await change(view, "name", "Fixture name"); await pressSave(view); }
    await close(view);
    await settle(pending, reject ? new Error("unmounted fixture") : exercise(), reject);
    assert.deepEqual(view.calls.routes, []);
    assert.deepEqual(view.calls.warnings, []);
  });

  test(`${scheme}: latest mutation fences an older save after same-account request reset`, async () => {
    const old = deferred(), current = deferred(), view = await form(scheme, { create: () => old.promise, update: () => current.promise });
    await change(view, "name", "Fixture name");
    await pressSave(view);
    await view.params({ exerciseId: "fixture-edit-current" });
    await pressSave(view);
    await settle(old, exercise({ id: "fixture-stale-save" }));
    assert.deepEqual(view.calls.routes, []);
    assert.equal(host(view, "save").props.disabled, true);
    await settle(current, exercise({ id: "fixture-current-save" }));
    assert.deepEqual(view.calls.routes, [["back"]]);
    assert.deepEqual(plain(view.day.exercises.map((item) => item.exerciseId)), ["fixture-current-save"]);
    await close(view);
  });

  test(`${scheme}: inherited same-account request change alone does not cancel an earlier mutation`, async () => {
    const pending = deferred(), view = await form(scheme, { create: () => pending.promise });
    await change(view, "name", "Fixture name");
    await pressSave(view);
    await view.params({ exerciseId: "fixture-edit-current" });
    assert.equal(host(view, "name").props.value, "Fixture custom row");
    await settle(pending, exercise({ id: "fixture-earlier-save" }));
    assert.deepEqual(view.calls.routes, [["dismiss", 2]]);
    assert.deepEqual(plain(view.day.exercises.map((item) => item.exerciseId)), ["fixture-earlier-save"]);
    await close(view);
  });
}
