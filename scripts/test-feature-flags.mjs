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
  const calls = { loads: [], saves: [], alerts: [], routes: [], publicLoads: [], lookups: [], userLoads: [], userSaves: [], lists: [] };
  const service = {
    getAdminFeatureFlags: async (token) => { calls.loads.push(token); return options.get ? options.get(token) : defaults(); },
    updateFeatureFlags: async (token, body) => { calls.saves.push([token, plain(body)]); return options.save ? options.save(token, body) : { ...defaults(), version: 1, flags: body.flags, subscriptions_launch_at: body.subscriptions_launch_at ?? null }; },
    getFeatureFlags: async (token) => { calls.publicLoads.push(token); return options.publicGet ? options.publicGet(token) : { ...defaults(), can_manage_flags: options.admin ?? false }; },
    lookupFeatureFlagUser: async (token, identifier) => { calls.lookups.push([token, identifier]); return options.lookup ? options.lookup(token, identifier) : userSnapshot(); },
    getUserFeatureFlags: async (token, userId) => { calls.userLoads.push([token, userId]); return options.userGet ? options.userGet(token, userId) : userSnapshot(userId); },
    updateUserFeatureFlags: async (token, userId, body) => { calls.userSaves.push([token, userId, plain(body)]); return options.userSave ? options.userSave(token, userId, body) : { ...userSnapshot(userId), version: 1, overrides: body.overrides }; },
    listUserFeatureFlags: async (token, offset) => { calls.lists.push([token, offset]); return options.list ? options.list(token, offset) : { environment: 'preview', version: 0, items: [], total: 0, limit: 20, offset }; },
  };
  const mocks = {
    react: React,
    "expo-router": { useFocusEffect: (callback) => { calls.focus = callback; React.useEffect(callback, [callback]); }, useRouter: () => ({ back: () => calls.routes.push("back"), push: (route) => calls.routes.push(route) }) },
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
  const Screen = options.users ? load("app/settings/admin-feature-flag-users.tsx", mocks).default : options.link ? load("components/settings/FeatureFlagsSettingsLink.tsx", mocks).FeatureFlagsSettingsLink : load("app/settings/admin-feature-flags.tsx", mocks).default;
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
  assert.deepEqual(app.calls.saves, [["token-A", { expected_version: 0, flags: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: true }, audiences: { subscriptions_purchases_enabled: "everyone", subscriptions_enforcement_enabled: "everyone" }, subscriptions_launch_at: "2026-10-01T00:00:00Z" }]]);
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
  byId(app.tree, "feature-flags-keep-editing");
  await act(async () => { byId(app.tree, "feature-flags-confirm-discard").props.onPress(); });
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
  assert.deepEqual(app.calls.saves[0][1], { expected_version: 4, flags: { subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false }, audiences: { subscriptions_purchases_enabled: "everyone", subscriptions_enforcement_enabled: "everyone" } }); await app.close();
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
  await act(async () => { byId(app.tree, "feature-flags-confirm-discard").props.onPress(); });
  assert.equal(byId(app.tree, "feature-flags-save").props.disabled, true);
  assert.equal(byId(app.tree, "feature-flag-subscriptions_purchases_enabled").props.value, true);
  assert.equal(text(app.tree, "feature-flags-error"), "Offline"); absent(app.tree, "feature-flags-saved"); await app.close();
});


test("old discard confirmation cannot send HTTP after account switch or unmount", async () => {
  const app = await render(); await toggle(app.tree, "purchases", true); await tap(app.tree, "feature-flags-refresh");
  const discard = byId(app.tree, "feature-flags-confirm-discard").props.onPress;
  await act(async () => { app.accountScope.invalidateAccountRequests(); app.tree.update(app.element("B")); });
  assert.deepEqual(app.calls.loads, ["token-A", "token-B"]);
  await act(async () => { discard(); });
  assert.deepEqual(app.calls.loads, ["token-A", "token-B"]);
  await app.close();
  const unmounted = await render(); await toggle(unmounted.tree, "purchases", true); await tap(unmounted.tree, "feature-flags-refresh");
  const abandonedDiscard = byId(unmounted.tree, "feature-flags-confirm-discard").props.onPress;
  await unmounted.close(); await act(async () => { abandonedDiscard(); });
  assert.deepEqual(unmounted.calls.loads, ["token-A"]);
});


