import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";
import ts from "typescript";
import { loadTypescript } from "./helpers/load-typescript.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
async function harness(options = {}) {
  const AuthContext = React.createContext(null), actors = [], calls = [], intervals = new Map(), timeouts = new Map(), events = new Map();
  const bridge = loadTypescript("utils/workoutDiagnosticsBridge.ts");
  let clock = 1_794_081_600_000, generation = 0, sequence = 0, state = "active", route = ["workout", "active"];
  let auth = { token: "tokenA", isLoggedIn: true, user: { id: "A" } };
  const Clock = class extends Date { static now() { return clock; } };
  class Actor {
    constructor(deps) { this.deps = deps; this.signals = []; this.enabled = false; actors.push(this); }
    isEnabled() { return this.enabled && this.deps.current(); }
    credentialsChanged() { this.credentials = (this.credentials ?? 0) + 1; }
    setEnabled(value) { this.enabled = value; }
    setForeground(value) { this.foreground = value; }
    async initialize() { if (options.initialize) await options.initialize.promise; }
    capture(signal) { if (this.isEnabled()) this.signals.push(signal); }
    tick() { this.ticks = (this.ticks ?? 0) + 1; }
  }
  const mocks = {
    react: React, "expo-router": { useSegments: () => route }, "react-native": { Platform: { OS: "ios" }, AppState: { currentState: state, addEventListener: (_type, listener) => { events.set("state", listener); return { remove: () => events.delete("state") }; } } },
    "expo-constants": { __esModule: true, default: { expoConfig: { version: "1.2.0" } } }, "@react-native-async-storage/async-storage": { __esModule: true, default: {} },
    "@/config/api": { API_BASE_URL: "http://preview.invalid" }, "@/services/accountScope": { accountGeneration: () => generation, accountRequestGuard: () => { const start = generation; return () => start === generation; } },
    "@/services/workoutDiagnostics": { WorkoutDiagnostics: Actor }, "./authContext": { AuthContext }, "./activeWorkoutStore": { loadActiveWorkout: async (owner) => calls.push({ loadOwner: owner }) }, "./workoutDiagnosticsBridge": bridge,
  };
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL("../utils/workoutDiagnosticsSync.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: (name) => { if (!(name in mocks)) throw new Error(`Unexpected import ${name}`); return mocks[name]; },
    Date: Clock, Math, Promise, AbortController, encodeURIComponent,
    setInterval: (callback) => { const id = ++sequence; intervals.set(id, callback); return id; }, clearInterval: (id) => intervals.delete(id),
    setTimeout: (callback) => { const id = ++sequence; timeouts.set(id, callback); return id; }, clearTimeout: (id) => timeouts.delete(id),
    fetch: async (url, request) => { calls.push({ url, request }); return options.fetch ? options.fetch(url, request) : { ok: true, json: async () => ({ environment: "preview", flags: { workout_reliability_monitoring_enabled: true, subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false } }) }; },
  });
  const Component = module.exports.WorkoutDiagnosticsSync;
  const element = () => React.createElement(AuthContext.Provider, { value: auth }, React.createElement(Component));
  let tree; await act(async () => { tree = create(element()); });
  const settle = async () => { await act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); }); };
  await settle();
  return { actors, calls, bridge, timeouts, settle,
    tick: async (ms = 60_000) => { clock += ms; for (const callback of intervals.values()) callback(); await settle(); },
    route: async (next) => { route = next; await act(async () => tree.update(element())); await settle(); },
    refreshToken: async (token) => { auth = { ...auth, token }; await act(async () => tree.update(element())); await settle(); },
    auth: async (id, token) => { generation++; auth = { user: id ? { id } : null, token, isLoggedIn: Boolean(id) }; await act(async () => tree.update(element())); await settle(); },
    appState: async (next) => { state = next; events.get("state")?.(next); await settle(); },
    close: async () => { await act(async () => tree.unmount()); },
  };
}

test("monitoring fetches owned flags independently of every subscription flag and scopes the sidecar", async () => {
  const h = await harness();
  assert.equal(h.actors.length, 1); assert.equal(h.actors[0].enabled, true);
  assert.equal(h.calls.filter(({ url }) => url).length, 1); assert.match(h.calls[0].url, /\/v1\/feature-flags$/);
  assert.equal(h.calls[0].request.headers.Authorization, "Bearer tokenA"); assert.match(h.actors[0].deps.storageKey, /preview\.A$/);
  assert.ok(h.actors[0].signals.some((signal) => signal.kind === "player" && signal.active)); await h.close();
});

test("legacy or disabled flags do not initialize storage/runtime and cannot depend on a paid tier", async () => {
  const h = await harness({ fetch: async () => ({ ok: true, json: async () => ({ environment: "preview", flags: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: true } }) }) });
  assert.equal(h.actors.length, 0); assert.equal(h.calls.some(({ loadOwner }) => loadOwner), false); await h.close();
});

