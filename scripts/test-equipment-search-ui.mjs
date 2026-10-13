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
const route = "app/onboarding/training-place/search-equipment.tsx";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const unmount = async (view) => { await act(async () => view.tree.unmount()); };
const draftKey = "primerep.onboardingDraft.v1";
const draft = { preferredName: "Alex", trainingPlace: "large-gym", selectedEquipment: ["plates", "saved_unknown"], plateWeights: [1.25, 10], dumbbellWeights: [7.5], workoutFrequency: 3, nested: { retained: true } };
const catalog = [
  { id: "row_machine", name: "Row Machine", category: "machine" },
  { id: "plates", name: "Plates", category: "freeWeight" },
  { id: "incline_bench", name: "Incline Bench", category: "benchRack" },
  { id: "crossover_cable", name: "Crossover Cable", category: "cable", imageUrl: "https://fixture.invalid/cable.png", iconKey: "abductor_machine" },
  { id: "dumbbells", name: "Dumbbells", category: "freeWeight" },
  { id: "abductor_machine", name: "Abductor Machine", category: "machine" },
  { id: "plate_loaded_hack_squat", name: "Hack Squat", category: "plateLoaded" },
  { id: "ab_wheel", name: "Ab Wheel", category: "functional" },
  { id: "olympic_barbell", name: "Olympic Barbell", category: "freeWeight" },
  { id: "treadmill", name: "Treadmill", category: "cardio" },
  { id: "training_band", name: "Training Band", category: "bandAccessory" },
];
function load(file, mocks) {
  const filename = path.join(root, file); const module = { exports: {} }; const fallback = createRequire(filename);
  const code = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : name.endsWith(".png") ? name : fallback(name), process: { env: {} }, __DEV__: false, console: { ...console, warn() {}, error() {} } }, { filename });
  return module.exports;
}
const native = { View: "View", Text: "Text", TextInput: "TextInput", ScrollView: "ScrollView", TouchableOpacity: "TouchableOpacity", Pressable: "Pressable", ActivityIndicator: "ActivityIndicator", StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (values) => values.ios } };
const staticEquipment = load("constants/equipment/equipment.ts", {}).EQUIPMENT;
async function screen(options = {}) {
  const calls = { fields: [], reads: [], writes: [], removals: [], gets: [], ensures: [], cacheWrites: [], headers: [], animations: [], cardPresses: 0 };
  const storage = options.storage ?? new Map([[draftKey, JSON.stringify(options.data ?? draft)]]);
  const scheme = options.scheme ?? "light"; let failure = options.failure; let context; let equipmentState; let setAuth; let clearEmptyError;
  let params = options.params ?? {}; let setParams;
  let cache = "cache" in options ? options.cache : { items: catalog, fetchedAt: Date.now(), isUsingFallback: false };
  const AuthContext = React.createContext({ isBootstrapping: false, isLoggedIn: false });
  const navigation = { setOptions: (value) => calls.headers.push(plain(value)) };
  const animated = { __esModule: true, default: { View: "AnimatedView", createAnimatedComponent: (component) => component }, useSharedValue: (value) => React.useRef({ value }).current,
    useAnimatedStyle: (fn) => new Proxy({}, { get: (_, key) => fn()[key], ownKeys: () => Reflect.ownKeys(fn()), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }),
    withTiming: (value, config) => { calls.animations.push({ kind: "timing", value, config }); return value; }, withSpring: (value, config) => { calls.animations.push({ kind: "spring", value, config }); return value; }, withSequence: (...values) => { calls.animations.push({ kind: "sequence", values }); return values.at(-1); } };
  const mocks = { react: React, "react-native": { ...native, useColorScheme: () => scheme }, "react-native-reanimated": animated, "@expo/vector-icons": { Ionicons: "Ionicons" }, "expo-image": { Image: "Image" }, "@/utils/authContext": { AuthContext },
    "expo-router": { useNavigation: () => navigation, useLocalSearchParams: () => params },
    "@react-native-async-storage/async-storage": { getItem: async (key) => { calls.reads.push(key); return key === "@primerep/theme-preference" ? scheme : storage.get(key) ?? null; }, setItem: async (key, value) => { storage.set(key, value); calls.writes.push({ key, value }); }, removeItem: async (key) => { storage.delete(key); calls.removals.push(key); } },
    "@/services/equipmentCache": { readEquipmentCache: async () => cache, writeEquipmentCache: async (value) => { cache = value; calls.cacheWrites.push(plain(value)); } },
    "@/services/equipmentService": { getEquipment: async () => { calls.gets.push(failure ?? "success"); if (options.deferred) return options.deferred.promise; if (failure) throw failure === "server" ? { status: 503 } : new Error("fixture network failure"); return options.catalog ?? catalog; }, mapApiItemToEquipment: (item) => item },
    "@/constants/equipment": { EQUIPMENT: staticEquipment }, "@/constants/equipment/equipment": { EQUIPMENT: staticEquipment },
  };
  for (const [alias, file] of [["@/constants/theme", "constants/theme.ts"], ["@/constants/equipment/equipmentIcons", "constants/equipment/equipmentIcons.ts"], ["@/utils/appearanceContext", "utils/appearanceContext.tsx"], ["@/hooks/use-color-scheme", "hooks/use-color-scheme.ts"], ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"], ["@/components/themed-view", "components/themed-view.tsx"], ["@/components/themed-text", "components/themed-text.tsx"], ["@/components/animated-checkmark", "components/animated-checkmark.tsx"], ["@/components/animated-search", "components/animated-search.tsx"], ["@/components/equipment/equipment-card", "components/equipment/equipment-card.tsx"], ["@/features/onboarding/equipment-helpers", "features/onboarding/equipment-helpers.ts"], ["@/utils/onboardingContext", "utils/onboardingContext.tsx"], ["@/utils/equipmentContext", "utils/equipmentContext.tsx"]]) mocks[alias] = load(file, mocks);
  const { AppearanceProvider } = mocks["@/utils/appearanceContext"]; const { OnboardingContext, OnboardingProvider } = mocks["@/utils/onboardingContext"]; const { EquipmentContext, EquipmentProvider } = mocks["@/utils/equipmentContext"]; const { EquipmentCard } = mocks["@/components/equipment/equipment-card"];
  const { default: Screen } = load(route, mocks);
  function RestoredScreen() {
    const onboarding = React.useContext(OnboardingContext); const equipment = React.useContext(EquipmentContext); context = onboarding; equipmentState = equipment;
    const [emptyError, setEmptyError] = React.useState(options.emptyError ?? null); clearEmptyError = () => setEmptyError(null);
    const actualEnsure = equipment.ensureEquipmentLoaded;
    const ensure = React.useMemo(() => (value) => { calls.ensures.push(value ? plain(value) : null); return actualEnsure(value); }, [actualEnsure]);
    if (onboarding.isRestoring) return null;
    const equipmentValue = { ...equipment, ...(emptyError ? { items: [], isLoading: false, error: emptyError } : {}), ensureEquipmentLoaded: ensure };
    const child = options.card ? React.createElement(EquipmentCard, { id: "unknown", name: "Fixture Kettlebell", selected: false, onPress: () => { calls.cardPresses += 1; }, ...options.card }) : React.createElement(Screen);
    return React.createElement(EquipmentContext.Provider, { value: equipmentValue }, React.createElement(OnboardingContext.Provider, { value: { ...onboarding, updateField: (field, value) => { calls.fields.push([field, plain(value)]); onboarding.updateField(field, value); } } }, child));
  }
  function AccountRoot() {
    const [loggedIn, updateAuth] = React.useState(false); setAuth = updateAuth; const [value, updateParams] = React.useState(params); params = value; setParams = updateParams;
    return React.createElement(AuthContext.Provider, { value: { isBootstrapping: false, isLoggedIn: loggedIn } }, React.createElement(AppearanceProvider, null, React.createElement(OnboardingProvider, null, React.createElement(EquipmentProvider, null, React.createElement(RestoredScreen)))));
  }
  let tree; await act(async () => { tree = create(React.createElement(AccountRoot)); });
  return { tree, calls, storage, Card: EquipmentCard, colors: mocks["@/constants/theme"].Colors[scheme], data: () => plain(context.getOnboardingData()), equipment: () => equipmentState, update: (field, value) => context.updateField(field, value), setAuth, setParams, clearEmptyError, setFailure: (value) => { failure = value; } };
}
const cards = (view) => view.tree.root.findAllByType(view.Card);
const ids = (view) => cards(view).map((node) => node.props.id);
const selected = (view) => cards(view).filter((node) => node.props.selected).map((node) => node.props.id).sort();
const field = (view) => view.tree.root.findByType("TextInput");
const query = async (view, value) => { await act(async () => field(view).props.onChangeText(value)); };
const toggle = async (view, id) => { await act(async () => cards(view).find((node) => node.props.id === id).findAllByType("TouchableOpacity")[0].props.onPress()); };
const text = (view, value) => view.tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const groupedIds = (items) => [...new Set(items.map((item) => item.category))].sort().flatMap((category) => items.filter((item) => item.category === category).sort((a, b) => a.name.localeCompare(b.name)).map((item) => item.id));

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: restored selections mount without writes or gym/weight default initialization`, async () => {
    const view = await screen({ scheme }); assert.deepEqual(view.calls.fields, []); assert.deepEqual(view.data().selectedEquipment, draft.selectedEquipment);
    assert.deepEqual(view.data().plateWeights, draft.plateWeights); assert.deepEqual(view.data().dumbbellWeights, draft.dumbbellWeights); assert.equal(view.data().trainingPlace, "large-gym"); await unmount(view);
  });
  test(`${scheme}: category and name sorting preserves the full actual catalog including cardio`, async () => {
    const view = await screen({ scheme }); assert.deepEqual(ids(view), groupedIds(catalog)); assert.ok(ids(view).includes("treadmill"));
    assert.ok(text(view, "Free Weights")); assert.ok(text(view, "Cable Machines")); await unmount(view);
  });
  test(`${scheme}: live name ID category search preserves case whitespace and no-result quirks`, async () => {
    const view = await screen({ scheme });
    for (const value of ["ROW", "abductor_machine", "freeWeight", "dumbbells", " dumbbells ", " \t", "no-match"]) {
      await query(view, value); const expected = !value.trim() ? catalog : catalog.filter((item) => [item.name, item.id, item.category].some((part) => part.toLowerCase().includes(value.toLowerCase())));
      assert.deepEqual(ids(view), groupedIds(expected)); if (!expected.length) assert.ok(text(view, "No equipment found"));
    }
    assert.deepEqual(view.calls.fields, []); await unmount(view);
  });
  test(`${scheme}: repeated toggles persist sorted IDs and retain unknown selections and numeric arrays`, async () => {
    const view = await screen({ scheme }); const before = view.data(); for (const id of ["dumbbells", "plates", "dumbbells", "dumbbells"]) await toggle(view, id);
    assert.deepEqual(view.calls.fields, [["selectedEquipment", ["dumbbells", "plates", "saved_unknown"]], ["selectedEquipment", ["dumbbells", "saved_unknown"]], ["selectedEquipment", ["saved_unknown"]], ["selectedEquipment", ["dumbbells", "saved_unknown"]]]);
    assert.deepEqual(view.data(), { ...before, selectedEquipment: ["dumbbells", "saved_unknown"] }); await unmount(view);
  });
  test(`${scheme}: toggling a filtered row keeps selected equipment outside the visible results`, async () => {
    const view = await screen({ scheme }); await query(view, "ROW"); await toggle(view, "row_machine");
    assert.deepEqual(view.data().selectedEquipment, ["plates", "row_machine", "saved_unknown"]); await query(view, ""); assert.deepEqual(selected(view), ["plates", "row_machine"]); await unmount(view);
  });
  test(`${scheme}: external context replacements retain the current old-local then replacement write quirk`, async () => {
    const view = await screen({ scheme }); await act(async () => view.update("selectedEquipment", ["row_machine", "ab_wheel"]));
    const expected = [["selectedEquipment", draft.selectedEquipment], ["selectedEquipment", ["ab_wheel", "row_machine"]]];
    assert.deepEqual(selected(view), ["ab_wheel", "row_machine"]); assert.deepEqual(view.calls.fields, expected); await act(async () => view.update("selectedEquipment", ["ab_wheel", "row_machine"])); assert.deepEqual(view.calls.fields, expected); await unmount(view);
  });
  test(`${scheme}: actual draft persistence restores through a fresh provider and screen mount`, async () => {
    const view = await screen({ scheme }); await toggle(view, "ab_wheel"); const saved = view.data(); const storage = view.storage; assert.deepEqual(JSON.parse(storage.get(draftKey)), saved); await unmount(view);
    const restored = await screen({ scheme, storage }); assert.deepEqual(restored.data(), saved); assert.deepEqual(restored.calls.fields, []); await unmount(restored);
  });
  test(`${scheme}: mocked account-boundary reset retains selection synchronization writes but no gym or weight defaults`, async () => {
    const view = await screen({ scheme }); await act(async () => view.setAuth(true)); assert.deepEqual(view.data().selectedEquipment, []); assert.deepEqual(selected(view), []); assert.deepEqual(view.data().plateWeights, []); assert.ok(view.calls.removals.includes(draftKey));
    await act(async () => view.setAuth(false)); assert.deepEqual(view.data().selectedEquipment, []); assert.deepEqual(view.calls.fields, [["selectedEquipment", draft.selectedEquipment], ["selectedEquipment", []]]); await unmount(view);
  });
  test(`${scheme}: real provider pending catalog shows loading before resolving actual rows`, async () => {
    let resolve; const deferred = { promise: new Promise((done) => { resolve = done; }) }; const view = await screen({ scheme, cache: null, deferred });
    assert.ok(text(view, "Loading equipment...")); assert.equal(view.tree.root.findByType("ActivityIndicator").props.color, view.colors.primaryButton);
    await act(async () => resolve(catalog)); assert.deepEqual(ids(view), groupedIds(catalog)); assert.deepEqual(view.calls.fields, []); await unmount(view);
  });
  test(`${scheme}: ordinary network/server failures use the actual static fallback rather than empty Retry UI`, async () => {
    for (const failure of ["network", "server"]) { const view = await screen({ scheme, cache: null, failure }); assert.equal(view.equipment().error, failure); assert.equal(view.equipment().isUsingFallback, true);
      assert.equal(cards(view).length, staticEquipment.length); assert.equal(text(view, "Retry"), undefined); assert.ok(view.calls.cacheWrites.some((entry) => entry.isUsingFallback)); assert.deepEqual(view.calls.fields, []); await unmount(view); }
  });
  test(`${scheme}: stale-cache errors retain rows and forced refresh recovers through the real provider`, async () => {
    const stale = { items: catalog.slice(0, 2), fetchedAt: 1, isUsingFallback: false }; const view = await screen({ scheme, cache: stale, failure: "network" });
    assert.deepEqual(ids(view), groupedIds(stale.items)); assert.equal(view.equipment().error, "network"); assert.equal(text(view, "Retry"), undefined); view.setFailure(null);
    await act(async () => view.equipment().ensureEquipmentLoaded({ force: true })); assert.deepEqual(ids(view), groupedIds(catalog)); assert.equal(view.equipment().error, null); assert.deepEqual(view.calls.fields, []); await unmount(view);
  });
  test(`${scheme}: controlled empty-error fixture preserves exact copy and forwards Retry force to the real provider`, async () => {
    for (const error of ["network", "server"]) { const view = await screen({ scheme, emptyError: error }); assert.ok(text(view, error === "network" ? "No internet connection" : "Failed to load equipment")); const before = view.calls.gets.length;
      const retry = view.tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === "Retry"); const priorEnsures = view.calls.ensures.length; await act(async () => retry.props.onPress()); assert.deepEqual(view.calls.ensures.slice(priorEnsures).filter(Boolean), [{ force: true }]); assert.ok(view.calls.gets.length > before);
      await act(async () => view.clearEmptyError()); assert.deepEqual(ids(view), groupedIds(catalog)); assert.deepEqual(view.calls.fields, []); await unmount(view); }
  });
  test(`${scheme}: existing Search focus and checkmark timing retain real shared animations and props`, async () => {
    const view = await screen({ scheme }); assert.equal(field(view).props.placeholder, "Search for equipment"); assert.equal(field(view).props.editable, true); assert.equal(field(view).props.accessibilityLabel, "Search for equipment");
    await act(async () => field(view).props.onFocus()); assert.ok(view.calls.animations.some((entry) => entry.kind === "spring" && entry.value === 1.02)); assert.ok(view.calls.animations.some((entry) => entry.kind === "timing" && entry.value === view.colors.primaryButton && entry.config.duration === 200));
    await act(async () => field(view).props.onBlur()); assert.ok(view.calls.animations.some((entry) => entry.kind === "spring" && entry.value === 1)); assert.ok(view.calls.animations.some((entry) => entry.kind === "sequence")); await unmount(view);
  });
  test(`${scheme}: route rows opt into quiet while image priority and shared legacy default/false contracts remain`, async () => {
    const view = await screen({ scheme }); assert.ok(cards(view).every((node) => node.props.quiet === true && node.props.subtitle === undefined && node.props.showEditButton === undefined));
    const remote = cards(view).find((node) => node.props.id === "crossover_cable").findByType("Image"); assert.deepEqual(plain(remote.props.source), { uri: "https://fixture.invalid/cable.png" }); assert.equal(remote.props.transition, 200);
    const checked = cards(view).find((node) => node.props.id === "plates").findAllByType("TouchableOpacity")[0]; assert.equal(checked.props.accessibilityRole, "checkbox"); assert.deepEqual(plain(checked.props.accessibilityState), { checked: true }); assert.equal(flat(checked.parent.props.style).borderColor, view.colors.primaryButton);
    const unchecked = cards(view).find((node) => node.props.id === "dumbbells").findAllByType("TouchableOpacity")[0]; assert.equal(flat(unchecked.parent.props.style).borderColor, view.colors.inputBorder); await unmount(view);
    for (const card of [{ selected: true }, { quiet: false, selected: true }]) { const legacy = await screen({ scheme, card }); const row = legacy.tree.root.findByType("TouchableOpacity"); assert.equal(row.props.accessibilityRole, undefined); assert.equal(flat(row.props.style).borderColor, legacy.colors.primaryButton); await unmount(legacy); }
    const quiet = await screen({ scheme, card: { quiet: true, selected: true } }); const row = quiet.tree.root.findByType("TouchableOpacity"); assert.equal(row.props.accessibilityRole, "checkbox"); assert.deepEqual(plain(row.props.accessibilityState), { checked: true });
    assert.equal(quiet.tree.root.findByType("Ionicons").props.name, "checkmark"); assert.ok(quiet.tree.root.findAllByType("Text").some((node) => textOf(node) === "F" && node.props.allowFontScaling === false)); await unmount(quiet);
  });
  test(`presentation: ${scheme} route rows opt into the merged named checked Card without changing selection or user text scaling`, async () => {
    const view = await screen({ scheme }); assert.ok(cards(view).every((node) => node.props.quiet === true));
    for (const card of cards(view)) { const row = card.findAllByType("TouchableOpacity")[0]; assert.equal(row.props.accessibilityRole, "checkbox"); assert.equal(row.props.accessibilityLabel, card.props.name); assert.deepEqual(plain(row.props.accessibilityState), { checked: card.props.selected }); assert.ok(flat(row.props.style).minHeight >= 44);
      const name = card.findAllByType("Text").find((node) => textOf(node) === card.props.name); assert.notEqual(name.props.allowFontScaling, false); assert.equal(name.props.numberOfLines, undefined); }
    assert.deepEqual(selected(view), ["plates"]); assert.deepEqual(view.calls.fields, []); await unmount(view);
  });
  test(`presentation: ${scheme} actual editable Search is named and has a stable route selector`, async () => {
    const view = await screen({ scheme }); assert.equal(field(view).props.accessibilityLabel, "Search for equipment"); assert.equal(field(view).props.testID, "onboarding-equipment-search"); assert.equal(field(view).props.editable, true); assert.equal(field(view).props.placeholder, "Search for equipment"); await unmount(view);
  });
  test(`presentation: ${scheme} controlled empty-error Retry is neutral named and at least44 points with feedback`, async () => {
    const view = await screen({ scheme, emptyError: "network" }); const retry = view.tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === "Retry"); const style = (pressed) => flat(typeof retry.props.style === "function" ? retry.props.style({ pressed }) : retry.props.style);
    assert.equal(retry.props.accessibilityRole, "button"); assert.equal(retry.props.accessibilityLabel, "Retry"); assert.ok(style(false).minHeight >= 44); assert.equal(style(false).borderColor, view.colors.inputBorder); assert.notEqual(style(false).backgroundColor, view.colors.primaryButton); assert.equal(style(true).backgroundColor, view.colors.inputBackground); assert.ok(style(true).opacity < style(false).opacity); assert.equal(flat(text(view, "Retry").props.style).color, view.colors.text); assert.deepEqual(view.calls.fields, []); await unmount(view);
  });
}
test("scope: Search controller and merged shared Card/Search/provider bytes remain frozen", () => {
  const sha = (value) => createHash("sha256").update(value).digest("hex"); const s = source(route); const controller = s.slice(s.indexOf("export default function"), s.indexOf("\n  return ("));
  assert.equal(sha(controller), "9ba936260d97130f76a14ca95df6effd2a8284edb78f0e3b9b72ae4f79029aa3");
  for (const [file, hash] of Object.entries({ "components/equipment/equipment-card.tsx": "711948254f316a423a2ef4e67007f6dc5b1c3002d4dc4a9235e6d35d56e3e854", "components/animated-search.tsx": "dade4eab5655699647c05e747faa66959998ab93a494b76fbd43376bba4e68f0", "utils/equipmentContext.tsx": "1bd981c6e20e570793aa837c5588a2894664a66301bfce72868f4b3607476cd1", "utils/onboardingContext.tsx": "4e8d1c2948f77152251971d444ef527291609b58f0e9f12bc3a361e5828a994a" })) assert.equal(sha(source(file)), hash, file);
});