function userSnapshot(id = "target-A", changes = {}) {
  return { environment: "preview", version: 0, user: { id, email: `${id}@example.com`, preferred_name: id }, overrides: { subscriptions_purchases_enabled: null, subscriptions_enforcement_enabled: null }, effective_flags: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: true }, global_flags: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: true }, audiences: { subscriptions_purchases_enabled: "everyone", subscriptions_enforcement_enabled: "everyone" }, subscriptions_launch_at: "2026-10-01T00:00:00Z", transition_ends_at: "2026-10-31T00:00:00Z", launch_locked: true, ...changes };
}
const identify = async (app, identifier = "target-A@example.com") => {
  await act(async () => { byId(app.tree, "flag-users-identifier").props.onChangeText(identifier); });
  await tap(app.tree, "flag-users-lookup");
};
const override = (app, flag, value) => tap(app.tree, `flag-users-subscriptions_${flag}_enabled-${value}`);

test("target services keep identifiers in POST bodies and use paginated UUID URLs", async () => {
  const calls = [];
  const service = load("services/featureFlagService.ts", { "./httpClient": { requestJson: async (...args) => { calls.push(plain(args)); } } });
  await service.lookupFeatureFlagUser("token", "exact@example.com");
  await service.getUserFeatureFlags("token", "id/one");
  await service.updateUserFeatureFlags("token", "uuid", { expected_version: 5, overrides: { subscriptions_purchases_enabled: null, subscriptions_enforcement_enabled: false } });
  await service.listUserFeatureFlags("token", 20);
  assert.deepEqual(calls, [
    ["/v1/admin/feature-flags/users/lookup", { method: "POST", token: "token", body: { identifier: "exact@example.com" } }],
    ["/v1/admin/feature-flags/users/id%2Fone", { token: "token" }],
    ["/v1/admin/feature-flags/users/uuid", { method: "PATCH", token: "token", body: { expected_version: 5, overrides: { subscriptions_purchases_enabled: null, subscriptions_enforcement_enabled: false } } }],
    ["/v1/admin/feature-flags/users?limit=20&offset=20", { token: "token" }],
  ]);
  assert.equal(calls.some(([url]) => url.includes("example.com")), false);
});

test("audiences default to everyone for legacy snapshots and save atomically with master flags", async () => {
  const app = await render();
  assert.equal(byId(app.tree, "feature-flags-audience-subscriptions_purchases_enabled-everyone").props.accessibilityState.checked, true);
  await tap(app.tree, "feature-flags-audience-subscriptions_purchases_enabled-selected");
  await toggle(app.tree, "purchases", true); await tap(app.tree, "feature-flags-save");
  assert.deepEqual(app.calls.saves[0][1], { expected_version: 0, flags: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: false }, audiences: { subscriptions_purchases_enabled: "selected", subscriptions_enforcement_enabled: "everyone" }, subscriptions_launch_at: null });
  await app.close();
});

test("global navigation confirms before leaving unsaved audience changes and audit separates actor and target", async () => {
  const app = await render({ get: async () => ({ ...defaults(), history: [{ version: 1, changed_at: 'today', changed_by: 'actor-uuid', scope: 'user', target_user_id: null, before: { overrides: { subscriptions_purchases_enabled: null } }, after: { overrides: { subscriptions_purchases_enabled: true } } }] }) });
  const auditText = byId(app.tree, "feature-flags-audit-1").findAllByType("Text").map((node) => node.children.join("")).join(" ");
  assert.match(auditText, /Scope: User · Removed account/); assert.match(auditText, /Changed by: actor-uuid/);
  await tap(app.tree, "feature-flags-audience-subscriptions_purchases_enabled-selected"); await tap(app.tree, "feature-flags-manage-users");
  assert.deepEqual(app.calls.routes, []); await tap(app.tree, "feature-flags-confirm-discard");
  assert.deepEqual(app.calls.routes, ["/settings/admin-feature-flag-users"]); await app.close();
});

