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
  vm.runInNewContext(output, { module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), setTimeout, clearTimeout, console: { ...console, warn() {} } }, { filename });
  return module.exports;
}
const native = { ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", View: "View", Text: "Text", TextInput: "TextInput", ScrollView: "ScrollView", TouchableOpacity: "TouchableOpacity", StyleSheet: { create: (styles) => styles }, Platform: { select: (values) => values.ios }, useWindowDimensions: () => ({ fontScale: 1 }) };
const { Colors, Fonts } = load("constants/theme.ts", { "react-native": native });
const display = load("utils/programDisplay.ts", { "@/utils/localDate": { localDateIso: () => "2026-10-11" } });
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node, pressed = false) => flat(typeof node.props.style === "function" ? node.props.style({ pressed }) : node.props.style);
const rgb = (hex) => (hex.length === 4 ? hex.slice(1).split("").map((part) => part.repeat(2)) : hex.slice(1).match(/../g)).map((part) => parseInt(part, 16));
const luminance = (values) => values.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
function pillContrast(text, surface) {
  const foreground = luminance(rgb(styleOf(text).color));
  const [red, green, blue, alpha] = styleOf(text.parent).backgroundColor.match(/[\d.]+/g).map(Number);
  const background = luminance(rgb(surface).map((value, index) => value * (1 - alpha) + [red, green, blue][index] * alpha));
  return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
}
const textOf = (node) => typeof node === "string" ? node : (node?.children?.map(textOf).join(" ") ?? "").replace(/\s+/g, " ");
const host = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const summary = (id = "plan", extra = {}) => ({ id, name: "Three-day full body strength and conditioning", description: "A practical training plan with progressive targets for every exercise.", scope: "system", frequency: 3, durationMinutes: 35, goal: "build-muscle", level: "no-experience", equipmentCompatible: true, missingEquipmentIds: [], matchReasons: ["Matches your available training days"], ...extra });
function components(scheme) {
  const mocks = { react: React, "react-native": native, "@expo/vector-icons": { Ionicons: "Ionicons" }, "@/components/themed-text": { ThemedText: "Text" }, "@/constants/theme": { Colors, Fonts }, "@/hooks/use-color-scheme": { useColorScheme: () => scheme }, "@/utils/programDisplay": display };
  return { mocks, ...load("components/program/ProgramCard.tsx", mocks), ...load("components/explore/FavoritesCard.tsx", mocks) };
}

