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

interface SubscriptionContextValue {
  snapshot: SubscriptionSnapshot | null;
  pending: PendingPurchase | null;
  plans: BillingPlan[];
  busy: boolean;
  ready: boolean;
  sdkReady: boolean;
  canPurchase: boolean;
  canClearPending: boolean;
  error: string | null;
  notice: string | null;
  refresh: (reconcile?: boolean) => Promise<SubscriptionSnapshot | null>;
  loadPlans: () => Promise<void>;
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
  const [pending, setPending] = useState<PendingPurchase | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canClearPending, setCanClearPending] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  const mounted = useRef(true);
  const scope = useRef(accountRequestGuard());
  const requestSequence = useRef(0);
  const requests = useRef(new Map<boolean, Promise<SubscriptionSnapshot | null>>());
  const mutation = useRef(false);
  const pendingReady = useRef(false);
  const pendingRevision = useRef(0);
  const pendingRef = useRef(pending);
  const authTier = useRef(user?.subscription_tier);
  authTier.current = user?.subscription_tier;
  pendingRef.current = pending;
  const current = useCallback(() => mounted.current && scope.current(), []);
  const openPaywall = useCallback(() => {
    if (!current() || paywallRequested.current || routeRef.current.includes("paywall")) return;
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
        if (current() && sequence === requestSequence.current) { setCanClearPending(false); setError(failure instanceof Error ? failure.message : "Couldn’t verify subscription. Try again when connected."); }
        return null;
      } finally { requests.current.delete(reconcile); }
    })();
    requests.current.set(reconcile, request);
    return request;
  }, [token, userId, current, recordPending, refreshUser]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!userId) { setReady(true); return; }
    const startedPendingRevision = pendingRevision.current;
    void loadPendingPurchase(userId).then((value) => {
      if (!current()) return;
      pendingReady.current = true;
      setReady(true);
      if (startedPendingRevision === pendingRevision.current) {
        pendingRevision.current += 1;
        pendingRef.current = value;
        setPending(value);
        if (value) void refreshRef.current(true);
      }
    }).catch(() => {
      if (current()) {
        setReady(true);
        if (startedPendingRevision !== pendingRevision.current) pendingReady.current = true;
        else setError("Couldn’t load purchase recovery. Restart the app before purchasing.");
      }
    });
  }, [userId, current]);

  useEffect(() => {
    if (token) void refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (current()) setAppActive(state === "active");
      if (state === "active") void refreshRef.current(Boolean(pendingRef.current));
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

  useEffect(() => {
    if (!userId || !nativeBillingAvailable()) return;
    let cancelled = false;
    let removeListener: (() => void) | undefined;
    void setBillingUser(userId).then(async (info) => {
      if (cancelled || !current()) return;
      if (info?.entitlements.active.premium) {
        await recordPending({ phase: "received", productId: info.entitlements.active.premium.productIdentifier });
        await refreshRef.current(true);
      }
      if (cancelled || !current()) return;
      setSdkReady(true);
      const remove = await listenForBillingUpdates(userId, () => { if (current()) void refreshRef.current(true); });
      if (cancelled) remove(); else removeListener = remove;
    }).catch(() => { if (!cancelled && current()) setSdkReady(false); });
    return () => { cancelled = true; removeListener?.(); void setBillingUser(null).catch(() => undefined); };
  }, [userId, current, recordPending]);

  useEffect(() => onSubscriptionRequired(() => {
    void refreshRef.current().then((result) => {
      if (current() && result?.flags.subscriptions_enforcement_enabled && result.can_start_training === false) openPaywall();
    });
  }), [current, openPaywall]);

  const loadPlans = useCallback(async () => {
    if (!userId || !sdkReady || !current()) return;
    const latest = await refresh();
    if (!current() || !latest?.flags.subscriptions_purchases_enabled) { if (current()) setPlans([]); return; }
    try {
      const choices = await getBillingPlans(userId);
      if (current()) { setPlans(choices); if (!choices.length) setNotice("Subscription plans are not available yet."); }
    } catch (failure) { if (current()) setError(failure instanceof Error ? failure.message : "Couldn’t load plans. Try again."); }
  }, [userId, sdkReady, current, refresh]);

  const runMutation = useCallback(async (action: () => Promise<void>, requiresSDK = true) => {
    if (!userId || (requiresSDK && !sdkReady) || mutation.current || !current()) return;
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

  const canPurchase = Boolean(pendingReady.current && sdkReady && snapshot?.flags.subscriptions_purchases_enabled && !snapshot.has_premium && !pending && !busy && !error);
  return <SubscriptionContext.Provider value={{ snapshot, pending, plans, busy, ready, sdkReady, canPurchase, canClearPending, error, notice, refresh, loadPlans, purchase, restore, manage, openPaywall, clearPending }}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error("SubscriptionProvider is required.");
  return value;
}

export function SubscriptionPrompt() {
  const { snapshot, pending, ready, openPaywall } = useSubscription();
  const { user, hasCompletedOnboarding } = useContext(AuthContext);
  const segments = useSegments();
  const prompted = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !user || !hasCompletedOnboarding || pending || segments[0] !== "(tabs)" || !snapshot?.flags.subscriptions_enforcement_enabled || snapshot.can_start_training !== false || prompted.current === user.id) return;
    prompted.current = user.id;
    openPaywall();
  }, [snapshot, pending, ready, user, hasCompletedOnboarding, segments, openPaywall]);
  return null;
}
