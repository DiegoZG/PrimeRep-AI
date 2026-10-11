import assert from "node:assert/strict";
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
const source = readFileSync(path.join(root, "app/settings.tsx"), "utf8");
const flat = (style, pressed = false) => Object.assign({}, ...(Array.isArray(style = typeof style === "function" ? style({ pressed }) : style) ? style.flat(Infinity) : [style]).filter(Boolean));
const plain = (value) => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const preferences = (enabled = false) => ({ notificationsEnabled: enabled, reminderTime: "08:00", timeZone });
const palettes = {
  light: { background: "#fff", inputBackground: "#fff", inputBorder: "#E5E5E5", text: "#11181C", icon: "#687076", placeholder: "#9BA1A6", primaryButton: "#6a4ff5" },
  dark: { background: "#151718", inputBackground: "#1F1F1F", inputBorder: "#3A3A3A", text: "#ECEDEE", icon: "#9BA1A6", placeholder: "#9BA1A6", primaryButton: "#6a4ff5" },
};
const contrast = (a, b) => {
  const luminance = (hex) => {
    const full = hex.length === 4 ? `#${[...hex.slice(1)].map((digit) => digit + digit).join("")}` : hex;
    const rgb = [1, 3, 5].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

async function renderSettings(options = {}) {
  const scheme = options.scheme ?? "light";
  const AuthContext = React.createContext(null);
  const NotificationsContext = React.createContext(null);
  const calls = { routes: [], alerts: [], coachLoads: [], coachSaves: [], units: [], appearance: [], notifications: [], premium: [], accounts: [] };
  const user = { id: "A", subscription_tier: options.premium ? "premium" : "free", coach_insights_enabled: options.insights ?? false };
  const auth = { user, token: "token-A", logOut: async (...args) => { calls.accounts.push(["logout", ...args]); }, updateCoachPreference: async (value) => { calls.premium.push(value); if (options.premiumSave) await options.premiumSave(value); if (options.premiumFailure) throw new Error("offline"); } };
  const notifications = {
    permission: options.permission ?? "granted", isLoading: options.notificationsBusy ?? false,
    refreshPermission: async () => { calls.notifications.push("refresh"); return options.refreshedPermission ?? options.permission ?? "granted"; },
    requestPermission: async () => { calls.notifications.push("request"); return options.requestedPermission ?? "granted"; },
    unregisterCurrentDevice: async (token) => { calls.accounts.push(["unregister", token]); },
    openSettings: async () => { calls.notifications.push("settings"); },
  };
  const mocks = {
    react: React,
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "expo-router": { useRouter: () => ({ back: () => calls.routes.push("back"), push: (route) => calls.routes.push(route) }) },
    "react-native": {
      Alert: { alert: (...args) => calls.alerts.push(args) }, Platform: { OS: options.platform ?? "ios" },
      Pressable: "Pressable", ScrollView: "ScrollView", StatusBar: "StatusBar", Switch: "Switch", TextInput: "TextInput", View: "View",
      useWindowDimensions: () => ({ width: options.width ?? 375, fontScale: options.fontScale ?? 1 }),
      StyleSheet: { hairlineWidth: 1, create: (styles) => styles },
    },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@/components/workout/WorkoutText": { WorkoutText: ({ style, ...props }) => React.createElement("ThemedText", { ...props, style: [style, { lineHeight: undefined }] }) },
    "@/constants/theme": { Colors: palettes },
    "@/hooks/use-color-scheme": { useColorScheme: () => scheme },
    "@/utils/authContext": { AuthContext },
    "@/utils/notificationsContext": { NotificationsContext },
    "@/services/userService": { deleteAccount: async (token) => { calls.accounts.push(["delete", token]); if (options.deleteFailure) throw new Error("offline"); } },
    "@/services/health/exportSync": {
      pauseHealthExport: (id) => calls.accounts.push(["pause", id]), resumeHealthExport: (id) => calls.accounts.push(["resume", id]), waitForHealthExportIdle: async () => calls.accounts.push(["idle"]),
    },
    "@/utils/healthExportAccountCleanup": { clearHealthExportAccount: async (id) => calls.accounts.push(["cleanup", id]) },
    "@/services/coachService": {
      getCoachPreferences: async (token) => { calls.coachLoads.push(token); return options.loadCoach ? options.loadCoach(token) : preferences(options.coachEnabled); },
      updateCoachPreferences: async (token, next) => { calls.coachSaves.push([token, next]); return options.saveCoach ? options.saveCoach(token, next) : next; },
    },
    "@/utils/weightUnits": { loadWeightUnit: async () => options.unit ?? "LB", saveWeightUnit: async (unit) => { calls.units.push(unit); return !options.unitFailure; } },
    "@/utils/appearanceContext": { useAppearance: () => {
      const [preference, setPreference] = React.useState(options.appearance ?? "system");
      return { preference, isReady: options.appearanceReady ?? true, isSaving: options.appearanceBusy ?? false, setPreference: async (value) => { calls.appearance.push(value); if (options.appearanceFailure) throw new Error("offline"); setPreference(value); } };
    } },
  };
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require: (name) => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected import ${name}`);
  }, console, Intl }, { filename: "app/settings.tsx" });
  const Screen = module.exports.default;
  const element = (value = auth) => React.createElement(AuthContext.Provider, { value }, React.createElement(NotificationsContext.Provider, { value: notifications }, React.createElement(Screen)));
  let tree;
  await act(async () => { tree = create(element()); });
  return { tree, calls, auth, element, colors: palettes[scheme] };
}
const tap = async (node) => { await act(async () => { node.props.onPress(); }); };
const change = async (node, value) => { await act(async () => { node.props.onValueChange(value); }); };
const byLabel = (tree, label) => tree.root.findByProps({ accessibilityLabel: label });
const copy = (node) => node.type === "ThemedText" ? node.children.join("") : node.findByType("ThemedText").children.join("");
const unmount = async (tree) => { await act(async () => { tree.unmount(); }); };

for (const scheme of ["light", "dark"]) {
  test(`Settings native switches remain neutral, named and reachable in ${scheme}`, async () => {
    for (const enabled of [false, true]) {
      const { tree, colors } = await renderSettings({ scheme, premium: true, insights: enabled, coachEnabled: enabled });
      const switches = tree.root.findAllByType("Switch");
      const track = scheme === "dark" ? colors.inputBackground : colors.inputBorder;
      assert.equal(switches.length, 2);
      for (const node of switches) {
        assert.deepEqual(plain(node.props.trackColor), { false: track, true: track });
        assert.equal(node.props.ios_backgroundColor, track);
        assert.equal(node.props.thumbColor, enabled ? colors.primaryButton : colors.icon);
        assert.ok(contrast(node.props.thumbColor, track) >= 3);
        assert.equal(node.props.value, enabled);
        assert.equal(node.props.accessibilityState.disabled, node.props.disabled);
        assert.deepEqual(plain(node.props.hitSlop), { top: 7, bottom: 7 });
        assert.ok(flat(node.parent.props.style).minHeight >= 44);
        assert.equal(flat(node.parent.parent.props.style).alignItems, "center");
        assert.equal(flat(node.parent.parent.props.style).flexDirection, "row");
        assert.ok(node.props.accessibilityLabel);
      }
      assert.equal(byLabel(tree, "AI Coaching Insights").props.disabled, false);
      await unmount(tree);
    }
  });

  test(`Settings preference radios keep visible, neutral selection and persistence in ${scheme}`, async () => {
    const { tree, colors, calls } = await renderSettings({ scheme, unit: "KG" });
    for (const [label, checked] of [["Use system appearance", true], ["Use light appearance", false], ["Use dark appearance", false], ["Use pounds", false], ["Use kilograms", true]]) {
      const radio = byLabel(tree, label);
      assert.equal(radio.props.accessibilityRole, "radio");
      assert.equal(radio.props.accessibilityState.checked, checked);
      assert.equal(radio.findByType("Ionicons").props.name, checked ? "checkmark-circle" : "ellipse-outline");
      assert.equal(radio.findByType("Ionicons").props.color, checked ? colors.text : colors.icon);
      assert.equal(flat(radio.props.style).backgroundColor, checked ? colors.inputBorder : "transparent");
      assert.ok(flat(radio.props.style).minHeight >= 44);
      assert.equal(flat(radio.props.style, true).backgroundColor, colors.inputBorder);
    }
    await tap(byLabel(tree, "Use dark appearance"));
    await tap(byLabel(tree, "Use pounds"));
    assert.deepEqual(calls.appearance, ["dark"]);
    assert.deepEqual(calls.units, ["LB"]);
    assert.equal(byLabel(tree, "Use dark appearance").props.accessibilityState.checked, true);
    assert.equal(byLabel(tree, "Use pounds").props.accessibilityState.checked, true);
    await unmount(tree);
  });

  test(`Settings uncapped typography and controls adapt to narrow and large text in ${scheme}`, async () => {
    for (const [width, fontScale] of [[320, 1], [375, 1], [430, 1], [375, 1.5], [375, 3]]) {
      const { tree } = await renderSettings({ scheme, width, fontScale, coachEnabled: true });
      const appearance = byLabel(tree, "Use system appearance").parent;
      assert.equal(flat(appearance.props.style).flexDirection, fontScale >= 1.5 ? "column" : "row");
      assert.equal(flat(appearance.parent.props.style).flexDirection, width < 390 || fontScale >= 1.3 ? "column" : "row");
      if (width < 390 || fontScale >= 1.3) assert.equal(flat(appearance.props.style).maxWidth, undefined);
      const title = tree.root.findAllByType("ThemedText").find((node) => node.children.join("") === "Settings");
      assert.equal(title.parent.parent.type, fontScale >= 2 ? "ScrollView" : "View");
      assert.equal(title.props.accessibilityRole, "header");
      for (const text of tree.root.findAllByType("ThemedText")) {
        assert.equal(flat(text.props.style).lineHeight, undefined);
        assert.equal(text.props.maxFontSizeMultiplier, undefined);
        assert.equal(text.props.allowFontScaling, undefined);
        assert.equal(text.props.numberOfLines, undefined);
      }
      const back = byLabel(tree, "Back from Settings");
      assert.equal(flat(back.props.style).height, 44);
      assert.equal(flat(back.props.style).width, 44);
      const time = tree.root.findByProps({ testID: "settings-coach-reminder-time" });
      assert.ok(flat(time.props.style).minHeight >= 44);
      if (fontScale >= 1.5) assert.equal(flat(time.props.style).maxWidth, undefined);
      const scroll = tree.root.findByType("ScrollView");
      assert.equal(scroll.props.keyboardShouldPersistTaps, "handled");
      assert.equal(scroll.props.keyboardDismissMode, "interactive");
      assert.deepEqual(plain(tree.root.findByType("SafeAreaView").props.edges), ["top", "bottom"]);
      await unmount(tree);
    }
  });

  test(`Settings preserves every destination and neutral pressed actions in ${scheme}`, async () => {
    const { tree, calls, colors } = await renderSettings({ scheme });
    const destinations = [["Training preferences", "/settings/training-preferences"], ["Dumbbells", "/settings/dumbbells"], ["Plates", "/settings/plates"], ["Health connections", "/settings/health"], ["Terms of Service", "/legal/terms"], ["Privacy Policy", "/legal/privacy"], ["Help and Support", "/settings/help"], ["Download my data", "/settings/export"]];
    for (const [label] of destinations) {
      const action = byLabel(tree, label);
      assert.ok(flat(action.props.style).minHeight >= 44);
      assert.equal(flat(action.props.style, true).backgroundColor, colors.inputBorder);
      await tap(action);
    }
    await tap(byLabel(tree, "Back from Settings"));
    assert.deepEqual(calls.routes, [...destinations.map(([, route]) => route), "back"]);
    assert.equal(flat(byLabel(tree, "Delete account").findByType("ThemedText").props.style).color, scheme === "dark" ? "#F18C86" : "#D14343");
    await tap(byLabel(tree, "Delete account"));
    assert.equal(calls.alerts[0][0], "Delete Account?");
    assert.equal(calls.alerts[0][2][0].style, "cancel");
    assert.equal(calls.alerts[0][2][1].style, "destructive");
    assert.deepEqual(calls.accounts, []);
    assert.equal(tree.root.findAllByProps({ accessibilityLabel: "AI Coaching Insights" }).length, 0);
    await unmount(tree);
  });

  test(`Settings reminder validation, explicit save and quiet saved status remain correct in ${scheme}`, async () => {
    const { tree, calls, colors } = await renderSettings({ scheme, coachEnabled: true });
    const input = tree.root.findByProps({ testID: "settings-coach-reminder-time" });
    await act(async () => { input.props.onChangeText("25:99"); });
    await tap(tree.root.findByProps({ testID: "settings-save-coach-time" }));
    assert.equal(calls.coachSaves.length, 0);
    assert.equal(copy(tree.root.findByProps({ testID: "settings-coach-error" })), "Enter a reminder time from 00:00 to 23:59.");
    await act(async () => { input.props.onChangeText("9:05"); });
    const save = tree.root.findByProps({ testID: "settings-save-coach-time" });
    assert.ok(flat(save.props.style).minHeight >= 44);
    assert.equal(flat(save.props.style).backgroundColor, colors.primaryButton);
    assert.equal(flat(save.props.style, true).opacity, 1);
    assert.equal(flat(save.props.style, true).backgroundColor, "#5940D9");
    assert.equal(flat(save.findByType("ThemedText").props.style).color, "#fff");
    assert.ok(contrast("#fff", colors.primaryButton) >= 4.5);
    assert.ok(contrast("#fff", flat(save.props.style, true).backgroundColor) >= 4.5);
    await tap(save);
    assert.deepEqual(plain(calls.coachSaves), [["token-A", { notificationsEnabled: true, reminderTime: "09:05", timeZone }]]);
    assert.equal(tree.root.findByProps({ testID: "settings-coach-reminder-time" }).props.value, "09:05");
    const saved = tree.root.findByProps({ testID: "settings-coach-saved" });
    assert.equal(saved.props.accessibilityLiveRegion, "polite");
    assert.equal(flat(saved.props.style).color, colors.icon);
    await unmount(tree);
  });

  test(`Settings independent Coach load retry keeps accessible switch and failures in ${scheme}`, async () => {
    let failed = true;
    const { tree, colors } = await renderSettings({ scheme, loadCoach: async () => { if (failed) throw new Error("offline"); return preferences(); } });
    assert.equal(tree.root.findByProps({ testID: "settings-coach-notifications" }).props.disabled, true);
    const retry = tree.root.findByProps({ testID: "settings-coach-retry" });
    assert.ok(flat(retry.props.style).minHeight >= 44);
    assert.equal(flat(retry.findByType("ThemedText").props.style).color, colors.text);
    assert.equal(flat(tree.root.findByProps({ testID: "settings-coach-error" }).props.style).color, scheme === "dark" ? "#F18C86" : "#D14343");
    failed = false;
    await tap(retry);
    assert.equal(tree.root.findAllByProps({ testID: "settings-coach-error" }).length, 0);
    assert.equal(tree.root.findByProps({ testID: "settings-coach-notifications" }).props.disabled, false);
    await unmount(tree);
  });
}

test("Settings failed unit or appearance persistence preserves previous selections", async () => {
  const { tree, calls } = await renderSettings({ unitFailure: true, appearanceFailure: true });
  await tap(byLabel(tree, "Use kilograms"));
  await tap(byLabel(tree, "Use dark appearance"));
  assert.equal(byLabel(tree, "Use pounds").props.accessibilityState.checked, true);
  assert.equal(byLabel(tree, "Use system appearance").props.accessibilityState.checked, true);
  assert.deepEqual(calls.alerts.map(([title]) => title), ["Could Not Save Units", "Could Not Save Appearance"]);
  await unmount(tree);
});

test("Settings disabled appearance and unsupported notification controls remain disabled", async () => {
  const { tree } = await renderSettings({ appearanceReady: false, permission: "unsupported" });
  assert.equal(byLabel(tree, "Use dark appearance").props.disabled, true);
  assert.equal(byLabel(tree, "Use dark appearance").props.accessibilityState.disabled, true);
  assert.equal(tree.root.findByProps({ testID: "settings-push-notifications" }).props.disabled, true);
  assert.equal(flat(tree.root.findByProps({ testID: "settings-push-notifications" }).props.style).opacity, 0.5);
  await unmount(tree);
});

test("Settings Coach opt-in still requires OS access and only then saves preference", async () => {
  const denied = await renderSettings({ permission: "denied" });
  await change(denied.tree.root.findByProps({ testID: "settings-coach-notifications" }), true);
  assert.equal(denied.calls.coachSaves.length, 0);
  assert.equal(denied.calls.alerts[0][0], "Allow Notifications First");
  assert.equal(denied.calls.alerts[0][2][1].text, "Open Settings");
  await unmount(denied.tree);
  const granted = await renderSettings({ permission: "undetermined", requestedPermission: "granted" });
  await change(granted.tree.root.findByProps({ testID: "settings-coach-notifications" }), true);
  assert.equal(granted.calls.notifications.filter((event) => event === "request").length, 1);
  assert.equal(granted.calls.coachSaves[0][1].notificationsEnabled, true);
  await unmount(granted.tree);
});

test("Settings push access still opens system settings or asks permission", async () => {
  for (const permission of ["granted", "denied", "undetermined"]) {
    const { tree, calls } = await renderSettings({ permission });
    await tap(tree.root.findByProps({ testID: "settings-push-notifications" }));
    assert.equal(calls.notifications.includes(permission === "undetermined" ? "request" : "settings"), true);
    await unmount(tree);
  }
});

test("Settings reminder save remains disabled while pending and retains failed draft", async () => {
  const pending = deferred();
  const { tree } = await renderSettings({ coachEnabled: true, saveCoach: () => pending.promise });
  await act(async () => { tree.root.findByProps({ testID: "settings-coach-reminder-time" }).props.onChangeText("10:45"); });
  await tap(tree.root.findByProps({ testID: "settings-save-coach-time" }));
  assert.equal(tree.root.findByProps({ testID: "settings-save-coach-time" }).props.disabled, true);
  assert.equal(tree.root.findByProps({ testID: "settings-coach-reminder-time" }).props.editable, false);
  assert.equal(tree.root.findByProps({ testID: "settings-coach-notifications" }).props.disabled, true);
  await act(async () => { pending.reject(new Error("offline")); });
  assert.equal(tree.root.findByProps({ testID: "settings-coach-reminder-time" }).props.value, "10:45");
  assert.equal(tree.root.findByProps({ testID: "settings-save-coach-time" }).props.disabled, false);
  assert.equal(tree.root.findAllByProps({ testID: "settings-coach-saved" }).length, 0);
  assert.match(copy(tree.root.findByProps({ testID: "settings-coach-error" })), /couldn’t be saved/);
  await unmount(tree);
});

test("Settings delayed account A load cannot replace account B Coach preferences", async () => {
  const pending = deferred();
  const { tree, auth, element } = await renderSettings({ loadCoach: (token) => token === "token-A" ? pending.promise : { ...preferences(true), reminderTime: "12:30" } });
  await act(async () => { tree.update(element({ ...auth, user: { ...auth.user, id: "B" }, token: "token-B" })); });
  await act(async () => { pending.resolve({ ...preferences(true), reminderTime: "19:45" }); });
  assert.equal(tree.root.findByProps({ testID: "settings-coach-reminder-time" }).props.value, "12:30");
  await unmount(tree);
});

test("Settings delayed account A save cannot show saved status for account B", async () => {
  const pending = deferred();
  const { tree, auth, element } = await renderSettings({ coachEnabled: true, saveCoach: () => pending.promise });
  await act(async () => { tree.root.findByProps({ testID: "settings-coach-reminder-time" }).props.onChangeText("09:30"); });
  await tap(tree.root.findByProps({ testID: "settings-save-coach-time" }));
  await act(async () => { tree.update(element({ ...auth, user: { ...auth.user, id: "B" }, token: "token-B" })); });
  await act(async () => { pending.resolve({ ...preferences(true), reminderTime: "09:30" }); });
  assert.equal(tree.root.findAllByProps({ testID: "settings-coach-saved" }).length, 0);
  assert.equal(tree.root.findByProps({ testID: "settings-coach-reminder-time" }).props.value, "08:00");
  await unmount(tree);
});

test("Settings premium switch keeps its preference callback and pending accessibility state", async () => {
  const pending = deferred();
  const { tree, calls } = await renderSettings({ premium: true, premiumSave: () => pending.promise });
  await change(byLabel(tree, "AI Coaching Insights"), true);
  assert.deepEqual(calls.premium, [true]);
  assert.equal(byLabel(tree, "AI Coaching Insights").props.disabled, true);
  assert.equal(byLabel(tree, "AI Coaching Insights").props.accessibilityState.busy, true);
  await act(async () => { pending.reject(new Error("offline")); });
  assert.equal(calls.alerts[0][0], "Error");
  assert.equal(byLabel(tree, "AI Coaching Insights").props.disabled, false);
  await unmount(tree);
});

test("Settings logout and confirmed deletion preserve existing cleanup sequence", async () => {
  let fixture = await renderSettings();
  await tap(byLabel(fixture.tree, "Log out"));
  assert.deepEqual(fixture.calls.accounts, [["unregister", "token-A"], ["logout"]]);
  await unmount(fixture.tree);
  fixture = await renderSettings();
  await tap(byLabel(fixture.tree, "Delete account"));
  await act(async () => { await fixture.calls.alerts[0][2][1].onPress(); });
  assert.deepEqual(plain(fixture.calls.accounts), [["pause", "A"], ["delete", "token-A"], ["idle"], ["cleanup", "A"], ["logout", { forceLocal: true }]]);
  await unmount(fixture.tree);
});
