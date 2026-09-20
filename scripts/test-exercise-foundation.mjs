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
function load(relative, mocks = {}, globals = {}) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const require = (name) => name in mocks ? mocks[name] : fallback(name);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require, setTimeout, clearTimeout, console, ...globals }, { filename });
  return module.exports;
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const exercise = (id) => ({ id: String(id), name: `Exercise ${id}`, isFavorited: false, exerciseType: "strength", primaryMuscle: "legs" });
const page = (items, offset = 0, has_more = false) => ({ items, offset, limit: 50, total: 250, has_more });

test("new reviewed timed exercises are reference-only without changing legacy selection", () => {
  const { isReferenceOnlyExercise } = load("utils/exerciseTracking.ts");
  assert.equal(isReferenceOnlyExercise({ contentVersion: "hash", trackingMode: "duration" }), true);
  assert.equal(isReferenceOnlyExercise({ contentVersion: "hash", trackingMode: "distance" }), true);
  assert.equal(isReferenceOnlyExercise({ contentVersion: "hash", trackingMode: "reps" }), false);
  assert.equal(isReferenceOnlyExercise({ trackingMode: "duration" }), false);
});

test("web bootstrap does not invoke unavailable native notification APIs", () => {
  const source = readFileSync(path.join(root, "app/_layout.tsx"), "utf8");
  assert.match(source, /Platform\.OS === "web" \? null : coachNotificationIntent\(Notifications\.getLastNotificationResponse\(\)/);
  assert.match(source, /if \(Platform\.OS === "web"\) return;\s*const subscription = Notifications\.addNotificationResponseReceivedListener/);
});

test("web tokens are in-memory, clear on logout, and do not survive a fresh module", async () => {
  const store = load("services/tokenStorage.web.ts");
  assert.equal(await store.getAccessToken(), null);
  await store.setAccessToken("test-access");
  await store.setRefreshToken("test-refresh");
  assert.equal(await store.getAccessToken(), "test-access");
  assert.equal(await store.getRefreshToken(), "test-refresh");
  const fresh = load("services/tokenStorage.web.ts");
  assert.equal(await fresh.getRefreshToken(), null);
  await store.clearTokens();
  assert.equal(await store.getAccessToken(), null);
  assert.equal(await store.getRefreshToken(), null);
});

function exerciseHarness(fetchPage) {
  const AuthContext = React.createContext(null);
  const { useExercisePages } = load("hooks/use-exercise-pages.ts", { "@/utils/authContext": { AuthContext }, "@/services/exerciseService": { getExercisePage: fetchPage } });
  let latest;
  function Component({ query = "", types = [] }) { latest = useExercisePages(query, types); return null; }
  const element = (account = "A", query = "", types = []) => React.createElement(AuthContext.Provider, { value: { token: account, user: { id: account } } }, React.createElement(Component, { query, types }));
  return { element, get current() { return latest; } };
}

test("catalog pagination reaches 250 items in 50-item pages without duplicates", async () => {
  const offsets = [];
  const harness = exerciseHarness(async ({ offset, limit }) => { offsets.push(offset); return page(Array.from({ length: limit }, (_, i) => exercise(offset + i)), offset, offset + limit < 250); });
  let renderer;
  await act(async () => { renderer = create(harness.element()); });
  for (let i = 0; i < 4; i++) await act(async () => { await harness.current.loadMore(); });
  assert.equal(harness.current.items.length, 250);
  assert.equal(new Set(harness.current.items.map((item) => item.id)).size, 250);
  assert.equal(harness.current.hasMore, false);
  assert.deepEqual(offsets, [0, 50, 100, 150, 200]);
  await act(async () => renderer.unmount());
});

test("delayed catalog responses cannot cross account or query changes", async () => {
  const calls = [];
  const harness = exerciseHarness((params, token) => { const request = deferred(); calls.push({ params, token, ...request }); return request.promise; });
  let renderer;
  await act(async () => { renderer = create(harness.element("A", "squat")); });
  await act(async () => renderer.update(harness.element("B", "press")));
  await act(async () => calls[1].resolve(page([exercise("B-press")])));
  await act(async () => calls[0].resolve(page([exercise("A-squat")])));
  assert.equal(harness.current.items[0].id, "B-press");
  await act(async () => renderer.update(harness.element("B", "row")));
  assert.equal(harness.current.items.length, 0);
  assert.equal(calls[2].params.offset, 0);
  await act(async () => calls[2].resolve(page([exercise("B-row")])));
  assert.equal(harness.current.items[0].id, "B-row");
  await act(async () => renderer.unmount());
});

test("append and refresh failures retain loaded rows and retry the failed offset", async () => {
  const calls = [];
  const harness = exerciseHarness((params) => { const request = deferred(); calls.push({ params, ...request }); return request.promise; });
  let renderer;
  await act(async () => { renderer = create(harness.element()); });
  await act(async () => calls[0].resolve(page([exercise(1)], 0, true)));
  await act(async () => { void harness.current.loadMore(); });
  await act(async () => calls[1].reject(new Error("offline")));
  assert.equal(harness.current.items.length, 1);
  assert.ok(harness.current.error);
  await act(async () => { void harness.current.retry(); });
  assert.equal(calls[2].params.offset, 50);
  await act(async () => calls[2].resolve(page([exercise(2)], 50, false)));
  await act(async () => { void harness.current.refresh(); });
  assert.equal(harness.current.items.length, 2);
  assert.equal(harness.current.loading, false);
  assert.equal(harness.current.refreshing, true);
  await act(async () => calls[3].reject(new Error("offline")));
  assert.equal(harness.current.items.length, 2);
  await act(async () => { void harness.current.retry(); });
  assert.equal(calls[4].params.offset, 0);
  await act(async () => calls[4].resolve(page([exercise(3)])));
  assert.equal(harness.current.items[0].id, "3");
  await act(async () => renderer.unmount());
});

test("weights category advances each type separately when one type is exhausted", async () => {
  const calls = [];
  const harness = exerciseHarness(async (params) => { calls.push(params); return page([exercise(`${params.type}-${params.offset}`)], params.offset, params.type === "strength" && params.offset === 0); });
  let renderer;
  await act(async () => { renderer = create(harness.element("A", "", ["strength", "accessory"])); });
  await act(async () => { await harness.current.loadMore(); });
  assert.equal(calls.length, 3);
  assert.equal(calls[2].type, "strength");
  assert.equal(calls[2].offset, 50);
  assert.equal(harness.current.items.length, 3);
  await act(async () => renderer.unmount());
});

test("combined search preserves the other result type, retries append, and fences stale requests", async () => {
  const calls = [];
  const { useExploreSearchPages } = load("hooks/use-explore-search-pages.ts", { "@/services/programService": { searchExplore: (...args) => { const request = deferred(); calls.push({ args, ...request }); return request.promise; } } });
  let latest;
  function Component({ account, query }) { latest = useExploreSearchPages(account, account, query, "all"); return null; }
  const element = (account, query) => React.createElement(Component, { account, query });
  let renderer;
  await act(async () => { renderer = create(element("A", "press")); });
  const initial = { programs: [{ id: "p1" }], exercises: [exercise(1)], program_pagination: { offset: 0, limit: 50, has_more: false }, exercise_pagination: { offset: 0, limit: 50, has_more: true } };
  await act(async () => calls[0].resolve(initial));
  await act(async () => { void latest.load("exercises"); });
  await act(async () => calls[1].reject(new Error("offline")));
  assert.equal(latest.result.programs.length, 1);
  assert.equal(latest.result.exercises.length, 1);
  await act(async () => { void latest.load("exercises"); });
  assert.equal(calls[2].args[3].exerciseOffset, 50);
  await act(async () => calls[2].resolve({ programs: [], exercises: [exercise(2)], exercise_pagination: { offset: 50, limit: 50, has_more: false } }));
  assert.equal(latest.result.programs[0].id, "p1");
  assert.equal(latest.result.exercises.length, 2);
  await act(async () => renderer.update(element("A", "row")));
  await act(async () => renderer.update(element("B", "squat")));
  await act(async () => calls[4].resolve({ programs: [], exercises: [exercise("B")]}));
  await act(async () => calls[3].resolve(initial));
  assert.equal(latest.result.exercises[0].id, "B");
  await act(async () => renderer.unmount());
});

test("exercise adapters preserve structured, legacy, custom content and page metadata", async () => {
  const requests = [];
  const service = load("services/exerciseService.ts", { "./httpClient": { requestJson: async (...args) => { requests.push(args); return { items: [exercise(1)], limit: 50, offset: 200, total: 201, has_more: false, catalog_version: "7" }; } } });
  const result = await service.getExercisePage({ limit: 50, offset: 200, q: "front squat" }, "token");
  assert.equal(result.total, 201);
  assert.equal(result.catalog_version, "7");
  assert.equal(result.has_more, false);
  assert.match(requests[0][0], /offset=200/);
  assert.equal(requests[0][1].token, "token");
  const base = { id: "squat", name: "Squat", exercise_type: "strength", primary_muscle: "quads" };
  const structured = service.mapApiDetailToExerciseDetail({ ...base, content_version: "hash", structured_content: { steps: ["Stand tall.", "Bend your knees."], cues: ["Keep control."], mistakes: ["Rushing."], benefits: "Leg strength.", beginner_guidance: "Start light." }, media: { id: "video", url: "https://media.example/demo", mime_type: "video/mp4" } });
  assert.equal(structured.howTo, "1. Stand tall.\n\n2. Bend your knees.");
  assert.equal(structured.contentVersion, "hash");
  assert.equal(structured.media.id, "video");
  assert.equal(service.mapApiDetailToExerciseDetail({ ...base, how_to: "Legacy instructions" }).howTo, "Legacy instructions");
  assert.equal(service.mapApiDetailToExerciseDetail({ ...base, source: "user", instructions: "My instructions" }).howTo, "My instructions");
});

test("reviewed single dumbbell displays one weight while paired and legacy retain pair totals", () => {
  const weights = load("utils/weightUnits.ts", { "@react-native-async-storage/async-storage": {} });
  const { resolveFriendlyLoad } = load("utils/attainableLoads.ts", { "@/utils/weightUnits": weights });
  const input = { targetWeightKg: 10, reason: "hold", equipmentIds: ["dumbbells"], weightUnit: "KG", dumbbellWeights: [], plateWeights: [] };
  assert.equal(resolveFriendlyLoad({ ...input, loadProfile: { basis: "per_implement", implement_count: 1 } }).displayText, "10 kg");
  assert.equal(resolveFriendlyLoad({ ...input, loadProfile: { basis: "per_implement", implement_count: 2 } }).displayText, "20 kg total");
  assert.equal(resolveFriendlyLoad(input).displayText, "20 kg total");
  assert.equal(resolveFriendlyLoad({ ...input, loadProfile: { basis: "per_implement", implement_count: 1 } }).workingWeightKg, 10);
});

test("inline media starts on tap, contains the frame, pauses on background/blur and retries failures", async () => {
  let focused = true;
  let status = "readyToPlay";
  let listener;
  let timer;
  const players = [];
  const AppState = { currentState: "active", addEventListener: (_event, callback) => { listener = callback; return { remove: () => { listener = null; } }; } };
  const colors = { inputBackground: "#fff", text: "#000", placeholder: "#666", primaryButton: "purple", background: "#fff" };
  const { ExerciseMedia } = load("components/exercises/ExerciseMedia.tsx", {
    "@expo/vector-icons": { Ionicons: "Icon" },
    "@react-navigation/native": { useIsFocused: () => focused },
    expo: { useEvent: () => ({ status }) },
    "expo-image": { Image: "Image" },
    "expo-video": { VideoView: "VideoView", useVideoPlayer: () => {
      const player = React.useMemo(() => {
        const value = { status, plays: 0, pauses: 0, released: false, play() { assert.equal(this.released, false); this.plays++; }, pause() { assert.equal(this.released, false); this.pauses++; } };
        players.push(value);
        return value;
      }, []);
      React.useEffect(() => () => { player.released = true; }, [player]);
      return player;
    } },
    "react-native": { ActivityIndicator: "ActivityIndicator", AppState, Linking: {}, Pressable: "Pressable", Text: "Text", View: "View", StyleSheet: { create: (styles) => styles, absoluteFillObject: {} } },
    "@/constants/theme": { Colors: { light: colors }, Fonts: { sans: "sans" } },
  }, { setTimeout: (callback) => { timer = callback; return 1; }, clearTimeout: () => { timer = null; } });
  const element = (active = true) => React.createElement(ExerciseMedia, { imageUrl: "https://example.com/poster.png", media: { id: "approved", url: "https://example.com/video", mime_type: "video/mp4" }, exerciseName: "Squat", colors, active });
  let renderer;
  await act(async () => { renderer = create(element()); });
  assert.equal(players.length, 0);
  await act(async () => renderer.root.findByType("Image").props.onError());
  assert.equal(renderer.root.findAllByType("Image").length, 0);
  await act(async () => renderer.root.findByProps({ testID: "exercise-watch-demo" }).props.onPress());
  assert.equal(players[0].plays, 1);
  const video = renderer.root.findByType("VideoView");
  assert.equal(video.props.contentFit, "contain");
  assert.equal(video.props.nativeControls, true);
  assert.equal(video.props.fullscreenOptions.enable, true);
  await act(async () => listener("background"));
  assert.equal(players[0].pauses, 1);
  await act(async () => listener("active"));
  assert.equal(players[0].plays, 1);
  focused = false;
  await act(async () => renderer.update(element()));
  assert.equal(players[0].pauses, 2);
  focused = true;
  await act(async () => renderer.update(element()));
  assert.equal(players[0].plays, 1, "Returning must not restart a paused video");
  status = "error";
  await act(async () => renderer.update(element()));
  assert.ok(renderer.root.findByProps({ testID: "exercise-video-error" }));
  status = "loading";
  await act(async () => renderer.root.findByProps({ testID: "exercise-video-retry" }).props.onPress());
  assert.equal(players[0].released, true);
  assert.equal(players.length, 2);
  await act(async () => timer());
  assert.ok(renderer.root.findByProps({ testID: "exercise-video-error" }));
  await act(async () => renderer.unmount());
  assert.equal(players[1].released, true);
  assert.equal(listener, null);
});
