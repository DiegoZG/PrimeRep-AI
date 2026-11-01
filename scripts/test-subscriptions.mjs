import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import ts from "typescript";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(import.meta.dirname, "..");
function loader(mocks, extra = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { React, module, exports: module.exports, console, Promise, Map, Set, Date, JSON, setTimeout, clearTimeout, AbortController, ...extra, require: (name) => {
      if (name in mocks) return mocks[name];
      if (!name.startsWith(".") && !name.startsWith("@/")) throw new Error(`Unexpected module ${name}`);
      const target = name.startsWith("@/") ? name.slice(2) : path.relative(root, path.resolve(path.dirname(filename), name));
      return load(existsSync(path.join(root, `${target}.ts`)) ? `${target}.ts` : `${target}.tsx`);
    } }, { filename });
    return module.exports;
  }
  return load;
}
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const snapshot = (changes = {}) => ({ environment: "preview", flags_version: 1, flags: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: false }, billing_status: "none", verification_status: "verified", verified_at: "2026-11-01T12:00:00Z", product_id: null, expires_at: null, grace_expires_at: null, will_renew: null, management_url: null, has_premium: false, can_start_training: true, access_source: "legacy", access_expires_at: null, transition_ends_at: null, provider_configured: true, ...changes });
const info = (active = false) => ({ entitlements: { active: active ? { premium: { productIdentifier: "monthly" } } : {} } });
const plan = { id: "monthly", productId: "monthly", term: "month", price: "$9.99", trialDays: 7 };
async function provider(options = {}) {
  const memory = options.memory ?? new Map(), calls = [], foreground = new Set(), timers = new Map();
  let timerId = 0;
  let identity = { user: { id: "A", subscription_tier: "free" }, token: "tokenA", hasCompletedOnboarding: true };
  let currentSnapshot = options.snapshot ?? snapshot(), value, listener;
  const AuthContext = React.createContext(identity);
  const routes = [];
  const router = { push: (route) => routes.push(route), replace: (route) => routes.push(route), canGoBack: () => true, back() {} };
  const mocks = {
    react: React,
    "react-native": { AppState: { addEventListener: (_event, callback) => { foreground.add(callback); return { remove: () => foreground.delete(callback) }; } }, View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", ActivityIndicator: "ActivityIndicator" },
    "expo-router": { useRouter: () => router, useSegments: () => ["(tabs)"], useFocusEffect: (callback) => React.useEffect(callback, [callback]) },
    "@/utils/authContext": { AuthContext },
    "@/services/subscriptionService": { getSubscription: async (token) => { calls.push(["get", token]); return options.get ? options.get(token) : { ...currentSnapshot }; }, reconcileSubscription: async (token) => { calls.push(["reconcile", token]); if (options.failReconcile) throw new Error("Verification unavailable"); return options.reconcile ? options.reconcile(token) : { ...currentSnapshot }; } },
    "@/services/revenueCat": { nativeBillingAvailable: () => options.supported !== false, setBillingUser: async (id) => { calls.push(["bind", id]); return id ? options.bind ? options.bind(id) : info() : null; }, listenForBillingUpdates: async (_id, callback) => { listener = callback; return () => { listener = null; }; }, getBillingPlans: async () => options.plans ?? [plan], purchaseBillingPlan: async () => { calls.push(["purchase"]); return options.purchase ? options.purchase() : "received"; }, restoreBillingPurchases: async () => { calls.push(["restore"]); return info(true); }, manageBillingSubscription: async () => { calls.push(["manage"]); } },
    "@react-native-async-storage/async-storage": { getItem: async (key) => memory.get(key) ?? null, setItem: async (key, val) => memory.set(key, val), removeItem: async (key) => memory.delete(key) },
    "@/components/workout/WorkoutText": { WorkoutText: (props) => React.createElement("Text", props) }, "@expo/vector-icons": { Ionicons: "Ionicons" }, "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@/constants/theme": { Colors: { light: { text: "#111", icon: "#666", primaryButton: "#704AFF", background: "#fff", inputBackground: "#eee", inputBorder: "#ddd" } } }, "@/hooks/use-color-scheme": { useColorScheme: () => "light" },
  };
  const load = loader(mocks, options.fakeTimers ? { setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; }, clearTimeout: (id) => timers.delete(id) } : {});
  const context = load("utils/subscriptionContext.tsx");
  mocks["@/utils/subscriptionContext"] = context;
  const Screen = options.screen ? load("components/subscriptions/SubscriptionScreen.tsx").SubscriptionScreen : options.link ? load("components/settings/SubscriptionSettingsLink.tsx").SubscriptionSettingsLink : null;
  function Probe() { value = context.useSubscription(); return Screen ? React.createElement(Screen, { paywall: true }) : null; }
  const element = () => React.createElement(AuthContext.Provider, { value: identity }, React.createElement(context.SubscriptionProvider, null, React.createElement(Probe)));
  let tree; await act(async () => { tree = create(element()); });
  const settle = async () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });
  await settle();
  return { tree, calls, routes, memory, timers, get value() { return value; }, setSnapshot: (next) => { currentSnapshot = next; }, settle,
    fireTimer: async () => { const next = [...timers][0]; if (next) { timers.delete(next[0]); await act(async () => next[1].callback()); await settle(); } },
    setAppState: async (state) => { await act(async () => { for (const callback of foreground) callback(state); }); await settle(); },
    switchUser: async (id) => { identity = { ...identity, user: { id, subscription_tier: "free" }, token: `token${id}` }; await act(async () => tree.update(element())); await settle(); },
    notify: () => load("services/subscriptionEvents.ts").notifySubscriptionRequired(), emit: () => listener?.(info(true)),
    unmount: async () => act(async () => tree.unmount()) };
}
const host = (tree, id) => tree.root.findAll((n) => typeof n.type === "string" && n.props.testID === id)[0];

