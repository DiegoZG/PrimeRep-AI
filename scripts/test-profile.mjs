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
  vm.runInNewContext(output, { module, exports: module.exports, require, setTimeout, clearTimeout, console, process: { env: {} }, ...globals }, { filename });
  return module.exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const weight = load("utils/weightUnits.ts", { "@react-native-async-storage/async-storage": {} });
const forms = load("utils/profileForm.ts", { "./weightUnits": weight });
const profile = { id: "a", email: "a@example.com", preferred_name: "Ada", last_name: "", weight: 70.12345, weight_unit: "KG", age: 32, gender: "female", avatar_version: null, updated_at: "2026-09-22T00:00:00Z" };

test("name-only patch preserves precise body weight and grandfathered values", () => {
  const initial = forms.profileForm({ ...profile, weight: 500, age: 12 }, "LB");
  const edited = { ...initial, preferred_name: "  Ada Lovelace  " };
  assert.deepEqual(plain(forms.changedProfilePayload(edited, initial)), { preferred_name: "Ada Lovelace" });
  assert.equal(forms.validateProfileForm(edited, initial), null);
  assert.equal(initial.gender, "Female");
});

test("display-unit toggles never emit weight writes; actual edits send paired units", () => {
  const initial = forms.profileForm(profile, "LB");
  const toggled = forms.profileForm(profile, "KG");
  assert.deepEqual(plain(forms.changedProfilePayload(toggled, initial)), {});
  const edited = { ...toggled, weight: "72.5", weight_edited: true };
  assert.deepEqual(plain(forms.changedProfilePayload(edited, initial)), { weight: 72.5, weight_unit: "KG" });
  assert.equal(forms.validateProfileForm(edited, initial), null);
});

test("optional fields can be cleared and weight validation uses the same physical bound", () => {
  const initial = forms.profileForm(profile, "LB");
  const empty = { ...initial, age: "", gender: "", weight: "", weight_edited: true };
  assert.deepEqual(plain(forms.changedProfilePayload(empty, initial)), { weight: null, weight_unit: "LB", age: null, gender: null });
  assert.equal(forms.validateProfileForm({ ...initial, weight: "700", weight_edited: true }), null);
  assert.equal(forms.validateProfileForm({ ...initial, weight: "317.514659", weight_unit: "KG", weight_edited: true }), null);
  for (const value of ["701", "1e2", "NaN", "-1", "0"]) assert.ok(forms.validateProfileForm({ ...initial, weight: value, weight_edited: true }));
  assert.ok(forms.validateProfileForm({ ...initial, age: "14.5" }));
});

test("an old account request stays invalid after A to B to A", () => {
  const scope = load("services/accountScope.ts");
  const old = scope.accountRequestGuard();
  scope.invalidateAccountRequests();
  const b = scope.accountRequestGuard();
  scope.invalidateAccountRequests();
  assert.equal(old(), false);
  assert.equal(b(), false);
  assert.equal(scope.accountRequestGuard()(), true);
});

test("serialized token writes cannot let delayed account A overwrite account B", async () => {
  const delayed = deferred();
  let refresh;
  let access;
  let current = "a";
  const store = { setRefreshToken: async (value) => { if (value === "refresh-a") await delayed.promise; refresh = value; }, setAccessToken: async (value) => { access = value; }, clearTokens: async () => { refresh = access = null; } };
  const queue = load("services/authTokenQueue.ts", { "./tokenStorage": store });
  const a = queue.persistSessionTokens("access-a", "refresh-a", () => current === "a");
  await Promise.resolve(); await Promise.resolve();
  current = "b";
  const b = queue.persistSessionTokens("access-b", "refresh-b", () => current === "b");
  delayed.resolve();
  await Promise.all([a, b]);
  assert.equal(refresh, "refresh-b"); assert.equal(access, "access-b");
  await queue.clearSessionTokens(() => false);
  assert.equal(refresh, "refresh-b");
  await queue.clearSessionTokens(() => true);
  assert.equal(refresh, null); assert.equal(access, null);
});

test("stale profile results never appear after account switches, including A to B to A", async () => {
  const scope = load("services/accountScope.ts");
  const AuthContext = React.createContext(null);
  const calls = [];
  const fetchData = () => { const call = deferred(); calls.push(call); return call.promise; };
  const { useAccountResource } = load("hooks/use-account-resource.ts", { "@/utils/authContext": { AuthContext }, "@/services/accountScope": scope, "expo-router": { useFocusEffect: (callback) => React.useEffect(callback, [callback]) } });
  let result;
  function Content() { result = useAccountResource(fetchData); return null; }
  const users = { a: { id: "a" }, b: { id: "b" } };
  const render = (id) => React.createElement(AuthContext.Provider, { value: { user: users[id], token: id } }, React.createElement(Content));
  let tree;
  await act(async () => { tree = create(render("a")); });
  scope.invalidateAccountRequests();
  await act(async () => { tree.update(render("b")); });
  scope.invalidateAccountRequests();
  await act(async () => { tree.update(render("a")); });
  await act(async () => { calls[0].resolve("stale-a"); calls[1].resolve("stale-b"); });
  assert.equal(result.data, null);
  await act(async () => { calls[2].resolve("fresh-a"); });
  assert.equal(result.data, "fresh-a");
  await act(async () => { tree.unmount(); });
});