for (const scheme of ["light", "dark"]) {
  const colors = Colors[scheme];
  test(`${scheme}: favorites is neutral, readable and preserves its action`, async () => {
    const { FavoritesCard } = components(scheme);
    let presses = 0;
    let tree;
    await act(async () => { tree = create(React.createElement(FavoritesCard, { count: 12, onPress: () => presses++ })); });
    const card = host(tree, "explore-favorites");
    assert.equal(styleOf(card).backgroundColor, colors.inputBackground);
    assert.equal(styleOf(card).borderColor, colors.inputBorder);
    assert.ok(styleOf(card).minHeight >= 44);
    assert.ok(styleOf(card, true).opacity < styleOf(card).opacity);
    assert.match(card.props.accessibilityLabel, /12 exercises/);
    assert.match(textOf(card), /Favorites.*12 exercises/);
    assert.equal(tree.root.findAllByType("Text").some((node) => node.props.numberOfLines), false);
    await act(async () => card.props.onPress());
    assert.equal(presses, 1);
    await act(async () => tree.unmount());
  });

  for (const compact of [false, true]) {
    test(`${scheme}: ${compact ? "compact" : "full"} program card keeps statuses, equipment and cadence`, async () => {
      const { ProgramCard } = components(scheme);
      let presses = 0;
      let tree;
      await act(async () => { tree = create(React.createElement(ProgramCard, { program: summary("plan", { isActive: true }), compact, onPress: () => presses++ })); });
      const card = host(tree, "program-card-plan");
      assert.equal(styleOf(card).backgroundColor, colors.inputBackground);
      assert.match(card.props.accessibilityLabel, /New to training.*3 days per week.*Equipment ready/);
      assert.match(card.props.accessibilityLabel, /, Active$/);
      assert.match(textOf(card), /Active.*Build muscle.*Matches your available training days/);
      const activeText = tree.root.findAllByType("Text").find((node) => textOf(node) === "Active");
      assert.ok(pillContrast(activeText, colors.inputBackground) >= 4.5, `${scheme} Active pill contrast`);
      assert.equal(styleOf(host(tree, "program-card-level-plan")).color, colors.text);
      const cadence = tree.root.findByProps({ accessibilityLabel: "3 training days per week" });
      assert.equal(cadence.children.filter((node) => styleOf(node).backgroundColor === colors.icon).length, 3);
      assert.equal(cadence.children.filter((node) => styleOf(node).backgroundColor === colors.inputBorder).length, 4);
      assert.equal(tree.root.findAllByType("Text").some((node) => node.props.numberOfLines), false);
      await act(async () => card.props.onPress());
      assert.equal(presses, 1);
      await act(async () => tree.update(React.createElement(ProgramCard, { program: summary("plan", { isScheduled: true, equipmentCompatible: false, missingEquipmentIds: ["barbell"] }), compact, onPress() {} })));
      assert.match(textOf(host(tree, "program-card-plan")), /Starts next week.*1 item missing/);
      assert.match(host(tree, "program-card-plan").props.accessibilityLabel, /1 item missing, Starts next week$/);
      const scheduledText = tree.root.findAllByType("Text").find((node) => textOf(node) === "Starts next week");
      assert.ok(pillContrast(scheduledText, colors.inputBackground) >= 4.5, `${scheme} scheduled pill contrast`);
      assert.notEqual(styleOf(host(tree, "program-card-equipment-plan")).color, colors.text);
      await act(async () => tree.update(React.createElement(ProgramCard, { program: summary("plan"), compact, onPress() {} })));
      assert.match(host(tree, "program-card-plan").props.accessibilityLabel, /Equipment ready$/);
      await act(async () => tree.update(React.createElement(ProgramCard, { program: summary("plan", { isActive: true, isScheduled: true }), compact, onPress() {} })));
      assert.match(host(tree, "program-card-plan").props.accessibilityLabel, /, Active$/);
      assert.doesNotMatch(host(tree, "program-card-plan").props.accessibilityLabel, /Starts next week/);
      await act(async () => tree.unmount());
    });
  }

  async function explore({ mine = [], active = { current: null, scheduled: null }, fail = false, favorites = [], results = { programs: [], exercises: [] }, searchError = null, favoriteFails = false, fontScale = 1 } = {}) {
    const { mocks, ProgramCard, FavoritesCard } = components(scheme);
    const AuthContext = React.createContext({ token: "A", user: { id: "A" } });
    const pushes = [];
    const searchLoads = [];
    const toggles = [];
    let resets = 0;
    let loads = 0;
    const services = {
      getRecommendedPrograms: async () => { loads++; if (fail) throw new Error("offline"); return [summary()]; },
      listPrograms: async () => ({ items: mine, total: mine.length }),
      getActiveProgram: async () => active,
    };
    const screenMocks = {
      ...mocks,
      "react-native": { ...native, useWindowDimensions: () => ({ fontScale }) },
      "expo-router": { useRouter: () => ({ push: (target) => pushes.push(target) }) },
      "@react-navigation/native": { useFocusEffect: (callback) => React.useEffect(callback, [callback]) },
      "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
      "@/components/animated-search": { AnimatedSearch: "AnimatedSearch" },
      "@/components/explore": { FavoritesCard, ExerciseRow: "ExerciseRow" },
      "@/components/program": { ProgramCard },
      "@/components/screen-state": { ScreenState: "ScreenState" },
      "@/components/exercises/CatalogPageFooter": { CatalogPageFooter: "CatalogPageFooter" },
      "@/utils/authContext": { AuthContext },
      "@/utils/programDraftContext": { useProgramDraft: () => ({ resetDraft: () => resets++ }) },
      "@/services/programService": services,
      "@/services/exerciseService": {
        getExercises: async () => [{ id: "squat", name: "Squat" }], getFavoriteExerciseItems: async () => favorites,
        favoriteExercise: async (id) => { toggles.push(["add", id]); if (favoriteFails) throw new Error("offline"); },
        unfavoriteExercise: async (id) => { toggles.push(["remove", id]); },
      },
      "@/hooks/use-explore-search-pages": { useExploreSearchPages: (_token, _account, _query, scope) => ({ result: scope === "all" ? results : { ...results, programs: scope === "exercises" ? [] : results.programs, exercises: scope === "programs" ? [] : results.exercises }, loading: false, loadingMore: false, error: searchError, load: async (scope) => searchLoads.push(scope) }) },
    };
    const { default: Screen } = load("app/(tabs)/explore.tsx", screenMocks);
    let tree;
    await act(async () => { tree = create(React.createElement(Screen)); });
    return { tree, pushes, searchLoads, toggles, services, screenMocks, AuthContext, get resets() { return resets; }, get loads() { return loads; } };
  }

  test(`${scheme}: empty Explore has one Build entry and neutral secondary navigation`, async () => {
    const view = await explore();
    assert.equal(host(view.tree, "program-create-button"), undefined);
    assert.equal(view.tree.root.findAll((node) => typeof node.type === "string" && node.props.accessibilityLabel?.startsWith("Build")).length, 1);
    await act(async () => host(view.tree, "program-create-empty").props.onPress());
    assert.equal(view.resets, 1);
    assert.equal(view.pushes[0], "/programs/builder");
    await act(async () => host(view.tree, "browse-programs").props.onPress());
    assert.equal(view.pushes[1], "/programs");
    for (const type of ["weights", "bodyweight", "cardio"]) {
      const button = host(view.tree, `exercise-category-${type}`);
      assert.ok(styleOf(button).minHeight >= 44);
      assert.equal(button.findAllByType("Ionicons")[0].props.color, colors.icon);
      await act(async () => button.props.onPress());
      assert.equal(view.pushes.at(-1).params.type, type);
    }
    await act(async () => host(view.tree, "explore-favorites").props.onPress());
    assert.equal(view.pushes.at(-1), "/explore/favorites");
    assert.equal(view.tree.root.findByType("AnimatedSearch").props.accessibilityLabel, "Search programs and exercises");
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: expanded text scrolls header/search with content and stacks section actions`, async () => {
    const normal = await explore();
    assert.equal(host(normal.tree, "explore-expanded-scroll"), undefined);
    await act(async () => normal.tree.unmount());
    const view = await explore({ fontScale: 3.1 });
    const scroll = host(view.tree, "explore-expanded-scroll");
    assert.ok(scroll.findByType("AnimatedSearch"));
    assert.ok(scroll.findByProps({ testID: "program-create-empty" }));
    assert.equal(scroll.findAllByType("ScrollView").filter((node) => node.props.horizontal !== true).length, 1);
    const heading = view.tree.root.findAllByType("Text").find((node) => textOf(node) === "Recommended for you");
    assert.equal(styleOf(heading.parent).flexDirection, "column");
    assert.equal(styleOf(heading.parent).flexWrap, "nowrap");
    assert.equal(styleOf(heading).flexBasis, "auto");
    assert.equal(styleOf(heading).width, "100%");
    const search = view.tree.root.findByType("AnimatedSearch");
    await act(async () => search.props.onChangeText("row"));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
    assert.equal(view.tree.root.findByType("AnimatedSearch"), search, "typing preserves the mounted input while content changes");
    assert.ok(host(view.tree, "explore-search-scope-all"));
    assert.equal(host(view.tree, "explore-expanded-scroll").findAllByType("ScrollView").filter((node) => node.props.horizontal !== true).length, 1);
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: populated Explore preserves build, program and equipment review routes`, async () => {
    const active = { current: { templateId: "current", templateName: "Current plan", requiresReview: true }, scheduled: { templateId: "later", templateName: "Next plan", requiresReview: false } };
    const view = await explore({ mine: [summary("mine", { scope: "private" })], active });
    assert.equal(styleOf(host(view.tree, "program-create-button")).backgroundColor, colors.inputBackground);
    await act(async () => host(view.tree, "program-create-button").props.onPress());
    assert.equal(view.resets, 1);
    await act(async () => host(view.tree, "program-card-mine").props.onPress());
    assert.equal(view.pushes.at(-1).params.templateId, "mine");
    await act(async () => host(view.tree, "active-program-banner").props.onPress());
    assert.equal(view.pushes.at(-1).pathname, "/programs/activate");
    assert.equal(view.pushes.at(-1).params.review, "equipment");
    await act(async () => host(view.tree, "scheduled-program-banner").props.onPress());
    assert.equal(view.pushes.at(-1).params.templateId, "later");
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: disabled program banner and delayed account responses remain fenced`, async () => {
    const view = await explore({ active: { current: { templateId: null, templateName: "Unavailable plan", requiresReview: false }, scheduled: null } });
    const disabled = host(view.tree, "active-program-banner");
    assert.equal(disabled.props.disabled, true);
    assert.equal(disabled.props.accessibilityState.disabled, true);
    await act(async () => disabled.props.onPress());
    assert.equal(view.pushes.length, 0);
    await act(async () => view.tree.unmount());

    const requests = [];
    const { default: Screen } = load("app/(tabs)/explore.tsx", { ...view.screenMocks, "@/services/programService": { ...view.services, getRecommendedPrograms: (token) => new Promise((resolve) => requests.push({ token, resolve })) } });
    const element = (id) => React.createElement(view.AuthContext.Provider, { value: { token: id, user: { id } } }, React.createElement(Screen));
    let tree;
    await act(async () => { tree = create(element("A")); });
    await act(async () => tree.update(element("B")));
    await act(async () => requests.find((request) => request.token === "A").resolve([summary("old-account")]));
    assert.equal(host(tree, "program-card-old-account"), undefined);
    assert.ok(host(tree, "explore-loading"));
    await act(async () => requests.find((request) => request.token === "B").resolve([summary("current-account")]));
    assert.ok(host(tree, "program-card-current-account"));
    await act(async () => tree.unmount());
  });

  test(`${scheme}: search scopes, pagination and no-result Build remain available`, async () => {
    const view = await explore({ results: { programs: [summary("search")], exercises: [{ id: "row", name: "Row" }], program_pagination: { has_more: true }, exercise_pagination: { has_more: true } } });
    await act(async () => view.tree.root.findByType("AnimatedSearch").props.onChangeText("row"));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
    const all = host(view.tree, "explore-search-scope-all");
    assert.equal(all.props.accessibilityState.selected, true);
    for (const scope of ["programs", "exercises"]) {
      const chip = host(view.tree, `explore-search-scope-${scope}`);
      assert.ok(styleOf(chip).minHeight >= 44);
      await act(async () => chip.props.onPress());
      assert.equal(host(view.tree, `explore-search-scope-${scope}`).props.accessibilityState.selected, true);
      await act(async () => host(view.tree, `explore-${scope}-load-more`).props.onLoad());
      assert.equal(view.searchLoads.at(-1), scope);
      assert.equal(host(view.tree, `explore-${scope}-load-more`).props.colors.primaryButton, colors.text);
    }
    assert.ok(host(view.tree, "program-create-button"));
    await act(async () => view.tree.unmount());
    const empty = await explore();
    await act(async () => empty.tree.root.findByType("AnimatedSearch").props.onChangeText("nothing"));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
    assert.ok(host(empty.tree, "explore-search-empty"));
    await act(async () => host(empty.tree, "program-create-button").props.onPress());
    assert.equal(empty.pushes.at(-1), "/programs/builder");
    await act(async () => empty.tree.unmount());
  });

  test(`${scheme}: Explore errors retry, and failed optimistic favorites roll back`, async () => {
    const failed = await explore({ fail: true });
    assert.ok(host(failed.tree, "explore-error"));
    assert.equal(host(failed.tree, "explore-error").props.colors.placeholder, colors.icon);
    await act(async () => host(failed.tree, "explore-error").props.onAction());
    assert.equal(failed.loads, 2);
    await act(async () => failed.tree.unmount());
    const view = await explore({ favoriteFails: true });
    await act(async () => view.tree.root.findByType("ExerciseRow").props.onToggleFavorite("squat"));
    assert.equal(view.tree.root.findByType("ExerciseRow").props.isFavorite, false);
    assert.equal(view.tree.root.findByType("ExerciseRow").props.isFavoriteDisabled, false);
    assert.deepEqual(view.toggles, [["add", "squat"]]);
    await act(async () => view.tree.unmount());
  });

  test(`${scheme}: program catalog uses the neutral compact card without changing its destination`, async () => {
    const view = await explore();
    const EquipmentContext = React.createContext({ items: [] });
    const { default: Catalog } = load("app/programs/index.tsx", { ...view.screenMocks, "expo-router": { useRouter: () => ({ push: (target) => view.pushes.push(target), back() {} }), useLocalSearchParams: () => ({}) }, "@/utils/equipmentContext": { EquipmentContext }, "@/components/program": { ...components(scheme), ProgramHeader: "ProgramHeader" }, "@/services/programService": { ...view.services, listPrograms: async () => ({ items: [summary("catalog")], total: 1 }) } });
    let tree;
    await act(async () => { tree = create(React.createElement(Catalog)); });
    const card = host(tree, "program-card-catalog");
    assert.equal(styleOf(card).width, "100%");
    assert.equal(styleOf(host(tree, "program-card-level-catalog")).color, colors.text);
    await act(async () => card.props.onPress());
    assert.equal(view.pushes.at(-1).params.templateId, "catalog");
    await act(async () => { tree.unmount(); view.tree.unmount(); });
  });
}

test("AnimatedSearch forwards an optional input label without changing existing defaults", async () => {
  const animation = { __esModule: true, default: { View: "AnimatedView" }, useAnimatedStyle: (value) => value(), useSharedValue: (value) => ({ value }), withSpring: (value) => value, withTiming: (value) => value };
  const { mocks } = components("light");
  const { AnimatedSearch } = load("components/animated-search.tsx", { ...mocks, "react-native-reanimated": animation });
  let tree;
  await act(async () => { tree = create(React.createElement(AnimatedSearch, { value: "", accessibilityLabel: "Search programs and exercises" })); });
  assert.equal(tree.root.findByType("TextInput").props.accessibilityLabel, "Search programs and exercises");
  await act(async () => tree.update(React.createElement(AnimatedSearch, { value: "" })));
  assert.equal(tree.root.findByType("TextInput").props.accessibilityLabel, undefined);
  await act(async () => tree.unmount());
});