test("delayed initialization uses latest player route and checks actual rollback state", async () => {
  const gate = deferred(); let enabled = true;
  const h = await harness({ initialize: gate, fetch: async () => ({ ok: true, json: async () => ({ environment: "preview", flags: { workout_reliability_monitoring_enabled: enabled } }) }) });
  await h.route(["(tabs)"]); gate.resolve(); await h.settle();
  assert.equal(h.actors[0].signals.filter((signal) => signal.kind === "player").at(-1).active, false);
  enabled = false; await h.tick(); assert.equal(h.actors[0].enabled, false); await h.close();
  const pending = deferred(); enabled = true;
  const other = await harness({ initialize: pending, fetch: async () => ({ ok: true, json: async () => ({ environment: "preview", flags: { workout_reliability_monitoring_enabled: enabled } }) }) });
  enabled = false; await other.tick(); pending.resolve(); await other.settle();
  assert.equal(other.calls.some(({ loadOwner }) => loadOwner), false); await other.close();
});

test("late account A flags and environment ABA callbacks cannot act for the new ownership epoch", async () => {
  const gate = deferred(); let first = true, environment = "preview";
  const h = await harness({ fetch: async () => { if (first) { first = false; await gate.promise; } return { ok: true, json: async () => ({ environment, flags: { workout_reliability_monitoring_enabled: true } }) }; } });
  await h.auth("B", "tokenB"); await h.auth("A", "tokenA-new"); gate.resolve(); await h.settle();
  assert.equal(h.actors.length, 2); assert.equal(h.actors[0].deps.current(), false); assert.equal(h.actors[1].deps.current(), true);
  const a1 = h.actors[1]; environment = "production"; await h.tick(); environment = "preview"; await h.tick();
  assert.equal(a1.deps.current(), false); assert.equal(h.actors.at(-1).deps.current(), true); await h.close();
});

test("auth failures suspend flag requests without refresh/logout; normal token change resumes", async () => {
  let valid = false;
  const h = await harness({ fetch: async () => valid ? { ok: true, json: async () => ({ environment: "preview", flags: { workout_reliability_monitoring_enabled: true } }) } : { ok: false, status: 401 } });
  await h.tick(120_000); await h.appState("background"); await h.appState("active");
  assert.equal(h.calls.filter(({ url }) => url).length, 1); valid = true; await h.auth("A", "fresh"); assert.equal(h.actors.length, 1); await h.close();
});

test("background pauses diagnostic actor delivery and flags; foreground refreshes promptly", async () => {
  const h = await harness(); await h.appState("background"); await h.tick(120_000); assert.equal(h.calls.filter(({ url }) => url).length, 1);
  assert.equal(h.actors[0].foreground, false); await h.appState("active"); assert.equal(h.calls.filter(({ url }) => url).length, 2); assert.equal(h.actors[0].foreground, true); await h.close();
});

test("same-account token refresh keeps in-flight business observer and process run identity", async () => {
  const h = await harness(); const actor = h.actors[0]; const diagnostics = h.bridge.workoutDiagnostics("A"), gate = deferred();
  const request = diagnostics.request({ id: "pending", type: "set" }, () => gate.promise);
  await h.refreshToken("freshA"); assert.equal(h.actors.length, 1); assert.equal(actor.deps.current(), true); assert.equal(actor.credentials, 1);
  gate.resolve("logged"); await request; await h.settle();
  assert.ok(actor.signals.some((signal) => signal.kind === "request" && signal.phase === "success"));
  await h.auth("B", "tokenB"); assert.equal(h.actors[1].deps.runId, actor.deps.runId); assert.equal(actor.deps.current(), false); await h.close();
});

test("direct diagnostic transport aborts a stalled request without auth or subscription side effects", async () => {
  const gate = deferred(); const h = await harness({ fetch: () => gate.promise });
  assert.equal(h.calls[0].request.signal.aborted, false);
  for (const callback of [...h.timeouts.values()]) callback(); await h.settle();
  assert.equal(h.calls[0].request.signal.aborted, true); assert.equal(h.actors.length, 0);
  await h.tick(2_000); assert.equal(h.calls.filter(({ url }) => url).length, 1);
  gate.resolve({ ok: true, json: async () => ({ environment: "preview", flags: { workout_reliability_monitoring_enabled: true } }) }); await h.settle();
  assert.equal(h.actors.length, 0); await h.close();
});

test("delivery reads a fresh owned token and a superseded-token auth failure cannot suspend it", async () => {
  const gate = deferred();
  const h = await harness({ fetch: async (url) => url.endsWith("/workout-sync") ? gate.promise : { ok: true, json: async () => ({ environment: "preview", flags: { workout_reliability_monitoring_enabled: true } }) } });
  const actor = h.actors[0];
  const sending = actor.deps.send({ schema_version: 1, platform: "ios", app_version: "1.0.0", events: [] }).catch((error) => error);
  await h.refreshToken("freshA"); gate.resolve({ ok: false, status: 401 });
  const error = await sending; assert.equal(error.status, undefined); assert.match(error.message, /credential changed/);
  const next = actor.deps.send({ schema_version: 1, platform: "ios", app_version: "1.0.0", events: [] }).catch(() => {}); await next;
  assert.equal(h.calls.filter(({ url }) => url?.endsWith("/workout-sync")).at(-1).request.headers.Authorization, "Bearer freshA");
  await h.auth("B", "tokenB"); const count = h.calls.length;
  await assert.rejects(actor.deps.send({})); assert.equal(h.calls.length, count); await h.close();
});
