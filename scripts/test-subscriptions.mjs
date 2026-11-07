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
class HttpError extends Error { constructor(message, status) { super(message); this.status = status; } }
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const snapshot = (changes = {}) => ({ environment: "preview", flags_version: 1, flags: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: false }, billing_status: "none", verification_status: "verified", verified_at: "2026-11-01T12:00:00Z", product_id: null, expires_at: null, grace_expires_at: null, will_renew: null, management_url: null, has_premium: false, can_start_training: true, access_source: "legacy", access_expires_at: null, transition_ends_at: null, provider_configured: true, ...changes });
const info = (active = false) => ({ entitlements: { active: active ? { premium: { productIdentifier: "monthly" } } : {} } });
const plan = { id: "monthly", productId: "monthly", term: "month", price: "$9.99", trialDays: 7 };
async function provider(options = {}) {
  const memory = options.memory ?? new Map(), calls = [], foreground = new Set(), timers = new Map();
  let timerId = 0, readingScale = options.fontScale ?? 1;
  let identity = { user: { id: "A", subscription_tier: "free", onboarding_subscription_required: options.onboardingHint ?? false }, token: "tokenA", hasCompletedOnboarding: true };
  let currentSnapshot = options.snapshot ?? snapshot(), value, listener;
  const AuthContext = React.createContext(identity);
  identity.refreshUser = async () => { calls.push(["refreshUser"]); if (options.refreshUser) await options.refreshUser(); };
  identity.logOut = async (value) => { calls.push(["logout", value]); if (options.logOut) await options.logOut(value); };
  const routes = [];
  const router = { push: (route) => routes.push(route), replace: (route) => routes.push(route), canGoBack: () => true, back() {} };
  const mocks = {
    react: React,
    "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle", Path: "Path", Rect: "Rect" },
    "react-native-reanimated": { default: { View: "AnimatedView", createAnimatedComponent: component => component }, __esModule: true,
      ReduceMotion: { System: "system" }, useReducedMotion: () => options.reducedMotion ?? false,
      useSharedValue: value => React.useRef({ value }).current, useAnimatedStyle: callback => callback(), useAnimatedProps: callback => callback(),
      cancelAnimation() {}, withDelay: (delay, value) => { calls.push(["animationDelay", delay]); return value; },
      withTiming: (value, config) => { calls.push(["animation", config]); return value; }, Easing: { out: value => value, cubic: value => value } },
    "react-native": { Alert: { alert: (...args) => calls.push(["alert", ...args]) }, BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: (_event, callback) => { foreground.add(callback); return { remove: () => foreground.delete(callback) }; } }, View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", ActivityIndicator: "ActivityIndicator", useWindowDimensions: () => ({ fontScale: readingScale }), StyleSheet: { create: (styles) => styles, hairlineWidth: 0.5 } },
    "expo-router": { useRouter: () => router, useSegments: () => ["(tabs)"], useFocusEffect: (callback) => React.useEffect(callback, [callback]) },
    "@/utils/authContext": { AuthContext },
    "@/services/httpClient": { HttpError },
    "@/utils/notificationsContext": { NotificationsContext: React.createContext({ unregisterCurrentDevice: async token => { calls.push(["unregister", token]); if (options.unregister) await options.unregister(); } }) },
    "@/services/userService": { deleteAccount: async token => { calls.push(["delete", token]); if (options.deleteAccount) await options.deleteAccount(); } },
    "@/services/health/exportSync": { pauseHealthExport: owner => calls.push(["pauseExport", owner]), resumeHealthExport: owner => calls.push(["resumeExport", owner]), waitForHealthExportIdle: async () => calls.push(["waitExport"]) },
    "@/utils/healthExportAccountCleanup": { clearHealthExportAccount: async owner => calls.push(["clearHealth", owner]) },
    "@/utils/preWorkoutOrderStore": { clearPreWorkoutOrdersForUser: async owner => calls.push(["clearOrders", owner]) },
    "@/utils/workoutLayoutPreference": { clearWorkoutLayoutForUser: async owner => calls.push(["clearLayout", owner]) },
    "@/services/subscriptionService": { getSubscription: async (token) => { calls.push(["get", token]); return options.get ? options.get(token) : { ...currentSnapshot }; }, reconcileSubscription: async (token) => { calls.push(["reconcile", token]); if (options.failReconcile) throw new Error("Verification unavailable"); return options.reconcile ? options.reconcile(token) : { ...currentSnapshot }; } },
    "@/services/revenueCat": { nativeBillingAvailable: () => options.supported !== false, setBillingUser: async (id) => { calls.push(["bind", id]); return id ? options.bind ? options.bind(id) : info() : null; }, listenForBillingUpdates: async (id, callback) => { calls.push(["listen", id]); listener = callback; return () => { listener = null; }; }, getBillingPlans: async id => { calls.push(["plans", id]); return options.offerings ? options.offerings(id) : options.plans ?? [plan]; }, purchaseBillingPlan: async () => { calls.push(["purchase"]); return options.purchase ? options.purchase() : "received"; }, restoreBillingPurchases: async () => { calls.push(["restore"]); return info(true); }, manageBillingSubscription: async () => { calls.push(["manage"]); } },
    "@react-native-async-storage/async-storage": { getItem: async (key) => options.readPending ? options.readPending(key, memory) : memory.get(key) ?? null, setItem: async (key, val) => memory.set(key, val), removeItem: async (key) => memory.delete(key) },
    "@/components/workout/WorkoutText": { WorkoutText: (props) => React.createElement("Text", props) }, "@expo/vector-icons": { Ionicons: "Ionicons" }, "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@/constants/theme": { Colors: { light: { text: "#111", icon: "#666", primaryButton: "#704AFF", background: "#fff", inputBackground: "#eee", inputBorder: "#ddd" }, dark: { text: "#eee", icon: "#aaa", primaryButton: "#704AFF", background: "#151718", inputBackground: "#1f1f1f", inputBorder: "#3a3a3a" } } }, "@/hooks/use-color-scheme": { useColorScheme: () => options.scheme ?? "light" },
  };
  const load = loader(mocks, options.fakeTimers ? { setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; }, clearTimeout: (id) => timers.delete(id) } : {});
  const context = load("utils/subscriptionContext.tsx");
  mocks["@/utils/subscriptionContext"] = context;
  const Screen = options.accountScreen ? load("app/onboarding-account.tsx").default : options.onboardingScreen ? load("components/subscriptions/OnboardingSubscriptionScreen.tsx").OnboardingSubscriptionScreen : options.screen ? load("components/subscriptions/SubscriptionScreen.tsx").SubscriptionScreen : options.link ? load("components/settings/SubscriptionSettingsLink.tsx").SubscriptionSettingsLink : null;
  function Probe() { value = context.useSubscription(); return Screen ? React.createElement(Screen, { paywall: options.paywall ?? true }) : null; }
  const element = () => React.createElement(AuthContext.Provider, { value: identity }, React.createElement(context.SubscriptionProvider, null, React.createElement(Probe)));
  let tree; await act(async () => { tree = create(element()); });
  const settle = async () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });
  await settle();
  return { tree, calls, routes, memory, timers, get value() { return value; }, setSnapshot: (next) => { currentSnapshot = next; }, settle,
    fireTimer: async () => { const next = [...timers][0]; if (next) { timers.delete(next[0]); await act(async () => next[1].callback()); await settle(); } },
    setAppState: async (state) => { await act(async () => { for (const callback of foreground) callback(state); }); await settle(); },
    setFontScale: async (scale) => { readingScale = scale; await act(async () => tree.update(element())); await settle(); },
    renewToken: async (token) => { identity = { ...identity, token }; await act(async () => tree.update(element())); await settle(); },
    switchUser: async (id) => { load("services/accountScope.ts").invalidateAccountRequests(); identity = { ...identity, user: { id, subscription_tier: "free" }, token: `token${id}` }; await act(async () => tree.update(element())); await settle(); },
    notify: () => load("services/subscriptionEvents.ts").notifySubscriptionRequired(), emit: () => listener?.(info(true)),
    unmount: async () => act(async () => tree.unmount()) };
}
const host = (tree, id) => tree.root.findAll((n) => typeof n.type === "string" && n.props.testID === id)[0];
const textOf = (node) => typeof node === "string" ? node : (Array.isArray(node) ? node : node?.children ?? []).map(textOf).join("");

