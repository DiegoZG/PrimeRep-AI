import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url), babel = require("@babel/core");
const source = (file) => readFileSync(path.join(root, file), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const plain = (value) => JSON.parse(JSON.stringify(value));
const route = "app/settings/export.tsx", output = new Map();
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const styleOf = (node) => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
const node = (view, id) => view.tree.root.findAllByProps({ testID: id }).find((item) => typeof item.type === "string");
const button = (view) => node(view, "export-create");
const success = (view) => node(view, "export-success");
const text = (view) => textOf(view.tree.root);
const errorText = (view) => textOf(node(view, "export-error"));
const close = (view) => view.run(() => view.tree.unmount());
const tap = (view) => { assert.notEqual(button(view).props.disabled, true); return view.run(() => { button(view).props.onPress(); }); };
const settle = (view, pending, value, reject = false) => view.run(() => reject ? pending.reject(value) : pending.resolve(value));

function load(file, mocks, platform, globals) {
  const key = `${platform}:${file}`;
  if (!output.has(key)) output.set(key, babel.transformSync(source(file), {
    filename: path.join(root, file), configFile: false, babelrc: false,
    presets: [[require.resolve("babel-preset-expo"), { jsxRuntime: "classic", enableBabelRuntime: false, worklets: false, reanimated: false }]],
    caller: { name: "metro", bundler: "metro", platform, engine: "hermes", isDev: true, isServer: false, isReactServer: false, isNodeModule: false, supportsStaticESM: false, supportsReactCompiler: true },
  }).code);
  const module = { exports: {} };
  vm.runInNewContext(output.get(key), { React, Error, __DEV__: true, console, module, exports: module.exports, require: (name) => {
    assert.ok(Object.hasOwn(mocks, name), `Unmocked module ${name} in ${file}`); return mocks[name];
  }, ...globals }, { filename: path.join(root, file) });
  return module.exports;
}

async function screen(options = {}) {
  const platform = options.platform ?? "ios", scheme = options.scheme ?? "light", AuthContext = React.createContext(null);
  let auth = { user: { id: "owner A/+" }, token: "fixture-token-A", ...options.auth }, focused = true, focusCallback, focusCleanup;
  let unitRead = options.unitRead ?? (async () => "LB"), download = options.download ?? (async () => ({ status: 200 })), sharing = options.sharing ?? (async () => {}), response = options.response ?? (async () => ({ ok: true, status: 200, blob: async () => ({ fixture: "ZIP" }) }));
  let timerID = 0, clock = 0;
  const timers = new Map(), calls = { units: [], downloads: [], shares: [], files: [], fetch: [], urls: [], anchors: [], back: [], cancels: [], availability: 0 };
  const directory = "file:///fixture-cache/primerep-private-exports/";
  const setTimer = (callback, delay) => { const id = ++timerID; timers.set(id, { callback, at: clock + delay, delay }); return id; };
  const clearTimer = (id) => timers.delete(id);
  const run = (callback) => act(async () => { callback(); });
  const animation = (steps = []) => Object.fromEntries(["springify", "damping", "stiffness", "reduceMotion", "duration"].map((name) => [name, (...args) => ({ ...animation([...steps, [name, ...args]]), steps: [...steps, [name, ...args]] })]));
  class FixtureDate extends Date { constructor(...args) { super(...(args.length ? args : [Date.UTC(2026, 9, 15, 12)])); } static now() { return Date.UTC(2026, 9, 15, 12); } }
  const globals = { Date: FixtureDate, setTimeout: setTimer, clearTimeout: clearTimer, AbortController, fetch: async (url, args) => { calls.fetch.push([url, args]); return response(url, args); }, URL: { createObjectURL: (blob) => { calls.urls.push(["create", blob]); return "blob:fixture-export"; }, revokeObjectURL: (url) => calls.urls.push(["revoke", url]) }, document: { createElement: (tag) => { assert.equal(tag, "a"); const anchor = { click() { calls.anchors.push(["click", this.href, this.download]); }, remove() { calls.anchors.push(["remove"]); } }; return anchor; }, body: { appendChild: () => calls.anchors.push(["append"]) } } };
  const mocks = {
    react: React, "react/compiler-runtime": require("react/compiler-runtime"),
    "react-native": { Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", View: "View", ActivityIndicator: "ActivityIndicator", StyleSheet: { create: (value) => value, hairlineWidth: 1 }, Platform: { OS: platform, select: (values) => values[platform] ?? values.default }, useWindowDimensions: () => ({ width: 375, height: 667, fontScale: 1, scale: 2 }) },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "expo-image": { Image: "Image" }, "@expo/vector-icons": { Ionicons: "Ionicons" },
    "react-native-reanimated": { __esModule: true, default: { View: "Animated.View" }, FadeInDown: animation(), FadeOutUp: animation(), ReduceMotion: { System: "system" } },
    "expo-router": { useRouter: () => ({ back: () => calls.back.push("back") }), useFocusEffect: (callback) => React.useEffect(() => { focusCallback = callback; if (focused) focusCleanup = callback(); return () => { focusCleanup?.(); focusCallback = undefined; }; }, [callback]) },
    "@/utils/authContext": { AuthContext }, "@/config/api": { API_BASE_URL: "https://fixture.invalid" }, "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@react-native-async-storage/async-storage": { getItem: (key) => { assert.equal(key, "primerep.weightUnit"); calls.units.push(key); return unitRead(); } },
    "expo-sharing": { isAvailableAsync: async () => { calls.availability += 1; return options.available ? options.available() : true; }, shareAsync: async (...args) => { calls.shares.push(plain(args)); return sharing(...args); } },
    "expo-file-system/legacy": { cacheDirectory: "file:///fixture-cache/", readDirectoryAsync: async (uri) => { assert.equal(uri, directory); calls.files.push(["list", uri]); return options.list ? options.list() : []; }, deleteAsync: async (uri, args) => { assert.ok(uri.startsWith(directory)); calls.files.push(["delete", uri, plain(args)]); }, makeDirectoryAsync: async (uri, args) => { assert.equal(uri, directory); calls.files.push(["mkdir", uri, plain(args)]); }, createDownloadResumable: (url, uri, args) => { assert.ok(uri.startsWith(directory)); calls.downloads.push([url, uri, plain(args)]); return { downloadAsync: () => download(url, uri), cancelAsync: async () => { calls.cancels.push(uri); } }; } },
  };
  const actual = (file) => load(file, mocks, platform, globals);
  for (const [name, primitive] of Object.entries(mocks["react-native"])) mocks[`react-native-web/dist/exports/${name}`] = { __esModule: true, default: primitive };
  mocks["@/constants/theme"] = actual("constants/theme.ts");
  mocks["@/hooks/use-theme-color"] = actual("hooks/use-theme-color.ts");
  mocks["./themed-text"] = mocks["@/components/themed-text"] = actual("components/themed-text.tsx");
  mocks["@/components/profile-ui"] = actual("components/profile-ui.tsx");
  mocks["./httpClient"] = actual("services/httpClient.ts");
  mocks["./binaryClient"] = actual("services/binaryClient.ts");
  const scope = actual("services/accountScope.ts"); mocks["@/services/accountScope"] = scope;
  mocks["@/utils/weightUnits"] = actual("utils/weightUnits.ts");
  const files = actual(platform === "web" ? "services/privateFiles.web.ts" : "services/privateFiles.ts"); mocks["@/services/privateFiles"] = files;
  const { default: Screen } = actual(route);
  const element = () => React.createElement(AuthContext.Provider, { value: auth }, React.createElement(Screen));
  let tree; await run(() => { tree = create(element()); });
  return { tree, run, calls, scope, files, colors: mocks["@/constants/theme"].Colors[scheme], platform, timers,
    setUnitRead: (next) => { unitRead = next; }, setDownload: (next) => { download = next; }, setSharing: (next) => { sharing = next; }, setResponse: (next) => { response = next; },
    blur: () => run(() => { assert.equal(focused, true); focused = false; focusCleanup?.(); focusCleanup = undefined; }),
    focus: () => run(() => { assert.equal(focused, false); focused = true; focusCleanup = focusCallback(); }),
    account: (next) => run(() => { scope.invalidateAccountRequests(); auth = next; tree.update(element()); }),
    tick: (delay) => run(() => { const end = clock + delay; while (true) { const next = [...timers].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]; if (!next) break; clock = next[1].at; timers.delete(next[0]); next[1].callback(); } clock = end; }),
  };
}

test("scope: original imports/controller/copy and all shared contracts remain exact", () => {
  const input = source(route), start = input.indexOf("export default function ExportScreen"), end = input.indexOf("  return <ProfilePage", start);
  for (const [value, bytes, expected] of [[input.slice(0, start), 840, "0ddd58d13c428689137bd3b9e86364fe8d344dc95adbc76648168ada0ee4ae58"], [input.slice(start, end), 1537, "24642e50e7bea7fb4b8513400e0c2c4e92b2aab7523a68800b33c5c34ae00921"], [input.slice(input.indexOf('    <ThemedText accessibilityRole="header"'), input.indexOf("  </ProfileScroll>")), 2455, "9a468bc541e2fb6da4c561446806b89e6bcb74376ba375a67c5c841cec51f8ae"]]) { assert.equal(Buffer.byteLength(value), bytes); assert.equal(hash(value), expected); }
  const pins = {
    "components/profile-ui.tsx": "71dba99a5759d5e5a10e8c429d20ded233f5b5e7a34a5a5638f3a3522e7da0a0", "components/themed-text.tsx": "06d02c5a33dd258563726e8586a4b588e2df7c087ac291be6a225f89bf1ac974",
    "constants/theme.ts": "0e4066b19531c70b14aeb5656a6f0de16b37f56ad410b87c2f923168cebfcad1", "hooks/use-theme-color.ts": "49ec7d86e952e315f8172e7994a879d3c63023f2955f667fedba6ab5c89c1710", "hooks/use-color-scheme.ts": "671b054577430b67b8f77d2a88727048c5f4f9e3d8f68c8d42301d937c3cf916", "hooks/use-color-scheme.web.ts": "671b054577430b67b8f77d2a88727048c5f4f9e3d8f68c8d42301d937c3cf916",
    "utils/authContext.tsx": "b1f62934043ff5894ed0f5a4f9e201f66bc6801a3bc4a6ca29c5509a7df2bb28", "services/accountScope.ts": "cb7920358c2e0de7a2286fd7c6cf226a528b466be96701eab4e2ba638fad20d7", "services/privateFiles.ts": "85a3976e291cc9c78c8f9ab04a82d65ecfa0d7951c13616c5b58916dbfdb0481", "services/privateFiles.web.ts": "a88da172561060e6e4f67bbc544edad181537b86340f2a0be57c2f6e024cbe6d", "services/binaryClient.ts": "398ab17fe47f46681750c92b8e06d9cbb993a432ea6705ab6674147ab279f529", "services/httpClient.ts": "d1447666caefc1c64f48c8a883368bb2e6e1c527916a6591278d099fbabf116c", "services/profileService.ts": "a5c26d21a6b801a667267ca7c42c931a3b329285f34083a97efe8e4685507540", "utils/weightUnits.ts": "2a7ba690e40480894475bb1e7a67007a1c1ddccc2c78e6e872896f735fb470c3", "config/api.ts": "d1ade27c78e968464bddc22c901239751973dc20f74c784e962acd9a84541486", "app/_layout.tsx": "36c8357c4bb72ed2b3b52d7c2b23cbdc545d2ae35b82af1bfa5312989116465a", "app/settings.tsx": "a6f3edb85df6fe03896ea0a06676515cb92f9f623f85e6f9f7db6cbb395c545d", "package.json": "e4236db693742a9fb1a102a5fa5a872bcc462f2538bdbc0d1b795c80d6256ed7", "package-lock.json": "be06fec5788bccd640b7dfc461783acf9ce55c4d77d80eb6ddb87acbee01447d", "app.json": "7c3697289889a0b98f502fbdc54edc756392e32536edced909f98554a5160eb2",
  };
  for (const [file, expected] of Object.entries(pins)) assert.equal(hash(source(file)), expected, file);
});

for (const scheme of ["light", "dark"]) for (const platform of ["ios", "web"]) test(`${platform} ${scheme}: actual route/shared UI, archive copy, quiet paint and reduced-motion success`, async () => {
  const view = await screen({ scheme, platform });
  assert.equal(button(view).props.accessibilityRole, "button"); assert.deepEqual(plain(button(view).props.accessibilityState), { disabled: false, busy: false });
  assert.equal(textOf(button(view)), platform === "web" ? "Download archive" : "Create and save archive");
  assert.equal(styleOf(button(view)).backgroundColor, view.colors.primaryButton); assert.equal(styleOf(button(view)).minHeight, 48);
  const tile = view.tree.root.findAllByType("Ionicons").find((item) => item.props.name === "download-outline");
  assert.equal(tile.props.color, view.colors.icon); assert.equal(styleOf(tile.parent).backgroundColor, view.colors.inputBorder);
  assert.match(text(view), /Your training, yours to keep\./); assert.match(text(view), /Full account archive \(JSON\)/); assert.match(text(view), /Workout spreadsheets \(CSV\)/); assert.match(text(view), /weights labeled in pounds/);
  assert.match(text(view), /Photo and guide/); assert.match(text(view), /Workout changes that are only on this device are not included yet/); assert.match(text(view), /Exports are limited per hour/); assert.match(text(view), /Your archive contains private information\. Choose where you save or share it\./);
  assert.equal(success(view), undefined); await tap(view); assert.ok(success(view)); assert.equal(success(view).props.accessibilityRole, "alert"); assert.equal(success(view).props.accessibilityLiveRegion, "polite");
  assert.deepEqual(plain(success(view).props.entering.steps), [["springify"], ["damping", 18], ["stiffness", 240], ["reduceMotion", "system"]]);
  assert.deepEqual(plain(success(view).props.exiting.steps), [["duration", 160], ["reduceMotion", "system"]]);
  assert.equal(styleOf(success(view)).borderColor, view.colors.inputBorder); assert.match(textOf(success(view)), /Archive created/); assert.doesNotMatch(textOf(success(view)), /Archive saved/);
  await view.tick(4499); assert.ok(success(view)); await view.tick(1); assert.equal(success(view), undefined);
  await view.run(() => node(view, "profile-page-back").props.onPress()); assert.deepEqual(view.calls.back, ["back"]); await close(view);
});

for (const stored of ["KG", "unsupported"]) test(`actual weight-unit helper resolves ${stored} without exporting on focus`, async () => {
  const pending = deferred(), view = await screen({ unitRead: () => pending.promise }); assert.match(text(view), /weights labeled in pounds/);
  await settle(view, pending, stored); assert.match(text(view), stored === "KG" ? /weights labeled in kilograms/ : /weights labeled in pounds/);
  assert.deepEqual(view.calls.units, ["primerep.weightUnit"]); assert.equal(view.calls.downloads.length, 0); assert.equal(view.calls.fetch.length, 0); await close(view);
});

for (const auth of [{ user: null }, { token: null }]) test(`missing ${auth.user === null ? "user" : "token"} keeps actual download callback a guarded no-op`, async () => {
  const view = await screen({ auth }); await tap(view); assert.equal(view.calls.availability, 0); assert.equal(view.calls.downloads.length, 0); assert.equal(success(view), undefined); assert.equal(button(view).props.disabled, false); await close(view);
});

test("native pending download uses exact owner/unit/auth/no-store and current busy callback no-ops", async () => {
  const pending = deferred(), view = await screen({ unitRead: async () => "KG", download: () => pending.promise }); await tap(view);
  assert.equal(textOf(button(view)), "Preparing your archive…"); assert.deepEqual(plain(button(view).props.accessibilityState), { disabled: true, busy: true }); assert.equal(button(view).props.disabled, true); assert.equal(button(view).findAllByType("ActivityIndicator").length, 1);
  assert.equal(view.calls.downloads[0][0], "https://fixture.invalid/v1/users/me/export?weight_unit=KG"); assert.match(view.calls.downloads[0][1], /owner%20A%2F%2B-\d+-primerep\.zip$/); assert.deepEqual(view.calls.downloads[0][2], { headers: { Authorization: "Bearer fixture-token-A", "Cache-Control": "no-store" } });
  await view.run(() => button(view).props.onPress()); assert.equal(view.calls.downloads.length, 1);
  await settle(view, pending, { status: 200 }); assert.equal(view.calls.shares.length, 1); assert.equal(button(view).props.disabled, false); await close(view);
});

test("native waits for share resolution, deletes virtual ZIP and reports generated—not saved—success", async () => {
  const pending = deferred(), view = await screen({ sharing: () => pending.promise }); await tap(view);
  assert.equal(button(view).props.disabled, true); assert.equal(success(view), undefined); assert.equal(view.calls.shares.length, 1);
  assert.deepEqual(view.calls.shares[0][1], { mimeType: "application/zip", UTI: "public.zip-archive", dialogTitle: "Save your PrimeRep data" });
  await settle(view, pending, undefined); assert.ok(success(view)); assert.ok(view.calls.files.some(([kind, uri]) => kind === "delete" && uri === view.calls.shares[0][0]));
  assert.equal(button(view).props.disabled, false); await close(view);
});

for (const status of [429, 500]) test(`native ${status} preserves exact error, cleanup and Retry`, async () => {
  const view = await screen({ download: async () => ({ status }) }); await tap(view);
  assert.equal(errorText(view), status === 429 ? "You’ve reached the hourly export limit. Please try again later." : "Your archive could not be created. Please try again.");
  assert.equal(node(view, "export-error").props.accessibilityRole, "alert"); assert.equal(textOf(button(view)), "Try download again"); assert.equal(view.calls.shares.length, 0); assert.equal(button(view).props.disabled, false);
  view.setDownload(async () => ({ status: 200 })); await tap(view); assert.equal(node(view, "export-error"), undefined); assert.ok(success(view)); assert.equal(view.calls.downloads.length, 2); await close(view);
});

test("native sharing unavailable errors before creating any virtual ZIP", async () => {
  const view = await screen({ available: async () => false }); await tap(view); assert.equal(errorText(view), "Sharing is unavailable on this device. Try downloading from PrimeRep on the web."); assert.deepEqual(view.calls.downloads, []); assert.deepEqual(view.calls.files, []); await close(view);
});

test("native interrupted download preserves error and finally cleanup", async () => {
  const view = await screen({ download: async () => undefined }); await tap(view); assert.equal(errorText(view), "Your download was interrupted. Please try again."); assert.equal(view.calls.shares.length, 0); assert.equal(view.calls.files.filter(([kind]) => kind === "delete").length, 1); await close(view);
});

for (const failure of [new Error("fixture share failure"), "non-Error fixture failure"]) test(`share rejection ${typeof failure} preserves Error.message versus route fallback`, async () => {
  const view = await screen({ sharing: async () => { throw failure; } }); await tap(view); assert.equal(errorText(view), failure instanceof Error ? failure.message : "Your archive couldn’t be created. Please try again."); assert.equal(success(view), undefined); assert.equal(button(view).props.disabled, false); assert.equal(view.calls.files.filter(([kind]) => kind === "delete").length, 1); await close(view);
});

for (const platform of ["ios", "web"]) for (const reject of [false, true]) test(`${platform} mocked A→B→A fences late ${reject ? "failure" : "success"}, preserving busy-only-current semantics`, async () => {
  const pending = deferred(), view = await screen({ platform, download: () => pending.promise, response: () => pending.promise }); await tap(view);
  await view.account({ user: { id: "B" }, token: "fixture-token-B" }); await view.account({ user: { id: "owner A/+" }, token: "fixture-token-A" });
  await settle(view, pending, reject ? Error("late fixture failure") : platform === "ios" ? { status: 200 } : { ok: true, status: 200, blob: async () => ({ fixture: "ZIP" }) }, reject);
  assert.equal(success(view), undefined); assert.equal(node(view, "export-error"), undefined); assert.equal(view.calls.shares.length, 0); assert.equal(view.calls.urls.length, 0); assert.equal(button(view).props.disabled, true); await close(view);
});

test("availability wait invalidated before file creation remains guarded and busy", async () => {
  const pending = deferred(), view = await screen({ available: () => pending.promise }); await tap(view); await view.account({ user: { id: "B" }, token: "fixture-token-B" }); await settle(view, pending, true); assert.deepEqual(view.calls.files, []); assert.deepEqual(view.calls.downloads, []); assert.equal(button(view).props.disabled, true); await close(view);
});

test("blurred completion skips sharing/success and does not reset inherited busy on refocus", async () => {
  const pending = deferred(), view = await screen({ download: () => pending.promise }); await tap(view); await view.blur(); await settle(view, pending, { status: 200 }); assert.equal(view.calls.shares.length, 0); assert.equal(success(view), undefined); assert.equal(button(view).props.disabled, true); await view.focus(); assert.equal(button(view).props.disabled, true); await close(view);
});

test("same-account blur→refocus before completion makes the captured focus boolean current again", async () => {
  const pending = deferred(), view = await screen({ download: () => pending.promise }); await tap(view); await view.blur(); await view.focus(); await settle(view, pending, { status: 200 }); assert.equal(view.calls.shares.length, 1); assert.ok(success(view)); assert.equal(button(view).props.disabled, false); await close(view);
});

test("late unit read after refocus retains original boolean-only ordering, not a native defect claim", async () => {
  const old = deferred(), fresh = deferred(), view = await screen({ unitRead: () => old.promise }); await view.blur(); view.setUnitRead(() => fresh.promise); await view.focus(); await settle(view, fresh, "LB"); assert.match(text(view), /weights labeled in pounds/); await settle(view, old, "KG"); assert.match(text(view), /weights labeled in kilograms/); await close(view);
});

test("blur cancels success timer without clearing existing success; refocus retains that original state", async () => {
  const view = await screen(); await tap(view); assert.ok(success(view)); await view.blur(); assert.equal(view.timers.size, 0); await view.focus(); await view.tick(5000); assert.ok(success(view)); await close(view);
});

test("unmounted pending native completion skips sharing and deletes only its virtual archive", async () => {
  const pending = deferred(), view = await screen({ download: () => pending.promise }); await tap(view); await close(view); await settle(view, pending, { status: 200 }); assert.equal(view.calls.shares.length, 0); assert.equal(view.calls.files.filter(([kind]) => kind === "delete").length, 1);
});

test("actual native private-file queue keeps route busy until old virtual files are cleaned", async () => {
  const listing = deferred(), view = await screen({ list: () => listing.promise }); const cleanup = view.files.cleanupPrivateFiles(); await tap(view); assert.equal(view.calls.downloads.length, 0); assert.equal(button(view).props.disabled, true); await settle(view, listing, ["old.zip"]); await view.run(() => { void cleanup; }); assert.ok(view.calls.files.some(([kind, uri]) => kind === "delete" && uri.endsWith("/old.zip"))); assert.equal(view.calls.downloads.length, 1); assert.ok(success(view)); await close(view);
});

test("actual web binary client/download uses KG, no-store, selected filename and bounded URL revocation", async () => {
  const view = await screen({ platform: "web", unitRead: async () => "KG" }); await tap(view); const [url, args] = view.calls.fetch[0]; assert.equal(url, "https://fixture.invalid/v1/users/me/export?weight_unit=KG"); assert.equal(args.method, "GET"); assert.equal(args.cache, "no-store"); assert.deepEqual(plain(args.headers), { Authorization: "Bearer fixture-token-A" }); assert.ok(args.signal instanceof AbortSignal); assert.deepEqual(view.calls.anchors, [["append"], ["click", "blob:fixture-export", "primerep-data-2026-10-15.zip"], ["remove"]]); await view.tick(999); assert.equal(view.calls.urls.filter(([kind]) => kind === "revoke").length, 0); await view.tick(1); assert.equal(view.calls.urls.filter(([kind]) => kind === "revoke").length, 1); await close(view);
});

test("actual web timeout errors without a download or real network", async () => {
  const view = await screen({ platform: "web", response: (_url, args) => new Promise((_resolve, reject) => args.signal.addEventListener("abort", () => { const error = Error("fixture abort"); error.name = "AbortError"; reject(error); }, { once: true })) }); await tap(view); await view.tick(120000); assert.equal(errorText(view), "The request timed out. Please try again."); assert.equal(button(view).props.disabled, false); assert.deepEqual(view.calls.urls, []); await close(view);
});

test("actual web response failure retains server detail and Retry label", async () => {
  const view = await screen({ platform: "web", response: async () => ({ ok: false, status: 429, json: async () => ({ detail: "fixture hourly export limit" }) }) }); await tap(view); assert.equal(errorText(view), "fixture hourly export limit"); assert.equal(textOf(button(view)), "Try download again"); assert.deepEqual(view.calls.urls, []); await close(view);
});

test("native timeout invokes virtual cancellation; interrupted promise controls final route outcome", async () => {
  const pending = deferred(), view = await screen({ download: () => pending.promise }); await tap(view); await view.tick(120000); assert.equal(view.calls.cancels.length, 1); assert.equal(button(view).props.disabled, true); await settle(view, pending, undefined); assert.equal(errorText(view), "Your download was interrupted. Please try again."); await close(view);
});

test("paint scope: reversing only the four approved local tokens reconstructs the entire original route", () => {
  let input = source(route);
  const changes = [
    ['backgroundColor: colors.inputBorder }}><Ionicons name="download-outline" size={34} color={colors.icon}', 'backgroundColor: `${colors.primaryButton}15` }}><Ionicons name="download-outline" size={34} color={colors.primaryButton}'],
    ['borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }}><View style={{ width: 40', 'borderColor: `${colors.primaryButton}55`, backgroundColor: colors.inputBackground }}><View style={{ width: 40'],
    ['backgroundColor: colors.background }}><Ionicons name="checkmark" size={23}', 'backgroundColor: `${colors.primaryButton}20` }}><Ionicons name="checkmark" size={23}'],
  ];
  for (const [candidate, original] of changes) { assert.equal(input.split(candidate).length, 2); input = input.replace(candidate, original); }
  assert.equal(Buffer.byteLength(input), 6243); assert.equal(hash(input), "208785f51e68f79c0015b8d134b7f1a9b67bcfb8d0572b073d8e2a65ee5b69dc");
});

for (const scheme of ["light", "dark"]) test(`${scheme}: neutral decoration keeps original geometry, readable content and purple action/check`, async () => {
  const view = await screen({ scheme });
  const tile = view.tree.root.findAllByType("Ionicons").find((item) => item.props.name === "download-outline");
  assert.equal(tile.props.size, 34); assert.equal(tile.props.color, view.colors.icon);
  assert.deepEqual(plain(styleOf(tile.parent)), { alignSelf: "flex-start", borderRadius: 18, padding: 16, backgroundColor: view.colors.inputBorder });
  await tap(view); const toast = success(view), check = toast.findAllByType("Ionicons").find((item) => item.props.name === "checkmark");
  assert.equal(styleOf(toast).backgroundColor, view.colors.inputBackground); assert.equal(styleOf(toast).borderColor, view.colors.inputBorder);
  assert.deepEqual(plain(styleOf(check.parent)), { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: view.colors.background });
  assert.equal(check.props.size, 23); assert.equal(check.props.color, view.colors.primaryButton); assert.equal(styleOf(button(view)).backgroundColor, view.colors.primaryButton);
  assert.equal(styleOf(toast).position, "absolute"); assert.equal(styleOf(toast).bottom, 12); assert.equal(styleOf(toast).padding, 14);
  const heading = toast.findAllByType("Text").find((item) => textOf(item) === "Archive created");
  assert.equal(styleOf(heading).fontWeight, "700"); assert.equal(styleOf(heading).fontSize, 16); assert.equal(styleOf(heading).lineHeight, 24);
  assert.equal(heading.props.numberOfLines, undefined); assert.notEqual(heading.props.allowFontScaling, false); assert.equal(heading.props.maxFontSizeMultiplier, undefined);
  await close(view);
});
