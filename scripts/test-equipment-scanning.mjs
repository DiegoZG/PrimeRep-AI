import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { act, create } from "react-test-renderer";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function load(relative, mocks = {}, globals = {}) {
  const filename = path.join(root, relative); const module = { exports: {} }; const fallback = createRequire(filename);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), setTimeout, clearTimeout, AbortController, URLSearchParams, console, ...globals }, { filename });
  return module.exports;
}
function photoHarness({ assets = [{ uri: "file://photo", width: 2400, height: 1600, type: "image" }], permission = { granted: true }, cameraResult, render } = {}) {
  const calls = []; const discarded = []; const resized = [];
  const picker = { getCameraPermissionsAsync: async () => permission, requestCameraPermissionsAsync: async () => permission,
    launchCameraAsync: async (options) => { calls.push({ source: "camera", options }); return cameraResult ?? { canceled: false, assets }; },
    launchImageLibraryAsync: async (options) => { calls.push({ source: "library", options }); return { canceled: false, assets }; } };
  const normalized = { uri: "file://normalized", width: 1024, height: 683 };
  const api = load("services/equipmentScanPhoto.ts", { "expo-image-picker": picker, "expo-image-manipulator": { SaveFormat: { JPEG: "jpeg" }, ImageManipulator: { manipulate: () => ({ resize: (size) => resized.push(size), renderAsync: render ?? (async () => ({ saveAsync: async (options) => { calls.push({ save: options }); return normalized; } })) }) } }, "./privateFiles": { discardPickedPhoto: async (uri) => { discarded.push(uri); } } });
  return { api, calls, discarded, resized };
}
test("photo normalization preserves shape, fresh encodes JPEG and disables multi-selection/metadata", async () => {
  const h = photoHarness(); const photo = await h.api.pickScanPhoto("library", () => true);
  assert.equal(photo.uri, "file://normalized"); assert.equal(h.calls[0].options.allowsMultipleSelection, false); assert.equal(h.calls[0].options.selectionLimit, 1); assert.equal(h.calls[0].options.allowsEditing, false); assert.equal(h.calls[0].options.exif, false);
  assert.equal(h.resized[0].width, 1024); assert.equal(h.resized[0].height, undefined); assert.equal(h.calls[1].save.compress, 0.8); assert.equal(h.calls[1].save.format, "jpeg");
  assert.deepEqual(h.discarded, ["file://photo"]); await h.api.cleanupEquipmentScanPhotos(); assert.deepEqual(h.discarded, ["file://photo", "file://normalized"]);
});
test("small images are encoded without upscaling", async () => {
  const h = photoHarness({ assets: [{ uri: "file://small", width: 600, height: 800, type: "image" }] }); await h.api.pickScanPhoto("library", () => true); assert.equal(h.resized.length, 0);
});
test("cancelled or denied camera does not normalize or upload", async () => {
  const denied = photoHarness({ permission: { granted: false, canAskAgain: false } }); await assert.rejects(denied.api.pickScanPhoto("camera", () => true), /Allow camera/); assert.equal(denied.calls.length, 0);
  const cancelled = photoHarness({ cameraResult: { canceled: true, assets: null } }); assert.equal(await cancelled.api.pickScanPhoto("camera", () => true), null); assert.equal(cancelled.resized.length, 0);
});
test("multiple photos are rejected and every temporary original is deleted", async () => {
  const h = photoHarness({ assets: [{ uri: "file://a" }, { uri: "file://b" }] }); await assert.rejects(h.api.pickScanPhoto("library", () => true), /one still photo/); assert.deepEqual(h.discarded, ["file://a", "file://b"]);
});
test("account/retake invalidation during encoding discards late normalized photo", async () => {
  let current = true; const h = photoHarness({ render: async () => { current = false; return { saveAsync: async () => ({ uri: "file://late", width: 100, height: 200 }) }; } });
  assert.equal(await h.api.pickScanPhoto("library", () => current), null); assert.deepEqual(h.discarded, ["file://late", "file://photo"]);
});