const onboardingSnapshot = (changes = {}) => snapshot({ onboarding_subscription_required: true, flags: { subscriptions_purchases_enabled: true, subscriptions_enforcement_enabled: true, subscriptions_onboarding_enabled: true }, can_start_training: false, access_source: "none", ...changes });

test("onboarding bootstrap hint survives failed verification and is isolated from another account", async () => {
  const view = await provider({ onboardingHint: true, get: async () => { throw new Error("Offline"); } });
  assert.equal(view.value.onboardingRequired, true);
  await view.switchUser("B");
  assert.equal(view.value.onboardingRequired, false);
  await view.unmount();
  const legacy = await provider();
  assert.equal(legacy.value.onboardingRequired, false);
  await legacy.unmount();
});

test("required onboarding suppresses generic paywalls, refreshes in foreground, and releases on rollback", async () => {
  const view = await provider({ snapshot: onboardingSnapshot(), fakeTimers: true });
  assert.equal(view.value.onboardingRequired, true);
  await act(async () => view.notify());
  assert.deepEqual(view.routes, []);
  assert.equal([...view.timers.values()][0].delay, 15000);
  await view.setAppState("background");
  assert.equal(view.timers.size, 0);
  await view.setAppState("active");
  view.setSnapshot(snapshot());
  await view.fireTimer();
  assert.equal(view.value.onboardingRequired, false);
  assert.equal(view.timers.size, 0);
  await view.unmount();
});