test("received purchase persists through verification failure and restart without enabling duplicate checkout", async () => {
  const memory = new Map();
  let view = await provider({ failReconcile: true, memory });
  await act(async () => view.value.purchase(plan));
  assert.equal(view.value.pending.phase, "received"); assert.equal(view.value.canPurchase, false);
  assert.equal(view.calls.filter((c) => c[0] === "purchase").length, 1);
  await view.unmount();
  view = await provider({ failReconcile: true, memory });
  assert.equal(view.value.pending.phase, "received");
  await act(async () => view.value.purchase(plan));
  assert.equal(view.calls.filter((c) => c[0] === "purchase").length, 0);
  view.setSnapshot(snapshot({ has_premium: true, billing_status: "active", access_source: "subscription" }));
  await view.unmount();
  const recovered = await provider({ memory, snapshot: snapshot({ has_premium: true, billing_status: "active", access_source: "subscription" }) });
  assert.equal(recovered.value.pending, null); await recovered.unmount();
});

test("pending approval and cancelled purchases have distinct durable behavior", async () => {
  const pending = await provider({ purchase: async () => "pending" });
  await act(async () => pending.value.purchase(plan)); assert.equal(pending.value.pending.phase, "pending"); await pending.unmount();
  const cancelled = await provider({ purchase: async () => "cancelled" });
  await act(async () => cancelled.value.purchase(plan)); assert.equal(cancelled.value.pending, null); assert.equal(cancelled.calls.some((c) => c[0] === "reconcile"), false); await cancelled.unmount();
});

test("purchase flag is refreshed before checkout and rollback keeps restore operational", async () => {
  const view = await provider();
  view.setSnapshot(snapshot({ flags: { subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false } }));
  await act(async () => view.value.purchase(plan));
  assert.equal(view.calls.some((c) => c[0] === "purchase"), false);
  assert.equal(view.calls.some((c) => c[0] === "restore"), false);
  await act(async () => view.value.restore());
  assert.equal(view.calls.filter((c) => c[0] === "restore").length, 1); await view.unmount();
});

test("late account results cannot change another account subscription or pending state", async () => {
  const gate = deferred();
  const view = await provider({ get: (token) => token === "tokenA" ? gate.promise : Promise.resolve(snapshot()) });
  await view.switchUser("B");
  gate.resolve(snapshot({ has_premium: true, billing_status: "active" })); await view.settle();
  assert.equal(view.value.snapshot.has_premium, false); assert.equal(view.value.pending, null);
  await view.unmount();
});

test("provider outage never opens a paywall and repeated confirmed denials coalesce navigation", async () => {
  const view = await provider({ snapshot: snapshot({ flags: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: true }, can_start_training: null, access_source: "unknown" }) });
  await act(async () => view.notify()); assert.equal(view.routes.length, 0);
  view.setSnapshot(snapshot({ flags: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: true }, can_start_training: false, access_source: "none" }));
  await act(async () => { view.notify(); view.notify(); });
  assert.deepEqual(view.routes, ["/paywall"]); await view.unmount();
});

