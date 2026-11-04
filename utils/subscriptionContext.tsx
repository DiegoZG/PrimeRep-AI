import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { Href, useRouter, useSegments } from "expo-router";
import { accountGeneration, accountRequestGuard } from "@/services/accountScope";
import { getSubscription, reconcileSubscription, type SubscriptionSnapshot } from "@/services/subscriptionService";
import { onSubscriptionRequired } from "@/services/subscriptionEvents";
import { rememberSubscriptionFlags } from "@/services/subscriptionFlagState";
import { getBillingPlans, listenForBillingUpdates, manageBillingSubscription, nativeBillingAvailable, purchaseBillingPlan, restoreBillingPurchases, setBillingUser, type BillingPlan } from "@/services/revenueCat";
import { loadPendingPurchase, savePendingPurchase, type PendingPurchase } from "@/utils/pendingPurchase";
import { AuthContext } from "@/utils/authContext";
import { HttpError } from "@/services/httpClient";

interface SubscriptionContextValue {
  snapshot: SubscriptionSnapshot | null;
  pending: PendingPurchase | null;
  plans: BillingPlan[];
  busy: boolean;
  ready: boolean;
  sdkReady: boolean;
  onboardingRequired: boolean;
  canPurchase: boolean;
  canClearPending: boolean;
  error: string | null;
  notice: string | null;
  refresh: (reconcile?: boolean) => Promise<SubscriptionSnapshot | null>;
  loadPlans: () => Promise<void>;
  recoverBilling: () => Promise<void>;
  purchase: (plan: BillingPlan) => Promise<void>;
  restore: () => Promise<void>;
  manage: () => Promise<void>;
  openPaywall: () => void;
  clearPending: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);
const activeNotice = "Your subscription is active.";
const restoredNotice = "Purchases restored. Your subscription is active.";

export function SubscriptionProvider({ children }: PropsWithChildren) {
  const { user } = useContext(AuthContext);
  return <AccountSubscriptionProvider key={`${user?.id ?? "guest"}:${accountGeneration()}`}>{children}</AccountSubscriptionProvider>;
}