test("onboarding presentation uses shared plans with monthly default and keeps recovery actions reachable", async () => {
  const view = await provider({ onboardingScreen: true, snapshot: onboardingSnapshot(), plans: [plan, { ...plan, id: "annual", term: "year", price: "$79.99", trialDays: null }] });
  assert.match(textOf(view.tree.toJSON()), /Your training starts here\./);
  assert.equal(host(view.tree, "subscription-plan-month").props.accessibilityState.selected, true);
  assert.equal(host(view.tree, "subscription-purchase").props.accessibilityLabel, "Start 7-day trial");
  assert.ok(host(view.tree, "onboarding-account-options"));
  assert.ok(host(view.tree, "subscription-restore"));
  assert.equal(host(view.tree, "subscription-close"), undefined);
  await act(async () => host(view.tree, "subscription-plan-year").props.onPress());
  assert.equal(host(view.tree, "subscription-purchase").props.accessibilityLabel, "Subscribe");
  assert.match(textOf(view.tree.toJSON()), /\$79.99 per year/);
  await view.setFontScale(3.1);
  const scroll = host(view.tree, "onboarding-subscription-scroll");
  assert.equal(scroll.findAll(n => n.props.testID === "onboarding-subscription-checkout").length, 1);
  assert.equal(host(view.tree, "subscription-plan-year").props.accessibilityState.selected, true);
  const brand = view.tree.root.findAllByType("Text").find(node => textOf(node) === "PrimeRep");
  assert.equal(brand.props.allowFontScaling, false);
  assert.equal(Object.assign({}, ...brand.props.style.flat(Infinity)).fontSize, 30);
  await view.unmount();
});

test("reduced motion keeps current benefits and the future preview visible without animations", async () => {
  const view = await provider({ onboardingScreen: true, reducedMotion: true, snapshot: onboardingSnapshot() });
  const animated = view.tree.root.findAll(node => node.type === "AnimatedView");
  assert.ok(animated.length > 0);
  assert.equal(view.calls.some(call => call[0] === "animation"), false);
  const content = textOf(view.tree.toJSON());
  assert.match(content, /Built around your goals/);
  assert.match(content, /See your progress/);
  assert.match(content, /Personal coaching/);
  assert.match(content, /Coming soonScan gym equipment/);
  assert.equal(host(view.tree, "subscription-benefit-scan").props.accessibilityLabel, "Coming soon: Scan gym equipment");
  assert.equal(host(view.tree, "subscription-benefit-scan").props.onPress, undefined);
  assert.equal(host(view.tree, "subscription-purchase").props.accessibilityState.disabled, false);
  await view.unmount();
});

test("benefit illustrations run once in sequence and replay without billing or plan changes", async () => {
  const view = await provider({ onboardingScreen: true, snapshot: onboardingSnapshot() });
  assert.deepEqual(view.calls.filter(call => call[0] === "animationDelay").map(call => call[1]), [0, 700, 1400, 2100]);
  await act(async () => { await view.value.refresh(); });
  assert.equal(view.calls.filter(call => call[0] === "animation").length, 4);
  for (const kind of ["workouts", "progress", "coaching", "scan"]) {
    await act(async () => host(view.tree, `subscription-benefit-${kind}`).props.onPress());
  }
  assert.equal(view.calls.filter(call => call[0] === "animation").length, 8);
  assert.equal(view.calls.some(call => call[0] === "purchase" || call[0] === "restore"), false);
  assert.equal(host(view.tree, "subscription-plan-month").props.accessibilityState.selected, true);
  await view.unmount();
});

test("unknown onboarding access withholds checkout and offers verification retry", async () => {
  const view = await provider({ onboardingScreen: true, fakeTimers: true, snapshot: onboardingSnapshot({ verification_status: "unavailable", can_start_training: null }) });
  assert.equal(view.value.onboardingRequired, true);
  assert.equal(host(view.tree, "subscription-purchase"), undefined);
  assert.ok(host(view.tree, "onboarding-subscription-retry"));
  assert.match(textOf(view.tree.toJSON()), /Checking your access/);
  await view.unmount();
});

for (const trigger of ["manual", "foreground"]) test(`failed native billing initialization recovers on ${trigger} without restarting`, async () => {
  let attempts = 0;
  const view = await provider({ onboardingScreen: true, fakeTimers: true, snapshot: onboardingSnapshot(), bind: async () => {
    if (++attempts === 1) throw new Error("Temporarily offline");
    return info();
  } });
  assert.equal(view.value.sdkReady, false);
  assert.ok(host(view.tree, "onboarding-subscription-retry"));
  assert.equal(host(view.tree, "subscription-restore").props.disabled, true);
  if (trigger === "manual") {
    await act(async () => host(view.tree, "onboarding-subscription-retry").props.onPress());
    await view.settle();
  } else {
    await view.setAppState("background");
    await view.setAppState("active");
  }
  assert.equal(view.value.sdkReady, true);
  assert.equal(attempts, 2);
  assert.equal(host(view.tree, "subscription-purchase").props.disabled, false);
  assert.equal(view.calls.some(call => call[0] === "bind" && call[1] === null), false);
  await view.unmount();
});

for (const failure of ["error", "empty"]) test(`onboarding retries ${failure} offerings without changing flags or rebinding a ready SDK`, async () => {
  let attempts = 0;
  const view = await provider({ onboardingScreen: true, fakeTimers: true, snapshot: onboardingSnapshot(), offerings: async () => {
    if (++attempts === 1) { if (failure === "error") throw new Error("Plans could not load"); return []; }
    return [plan];
  } });
  assert.equal(view.value.plans.length, 0);
  assert.ok(host(view.tree, "onboarding-subscription-retry"));
  await act(async () => host(view.tree, "onboarding-subscription-retry").props.onPress());
  await view.settle();
  assert.equal(view.value.plans.length, 1);
  assert.equal(view.value.error, null);
  assert.equal(view.value.notice, null);
  assert.equal(host(view.tree, "subscription-purchase").props.disabled, false);
  assert.equal(view.calls.filter(call => call[0] === "bind" && call[1] === "A").length, 1);
  await view.unmount();
});