const fixture = (name) => JSON.parse(readFileSync(path.join(root, "scripts/fixtures/equipment-scanning", `${name}.json`), "utf8"));
function serviceHarness({ upload, fetch } = {}) {
  const calls = [];
  const api = load("services/equipmentScanService.ts", { "@/config/api": { API_BASE_URL: "http://scan.test" }, "./equipmentScanUpload": { uploadScanPhoto: upload ?? (async (...args) => { calls.push(args); return { status: 200, body: JSON.stringify(fixture("scan_candidates")) }; }) } }, { fetch: fetch ?? (async (url) => { calls.push(url); return { status: 200, text: async () => JSON.stringify(fixture("attempt_completed")) }; }) });
  return { api, calls };
}
test("frozen backend fixtures normalize without provider or legacy fields", () => {
  const { api } = serviceHarness();
  assert.equal(api.normalizeScanResult(fixture("scan_candidates")).requires_confirmation, true);
  assert.equal(api.normalizeScanResult(fixture("scan_no_match")).candidates.length, 0);
  assert.equal(api.normalizeEquipmentPage(fixture("equipment_search")).items[0].id, "lat_pulldown_cable");
  assert.equal(api.normalizeExerciseOptions(fixture("exercise_options")).items[0].exercise_id, "lat_pulldown");
  for (const name of ["attempt_processing", "attempt_completed", "attempt_unknown"]) assert.ok(api.normalizeAttempt(fixture(name)));
  const guide = fixture("guidance_unavailable"); guide.demoVideoUrl = "https://unreviewed.test/video.mp4"; guide.instructions_legacy = "Unreviewed";
  const normalized = api.normalizeGuidance(guide); assert.equal(normalized.video.url, null); assert.equal(normalized.instructions.content, null); assert.equal(normalized.demoVideoUrl, undefined);
});
test("published guidance cannot silently acquire legacy text or unapproved video", () => {
  const { api } = serviceHarness(); const guidance = fixture("guidance_unavailable");
  guidance.video.url = "https://legacy.test/old.mp4"; assert.throws(() => api.normalizeGuidance(guidance), /couldn’t be verified/);
  guidance.video.url = null; guidance.instructions.content = { steps: ["legacy"] }; assert.throws(() => api.normalizeGuidance(guidance), /couldn’t be verified/);
  guidance.instructions = { status: "published", content_version: "reviewed-v1", content: { steps: ["Sit"], cues: ["Control"], mistakes: ["Swinging"], benefits: "Strength", beginner_guidance: "Start light" } };
  guidance.video = { status: "approved", asset_id: "owned-video", url: "https://media.test/video.mp4", mime_type: "video/mp4", poster_url: null };
  assert.equal(api.normalizeGuidance(guidance).video.status, "approved"); guidance.video.url = "http://media.test/video.mp4"; assert.throws(() => api.normalizeGuidance(guidance));
});
test("upload has one idempotent request and result recovery uses GET only", async () => {
  const h = serviceHarness(); const controller = new AbortController();
  await h.api.identifyEquipment("test-token", "file://normalized", "same-key", controller.signal);
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0][2]["Idempotency-Key"], "same-key"); assert.equal(h.calls[0][1], "file://normalized");
  await h.api.checkEquipmentAttempt("test-token", "same-key", controller.signal); assert.equal(h.calls[1], "http://scan.test/v1/equipment-scans/attempts/same-key");
});
test("network uncertainty does not automatically upload again", async () => {
  let uploads = 0; const h = serviceHarness({ upload: async () => { uploads++; throw new Error("network internal"); } });
  await assert.rejects(h.api.identifyEquipment("token", "file://photo", "key", new AbortController().signal), (e) => e.code === "scan_outcome_unknown" && !e.message.includes("network internal")); assert.equal(uploads, 1);
});
test("structured access-unknown remains availability error without purchase side effects", async () => {
  const body = fixture("access_unknown"); const h = serviceHarness({ upload: async () => ({ status: 503, body: JSON.stringify(body) }) });
  await assert.rejects(h.api.identifyEquipment("token", "file://photo", "key", new AbortController().signal), (e) => e.code === "scan_access_unknown" && e.status === 503);
});
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function scannerHarness(overrides = {}) {
  const AuthContext = React.createContext(null); const calls = []; const discarded = []; let accountGeneration = 0; let latest; let nextUuid = 0; let appState;
  let flags = { environment: "test", flags: { equipment_scanning_enabled: true } };
  const { EquipmentScanError } = serviceHarness().api;
  const services = {
    EquipmentScanError,
    identifyEquipment: async (...args) => { calls.push(["identify", ...args]); return fixture("scan_candidates"); },
    checkEquipmentAttempt: async (...args) => { calls.push(["check", ...args]); return { ...fixture("attempt_completed"), attempt_key: args[1] }; },
    searchEquipment: async (...args) => { calls.push(["search", ...args]); return fixture("equipment_search"); },
    getEquipmentExercises: async (...args) => { calls.push(["options", ...args]); return fixture("exercise_options"); },
    getScanGuidance: async (...args) => { calls.push(["guidance", ...args]); return fixture("guidance_unavailable"); }, ...overrides.services,
  };
  const { useEquipmentScanner } = load("hooks/use-equipment-scanner.ts", {
    "@react-navigation/native": { useFocusEffect: (callback) => React.useEffect(callback, [callback]) },
    "expo-modules-core": { uuid: { v4: () => `key-${++nextUuid}` } }, "react-native": { Platform: { OS: "ios" }, AppState: { addEventListener: (_, callback) => { appState = callback; return { remove() {} }; } } },
    "@/config/api": { API_BASE_URL: "http://qa.test" }, "@/utils/authContext": { AuthContext },
    "@/services/accountScope": { accountRequestGuard: () => { const generation = accountGeneration; return () => generation === accountGeneration; } },
    "@/services/featureFlagService": { getFeatureFlags: async () => flags },
    "@/services/equipmentScanPhoto": { discardScanPhoto: async (uri) => { discarded.push(uri); }, pickScanPhoto: overrides.pick ?? (async (_source, current) => current() ? { uri: "file://normalized", width: 1024, height: 683 } : null) },
    "@/services/equipmentScanService": services,
  });
  function Content() { latest = useEquipmentScanner(); return null; }
  const element = (id = "A", epoch = 0, token = `token-${id}`) => React.createElement(AuthContext.Provider, { value: { token, user: { id } } }, React.createElement(Content, { key: `${id}:${epoch}` }));
  return { element, calls, discarded, EquipmentScanError, get state() { return latest; }, setFlags(value) { flags = value; }, foreground: () => appState("active"), changeAccount: () => { accountGeneration++; } };
}
async function mountScanner(options) { const h = scannerHarness(options); let tree; await act(async () => { tree = create(h.element()); }); return { h, tree, close: () => act(async () => tree.unmount()) }; }
test("disabled recognition retains manual search and requires explicit machine confirmation", async () => {
  const { h, tree, close } = await mountScanner(); h.setFlags({ environment: "test", flags: {} }); await act(async () => h.foreground()); assert.equal(h.state.enabled, false);
  await act(async () => h.state.pick("camera")); assert.equal(h.state.photo, null);
  await act(async () => h.state.manual()); await act(async () => h.state.find()); assert.equal(h.state.search.items[0].id, "lat_pulldown_cable"); assert.equal(h.calls.filter((c) => c[0] === "options").length, 0);
  await act(async () => h.state.setSelection(h.state.search.items[0])); assert.equal(h.state.stage, "manual"); await act(async () => h.state.confirm()); assert.equal(h.state.stage, "exercises"); await close();
});
test("one Identify request, no automatic machine selection or exercise fetch", async () => {
  const pending = deferred(); let count = 0; const { h, close } = await mountScanner({ services: { identifyEquipment: async () => { count++; return pending.promise; } } });
  await act(async () => h.state.pick("library")); await act(async () => { h.state.identify(); h.state.identify(); }); assert.equal(count, 1); assert.equal(h.state.busy, true);
  await act(async () => pending.resolve(fixture("scan_candidates"))); assert.equal(h.state.stage, "confirm"); assert.equal(h.state.selection, null); assert.equal(h.state.options, null);
  await act(async () => h.state.setSelection(h.state.result.candidates[0].equipment)); await act(async () => h.state.confirm()); assert.equal(h.state.machine.id, "lat_pulldown_cable"); await close();
});
test("unknown upload outcome recovers same key through GET without a second paid request", async () => {
  let error; const { h, close } = await mountScanner({ services: { identifyEquipment: async () => { throw error; } } }); error = new h.EquipmentScanError("scan_outcome_unknown", "Check result");
  await act(async () => h.state.pick("library")); await act(async () => h.state.identify()); const key = h.state.attemptKey; assert.ok(key); assert.equal(h.state.recovery, true);
  await act(async () => h.state.identify()); await act(async () => h.state.check()); assert.equal(h.calls.filter((c) => c[0] === "check").length, 1); assert.equal(h.calls.find((c) => c[0] === "check")[2], key); assert.equal(h.state.stage, "confirm"); await close();
});
test("cancel/back and account changes fence delayed results and clean temporary photos", async () => {
  const pending = deferred(); let signal; const { h, tree, close } = await mountScanner({ services: { identifyEquipment: async (_token, _uri, _key, s) => { signal = s; return pending.promise; } } });
  await act(async () => h.state.pick("library")); await act(async () => h.state.identify()); await act(async () => h.state.manual()); assert.equal(signal.aborted, true);
  await act(async () => pending.resolve(fixture("scan_candidates"))); assert.equal(h.state.stage, "manual"); assert.equal(h.state.result, null);
  h.changeAccount(); await act(async () => tree.update(h.element("B", 1))); assert.equal(h.state.photo, null); assert.equal(h.state.result, null); assert.ok(h.discarded.includes("file://normalized")); await close();
});
test("environment changes discard previous photo/result and pending attempt scope", async () => {
  const { h, close } = await mountScanner(); await act(async () => h.state.pick("library"));
  h.setFlags({ environment: "different-preview", flags: { equipment_scanning_enabled: true } }); await act(async () => h.foreground()); assert.equal(h.state.photo, null); assert.equal(h.state.result, null); assert.equal(h.state.attemptKey, null); assert.ok(h.discarded.includes("file://normalized")); await close();
});
test("editing manual query cancels older search and discards stale response", async () => {
  const pending = deferred(); const { h, close } = await mountScanner({ services: { searchEquipment: async () => pending.promise } });
  await act(async () => h.state.manual()); await act(async () => h.state.find()); await act(async () => h.state.setQuery("different machine")); await act(async () => pending.resolve(fixture("equipment_search"))); assert.equal(h.state.search, null); assert.equal(h.state.query, "different machine"); await close();
});
function guidanceHarness(scanState) {
  const colors = { text: "#11181C", icon: "#687076", inputBackground: "#fff", primaryButton: "#6a4ff5" };
  const media = (props) => React.createElement("ApprovedMedia", props);
  const { ScanSafeGuidance, ScanEquipmentScreen } = load("components/equipment-scanning/ScanEquipmentScreen.tsx", {
    "@expo/vector-icons": { Ionicons: "Icon" }, "expo-image": { Image: "Image" }, "expo-router": { useRouter: () => ({ back() {} }) },
    "react-native": { AccessibilityInfo: { announceForAccessibility() {} }, ActivityIndicator: "Spinner", Pressable: "Pressable", ScrollView: "Scroll", Text: "Text", TextInput: "Input", View: "View", StyleSheet: { create: (s) => s } }, "react-native-safe-area-context": { SafeAreaView: "SafeArea" },
    "@/components/exercises/ExerciseMedia": { ExerciseMedia: media }, "@/constants/theme": { Colors: { light: colors }, Fonts: { sans: "system" } }, "@/hooks/use-color-scheme": { useColorScheme: () => "light" }, "@/hooks/use-equipment-scanner": { useEquipmentScanner() { return scanState; } }, "@/services/accountScope": { accountGeneration: () => 0 }, "@/utils/authContext": { AuthContext: React.createContext({ user: { id: "A" } }) },
  }); return { ScanSafeGuidance, ScanEquipmentScreen, colors };
}
test("scan-safe guidance shows truthful unavailable states and supplies no legacy fallback props", async () => {
  const { ScanSafeGuidance, colors } = guidanceHarness(); let tree;
  const guidance = fixture("guidance_unavailable"); guidance.demoVideoUrl = "https://legacy.test/video.mp4"; guidance.instructions_legacy = ["Legacy"];
  await act(async () => { tree = create(React.createElement(ScanSafeGuidance, { guidance, colors })); });
  assert.equal(tree.root.findAllByType("ApprovedMedia").length, 0); assert.ok(tree.root.findByProps({ testID: "scan-video-unavailable" })); assert.ok(tree.root.findByProps({ testID: "scan-instructions-unavailable" }));
  guidance.video = { status: "approved", asset_id: "owned", url: "https://approved.test/video.mp4", mime_type: "video/mp4", poster_url: null };
  await act(async () => tree.update(React.createElement(ScanSafeGuidance, { guidance, colors }))); const props = tree.root.findByType("ApprovedMedia").props; assert.equal(props.media.id, "owned"); assert.equal(props.demoVideoUrl, undefined); assert.equal(props.imageUrl, undefined); await act(async () => tree.unmount());
});
test("late photo result after retake/manual invalidation cannot restore the old preview", async () => {
  const pending = deferred(); let guard; const { h, close } = await mountScanner({ pick: async (_source, current) => { guard = current; await pending.promise; return current() ? { uri: "file://late" } : null; } });
  let work; await act(async () => { work = h.state.pick("library"); }); await act(async () => h.state.manual()); assert.equal(guard(), false); await act(async () => { pending.resolve(); await work; }); assert.equal(h.state.photo, null); assert.equal(h.state.stage, "manual"); await close();
});
test("manual search caps text at the frozen 100-character server boundary", async () => {
  let url; const h = serviceHarness({ fetch: async (value) => { url = value; return { status: 200, text: async () => JSON.stringify(fixture("equipment_search")) }; } });
  await h.api.searchEquipment("token", "x".repeat(120), null, new AbortController().signal); assert.equal(new URL(url).searchParams.get("q").length, 100);
});
test("back from a manually confirmed machine returns to manual results with selection intact", async () => {
  const { h, close } = await mountScanner(); await act(async () => h.state.manual()); await act(async () => h.state.find()); await act(async () => h.state.setSelection(h.state.search.items[0])); await act(async () => h.state.confirm()); assert.equal(h.state.stage, "exercises"); await act(async () => h.state.back()); assert.equal(h.state.stage, "manual"); assert.equal(h.state.search.items[0].id, h.state.selection.id); await close();
});
test("flag-off foreground refresh does not cancel manual guide revalidation", async () => {
  const { h, close } = await mountScanner(); h.setFlags({ environment: "test", flags: {} }); await act(async () => h.foreground()); await act(async () => h.state.manual()); await act(async () => h.state.find()); await act(async () => h.state.setSelection(h.state.search.items[0])); await act(async () => h.state.confirm()); await act(async () => h.state.openGuidance("lat_pulldown")); assert.equal(h.state.stage, "guidance");
  await act(async () => h.foreground()); assert.equal(h.state.guidance.exercise_id, "lat_pulldown"); assert.equal(h.state.enabled, false); await close();
});
test("exercise choices clearly name missing attachments without changing workouts", async () => {
  const item = { ...fixture("exercise_options").items[0], compatibility: "needs_equipment_confirmation", missing_equipment: [{ id: "attachment", name: "Wide handle" }], missing_equipment_ids: ["attachment"] };
  let opened; const state = { stage: "exercises", machine: { name: "Cable station" }, options: { items: [item], next_cursor: null }, busy: false, picking: false, openGuidance: (id) => { opened = id; }, cancelRequest() {}, manual() {}, back() {} };
  const { ScanEquipmentScreen } = guidanceHarness(state); let tree; await act(async () => { tree = create(React.createElement(ScanEquipmentScreen)); });
  const row = tree.root.findByProps({ testID: `scan-exercise-${item.exercise_id}` }); assert.match(row.props.accessibilityLabel, /Also needs Wide handle/); assert.match(JSON.stringify(tree.toJSON()), /Also needs Wide handle/);
  await act(async () => row.props.onPress()); assert.equal(opened, item.exercise_id); await act(async () => tree.unmount());
});
test("pending screen exposes only result checking and manual cancellation, not duplicate identification", async () => {
  const state = { stage: "capture", enabled: true, busy: true, picking: false, photo: { uri: "file://normalized" }, attemptKey: "same-key", result: null, check() {}, manual() {}, cancelRequest() {}, pick() {} };
  const { ScanEquipmentScreen } = guidanceHarness(state); let tree; await act(async () => { tree = create(React.createElement(ScanEquipmentScreen)); });
  assert.equal(tree.root.findAllByProps({ testID: "scan-identify" }).length, 0); assert.equal(tree.root.findByProps({ testID: "scan-check-result" }).props.disabled, true); assert.equal(tree.root.findByProps({ testID: "scan-manual-search" }).props.disabled, false); await act(async () => tree.unmount());
});
test("same-account credential refresh preserves the current reviewed photo", async () => {
  const { h, tree, close } = await mountScanner(); await act(async () => h.state.pick("library"));
  await act(async () => tree.update(h.element("A", 0, "refreshed-A"))); assert.equal(h.state.photo.uri, "file://normalized"); assert.equal(h.discarded.length, 0); await close();
});
test("rollout disable during identification cancels presentation and never starts another upload", async () => {
  const pending = deferred(); let signal; let requests = 0; const { h, close } = await mountScanner({ services: { identifyEquipment: async (_token, _uri, _key, s) => { requests++; signal = s; return pending.promise; } } });
  await act(async () => h.state.pick("library")); await act(async () => h.state.identify()); h.setFlags({ environment: "test", flags: {} }); await act(async () => h.foreground()); assert.equal(signal.aborted, true); assert.equal(h.state.enabled, false);
  await act(async () => pending.resolve(fixture("scan_candidates"))); assert.equal(h.state.result, null); assert.equal(requests, 1); await close();
});
test("photo cleanup deletes cache copies but never original gallery assets", async () => {
  const deleted = [];
  const files = load("services/privateFiles.ts", { "expo-file-system/legacy": { cacheDirectory: "file:///qa-cache/", deleteAsync: async (uri) => { deleted.push(uri); } }, "expo-sharing": {}, "@/config/api": { API_BASE_URL: "http://qa.test" }, "./httpClient": { HttpError: Error } });
  await files.discardPickedPhoto("file:///gallery/original.jpg"); await files.discardPickedPhoto("content://library/original"); await files.discardPickedPhoto("ph://original"); assert.equal(deleted.length, 0);
  await files.discardPickedPhoto("file:///qa-cache/normalized.jpg"); assert.deepEqual(deleted, ["file:///qa-cache/normalized.jpg"]);
});