test("resource refresh failure keeps existing successful content for retry", async () => {
  const AuthContext = React.createContext({ user: { id: "a" }, token: "a" });
  const calls = [];
  const fetchData = () => { const call = deferred(); calls.push(call); return call.promise; };
  const { useAccountResource } = load("hooks/use-account-resource.ts", { "@/utils/authContext": { AuthContext }, "@/services/accountScope": load("services/accountScope.ts"), "expo-router": { useFocusEffect: (callback) => React.useEffect(callback, [callback]) } });
  let result, tree;
  function Content() { result = useAccountResource(fetchData); return null; }
  await act(async () => { tree = create(React.createElement(Content)); });
  await act(async () => { calls[0].resolve({ name: "Saved" }); });
  let retry;
  await act(async () => { retry = result.refresh(); });
  await act(async () => { calls[1].reject(new Error("offline")); await retry; });
  assert.equal(result.data.name, "Saved"); assert.equal(result.error, true);
  await act(async () => { tree.unmount(); });
});

test("binary requests remain timeout-protected while consuming a stalled body", async () => {
  const { HttpError } = load("services/httpClient.ts", { "@/config/api": { API_BASE_URL: "https://local.invalid" } });
  const { requestBinary } = load("services/binaryClient.ts", { "@/config/api": { API_BASE_URL: "https://local.invalid" }, "./httpClient": { HttpError } }, { Error, AbortController, fetch: async (_url, options) => ({ ok: true, blob: () => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))) }) });
  await assert.rejects(requestBinary("/export", "token", (response) => response.blob(), { timeoutMs: 10 }), /timed out/);
});

test("support drafts include only requested diagnostics and encode message text", () => {
  const { supportMailto } = load("constants/support.ts");
  const simple = decodeURIComponent(supportMailto("support@primerep.app", false));
  assert.ok(simple.startsWith("mailto:support@primerep.app?subject=PrimeRep support request"));
  assert.ok(!simple.includes("App version"));
  const diagnostic = decodeURIComponent(supportMailto("support@primerep.app", true, { version: "1.0", platform: "ios", os: "18" }));
  assert.ok(diagnostic.includes("App version: 1.0\nPlatform: ios\nOS version: 18"));
});

test("web archive from a previous account never triggers a download", async () => {
  const delayed = deferred();
  let current = true;
  let downloads = 0;
  const web = load("services/privateFiles.web.ts", { "./binaryClient": { requestBinary: () => delayed.promise } }, { URL: { createObjectURL: () => { downloads += 1; return "blob:test"; }, revokeObjectURL: () => {} } });
  const pending = web.exportAccount("token", "a", "LB", () => current);
  current = false;
  delayed.resolve({});
  await pending;
  assert.equal(downloads, 0);
});

test("an old refreshUser cannot overwrite a newly saved canonical name", async () => {
  const scope = load("services/accountScope.ts");
  let access = null, refresh = null;
  const store = { getAccessToken: async () => access, getRefreshToken: async () => refresh, setAccessToken: async (value) => { access = value; }, setRefreshToken: async (value) => { refresh = value; }, clearTokens: async () => { access = refresh = null; } };
  const queue = load("services/authTokenQueue.ts", { "./tokenStorage": store });
  const stale = deferred();
  let hold = false;
  const auth = load("utils/authContext.tsx", {
    "@/services/authService": { login: async () => ({ access_token: "a", refresh_token: "a-refresh" }) },
    "@/services/tokenStorage": store,
    "@/services/userService": { getMe: async () => hold ? stale.promise : { ...profile, has_completed_onboarding: true } },
    "@/services/accountScope": scope,
    "@/services/authTokenQueue": queue,
    "@/services/privateFiles": { cleanupPrivateFiles: async () => {} },
  });
  let value, tree;
  function Read() { value = React.useContext(auth.AuthContext); return null; }
  await act(async () => { tree = create(React.createElement(auth.AuthProvider, null, React.createElement(Read))); });
  await act(async () => { await value.logIn({ email: "a", password: "password" }); });
  hold = true;
  let request;
  await act(async () => { request = value.refreshUser(); });
  await act(async () => { value.acceptProfileIdentity({ ...profile, preferred_name: "Canonical saved" }); });
  await act(async () => { stale.resolve({ ...profile, preferred_name: "Old server response" }); await request; });
  assert.equal(value.user.preferred_name, "Canonical saved");
  await act(async () => { tree.unmount(); });
});