test("unsupported runtime never binds native billing and keeps backend data available", async () => {
  const view = await provider({ supported: false });
  assert.equal(view.value.sdkReady, false); assert.equal(view.value.canPurchase, false);
  assert.equal(view.calls.some((c) => c[0] === "bind"), false); assert.ok(view.value.snapshot); await view.unmount();
});

test("mounted paywall displays localized full annual price and has reachable dismissal and restore", async () => {
  const view = await provider({ screen: true, plans: [plan, { ...plan, id: "annual", term: "year", price: "€89,99", trialDays: null }] });
  const monthly = host(view.tree, "subscription-plan-month"); assert.ok(monthly); assert.equal(monthly.props.accessibilityState.selected, true);
  assert.ok(host(view.tree, "subscription-close")); assert.ok(host(view.tree, "subscription-restore"));
  assert.equal(host(view.tree, "subscription-purchase").props.accessibilityLabel, "Start 7-day trial");
  assert.equal(host(view.tree, "subscription-plan-year").props.accessibilityLabel, "Annual, €89,99 per year");
  await view.unmount();
});

function admission(options = {}) {
  const calls = []; let local = options.local ?? null;
  class HttpError extends Error { constructor(message, status, payload) { super(message); this.status = status; this.code = payload?.code; } }
  class PreWorkoutOrderConflict extends Error {}
  const load = loader({
    "@/utils/activeWorkoutStore": { loadActiveWorkout: async () => local, saveActiveWorkout: async (next) => { local = next; } },
    "@/utils/preWorkoutOrderStore": { PreWorkoutOrderConflict, prepareWorkoutStart: async (_user, workout, session) => { calls.push("prepare"); local ??= { workoutDayId: workout.workoutDayId, workoutDate: "2026-11-01", dayType: "upper", clientSessionId: "durable-id", revision: 0 }; return session ? { ...local, serverSessionId: session.id } : local; } },
    "./featureFlagService": { getFeatureFlags: async () => { calls.push("flags"); if (options.fail) throw new Error("Offline"); return { flags: { subscriptions_enforcement_enabled: Boolean(options.enforce) } }; } },
    "./httpClient": { HttpError }, "./workoutLoggingService": { createSession: async (...args) => { calls.push(args); return { id: "admitted" }; } },
  });
  return { ensure: load("services/workoutAdmission.ts").ensureWorkoutAdmission, calls, get local() { return local; } };
}

test("new enforced session uses durable client identity and admits before returning", async () => {
  const view = admission({ enforce: true });
  const result = await view.ensure("token", "A", { workoutDayId: "day" }, () => true);
  assert.equal(result.id, "admitted"); assert.equal(view.calls.find(Array.isArray).at(-1), "durable-id"); assert.equal(view.local.serverSessionId, "admitted");
});

test("unknown flags preserve new-start uncertainty without creating a local session", async () => {
  const view = admission({ fail: true });
  await assert.rejects(view.ensure("token", "A", { workoutDayId: "day" }, () => true), (e) => e.code === "subscription_verification_unavailable");
  assert.equal(view.local, null); assert.deepEqual(view.calls, ["flags"]);
});

test("admitted session resumes offline without any flag or provider call", async () => {
  const view = admission({ local: { serverSessionId: "session" }, fail: true });
  assert.equal(await view.ensure(null, "A", { workoutDayId: "day" }, () => true), null); assert.deepEqual(view.calls, []);
});

test("flags off retain legacy local-start behavior and stale identity cannot create", async () => {
  const view = admission();
  assert.equal(await view.ensure("token", "A", { workoutDayId: "day" }, () => true), null); assert.deepEqual(view.calls, ["flags"]);
  const stale = admission({ enforce: true });
  await stale.ensure("token", "A", { workoutDayId: "day" }, () => false); assert.deepEqual(stale.calls, []);
});