test("billing recovery coalesces duplicate taps and cannot start checkout while recovering", async () => {
  const offering = deferred();
  const view = await provider({ fakeTimers: true, snapshot: onboardingSnapshot(), offerings: () => offering.promise });
  let first, second;
  await act(async () => { first = view.value.recoverBilling(); second = view.value.recoverBilling(); });
  await view.settle();
  assert.equal(first, second);
  assert.equal(view.value.busy, true);
  await act(async () => view.value.purchase(plan));
  assert.equal(view.calls.some(call => call[0] === "purchase"), false);
  assert.equal(view.calls.filter(call => call[0] === "plans").length, 1);
  offering.resolve([plan]); await act(async () => first);
  assert.equal(view.value.busy, false);
  assert.equal(view.value.canPurchase, true);
  assert.equal(view.calls.filter(call => call[0] === "bind" && call[1] === "A").length, 1);
  await view.unmount();
});

test("recovery and foreground cannot rebind during an open purchase or clear a pending payment", async () => {
  const payment = deferred();
  const view = await provider({ fakeTimers: true, snapshot: onboardingSnapshot(), purchase: () => payment.promise });
  let purchasing;
  await act(async () => { purchasing = view.value.purchase(plan); });
  await view.settle();
  await act(async () => view.value.recoverBilling());
  await view.setAppState("background"); await view.setAppState("active");
  assert.equal(view.calls.filter(call => call[0] === "bind" && call[1] === "A").length, 1);
  assert.equal(view.calls.some(call => call[0] === "bind" && call[1] === null), false);
  assert.equal(view.calls.some(call => call[0] === "plans"), false);
  payment.resolve("cancelled"); await act(async () => purchasing);
  await view.unmount();

  const pending = await provider({ fakeTimers: true, snapshot: onboardingSnapshot(), memory: new Map([["@primerep/pending-purchase/A", JSON.stringify({ phase: "received", productId: "monthly" })]]) });
  await act(async () => pending.value.recoverBilling());
  assert.equal(pending.value.pending.phase, "received");
  assert.equal(pending.value.canPurchase, false);
  assert.equal(pending.calls.some(call => call[0] === "purchase"), false);
  await pending.unmount();
});

test("late SDK recovery cannot attach listeners or load plans for a changed or unmounted account", async () => {
  const binding = deferred();
  let attempts = 0;
  const view = await provider({ fakeTimers: true, snapshot: onboardingSnapshot(), bind: id => {
    if (id === "B") return info();
    if (++attempts === 1) throw new Error("Temporarily offline");
    return binding.promise;
  } });
  let recovering;
  await act(async () => { recovering = view.value.recoverBilling(); });
  await view.switchUser("B");
  binding.resolve(info(true)); await act(async () => recovering);
  assert.equal(view.value.pending, null);
  assert.equal(view.value.sdkReady, true);
  assert.equal(view.calls.some(call => call[0] === "listen" && call[1] === "A"), false);
  assert.equal(view.calls.some(call => call[0] === "plans" && call[1] === "A"), false);
  await view.unmount();

  const detached = deferred();
  let retries = 0;
  const gone = await provider({ fakeTimers: true, bind: () => { if (++retries === 1) throw new Error("Offline"); return detached.promise; } });
  let completing;
  await act(async () => { completing = gone.value.recoverBilling(); });
  await gone.unmount();
  detached.resolve(info(true)); await act(async () => completing);
  assert.equal(gone.calls.some(call => call[0] === "listen"), false);
  assert.equal(gone.calls.some(call => call[0] === "plans"), false);
  assert.equal(gone.memory.size, 0);
});

for (const phase of [null, "received", "pending"]) test(`billing retry recovers a failed purchase-recovery read and preserves ${phase ?? "empty"} storage`, async () => {
  let reads = 0;
  const memory = phase ? new Map([["@primerep/pending-purchase/A", JSON.stringify({ phase, productId: "monthly" })]]) : new Map();
  const view = await provider({ onboardingScreen: true, fakeTimers: true, snapshot: onboardingSnapshot(), memory,
    readPending: async (key, values) => { if (++reads === 1) throw new Error("Storage unavailable"); return values.get(key) ?? null; },
  });
  assert.equal(view.value.canPurchase, false);
  assert.match(view.value.error, /Couldn’t load purchase recovery/);
  await act(async () => view.value.refresh());
  assert.match(view.value.error, /Couldn’t load purchase recovery/);
  assert.ok(host(view.tree, "onboarding-subscription-retry"));
  await act(async () => host(view.tree, "onboarding-subscription-retry").props.onPress());
  await view.settle();
  assert.equal(reads, 2);
  assert.equal(view.value.error, null);
  assert.equal(view.value.pending?.phase ?? null, phase);
  assert.equal(view.value.canPurchase, phase === null);
  assert.equal(view.calls.some(call => call[0] === "purchase"), false);
  if (phase) assert.equal(memory.has("@primerep/pending-purchase/A"), true);
  await view.unmount();
});

