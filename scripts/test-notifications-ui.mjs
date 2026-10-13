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
const route = "app/onboarding/notifications.tsx";
const source = (file) => readFileSync(path.join(root, file), "utf8");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const plain = (value) => JSON.parse(JSON.stringify(value));
function load(file, mocks, timers = {}) {
  const filename = path.join(root, file);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const output = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { React, module, exports: module.exports, require: (name) => name in mocks ? mocks[name] : fallback(name), process: { env: {} }, console: { ...console, warn() {}, error() {} }, __DEV__: false, ...timers }, { filename });
  return module.exports;
}
const native = { Pressable: "Pressable", TouchableOpacity: "TouchableOpacity", View: "View", Text: "Text", ScrollView: "ScrollView", StyleSheet: { create: (value) => value }, Platform: { OS: "ios", select: (values) => values.ios }, Linking: { openSettings: async () => {} } };
const theme = load("constants/theme.ts", { "react-native": native });
const content = plain(load("features/onboarding/constants.ts", {}).NOTIFICATIONS_SCREEN);
const textOf = (node) => typeof node === "string" ? node : node?.children?.map(textOf).join("") ?? "";
const texts = (tree) => tree.root.findAllByType("Text").map(textOf);
const host = (tree, id) => tree.root.findAll((node) => typeof node.type === "string" && node.props.testID === id)[0];
const enable = (view) => host(view.tree, "onboarding-notifications-enable");
const flat = (style) => Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
const unmount = async (view) => { await act(async () => view.tree.unmount()); };
const grant = { granted: true, canAskAgain: true };
const refusal = { granted: false, canAskAgain: false };
const undecided = { granted: false, canAskAgain: true };
const draft = { preferredName: "Alex", reason: "structure", workoutSplit: "custom", customWorkouts: [{ id: "one", name: "Upper", muscles: ["chest"] }], selectedEquipment: ["olympic_barbell"], weightUnit: "KG", benchPress1RM: 100, notificationsEnabled: false };
async function notifications(options = {}) {
  const calls = { routes: [], fields: [], animations: [], stored: [], reads: [], removed: [], requests: [], tokens: [], registrations: [], unregisters: [], channels: [], intervals: [], clearIntervals: [], navigation: [], settings: 0, appState: null };
  const os = options.os ?? "ios";
  const scheme = options.scheme ?? "light";
  let settings = options.initialPermission ?? undecided;
  const animated = {
    __esModule: true, default: { View: "AnimatedView", createAnimatedComponent: (component) => component },
    useSharedValue: (value) => React.useRef({ value }).current,
    useAnimatedStyle: (callback) => new Proxy({}, { get: (_, key) => callback()[key], ownKeys: () => Reflect.ownKeys(callback()), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }),
    withTiming: (value, config) => { calls.animations.push({ kind: "timing", value, config }); return value; },
    withDelay: (delay, value) => { calls.animations.push({ kind: "delay", delay }); return value; },
    withSpring: (value, config) => { calls.animations.push({ kind: "spring", value, config }); return value; },
  };
  const AuthContext = React.createContext({ isBootstrapping: false, isLoggedIn: false, token: options.authToken ?? null });
  const navigation = { setOptions: (value) => calls.navigation.push(value) };
  const storage = new Map([["@primerep/theme-preference", scheme], ["primerep.onboardingDraft.v1", JSON.stringify(options.data ?? draft)]]);
  const timers = { setInterval: (callback, ms) => { calls.intervals.push({ callback, ms }); return calls.intervals.length; }, clearInterval: (id) => calls.clearIntervals.push(id) };
  const mocks = {
    react: React,
    "react-native": { ...native, Platform: { ...native.Platform, OS: os }, useColorScheme: () => scheme, AppState: { addEventListener: (_event, callback) => { calls.appState = callback; return { remove: () => { calls.appState = null; } }; } }, Linking: { openSettings: async () => { calls.settings += 1; } } },
    "react-native-reanimated": animated, "@/constants/theme": theme, "@/features/onboarding/constants": { NOTIFICATIONS_SCREEN: content }, "@/utils/authContext": { AuthContext },
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 59, bottom: options.bottomInset ?? 34, left: 0, right: 0 }) },
    "expo-router": { Stack: { Screen: "StackScreen" }, useRouter: () => ({ push: (value) => calls.routes.push(value) }), useNavigation: () => navigation, useFocusEffect: (callback) => React.useEffect(callback, [callback]) },
    "expo-constants": { __esModule: true, default: { expoConfig: { extra: { eas: { projectId: "fictional-project" } } } } },
    "expo-notifications": {
      IosAuthorizationStatus: { PROVISIONAL: 3, EPHEMERAL: 4 }, AndroidImportance: { MAX: 5 }, setNotificationHandler: () => {},
      getPermissionsAsync: async () => settings,
      requestPermissionsAsync: async (value) => { calls.requests.push(plain(value)); const next = options.request ? await options.request() : options.result ?? grant; settings = next; return next; },
      getExpoPushTokenAsync: async (value) => { calls.tokens.push(plain(value)); if (options.tokenError) throw new Error("token boundary failed"); return { data: "ExponentPushToken[fictional]" }; },
      setNotificationChannelAsync: async (...args) => calls.channels.push(plain(args)),
    },
    "@/services/pushTokenService": { registerPushToken: async (...args) => { calls.registrations.push(plain(args)); if (options.registrationError) throw new Error("registration boundary failed"); }, unregisterPushToken: async (...args) => calls.unregisters.push(plain(args)) },
    "@react-native-async-storage/async-storage": { getItem: async (key) => { calls.reads.push(key); return storage.get(key) ?? null; }, setItem: async (key, value) => { calls.stored.push({ key, value }); storage.set(key, value); }, removeItem: async (key) => { calls.removed.push(key); storage.delete(key); }, multiRemove: async (keys) => { for (const key of keys) storage.delete(key); } },
  };
  for (const [alias, file] of [
    ["@/utils/appearanceContext", "utils/appearanceContext.tsx"], ["@/hooks/use-color-scheme", "hooks/use-color-scheme.ts"], ["@/hooks/use-theme-color", "hooks/use-theme-color.ts"],
    ["@/hooks/use-screen-transition", "hooks/use-screen-transition.ts"], ["@/components/themed-view", "components/themed-view.tsx"], ["@/components/animated-button", "components/animated-button.tsx"],
    ["@/utils/onboardingContext", "utils/onboardingContext.tsx"], ["@/utils/notificationsContext", "utils/notificationsContext.tsx"],
  ]) mocks[alias] = load(file, mocks, timers);
  const { AppearanceProvider, useAppearance } = mocks["@/utils/appearanceContext"];
  const { OnboardingContext, OnboardingProvider } = mocks["@/utils/onboardingContext"];
  const { NotificationsContext, NotificationsProvider } = mocks["@/utils/notificationsContext"];
  const { default: Screen } = load(route, mocks, timers);
  let context, pushContext, appearance;
  function RestoredScreen() {
    context = React.useContext(OnboardingContext);
    pushContext = React.useContext(NotificationsContext);
    appearance = useAppearance();
    if (context.isRestoring || !appearance.isReady) return null;
    const value = { ...context, updateField: (field, value) => { calls.fields.push([field, value]); context.updateField(field, value); } };
    return React.createElement(OnboardingContext.Provider, { value }, React.createElement(Screen));
  }
  let tree;
  await act(async () => { tree = create(React.createElement(AppearanceProvider, null, React.createElement(OnboardingProvider, null, React.createElement(NotificationsProvider, null, React.createElement(RestoredScreen))))); });
  return { tree, calls, data: () => plain(context.getOnboardingData()), permission: () => pushContext.permission, busy: () => pushContext.isLoading, skip: () => host(tree, "onboarding-notifications-skip"), changeScheme: async (next) => { await act(async () => appearance.setPreference(next)); }, revoke: async () => { settings = refusal; await act(async () => calls.appState("active")); }, press: async () => { await act(async () => enable({ tree }).props.onPress()); }, tick: async () => { await act(async () => calls.intervals.at(-1).callback()); } };
}
function completion(view, expected) {
  assert.deepEqual(view.calls.fields, [["notificationsEnabled", expected]]);
  assert.deepEqual(view.calls.routes, ["/onboarding/final"]);
  assert.deepEqual(view.data(), { ...view.before, notificationsEnabled: expected });
  const persisted = JSON.parse(view.calls.stored.filter((entry) => entry.key === "primerep.onboardingDraft.v1").at(-1).value);
  assert.deepEqual(persisted, view.data());
  assert.equal(Object.keys(persisted).some((key) => /health/i.test(key)), false);
}
for (const scheme of ["light", "dark"]) {
  test(`${scheme}: actual initial copy, three supported examples, unchanged state and real theme`, async () => {
    const view = await notifications({ scheme });
    const values = texts(view.tree);
    assert.ok(values.includes(content.heading));
    assert.ok(values.includes(content.description));
    assert.deepEqual(values.filter((value) => content.notifications.some((item) => item.title === value)), content.notifications.map((item) => item.title));
    assert.equal(content.notifications.length, 3);
    assert.deepEqual(values.filter((value) => content.notifications.some((item) => item.message === value)), content.notifications.map((item) => item.message));
    assert.equal(values.some((value) => /Strength Score|Rest time is over|07:\d\d/.test(value)), false);
    assert.equal(flat(view.tree.root.findByType("View").props.style).backgroundColor, theme.Colors[scheme].background);
    assert.deepEqual(view.calls.fields, []);
    assert.deepEqual(view.calls.routes, []);
    assert.deepEqual(view.calls.requests, []);
    assert.equal(view.data().preferredName, "Alex");
    await unmount(view);
  });
  test(`${scheme}: granted permission caches token, writes only notification flag and continues`, async () => {
    const view = await notifications({ scheme }); view.before = view.data();
    await view.press(); completion(view, true);
    assert.deepEqual(view.calls.requests, [{ ios: { allowAlert: true, allowBadge: true, allowSound: true } }]);
    assert.deepEqual(view.calls.tokens, [{ projectId: "fictional-project" }]);
    assert.ok(view.calls.stored.some((entry) => entry.key === "primerep.pendingExpoPushToken.v1" && entry.value === "ExponentPushToken[fictional]"));
    assert.deepEqual(view.calls.registrations, []);
    await unmount(view);
  });
  for (const [name, result] of [["denied", refusal], ["undetermined", undecided], ["provisional", { granted: false, canAskAgain: false, ios: { status: 3 } }], ["ephemeral", { granted: false, canAskAgain: false, ios: { status: 4 } }]]) {
    test(`${scheme}: ${name} permission preserves exact completion behavior`, async () => {
      const view = await notifications({ scheme, result }); view.before = view.data();
      await view.press(); completion(view, name === "provisional" || name === "ephemeral");
      assert.equal(view.calls.tokens.length, name === "provisional" || name === "ephemeral" ? 1 : 0);
      assert.equal(view.busy(), false);
      await unmount(view);
    });
  }
  test(`${scheme}: OS request failure silently stores false and continues`, async () => {
    const view = await notifications({ scheme, request: async () => { throw new Error("OS boundary failed"); } }); view.before = view.data();
    await view.press(); completion(view, false);
    assert.equal(view.permission(), "undetermined"); assert.equal(view.busy(), false);
    assert.deepEqual(view.calls.tokens, []);
    await unmount(view);
  });
  test(`${scheme}: token failure after OS grant keeps OS granted but draft false`, async () => {
    const view = await notifications({ scheme, tokenError: true }); view.before = view.data();
    await view.press(); completion(view, false);
    assert.equal(view.permission(), "granted"); assert.equal(view.busy(), false);
    assert.deepEqual(view.calls.registrations, []);
    await unmount(view);
  });
  test(`${scheme}: pending request disables both native actions and settles once`, async () => {
    let resolve;
    const view = await notifications({ scheme, request: () => new Promise((done) => { resolve = done; }) }); view.before = view.data();
    await view.press();
    assert.equal(view.busy(), true);
    assert.equal(enable(view).props.disabled, true);
    assert.deepEqual(plain(enable(view).props.accessibilityState), { disabled: true, busy: true });
    assert.equal(view.skip().props.disabled, true);
    assert.deepEqual(plain(view.skip().props.accessibilityState), { disabled: true, busy: true });
    assert.ok(texts(view.tree).includes("Enabling…"));
    assert.deepEqual(view.calls.fields, []); assert.deepEqual(view.calls.routes, []);
    await act(async () => resolve(grant)); completion(view, true);
    assert.equal(enable(view).props.disabled, false); assert.equal(view.skip().props.disabled, false);
    await unmount(view);
  });
  test(`${scheme}: Skip clears draft flag and continues without requesting or revoking OS permission`, async () => {
    const view = await notifications({ scheme, initialPermission: grant, data: { ...draft, notificationsEnabled: true } }); view.before = view.data();
    assert.equal(view.skip().props.accessibilityLabel, "Skip notifications");
    await act(async () => view.skip().props.onPress()); completion(view, false);
    assert.equal(view.permission(), "granted"); assert.deepEqual(view.calls.requests, []); assert.deepEqual(view.calls.unregisters, []);
    await unmount(view);
  });
  test(`${scheme}: foreground revocation changes provider permission without changing onboarding draft`, async () => {
    const view = await notifications({ scheme }); await view.press(); const before = view.data();
    await view.revoke(); assert.equal(view.permission(), "denied"); assert.deepEqual(view.data(), before);
    assert.deepEqual(view.calls.unregisters, []); assert.equal(view.calls.routes.length, 1);
    await unmount(view);
  });
  test(`${scheme}: web returns unsupported, stores false and never invokes OS request`, async () => {
    const view = await notifications({ scheme, os: "web" }); view.before = view.data();
    await view.press(); completion(view, false); assert.equal(view.permission(), "unsupported");
    assert.deepEqual(view.calls.requests, []); assert.deepEqual(view.calls.tokens, []);
    await unmount(view);
  });
  test(`${scheme}: Android retains channel configuration and exact token registration payload`, async () => {
    const view = await notifications({ scheme, os: "android", authToken: "fictional-access" }); view.before = view.data();
    await view.press(); completion(view, true);
    assert.deepEqual(view.calls.registrations, [["fictional-access", { token: "ExponentPushToken[fictional]", platform: "android" }]]);
    assert.equal(view.calls.channels.length, 3);
    assert.equal(view.calls.channels[0][0], "default");
    assert.equal(view.calls.removed.includes("primerep.pendingExpoPushToken.v1"), true);
    await unmount(view);
  });
  test(`${scheme}: push registration failure continues with false despite granted permission`, async () => {
    const view = await notifications({ scheme, authToken: "fictional-access", registrationError: true }); view.before = view.data();
    await view.press(); completion(view, false); assert.equal(view.permission(), "granted");
    assert.equal(view.calls.registrations.length, 1); assert.equal(view.busy(), false);
    await unmount(view);
  });
  test(`${scheme}: static examples preserve retained card, transition and button motion`, async () => {
    const view = await notifications({ scheme });
    assert.deepEqual(view.calls.intervals, []);
    assert.ok(view.calls.animations.some((entry) => entry.kind === "timing" && entry.config.duration === 250));
    assert.deepEqual(view.calls.animations.filter((entry) => entry.kind === "delay").map((entry) => entry.delay), [200, 200, 400, 400, 600, 700, 800, 600, 700, 800]);
    await act(async () => { enable(view).props.onPressIn({}); enable(view).props.onPressOut({}); });
    assert.deepEqual(view.calls.animations.filter((entry) => entry.kind === "spring").map((entry) => entry.value), [0.96, 1]);
    await unmount(view); assert.deepEqual(view.calls.clearIntervals, []);
  });
  test(`${scheme}: appearance changes update content and the actual neutral Skip control`, async () => {
    const view = await notifications({ scheme });
    const next = scheme === "light" ? "dark" : "light";
    await view.changeScheme(next);
    assert.equal(flat(view.tree.root.findByType("View").props.style).backgroundColor, theme.Colors[next].background);
    assert.equal(flat(view.skip().findByType("Text").props.style).color, theme.Colors[next].text);
    assert.equal(flat(view.skip().props.style({ pressed: false })).backgroundColor, theme.Colors[next].inputBackground);
    assert.equal(flat(view.skip().props.style({ pressed: true })).backgroundColor, theme.Colors[next].inputBorder);
    assert.deepEqual(view.calls.fields, []); assert.deepEqual(view.calls.routes, []);
    await unmount(view);
  });
  test(`${scheme}: supported examples are explicitly illustrative and conditional on Settings`, async () => {
    const view = await notifications({ scheme });
    assert.ok(texts(view.tree).includes("Notification examples"));
    assert.ok(texts(view.tree).includes("Examples only. Reminders depend on your settings and workout plan."));
    assert.equal(content.description, "Allow PrimeRep to send notifications. You can turn on Coach reminders in Settings after creating your account.");
    assert.deepEqual(content.notifications.map((item) => item.message), ["Today’s workout is ready.", "Review your training week.", "Your program needs an equipment review."]);
    assert.equal(texts(view.tree).filter((value) => value === "Example").length, 3);
    await unmount(view);
  });
  test(`${scheme}: helper and example copy use readable theme colors with system typography`, async () => {
    const view = await notifications({ scheme });
    for (const value of [content.description, content.examplesDescription, ...content.notifications.map((item) => item.message)]) {
      const node = view.tree.root.findAllByType("Text").find((entry) => textOf(entry) === value);
      assert.ok(node);
      assert.ok([theme.Colors[scheme].text, theme.Colors[scheme].icon].includes(flat(node.props.style).color));
      assert.equal(flat(node.props.style).fontFamily, theme.Fonts.sans);
    }
    await unmount(view);
  });
  test(`${scheme}: Enable remains inside adaptive safe-area content with a growing 56-point target`, async () => {
    const view = await notifications({ scheme, bottomInset: 59 });
    const scroll = view.tree.root.findByType("ScrollView");
    assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
    assert.ok(host(view.tree, "onboarding-notifications-enable"));
    assert.equal(flat(scroll.props.contentContainerStyle).flexGrow, 1);
    assert.ok(flat(scroll.props.contentContainerStyle).paddingBottom >= 59 + 24);
    const action = enable(view).findByType("View");
    assert.ok(flat(action.props.style).minHeight >= 56);
    assert.equal(flat(action.props.style).height, undefined);
    assert.ok(texts(view.tree).includes("Enable notifications"));
    await unmount(view);
  });
  test(`${scheme}: essential text and cards wrap without caps, ellipsis or fixed text heights`, async () => {
    const view = await notifications({ scheme });
    for (const node of view.tree.root.findAllByType("Text")) {
      for (const key of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(node.props[key], undefined);
      assert.notEqual(node.props.allowFontScaling, false);
      for (const key of ["height", "lineHeight", "textTransform"]) assert.equal(flat(node.props.style)[key], undefined);
    }
    for (const item of content.notifications) {
      const card = view.tree.root.findAllByType("View").find((node) => node.props.testID === `onboarding-notifications-example-${item.id}`);
      assert.ok(card); assert.equal(flat(card.props.style).height, undefined);
      const message = card.findAllByType("Text").find((node) => textOf(node) === item.message);
      assert.equal(flat(message.props.style).flexShrink, 1);
      const title = card.findAllByType("Text").find((node) => textOf(node) === item.title);
      const metadata = card.findAllByType("Text").find((node) => textOf(node) === item.timestamp);
      assert.equal(title.parent, metadata.parent);
      assert.equal(flat(title.parent.props.style).flexDirection, "column");
      assert.equal(flat(title.parent.props.style).flex, 1);
      assert.equal(flat(title.parent.props.style).minWidth, 0);
      assert.equal(flat(title.props.style).flex, undefined);
      assert.deepEqual(title.parent.findAllByType("Text").map(textOf), [item.title, item.timestamp]);
      assert.equal(flat(title.parent.parent.props.style).flexDirection, "row");
      const tile = title.parent.parent.findAllByType("View").find((node) => node.props.accessible === false);
      assert.equal(flat(tile.props.style).minWidth, 40);
      assert.equal(flat(tile.props.style).minHeight, 40);
    }
    await unmount(view);
  });
  test(`${scheme}: Skip has an actual neutral 44-point target and native pressed feedback`, async () => {
    const view = await notifications({ scheme }); const skip = view.skip();
    assert.equal(skip.props.testID, "onboarding-notifications-skip");
    assert.equal(skip.props.accessibilityRole, "button");
    assert.equal(skip.props.accessibilityLabel, "Skip notifications");
    const idle = flat(skip.props.style({ pressed: false }));
    const pressed = flat(skip.props.style({ pressed: true }));
    assert.ok(idle.minHeight >= 44); assert.ok(idle.minWidth >= 44);
    assert.equal(flat(skip.findByType("Text").props.style).color, theme.Colors[scheme].text);
    assert.equal(pressed.backgroundColor, theme.Colors[scheme].inputBorder);
    assert.notEqual(idle.backgroundColor, pressed.backgroundColor);
    await unmount(view);
  });
  test(`${scheme}: pending Enable is neutral while names and disabled busy semantics persist`, async () => {
    let resolve;
    const view = await notifications({ scheme, request: () => new Promise((done) => { resolve = done; }) });
    assert.equal(flat(enable(view).findByType("View").props.style).backgroundColor, theme.Colors[scheme].primaryButton);
    assert.equal(enable(view).props.testID, "onboarding-notifications-enable");
    await view.press();
    assert.equal(flat(enable(view).findByType("View").props.style).backgroundColor, theme.Colors[scheme].inputBorder);
    assert.equal(enable(view).props.accessibilityLabel, "Enable notifications");
    assert.equal(enable(view).props.disabled, true); assert.equal(enable(view).props.accessibilityState.busy, true);
    assert.ok(texts(view.tree).includes("Enabling…"));
    assert.equal(view.tree.root.findAllByType("Ionicons").every((node) => node.props.accessible === false), true);
    await act(async () => resolve(refusal)); await unmount(view);
  });
  test(`${scheme}: Skip grows after Enable within the inset footer with no interactive native header`, async () => {
    const view = await notifications({ scheme, bottomInset: 59 });
    const scroll = view.tree.root.findByType("ScrollView");
    const skip = scroll.findAllByType("Pressable").find((node) => node.props.testID === "onboarding-notifications-skip");
    assert.ok(skip, "Skip must be rendered inside the actual inset-aware scroller");
    const footer = scroll.findAllByType("View").find((node) => node.props.testID === "onboarding-notifications-footer");
    assert.ok(footer);
    assert.deepEqual(footer.findAllByType("Pressable").map((node) => node.props.testID), ["onboarding-notifications-enable", "onboarding-notifications-skip"]);
    assert.equal(scroll.props.contentInsetAdjustmentBehavior, "automatic");
    const style = flat(skip.props.style({ pressed: false }));
    assert.ok(style.minHeight >= 44);
    assert.equal(style.alignSelf, "stretch");
    for (const key of ["height", "maxHeight", "overflow", "position"]) assert.equal(style[key], undefined);
    const label = skip.findByType("Text");
    assert.equal(textOf(label), "Skip");
    for (const key of ["numberOfLines", "maxFontSizeMultiplier", "adjustsFontSizeToFit"]) assert.equal(label.props[key], undefined);
    assert.notEqual(label.props.allowFontScaling, false);
    for (const key of ["height", "lineHeight", "textTransform"]) assert.equal(flat(label.props.style)[key], undefined);
    assert.equal(flat(label.props.style).alignSelf, "stretch");
    assert.equal(flat(label.props.style).textAlign, "center");
    assert.equal(view.tree.root.findByType("StackScreen").props.options.headerRight(), null);
    assert.deepEqual(view.calls.navigation, []);
    await unmount(view);
  });
}
const routeSource = source(route);
const controllerSource = routeSource.slice(routeSource.indexOf("  const questionOpacity"), routeSource.indexOf("  return (\n    <ThemedView"));
const permissionHandlers = routeSource.slice(routeSource.indexOf("  const handleEnable"), routeSource.indexOf("  return (\n    <ThemedView"));
const motionController = routeSource.slice(routeSource.indexOf("  const questionOpacity"), routeSource.indexOf("  const handleEnable"));
test("scope: exact permission handlers remain unchanged", () => {
  assert.equal(sha(permissionHandlers), "63bfe9003ab8e60b08a55c4ce6862fe87006c800f5cd453bb7e8d8c1089d1f61");
});
console.log(JSON.stringify({ routeSha256: sha(routeSource), controllerSha256: sha(controllerSource), permissionHandlersSha256: sha(permissionHandlers), motionControllerSha256: sha(motionController), notificationsObjectSha256: sha(JSON.stringify(content)), providerSha256: sha(source("utils/notificationsContext.tsx")), pushServiceSha256: sha(source("services/pushTokenService.ts")), transitionSha256: sha(source("hooks/use-screen-transition.ts")) }));