test("private profile provider hides old data immediately and ignores a late avatar", async () => {
  const scope = load("services/accountScope.ts");
  const AuthContext = React.createContext(null);
  const delayedPhoto = deferred();
  const provider = load("utils/profileContext.tsx", {
    "./authContext": { AuthContext }, "@/services/accountScope": scope,
    "@/services/profileService": { getProfile: async (token) => ({ ...profile, id: token, avatar_version: token === "a" ? "a-photo" : null }), getAvatar: () => delayedPhoto.promise },
  });
  let value, tree;
  function Read() { value = provider.useProfile(); return null; }
  const acceptProfileIdentity = () => {};
  const render = (id) => React.createElement(AuthContext.Provider, { value: { token: id, user: { id }, acceptProfileIdentity } }, React.createElement(provider.ProfileProvider, null, React.createElement(Read)));
  await act(async () => { tree = create(render("a")); });
  let first;
  await act(async () => { first = value.refresh(); });
  assert.equal(value.profile.id, "a");
  scope.invalidateAccountRequests();
  await act(async () => { tree.update(render("b")); });
  assert.equal(value.profile, null); assert.equal(value.avatar, null);
  await act(async () => { await value.refresh(); });
  await act(async () => { delayedPhoto.resolve("data:image/jpeg;base64,private-a"); await first; });
  assert.equal(value.profile.id, "b"); assert.equal(value.avatar, null);
  await act(async () => { tree.unmount(); });
});

test("new native export waits for old-account file cleanup and removes its own archive after sharing", async () => {
  const listing = deferred();
  let created = 0;
  const removed = [];
  const fs = { cacheDirectory: "file:///cache/", readDirectoryAsync: () => listing.promise, deleteAsync: async (uri) => { removed.push(uri); }, makeDirectoryAsync: async () => { created += 1; }, createDownloadResumable: (_url, uri) => ({ downloadAsync: async () => ({ status: 200, uri }), cancelAsync: async () => {} }) };
  let shared = null;
  const files = load("services/privateFiles.ts", { "expo-file-system/legacy": fs, "expo-sharing": { isAvailableAsync: async () => true, shareAsync: async (uri) => { shared = uri; } }, "@/config/api": { API_BASE_URL: "http://local.invalid" }, "./httpClient": { HttpError: Error } });
  const cleanup = files.cleanupPrivateFiles();
  const download = files.exportAccount("b-token", "b", "LB", () => true);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(created, 0);
  listing.resolve(["a-old.zip"]);
  await Promise.all([cleanup, download]);
  assert.equal(created, 1);
  assert.ok(shared.includes("/b-"));
  assert.ok(removed.includes(shared));
  assert.ok(removed.includes("file:///cache/primerep-private-exports/a-old.zip"));
});

for (const failedSwitch of [true, false]) test(`pending logout clears A locally before ${failedSwitch ? "failed" : "successful"} login B`, async () => {
  const scope = load("services/accountScope.ts");
  let access = null, refresh = null;
  const store = { getAccessToken: async () => access, getRefreshToken: async () => refresh, setAccessToken: async (value) => { access = value; }, setRefreshToken: async (value) => { refresh = value; }, clearTokens: async () => { access = refresh = null; } };
  const queue = load("services/authTokenQueue.ts", { "./tokenStorage": store });
  const revocation = deferred();
  let revoked = null;
  const auth = load("utils/authContext.tsx", {
    "@/services/authService": {
      login: async ({ email }) => { if (email === "b" && failedSwitch) throw new Error("Invalid credentials"); return { access_token: email, refresh_token: `${email}-refresh` }; },
      logout: async ({ refresh_token }) => { revoked = refresh_token; await revocation.promise; },
    },
    "@/services/tokenStorage": store,
    "@/services/userService": { getMe: async (token) => ({ ...profile, id: token, has_completed_onboarding: true }) },
    "@/services/accountScope": scope,
    "@/services/authTokenQueue": queue,
    "@/services/privateFiles": { cleanupPrivateFiles: async () => {} },
  });
  let value, tree;
  function Read() { value = React.useContext(auth.AuthContext); return null; }
  await act(async () => { tree = create(React.createElement(auth.AuthProvider, null, React.createElement(Read))); });
  await act(async () => { await value.logIn({ email: "a", password: "password" }); });
  let logout;
  await act(async () => { logout = value.logOut(); });
  assert.equal(revoked, "a-refresh");
  assert.equal(refresh, null); assert.equal(access, null);
  await act(async () => {
    if (failedSwitch) await assert.rejects(value.logIn({ email: "b", password: "bad" }), /Invalid credentials/);
    else await value.logIn({ email: "b", password: "password" });
  });
  await act(async () => { revocation.resolve(); await logout; });
  assert.equal(refresh, failedSwitch ? null : "b-refresh");
  assert.equal(access, failedSwitch ? null : "b");
  await act(async () => { await value.retryBootstrap(); });
  assert.equal(value.user?.id ?? null, failedSwitch ? null : "b");
  await act(async () => { tree.unmount(); });
});
