import assert from "node:assert/strict";
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
const route = "app/onboarding/training-place/equipment.tsx";
const cardFile = "components/equipment/equipment-card.tsx";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const unmount = async (view) => { await act(async () => view.tree.unmount()); };
function load(file, mocks) {
  const filename = path.join(root, file);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : name.endsWith(".png") ? name : fallback(name), process: { env: {} }, __DEV__: false, console: { ...console, warn() {}, error() {} } }, { filename });
  return module.exports;
}
const native = { Pressable: "Pressable", TouchableOpacity: "TouchableOpacity", View: "View", Text: "Text", TextInput: "TextInput", ScrollView: "ScrollView", StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (values) => values.ios } };
const theme = load("constants/theme.ts", { "react-native": native });
const staticEquipment = load("constants/equipment/equipment.ts", {}).EQUIPMENT;
const helpers = load("features/onboarding/equipment-helpers.ts", { "@/constants/equipment/equipment": { EQUIPMENT: staticEquipment } });
const icons = load("constants/equipment/equipmentIcons.ts", {});
const catalog = [
  { id: "plates", name: "Plates", category: "freeWeight" },
  { id: "incline_bench", name: "Incline bench", category: "benchRack" },
  { id: "crossover_cable", name: "Crossover cable", category: "cable" },
  { id: "dumbbells", name: "Dumbbells", category: "freeWeight" },
  { id: "flat_bench", name: "Flat bench", category: "benchRack" },
  { id: "row_machine", name: "Row machine", category: "machine" },
  { id: "plate_loaded_hack_squat", name: "Hack squat", category: "plateLoaded" },
  { id: "ab_wheel", name: "Ab wheel", category: "functional" },
  { id: "olympic_barbell", name: "Olympic barbell", category: "freeWeight" },
  { id: "treadmill", name: "Treadmill", category: "cardio" },
];
const draft = { preferredName: "Alex", reason: "structure", workoutFrequency: 3, workoutSplit: "ai-optimized", trainingPlace: "", selectedEquipment: [], dumbbellWeights: [], plateWeights: [], benchPress1RM: 100 };
async function equipment(options = {}) {
  const calls = { routes: [], fields: [], stored: [], catalogReads: 0, cacheWrites: [], animations: [], edits: 0, toggles: 0 };
  const scheme = options.scheme ?? "light";
  const animated = {
    __esModule: true, default: { View: "AnimatedView", createAnimatedComponent: (component) => component },
    useSharedValue: (value) => React.useRef({ value }).current,
    useAnimatedStyle: (callback) => new Proxy({}, { get: (_, key) => callback()[key], ownKeys: () => Reflect.ownKeys(callback()), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }),
    withTiming: (value, config) => { calls.animations.push({ kind: "timing", value, config }); return value; },
    withSpring: (value, config) => { calls.animations.push({ kind: "spring", value, config }); return value; },
    withSequence: (...values) => { calls.animations.push({ kind: "sequence", values }); return values.at(-1); },
  };
  const AuthContext = React.createContext({ isBootstrapping: false, isLoggedIn: false });
  const mocks = {
    react: React, "react-native": { ...native, useColorScheme: () => scheme }, "react-native-reanimated": animated, "@expo/vector-icons": { Ionicons: "Ionicons" }, "expo-image": { Image: "Image" },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 34, ...options.insets }) },
    "@/constants/theme": theme, "@/constants/equipment/equipmentIcons": icons, "@/constants/equipment": { EQUIPMENT: staticEquipment }, "@/constants/equipment/equipment": { EQUIPMENT: staticEquipment }, "@/features/onboarding/equipment-helpers": helpers,
    "@/utils/authContext": { AuthContext }, "expo-router": { useRouter: () => ({ push: (value) => calls.routes.push(value) }), useLocalSearchParams: () => options.params ?? {} },
    "@react-native-async-storage/async-storage": { getItem: async (key) => key === "@primerep/theme-preference" ? scheme : JSON.stringify(options.data ?? draft), setItem: async (key, value) => calls.stored.push({ key, value }), removeItem: async () => {} },
    "@/services/equipmentCache": { readEquipmentCache: async () => options.fallback ? null : { items: catalog, fetchedAt: Date.now(), isUsingFallback: false }, writeEquipmentCache: async (value) => calls.cacheWrites.push(plain(value)) },
    "@/services/equipmentService": { getEquipment: async () => { calls.catalogReads += 1; if (options.fallback) throw new Error("mock catalog unavailable"); return catalog; }, mapApiItemToEquipment: (item) => item },
  };
  for (const [alias, file] of [
    ["@/utils/appearanceContext", "utils/appearanceContext.tsx"], ["@/hooks/use-color-scheme", "hooks/use-color-scheme.ts"], ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"], ["@/hooks/use-screen-transition", "hooks/use-screen-transition.ts"],
    ["@/components/themed-view", "components/themed-view.tsx"], ["@/components/animated-button", "components/animated-button.tsx"], ["@/components/animated-checkmark", "components/animated-checkmark.tsx"], ["@/components/animated-search", "components/animated-search.tsx"],
    ["@/utils/onboardingContext", "utils/onboardingContext.tsx"], ["@/utils/equipmentContext", "utils/equipmentContext.tsx"], ["@/components/equipment/equipment-card", cardFile],
  ]) mocks[alias] = load(file, mocks);
  const { AppearanceProvider } = mocks["@/utils/appearanceContext"];
  const { OnboardingContext, OnboardingProvider } = mocks["@/utils/onboardingContext"];
  const { EquipmentProvider } = mocks["@/utils/equipmentContext"];
  const { EquipmentCard } = mocks["@/components/equipment/equipment-card"];
  const { default: Screen } = load(route, mocks);
  let context;
  function RestoredScreen() {
    const onboarding = React.useContext(OnboardingContext);
    context = onboarding;
    const [seeded, setSeeded] = React.useState(!options.seedFields);
    React.useEffect(() => { if (!onboarding.isRestoring && !seeded) { onboarding.updateMultipleFields(options.seedFields); setSeeded(true); } }, [onboarding, seeded]);
    if (context.isRestoring || !seeded) return null;
    const value = { ...context, updateField: (field, next) => { calls.fields.push([field, plain(next)]); context.updateField(field, next); } };
    const child = options.card ? React.createElement(EquipmentCard, { id: "unknown-equipment", name: "Kettlebell", selected: false, onPress: () => { calls.toggles += 1; }, onPressEdit: () => { calls.edits += 1; }, ...options.card }) : React.createElement(Screen);
    return React.createElement(OnboardingContext.Provider, { value }, child);
  }
  let tree;
  await act(async () => { tree = create(React.createElement(AppearanceProvider, null, React.createElement(OnboardingProvider, null, React.createElement(EquipmentProvider, null, React.createElement(RestoredScreen))))); });
  return { tree, calls, data: () => plain(context.getOnboardingData()), update: (field, value) => context.updateField(field, value), Card: EquipmentCard };
}
const cards = (view) => view.tree.root.findAllByType(view.Card);
const card = (view, id) => cards(view).find((node) => node.props.id === id);
const row = (view, id) => card(view, id).findAllByType("TouchableOpacity")[0];
const edits = (view, id) => card(view, id).findAllByType("TouchableOpacity").slice(1);
const selected = (view) => cards(view).filter((node) => node.props.selected).map((node) => node.props.id).sort();
const next = (view) => view.tree.root.findByType("Pressable");
const originalCardCases = [
  { key: "subtitle-edit", props: { subtitle: "5, 10", showEditButton: true }, editVisible: true },
  { key: "empty-subtitle", props: { subtitle: "", showEditButton: true }, editVisible: false },
  { key: "absent-subtitle", props: { showEditButton: true }, editVisible: false },
  { key: "edit-hidden", props: { subtitle: "5, 10", showEditButton: false }, editVisible: false },
  { key: "absent-edit-handler", props: { subtitle: "5, 10", showEditButton: true, onPressEdit: undefined }, editVisible: false },
  { key: "remote-image", props: { id: "abductor_machine", imageUrl: "https://example.invalid/equipment.png", iconKey: "abductor_machine" }, editVisible: false },
  { key: "explicit-local-image", props: { id: "unknown", iconKey: "abductor_machine" }, editVisible: false },
  { key: "id-local-image", props: { id: "abductor_machine" }, editVisible: false },
  { key: "initial-image", props: { id: "unknown", category: "machine" }, editVisible: false },
];
const originalHostFixture = JSON.parse(source("scripts/fixtures/equipment-card-original-hosts.json"));
function hostDigest(tree) {
  const normalize = (value) => {
    if (typeof value === "function") return "[Callback]";
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, normalize(key === "style" ? flat(value[key]) : value[key])]));
    }
    return value;
  };
  return createHash("sha256").update(JSON.stringify(normalize(tree.toJSON()))).digest("hex");
}

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: no gym param still writes sorted garage defaults while empty arrays remain empty`, async () => {
    const view = await equipment({ scheme });
    const expected = Array.from(helpers.getDefaultEquipmentSelections(undefined, catalog)).sort();
    assert.deepEqual(view.calls.fields, [["selectedEquipment", expected]]);
    assert.deepEqual(view.data().selectedEquipment, expected);
    assert.deepEqual(view.data().plateWeights, []); assert.deepEqual(view.data().dumbbellWeights, []);
    assert.equal(edits(view, "dumbbells").length, 0); assert.equal(edits(view, "plates").length, 0);
    assert.ok(view.calls.catalogReads > 0); await unmount(view);
  });
  test(`${scheme}: absent weight arrays initialize through real provider fields even with no gym type`, async () => {
    const view = await equipment({ scheme, seedFields: { plateWeights: undefined, dumbbellWeights: undefined } });
    assert.deepEqual(view.calls.fields.map(([field]) => field), ["selectedEquipment", "plateWeights", "dumbbellWeights"]);
    assert.deepEqual(view.data().plateWeights, plain(helpers.getDefaultPlateWeights()));
    assert.deepEqual(view.data().dumbbellWeights, plain(helpers.getDefaultDumbbellWeights()));
    assert.equal(edits(view, "dumbbells").length, 1); assert.equal(edits(view, "plates").length, 1);
    await unmount(view);
  });
  test(`${scheme}: every explicit gym param resets saved choices and initializes only selected weights`, async () => {
    for (const gymType of ["large-gym", "small-gym", "garage-gym"]) {
      const view = await equipment({ scheme, params: { gymType }, data: { ...draft, trainingPlace: "garage-gym", selectedEquipment: ["treadmill"], plateWeights: [3], dumbbellWeights: [7] } });
      const expected = Array.from(helpers.getDefaultEquipmentSelections(gymType, catalog)).sort();
      assert.deepEqual(view.calls.fields, [["selectedEquipment", expected], ["plateWeights", plain(helpers.getDefaultPlateWeights())], ["dumbbellWeights", plain(helpers.getDefaultDumbbellWeights())]]);
      assert.deepEqual(view.data().selectedEquipment, expected); assert.equal(view.data().trainingPlace, "garage-gym");
      assert.equal(view.data().benchPress1RM, 100); assert.equal(view.data().workoutSplit, "ai-optimized");
      await unmount(view);
    }
  });
  test(`${scheme}: no param retains restored selections and saved weights with one sorted mount write`, async () => {
    const view = await equipment({ scheme, data: { ...draft, selectedEquipment: ["plates", "dumbbells", "ab_wheel"], plateWeights: [5, 10], dumbbellWeights: [7.5] } });
    assert.deepEqual(view.calls.fields, [["selectedEquipment", ["ab_wheel", "dumbbells", "plates"]]]);
    assert.deepEqual(view.data().plateWeights, [5, 10]); assert.deepEqual(view.data().dumbbellWeights, [7.5]);
    assert.equal(card(view, "plates").props.subtitle, "5, 10"); assert.equal(card(view, "dumbbells").props.subtitle, "7.5...");
    await unmount(view);
  });
  test(`${scheme}: real grouping preserves category order and source catalog order within categories`, async () => {
    const view = await equipment({ scheme });
    const groups = helpers.groupEquipmentByDisplayCategory(catalog);
    const titles = view.tree.root.findAllByType("Text").map(textOf).filter((value) => groups.some((group) => group.title === value));
    assert.deepEqual(titles, Array.from(groups, (group) => group.title));
    assert.deepEqual(cards(view).map((node) => node.props.id), Array.from(groups).flatMap((group) => Array.from(group.equipment, (item) => item.id)));
    assert.equal(card(view, "treadmill"), undefined); await unmount(view);
  });
  test(`${scheme}: failed mock catalog uses actual static fallback without changing selection contracts`, async () => {
    const view = await equipment({ scheme, fallback: true });
    const groups = helpers.groupEquipmentByDisplayCategory();
    assert.deepEqual(cards(view).map((node) => node.props.id), Array.from(groups).flatMap((group) => Array.from(group.equipment, (item) => item.id)));
    assert.ok(view.calls.cacheWrites.some((entry) => entry.isUsingFallback));
    assert.deepEqual(view.data().selectedEquipment, Array.from(helpers.getDefaultEquipmentSelections(undefined)).sort());
    await unmount(view);
  });
  test(`${scheme}: toggles and repeated replacements persist sorted IDs without clearing weights`, async () => {
    const view = await equipment({ scheme, data: { ...draft, selectedEquipment: ["plates"], plateWeights: [5], dumbbellWeights: [10] } });
    for (const id of ["dumbbells", "plates", "dumbbells", "dumbbells"]) await act(async () => row(view, id).props.onPress());
    assert.deepEqual(view.calls.fields.slice(1), [["selectedEquipment", ["dumbbells", "plates"]], ["selectedEquipment", ["dumbbells"]], ["selectedEquipment", []], ["selectedEquipment", ["dumbbells"]]]);
    assert.deepEqual(selected(view), ["dumbbells"]); assert.deepEqual(view.data().plateWeights, [5]); assert.deepEqual(view.data().dumbbellWeights, [10]);
    assert.deepEqual(JSON.parse(view.calls.stored.filter((entry) => entry.key === "primerep.onboardingDraft.v1").at(-1).value), view.data());
    await unmount(view);
  });
  test(`${scheme}: external context selection updates synchronize the actual cards without route writes`, async () => {
    const view = await equipment({ scheme }); const before = view.calls.fields.length;
    await act(async () => view.update("selectedEquipment", ["row_machine", "plates"]));
    assert.deepEqual(selected(view), ["plates", "row_machine"]); assert.equal(view.calls.fields.length, before);
    assert.deepEqual(view.calls.routes, []); await unmount(view);
  });
  test(`${scheme}: actual Next stays enabled with empty selection and routes directly to Notifications`, async () => {
    const view = await equipment({ scheme });
    await act(async () => view.update("selectedEquipment", [])); const before = view.calls.fields.length;
    assert.deepEqual(selected(view), []); assert.equal(next(view).props.disabled, undefined);
    await act(async () => next(view).props.onPress());
    assert.deepEqual(view.calls.routes, ["/onboarding/notifications"]); assert.equal(view.calls.fields.length, before);
    await unmount(view);
  });
  test(`${scheme}: actual search and all category links preserve destination and parameter names`, async () => {
    const view = await equipment({ scheme });
    const links = view.tree.root.findAllByType("TouchableOpacity").filter((node) => textOf(node).startsWith("See all "));
    for (const link of links) await act(async () => link.props.onPress());
    const groups = helpers.groupEquipmentByDisplayCategory(catalog);
    assert.deepEqual(plain(view.calls.routes), Array.from(groups, (group) => ({ pathname: "/onboarding/training-place/see-all", params: { category: group.title } })));
    const search = view.tree.root.findAllByType("TouchableOpacity").find((node) => node.findAllByType("TextInput").length > 0);
    assert.equal(search.findByType("TextInput").props.editable, false);
    await act(async () => search.props.onPress());
    assert.equal(view.calls.routes.at(-1), "/onboarding/training-place/search-equipment"); await unmount(view);
  });
  test(`${scheme}: route Edit remains visible with saved weights even on unchecked cards and stops propagation`, async () => {
    const view = await equipment({ scheme, data: { ...draft, selectedEquipment: ["ab_wheel"], dumbbellWeights: [5], plateWeights: [10] } });
    const before = view.data(); let stopped = 0;
    for (const id of ["dumbbells", "plates"]) {
      assert.equal(card(view, id).props.selected, false);
      await act(async () => edits(view, id)[0].props.onPress({ stopPropagation: () => { stopped += 1; } }));
    }
    assert.equal(stopped, 2);
    assert.deepEqual(view.calls.routes, ["/onboarding/training-place/edit-dumbbells", "/onboarding/training-place/edit-plates"]);
    assert.deepEqual(view.data(), before); assert.equal(view.calls.fields.length, 1); await unmount(view);
  });
  test(`${scheme}: real screen transition, checkmark and primary button retain original motion`, async () => {
    const view = await equipment({ scheme });
    assert.ok(view.calls.animations.some((entry) => entry.kind === "timing" && entry.config.duration === 250));
    assert.ok(view.calls.animations.some((entry) => entry.kind === "sequence" && entry.values.join(",") === "1.15,1"));
    await act(async () => { next(view).props.onPressIn({}); next(view).props.onPressOut({}); });
    assert.deepEqual(view.calls.animations.filter((entry) => entry.kind === "spring").map((entry) => entry.value), [0.96, 1]); await unmount(view);
  });
  test(`${scheme}: shared Card omitted and false opt-in match frozen original host trees and callbacks`, async () => {
    for (const isSelected of [false, true]) {
      for (const original of originalCardCases) {
        const fixtureKey = `${scheme}/${isSelected ? "selected" : "unselected"}/${original.key}`;
        for (const optIn of [{}, { quiet: false }]) {
          const view = await equipment({ scheme, card: { selected: isSelected, ...original.props, ...optIn } });
          assert.equal(hostDigest(view.tree), originalHostFixture.hosts[fixtureKey], fixtureKey);
          const touchables = view.tree.root.findAllByType("TouchableOpacity");
          const outer = touchables[0];
          assert.equal(flat(outer.props.style).borderColor, isSelected ? theme.Colors[scheme].primaryButton : theme.Colors[scheme].inputBorder);
          assert.equal(flat(outer.props.style).backgroundColor, theme.Colors[scheme].inputBackground);
          assert.equal(outer.props.activeOpacity, 0.7);
          assert.equal(touchables.length, original.editVisible ? 2 : 1);
          let stopped = 0;
          if (original.editVisible) {
            await act(async () => touchables[1].props.onPress({ stopPropagation: () => { stopped += 1; } }));
            assert.equal(stopped, 1); assert.equal(view.calls.edits, 1); assert.equal(view.calls.toggles, 0);
          }
          await act(async () => outer.props.onPress());
          assert.equal(view.calls.toggles, 1); assert.equal(view.calls.edits, original.editVisible ? 1 : 0);
          assert.deepEqual(view.calls.fields, []); assert.deepEqual(view.calls.routes, []);
          await unmount(view);
        }
      }
    }
  });
  test(`${scheme}: real Card image chain prefers remote, explicit local key, ID-local, then initial`, async () => {
    for (const props of [
      { id: "abductor_machine", imageUrl: "https://example.invalid/equipment.png", iconKey: "abductor_machine" },
      { id: "unknown", iconKey: "abductor_machine" }, { id: "abductor_machine" }, { id: "unknown", category: "machine" },
    ]) {
      const view = await equipment({ scheme, card: props }); const images = view.tree.root.findAllByType("Image");
      if (props.imageUrl) { assert.equal(images.length, 1); assert.deepEqual(plain(images[0].props.source), { uri: props.imageUrl }); assert.equal(images[0].props.transition, 200); }
      else if (props.iconKey || props.id === "abductor_machine") { assert.equal(images.length, 1); assert.equal(images[0].props.source, icons.equipmentIcons.abductor_machine); }
      else { assert.equal(images.length, 0); assert.ok(view.tree.root.findAllByType("Text").some((node) => textOf(node) === "K")); }
      await unmount(view);
    }
  });
  test(`${scheme}: Equipment alone opts into quiet Cards without changing routes or payloads`, async () => {
    const view = await equipment({ scheme });
    assert.ok(cards(view).length > 0); assert.ok(cards(view).every((node) => node.props.quiet === true));
    assert.equal(view.data().preferredName, draft.preferredName); assert.equal(view.data().workoutSplit, draft.workoutSplit);
    assert.deepEqual(view.calls.routes, []); await unmount(view);
  });
  test(`${scheme}: all category actions are named readable buttons with a 44 minimum target`, async () => {
    const view = await equipment({ scheme });
    const links = view.tree.root.findAllByType("TouchableOpacity").filter((node) => textOf(node).startsWith("See all "));
    assert.ok(links.length > 0);
    for (const link of links) {
      assert.equal(link.props.accessibilityRole, "button"); assert.equal(link.props.accessibilityLabel, textOf(link));
      assert.ok(flat(link.props.style).minHeight >= 44);
      assert.equal(flat(link.findByType("Text").props.style).color, theme.Colors[scheme].icon);
      assert.equal(link.findByType("Ionicons").props.color, theme.Colors[scheme].icon);
    }
    await unmount(view);
  });
  test(`${scheme}: only footer padding adapts to the bottom inset and retains natural Search and NEXT`, async () => {
    for (const bottom of [0, 34, 100]) {
      const view = await equipment({ scheme, insets: { bottom } });
      const footer = view.tree.root.findAllByType("View").find((node) => flat(node.props.style).paddingTop === 12 && node.findAllByType("Pressable").length === 1);
      assert.equal(flat(footer.props.style).paddingBottom, Math.max(40, bottom + 12));
      assert.equal(textOf(next(view)), "NEXT");
      assert.equal(view.tree.root.findByType("ScrollView").props.contentContainerStyle.paddingBottom, 180);
      assert.equal(view.tree.root.findByType("TextInput").props.editable, false);
      assert.equal(flat(next(view).findByType("Text").props.style).height, undefined);
      await unmount(view);
    }
  });
  test(`${scheme}: quiet Card exposes separate checked selection and independent neutral Edit`, async () => {
    for (const selected of [false, true]) {
      const view = await equipment({ scheme, card: { quiet: true, selected, subtitle: "5, 10", showEditButton: true } });
      const host = view.tree.toJSON(); assert.equal(host.type, "View"); assert.equal(host.props.accessible, false);
      const [selection, edit] = view.tree.root.findAllByType("TouchableOpacity");
      assert.equal(selection.props.accessibilityRole, "checkbox"); assert.deepEqual(plain(selection.props.accessibilityState), { checked: selected });
      assert.equal(selection.props.accessibilityLabel, "Kettlebell, 5, 10"); assert.ok(flat(selection.props.style).minHeight >= 44);
      assert.equal(edit.props.accessibilityRole, "button"); assert.equal(edit.props.accessibilityLabel, "Edit Kettlebell");
      assert.equal(selection.findAllByType("TouchableOpacity").length, 1);
      assert.ok(flat(edit.props.style).minHeight >= 44); assert.ok(flat(edit.props.style).minWidth >= 44);
      assert.equal(flat(edit.props.style).marginLeft + (flat(edit.props.style).paddingHorizontal || 0), flat(selection.findAllByType("View")[0].props.style).width + flat(selection.props.style).gap);
      assert.equal(flat(edit.findByType("Text").props.style).color, theme.Colors[scheme].text);
      assert.equal(flat(host.props.style).borderColor, selected ? theme.Colors[scheme].primaryButton : theme.Colors[scheme].inputBorder);
      await unmount(view);
    }
  });
  test(`${scheme}: quiet Edit preserves visibility conjunction label and propagation without selection`, async () => {
    for (const original of originalCardCases.slice(0, 5)) {
      const view = await equipment({ scheme, card: { quiet: true, ...original.props, editLabel: "Adjust" } });
      const buttons = view.tree.root.findAllByType("TouchableOpacity");
      assert.equal(buttons[0].props.accessibilityRole, "checkbox"); assert.equal(buttons.length, original.editVisible ? 2 : 1);
      if (original.editVisible) {
        let stopped = 0;
        assert.equal(textOf(buttons[1]), "Adjust"); assert.equal(buttons[1].props.accessibilityLabel, "Adjust Kettlebell");
        await act(async () => buttons[1].props.onPress({ stopPropagation: () => { stopped += 1; } }));
        assert.equal(stopped, 1); assert.equal(view.calls.edits, 1); assert.equal(view.calls.toggles, 0);
      }
      await act(async () => buttons[0].props.onPress()); assert.equal(view.calls.toggles, 1);
      assert.equal(buttons[0].props.activeOpacity, 0.7); await unmount(view);
    }
  });
  test(`${scheme}: only quiet decorative initial and animated check use fixed glyph geometry`, async () => {
    const view = await equipment({ scheme, card: { quiet: true, selected: true } });
    const initial = view.tree.root.findAllByType("Text").find((node) => textOf(node) === "K");
    assert.equal(initial.props.allowFontScaling, false); assert.equal(initial.props.accessible, false);
    const check = view.tree.root.findByType("Ionicons");
    assert.equal(check.props.name, "checkmark"); assert.equal(check.props.size, 16); assert.equal(check.props.allowFontScaling, false); assert.equal(check.props.accessible, false);
    assert.ok(view.calls.animations.some((entry) => entry.kind === "sequence" && entry.values.join(",") === "1.15,1"));
    assert.equal(view.tree.root.findAllByType("Text").some((node) => textOf(node) === "✓"), false); await unmount(view);
  });
  test(`${scheme}: quiet long names and full weight strings stay uncapped with original image priority`, async () => {
    const name = "Long fictional equipment name ".repeat(8); const subtitle = "1.25, 2.5, 5, 10, 15, 20, 25, 35, 45, 50";
    const view = await equipment({ scheme, card: { quiet: true, name, subtitle, showEditButton: true, imageUrl: "https://example.invalid/quiet.png", iconKey: "abductor_machine" } });
    const image = view.tree.root.findByType("Image"); assert.deepEqual(plain(image.props.source), { uri: "https://example.invalid/quiet.png" }); assert.equal(image.props.transition, 200);
    const [selection, edit] = view.tree.root.findAllByType("TouchableOpacity");
    assert.equal(selection.props.accessibilityLabel, `${name}, ${subtitle}`); assert.equal(edit.props.accessibilityRole, "button");
    for (const text of view.tree.root.findAllByType("Text")) {
      assert.notEqual(text.props.allowFontScaling, false); assert.equal(text.props.numberOfLines, undefined); assert.equal(text.props.maxFontSizeMultiplier, undefined);
      assert.equal(flat(text.props.style).height, undefined); assert.equal(flat(text.props.style).maxHeight, undefined);
    }
    assert.equal(flat(selection.findAllByType("Text").find((node) => textOf(node) === subtitle).props.style).color, theme.Colors[scheme].icon);
    assert.equal(textOf(edit), "Edit"); await unmount(view);
  });
}

test("scope: Equipment controller and legacy Card JSX retain original bytes", () => {
  const sha = (value) => createHash("sha256").update(value).digest("hex");
  const routeSource = source(route).replace("  const insets = useSafeAreaInsets();\n", "");
  const controller = routeSource.slice(routeSource.indexOf("export default function EquipmentScreen()"), routeSource.indexOf("\n  return (\n    <ThemedView"));
  const cardSource = source(cardFile);
  const legacy = cardSource.slice(cardSource.indexOf("\n  return (\n    <TouchableOpacity"), cardSource.indexOf("\nconst styles ="));
  assert.equal(sha(controller), "51772c8ff66357ab6da4393260b9ad111e3c06b15d60ec97f486356127b8524b");
  assert.equal(sha(legacy), "6ef78e14916f054988099bee4ec502c1c58c84f2f32a13c53b9bdcb67bc8bec1");
  assert.equal(originalHostFixture.cardSha256, "e297ae394c5732d1730eb0afc90b755ee92e5a127eca5d1123ae01834d4795e0");
  assert.equal(originalHostFixture.normalization, "sorted-props-flat-styles-callback-sentinel-v1");
  assert.equal(Object.keys(originalHostFixture.hosts).length, 36);
});