test("HTTP subscription codes preserve readable errors and stale accounts cannot trigger paywalls", async () => {
  const gate = deferred(); let response = gate.promise;
  const load = loader({ "@/config/api": { API_BASE_URL: "https://api.example.test" } }, { fetch: () => response });
  const { requestJson } = load("services/httpClient.ts");
  const { invalidateAccountRequests } = load("services/accountScope.ts");
  let prompts = 0; load("services/subscriptionEvents.ts").onSubscriptionRequired(() => { prompts++; });
  const request = requestJson("/v1/programs", { method: "POST", token: "A" });
  invalidateAccountRequests();
  gate.resolve({ ok: false, status: 403, text: async () => JSON.stringify({ code: "subscription_required", detail: "Subscribe to create a program." }) });
  await assert.rejects(request, (error) => error.code === "subscription_required" && error.message === "Subscribe to create a program.");
  assert.equal(prompts, 0);
  response = Promise.resolve({ ok: false, status: 403, text: async () => JSON.stringify({ detail: { code: "subscription_required", message: "Subscription needed" } }) });
  await assert.rejects(requestJson("/v1/programs", { method: "POST" }), (error) => error.code === "subscription_required" && error.message === "Subscription needed");
  assert.equal(prompts, 1);
  response = Promise.resolve({ ok: false, status: 503, text: async () => JSON.stringify({ code: "subscription_verification_unavailable", detail: "Try again" }) });
  await assert.rejects(requestJson("/v1/programs", { method: "POST" })); assert.equal(prompts, 1);
});

test("known disabled enforcement permits legacy local drafts offline but never survives account invalidation", async () => {
  const load = loader({});
  const flags = load("services/subscriptionFlagState.ts");
  flags.rememberSubscriptionFlags("A", { subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false });
  assert.equal(flags.knownSubscriptionFlags("A").subscriptions_enforcement_enabled, false);
  assert.equal(flags.knownSubscriptionFlags("B"), null);
  load("services/accountScope.ts").invalidateAccountRequests();
  assert.equal(flags.knownSubscriptionFlags("A"), null);
});

function nativeAdapter(options = {}) {
  let bound = null; const calls = [], listeners = new Set(); const started = deferred(), finish = deferred();
  const monthly = { identifier: "monthly", product: { identifier: "product.month", priceString: "€8,99", introPrice: { price: 0, periodUnit: "DAY", periodNumberOfUnits: 7, cycles: 1 } } };
  const annual = { identifier: "annual", product: { identifier: "product.year", priceString: "€89,99", introPrice: { price: 0, periodUnit: "DAY", periodNumberOfUnits: 7, cycles: 1 } } };
  const sdk = {
    configure: ({ appUserID }) => { calls.push(["configure", appUserID]); bound = appUserID; },
    logIn: async (id) => { calls.push(["login", id]); bound = id; }, logOut: async () => { calls.push(["logout"]); bound = null; }, getAppUserID: async () => bound,
    getCustomerInfo: async () => info(), getOfferings: async () => ({ current: { monthly, annual } }),
    checkTrialOrIntroductoryPriceEligibility: async () => ({ "product.month": { status: 2 }, "product.year": { status: 0 } }),
    purchasePackage: async (choice) => { calls.push(["purchase", bound, choice.identifier]); started.resolve(); if (options.hold) await finish.promise; return { customerInfo: info(true) }; },
    restorePurchases: async () => { calls.push(["restore", bound]); return info(true); }, showManageSubscriptions: async () => {},
    addCustomerInfoUpdateListener: (fn) => listeners.add(fn), removeCustomerInfoUpdateListener: (fn) => listeners.delete(fn),
  };
  const load = loader({ "react-native": { Platform: { OS: options.platform ?? "ios" } }, "expo-constants": { __esModule: true, default: { appOwnership: options.expoGo ? "expo" : "standalone" } }, "react-native-purchases": { __esModule: true, default: sdk } }, { process: { env: { EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY: options.key ?? "appl_public", EXPO_PUBLIC_BILLING_ENV: options.environment ?? "preview" } } });
  return { adapter: load("services/revenueCat.ts"), calls, started, finish, listeners };
}

test("native adapter loads configured packages with store prices and never promises an unknown trial", async () => {
  const { adapter, calls } = nativeAdapter();
  await adapter.setBillingUser("A"); const plans = await adapter.getBillingPlans("A");
  assert.equal(plans[0].price, "€8,99"); assert.equal(plans[0].trialDays, 7);
  assert.equal(plans[1].price, "€89,99"); assert.equal(plans[1].trialDays, null);
  assert.deepEqual(calls[0], ["configure", "A"]);
});

test("native identity transition waits for an open purchase and rejects its stale UI result", async () => {
  const { adapter, calls, started, finish } = nativeAdapter({ hold: true });
  await adapter.setBillingUser("A"); await adapter.getBillingPlans("A");
  const purchase = adapter.purchaseBillingPlan("A", "monthly");
  await started.promise;
  const binding = adapter.setBillingUser("B");
  assert.equal(calls.some((call) => call[0] === "login"), false);
  finish.resolve(); await assert.rejects(purchase, /account changed/); await binding;
  assert.deepEqual(calls.at(-1), ["login", "B"]);
  await assert.rejects(adapter.purchaseBillingPlan("A", "monthly"), /unavailable/);
});

