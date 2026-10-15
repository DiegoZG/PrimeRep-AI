import assert from "node:assert/strict";
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
const route = "app/profile/edit.tsx";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const plain = (value) => JSON.parse(JSON.stringify(value));
function load(file, mocks, globals = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => {
    assert.ok(Object.hasOwn(mocks, name), `Unmocked module in ${file}: ${name}`);
    return mocks[name];
  }, console, Error, ...globals }, { filename: path.join(root, file) });
  return module.exports;
}
const native = { ActivityIndicator: "ActivityIndicator", KeyboardAvoidingView: "KeyboardAvoidingView", Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", TextInput: "TextInput", View: "View", StyleSheet: { create: (styles) => styles, hairlineWidth: 0.5 }, Platform: { OS: "ios", select: (values) => values.ios } };
const theme = load("constants/theme.ts", { "react-native": native });
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const texts = (view) => view.tree.root.findAllByType("Text").map(textOf);
const host = (view, id) => view.tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === `profile-${id}`)[0];
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const profile = (extra = {}) => ({ id: "fixture-A", email: "ada@example.invalid", preferred_name: "Ada", last_name: "Lovelace", weight: 70.12345, weight_unit: "KG", age: 32, gender: "female", avatar_version: null, updated_at: "2026-10-14T12:00:00Z", ...extra });
const asset = (uri = "fixture://picked-1", width = 800, height = 600) => ({ canceled: false, assets: [{ uri, width, height }] });
const change = async (view, id, value) => { await act(async () => host(view, id).props.onChangeText(value)); };
const tap = async (node) => { assert.ok(node); assert.notEqual(node.props.disabled, true); await act(async () => node.props.onPress()); };
const settle = async (pending, value, reject = false) => { await act(async () => reject ? pending.reject(value) : pending.resolve(value)); };
const close = async (view) => { await act(async () => view.tree.unmount()); };
const error = (view) => host(view, "save-error") ? textOf(host(view, "save-error")) : null;
const save = (view) => tap(host(view, "save"));
const pick = (view) => tap(host(view, "change-photo"));