function AccountSubscriptionProvider({ children }: PropsWithChildren) {
  const { user, token, refreshUser } = useContext(AuthContext);
  const userId = user?.id;
  const router = useRouter();
  const segments = useSegments();
  const route = segments.join("/");
  const paywallRequested = useRef(false);
  const routeRef = useRef(route);
  routeRef.current = route;
  useEffect(() => { if (!route.includes("paywall")) paywallRequested.current = false; }, [route]);
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot | null>(null);
  const onboardingRequired = Boolean(user && nativeBillingAvailable() && (snapshot ? snapshot.onboarding_subscription_required : user.onboarding_subscription_required));
  const [pending, setPending] = useState<PendingPurchase | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const sdkReadyRef = useRef(false);
  const bindingRequest = useRef<Promise<boolean> | null>(null);
  const billingListener = useRef<(() => void) | null>(null);
  const plansRequest = useRef<Promise<void> | null>(null);
  const recoveryRequest = useRef<Promise<void> | null>(null);
  const recoverBillingRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const [error, setError] = useState<string | null>(null);
  const [pendingReadError, setPendingReadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canClearPending, setCanClearPending] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  const mounted = useRef(true);
  const scope = useRef(accountRequestGuard());
  const requestSequence = useRef(0);
  const requests = useRef(new Map<boolean, Promise<SubscriptionSnapshot | null>>());
  const requestOwners = useRef(new Map<boolean, number>());
  const mutation = useRef(false);
  const pendingReady = useRef(false);
  const pendingReadRequest = useRef<Promise<boolean> | null>(null);
  const pendingRevision = useRef(0);
  const pendingRef = useRef(pending);
  const authTier = useRef(user?.subscription_tier);
  authTier.current = user?.subscription_tier;
  pendingRef.current = pending;
  const current = useCallback(() => mounted.current && scope.current(), []);
  const onboardingRequiredRef = useRef(onboardingRequired);
  onboardingRequiredRef.current = onboardingRequired;
  const openPaywall = useCallback(() => {
    if (onboardingRequiredRef.current || !current() || paywallRequested.current || routeRef.current.includes("paywall")) return;
    paywallRequested.current = true;
    router.push("/paywall" as Href);
  }, [current, router]);

  useEffect(() => () => { mounted.current = false; }, []);

  const recordPending = useCallback(async (value: PendingPurchase | null) => {
    if (!userId || !current()) return;
    pendingRevision.current += 1;
    setCanClearPending(false);
    pendingRef.current = value;
    setPending(value);
    await savePendingPurchase(userId, value);
  }, [userId, current]);

  const refresh = useCallback((reconcile = false): Promise<SubscriptionSnapshot | null> => {
    if (!token || !userId || !current()) return Promise.resolve(null);
    const existing = requests.current.get(reconcile);
    if (existing) return existing;
    const sequence = ++requestSequence.current;
    requestOwners.current.set(reconcile, sequence);
    const startedPendingRevision = pendingRevision.current;
    const request = (async () => {
      try {
        const result = await (reconcile ? reconcileSubscription(token) : getSubscription(token));
        if (!current()) return null;
        if (sequence === requestSequence.current) {
          rememberSubscriptionFlags(userId, result.flags);
          setSnapshot(result);
          setError(null);
          if (!result.has_premium) setNotice(previous => previous === activeNotice || previous === restoredNotice ? null : previous);
        }
        if (sequence === requestSequence.current && reconcile) setCanClearPending(Boolean(pendingRef.current && startedPendingRevision === pendingRevision.current && result.verification_status === "verified" && !result.has_premium && ["none", "expired"].includes(result.billing_status)));
        if (sequence === requestSequence.current && result.verification_status === "verified" && authTier.current !== (result.has_premium ? "premium" : "free") && typeof refreshUser === "function") void refreshUser().catch(() => undefined);
        if (sequence === requestSequence.current && startedPendingRevision === pendingRevision.current && result.has_premium && result.verification_status === "verified" && pendingRef.current) {
          await recordPending(null);
          if (current() && sequence === requestSequence.current) setNotice(activeNotice);
        }
        return sequence === requestSequence.current ? result : null;
      } catch (failure) {
        if (current() && sequence === requestSequence.current && failure instanceof HttpError && failure.status === 401 && typeof refreshUser === "function") {
          if (requestOwners.current.get(reconcile) === sequence) { requests.current.delete(reconcile); requestOwners.current.delete(reconcile); }
          setError("Checking your session. Try again if you’re offline.");
          await refreshUser().catch(() => undefined);
          return null;
        }
        if (current() && sequence === requestSequence.current) { setCanClearPending(false); setError(failure instanceof Error ? failure.message : "Couldn’t verify subscription. Try again when connected."); }
        return null;
      } finally { if (requestOwners.current.get(reconcile) === sequence) { requests.current.delete(reconcile); requestOwners.current.delete(reconcile); } }
    })();
    requests.current.set(reconcile, request);
    return request;
  }, [token, userId, current, recordPending, refreshUser]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const hydratePending = useCallback((): Promise<boolean> => {
    if (!userId || !current()) return Promise.resolve(false);
    if (pendingReady.current) return Promise.resolve(true);
    if (pendingReadRequest.current) return pendingReadRequest.current;
    const startedPendingRevision = pendingRevision.current;
    const request = loadPendingPurchase(userId).then((value) => {
      if (!current()) return false;
      pendingReady.current = true;
      setReady(true);
      setPendingReadError(null);
      if (startedPendingRevision === pendingRevision.current) {
        pendingRevision.current += 1;
        pendingRef.current = value;
        setPending(value);
        if (value) void refreshRef.current(true);
      }
      return true;
    }).catch(() => {
      if (current()) {
        setReady(true);
        if (startedPendingRevision !== pendingRevision.current) {
          pendingReady.current = true;
          setPendingReadError(null);
          return true;
        }
        setPendingReadError("Couldn’t load purchase recovery. Try again or restart the app before purchasing.");
      }
      return false;
    }).finally(() => { pendingReadRequest.current = null; });
    pendingReadRequest.current = request;
    return request;
  }, [userId, current]);

  useEffect(() => {
    if (!userId) { setReady(true); return; }
    void hydratePending();
  }, [userId, hydratePending]);

  useEffect(() => {
    if (token) void refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (current()) setAppActive(state === "active");
      if (state === "active") {
        void refreshRef.current(Boolean(pendingRef.current));
        if (!sdkReadyRef.current) void recoverBillingRef.current();
      }
    });
    return () => subscription.remove();
  }, [token, refresh, current]);

  useEffect(() => {
    if (!appActive || !ready || !pending || !userId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const delays = [2000, 5000, 10000, 20000, 30000, 30000];
    let attempt = 0;
    const check = async () => {
      if (cancelled || !current() || !pendingRef.current) return;
      await refreshRef.current();
      attempt += 1;
      if (!cancelled && current() && pendingRef.current && attempt < delays.length) timer = setTimeout(() => void check(), delays[attempt]);
    };
    timer = setTimeout(() => void check(), delays[0]);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [appActive, ready, pending, userId, current]);

  const initializeBilling = useCallback((): Promise<boolean> => {
    if (!userId || !nativeBillingAvailable() || !current() || mutation.current) return Promise.resolve(false);
    if (sdkReadyRef.current) return Promise.resolve(true);
    if (bindingRequest.current) return bindingRequest.current;
    const request = (async () => {
      try {
        const info = await setBillingUser(userId);
        if (!current()) return false;
        if (info?.entitlements.active.premium) {
          await recordPending({ phase: "received", productId: info.entitlements.active.premium.productIdentifier });
          await refreshRef.current(true);
        }
        if (!current()) return false;
        const remove = await listenForBillingUpdates(userId, () => { if (current()) void refreshRef.current(true); });
        if (!current()) { remove(); return false; }
        billingListener.current = remove;
        sdkReadyRef.current = true;
        setSdkReady(true);
        return true;
      } catch {
        if (current()) { sdkReadyRef.current = false; setSdkReady(false); setError("Couldn’t connect to billing. Try again when connected."); }
        return false;
      } finally { bindingRequest.current = null; }
    })();
    bindingRequest.current = request;
    return request;
  }, [userId, current, recordPending]);

  useEffect(() => {
    if (!userId || !nativeBillingAvailable()) return;
    void initializeBilling();
    return () => { billingListener.current?.(); void setBillingUser(null).catch(() => undefined); };
  }, [userId, initializeBilling]);

  useEffect(() => onSubscriptionRequired(() => {
    void refreshRef.current().then((result) => {
      if (current() && result?.flags.subscriptions_enforcement_enabled && result.can_start_training === false) openPaywall();
    });
  }), [current, openPaywall]);

  useEffect(() => {
    if (!onboardingRequired || !appActive || !userId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      await refreshRef.current();
      if (!cancelled && current()) timer = setTimeout(() => void check(), 15000);
    };
    timer = setTimeout(() => void check(), 15000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [onboardingRequired, appActive, userId, current]);

  const loadPlans = useCallback((): Promise<void> => {
    if (!userId || !sdkReadyRef.current || !current()) return Promise.resolve();
    if (plansRequest.current) return plansRequest.current;
    const request = (async () => {
      const latest = await refresh();
      if (!current() || !latest?.flags.subscriptions_purchases_enabled) { if (current()) setPlans([]); return; }
      try {
        const choices = await getBillingPlans(userId);
        if (current()) {
          setPlans(choices);
          if (!choices.length) setNotice("Subscription plans are not available yet.");
          else setNotice(previous => previous === "Subscription plans are not available yet." ? null : previous);
        }
      } catch (failure) { if (current()) setError(failure instanceof Error ? failure.message : "Couldn’t load plans. Try again."); }
    })().finally(() => { plansRequest.current = null; });
    plansRequest.current = request;
    return request;
  }, [userId, current, refresh]);

  const recoverBilling = useCallback((): Promise<void> => {
    if (!userId || !nativeBillingAvailable() || !current() || mutation.current) return Promise.resolve();
    if (recoveryRequest.current) return recoveryRequest.current;
    const request = (async () => {
      setBusy(true);
      setError(null);
      try {
        if (!await hydratePending() || !current()) return;
        if (!await initializeBilling() || !current()) return;
        await refreshRef.current(true);
        if (!current()) return;
        const checked = await refreshRef.current();
        if (!current()) return;
        if (checked?.verification_status !== "verified") await refreshRef.current();
        if (current()) await loadPlans();
      } finally { recoveryRequest.current = null; if (current()) setBusy(false); }
    })();
    recoveryRequest.current = request;
    return request;
  }, [userId, current, hydratePending, initializeBilling, loadPlans]);
  recoverBillingRef.current = recoverBilling;

  const runMutation = useCallback(async (action: () => Promise<void>, requiresSDK = true) => {
    if (!userId || (requiresSDK && !sdkReady) || mutation.current || recoveryRequest.current || !current()) return;
    mutation.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try { await action(); }
    catch (failure) { if (current()) setError(failure instanceof Error ? failure.message : "Couldn’t complete this request. Try again."); }
    finally { mutation.current = false; if (current()) setBusy(false); }
  }, [userId, sdkReady, current]);

  const purchase = useCallback(async (plan: BillingPlan) => {
    await runMutation(async () => {
      if (!userId || !pendingReady.current || pendingRef.current) return;
      const latest = await refresh();
      if (!current() || !latest?.flags.subscriptions_purchases_enabled || latest.has_premium) return;
      const outcome = await purchaseBillingPlan(userId, plan.id);
      if (!current() || outcome === "cancelled") return;
      await recordPending({ phase: outcome, productId: plan.productId });
      if (!current()) return;
      setNotice(outcome === "pending" ? "Your purchase is awaiting Apple approval." : "Purchase received. Verifying access.");
      await refresh(true);
    });
  }, [userId, current, refresh, runMutation, recordPending]);

  const restore = useCallback(async () => {
    await runMutation(async () => {
      if (!userId) return;
      const info = await restoreBillingPurchases(userId);
      if (!current()) return;
      if (info.entitlements.active.premium) await recordPending({ phase: "received", productId: info.entitlements.active.premium.productIdentifier });
      const result = await refresh(true);
      if (current() && result?.has_premium && result.verification_status === "verified") setNotice(restoredNotice);
      if (current() && result && !result.has_premium) setNotice(result.verification_status === "verified" && ["none", "expired"].includes(result.billing_status)
        ? "No active subscription was found for this account." : "Your purchase still needs verification. Try again when connected.");
    });
  }, [userId, current, runMutation, recordPending, refresh]);

  const manage = useCallback(async () => {
    await runMutation(async () => {
      if (!userId) return;
      await manageBillingSubscription(userId);
      if (current()) await refresh(true);
    });
  }, [userId, current, runMutation, refresh]);

  const clearPending = useCallback(async () => {
    await runMutation(async () => {
      const pendingAtStart = pendingRevision.current;
      const checking = refresh(true);
      const requestAtStart = requestSequence.current;
      const result = await checking;
      if (!current() || requestAtStart !== requestSequence.current || pendingAtStart !== pendingRevision.current || !pendingRef.current || result?.verification_status !== "verified" || result.has_premium || !["none", "expired"].includes(result.billing_status)) return;
      await recordPending(null);
      if (current()) setNotice("Purchase notice cleared. This does not cancel Apple billing. Restore Purchases if you completed a purchase.");
    }, false);
  }, [current, refresh, recordPending, runMutation]);

  const canPurchase = Boolean(pendingReady.current && sdkReady && snapshot?.flags.subscriptions_purchases_enabled && !snapshot.has_premium && !pending && !busy && !error && !pendingReadError);
  return <SubscriptionContext.Provider value={{ snapshot, pending, plans, busy, ready, sdkReady, onboardingRequired, canPurchase, canClearPending, error: pendingReadError ?? error, notice, refresh, loadPlans, recoverBilling, purchase, restore, manage, openPaywall, clearPending }}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error("SubscriptionProvider is required.");
  return value;
}

export function SubscriptionPrompt() {
  const { snapshot, pending, ready, openPaywall, onboardingRequired } = useSubscription();
  const { user, hasCompletedOnboarding } = useContext(AuthContext);
  const segments = useSegments();
  const prompted = useRef<string | null>(null);
  useEffect(() => {
    if (onboardingRequired || !ready || !user || !hasCompletedOnboarding || pending || segments[0] !== "(tabs)" || !snapshot?.flags.subscriptions_enforcement_enabled || snapshot.can_start_training !== false || prompted.current === user.id) return;
    prompted.current = user.id;
    openPaywall();
  }, [snapshot, pending, ready, user, hasCompletedOnboarding, segments, openPaywall, onboardingRequired]);
  return null;
}