test("repeated purchase-recovery read failures remain visible and prevent checkout", async () => {
  let reads = 0;
  const view = await provider({ onboardingScreen: true, fakeTimers: true, snapshot: onboardingSnapshot(), readPending: async () => { reads += 1; throw new Error("Storage unavailable"); } });
  await act(async () => host(view.tree, "onboarding-subscription-retry").props.onPress());
  await view.settle();
  await act(async () => view.value.refresh());
  assert.equal(reads, 2);
  assert.match(textOf(host(view.tree, "onboarding-subscription-recovery")), /Couldn’t load purchase recovery/);
  assert.equal(view.value.canPurchase, false);
  assert.equal(host(view.tree, "subscription-purchase").props.disabled, true);
  assert.equal(host(view.tree, "onboarding-subscription-retry").props.disabled, false);
  assert.equal(view.calls.some(call => call[0] === "purchase"), false);
  await view.unmount();
});

test("a late recovery hydration cannot overwrite the new account's stored pending payment", async () => {
  const reading = deferred();
  let reads = 0;
  const memory = new Map([["@primerep/pending-purchase/B", JSON.stringify({ phase: "pending", productId: "annual" })]]);
  const view = await provider({ fakeTimers: true, memory, snapshot: onboardingSnapshot(), readPending: async (key, values) => {
    if (key.endsWith("/A")) { if (++reads === 1) throw new Error("Storage unavailable"); return reading.promise; }
    return values.get(key) ?? null;
  } });
  let recovery;
  await act(async () => { recovery = view.value.recoverBilling(); });
  await view.switchUser("B");
  reading.resolve(JSON.stringify({ phase: "received", productId: "monthly" }));
  await act(async () => recovery);
  assert.equal(view.value.pending.phase, "pending");
  assert.equal(view.value.pending.productId, "annual");
  assert.equal(view.value.error, null);
  assert.equal(view.value.canPurchase, false);
  await view.unmount();
});

test("an initial unverified GET cannot leave checkout waiting after focus reconciliation succeeds", async () => {
  const initialRead = deferred(), verification = deferred();
  let reads = 0;
  const view = await provider({ onboardingScreen: true, onboardingHint: true, fakeTimers: true,
    get: () => ++reads === 1 ? initialRead.promise : Promise.resolve(onboardingSnapshot()),
    reconcile: () => verification.promise,
  });
  verification.resolve(onboardingSnapshot()); await view.settle();
  initialRead.resolve(onboardingSnapshot({ verification_status: "unverified", can_start_training: null })); await view.settle();
  assert.equal(view.value.snapshot.verification_status, "verified");
  assert.equal(host(view.tree, "subscription-purchase").props.disabled, false);
  assert.ok(reads >= 2);
  await view.unmount();
});

test("onboarding requires confirmation to clear verified-negative purchase recovery and permits checkout afterward", async () => {
  const memory = new Map([["@primerep/pending-purchase/A", JSON.stringify({ phase: "received", productId: "monthly" })]]);
  const view = await provider({ onboardingScreen: true, memory, fakeTimers: true, snapshot: onboardingSnapshot() });
  await act(async () => view.value.refresh(true));
  assert.equal(view.value.pending.phase, "received");
  assert.equal(host(view.tree, "subscription-purchase").props.disabled, true);
  await act(async () => host(view.tree, "subscription-clear-pending").props.onPress());
  const alert = view.calls.find(call => call[0] === "alert");
  assert.match(alert[2], /does not cancel Apple billing/);
  assert.equal(view.value.pending.phase, "received");
  await act(async () => alert[3].find(button => button.text === "Clear notice").onPress());
  assert.equal(view.value.pending, null);
  assert.equal(view.value.onboardingRequired, true);
  assert.equal(host(view.tree, "subscription-purchase").props.disabled, false);
  assert.equal(memory.has("@primerep/pending-purchase/A"), false);
  assert.equal(view.calls.some(call => call[0] === "purchase"), false);
  await view.unmount();

  const unknown = await provider({ onboardingScreen: true, fakeTimers: true, memory: new Map([["@primerep/pending-purchase/A", JSON.stringify({ phase: "pending", productId: "monthly" })]]), snapshot: onboardingSnapshot({ verification_status: "unavailable", can_start_training: null }) });
  await act(async () => unknown.value.refresh(true));
  assert.equal(host(unknown.tree, "subscription-clear-pending"), undefined);
  await act(async () => unknown.value.clearPending());
  assert.equal(unknown.value.pending.phase, "pending");
  assert.equal(unknown.value.canPurchase, false);
  await unknown.unmount();
});

test("cancelled onboarding purchase stays required while backend verified restore completes it", async () => {
  let verified = false;
  const view = await provider({ snapshot: onboardingSnapshot(), purchase: async () => "cancelled", reconcile: async () => verified ? onboardingSnapshot({ onboarding_subscription_required: false, has_premium: true, billing_status: "trial", can_start_training: true, access_source: "subscription" }) : onboardingSnapshot() });
  await act(async () => view.value.purchase(plan));
  assert.equal(view.value.onboardingRequired, true);
  assert.equal(view.value.pending, null);
  verified = true;
  await act(async () => view.value.restore());
  assert.equal(view.value.onboardingRequired, false);
  assert.equal(view.value.pending, null);
  await view.unmount();
});