async function form(scheme, options = {}) {
  const AuthContext = React.createContext(null);
  const scope = load("services/accountScope.ts", {});
  let account = { token: "fixture-token-A", user: { id: "fixture-A" }, acceptProfileIdentity: (value) => calls.identities.push(plain(value)) };
  let currentProfile = profile(options.profile);
  let read = options.read ?? (async () => currentProfile);
  let patch = options.patch ?? (async (_token, values) => (currentProfile = { ...currentProfile, ...values }));
  let upload = options.upload ?? (async () => (currentProfile = { ...currentProfile, avatar_version: "fixture-v2" }));
  let remove = options.remove ?? (async () => (currentProfile = { ...currentProfile, avatar_version: null }));
  let picker = options.picker ?? (async () => ({ canceled: true }));
  let normalizedCount = 0;
  let render = options.render ?? (async () => ({ saveAsync: async () => ({ uri: `fixture://normalized-${++normalizedCount}` }) }));
  let unit = options.unit ?? (async () => "KG");
  let getAvatar = options.getAvatar ?? (async () => "fixture://avatar");
  let prevention = { enabled: false }, context, tree, ready = false;
  const calls = { reads: [], patches: [], uploads: [], removes: [], avatars: [], discards: [], picker: [], manipulates: [], resizes: [], saves: [], storage: [], routes: [], dispatches: [], alerts: [], identities: [], warnings: [] };
  const router = { back: () => {
    calls.routes.push(["back"]);
    if (prevention.enabled) prevention.callback({ data: { action: { type: "GO_BACK" } } });
    else calls.dispatches.push({ type: "GO_BACK" });
  } };
  const mocks = {
    react: React, "react-native": { ...native, Alert: { alert: (...args) => calls.alerts.push(args) } },
    "@expo/vector-icons": { Ionicons: "Ionicons" }, "expo-image": { Image: "Image" },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@/constants/theme": theme, "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@/utils/authContext": { AuthContext }, "./authContext": { AuthContext },
    "@/services/accountScope": scope,
    "@react-native-async-storage/async-storage": { getItem: (...args) => { calls.storage.push(args); return unit(...args); }, setItem: () => { throw Error("Unexpected storage write"); } },
    "@/services/profileService": {
      getProfile: (...args) => { calls.reads.push(plain(args)); return read(...args); },
      getAvatar: (...args) => { calls.avatars.push(plain(args)); return getAvatar(...args); },
      patchProfile: (...args) => { calls.patches.push(plain(args)); return patch(...args); },
      removeAvatar: (...args) => { calls.removes.push(plain(args)); return remove(...args); },
    },
    "@/services/privateFiles": {
      discardPickedPhoto: async (...args) => { calls.discards.push(plain(args)); },
      uploadAvatar: (...args) => { calls.uploads.push(plain(args)); return upload(...args); },
    },
    "expo-image-picker": { launchImageLibraryAsync: (...args) => { calls.picker.push(plain(args)); return picker(...args); } },
    "expo-image-manipulator": { SaveFormat: { JPEG: "jpeg" }, ImageManipulator: { manipulate: (uri) => { calls.manipulates.push(uri); return { resize: (value) => calls.resizes.push(plain(value)), renderAsync: async () => {
      const result = await render();
      return { saveAsync: (...args) => { calls.saves.push(plain(args)); return result.saveAsync(...args); } };
    } }; } } },
    "@react-navigation/native": { useNavigation: () => ({ dispatch: (action) => calls.dispatches.push(plain(action)) }), usePreventRemove: (enabled, callback) => { prevention = { enabled, callback }; } },
    "expo-router": { useRouter: () => router, useFocusEffect: (callback) => React.useEffect(callback, [callback]) },
  };
  mocks["@/hooks/use-theme-color"] = load("hooks/use-theme-color.ts", mocks);
  mocks["@/components/themed-text"] = mocks["./themed-text"] = load("components/themed-text.tsx", mocks);
  mocks["@/components/profile-ui"] = load("components/profile-ui.tsx", mocks);
  mocks["@/components/screen-state"] = load("components/screen-state.tsx", mocks);
  mocks["@/utils/weightUnits"] = mocks["./weightUnits"] = load("utils/weightUnits.ts", mocks, { console: { ...console, warn: (...args) => calls.warnings.push(args) } });
  mocks["@/utils/profileForm"] = load("utils/profileForm.ts", mocks);
  const actualProvider = load("utils/profileContext.tsx", mocks);
  mocks["@/utils/profileContext"] = actualProvider;
  const { default: Screen } = load(route, mocks);
  function Probe() { context = actualProvider.useProfile(); return null; }
  const element = () => React.createElement(AuthContext.Provider, { value: account }, React.createElement(actualProvider.ProfileProvider, null, React.createElement(Probe), ready && React.createElement(Screen)));
  await act(async () => { tree = create(element()); });
  ready = true;
  await act(async () => tree.update(element()));
  return { tree, calls, get context() { return context; }, get prevented() { return prevention.enabled; },
    setRead: (value) => { read = value; }, setPatch: (value) => { patch = value; }, setUpload: (value) => { upload = value; }, setPicker: (value) => { picker = value; },
    account: async (id, token = `fixture-token-${id.slice(-1)}`) => { scope.invalidateAccountRequests(); account = { ...account, token, user: { id } }; currentProfile = profile({ id, preferred_name: id }); await act(async () => tree.update(element())); },
    retry: async () => { await act(async () => context.refresh()); },
    beforeRemove: async () => { await act(async () => prevention.callback({ data: { action: { type: "GO_BACK" } } })); },
  };
}