for (const scheme of ["light", "dark"]) test(`exact lookup shows identity and accessible three-way controls in ${scheme}`, async () => {
  const app = await render({ users: true, scheme, fontScale: 2 });
  absent(app.tree, "flag-users-selected"); await identify(app, "exact@example.com");
  assert.deepEqual(app.calls.lookups, [["token-A", "exact@example.com"]]);
  const identity = byId(app.tree, "flag-users-selected").findAllByType("Text").map((node) => node.children.join("")).join(" ");
  assert.match(identity, /target-A@example.com.*Account UUID: target-A/);
  for (const radio of app.tree.root.findAllByProps({ accessibilityRole: "radio" })) {
    assert.ok(radio.props.accessibilityLabel); assert.equal(radio.parent.props.style.flexDirection, "column");
  }
  assert.equal(byId(app.tree, "flag-users-save").props.disabled, true); await app.close();
});

test("allow deny and inherit resolve against audiences, master off and purchases prerequisite", async () => {
  const selected = userSnapshot("target-A", { audiences: { subscriptions_purchases_enabled: "selected", subscriptions_enforcement_enabled: "selected" }, effective_flags: { subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false } });
  const app = await render({ users: true, lookup: async () => selected }); await identify(app);
  assert.match(text(app.tree, "flag-users-effective-subscriptions_purchases_enabled"), /Off/);
  await override(app, "purchases", "allow"); assert.match(text(app.tree, "flag-users-effective-subscriptions_purchases_enabled"), /Preview after save: On/);
  await override(app, "enforcement", "allow"); assert.match(text(app.tree, "flag-users-effective-subscriptions_enforcement_enabled"), /On/);
  await override(app, "purchases", "deny"); assert.match(text(app.tree, "flag-users-effective-subscriptions_enforcement_enabled"), /Off/); byId(app.tree, "flag-users-purchases-prerequisite");
  await override(app, "purchases", "default"); assert.match(text(app.tree, "flag-users-effective-subscriptions_purchases_enabled"), /Off/); await app.close();
  const off = await render({ users: true, lookup: async () => userSnapshot("target-A", { global_flags: { subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false }, overrides: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: true }, effective_flags: { subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false } }) });
  await identify(off); assert.match(text(off.tree, "flag-users-effective-subscriptions_purchases_enabled"), /Effective now: Off/); byId(off.tree, "flag-users-global-disabled-subscriptions_purchases_enabled"); await off.close();
});

test("save sends two overrides with env version and reset removes both explicitly", async () => {
  const app = await render({ users: true, lookup: async () => userSnapshot("target-A", { version: 7 }) }); await identify(app);
  await override(app, "purchases", "allow"); await override(app, "enforcement", "deny"); await tap(app.tree, "flag-users-save");
  assert.deepEqual(app.calls.userSaves[0], ["token-A", "target-A", { expected_version: 7, overrides: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: false } }]);
  byId(app.tree, "flag-users-saved"); await tap(app.tree, "flag-users-reset"); absent(app.tree, "flag-users-saved");
  assert.equal(app.calls.userSaves.length, 1); await tap(app.tree, "flag-users-save");
  assert.deepEqual(app.calls.userSaves[1][2], { expected_version: 1, overrides: { subscriptions_purchases_enabled: null, subscriptions_enforcement_enabled: null } }); await app.close();
});

test("configured list paginates and row selection fetches fresh target snapshot", async () => {
  const app = await render({ users: true, list: async (_token, offset) => ({ environment: "preview", version: 2, items: [userSnapshot(offset ? "last-user" : "first-user")], total: 21, limit: 20, offset }) });
  assert.equal(text(app.tree, "flag-users-list-count"), "1–20 of 21");
  await tap(app.tree, "flag-users-page-next"); assert.deepEqual(app.calls.lists, [["token-A", 0], ["token-A", 20]]);
  assert.equal(text(app.tree, "flag-users-list-count"), "21–21 of 21");
  await tap(app.tree, "flag-users-select-last-user"); assert.deepEqual(app.calls.userLoads, [["token-A", "last-user"]]);
  assert.match(byId(app.tree, "flag-users-selected").findAllByType("Text").map((node) => node.children.join("")).join(" "), /last-user/);
  await tap(app.tree, "flag-users-page-previous"); assert.equal(app.calls.lists.at(-1)[1], 0); await app.close();
});