test("subscription 401 renews the owned session and refetches with the changed token", async () => {
  const view = await provider({ onboardingHint: true, get: async token => {
    if (token === "tokenA") throw new HttpError("Invalid token", 401);
    return onboardingSnapshot();
  } });
  assert.equal(view.calls.filter(call => call[0] === "refreshUser").length, 1);
  assert.equal(view.value.onboardingRequired, true);
  assert.doesNotMatch(view.value.error, /Invalid token/);
  await view.renewToken("renewed-token");
  assert.equal(view.value.error, null);
  assert.equal(view.calls.some(call => call[0] === "get" && call[1] === "renewed-token"), true);
  await view.unmount();

  const gate = deferred();
  const stale = await provider({ get: token => token === "tokenA" ? gate.promise.then(() => { throw new HttpError("Invalid token", 401); }) : Promise.resolve(snapshot()) });
  await stale.switchUser("B");
  gate.resolve(); await stale.settle();
  assert.equal(stale.calls.some(call => call[0] === "refreshUser"), false);
  assert.equal(stale.value.onboardingRequired, false);
  await stale.unmount();
});

async function mountedRootGate(required, segments = ["workout", "active"]) {
  const routes = [], reads = [];
  const pass = ({ children }) => children;
  const Stack = ({ children }) => React.createElement("Navigator", null, children);
  Stack.Screen = props => React.createElement("Route", props);
  Stack.Protected = ({ guard, children }) => guard ? children : null;
  const AuthContext = React.createContext({ isBootstrapping: false, isLoggedIn: true, hasCompletedOnboarding: true, bootstrapError: null, offlineSession: false, token: "A", user: { id: "A" } });
  const mocks = {
    react: React, "expo-router": { Stack, useRouter: () => ({ replace: route => routes.push(route) }), useSegments: () => segments },
    "react-native": { View: "View", ActivityIndicator: "ActivityIndicator", Platform: { OS: "ios" }, AppState: { addEventListener: () => ({ remove() {} }) } },
    "react-native-reanimated": {}, "react-native-gesture-handler": { GestureHandlerRootView: pass },
    "@react-navigation/native": { ThemeProvider: pass, DefaultTheme: {}, DarkTheme: {} }, "expo-status-bar": { StatusBar: "StatusBar" },
    "expo-notifications": { getLastNotificationResponse: () => null, addNotificationResponseReceivedListener: () => ({ remove() {} }) },
    "@/utils/authContext": { AuthContext, AuthProvider: pass },
    "@/utils/onboardingContext": { OnboardingContext: React.createContext({ isRestoring: false }), OnboardingProvider: pass },
    "@/utils/subscriptionContext": { SubscriptionProvider: pass, SubscriptionPrompt: () => null, useSubscription: () => ({ onboardingRequired: required }) },
    "@/hooks/use-color-scheme": { useColorScheme: () => "light" }, "@/components/offline-screen": { OfflineScreen: "OfflineScreen" },
    "@/services/workoutLoggingService": { getActiveSession: async () => { reads.push("active"); return null; } },
    "@/utils/activeWorkoutStore": { loadActiveWorkout: async () => { reads.push("local"); return null; } },
    "@/services/coachService": { getCoachItem: async () => null, markCoachItemRead: async () => {} }, "@/services/httpClient": { HttpError },
    "@/utils/coachNavigation": { coachTargetHref: () => "/(tabs)/feed", isCoachTarget: () => false },
  };
  for (const [file, symbol] of [["activeWorkoutContext", "ActiveWorkoutProvider"], ["equipmentContext", "EquipmentProvider"], ["equipmentWeightsContext", "EquipmentWeightsProvider"], ["notificationsContext", "NotificationsProvider"], ["workoutWeekContext", "WorkoutWeekProvider"], ["programDraftContext", "ProgramDraftProvider"], ["appearanceContext", "AppearanceProvider"], ["workoutLayoutContext", "WorkoutLayoutProvider"], ["profileContext", "ProfileProvider"], ["healthReadSync", "HealthReadSync"], ["healthExportSync", "HealthExportSync"]]) mocks[`@/utils/${file}`] = { [symbol]: symbol.endsWith("Sync") ? () => null : pass };
  const Root = loader(mocks)("app/_layout.tsx").default;
  let tree; await act(async () => { tree = create(React.createElement(Root)); });
  return { tree, routes, reads };
}

test("mounted root excludes training deep links and makes the required modal the first available route", async () => {
  const view = await mountedRootGate(true);
  const screens = view.tree.root.findAllByType("Route");
  assert.equal(screens[0].props.name, "onboarding-subscription");
  assert.equal(screens[0].props.options.gestureEnabled, false);
  const names = screens.map(node => node.props.name);
  assert.equal(names.includes("(tabs)"), false);
  assert.equal(names.includes("workout/active"), false);
  assert.equal(names.includes("paywall"), false);
  for (const route of ["onboarding-account", "settings/export", "legal/terms", "legal/privacy"]) assert.equal(names.includes(route), true);
  assert.deepEqual(view.reads, []);
  assert.deepEqual(view.routes, []);
  await act(async () => view.tree.unmount());
  const legacy = await mountedRootGate(false, ["(tabs)"]);
  assert.equal(legacy.tree.root.findAllByType("Route")[0].props.name, "(tabs)");
  assert.equal(legacy.tree.root.findAllByType("Route").some(node => node.props.name === "onboarding-subscription"), false);
  await act(async () => legacy.tree.unmount());
});

