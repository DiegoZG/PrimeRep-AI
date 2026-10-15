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
const require = createRequire(import.meta.url), babel = require("@babel/core"), compiled = new Map();
const source = (file) => readFileSync(path.join(root, file), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const flat = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const text = (node) => typeof node === "string" ? node : node?.children?.map(text).join("") ?? "";
const host = (view, id) => view.tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const headers = (view, title) => view.tree.root.findAll((node) => node.type === "Text" && node.props.accessibilityRole === "header" && text(node) === title);
const scrollerAncestor = (node) => { for (let parent = node.parent; parent; parent = parent.parent) if (parent.type === "ScrollView") return parent; return null; };
const routes = [
  ["edit", "app/profile/edit.tsx", "Edit Profile", "profile-edit-screen"],
  ["achievements", "app/profile/achievements.tsx", "Achievements", "achievements-screen"],
  ["help", "app/settings/help.tsx", "Help & Support", "help-screen"],
  ["export", "app/settings/export.tsx", "Download my data", "export-screen"],
  ["tab", "app/(tabs)/profile.tsx", "Profile", "profile-screen"],
];

function load(file, mocks) {
  if (!compiled.has(file)) compiled.set(file, babel.transformSync(source(file), {
    filename: path.join(root, file), configFile: false, babelrc: false,
    presets: [[require.resolve("babel-preset-expo"), { jsxRuntime: "classic", enableBabelRuntime: false, worklets: false, reanimated: false }]],
    caller: { name: "metro", bundler: "metro", platform: "ios", engine: "hermes", isDev: true, isServer: false, isReactServer: false, isNodeModule: false, supportsStaticESM: false, supportsReactCompiler: true },
  }).code);
  const module = { exports: {} };
  vm.runInNewContext(compiled.get(file), { React, module, exports: module.exports, console, process: { env: {} }, __DEV__: true, Error, require: (name) => {
    assert.ok(Object.hasOwn(mocks, name), `Unmocked ${name} in ${file}`); return mocks[name];
  } }, { filename: path.join(root, file) });
  return module.exports;
}

function environment({ scheme = "light", fontScale = 1, width = 375, state = "ready" } = {}) {
  const dimensions = { width, height: width === 375 ? 667 : 932, fontScale, scale: 2 };
  const dimensionListeners = new Set();
  function useDimensions() {
    const [value, setValue] = React.useState(() => ({ ...dimensions }));
    React.useEffect(() => { dimensionListeners.add(setValue); return () => dimensionListeners.delete(setValue); }, []);
    return value;
  }
  const calls = { forbidden: [], back: 0, routes: [], refresh: 0, resourceRefresh: 0, prevented: [] };
  const forbidden = (name) => () => { calls.forbidden.push(name); throw new Error(`Forbidden ${name}`); };
  const router = { back: () => calls.back++, push: (route) => calls.routes.push(route) };
  const refresh = async () => { calls.refresh++; }, resourceRefresh = async () => { calls.resourceRefresh++; };
  const profile = state === "ready" ? { id: "fixture-A", preferred_name: "Ada", last_name: "Lovelace", email: "ada@example.invalid", weight: 70, weight_unit: "KG", age: 32, gender: "Female", avatar_version: null } : null;
  const achievements = { total_completed: 0, current_active_weeks: 0, weekly_activity: [], items: [] };
  const AuthContext = React.createContext({ user: { id: "fixture-A" }, token: "fixture-token", logOut: forbidden("logout"), acceptProfileIdentity: forbidden("identity") });
  const NotificationsContext = React.createContext({ unregisterCurrentDevice: forbidden("unregister") });
  const native = { View: "View", Text: "Text", ScrollView: "ScrollView", Pressable: "Pressable", TextInput: "TextInput", KeyboardAvoidingView: "KeyboardAvoidingView", RefreshControl: "RefreshControl", ActivityIndicator: "ActivityIndicator", Switch: "Switch", Alert: { alert: forbidden("alert") }, Linking: { openURL: forbidden("mail") }, Platform: { OS: "ios", Version: "18.5", select: (values) => values.ios ?? values.default }, StyleSheet: { create: (styles) => styles, hairlineWidth: 0.5 }, useWindowDimensions: useDimensions };
  const animation = () => Object.fromEntries(["springify", "damping", "stiffness", "reduceMotion", "duration"].map((name) => [name, animation]));
  const mocks = {
    react: React, "react/compiler-runtime": require("react/compiler-runtime"), "react-native": native, "expo/virtual/env": { env: {} },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@expo/vector-icons": { Ionicons: "Ionicons" }, "expo-image": { Image: "Image" },
    "expo-router": { useRouter: () => router, useFocusEffect: (callback) => React.useEffect(callback, [callback]) },
    "@react-navigation/native": { useNavigation: () => ({ dispatch: forbidden("navigation dispatch") }), usePreventRemove: (value) => { calls.prevented.push(value); } },
    "expo-image-picker": { requestMediaLibraryPermissionsAsync: forbidden("photo permission"), launchImageLibraryAsync: forbidden("photo picker") },
    "expo-image-manipulator": { ImageManipulator: { manipulate: forbidden("photo normalization") }, SaveFormat: { JPEG: "jpeg" } },
    "expo-constants": { __esModule: true, default: { expoConfig: { version: "fixture-version" } } },
    "react-native-reanimated": { __esModule: true, default: { View: "Animated.View" }, FadeInDown: animation(), FadeOutUp: animation(), ReduceMotion: { System: "system" } },
    "@react-native-async-storage/async-storage": { __esModule: true, default: { getItem: async () => "KG", setItem: forbidden("unit persistence") } },
    "@/hooks/use-color-scheme": { useColorScheme: () => scheme }, "@/utils/authContext": { AuthContext }, "@/utils/notificationsContext": { NotificationsContext },
    "@/utils/profileContext": { useProfile: () => ({ profile, avatar: null, loading: state === "loading", error: state === "error" ? "Fixture profile error" : null, refresh, install: forbidden("profile install"), retryAvatar: forbidden("avatar retry") }) },
    "@/services/profileService": { getAchievements: forbidden("achievements API"), patchProfile: forbidden("profile save"), removeAvatar: forbidden("photo removal") },
    "@/services/workoutLoggingService": { getStats: forbidden("stats API"), listCompletedSessions: forbidden("history API") },
    "@/services/privateFiles": { exportAccount: forbidden("archive/share"), uploadAvatar: forbidden("photo upload"), discardPickedPhoto: forbidden("private file cleanup") },
  };
  const actual = (file) => load(file, mocks);
  mocks["@/services/accountScope"] = actual("services/accountScope.ts");
  mocks["@/utils/weightUnits"] = actual("utils/weightUnits.ts"); mocks["./weightUnits"] = mocks["@/utils/weightUnits"];
  mocks["@/utils/profileForm"] = actual("utils/profileForm.ts");
  mocks["@/constants/theme"] = actual("constants/theme.ts");
  mocks["@/hooks/use-theme-color"] = { useThemeColor: (_, name) => mocks["@/constants/theme"].Colors[scheme][name] };
  mocks["@/components/themed-text"] = actual("components/themed-text.tsx"); mocks["./themed-text"] = mocks["@/components/themed-text"];
  mocks["@/components/profile-ui"] = actual("components/profile-ui.tsx");
  mocks["@/components/screen-state"] = actual("components/screen-state.tsx");
  mocks["@/constants/support"] = actual("constants/support.ts");
  const view = { calls, ui: mocks["@/components/profile-ui"], colors: mocks["@/constants/theme"].Colors[scheme], native, mocks, tree: null };
  view.mount = async (element) => { await act(async () => { view.tree = create(element); }); return view; };
  view.dimensions = async (next) => { Object.assign(dimensions, next); await act(async () => { for (const listener of dimensionListeners) listener({ ...dimensions }); }); };
  view.route = async (name) => {
    const file = routes.find((item) => item[0] === name)[1];
    mocks["@/hooks/use-account-resource"] = { useAccountResource: () => ({ data: state === "ready" ? name === "tab" ? { achievements, stats: null, history: [] } : achievements : null, loading: state === "loading", error: state === "error" ? "Fixture resource error" : null, refresh: resourceRefresh }) };
    return view.mount(React.createElement(actual(file).default));
  };
  view.close = async () => { await act(async () => view.tree.unmount()); assert.deepEqual(calls.forbidden, []); };
  return view;
}

test("scope: approved shared module, exact edit adapter reconstruction and other consumer/controller bytes", () => {
  const pins = {
    "components/profile-ui.tsx": "71dba99a5759d5e5a10e8c429d20ded233f5b5e7a34a5a5638f3a3522e7da0a0",
    "app/profile/achievements.tsx": "d5c2a3292ed3e30d521ab152e5b2d5d5fbb2dc729e686d9f79ac3fdc93dfa61d",
    "app/settings/help.tsx": "a43d46bb4b034985a8de1028955173cf7c50faf80701c20bfb8469f019f3a7fc",
    "app/settings/export.tsx": "e4008f2ca38d650f6c752262a97e7072c1a5504f3bd8b61cc4bf7fb951205b9c",
    "app/(tabs)/profile.tsx": "be6a2cc87f62c4fcec31164efb46d4e0a9cdf9ca7e4da76b990fac6066957105",
    "utils/profileContext.tsx": "752e9258ab4d0c0859d1f39092293eaaccc22c9336786aea1eb99d6eafba4c46",
    "utils/profileForm.ts": "6f80af855d193b28970013b94cb1db50a5802c1be8f29b6e4bc4617f22abdb11",
    "services/accountScope.ts": "cb7920358c2e0de7a2286fd7c6cf226a528b466be96701eab4e2ba638fad20d7",
    "components/themed-text.tsx": "06d02c5a33dd258563726e8586a4b588e2df7c087ac291be6a225f89bf1ac974",
    "constants/theme.ts": "0e4066b19531c70b14aeb5656a6f0de16b37f56ad410b87c2f923168cebfcad1",
  };
  for (const [file, pin] of Object.entries(pins)) assert.equal(hash(source(file)), pin, file);
  let editor = source("app/profile/edit.tsx");
  for (const [candidate, original] of [["ProfilePage, ProfilePageHeading,", "ProfilePage,"], ["      <ProfilePageHeading />\n", ""]]) { assert.equal(editor.split(candidate).length, 2); editor = editor.replace(candidate, original); }
  assert.equal(Buffer.byteLength(editor), 14010); assert.equal(hash(editor), "940a0cd43d90916c923051449aa86f83e9e72abecbda4b840ec333cab01d5233");
  const shared = source("components/profile-ui.tsx");
  assert.equal(hash(shared.slice(shared.indexOf("export function AchievementRow"), shared.indexOf("export const profileStyles"))), "7acc1d9cc5fcb08729ab4d0f50edcd3b001fcb3e2b28cb63569734352de5b365");
  assert.equal(hash(shared.slice(shared.indexOf("export const profileStyles"))), "c6fa40a3db0b0f47f5336de7f11acca74ad6d825e4c7d17e7b3a93f968c18129");
});

for (const fontScale of [0, 1, 1.3, 1.31, 3.1]) for (const action of [false, true]) test(`shared scale${fontScale} action${Number(action)} puts uncapped title in the right location, preserving callbacks and scroll props`, async () => {
  const view = environment({ fontScale, width: action ? 430 : 375 }); let actionCalls = 0;
  const actionNode = action ? React.createElement("Pressable", { testID: "fixture-action", onPress: () => actionCalls++, disabled: false, style: view.ui.profileStyles.link }, "Save") : null;
  await view.mount(React.createElement(view.ui.ProfilePage, { title: "A complete page title", onBack: () => view.calls.back++, action: actionNode, testID: "fixture-page" }, React.createElement(view.ui.ProfileScroll, null, React.createElement("Text", null, "Existing body"))));
  const title = headers(view, "A complete page title"); assert.equal(title.length, 1); assert.equal(Boolean(scrollerAncestor(title[0])), fontScale > 1.3); assert.equal(flat(title[0].props.style).fontSize, 22); assert.equal(flat(title[0].props.style).lineHeight, 29); assert.equal(title[0].props.allowFontScaling, undefined);
  const scroll = view.tree.root.findByType("ScrollView"); assert.equal(scroll.props.keyboardShouldPersistTaps, "handled"); assert.equal(scroll.props.contentInsetAdjustmentBehavior, undefined); assert.equal(scroll.props.keyboardDismissMode, undefined); assert.equal(flat(scroll.props.contentContainerStyle).paddingBottom, 36); assert.equal(flat(scroll.props.contentContainerStyle).maxWidth, 720);
  await act(async () => host(view, "profile-page-back").props.onPress()); assert.equal(view.calls.back, 1);
  assert.equal(Boolean(host(view, "fixture-action")), action); if (action) { assert.equal(scrollerAncestor(host(view, "fixture-action")), null); await act(async () => host(view, "fixture-action").props.onPress()); assert.equal(actionCalls, 1); }
  await view.close();
});

for (const scheme of ["light", "dark"]) for (const fontScale of [1, 3.1]) for (const [name, , title, id] of routes) test(`${name} ${scheme} scale${fontScale}: actual host, one scroller and uncapped title`, async () => {
  const view = await environment({ scheme, fontScale, width: fontScale === 1 ? 430 : 375 }).route(name);
  assert.ok(host(view, id)); assert.equal(view.tree.root.findAllByType("ScrollView").length, 1);
  const heading = headers(view, title); assert.equal(heading.length, 1); assert.notEqual(heading[0].props.allowFontScaling, false); assert.equal(heading[0].props.maxFontSizeMultiplier, undefined); assert.equal(heading[0].props.numberOfLines, undefined);
  if (name === "tab") { assert.ok(scrollerAncestor(heading[0])); assert.equal(host(view, "profile-page-back"), undefined); }
  else {
    assert.equal(Boolean(scrollerAncestor(heading[0])), fontScale > 1.3); assert.deepEqual([...host(view, id).props.edges], ["top", "bottom"]);
    const back = host(view, "profile-page-back"); assert.equal(back.props.accessibilityLabel, `Back from ${title}`); assert.equal(back.props.accessibilityRole, "button"); assert.equal(flat(back.props.style).minWidth, 44); assert.equal(flat(back.props.style).minHeight, 44);
    await act(async () => back.props.onPress()); assert.equal(view.calls.back, 1);
  }
  if (name === "edit") {
    const save = host(view, "profile-save"), cancel = host(view, "profile-cancel"); assert.equal(save.props.disabled, true); assert.equal(save.props.accessibilityState.busy, false); assert.equal(scrollerAncestor(save), null); assert.equal(flat(save.props.style).minHeight, 44); assert.ok(scrollerAncestor(cancel)); assert.equal(flat(cancel.props.style).minHeight, 44);
    const kav = view.tree.root.findByType("KeyboardAvoidingView"); assert.equal(kav.props.behavior, "padding"); assert.equal(view.tree.root.findByType("ScrollView").props.keyboardShouldPersistTaps, "handled");
  }
  if (name === "export") { assert.equal(host(view, "export-create").props.disabled, false); assert.ok(scrollerAncestor(host(view, "export-create"))); assert.equal(host(view, "export-success"), undefined); }
  if (name === "edit" || name === "tab") {
    const avatar = view.tree.root.findByProps({ accessibilityLabel: "Ada Lovelace profile photo" }); assert.equal(flat(avatar.props.style).width, name === "edit" ? 116 : 76); assert.equal(avatar.props.accessible, true); const initials = avatar.findByType("Text"); assert.equal(text(initials), "AL"); assert.equal(initials.props.allowFontScaling, false); assert.equal(initials.props.accessible, false);
  }
  await view.close();
});

for (const name of ["edit", "achievements"]) for (const state of ["loading", "error"]) test(`${name}: MAX ${state} title uses existing state scroller and Retry stays unchanged`, async () => {
  const view = await environment({ fontScale: 3.1, state }).route(name); assert.equal(view.tree.root.findAllByType("ScrollView").length, 1); assert.ok(scrollerAncestor(headers(view, name === "edit" ? "Edit Profile" : "Achievements")[0]));
  const retry = view.tree.root.findAll((node) => node.type === "Pressable" && node.props.accessibilityLabel === "Retry"); assert.equal(retry.length, state === "error" ? 1 : 0);
  if (state === "error") { const before = view.calls.refresh + view.calls.resourceRefresh; await act(async () => retry[0].props.onPress()); assert.equal(view.calls.refresh + view.calls.resourceRefresh, before + 1); }
  await view.close();
});

for (const size of [76, 116]) for (const name of ["", "  Ada   Lovelace Byron  ", "李"]) test(`avatar${size}: unchanged initials/name label and fixed decorative glyph for ${JSON.stringify(name)}`, async () => {
  const view = environment({ fontScale: 3.1 }); await view.mount(React.createElement(view.ui.ProfileAvatar, { uri: null, name, size })); const circle = view.tree.root.findByType("View"), glyph = view.tree.root.findByType("Text");
  assert.equal(circle.props.accessibilityLabel, `${name || "Your"} profile photo`); assert.equal(circle.props.accessible, true); assert.equal(flat(circle.props.style).width, size); assert.equal(flat(circle.props.style).height, size); assert.equal(flat(circle.props.style).overflow, "hidden"); assert.equal(flat(glyph.props.style).fontSize, size * 0.34); assert.equal(flat(glyph.props.style).lineHeight, size * 0.55); assert.equal(glyph.props.allowFontScaling, false); assert.equal(glyph.props.accessible, false); assert.equal(text(glyph), name === "" ? "P" : name === "李" ? "李" : "AL"); await view.close();
});

test("avatar image failure falls back, new URI resets failure and keeps image privacy props", async () => {
  const view = environment(); await view.mount(React.createElement(view.ui.ProfileAvatar, { uri: "fixture://one", name: "Ada Lovelace" }));
  let image = view.tree.root.findByType("Image"); assert.equal(image.props.cachePolicy, "none"); assert.equal(image.props.contentFit, "cover");
  await act(async () => image.props.onError()); assert.equal(view.tree.root.findAllByType("Image").length, 0); assert.equal(text(view.tree.root), "AL");
  await act(async () => view.tree.update(React.createElement(view.ui.ProfileAvatar, { uri: "fixture://two", name: "Ada Lovelace" })));
  image = view.tree.root.findByType("Image"); assert.equal(image.props.source.uri, "fixture://two"); await view.close();
});

test("help FAQ remains local, with no support-mail or other external action", async () => {
  const view = await environment({ fontScale: 3.1 }).route("help"); const faq = host(view, "help-faq-export"); assert.equal(faq.props.accessibilityState.expanded, false); await act(async () => faq.props.onPress()); assert.equal(host(view, "help-faq-export").props.accessibilityState.expanded, true); assert.match(text(view.tree.root), /Changes that are only on your device are not included yet/); assert.ok(host(view, "help-unavailable")); await view.close();
});

test("context headings are isolated between sibling pages and absent outside a page", async () => {
  const view = environment({ fontScale: 3.1 }), { ProfilePage, ProfileScroll, ProfilePageHeading } = view.ui;
  await view.mount(React.createElement("View", null,
    ...["First page", "Second page"].map((title) => React.createElement(ProfilePage, { key: title, title, onBack: () => {}, testID: title }, React.createElement(ProfileScroll, null, React.createElement("Text", null, "Body")))),
    React.createElement(ProfilePageHeading), React.createElement(ProfileScroll, null, React.createElement("Text", null, "Outside"))));
  assert.equal(view.tree.root.findAllByType("ScrollView").length, 3);
  for (const title of ["First page", "Second page"]) { const found = headers(view, title); assert.equal(found.length, 1); assert.ok(scrollerAncestor(found[0])); assert.equal(host(view, title).findAll((node) => node.type === "Text" && node.props.accessibilityRole === "header").length, 1); }
  await view.dimensions({ fontScale: 1.3 }); for (const title of ["First page", "Second page"]) assert.equal(scrollerAncestor(headers(view, title)[0]), null);
  await view.dimensions({ fontScale: 1.31 }); for (const title of ["First page", "Second page"]) assert.ok(scrollerAncestor(headers(view, title)[0]));
  await view.close();
});

test("same-mounted body state survives normal/large threshold and orientation changes without remount", async () => {
  const view = environment(), { ProfilePage, ProfileScroll } = view.ui; let mounts = 0, unmounts = 0;
  function Body() { const [value, setValue] = React.useState("original"); React.useEffect(() => { mounts++; return () => { unmounts++; }; }, []); return React.createElement("TextInput", { testID: "stateful-field", value, onChangeText: setValue }); }
  await view.mount(React.createElement(ProfilePage, { title: "Stateful page", onBack: () => {} }, React.createElement(ProfileScroll, null, React.createElement(Body))));
  const field = host(view, "stateful-field"); await act(async () => field.props.onChangeText("unsaved edit"));
  for (const fontScale of [1.3, 1.31, 3.1, 1]) { await view.dimensions({ fontScale, width: fontScale > 1.3 ? 375 : 430 }); assert.equal(host(view, "stateful-field"), field); assert.equal(field.props.value, "unsaved edit"); assert.equal(mounts, 1); assert.equal(unmounts, 0); assert.equal(view.tree.root.findAllByType("ScrollView").length, 1); }
  await view.close(); assert.equal(unmounts, 1);
});

test("actual Edit Profile retains unsaved form and Save availability across title relocation", async () => {
  const view = await environment().route("edit"), field = host(view, "profile-preferred-name");
  assert.equal(host(view, "profile-save").props.disabled, true); await act(async () => field.props.onChangeText("Changed name")); assert.equal(host(view, "profile-save").props.disabled, false);
  for (const fontScale of [1.31, 3.1, 1.3]) { await view.dimensions({ fontScale }); assert.equal(host(view, "profile-preferred-name"), field); assert.equal(field.props.value, "Changed name"); assert.equal(host(view, "profile-save").props.disabled, false); assert.equal(scrollerAncestor(host(view, "profile-save")), null); assert.equal(host(view, "profile-page-back").props.disabled, undefined); }
  assert.equal(view.calls.prevented.at(-1), true); await view.close();
});

test("actual Help keeps expanded FAQ when the shared title crosses the large threshold", async () => {
  const view = await environment().route("help"); await act(async () => host(view, "help-faq-export").props.onPress());
  for (const fontScale of [1.31, 3.1, 1.3]) { await view.dimensions({ fontScale }); assert.equal(host(view, "help-faq-export").props.accessibilityState.expanded, true); assert.match(text(view.tree.root), /Changes that are only on your device are not included yet/); }
  await view.close();
});

for (const busy of [false, true]) test(`shared large action busy${Number(busy)} preserves caller disabled/busy props and Back availability`, async () => {
  const view = environment({ fontScale: 3.1 }), action = React.createElement("Pressable", { testID: "busy-action", disabled: busy, accessibilityState: { disabled: busy, busy }, style: view.ui.profileStyles.link }, busy ? "Saving…" : "Save");
  await view.mount(React.createElement(view.ui.ProfilePage, { title: "Edit Profile", onBack: () => view.calls.back++, action }, React.createElement(view.ui.ProfileScroll, null, React.createElement("Text", null, "Body"))));
  assert.equal(host(view, "busy-action").props.disabled, busy); assert.equal(host(view, "busy-action").props.accessibilityState.busy, busy); assert.equal(scrollerAncestor(host(view, "busy-action")), null); assert.equal(host(view, "profile-page-back").props.disabled, undefined); await act(async () => host(view, "profile-page-back").props.onPress()); assert.equal(view.calls.back, 1); await view.close();
});