test("Expo Go, web, Android, missing keys and production Test Store keys cannot initialize native purchases", async () => {
  for (const options of [{ expoGo: true }, { platform: "web" }, { platform: "android" }, { key: "" }, { key: "test_testing", environment: "production" }]) {
    const { adapter, calls } = nativeAdapter(options);
    assert.equal(adapter.nativeBillingAvailable(), false);
    await assert.rejects(adapter.setBillingUser("A")); assert.equal(calls.length, 0);
  }
});

test("queued native operations from an old account epoch cannot survive A to B to A", async () => {
  const { adapter, calls, started, finish } = nativeAdapter({ hold: true });
  await adapter.setBillingUser("A"); await adapter.getBillingPlans("A");
  const running = adapter.purchaseBillingPlan("A", "monthly");
  const runningResult = Promise.allSettled([running]);
  await started.promise;
  const stale = Promise.allSettled([adapter.purchaseBillingPlan("A", "monthly"), adapter.restoreBillingPurchases("A"), adapter.manageBillingSubscription("A")]);
  const middle = adapter.setBillingUser("B").catch(() => null);
  const latest = adapter.setBillingUser("A");
  finish.resolve();
  await runningResult; await middle; await latest;
  const results = await stale;
  assert.ok(results.every((result) => result.status === "rejected"));
  assert.equal(calls.filter((call) => call[0] === "purchase").length, 1);
  assert.equal(calls.filter((call) => call[0] === "restore").length, 0);
});

test("stale premium GET cannot clear a later payment recovery after newer reconciliation", async () => {
  const gate = deferred();
  const view = await provider({ get: () => gate.promise, bind: async () => info(true), reconcile: async () => snapshot({ billing_status: "expired", access_source: "none", can_start_training: false }) });
  assert.equal(view.value.pending.phase, "received");
  gate.resolve(snapshot({ has_premium: true, billing_status: "active" })); await view.settle();
  assert.equal(view.value.snapshot.billing_status, "expired");
  assert.equal(view.value.pending.phase, "received"); await view.unmount();
});

test("pending payment uses bounded GET recovery and suspends it in the background", async () => {
  const view = await provider({ fakeTimers: true, failReconcile: true });
  await act(async () => view.value.purchase(plan));
  const posts = view.calls.filter((call) => call[0] === "reconcile").length;
  const gets = view.calls.filter((call) => call[0] === "get").length;
  assert.equal(view.timers.size, 1);
  for (let i = 0; i < 6; i++) await view.fireTimer();
  assert.equal(view.calls.filter((call) => call[0] === "get").length, gets + 6);
  assert.equal(view.calls.filter((call) => call[0] === "reconcile").length, posts);
  assert.equal(view.timers.size, 0);
  await view.setAppState("background"); assert.equal(view.timers.size, 0);
  await view.setAppState("active"); assert.equal(view.timers.size, 1);
  view.setSnapshot(snapshot({ has_premium: true, billing_status: "active" }));
  await view.fireTimer(); assert.equal(view.value.pending, null); assert.equal(view.timers.size, 0);
  await view.unmount();
});

test("restore with unknown verification never claims that no active subscription exists", async () => {
  const view = await provider({ reconcile: async () => snapshot({ verification_status: "unavailable", billing_status: "unknown", can_start_training: null, access_source: "unknown" }) });
  await act(async () => view.value.restore());
  assert.equal(view.value.pending.phase, "received");
  assert.match(view.value.notice, /needs verification/); await view.unmount();
});

test("account deletion clears an in-flight pending purchase write and prevents later resurrection", async () => {
  const gate = deferred(), started = deferred(), memory = new Map();
  const load = loader({ "@react-native-async-storage/async-storage": { getItem: async (key) => memory.get(key) ?? null, setItem: async (key, value) => { started.resolve(); await gate.promise; memory.set(key, value); }, removeItem: async (key) => memory.delete(key) } });
  const store = load("utils/pendingPurchase.ts");
  const saving = store.savePendingPurchase("A", { phase: "received", productId: "monthly" });
  await started.promise;
  const clearing = store.clearPendingPurchaseForUser("A");
  gate.resolve(); await saving; await clearing;
  await store.savePendingPurchase("A", { phase: "received", productId: "monthly" });
  assert.equal(await store.loadPendingPurchase("A"), null); assert.equal(memory.size, 0);
});

