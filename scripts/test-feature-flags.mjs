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
const plain = (value) => JSON.parse(JSON.stringify(value));
function load(file, mocks = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(readFileSync(path.join(root, file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require: (name) => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected import ${name}`);
  }, console, Error }, { filename: file });
  return module.exports;
}
class HttpError extends Error { constructor(message, status) { super(message); this.status = status; } }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const defaults = () => ({ environment: "preview", version: 0, flags: { subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false }, subscriptions_launch_at: null, transition_ends_at: null, launch_locked: false, can_manage_flags: true, updated_at: null, history: [] });
const byId = (tree, testID) => tree.root.findByProps({ testID });
const absent = (tree, testID) => assert.equal(tree.root.findAllByProps({ testID }).length, 0);
const text = (tree, id) => byId(tree, id).children.join("");
const tap = async (tree, id) => { await act(async () => { byId(tree, id).props.onPress(); }); };
const toggle = async (tree, name, value) => { await act(async () => { byId(tree, `feature-flag-subscriptions_${name}_enabled`).props.onValueChange(value); }); };
const date = async (tree, value) => { await act(async () => { byId(tree, "feature-flags-launch").props.onChangeText(value); }); };
async function render(options = {}) {
  const AuthContext = React.createContext(null);
  const accountScope = load("services/accountScope.ts");
  const calls = { loads: [], saves: [], alerts: [], routes: [], publicLoads: [] };
  const service = {
    getAdminFeatureFlags: async (token) => { calls.loads.push(token); return options.get ? options.get(token) : defaults(); },
    updateFeatureFlags: async (token, body) => { calls.saves.push([token, plain(body)]); return options.save ? options.save(token, body) : { ...defaults(), version: 1, flags: body.flags, subscriptions_launch_at: body.subscriptions_launch_at ?? null }; },
    getFeatureFlags: async (token) => { calls.publicLoads.push(token); return options.publicGet ? options.publicGet(token) : { ...defaults(), can_manage_flags: options.admin ?? false }; },
  };
  const mocks = {
    react: React,
    "expo-router": { useFocusEffect: (callback) => React.useEffect(callback, [callback]), useRouter: () => ({ back: () => calls.routes.push("back"), push: (route) => calls.routes.push(route) }) },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "react-native": { Alert: { alert: (...args) => calls.alerts.push(args) }, Pressable: "Pressable", View: "View", Switch: "Switch", TextInput: "TextInput", useWindowDimensions: () => ({ fontScale: options.fontScale ?? 1 }), StyleSheet: { create: (s) => s } },
    "@/components/profile-ui": { ProfilePage: ({ children, ...props }) => React.createElement("Page", props, children), ProfileScroll: ({ children }) => React.createElement("Scroll", {}, children), profileStyles: { button: {} } },
    "@/components/workout/WorkoutText": { WorkoutText: "Text" },
    "@/constants/theme": { Colors: { light: { text: "#111", icon: "#687076", inputBorder: "#E5E5E5", inputBackground: "#fff", primaryButton: "#6a4ff5" }, dark: { text: "#ECEDEE", icon: "#9BA1A6", inputBorder: "#3A3A3A", inputBackground: "#1F1F1F", primaryButton: "#6a4ff5" } } },
    "@/hooks/use-color-scheme": { useColorScheme: () => options.scheme ?? "light" },
    "@/services/accountScope": accountScope,
    "@/services/featureFlagService": service,
    "@/services/httpClient": { HttpError },
    "@/utils/authContext": { AuthContext },
  };
  const Screen = options.link ? load("components/settings/FeatureFlagsSettingsLink.tsx", mocks).FeatureFlagsSettingsLink : load("app/settings/admin-feature-flags.tsx", mocks).default;
  const element = (id = "A", token = `token-${id}`) => React.createElement(AuthContext.Provider, { value: { user: id ? { id } : null, token } }, React.createElement(Screen));
  let tree;
  await act(async () => { tree = create(element()); });
  return { tree, calls, accountScope, element, close: async () => { await act(async () => tree.unmount()); } };
}

test("service uses authenticated public/admin endpoints and atomic versioned patch", async () => {
  const calls = [];
  const service = load("services/featureFlagService.ts", { "./httpClient": { requestJson: async (...args) => { calls.push(plain(args)); return defaults(); } } });
  await service.getFeatureFlags("token");
  await service.getAdminFeatureFlags("token");
  const patch = { expected_version: 3, flags: { subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false } };
  await service.updateFeatureFlags("token", patch);
  assert.deepEqual(calls, [["/v1/feature-flags", { token: "token" }], ["/v1/admin/feature-flags", { token: "token" }], ["/v1/admin/feature-flags", { method: "PATCH", token: "token", body: patch }]]);
});

for (const scheme of ["light", "dark"]) test(`defaults are off and controls are accessible at large text in ${scheme}`, async () => {
  const app = await render({ scheme, fontScale: 2 });
  assert.match(text(app.tree, "feature-flags-environment"), /preview/);
  for (const control of app.tree.root.findAllByType("Switch")) {
    assert.equal(control.props.value, false);
    assert.ok(control.props.accessibilityLabel);
    assert.equal(control.parent.props.style[1].flexDirection, "column");
  }
  assert.equal(byId(app.tree, "feature-flags-save").props.disabled, true);
  assert.match(text(app.tree, "feature-flags-transition"), /Not scheduled/);
  await app.close();
});

test("both flags save together with version and launch, then show server audit", async () => {
  const audit = { version: 1, changed_at: "2026-10-23T12:00:00Z", changed_by: "admin-uuid", before: { flags: defaults().flags, subscriptions_launch_at: null }, after: { flags: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: true }, subscriptions_launch_at: "2026-10-01T00:00:00Z" } };
  const app = await render({ save: async (_token, body) => ({ ...defaults(), version: 1, flags: body.flags, subscriptions_launch_at: body.subscriptions_launch_at, history: [audit] }) });
  await toggle(app.tree, "purchases", true); await toggle(app.tree, "enforcement", true); await date(app.tree, "2026-10-01T00:00:00Z");
  assert.match(text(app.tree, "feature-flags-transition"), /2026-10-31T00:00:00.000Z/);
  await tap(app.tree, "feature-flags-save");
  assert.deepEqual(app.calls.saves, [["token-A", { expected_version: 0, flags: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: true }, subscriptions_launch_at: "2026-10-01T00:00:00Z" }]]);
  assert.equal(text(app.tree, "feature-flags-saved"), "Changes saved.");
  assert.match(byId(app.tree, "feature-flags-audit-1").findAllByType("Text").map((node) => node.children.join("")).join(" "), /admin-uuid.*Purchases: false → true/);
  await app.close();
});

test("invalid UTC date is visible and never sent", async () => {
  const app = await render(); await date(app.tree, "2026-10-23T10:00:00"); await tap(app.tree, "feature-flags-save");
  assert.match(text(app.tree, "feature-flags-error"), /UTC timestamp ending in Z/); assert.equal(app.calls.saves.length, 0); absent(app.tree, "feature-flags-saved"); await app.close();
});

test("422 validation stays visible and failed save preserves draft", async () => {
  const app = await render({ save: async () => { throw new HttpError("Purchases must be enabled first.", 422); } });
  await toggle(app.tree, "enforcement", true); await tap(app.tree, "feature-flags-save");
  assert.equal(text(app.tree, "feature-flags-error"), "Purchases must be enabled first.");
  assert.equal(byId(app.tree, "feature-flag-subscriptions_enforcement_enabled").props.value, true); absent(app.tree, "feature-flags-saved"); await app.close();
});

test("conflict preserves edits and refresh requires explicit discard", async () => {
  const app = await render({ save: async () => { throw new HttpError("Changed elsewhere.", 409); } });
  await toggle(app.tree, "purchases", true); await tap(app.tree, "feature-flags-save");
  assert.match(text(app.tree, "feature-flags-error"), /edits are preserved/);
  assert.equal(byId(app.tree, "feature-flags-save").props.disabled, true);
  assert.equal(byId(app.tree, "feature-flag-subscriptions_purchases_enabled").props.value, true);
  await tap(app.tree, "feature-flags-refresh"); assert.equal(app.calls.loads.length, 1);
  assert.equal(app.calls.alerts[0][2][0].text, "Keep editing");
  await act(async () => { app.calls.alerts[0][2][1].onPress(); });
  assert.equal(app.calls.loads.length, 2); assert.equal(byId(app.tree, "feature-flag-subscriptions_purchases_enabled").props.value, false); await app.close();
});

test("403 hides all admin state on direct entry and after denied save", async () => {
  const denied = await render({ get: async () => { throw new HttpError("Forbidden", 403); } });
  byId(denied.tree, "feature-flags-forbidden"); absent(denied.tree, "feature-flags-save"); await denied.close();
  const revoked = await render({ save: async () => { throw new HttpError("Forbidden", 403); } });
  await toggle(revoked.tree, "purchases", true); await tap(revoked.tree, "feature-flags-save");
  byId(revoked.tree, "feature-flags-forbidden"); absent(revoked.tree, "feature-flags-environment"); await revoked.close();
});

test("locked launch cannot be edited and is omitted while both flags turn off", async () => {
  const app = await render({ get: async () => ({ ...defaults(), version: 4, flags: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: true }, subscriptions_launch_at: "2026-10-01T00:00:00Z", launch_locked: true }) });
  assert.equal(byId(app.tree, "feature-flags-launch").props.editable, false); byId(app.tree, "feature-flags-launch-locked");
  await toggle(app.tree, "purchases", false); await toggle(app.tree, "enforcement", false); await tap(app.tree, "feature-flags-save");
  assert.deepEqual(app.calls.saves[0][1], { expected_version: 4, flags: { subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false } }); await app.close();
});

test("account change immediately resets drafts and ignores prior account load/save", async () => {
  const pendingLoad = deferred();
  const app = await render({ get: (token) => token === "token-A" ? pendingLoad.promise : Promise.reject(new HttpError("Forbidden", 403)) });
  await act(async () => { app.accountScope.invalidateAccountRequests(); app.tree.update(app.element("B")); });
  byId(app.tree, "feature-flags-forbidden");
  await act(async () => pendingLoad.resolve({ ...defaults(), environment: "A-private" }));
  absent(app.tree, "feature-flags-environment"); await app.close();
  const pendingSave = deferred();
  const saveApp = await render({ save: () => pendingSave.promise });
  await toggle(saveApp.tree, "purchases", true); await tap(saveApp.tree, "feature-flags-save");
  await act(async () => { saveApp.accountScope.invalidateAccountRequests(); saveApp.tree.update(saveApp.element("B")); });
  assert.equal(byId(saveApp.tree, "feature-flag-subscriptions_purchases_enabled").props.value, false);
  await act(async () => pendingSave.resolve({ ...defaults(), version: 9 }));
  absent(saveApp.tree, "feature-flags-saved"); assert.equal(byId(saveApp.tree, "feature-flag-subscriptions_purchases_enabled").props.value, false); await saveApp.close();
});

test("saving blocks duplicate requests and refresh", async () => {
  const pending = deferred(); const app = await render({ save: () => pending.promise });
  await toggle(app.tree, "purchases", true); await tap(app.tree, "feature-flags-save");
  await tap(app.tree, "feature-flags-save"); await tap(app.tree, "feature-flags-refresh");
  assert.equal(app.calls.saves.length, 1); assert.equal(app.calls.loads.length, 1);
  await act(async () => pending.resolve({ ...defaults(), version: 1 })); await app.close();
});

test("Settings link uses backend permission, remains quiet on failure and ignores account races", async () => {
  const normal = await render({ link: true }); absent(normal.tree, "settings-feature-flags"); await normal.close();
  const admin = await render({ link: true, admin: true }); await tap(admin.tree, "settings-feature-flags"); assert.deepEqual(admin.calls.routes, ["/settings/admin-feature-flags"]); await admin.close();
  const unavailable = await render({ link: true, publicGet: async () => { throw new Error("404"); } }); assert.equal(unavailable.tree.toJSON(), null); await unavailable.close();
  const pending = deferred();
  const race = await render({ link: true, publicGet: (token) => token === "token-A" ? pending.promise : Promise.resolve({ ...defaults(), can_manage_flags: false }) });
  await act(async () => { race.accountScope.invalidateAccountRequests(); race.tree.update(race.element("B")); });
  await act(async () => pending.resolve(defaults())); absent(race.tree, "settings-feature-flags"); await race.close();
});


test("server UTC offsets normalize without making a clean form dirty", async () => {
  const app = await render({ get: async () => ({ ...defaults(), subscriptions_launch_at: "2026-10-01T00:00:00+00:00" }) });
  assert.equal(byId(app.tree, "feature-flags-launch").props.value, "2026-10-01T00:00:00.000Z");
  assert.equal(byId(app.tree, "feature-flags-save").props.disabled, true);
  await toggle(app.tree, "purchases", true); await tap(app.tree, "feature-flags-save");
  assert.equal(app.calls.saves[0][1].subscriptions_launch_at, "2026-10-01T00:00:00.000Z"); await app.close();
});

test("a failed refresh after a conflict keeps the conflict gate and unsaved edits", async () => {
  let loaded = false;
  const app = await render({ get: async () => { if (loaded) throw new Error("Offline"); loaded = true; return defaults(); }, save: async () => { throw new HttpError("Changed elsewhere", 409); } });
  await toggle(app.tree, "purchases", true); await tap(app.tree, "feature-flags-save"); await tap(app.tree, "feature-flags-refresh");
  await act(async () => { app.calls.alerts[0][2][1].onPress(); });
  assert.equal(byId(app.tree, "feature-flags-save").props.disabled, true);
  assert.equal(byId(app.tree, "feature-flag-subscriptions_purchases_enabled").props.value, true);
  assert.equal(text(app.tree, "feature-flags-error"), "Offline"); absent(app.tree, "feature-flags-saved"); await app.close();
});


test("old discard confirmation cannot send HTTP after account switch or unmount", async () => {
  const app = await render(); await toggle(app.tree, "purchases", true); await tap(app.tree, "feature-flags-refresh");
  const discard = app.calls.alerts[0][2][1].onPress;
  await act(async () => { app.accountScope.invalidateAccountRequests(); app.tree.update(app.element("B")); });
  assert.deepEqual(app.calls.loads, ["token-A", "token-B"]);
  await act(async () => { discard(); });
  assert.deepEqual(app.calls.loads, ["token-A", "token-B"]);
  await app.close();
  const unmounted = await render(); await toggle(unmounted.tree, "purchases", true); await tap(unmounted.tree, "feature-flags-refresh");
  const abandonedDiscard = unmounted.calls.alerts[0][2][1].onPress;
  await unmounted.close(); await act(async () => { abandonedDiscard(); });
  assert.deepEqual(unmounted.calls.loads, ["token-A"]);
});