test("onboarding account menu groups privacy tools and retains safe account switching", async () => {
  const view = await provider({ accountScreen: true, snapshot: onboardingSnapshot() });
  assert.equal(host(view.tree, "onboarding-account-open-outline"), undefined);
  assert.equal(host(view.tree, "onboarding-account-trash-outline"), undefined);
  assert.equal(host(view.tree, "onboarding-account-document-text-outline"), undefined);
  await act(async () => host(view.tree, "onboarding-account-shield-checkmark-outline").props.onPress());
  assert.ok(host(view.tree, "onboarding-account-trash-outline"));
  await act(async () => host(view.tree, "onboarding-account-download-outline").props.onPress());
  assert.deepEqual(view.routes, ["/settings/export"]);
  await act(async () => host(view.tree, "onboarding-account-back").props.onPress());
  assert.equal(host(view.tree, "onboarding-account-download-outline"), undefined);
  assert.equal(host(view.tree, "onboarding-account-log-out-outline").props.accessibilityLabel, "Switch account");
  await act(async () => host(view.tree, "onboarding-account-log-out-outline").props.onPress());
  assert.equal(view.calls.some(call => call[0] === "unregister"), true);
  assert.equal(view.calls.some(call => call[0] === "logout"), true);
  await view.unmount();
});

test("onboarding account management is shown for known billing without requiring active access", async () => {
  for (const billing of [{ billing_status: "trial" }, { billing_status: "active" }, { billing_status: "grace" }, { billing_status: "expired" }, { billing_status: "unknown", product_id: "monthly" }, { billing_status: "unknown", management_url: "https://apps.apple.com/account/subscriptions" }]) {
    const view = await provider({ accountScreen: true, snapshot: onboardingSnapshot(billing) });
    await act(async () => host(view.tree, "onboarding-account-open-outline").props.onPress());
    assert.equal(view.calls.some(call => call[0] === "manage"), true);
    await view.unmount();
  }
});

test("dark onboarding actions retain readable text and account controls have clean spoken labels", async () => {
  const color = node => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean)).color;
  const view = await provider({ onboardingScreen: true, snapshot: onboardingSnapshot(), scheme: "dark", fakeTimers: true });
  assert.equal(color(host(view.tree, "subscription-restore").findByType("Text")), "#B9ACFF");
  await view.unmount();
  const account = await provider({ accountScreen: true, snapshot: onboardingSnapshot(), scheme: "dark", fakeTimers: true });
  const controls = account.tree.root.findAll(node => typeof node.type === "string" && node.props.testID?.startsWith("onboarding-account-"));
  assert.deepEqual(controls.map(node => node.props.accessibilityLabel), ["Privacy & account", "Switch account"]);
  for (const control of controls) assert.ok(control.findAllByType("Ionicons").every(icon => icon.props.accessible === false));
  await act(async () => host(account.tree, "onboarding-account-shield-checkmark-outline").props.onPress());
  assert.equal(color(host(account.tree, "onboarding-account-trash-outline").findByType("Text")), "#F18C86");
  await account.setFontScale(3.1);
  assert.equal(host(account.tree, "onboarding-account-trash-outline").props.accessibilityLabel, "Delete account");
  const heading = account.tree.root.findAllByType("Text").find(node => node.props.accessibilityRole === "header");
  assert.equal(heading.props.allowFontScaling, false);
  assert.equal(Object.assign({}, ...heading.props.style.flat(Infinity)).fontSize, 36);
  await account.unmount();
});

test("onboarding account deletion retains safe cleanup and failed deletion remains recoverable", async () => {
  const view = await provider({ accountScreen: true, snapshot: onboardingSnapshot() });
  await act(async () => host(view.tree, "onboarding-account-shield-checkmark-outline").props.onPress());
  await act(async () => host(view.tree, "onboarding-account-trash-outline").props.onPress());
  const alert = view.calls.find(call => call[0] === "alert");
  await act(async () => alert[3].find(button => button.style === "destructive").onPress());
  for (const action of ["delete", "pauseExport", "clearOrders", "clearLayout", "waitExport", "clearHealth", "logout"]) assert.equal(view.calls.some(call => call[0] === action), true, action);
  await view.unmount();
  const failed = await provider({ accountScreen: true, snapshot: onboardingSnapshot(), deleteAccount: async () => { throw new Error("Offline"); } });
  await act(async () => host(failed.tree, "onboarding-account-shield-checkmark-outline").props.onPress());
  await act(async () => host(failed.tree, "onboarding-account-trash-outline").props.onPress());
  await act(async () => failed.calls.find(call => call[0] === "alert")[3].find(button => button.style === "destructive").onPress());
  assert.equal(failed.calls.some(call => call[0] === "resumeExport"), true);
  assert.equal(failed.calls.some(call => call[0] === "logout"), false);
  assert.equal(host(failed.tree, "onboarding-account-trash-outline").props.disabled, false);
  await failed.unmount();
});