test("scope: imports, account wrapper, controller and shared modules remain byte-exact", () => {
  const input = source(route);
  for (const [part, expected] of [
    [input.slice(0, input.indexOf("type PhotoEdit")), "22fb66c7e591b09c8edadc57bab20a4fa02959821c0bf3bebbb430ef8ee7ee32"],
    [input.slice(input.indexOf("export default function"), input.indexOf("function Editor()")), "6e5ed0f27e1e86de89482ee901ba01f86f22a680e31fdd8162efa71ee9ee26c1"],
    [input.slice(input.indexOf("function Editor()"), input.indexOf("  const inputStyle")), "2d2b1ae1ceaa5db27ba610d3d6bcee76eea9181416526524d71be0f0dddf0aff"],
  ]) assert.equal(hash(part), expected);
  for (const [file, expected] of Object.entries({
    "components/profile-ui.tsx": "cccfdb39b90ce35cf6a2f1d787f858f8147a16b3545e2f5b1122453c18ca30a7",
    "utils/profileContext.tsx": "752e9258ab4d0c0859d1f39092293eaaccc22c9336786aea1eb99d6eafba4c46",
    "services/accountScope.ts": "cb7920358c2e0de7a2286fd7c6cf226a528b466be96701eab4e2ba638fad20d7",
    "utils/profileForm.ts": "6f80af855d193b28970013b94cb1db50a5802c1be8f29b6e4bc4617f22abdb11",
    "utils/weightUnits.ts": "2a7ba690e40480894475bb1e7a67007a1c1ddccc2c78e6e872896f735fb470c3",
    "services/profileService.ts": "a5c26d21a6b801a667267ca7c42c931a3b329285f34083a97efe8e4685507540",
    "services/privateFiles.ts": "85a3976e291cc9c78c8f9ab04a82d65ecfa0d7951c13616c5b58916dbfdb0481",
    "components/screen-state.tsx": "31bb083f19309cf2e44f2b93ddde2266fd57e40cc8191b3e57305c8320d4158f",
    "components/themed-text.tsx": "06d02c5a33dd258563726e8586a4b588e2df7c087ac291be6a225f89bf1ac974",
    "constants/theme.ts": "0e4066b19531c70b14aeb5656a6f0de16b37f56ad410b87c2f923168cebfcad1",
    "utils/authContext.tsx": "b1f62934043ff5894ed0f5a4f9e201f66bc6801a3bc4a6ca29c5509a7df2bb28",
  })) assert.equal(hash(source(file)), expected, file);
});

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: local photo row bounds both actions and retains wrapping geometry while picker is pending`, async () => {
    const pending = deferred(), v = await form(scheme, { profile: { avatar_version: "fixture-v1" }, picker: () => pending.promise });
    const row = () => host(v, "change-photo").parent;
    const checkGeometry = () => {
      assert.deepEqual(plain(flat(row().props.style)), { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 26, rowGap: 8 });
      assert.equal(row().children.filter((n) => n.type === "Pressable").length, 2);
      for (const id of ["change-photo", "remove-photo"]) {
        const style = flat(host(v, id).props.style);
        assert.equal(style.maxWidth, "100%"); assert.ok(style.minWidth >= 44); assert.ok(style.minHeight >= 44);
        assert.equal(flat(host(v, id).findByType("Text").props.style).textAlign, "center");
      }
      assert.ok(flat(host(v, "cancel").props.style).minHeight >= 44);
    };
    checkGeometry(); await pick(v); checkGeometry();
    assert.equal(textOf(host(v, "change-photo")), "Opening photos…");
    assert.deepEqual(plain(host(v, "change-photo").props.accessibilityState), { disabled: true, busy: true });
    assert.deepEqual(plain(host(v, "remove-photo").props.accessibilityState), { disabled: true });
    assert.equal(host(v, "save").props.disabled, true);
    assert.equal(flat(host(v, "remove-photo").findByType("Text").props.style).color, "#E5484D");
    await settle(pending, { canceled: true }); checkGeometry();
    assert.equal(textOf(host(v, "change-photo")), "Change photo"); assert.equal(host(v, "remove-photo").props.disabled, false); await close(v);
  });

  test(`${scheme}: ordinary photo/Cancel actions are neutral while Save, Remove and meaningful selections retain their colors`, async () => {
    const v = await form(scheme, { profile: { avatar_version: "fixture-v1" } }), colors = theme.Colors[scheme];
    for (const id of ["change-photo", "cancel"]) assert.equal(flat(host(v, id).findByType("Text").props.style).color, colors.text);
    assert.equal(flat(host(v, "save").findByType("Text").props.style).color, colors.primaryButton);
    assert.equal(flat(host(v, "remove-photo").findByType("Text").props.style).color, "#E5484D");
    assert.equal(flat(host(v, "weight-kg").findByType("Text").props.style).color, colors.primaryButton);
    assert.equal(flat(host(v, "weight-kg").props.style).backgroundColor, `${colors.primaryButton}18`);
    assert.equal(flat(host(v, "weight-lb").findByType("Text").props.style).color, colors.icon);
    await tap(host(v, "gender"));
    const selected = v.tree.root.findAll((n) => n.type === "Pressable" && n.props.accessibilityRole === "radio" && n.props.accessibilityState.checked);
    assert.equal(selected.length, 1); assert.equal(textOf(selected[0]), "Female");
    assert.equal(flat(selected[0].findByType("Text").props.style).color, colors.primaryButton);
    const image = v.tree.root.findByType("Image"); await act(async () => image.props.onError());
    const initials = v.tree.root.findAllByType("Text").find((n) => textOf(n) === "AL");
    assert.equal(flat(initials.props.style).color, colors.primaryButton); await close(v);
  });

  test(`${scheme}: actual route hydrates fields and preserves title, action semantics and limits`, async () => {
    const v = await form(scheme);
    assert.ok(texts(v).includes("Edit Profile"));
    assert.ok(texts(v).includes("Save")); assert.ok(texts(v).includes("Cancel"));
    assert.equal(host(v, "save").props.disabled, true); assert.equal(v.prevented, false);
    for (const [id, value, maxLength] of [["preferred-name", "Ada", 50], ["last-name", "Lovelace", 50], ["age", "32", 3]]) { assert.equal(host(v, id).props.value, value); assert.equal(host(v, id).props.maxLength, maxLength); }
    assert.equal(host(v, "weight").props.value, "70.1"); assert.equal(host(v, "weight").props.keyboardType, "decimal-pad");
    assert.equal(host(v, "weight-kg").props.accessibilityState.selected, true);
    assert.equal(host(v, "gender").props.accessibilityState.expanded, false);
    assert.equal(host(v, "remove-photo"), undefined);
    assert.deepEqual(v.calls.reads, [["fixture-token-A"]]); assert.deepEqual(v.calls.storage, [["primerep.weightUnit"]]);
    await close(v);
  });

  test(`${scheme}: clean Back and Cancel dispatch without alerts or service writes`, async () => {
    const v = await form(scheme); await tap(host(v, "page-back")); await tap(host(v, "cancel"));
    assert.equal(v.calls.dispatches.length, 2); assert.equal(v.calls.alerts.length, 0); assert.equal(v.calls.patches.length, 0); await close(v);
  });

  test(`${scheme}: dirty Back keeps editing or dispatches exact discard action`, async () => {
    const v = await form(scheme); await change(v, "preferred-name", "Grace");
    assert.equal(v.prevented, true); await tap(host(v, "page-back"));
    const [title, message, buttons] = v.calls.alerts[0];
    assert.equal(title, "Discard changes?"); assert.equal(message, "Your unsaved profile changes will be lost.");
    assert.deepEqual(plain(buttons.map(({ text, style }) => ({ text, style }))), [{ text: "Keep editing", style: "cancel" }, { text: "Discard", style: "destructive" }]);
    assert.equal(v.calls.dispatches.length, 0); await act(async () => buttons[1].onPress());
    assert.deepEqual(v.calls.dispatches, [{ type: "GO_BACK" }]); await close(v);
  });

  test(`${scheme}: dirty Cancel uses the same discard guard and reverting clears dirty state`, async () => {
    const v = await form(scheme); await change(v, "last-name", "Byron"); await tap(host(v, "cancel"));
    assert.equal(v.calls.alerts.length, 1); assert.equal(v.calls.dispatches.length, 0);
    await change(v, "last-name", "Lovelace"); assert.equal(v.prevented, false); assert.equal(host(v, "save").props.disabled, true); await close(v);
  });

  test(`${scheme}: exact trimmed changed detail payload installs identity before navigating`, async () => {
    const v = await form(scheme); await change(v, "preferred-name", " Grace "); await change(v, "last-name", " "); await save(v);
    assert.deepEqual(v.calls.patches, [["fixture-token-A", { preferred_name: "Grace", last_name: null }]]);
    assert.equal(v.context.profile.preferred_name, "Grace"); assert.equal(v.calls.identities.length, 1); assert.equal(v.calls.routes.length, 1); assert.equal(v.calls.dispatches.length, 1); await close(v);
  });

  test(`${scheme}: optional body fields clear to null and normalized gender options preserve semantics`, async () => {
    const v = await form(scheme); await change(v, "weight", ""); await change(v, "age", ""); await tap(host(v, "gender"));
    const radios = v.tree.root.findAll((n) => n.type === "Pressable" && n.props.accessibilityRole === "radio");
    assert.deepEqual(radios.map(textOf), ["Male", "Female", "Other", "Prefer not to say", "Not provided"]);
    assert.equal(radios[1].props.accessibilityState.checked, true); await tap(radios[4]); await save(v);
    assert.deepEqual(v.calls.patches, [["fixture-token-A", { age: null, gender: null, weight: null, weight_unit: "KG" }]]); await close(v);
  });

  test(`${scheme}: unedited unit toggle retains source precision and stays clean`, async () => {
    const v = await form(scheme); await tap(host(v, "weight-lb")); assert.equal(host(v, "weight").props.value, "154.6");
    assert.equal(host(v, "save").props.disabled, true); await tap(host(v, "weight-kg")); assert.equal(host(v, "weight").props.value, "70.1"); assert.equal(v.prevented, false); await close(v);
  });

  test(`${scheme}: comma input converts edited weight and submits selected unit`, async () => {
    const v = await form(scheme); await change(v, "weight", "80,5"); assert.equal(host(v, "weight").props.value, "80.5");
    await tap(host(v, "weight-lb")); assert.equal(host(v, "weight").props.value, "177.5"); await save(v);
    assert.deepEqual(v.calls.patches, [["fixture-token-A", { weight: 177.5, weight_unit: "LB" }]]); await close(v);
  });

  for (const [field, value, message] of [
    ["preferred-name", " ", "Enter a preferred name between 1 and 50 characters."],
    ["last-name", "x".repeat(51), "Your last name can have up to 50 characters."],
    ["weight", "318", "Enter a weight greater than zero and no more than 700 lb (317.5 kg)."],
    ["age", "12", "Enter an age between 13 and 120, or leave it blank."],
  ]) test(`${scheme}: ${field} validation preserves exact error without service writes`, async () => {
    const v = await form(scheme); await change(v, field, value); await save(v); assert.equal(error(v), message); assert.equal(v.calls.patches.length, 0); assert.equal(v.calls.routes.length, 0); await close(v);
  });

  test(`${scheme}: pending save disables form/photo/Cancel, guards repeated Save and blocks beforeRemove`, async () => {
    const pending = deferred(), v = await form(scheme, { patch: () => pending.promise }); await change(v, "age", "33"); await save(v);
    assert.equal(textOf(host(v, "save")), "Saving…"); assert.deepEqual(plain(host(v, "save").props.accessibilityState), { disabled: true, busy: true });
    for (const id of ["cancel", "change-photo", "weight-lb", "gender"]) assert.equal(host(v, id).props.disabled, true);
    for (const id of ["preferred-name", "last-name", "weight", "age"]) assert.equal(host(v, id).props.editable, false);
    await act(async () => host(v, "save").props.onPress()); await v.beforeRemove(); await tap(host(v, "page-back"));
    assert.equal(v.calls.patches.length, 1); assert.equal(v.calls.alerts.length, 0); assert.equal(v.calls.dispatches.length, 0);
    await settle(pending, profile({ age: 33 })); assert.equal(v.calls.dispatches.length, 1); await close(v);
  });

  test(`${scheme}: failed details save exposes exact error then retry submits the same changes`, async () => {
    const v = await form(scheme, { patch: async () => { throw Error("Fixture details failure"); } }); await change(v, "age", "33"); await save(v);
    assert.equal(error(v), "Fixture details failure"); assert.equal(host(v, "save").props.disabled, false); assert.equal(v.calls.routes.length, 0);
    v.setPatch(async () => profile({ age: 33 })); await save(v); assert.equal(v.calls.patches.length, 2); assert.equal(v.calls.dispatches.length, 1); await close(v);
  });

  test(`${scheme}: picker cancel preserves clean state and exact crop options`, async () => {
    const v = await form(scheme); await pick(v);
    assert.deepEqual(v.calls.picker, [[{ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 }]]);
    assert.equal(v.calls.manipulates.length, 0); assert.equal(host(v, "save").props.disabled, true); assert.equal(error(v), null); await close(v);
  });

  test(`${scheme}: pending picker disables Save/photo but inherited Cancel and navigation remain available`, async () => {
    const pending = deferred(), v = await form(scheme, { picker: () => pending.promise }); await pick(v);
    assert.equal(textOf(host(v, "change-photo")), "Opening photos…"); assert.equal(host(v, "change-photo").props.disabled, true); assert.equal(host(v, "save").props.disabled, true);
    assert.equal(host(v, "cancel").props.disabled, false); assert.equal(host(v, "age").props.editable, true); assert.equal(v.prevented, false);
    await tap(host(v, "cancel")); assert.equal(v.calls.dispatches.length, 1); await settle(pending, { canceled: true }); await close(v);
  });

  test(`${scheme}: picked landscape photo normalizes JPEG, cleans source and uploads exact URI`, async () => {
    const v = await form(scheme, { picker: async () => asset() }); await pick(v);
    assert.deepEqual(v.calls.manipulates, ["fixture://picked-1"]); assert.deepEqual(v.calls.resizes, [{ width: 512 }]); assert.deepEqual(v.calls.saves, [[{ format: "jpeg", compress: 0.85 }]]);
    assert.deepEqual(v.calls.discards, [["fixture://picked-1"]]); assert.ok(host(v, "remove-photo")); assert.equal(v.prevented, true); await save(v);
    assert.deepEqual(v.calls.uploads, [["fixture-token-A", "fixture://normalized-1"]]); assert.equal(v.calls.patches.length, 0); assert.equal(v.context.profile.avatar_version, "fixture-v2"); assert.equal(v.calls.dispatches.length, 1); await close(v);
  });

  test(`${scheme}: portrait photo uses height resize and replacing pending photo cleans previous URI`, async () => {
    const v = await form(scheme, { picker: async () => asset("fixture://portrait", 400, 800) }); await pick(v); await pick(v);
    assert.deepEqual(v.calls.resizes, [{ height: 512 }, { height: 512 }]); assert.ok(v.calls.discards.some(([uri]) => uri === "fixture://normalized-1")); await close(v);
  });

  test(`${scheme}: picker rejection shows exact recoverable photo error`, async () => {
    const v = await form(scheme, { picker: async () => { throw Error("Fixture permission denied"); } }); await pick(v);
    assert.equal(error(v), "Your photo couldn’t be opened. Choose another image or allow photo access in device settings."); assert.equal(host(v, "change-photo").props.disabled, false); assert.equal(v.calls.uploads.length, 0); await close(v);
  });

  test(`${scheme}: normalization failure retains temporary source for unmount cleanup`, async () => {
    const v = await form(scheme, { picker: async () => asset(), render: async () => { throw Error("Fixture render failure"); } }); await pick(v);
    assert.ok(error(v)); assert.equal(v.calls.discards.length, 0); await close(v); assert.deepEqual(v.calls.discards, [["fixture://picked-1"]]);
  });

  test(`${scheme}: existing photo Remove hides itself and saves through removeAvatar only`, async () => {
    const v = await form(scheme, { profile: { avatar_version: "fixture-v1" } }); assert.ok(host(v, "remove-photo")); await tap(host(v, "remove-photo"));
    assert.equal(host(v, "remove-photo"), undefined); assert.equal(v.prevented, true); await save(v);
    assert.deepEqual(v.calls.removes, [["fixture-token-A"]]); assert.equal(v.calls.uploads.length, 0); assert.equal(v.calls.patches.length, 0); assert.equal(v.context.profile.avatar_version, null); await close(v);
  });

  test(`${scheme}: details patch precedes photo failure and retry sends photo only`, async () => {
    const pending = deferred(), v = await form(scheme, { picker: async () => asset(), patch: () => pending.promise, upload: async () => { throw Error("Fixture upload failure"); } });
    await pick(v); await change(v, "preferred-name", "Grace"); await save(v); assert.equal(v.calls.uploads.length, 0);
    await settle(pending, profile({ preferred_name: "Grace" }));
    assert.equal(error(v), "Profile details saved. Your photo couldn’t be updated; your previous photo is still in place. Try Save again.");
    assert.equal(v.context.profile.preferred_name, "Grace"); assert.equal(v.calls.routes.length, 0); assert.equal(v.calls.patches.length, 1);
    v.setUpload(async () => profile({ preferred_name: "Grace", avatar_version: "fixture-v2" })); await save(v);
    assert.equal(v.calls.patches.length, 1); assert.equal(v.calls.uploads.length, 2); assert.equal(v.calls.dispatches.length, 1); await close(v);
  });

  test(`${scheme}: photo-only failure keeps exact service error and dirty retry state`, async () => {
    const v = await form(scheme, { picker: async () => asset(), upload: async () => { throw Error("Fixture photo failure"); } }); await pick(v); await save(v);
    assert.equal(error(v), "Fixture photo failure"); assert.equal(v.prevented, true); assert.equal(host(v, "save").props.disabled, false); assert.equal(v.calls.routes.length, 0); await close(v);
  });

  test(`${scheme}: loading resource keeps shared loading title and disabled Save`, async () => {
    const pending = deferred(), v = await form(scheme, { read: () => pending.promise });
    assert.ok(texts(v).includes("Loading profile")); assert.equal(host(v, "preferred-name"), undefined); assert.equal(host(v, "save").props.disabled, true);
    await settle(pending, profile()); assert.equal(host(v, "preferred-name").props.value, "Ada"); await close(v);
  });

  test(`${scheme}: failed resource renders shared Retry and successfully rehydrates`, async () => {
    const v = await form(scheme, { read: async () => { throw Error("Fixture read failure"); } });
    assert.ok(texts(v).includes("Profile couldn’t load")); assert.ok(texts(v).includes("Your profile couldn’t load. Check your connection and try again."));
    const retry = v.tree.root.findAllByType("Pressable").find((n) => n.props.accessibilityLabel === "Retry");
    v.setRead(async () => profile()); await tap(retry); assert.equal(v.calls.reads.length, 2); assert.equal(host(v, "preferred-name").props.value, "Ada"); await close(v);
  });

  test(`${scheme}: unit preference defers form and failed storage falls back to LB`, async () => {
    const pending = deferred(), v = await form(scheme, { unit: () => pending.promise });
    assert.equal(host(v, "preferred-name"), undefined); assert.ok(texts(v).includes("Profile couldn’t load"));
    await settle(pending, Error("Fixture unit unavailable"), true); assert.equal(host(v, "weight-lb").props.accessibilityState.selected, true); assert.equal(v.calls.warnings.length, 1); await close(v);
  });

  test(`${scheme}: Retry while unit pending retries profile and a later unit read hydrates`, async () => {
    const pending = deferred(); let count = 0;
    const v = await form(scheme, { unit: () => ++count === 1 ? pending.promise : Promise.resolve("KG") });
    const retry = v.tree.root.findAllByType("Pressable").find((n) => n.props.accessibilityLabel === "Retry");
    v.setRead(async () => profile({ preferred_name: "Retry Ada" })); await tap(retry); assert.equal(host(v, "preferred-name").props.value, "Retry Ada");
    await settle(pending, "LB"); assert.equal(host(v, "weight-kg").props.accessibilityState.selected, true); await close(v);
  });

  for (const reject of [false, true]) test(`${scheme}: account A→B→A after explicit refresh fences stale details ${reject ? "failure" : "success"}`, async () => {
    const pending = deferred(), v = await form(scheme, { patch: () => pending.promise }); await change(v, "age", "33"); await save(v);
    await v.account("fixture-B"); await v.account("fixture-A");
    assert.equal(host(v, "preferred-name"), undefined); assert.ok(texts(v).includes("Loading profile"));
    await v.retry(); await settle(pending, reject ? Error("Stale error") : profile({ age: 33 }), reject);
    assert.equal(host(v, "preferred-name").props.value, "fixture-A"); assert.equal(host(v, "age").props.value, "32"); assert.equal(v.calls.identities.length, 0); assert.equal(v.calls.routes.length, 0); assert.equal(error(v), null); await close(v);
  });

  test(`${scheme}: account transition fences old picker and discards its late asset`, async () => {
    const pending = deferred(), v = await form(scheme, { picker: () => pending.promise }); await pick(v); await v.account("fixture-B"); await settle(pending, asset());
    assert.deepEqual(v.calls.discards, [["fixture://picked-1"]]); assert.equal(v.calls.manipulates.length, 0); assert.equal(host(v, "preferred-name"), undefined);
    await v.retry(); assert.equal(host(v, "preferred-name").props.value, "fixture-B"); assert.equal(host(v, "remove-photo"), undefined); await close(v);
  });

  test(`${scheme}: unmount during normalization cleans source and late normalized resource`, async () => {
    const pending = deferred(), v = await form(scheme, { picker: async () => asset(), render: () => pending.promise }); await pick(v); await close(v);
    await settle(pending, { saveAsync: async () => ({ uri: "fixture://late-normalized" }) });
    assert.ok(v.calls.discards.some(([uri]) => uri === "fixture://picked-1")); assert.ok(v.calls.discards.some(([uri]) => uri === "fixture://late-normalized")); assert.equal(v.calls.uploads.length, 0);
  });

  for (const reject of [false, true]) test(`${scheme}: unmounted details ${reject ? "failure" : "success"} cannot install identity or navigate`, async () => {
    const pending = deferred(), v = await form(scheme, { patch: () => pending.promise }); await change(v, "age", "33"); await save(v); await close(v);
    await settle(pending, reject ? Error("Stale failure") : profile({ age: 33 }), reject); assert.equal(v.calls.identities.length, 0); assert.equal(v.calls.routes.length, 0);
  });

  test(`${scheme}: avatar load failure uses shared initials and pending replacements clean on unmount`, async () => {
    const v = await form(scheme, { profile: { avatar_version: "fixture-v1" }, getAvatar: async () => { throw Error("Fixture avatar unavailable"); }, picker: async () => asset() });
    assert.equal(v.context.avatarError, true); assert.ok(texts(v).includes("AL")); await pick(v); await close(v);
    assert.ok(v.calls.discards.some(([uri]) => uri === "fixture://normalized-1"));
  });

  for (const reject of [false, true]) test(`${scheme}: account A→B→A fences stale profile resource ${reject ? "failure" : "success"}`, async () => {
    const pending = deferred(), v = await form(scheme, { read: () => pending.promise });
    v.setRead(async (token) => profile({ id: `fixture-${token.slice(-1)}`, preferred_name: "Fresh account" }));
    await v.account("fixture-B"); await v.account("fixture-A"); await v.retry();
    await settle(pending, reject ? Error("Stale resource failure") : profile({ preferred_name: "Stale account" }), reject);
    assert.equal(host(v, "preferred-name").props.value, "Fresh account"); assert.equal(v.context.error, null); assert.equal(v.calls.identities.length, 0); await close(v);
  });

  for (const reject of [false, true]) test(`${scheme}: account A→B→A fences pending photo upload ${reject ? "failure" : "success"}`, async () => {
    const pending = deferred(), v = await form(scheme, { picker: async () => asset(), upload: () => pending.promise });
    await pick(v); await save(v); await v.account("fixture-B"); await v.account("fixture-A"); await v.retry();
    await settle(pending, reject ? Error("Stale upload failure") : profile({ avatar_version: "stale-photo" }), reject);
    assert.equal(v.context.profile.avatar_version, null); assert.equal(host(v, "remove-photo"), undefined); assert.equal(v.calls.identities.length, 0); assert.equal(v.calls.routes.length, 0); assert.equal(error(v), null); await close(v);
  });

  for (const reject of [false, true]) test(`${scheme}: unmounted photo upload ${reject ? "failure" : "success"} cannot install or navigate`, async () => {
    const pending = deferred(), v = await form(scheme, { picker: async () => asset(), upload: () => pending.promise });
    await pick(v); await save(v); await close(v);
    await settle(pending, reject ? Error("Unmounted upload failure") : profile({ avatar_version: "stale-photo" }), reject);
    assert.equal(v.calls.identities.length, 0); assert.equal(v.calls.routes.length, 0); assert.ok(v.calls.discards.some(([uri]) => uri === "fixture://normalized-1"));
  });
}