test("dirty lookup target switch and refresh require explicit discard", async () => {
  const app = await render({ users: true, list: async () => ({ environment: "preview", version: 0, items: [userSnapshot("target-B")], total: 1, limit: 20, offset: 0 }) }); await identify(app);
  await override(app, "purchases", "deny"); await identify(app, "another@example.com");
  assert.equal(app.calls.lookups.length, 1); byId(app.tree, "flag-users-discard-confirmation");
  await tap(app.tree, "flag-users-keep-editing"); assert.equal(byId(app.tree, "flag-users-subscriptions_purchases_enabled-deny").props.accessibilityState.checked, true);
  await tap(app.tree, "flag-users-select-target-B"); assert.equal(app.calls.userLoads.length, 0); await tap(app.tree, "flag-users-confirm-discard"); assert.deepEqual(app.calls.userLoads, [["token-A", "target-B"]]);
  await override(app, "purchases", "deny"); await tap(app.tree, "flag-users-refresh"); assert.equal(app.calls.loads.length, 1);
  await tap(app.tree, "flag-users-confirm-discard"); assert.equal(app.calls.loads.length, 2); assert.deepEqual(app.calls.userLoads.at(-1), ["token-A", "target-B"]); await app.close();
});

test("409 preserves overrides and failed refresh keeps save blocked", async () => {
  let offline = false;
  const app = await render({ users: true, userSave: async () => { throw new HttpError("Version conflict", 409); }, get: async () => { if (offline) throw new Error("Offline"); return defaults(); } }); await identify(app); await override(app, "purchases", "deny"); await tap(app.tree, "flag-users-save");
  assert.match(text(app.tree, "flag-users-error"), /edits are preserved/); assert.equal(byId(app.tree, "flag-users-save").props.disabled, true);
  offline = true; await tap(app.tree, "flag-users-refresh"); await tap(app.tree, "flag-users-confirm-discard");
  assert.equal(text(app.tree, "flag-users-error"), "Offline"); assert.equal(byId(app.tree, "flag-users-save").props.disabled, true); assert.equal(byId(app.tree, "flag-users-subscriptions_purchases_enabled-deny").props.accessibilityState.checked, true); absent(app.tree, "flag-users-saved"); await app.close();
});

test("404 clears matched identity and 403 clears identity list and input", async () => {
  const app = await render({ users: true, lookup: async (_token, id) => { if (id === "missing") throw new HttpError("No account found", 404); return userSnapshot(); } });
  await identify(app); await identify(app, "missing"); absent(app.tree, "flag-users-selected"); assert.equal(text(app.tree, "flag-users-error"), "No account found"); await app.close();
  const denied = await render({ users: true, userSave: async () => { throw new HttpError("Forbidden", 403); } }); await identify(denied); await override(denied, "purchases", "deny"); await tap(denied.tree, "flag-users-save");
  byId(denied.tree, "flag-users-forbidden"); absent(denied.tree, "flag-users-selected"); absent(denied.tree, "flag-users-identifier"); absent(denied.tree, "flag-users-list-count"); await denied.close();
  const direct = await render({ users: true, get: async () => { throw new HttpError("Forbidden", 403); } }); byId(direct.tree, "flag-users-forbidden"); assert.equal(direct.calls.lists.length, 0); await direct.close();
});

test("old confirmation and target save handlers cannot issue HTTP after target account switch or unmount", async () => {
  const app = await render({ users: true, lookup: async (_token, id) => userSnapshot(id === "next" ? "target-B" : "target-A") }); await identify(app); await override(app, "purchases", "deny");
  const oldSave = byId(app.tree, "flag-users-save").props.onPress;
  const oldRefresh = byId(app.tree, "flag-users-refresh").props.onPress;
  const oldLookup = byId(app.tree, "flag-users-lookup").props.onPress;
  await identify(app, "next"); const oldDiscard = byId(app.tree, "flag-users-confirm-discard").props.onPress;
  await tap(app.tree, "flag-users-confirm-discard");
  await act(async () => { oldSave(); oldDiscard(); oldRefresh(); oldLookup(); }); assert.equal(app.calls.userSaves.length, 0); assert.equal(app.calls.lookups.length, 2);
  await override(app, "purchases", "deny"); await tap(app.tree, "flag-users-refresh"); const accountDiscard = byId(app.tree, "flag-users-confirm-discard").props.onPress;
  await act(async () => { app.accountScope.invalidateAccountRequests(); app.tree.update(app.element("B")); accountDiscard(); });
  assert.deepEqual(app.calls.loads, ["token-A", "token-B"]); await app.close();
  const unmounted = await render({ users: true }); await identify(unmounted); await override(unmounted, "purchases", "deny"); await tap(unmounted.tree, "flag-users-refresh"); const discardAfterUnmount = byId(unmounted.tree, "flag-users-confirm-discard").props.onPress;
  await unmounted.close(); await act(async () => { discardAfterUnmount(); }); assert.deepEqual(unmounted.calls.loads, ["token-A"]);
});

