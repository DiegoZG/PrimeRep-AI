import assert from "node:assert/strict";
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
const source = readFileSync(path.join(root, "app/settings/training-preferences.tsx"), "utf8");
const flat = (style, pressed = false) => Object.assign({}, ...(Array.isArray(style = typeof style === "function" ? style({ pressed }) : style) ? style.flat(Infinity) : [style]).filter(Boolean));
const plain = (value) => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const palettes = {
  light: { background: "#fff", inputBackground: "#fff", inputBorder: "#E5E5E5", text: "#11181C", icon: "#687076", placeholder: "#9BA1A6", primaryButton: "#6a4ff5" },
  dark: { background: "#151718", inputBackground: "#1F1F1F", inputBorder: "#3A3A3A", text: "#ECEDEE", icon: "#9BA1A6", placeholder: "#9BA1A6", primaryButton: "#6a4ff5" },
};
const contrast = (a, b) => {
  const luminance = (hex) => {
    const full = hex.length === 4 ? `#${[...hex.slice(1)].map((digit) => digit + digit).join("")}` : hex;
    const channels = [1, 3, 5].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};
const catalog = [
  { id: "barbell", name: "Olympic barbell", category: "Free weights" },
  { id: "bench", name: "Adjustable bench", category: "Benches" },
  { id: "cable", name: "Dual adjustable cable machine with a long descriptive equipment name", category: "Cable machines" },
];
const defaults = { fitnessGoal: "build-muscle", experienceLevel: "intermediate", workoutFrequency: "3-days", workoutSplit: "upper-lower", trainingPlace: "large-gym", selectedEquipment: ["barbell"] };

async function renderScreen(options = {}) {
  const scheme = options.scheme ?? "light";
  const AuthContext = React.createContext(null);
  const WorkoutWeekContext = React.createContext(null);
  const calls = { routes: [], alerts: [], loads: [], saves: [], refreshes: [], keyboard: [] };
  const auth = { token: options.token === undefined ? "token-A" : options.token };
  const mocks = {
    react: React,
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "expo-router": { useRouter: () => ({ back: () => calls.routes.push("back") }) },
    "react-native": {
      Alert: { alert: (...args) => calls.alerts.push(args) },
      Keyboard: { dismiss: () => calls.keyboard.push("dismiss") }, Platform: { OS: "ios" },
      Modal: "Modal", Pressable: "Pressable", ScrollView: "ScrollView", KeyboardAvoidingView: "KeyboardAvoidingView", TextInput: "TextInput", View: "View",
      StyleSheet: { create: (styles) => styles },
      useWindowDimensions: () => ({ width: options.width ?? 375, fontScale: options.fontScale ?? 1 }),
    },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@/components/themed-text": { ThemedText: "ThemedText" },
    "@/components/workout/WorkoutText": { WorkoutText: ({ style, ...props }) => React.createElement("ThemedText", { ...props, style: [style, { lineHeight: undefined }] }) },
    "@/constants/theme": { Colors: palettes },
    "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@/utils/authContext": { AuthContext },
    "@/utils/workoutWeekContext": { WorkoutWeekContext },
    "@/utils/equipmentContext": { useEquipment: () => ({ items: options.catalog ?? catalog }) },
    "@/utils/localDate": { localDateIso: () => "2026-10-11", localWeekStartIso: () => "2026-10-05" },
    "@/services/onboardingService": {
      getTrainingPreferences: async (token) => { calls.loads.push(token); if (options.load) return options.load(token); return options.preferences ?? defaults; },
      updateTrainingPreferences: async (token, next, dates) => { calls.saves.push([token, plain(next), plain(dates)]); return options.save ? options.save(next) : next; },
    },
  };
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require: (name) => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected import ${name}`);
  }, console, Date, Math, Set }, { filename: "app/settings/training-preferences.tsx" });
  const Screen = module.exports.default;
  const week = { refreshWeek: async (value) => { calls.refreshes.push(plain(value)); if (options.refresh) await options.refresh(value); } };
  let tree;
  await act(async () => { tree = create(React.createElement(AuthContext.Provider, { value: auth }, React.createElement(WorkoutWeekContext.Provider, { value: week }, React.createElement(Screen)))); });
  return { tree, calls, colors: palettes[scheme] };
}
const tap = async (node) => { await act(async () => { await node.props.onPress(); }); };
const change = async (node, value) => { await act(async () => { node.props.onChangeText(value); }); };
const label = (tree, name) => tree.root.findByProps({ accessibilityLabel: name });
const muscle = (tree, name) => tree.root.findByProps({ accessibilityLabel: name, accessibilityRole: "checkbox" });
const id = (tree, name) => tree.root.findByProps({ testID: name });
const text = (tree, value) => tree.root.findAllByType("ThemedText").find((node) => node.children.join("") === value);
const unmount = async (tree) => { await act(async () => { tree.unmount(); }); };

for (const scheme of ["light", "dark"]) {
  test(`Training choices retain neutral visible selection and checked semantics in ${scheme}`, async () => {
    const { tree, colors, calls } = await renderScreen({ scheme });
    const radios = tree.root.findAllByProps({ accessibilityRole: "radio" });
    assert.equal(radios.length, 29);
    for (const node of radios) {
      const selected = node.props.accessibilityState.checked;
      assert.equal(node.props.accessibilityState.selected, selected);
      assert.equal(node.findByType("Ionicons").props.name, selected ? "checkmark-circle" : "ellipse-outline");
      assert.equal(node.findByType("Ionicons").props.color, selected ? colors.text : colors.icon);
      assert.equal(flat(node.props.style).backgroundColor, selected ? colors.inputBorder : "transparent");
      assert.ok(contrast(node.findByType("Ionicons").props.color, selected ? colors.inputBorder : colors.background) >= 3);
      assert.ok(contrast(flat(node.findByType("ThemedText").props.style).color, selected ? colors.inputBorder : colors.background) >= 4.5);
      assert.ok(flat(node.props.style).minHeight >= 44);
      assert.equal(flat(node.props.style, true).backgroundColor, colors.inputBorder);
    }
    await tap(label(tree, "Get stronger"));
    await tap(label(tree, "Advanced"));
    await tap(label(tree, "Every day"));
    await tap(label(tree, "Full body"));
    await tap(label(tree, "Home / garage gym"));
    assert.deepEqual(calls.saves, []);
    for (const name of ["Get stronger", "Advanced", "Every day", "Full body", "Home / garage gym"]) assert.equal(label(tree, name).props.accessibilityState.checked, true);
    await tap(label(tree, "Save preferences"));
    assert.deepEqual(calls.saves[0], ["token-A", { ...defaults, fitnessGoal: "get-stronger", experienceLevel: "advanced", workoutFrequency: "every-day", workoutSplit: "full-body", trainingPlace: "garage-gym" }, { weekStart: "2026-10-05", effectiveDate: "2026-10-11" }]);
    assert.deepEqual(calls.refreshes, [{ weekStart: "2026-10-05" }]);
    assert.deepEqual(calls.routes, ["back"]);
    await unmount(tree);
  });

  test(`Training equipment draft is searchable, cancellable and applied only locally in ${scheme}`, async () => {
    const { tree, colors, calls } = await renderScreen({ scheme });
    await tap(label(tree, "Edit owned equipment"));
    assert.equal(tree.root.findByType("Modal").props.visible, true);
    assert.equal(id(tree, "training-equipment-tab-selected").props.accessibilityState.selected, true);
    assert.equal(label(tree, "Olympic barbell").props.accessibilityState.checked, true);
    for (const tab of ["selected", "not-selected"]) {
      const node = id(tree, `training-equipment-tab-${tab}`);
      assert.ok(flat(node.props.style).minHeight >= 44);
      assert.equal(flat(node.props.style).backgroundColor, tab === "selected" ? colors.inputBorder : "transparent");
    }
    await tap(id(tree, "training-equipment-tab-not-selected"));
    await change(label(tree, "Search equipment"), "CABLE MACHINES");
    assert.equal(tree.root.findAllByProps({ accessibilityRole: "checkbox" }).length, 1);
    await tap(label(tree, catalog[2].name));
    assert.deepEqual(calls.saves, []);
    await tap(label(tree, "Cancel equipment changes"));
    await tap(label(tree, "Edit owned equipment"));
    assert.equal(label(tree, "Search equipment").props.value, "");
    assert.equal(id(tree, "training-equipment-tab-selected").props.accessibilityState.selected, true);
    assert.ok(text(tree, "Selected (1)"));
    await tap(id(tree, "training-equipment-tab-not-selected"));
    await tap(label(tree, "Adjustable bench"));
    await tap(id(tree, "training-equipment-tab-selected"));
    await tap(label(tree, "Olympic barbell"));
    await tap(label(tree, "Apply equipment changes"));
    assert.deepEqual(calls.saves, []);
    assert.ok(text(tree, "Adjustable bench"));
    await tap(label(tree, "Save preferences"));
    assert.deepEqual(calls.saves[0][1].selectedEquipment, ["bench"]);
    await unmount(tree);
  });

  test(`Training custom day validation, add and reachable removal preserve draft in ${scheme}`, async () => {
    const { tree, calls } = await renderScreen({ scheme });
    await tap(label(tree, "Custom"));
    await tap(label(tree, "Save preferences"));
    assert.equal(calls.alerts.at(-1)[0], "Add a custom workout");
    await tap(label(tree, "Add custom workout"));
    assert.equal(calls.alerts.at(-1)[0], "Add a workout name and muscles");
    await change(label(tree, "Workout name"), "  A long custom workout name that must stay readable  ");
    await tap(label(tree, "Chest"));
    await tap(muscle(tree, "Back"));
    await tap(label(tree, "Chest"));
    assert.equal(label(tree, "Chest").props.accessibilityState.checked, false);
    assert.equal(muscle(tree, "Back").props.accessibilityState.checked, true);
    await tap(label(tree, "Add custom workout"));
    assert.equal(label(tree, "Workout name").props.value, "");
    assert.equal(muscle(tree, "Back").props.accessibilityState.checked, false);
    const remove = label(tree, "Remove A long custom workout name that must stay readable");
    assert.ok(flat(remove.props.style).minHeight >= 44);
    assert.ok(flat(remove.props.style).minWidth >= 44);
    assert.deepEqual(calls.saves, []);
    await tap(label(tree, "Save preferences"));
    assert.equal(calls.saves[0][1].customWorkouts[0].name, "A long custom workout name that must stay readable");
    assert.deepEqual(calls.saves[0][1].customWorkouts[0].muscleGroups, ["back"]);
    assert.equal(calls.saves[0][1].customWorkouts[0].type, "custom");
    await tap(remove);
    await tap(label(tree, "Save preferences"));
    assert.equal(calls.saves.length, 1);
    assert.equal(calls.alerts.at(-1)[0], "Add a custom workout");
    await unmount(tree);
  });

  test(`Training maximum text uses scrolling titles, wrapping picker and uncapped content in ${scheme}`, async () => {
    const { tree } = await renderScreen({ scheme, fontScale: 3.1, width: 320, preferences: { ...defaults, workoutSplit: "custom", customWorkouts: [{ id: "long", name: "A lengthy custom workout name", muscleGroups: ["chest", "back", "shoulders", "triceps"] }] } });
    const title = id(tree, "training-preferences-title");
    assert.equal(title.parent.type, "ScrollView");
    await tap(label(tree, "Edit owned equipment"));
    assert.equal(id(tree, "training-equipment-title").parent.type, "ScrollView");
    assert.equal(flat(id(tree, "training-equipment-tabs").props.style).flexDirection, "column");
    for (const name of ["Cancel equipment changes", "Apply equipment changes"]) {
      assert.equal(flat(label(tree, name).props.style).width, "100%");
      assert.equal(flat(label(tree, name).props.style).maxWidth, "100%");
      assert.equal(flat(label(tree, name).parent.props.style).flexDirection, "column");
    }
    for (const name of ["Back", "Cancel equipment changes", "Apply equipment changes"]) assert.ok(flat(tree.root.findByProps({ accessibilityLabel: name, accessibilityRole: "button" }).props.style).minHeight >= 44);
    for (const node of tree.root.findAllByType("ThemedText")) {
      assert.equal(node.props.numberOfLines, undefined);
      assert.equal(node.props.maxFontSizeMultiplier, undefined);
      assert.equal(flat(node.props.style).lineHeight, undefined);
    }
    await unmount(tree);
  });

  test(`Training keyboard scrolls keep first-tap actions and dismissal in ${scheme}`, async () => {
    const { tree, calls } = await renderScreen({ scheme });
    for (const node of tree.root.findAllByType("ScrollView")) {
      assert.equal(node.props.keyboardShouldPersistTaps, "handled");
      assert.equal(node.props.keyboardDismissMode, "on-drag");
      assert.equal(node.props.automaticallyAdjustKeyboardInsets, true);
      await act(async () => { node.props.onScrollBeginDrag(); });
    }
    assert.equal(calls.keyboard.length, 2);
    assert.equal(tree.root.findAllByType("KeyboardAvoidingView").length, 0);
    assert.equal(label(tree, "Save preferences").props.disabled, false);
    await unmount(tree);
  });

  test(`Training targets, secondary actions and long equipment content stay accessible in ${scheme}`, async () => {
    const many = Array.from({ length: 120 }, (_, index) => ({ id: `item-${index}`, name: `Long equipment name ${index}`, category: "A lengthy descriptive equipment category" }));
    const { tree, colors } = await renderScreen({ scheme, catalog: many, preferences: { ...defaults, selectedEquipment: many.map((item) => item.id) } });
    await tap(label(tree, "Custom"));
    await tap(label(tree, "Edit owned equipment"));
    for (const node of tree.root.findAllByType("Pressable")) assert.ok(flat(node.props.style).minHeight >= 44);
    assert.ok(text(tree, "Selected (120)"));
    assert.ok(text(tree, "Not selected (0)"));
    for (const name of ["Cancel equipment changes", "Apply equipment changes", "Add custom workout"]) {
      const node = label(tree, name);
      assert.equal(flat(node.findByType("ThemedText").props.style).color, colors.text);
    }
    const save = label(tree, "Save preferences");
    assert.equal(flat(save.props.style).backgroundColor, colors.primaryButton);
    assert.ok(contrast(flat(save.findByType("ThemedText").props.style).color, colors.primaryButton) >= 4.5);
    assert.equal(text(tree, many[0].category).props.numberOfLines, undefined);
    assert.equal(text(tree, many[0].name).props.numberOfLines, undefined);
    await unmount(tree);
  });

  test(`Training equipment descriptions remain readable in their actual pressed surfaces in ${scheme}`, async () => {
    const { tree, colors } = await renderScreen({ scheme });
    const summary = label(tree, "Edit owned equipment");
    assert.ok(contrast(colors.icon, flat(summary.props.style, true).backgroundColor) >= 4.5);
    await tap(summary);
    const row = label(tree, "Olympic barbell");
    assert.ok(contrast(colors.icon, flat(row.props.style, true).backgroundColor) >= 4.5);
    await unmount(tree);
  });
}

test("Training save remains busy, suppresses repeated taps and keeps retryable drafts on failure", async () => {
  const pending = deferred();
  let failure = true;
  const { tree, calls } = await renderScreen({ save: async (next) => { if (failure) return pending.promise; return next; } });
  await tap(label(tree, "Get stronger"));
  await act(async () => { label(tree, "Save preferences").props.onPress(); });
  const save = label(tree, "Save preferences");
  assert.equal(save.props.disabled, true);
  assert.deepEqual(plain(save.props.accessibilityState), { disabled: true, busy: true });
  await tap(save);
  assert.equal(calls.saves.length, 1);
  await act(async () => { pending.reject(new Error("offline")); });
  assert.equal(calls.alerts.at(-1)[0], "Could Not Save Preferences");
  assert.equal(label(tree, "Get stronger").props.accessibilityState.checked, true);
  assert.equal(label(tree, "Save preferences").props.disabled, false);
  assert.deepEqual(calls.routes, []);
  failure = false;
  await tap(label(tree, "Save preferences"));
  assert.equal(calls.saves.length, 2);
  assert.deepEqual(calls.routes, ["back"]);
  await unmount(tree);
});

test("Training update refresh failure retains existing failure behavior without navigation", async () => {
  const { tree, calls } = await renderScreen({ refresh: async () => { throw new Error("offline"); } });
  await tap(label(tree, "Save preferences"));
  assert.equal(calls.saves.length, 1);
  assert.equal(calls.refreshes.length, 1);
  assert.equal(calls.alerts.at(-1)[0], "Could Not Save Preferences");
  assert.deepEqual(calls.routes, []);
  await unmount(tree);
});

test("Training catalog filters stale equipment IDs but does not invent empty-catalog writes", async () => {
  for (const items of [catalog, []]) {
    const { tree, calls } = await renderScreen({ catalog: items, preferences: { ...defaults, selectedEquipment: ["barbell", "unknown"] } });
    await tap(label(tree, "Save preferences"));
    if (items.length) assert.deepEqual(calls.saves[0][1].selectedEquipment, ["barbell"]);
    else assert.equal("selectedEquipment" in calls.saves[0][1], false);
    await unmount(tree);
  }
});

test("Training load failure remains visible through its existing alert and controls", async () => {
  const { tree, calls } = await renderScreen({ load: async () => { throw new Error("offline"); } });
  assert.equal(calls.alerts[0][0], "Could Not Load Preferences");
  assert.ok(label(tree, "Save preferences"));
  await tap(label(tree, "Back"));
  assert.deepEqual(calls.routes, ["back"]);
  assert.deepEqual(calls.saves, []);
  await unmount(tree);
});

test("Training loading state and absent token preserve existing request behavior", async () => {
  const pending = deferred();
  const { tree, calls } = await renderScreen({ load: () => pending.promise });
  assert.ok(text(tree, "Loading preferences…"));
  await act(async () => { pending.resolve(defaults); });
  assert.ok(label(tree, "Save preferences"));
  assert.deepEqual(calls.loads, ["token-A"]);
  await unmount(tree);
  const absent = await renderScreen({ token: null });
  assert.deepEqual(absent.calls.loads, []);
  assert.ok(text(absent.tree, "Loading preferences…"));
  await unmount(absent.tree);
});