test("fresh verified absence permits explicit notice recovery but unknown access cannot clear it", async () => {
  const pending = new Map([["@primerep/pending-purchase/A", JSON.stringify({ phase: "pending", productId: "monthly" })]]);
  const view = await provider({ memory: pending, supported: false });
  assert.equal(view.value.canClearPending, true);
  view.setSnapshot(snapshot({ verification_status: "unavailable", billing_status: "unknown", can_start_training: null }));
  await act(async () => view.value.clearPending());
  assert.ok(view.value.pending); assert.equal(view.value.canClearPending, false);
  view.setSnapshot(snapshot({ billing_status: "expired" }));
  await act(async () => view.value.clearPending());
  assert.equal(view.value.pending, null); assert.equal(pending.size, 0);
  await view.unmount();
});

test("late notice-clear verification cannot remove another account recovery state", async () => {
  const gate = deferred(); let hold = false;
  const memory = new Map([["@primerep/pending-purchase/A", JSON.stringify({ phase: "received", productId: "monthly" })]]);
  const view = await provider({ memory, reconcile: () => hold ? gate.promise : Promise.resolve(snapshot()) });
  hold = true;
  let clearing; await act(async () => { clearing = view.value.clearPending(); });
  await view.switchUser("B");
  gate.resolve(snapshot()); await act(async () => clearing);
  assert.equal(view.value.pending, null); assert.ok(memory.has("@primerep/pending-purchase/A"));
  await view.unmount();
});

test("configured iOS restore entry stays reachable with both flags off and no known entitlement", async () => {
  const disabled = snapshot({ flags: { subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false } });
  const view = await provider({ link: true, snapshot: disabled });
  assert.ok(host(view.tree, "settings-subscription")); await view.unmount();
  const unconfigured = await provider({ link: true, snapshot: disabled, supported: false });
  assert.equal(host(unconfigured.tree, "settings-subscription"), undefined); await unconfigured.unmount();
});

test("superseded notice-clear reconciliation cannot clear recovery after newer unknown verification", async () => {
  const gate = deferred(); let hold = false;
  const memory = new Map([["@primerep/pending-purchase/A", JSON.stringify({ phase: "received", productId: "monthly" })]]);
  const view = await provider({ memory, supported: false, reconcile: () => hold ? gate.promise : Promise.resolve(snapshot()) });
  hold = true;
  let clearing; await act(async () => { clearing = view.value.clearPending(); });
  view.setSnapshot(snapshot({ verification_status: "unavailable", billing_status: "unknown", can_start_training: null }));
  await act(async () => view.value.refresh());
  gate.resolve(snapshot()); await act(async () => clearing);
  assert.equal(view.value.snapshot.verification_status, "unavailable");
  assert.equal(view.value.pending.phase, "received"); assert.ok(memory.has("@primerep/pending-purchase/A"));
  await view.unmount();
});

test("superseded checkout GET cannot purchase after newer reconciliation disables sales", async () => {
  const gate = deferred(); let hold = false;
  const view = await provider({ get: () => hold ? gate.promise : Promise.resolve(snapshot()) });
  hold = true;
  let buying; await act(async () => { buying = view.value.purchase(plan); });
  view.setSnapshot(snapshot({ flags: { subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false } }));
  await act(async () => view.value.refresh(true));
  gate.resolve(snapshot()); await act(async () => buying);
  assert.equal(view.value.snapshot.flags.subscriptions_purchases_enabled, false);
  assert.equal(view.calls.some((call) => call[0] === "purchase"), false);
  await view.unmount();
});

test("program cancellation services accept metadata-only 204 responses", async () => {
  const requests = [];
  const load = loader({ "@/config/api": { API_BASE_URL: "https://api.example.test" }, "expo-modules-core": { uuid: { v4: () => "id" } }, "./exerciseService": { mapApiItemToExercise: (item) => item } }, { fetch: async (url, options) => { requests.push([url, options.method]); return { ok: true, status: 204, text: async () => "" }; } });
  const service = load("services/programService.ts");
  assert.equal(await service.deactivateProgram("A", { weekStart: "2026-11-01", effectiveDate: "2026-11-01" }), null);
  assert.equal(await service.cancelScheduledProgram("A", "2026-11-01"), undefined);
  assert.equal(requests.length, 2); assert.ok(requests.every(([, method]) => method === "DELETE"));
});