test("pending lookup and save results cannot expose a previous account's target", async () => {
  const pending = deferred(); const app = await render({ users: true, lookup: () => pending.promise }); await identify(app);
  await act(async () => { app.accountScope.invalidateAccountRequests(); app.tree.update(app.element("B")); });
  await act(async () => pending.resolve(userSnapshot())); absent(app.tree, "flag-users-selected"); await app.close();
  const pendingSave = deferred(); const saveApp = await render({ users: true, userSave: () => pendingSave.promise }); await identify(saveApp); await override(saveApp, "purchases", "deny"); await tap(saveApp.tree, "flag-users-save");
  await act(async () => { saveApp.accountScope.invalidateAccountRequests(); saveApp.tree.update(saveApp.element("B")); });
  await act(async () => pendingSave.resolve(userSnapshot())); absent(saveApp.tree, "flag-users-selected"); absent(saveApp.tree, "flag-users-saved"); assert.equal(saveApp.calls.lists.filter(([token]) => token === "token-A").length, 1); await saveApp.close();
});


test("discarded global edits do not survive user dashboard navigation and return refreshes shared version", async () => {
  let serverVersion = 0;
  const app = await render({ get: async () => ({ ...defaults(), version: serverVersion }) });
  await toggle(app.tree, "purchases", true); await tap(app.tree, "feature-flags-audience-subscriptions_purchases_enabled-selected");
  await act(async () => { app.calls.focus(); }); assert.equal(app.calls.loads.length, 1);
  await tap(app.tree, "feature-flags-manage-users"); await tap(app.tree, "feature-flags-confirm-discard");
  absent(app.tree, "feature-flags-unsaved");
  assert.equal(byId(app.tree, "feature-flag-subscriptions_purchases_enabled").props.value, false);
  assert.equal(byId(app.tree, "feature-flags-audience-subscriptions_purchases_enabled-everyone").props.accessibilityState.checked, true);
  serverVersion = 9;
  await act(async () => { app.calls.focus(); }); assert.equal(app.calls.loads.length, 2);
  assert.equal(app.tree.root.findAllByType("Text").some((node) => node.children.join("") === "Version 9"), true);
  await app.close();
});

test("user dashboard focus refreshes only clean drafts and stale refresh handler cannot switch target", async () => {
  const app = await render({ users: true }); await identify(app);
  await act(async () => { app.calls.focus(); }); assert.equal(app.calls.loads.length, 2); assert.equal(app.calls.userLoads.length, 1);
  await override(app, "purchases", "deny");
  await act(async () => { app.calls.focus(); }); assert.equal(app.calls.loads.length, 2);
  assert.equal(byId(app.tree, "flag-users-subscriptions_purchases_enabled-deny").props.accessibilityState.checked, true); await app.close();
});

test("pending configured list cannot reveal old account rows after account change", async () => {
  const pending = deferred();
  const app = await render({ users: true, list: (token) => token === "token-A" ? pending.promise : Promise.resolve({ environment: "preview", version: 0, items: [], total: 0, limit: 20, offset: 0 }) });
  await act(async () => { app.accountScope.invalidateAccountRequests(); app.tree.update(app.element("B")); });
  await act(async () => pending.resolve({ environment: "preview", version: 0, items: [userSnapshot("secret-A")], total: 1, limit: 20, offset: 0 }));
  absent(app.tree, "flag-users-select-secret-A"); assert.equal(text(app.tree, "flag-users-list-count"), "No user overrides configured."); await app.close();
});


test("cancelled user discard confirmation never issues a delayed refresh", async () => {
  const app = await render({ users: true }); await identify(app); await override(app, "purchases", "deny"); await tap(app.tree, "flag-users-refresh");
  const abandoned = byId(app.tree, "flag-users-confirm-discard").props.onPress;
  await tap(app.tree, "flag-users-keep-editing"); await act(async () => { abandoned(); });
  assert.equal(app.calls.loads.length, 1); assert.equal(byId(app.tree, "flag-users-subscriptions_purchases_enabled-deny").props.accessibilityState.checked, true); await app.close();
});
