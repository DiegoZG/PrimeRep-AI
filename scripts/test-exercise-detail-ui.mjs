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
const base = "3036d5dbbb2111684a14f964f5c822eb891a2578";
function load(relative, mocks, source) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(source ?? readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), console: { ...console, warn() {} } }, { filename });
  return module.exports;
}
const native = { Pressable: "Pressable", View: "View", Text: "Text", TextInput: "TextInput", TouchableWithoutFeedback: "TouchableWithoutFeedback", ScrollView: "ScrollView", ActivityIndicator: "ActivityIndicator", StyleSheet: { create: (styles) => styles }, Platform: { OS: "ios", select: (values) => values.ios } };
const { Colors, Fonts } = load("constants/theme.ts", { "react-native": native });
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const styleOf = (node, pressed = false) => flat(typeof node.props.style === "function" ? node.props.style({ pressed }) : node.props.style);
const textOf = (node) => typeof node === "string" ? node : (node?.children?.map(textOf).join(node.type === "Text" ? "" : " ") ?? "").replace(/\s+/g, " ").trim();
const host = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const button = (tree, label) => tree.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === label);
const text = (tree, value) => tree.root.findAllByType("Text").find((node) => textOf(node) === value);
const plain = (value) => JSON.parse(JSON.stringify(value));
const tap = async (node) => { assert.ok(node); assert.equal(node.props.disabled ?? false, false); await act(async () => node.props.onPress()); };
const unmount = async (tree) => { await act(async () => tree.unmount()); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const exercise = (extra = {}) => ({ id: "squat", name: "Barbell Squat", exerciseType: "strength", primaryMuscle: "quadriceps", secondaryMuscles: ["glutes", "core"], equipmentIds: ["barbell"], isFavorited: false, howTo: "Keep the movement controlled.", whyItWorks: "Trains the legs.", commonMistakes: "Avoid rushing.", beginnerNotes: "Start light.", structuredContent: { cues: ["Brace first", "Control the descent"] }, ...extra });

async function detail(options = {}) {
  const scheme = options.scheme ?? "light";
  const colors = Colors[scheme];
  const AuthContext = React.createContext(null);
  let focusCleanup;
  let focused = true;
  let routeId = options.id === undefined ? "squat" : options.id;
  let currentEquipment = { items: [{ id: "barbell", name: "Barbell" }], isLoading: false, error: null, lastFetchedAt: "2026-10-11", ...options.equipment };
  const calls = { loads: [], favorites: [], archive: [], routes: [], alerts: [], equipment: [], dismisses: 0 };
  const ensureEquipmentLoaded = async (args) => calls.equipment.push(args);
  const mocks = {
    react: React, "react-native": { ...native, Platform: { ...native.Platform, OS: options.platform ?? "ios" }, Keyboard: { dismiss: () => { calls.dismisses += 1; } }, useWindowDimensions: () => ({ width: options.width ?? 430, fontScale: options.fontScale ?? 1 }), Alert: { alert: (...args) => calls.alerts.push(args) } },
    "@expo/vector-icons": { Ionicons: "Ionicons" }, "@/constants/theme": { Colors, Fonts }, "@/hooks/use-color-scheme": { useColorScheme: () => scheme }, "@/hooks/use-theme-color": { useThemeColor: () => colors.text },
    "expo-router": { useLocalSearchParams: () => ({ id: routeId }), useRouter: () => ({ push: (target) => calls.routes.push(["push", plain(target)]), back: () => calls.routes.push(["back"]) }) },
    "@react-navigation/native": { useFocusEffect: (callback) => React.useEffect(() => { if (!focused) return; focusCleanup = callback(); return () => { focusCleanup?.(); }; }, [callback]) },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@/utils/authContext": { AuthContext }, "@/hooks/use-is-beginner": { useIsBeginner: () => options.beginner ?? true },
    "@/utils/equipmentContext": { useEquipment: () => ({ ...currentEquipment, ensureEquipmentLoaded }) },
    "@/components/exercises/ExerciseMedia": { ExerciseMedia: "ExerciseMedia" }, "@/components/exercises/ExerciseAskThread": { ExerciseAskThread: "ExerciseAskThread" },
    "@/services/exerciseService": {
      getExerciseById: async (...args) => { calls.loads.push(args); return options.fetch ? options.fetch(...args) : exercise(options.exercise); },
      favoriteExercise: async (...args) => { calls.favorites.push(["favorite", ...args]); return options.favorite?.(...args); },
      unfavoriteExercise: async (...args) => { calls.favorites.push(["unfavorite", ...args]); return options.unfavorite?.(...args); },
      archiveCustomExercise: async (...args) => { calls.archive.push(args); return options.archive?.(...args); },
    },
  };
  mocks["@/components/themed-text"] = load("components/themed-text.tsx", mocks);
  mocks["@/components/workout/WorkoutText"] = load("components/workout/WorkoutText.tsx", mocks);
  mocks["@/components/exercises/ContentSection"] = load("components/exercises/ContentSection.tsx", mocks);
  const { default: Screen } = load("app/exercises/[id].tsx", mocks);
  const element = (account = options.guest ? null : "A") => React.createElement(AuthContext.Provider, { value: { token: account, isLoggedIn: Boolean(account), user: account ? { id: account } : null } }, React.createElement(Screen));
  let tree;
  await act(async () => { tree = create(element()); });
  return { tree, colors, calls, element, blur: () => { focused = false; focusCleanup?.(); }, equipment: async (value) => { currentEquipment = { ...currentEquipment, ...value }; await act(async () => tree.update(element())); }, route: async (id) => { routeId = id; await act(async () => tree.update(element())); } };
}

test("behavior: real detail route preserves content, approved media props and question identity", async () => {
  const media = { id: "approved-video", url: "https://example.com/demo.mp4", poster_url: "https://example.com/poster.png" };
  const view = await detail({ exercise: { media, imageUrl: "https://example.com/image.png", demoVideoUrl: "https://example.com/demo" } });
  assert.deepEqual(plain(view.calls.loads), [["squat", "A"]]);
  assert.equal(textOf(host(view.tree, "exercise-equipment-names")), "Barbell");
  const props = view.tree.root.findByType("ExerciseMedia").props;
  assert.deepEqual(plain(props.media), media);
  assert.equal(props.exerciseName, "Barbell Squat");
  assert.equal(props.demoVideoUrl, "https://example.com/demo");
  assert.deepEqual(plain(view.tree.root.findByType("ExerciseAskThread").props), plain({ exerciseId: "squat", token: "A", isLoggedIn: true, colors: view.colors, detailPresentation: true }));
  for (const label of ["Target Muscles", "Equipment", "Form cues", "New to this?", "How to perform", "Why this exercise", "Common mistakes", "Ask about this exercise"]) assert.ok(text(view.tree, label));
  const howTo = view.tree.root.findAllByType("Pressable").find((node) => textOf(node) === "How to perform");
  await tap(howTo);
  assert.ok(text(view.tree, "Keep the movement controlled."));
  await tap(howTo);
  assert.equal(text(view.tree, "Keep the movement controlled."), undefined);
  await unmount(view.tree);
});

test("behavior: absent content and expert view do not invent instructions or beginner cards", async () => {
  const view = await detail({ beginner: false, exercise: { secondaryMuscles: [], primaryMuscle: null, structuredContent: null, howTo: null, whyItWorks: null, commonMistakes: null } });
  assert.ok(text(view.tree, "Not specified"));
  for (const label of ["Secondary", "Form cues", "New to this?", "How to perform", "Why this exercise", "Common mistakes"]) assert.equal(text(view.tree, label), undefined);
  assert.equal(view.tree.root.findByType("ExerciseMedia").props.media, undefined);
  await unmount(view.tree);
});

test("behavior: equipment labels distinguish bodyweight, pending, unknown and failed names", async () => {
  for (const [data, expected] of [
    [{ exercise: { equipmentIds: [] } }, "Bodyweight — no equipment required"],
    [{ exercise: { equipmentIds: ["missing"] }, equipment: { lastFetchedAt: null } }, "Loading equipment details…"],
    [{ exercise: { equipmentIds: ["missing"] } }, "Unknown equipment (missing)"],
    [{ exercise: { equipmentIds: ["barbell", "missing"] }, equipment: { error: "offline" } }, "Barbell, Some equipment details couldn't load"],
  ]) {
    const view = await detail(data);
    assert.equal(textOf(host(view.tree, "exercise-equipment-names")), expected);
    const retry = button(view.tree, "Retry loading equipment names");
    if (data.equipment?.error) { await tap(retry); assert.deepEqual(plain(view.calls.equipment), [null, { force: true }]); }
    else assert.equal(retry, undefined);
    await unmount(view.tree);
  }
});

test("behavior: guest has no favorite action and retains guest question props and Back", async () => {
  const view = await detail({ guest: true });
  assert.equal(button(view.tree, "Add Barbell Squat to favorites"), undefined);
  assert.equal(view.tree.root.findByType("ExerciseAskThread").props.isLoggedIn, false);
  await tap(button(view.tree, "Back from exercise"));
  assert.deepEqual(view.calls.routes, [["back"]]);
  await unmount(view.tree);
});

test("behavior: favorite and unfavorite keep optimistic feedback, busy state and exact requests", async () => {
  const request = deferred();
  const view = await detail({ favorite: () => request.promise });
  await act(async () => { void button(view.tree, "Add Barbell Squat to favorites").props.onPress(); });
  assert.equal(button(view.tree, "Remove Barbell Squat from favorites").props.disabled, true);
  assert.deepEqual(plain(view.calls.favorites), [["favorite", "squat", "A"]]);
  await act(async () => request.resolve());
  await tap(button(view.tree, "Remove Barbell Squat from favorites"));
  assert.deepEqual(plain(view.calls.favorites), [["favorite", "squat", "A"], ["unfavorite", "squat", "A"]]);
  await unmount(view.tree);
});

test("behavior: favorite failure rolls back and retains explicit Cancel/Try Again alert", async () => {
  const view = await detail({ favorite: () => Promise.reject(new Error("offline")) });
  await tap(button(view.tree, "Add Barbell Squat to favorites"));
  assert.ok(button(view.tree, "Add Barbell Squat to favorites"));
  assert.equal(view.calls.alerts[0][0], "Favorite wasn't updated");
  assert.deepEqual(plain(view.calls.alerts[0][2].map((item) => item.text)), ["Cancel", "Try Again"]);
  await act(async () => view.calls.alerts[0][2][1].onPress());
  assert.equal(view.calls.favorites.length, 2);
  await unmount(view.tree);
});

test("behavior: failed detail request and missing ID preserve retry and Back states", async () => {
  let attempts = 0;
  const view = await detail({ fetch: async () => { if (++attempts === 1) throw new Error("offline"); return exercise(); } });
  assert.ok(text(view.tree, "offline"));
  await tap(host(view.tree, "exercise-detail-retry"));
  assert.ok(text(view.tree, "Barbell Squat"));
  await unmount(view.tree);
  const missing = await detail({ id: null });
  assert.ok(text(missing.tree, "Exercise ID not provided"));
  assert.equal(missing.calls.loads.length, 0);
  await tap(button(missing.tree, "Back from exercise error"));
  assert.deepEqual(missing.calls.routes, [["back"]]);
  await unmount(missing.tree);
});

test("behavior: delayed fetch responses are fenced by account, focus and unmount", async () => {
  const requests = [];
  const view = await detail({ fetch: () => { const request = deferred(); requests.push(request); return request.promise; } });
  await act(async () => view.tree.update(view.element("B")));
  await act(async () => requests[1].resolve(exercise({ name: "Current account exercise" })));
  await act(async () => requests[0].resolve(exercise({ name: "Old account exercise" })));
  assert.ok(text(view.tree, "Current account exercise"));
  assert.equal(text(view.tree, "Old account exercise"), undefined);
  await act(async () => view.tree.update(view.element("C")));
  view.blur();
  await act(async () => requests[2].resolve(exercise({ name: "Blurred exercise" })));
  assert.equal(text(view.tree, "Blurred exercise"), undefined);
  await unmount(view.tree);
  const unmounted = deferred();
  const closed = await detail({ fetch: () => unmounted.promise });
  await unmount(closed.tree);
  await act(async () => unmounted.resolve(exercise({ name: "Unmounted exercise" })));
  assert.equal(closed.tree.toJSON(), null);
});

test("behavior: custom edit routes, archive confirmation and failure recovery remain unchanged", async () => {
  const request = deferred();
  const view = await detail({ exercise: { isEditable: true }, archive: () => request.promise });
  await tap(host(view.tree, "custom-exercise-edit"));
  assert.deepEqual(plain(view.calls.routes), [["push", { pathname: "/programs/custom-exercise", params: { exerciseId: "squat" } }]]);
  await tap(host(view.tree, "custom-exercise-archive"));
  assert.equal(view.calls.archive.length, 0);
  assert.deepEqual(plain(view.calls.alerts[0][2].map((item) => [item.text, item.style])), [["Cancel", "cancel"], ["Archive", "destructive"]]);
  await act(async () => { void view.calls.alerts[0][2][1].onPress(); });
  assert.equal(host(view.tree, "custom-exercise-edit").props.disabled, true);
  assert.equal(button(view.tree, "Back from exercise").props.disabled, true);
  assert.deepEqual(plain(view.calls.archive), [["A", "squat"]]);
  await act(async () => request.reject(new Error("offline")));
  assert.equal(host(view.tree, "custom-exercise-archive-error").props.accessibilityRole, "alert");
  assert.equal(host(view.tree, "custom-exercise-archive").props.disabled, false);
  await unmount(view.tree);
});

test("behavior: custom archive routes back only for current focused account mutation", async () => {
  for (const stale of [false, "account", "blur", "unmount"]) {
    const request = deferred();
    const view = await detail({ exercise: { isEditable: true }, archive: () => request.promise });
    await tap(host(view.tree, "custom-exercise-archive"));
    await act(async () => { void view.calls.alerts[0][2][1].onPress(); });
    if (stale === "account") await act(async () => view.tree.update(view.element("B")));
    if (stale === "blur") view.blur();
    if (stale === "unmount") await unmount(view.tree);
    await act(async () => request.resolve());
    assert.deepEqual(view.calls.routes, stale ? [] : [["back"]]);
    if (stale !== "unmount") await unmount(view.tree);
  }
});

test("scope: fetch, equipment, favorite and archive controller bytes and shared contracts stay unchanged", () => {
  const route = "app/exercises/[id].tsx";
  const current = readFileSync(path.join(root, route), "utf8");
  const original = execFileSync("git", ["show", `${base}:${route}`], { cwd: root, encoding: "utf8" });
  const controller = (source) => source.slice(source.indexOf("  const { token, isLoggedIn, user }"), source.indexOf("\n  return (\n    <SafeAreaView"));
  assert.equal(controller(current), controller(original));
  for (const file of ["components/exercises/ExerciseMedia.tsx", "services/exerciseService.ts", "utils/exerciseTracking.ts", "constants/theme.ts", "package.json", "package-lock.json", "components/workout/WorkoutText.tsx", "components/workout/ExerciseInfoSheet.tsx"]) assert.equal(readFileSync(path.join(root, file), "utf8"), execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" }), file);
});

class HttpError extends Error { constructor(status) { super("test error"); this.status = status; } }
async function shared(relative, props = {}, options = {}) {
  const colors = Colors[options.scheme ?? "light"];
  const calls = { list: [], ask: [], routes: [] };
  const mocks = {
    react: React, "react-native": native, "@expo/vector-icons": { Ionicons: "Ionicons" },
    "@/constants/theme": { Colors, Fonts }, "@/hooks/use-theme-color": { useThemeColor: () => colors.text },
    "expo-router": { useRouter: () => ({ push: (route) => calls.routes.push(route) }) },
    "@/services/httpClient": { HttpError },
    "@/services/exerciseQaService": {
      listExerciseQuestions: async (...args) => { calls.list.push(args); return options.list ? options.list(...args) : []; },
      askExerciseQuestion: async (...args) => { calls.ask.push(args); return options.ask ? options.ask(...args) : { id: "new", question: args[2], answer: "Controlled movement." }; },
    },
  };
  mocks["@/components/themed-text"] = load("components/themed-text.tsx", mocks);
  mocks["@/components/workout/WorkoutText"] = load("components/workout/WorkoutText.tsx", mocks);
  const source = options.legacy ? execFileSync("git", ["show", `${base}:${relative}`], { cwd: root, encoding: "utf8" }) : undefined;
  const exports = load(relative, mocks, source);
  const Component = exports.ContentSection ?? exports.ExerciseAskThread;
  let tree;
  await act(async () => { tree = create(React.createElement(Component, { colors, ...props })); });
  return { tree, calls, colors };
}
const askProps = { exerciseId: "squat", token: "A", isLoggedIn: true };
const qa = (id) => ({ id, question: `Question ${id}`, answer: `Answer ${id}` });
const enterQuestion = async (tree, value) => { await act(async () => host(tree, "exercise-ask-input").props.onChangeText(value)); };
const contrast = (a, b) => {
  const luminance = (color) => (color.length === 4 ? color.slice(1).split("").map((value) => value + value).join("") : color.slice(1)).match(/[\da-f]{2}/gi).map((value) => parseInt(value, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((value, channel, index) => value + channel * [.2126, .7152, .0722][index], 0);
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
};

test("UI: both themes preserve neutral information, readable labels and semantic favorites", async () => {
  for (const scheme of ["light", "dark"]) {
    const view = await detail({ scheme, exercise: { isFavorited: true } });
    for (const label of ["Primary", "Secondary", "STRENGTH"]) {
      assert.equal(styleOf(text(view.tree, label)).color, view.colors.icon);
      assert.ok(styleOf(text(view.tree, label)).fontSize >= 14);
      assert.ok(contrast(view.colors.icon, view.colors.inputBackground) >= 4.5);
    }
    for (const name of ["fitness", "body", "barbell"]) assert.equal(view.tree.root.findAllByType("Ionicons").find((node) => node.props.name === name).props.color, view.colors.icon);
    const favorite = host(view.tree, "exercise-detail-favorite");
    assert.equal(favorite.findByType("Ionicons").props.color, "#FF4B4B");
    assert.equal(styleOf(favorite).width, 44);
    assert.equal(styleOf(favorite).height, 44);
    assert.deepEqual(plain(view.tree.root.findByType("SafeAreaView").props.edges), ["top", "bottom"]);
    await unmount(view.tree);
  }
});

test("UI: large text has controls-only header, natural exercise title and adaptive existing media props", async () => {
  for (const [width, fontScale] of [[430, 1], [375, 1], [430, 3.12], [375, 3.12]]) {
    const view = await detail({ width, fontScale });
    assert.equal(Boolean(text(view.tree, "Exercise")), fontScale < 2);
    assert.equal(styleOf(host(view.tree, "exercise-detail-back")).height, 44);
    assert.equal(styleOf(host(view.tree, "exercise-detail-name")).lineHeight, undefined);
    assert.equal(host(view.tree, "exercise-detail-name").props.numberOfLines, undefined);
    assert.equal(host(view.tree, "exercise-detail-name").props.maxFontSizeMultiplier, undefined);
    const media = view.tree.root.findByType("ExerciseMedia").props;
    assert.equal(media.height, fontScale >= 2 ? Math.round(220 * fontScale) : 220);
    assert.equal(media.colors.placeholder, view.colors.icon);
    assert.equal(media.colors.primaryButton, view.colors.primaryButton);
    await unmount(view.tree);
  }
});

test("UI: outside taps dismiss keyboard without consuming child input or actions", async () => {
  const view = await detail();
  const scroll = host(view.tree, "exercise-detail-scroll");
  assert.equal(scroll.props.keyboardShouldPersistTaps, "always");
  assert.equal(scroll.props.keyboardDismissMode, "interactive");
  assert.equal(scroll.props.automaticallyAdjustKeyboardInsets, true);
  for (const node of [scroll, host(view.tree, "exercise-detail-header")]) {
    const before = view.calls.dismisses;
    node.props.onTouchEnd({ target: 1, currentTarget: 2 });
    assert.equal(view.calls.dismisses, before);
    node.props.onTouchEnd({ target: 2, currentTarget: 2 });
  }
  for (const outside of view.tree.root.findAllByType("TouchableWithoutFeedback")) { assert.equal(outside.props.accessible, false); outside.props.onPress(); }
  assert.equal(view.calls.dismisses, 4);
  await unmount(view.tree);
});

test("UI: retry and custom edit are neutral, archive keeps high-contrast danger and wrapping targets", async () => {
  for (const scheme of ["light", "dark"]) {
    const view = await detail({ scheme, exercise: { isEditable: true } });
    const edit = host(view.tree, "custom-exercise-edit"), archive = host(view.tree, "custom-exercise-archive");
    assert.equal(styleOf(edit).minHeight, 46);
    assert.equal(styleOf(edit).flexBasis, 140);
    assert.equal(styleOf(edit, true).backgroundColor, view.colors.inputBackground);
    assert.equal(edit.findByType("Ionicons").props.color, view.colors.text);
    const danger = archive.findByType("Ionicons").props.color;
    assert.equal(danger, scheme === "dark" ? "#FF8B82" : "#B42318");
    assert.ok(contrast(danger, view.colors.background) >= 4.5);
    await unmount(view.tree);
    const error = await detail({ scheme, fetch: () => { throw new Error("offline"); } });
    assert.equal(styleOf(host(error.tree, "exercise-detail-retry")).backgroundColor, error.colors.background);
    assert.equal(styleOf(host(error.tree, "exercise-detail-retry")).minHeight, 44);
    assert.equal(styleOf(text(error.tree, "Go Back")).color, error.colors.text);
    await unmount(error.tree);
  }
});

test("UI: native keyboard drag dismissal uses each platform's supported mode", async () => {
  for (const [platform, expected] of [["ios", "interactive"], ["android", "on-drag"], ["web", "on-drag"]]) {
    const view = await detail({ platform });
    assert.equal(host(view.tree, "exercise-detail-scroll").props.keyboardDismissMode, expected);
    assert.equal(host(view.tree, "exercise-detail-scroll").props.keyboardShouldPersistTaps, "always");
    await unmount(view.tree);
  }
});

test("ContentSection: omitted and false detail presentation exactly match baseline host trees in both themes", async () => {
  for (const scheme of ["light", "dark"]) for (const props of [{ title: "How", content: "Full instruction.", icon: "list-outline" }, { title: "Beginner", content: "Start light.", highlight: true }, { title: "How", content: "Full instruction.", defaultExpanded: true }]) {
    const old = await shared("components/exercises/ContentSection.tsx", props, { scheme, legacy: true });
    for (const option of [{}, { detailPresentation: false }]) {
      const current = await shared("components/exercises/ContentSection.tsx", { ...props, ...option }, { scheme });
      assert.deepEqual(plain(current.tree.toJSON()), plain(old.tree.toJSON()));
      await unmount(current.tree);
    }
    await unmount(old.tree);
  }
});

test("ContentSection: detail collapse, expanded state, null content and highlighted notes keep behavior", async () => {
  for (const scheme of ["light", "dark"]) {
    const view = await shared("components/exercises/ContentSection.tsx", { title: "How", content: "Full instruction.", detailPresentation: true, testID: "how" }, { scheme });
    const toggle = host(view.tree, "how-toggle");
    assert.equal(toggle.props.accessibilityState.expanded, false);
    assert.equal(styleOf(toggle).minHeight, 44);
    await tap(toggle);
    assert.equal(host(view.tree, "how-toggle").props.accessibilityState.expanded, true);
    assert.equal(styleOf(text(view.tree, "Full instruction.")).lineHeight, undefined);
    await tap(host(view.tree, "how-toggle"));
    assert.equal(text(view.tree, "Full instruction."), undefined);
    await unmount(view.tree);
    const highlight = await shared("components/exercises/ContentSection.tsx", { title: "Beginner", content: "Start light.", highlight: true, detailPresentation: true, testID: "notes" }, { scheme });
    assert.equal(styleOf(host(highlight.tree, "notes")).backgroundColor, highlight.colors.inputBackground);
    assert.equal(styleOf(host(highlight.tree, "notes")).borderColor, highlight.colors.inputBorder);
    assert.equal(styleOf(text(highlight.tree, "Beginner")).lineHeight, undefined);
    assert.ok(text(highlight.tree, "Start light."));
    assert.equal(highlight.tree.root.findAllByType("Pressable").length, 0);
    await unmount(highlight.tree);
  }
  for (const detailPresentation of [false, true]) {
    const empty = await shared("components/exercises/ContentSection.tsx", { title: "Missing", content: null, detailPresentation });
    assert.equal(empty.tree.toJSON(), null);
    await unmount(empty.tree);
    const expanded = await shared("components/exercises/ContentSection.tsx", { title: "How", content: "Already open.", defaultExpanded: true, detailPresentation });
    assert.ok(text(expanded.tree, "Already open."));
    await unmount(expanded.tree);
  }
});

test("Q&A: omitted and false detail presentation exactly match baseline guest, empty and loaded trees", async () => {
  for (const scheme of ["light", "dark"]) for (const loggedIn of [false, true]) for (const items of [[], [qa("newer"), qa("older")]]) {
    const props = { ...askProps, isLoggedIn: loggedIn };
    const options = { scheme, list: () => items };
    const old = await shared("components/exercises/ExerciseAskThread.tsx", props, { ...options, legacy: true });
    for (const option of [{}, { detailPresentation: false }]) {
      const current = await shared("components/exercises/ExerciseAskThread.tsx", { ...props, ...option }, options);
      assert.deepEqual(plain(current.tree.toJSON()), plain(old.tree.toJSON()));
      await unmount(current.tree);
    }
    await unmount(old.tree);
  }
});

test("Q&A: detail thread retains oldest-first order with neutral questions and natural line metrics", async () => {
  for (const scheme of ["light", "dark"]) {
    const view = await shared("components/exercises/ExerciseAskThread.tsx", { ...askProps, detailPresentation: true }, { scheme, list: () => [qa("newer"), qa("older")] });
    assert.deepEqual(plain(view.calls.list), [["A", "squat"]]);
    const copy = textOf(host(view.tree, "exercise-qa-thread"));
    assert.ok(copy.indexOf("Question older") < copy.indexOf("Question newer"));
    const question = text(view.tree, "Question older");
    assert.equal(styleOf(question).color, view.colors.text);
    assert.equal(styleOf(question).lineHeight, undefined);
    let bubble = question.parent;
    while (bubble.type !== "View") bubble = bubble.parent;
    assert.equal(styleOf(bubble).backgroundColor, view.colors.inputBackground);
    assert.equal(styleOf(bubble).borderColor, view.colors.inputBorder);
    assert.equal(styleOf(text(view.tree, "Answer older")).lineHeight, undefined);
    await unmount(view.tree);
  }
});

test("Q&A: detail guest login and input/send targets remain accessible and explicit", async () => {
  for (const scheme of ["light", "dark"]) {
    const guest = await shared("components/exercises/ExerciseAskThread.tsx", { ...askProps, isLoggedIn: false, detailPresentation: true }, { scheme });
    const login = button(guest.tree, "Log in to ask exercise questions");
    assert.equal(styleOf(login).minHeight, 44);
    await tap(login);
    assert.deepEqual(guest.calls.routes, ["/login"]);
    assert.equal(guest.calls.list.length, 0);
    await unmount(guest.tree);
    const view = await shared("components/exercises/ExerciseAskThread.tsx", { ...askProps, detailPresentation: true }, { scheme });
    const input = host(view.tree, "exercise-ask-input"), send = host(view.tree, "exercise-ask-send");
    assert.equal(input.props.accessibilityLabel, "Exercise question");
    assert.equal(input.props.placeholderTextColor, view.colors.icon);
    assert.equal(styleOf(input).minHeight, 44);
    assert.equal(styleOf(send).width, 44);
    assert.equal(styleOf(send).height, 44);
    assert.equal(send.props.accessibilityState.disabled, true);
    await unmount(view.tree);
  }
});

test("Q&A: trimmed first-tap send guards repeats, preserves in-flight draft and appends exact response", async () => {
  for (const detailPresentation of [false, true]) {
    const request = deferred();
    const view = await shared("components/exercises/ExerciseAskThread.tsx", { ...askProps, detailPresentation }, { ask: () => request.promise });
    await enterQuestion(view.tree, "  How should I brace?  ");
    await act(async () => { void host(view.tree, "exercise-ask-send").props.onPress(); });
    assert.deepEqual(plain(view.calls.ask), [["A", "squat", "How should I brace?"]]);
    assert.equal(host(view.tree, "exercise-ask-input").props.editable, false);
    assert.equal(host(view.tree, "exercise-ask-input").props.value, "  How should I brace?  ");
    assert.equal(host(view.tree, "exercise-ask-send").props.accessibilityState.busy, true);
    await act(async () => host(view.tree, "exercise-ask-send").props.onPress());
    assert.equal(view.calls.ask.length, 1);
    await act(async () => request.resolve({ id: "response", question: "How should I brace?", answer: "Brace before descending." }));
    assert.equal(host(view.tree, "exercise-ask-input").props.value, "");
    assert.ok(text(view.tree, "Brace before descending."));
    assert.equal(host(view.tree, "exercise-ask-send").props.accessibilityState.busy, false);
    await unmount(view.tree);
  }
});

test("Q&A: blank and missing-token submits issue no question requests", async () => {
  for (const detailPresentation of [false, true]) for (const token of ["A", null]) {
    const view = await shared("components/exercises/ExerciseAskThread.tsx", { ...askProps, token, detailPresentation });
    await enterQuestion(view.tree, token ? "  " : "A question");
    await act(async () => host(view.tree, "exercise-ask-input").props.onSubmitEditing());
    assert.equal(view.calls.ask.length, 0);
    await unmount(view.tree);
  }
});

test("Q&A: 429, 503 and generic errors preserve draft, retry and exact existing copy in both modes", async () => {
  for (const detailPresentation of [false, true]) for (const [error, expected] of [[new HttpError(429), "You've hit today's limit of 20 questions. Try again tomorrow."], [new HttpError(503), "The coach is unavailable right now. Please try again shortly."], [new Error("offline"), "Something went wrong asking that. Please try again."]]) {
    let failed = true;
    const view = await shared("components/exercises/ExerciseAskThread.tsx", { ...askProps, detailPresentation }, { ask: () => { if (failed) throw error; return qa("retry"); } });
    await enterQuestion(view.tree, "Keep this draft");
    await tap(host(view.tree, "exercise-ask-send"));
    assert.ok(text(view.tree, expected));
    assert.equal(host(view.tree, "exercise-ask-input").props.value, "Keep this draft");
    assert.equal(host(view.tree, "exercise-ask-input").props.editable, true);
    if (detailPresentation) assert.equal(styleOf(text(view.tree, expected)).lineHeight, undefined);
    failed = false;
    await tap(host(view.tree, "exercise-ask-send"));
    assert.equal(text(view.tree, expected), undefined);
    assert.equal(host(view.tree, "exercise-ask-input").props.value, "");
    await unmount(view.tree);
  }
});

test("Q&A: loading, failed load and pending-unmount use unchanged cancellation controller", async () => {
  const request = deferred();
  const view = await shared("components/exercises/ExerciseAskThread.tsx", askProps, { list: () => request.promise });
  assert.ok(view.tree.root.findByType("ActivityIndicator"));
  await unmount(view.tree);
  await act(async () => request.resolve([qa("late")]));
  assert.equal(view.tree.toJSON(), null);
  const failed = await shared("components/exercises/ExerciseAskThread.tsx", { ...askProps, detailPresentation: true }, { list: () => { throw new Error("offline"); } });
  assert.ok(text(failed.tree, "Ask anything about form, tempo, or how to adapt this exercise."));
  await unmount(failed.tree);
});

test("scope: Q&A controller, friendly errors and shared caller contracts remain protected", () => {
  const file = "components/exercises/ExerciseAskThread.tsx";
  const old = execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" });
  const current = readFileSync(path.join(root, file), "utf8");
  const controller = (source) => source.slice(source.indexOf("  const router = useRouter();"), source.indexOf("  }, [questionText, token, isAsking, exerciseId]);") + "  }, [questionText, token, isAsking, exerciseId]);".length);
  assert.equal(controller(current), controller(old));
  const friendly = (source) => source.slice(source.indexOf("function friendlyErrorMessage"), source.indexOf("/**"));
  assert.equal(friendly(current), friendly(old));
  for (const file of execFileSync("rg", ["-l", "ContentSection|ExerciseAskThread", "app", "components"], { cwd: root, encoding: "utf8" }).trim().split("\n")) {
    if (["app/exercises/[id].tsx", "components/exercises/ContentSection.tsx", "components/exercises/ExerciseAskThread.tsx"].includes(file)) continue;
    const current = readFileSync(path.join(root, file), "utf8");
    const prior = execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" });
    if (file === "app/workouts/[workoutDayId].tsx") {
      const contract = (input) => {
        const parsed = ts.createSourceFile(file, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        assert.equal(parsed.parseDiagnostics.length, 0);
        const imports = parsed.statements.filter((node) => ts.isImportDeclaration(node) && node.moduleSpecifier.text === "@/components/exercises/ContentSection").map((node) => node.getText(parsed));
        const calls = [];
        const visit = (node) => {
          const tag = ts.isJsxSelfClosingElement(node) ? node.tagName : ts.isJsxElement(node) ? node.openingElement.tagName : null;
          if (tag?.getText(parsed) === "ContentSection") calls.push(node.getText(parsed));
          ts.forEachChild(node, visit);
        };
        visit(parsed);
        assert.equal(imports.length, 1);
        assert.ok(calls.length > 0);
        return { imports, calls };
      };
      assert.deepEqual(contract(current), contract(prior), file);
    } else {
      assert.equal(current, prior, file);
    }
  }
});