test("an account change while unregistering cannot sign out the new owner", async () => {
  const pending = deferred();
  const view = await provider({ accountScreen: true, snapshot: onboardingSnapshot(), unregister: () => pending.promise });
  await act(async () => { void host(view.tree, "onboarding-account-log-out-outline").props.onPress(); });
  await view.switchUser("B");
  pending.resolve(); await view.settle();
  assert.equal(view.calls.some(call => call[0] === "logout"), false);
  await view.unmount();
});

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
  await act(async () => host(view.tree, "subscription-plan-year").props.onPress());
  assert.equal(host(view.tree, "subscription-plan-year").props.accessibilityState.selected, true);
  assert.equal(host(view.tree, "subscription-purchase").props.accessibilityLabel, "Subscribe");
  assert.ok(textOf(view.tree.root).includes("€89,99 per year. Renews automatically."));
  await view.unmount();
});

test("membership shows its plan and actual expiry even when enforcement supplies no access date", async () => {
  for (const scheme of ["light", "dark"]) {
    const view = await provider({ screen: true, paywall: false, scheme, snapshot: snapshot({ has_premium: true, billing_status: "trial", product_id: "monthly", expires_at: "2026-11-10T12:00:00Z", access_expires_at: null }) });
    const status = textOf(host(view.tree, "subscription-status"));
    assert.ok(status.includes("Free trial"));
    assert.ok(status.includes("Monthly"));
    assert.ok(status.includes("Trial ends"));
    assert.ok(status.includes("Nov 10, 2026"));
    assert.equal(host(view.tree, "subscription-purchase"), undefined);
    assert.equal(view.tree.root.findAll((n) => typeof n.type === "string" && n.props.testID === "subscription-manage").length, 1);
    assert.equal(host(view.tree, "subscription-restore").props.disabled, false);
    assert.equal(host(view.tree, "subscription-retry").props.disabled, false);
    await view.unmount();
  }
});

test("changing the system text size retains the selected plan and recovery controls", async () => {
  const view = await provider({ screen: true, plans: [plan, { ...plan, id: "annual", term: "year", price: "€89,99", trialDays: null }] });
  await act(async () => host(view.tree, "subscription-plan-year").props.onPress());
  const calls = view.calls.length;
  await view.setFontScale(3.5);
  assert.equal(host(view.tree, "subscription-plan-year").props.accessibilityState.selected, true);
  assert.equal(host(view.tree, "subscription-purchase").props.accessibilityLabel, "Subscribe");
  assert.equal(host(view.tree, "subscription-restore").props.disabled, false);
  assert.ok(host(view.tree, "subscription-close"));
  assert.equal(view.calls.length, calls);
  await view.unmount();
});

test("restore has a visible busy state and keeps its verified result through background refresh", async () => {
  const gate = deferred();
  const active = snapshot({ has_premium: true, billing_status: "active", product_id: "monthly" });
  const view = await provider({ screen: true, snapshot: active, reconcile: () => gate.promise });
  await act(async () => { host(view.tree, "subscription-restore").props.onPress(); });
  assert.ok(textOf(host(view.tree, "subscription-restore")).includes("Restoring purchases…"));
  assert.equal(host(view.tree, "subscription-restore").props.accessibilityState.busy, true);
  assert.equal(host(view.tree, "subscription-retry").props.disabled, true);
  assert.equal(host(view.tree, "subscription-manage").props.disabled, true);
  gate.resolve(active);
  await view.settle();
  assert.equal(host(view.tree, "subscription-restore").props.disabled, false);
  assert.ok(textOf(host(view.tree, "subscription-feedback")).includes("Purchases restored."));
  assert.ok(textOf(host(view.tree, "subscription-feedback")).includes("Your subscription is active."));
  await act(async () => view.value.refresh());
  assert.ok(textOf(host(view.tree, "subscription-feedback")).includes("Your subscription is active."));
  view.setSnapshot(snapshot({ billing_status: "expired" }));
  await act(async () => view.value.refresh());
  assert.equal(host(view.tree, "subscription-feedback"), undefined);
  assert.ok(textOf(host(view.tree, "subscription-status")).includes("Subscription ended"));
  await view.unmount();
});

test("verification failure keeps purchase recovery visible and checkout unavailable", async () => {
  const view = await provider({ screen: true, failReconcile: true });
  await act(async () => { host(view.tree, "subscription-restore").props.onPress(); });
  assert.ok(host(view.tree, "subscription-pending"));
  assert.ok(view.value.error);
  assert.equal(textOf(host(view.tree, "subscription-error")), view.value.error);
  assert.equal(host(view.tree, "subscription-error").props.accessibilityRole, "alert");
  assert.equal(host(view.tree, "subscription-purchase"), undefined);
  assert.equal(host(view.tree, "subscription-restore").props.disabled, false);
  assert.equal(host(view.tree, "subscription-retry").props.disabled, false);
  await view.unmount();
});

test("subscription check waits for verification before refreshing plans", async () => {
  for (const premium of [false, true]) {
    const gate = deferred();
    const view = await provider({ screen: true, reconcile: () => gate.promise });
    const reads = () => view.calls.filter((call) => call[0] === "get").length;
    const before = reads();
    await act(async () => { host(view.tree, "subscription-retry").props.onPress(); });
    assert.equal(reads(), before);
    const verified = snapshot({ has_premium: premium, billing_status: premium ? "active" : "none" });
    view.setSnapshot(verified);
    gate.resolve(verified);
    await view.settle();
    assert.equal(view.value.snapshot.has_premium, premium);
    assert.equal(reads(), before + (premium ? 0 : 1));
    await view.unmount();
  }
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
