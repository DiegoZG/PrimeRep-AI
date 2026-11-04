import Constants from "expo-constants";
import { Platform } from "react-native";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";

export type BillingPlan = { id: string; productId: string; term: "month" | "year"; price: string; trialDays: number | null };
export type BillingOutcome = "received" | "pending" | "cancelled";
type PurchasesSDK = typeof import("react-native-purchases").default;
let sdk: PurchasesSDK | null = null;
let configured = false;
let desiredUser: string | null = null;
let boundUser: string | null = null;
let identityEpoch = 0;
let queue: Promise<unknown> = Promise.resolve();
let packages = new Map<string, PurchasesPackage>();
const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY ?? "";
const preview = process.env.EXPO_PUBLIC_BILLING_ENV === "preview";

export function nativeBillingAvailable() {
  return Platform.OS === "ios" && Constants.appOwnership !== "expo" && (apiKey.startsWith("appl_") || (preview && apiKey.startsWith("test_")));
}

function serial<T>(action: () => Promise<T>): Promise<T> {
  const next = queue.then(action, action);
  queue = next.catch(() => undefined);
  return next;
}

function currentIdentity(userId: string, epoch: number) {
  if (!nativeBillingAvailable() || desiredUser !== userId || identityEpoch !== epoch) throw new Error("Purchases are unavailable for this account.");
}

async function identify(userId: string, epoch: number) {
  currentIdentity(userId, epoch);
  sdk ??= (await import("react-native-purchases")).default;
  currentIdentity(userId, epoch);
  if (!configured) {
    sdk.configure({ apiKey, appUserID: userId });
    configured = true;
    boundUser = userId;
  } else if (boundUser !== userId) {
    packages = new Map();
    await sdk.logIn(userId);
    boundUser = userId;
  }
  currentIdentity(userId, epoch);
  if (await sdk.getAppUserID() !== userId) throw new Error("Purchase account changed. Please try again.");
  currentIdentity(userId, epoch);
  return sdk;
}

function forUser<T>(userId: string, action: (client: PurchasesSDK) => Promise<T>) {
  const epoch = identityEpoch;
  return serial(async () => {
    const client = await identify(userId, epoch);
    currentIdentity(userId, epoch);
    const result = await action(client);
    if (desiredUser !== userId || identityEpoch !== epoch) throw new Error("Purchase account changed.");
    return result;
  });
}

export function setBillingUser(userId: string | null) {
  desiredUser = userId;
  const epoch = ++identityEpoch;
  if (!userId) return serial(async () => {
    if (identityEpoch !== epoch) return null;
    packages = new Map();
    if (sdk && configured && boundUser) {
      boundUser = null;
      await sdk.logOut();
    }
    return null;
  });
  return forUser(userId, (client) => client.getCustomerInfo());
}

export function listenForBillingUpdates(userId: string, onChange: (info: CustomerInfo) => void) {
  const epoch = identityEpoch;
  return serial(async () => {
    const client = await identify(userId, epoch);
    currentIdentity(userId, epoch);
    const listener = (info: CustomerInfo) => { if (desiredUser === userId && boundUser === userId && identityEpoch === epoch) onChange(info); };
    client.addCustomerInfoUpdateListener(listener);
    return () => { client.removeCustomerInfoUpdateListener(listener); };
  });
}

export function getBillingPlans(userId: string) {
  return forUser(userId, async (client) => {
    const offering = (await client.getOfferings()).current;
    const choices = [offering?.monthly, offering?.annual].filter((item): item is PurchasesPackage => Boolean(item));
    const eligibility: Record<string, { status: number }> = await client.checkTrialOrIntroductoryPriceEligibility(choices.map((choice) => choice.product.identifier)).catch(() => ({}));
    packages = new Map(choices.map((choice) => [choice.identifier, choice]));
    return choices.map((choice): BillingPlan => {
      const intro = choice.product.introPrice;
      const eligible = eligibility[choice.product.identifier]?.status === 2;
      const days = intro?.periodUnit === "DAY" ? intro.periodNumberOfUnits : intro?.periodUnit === "WEEK" ? intro.periodNumberOfUnits * 7 : null;
      return { id: choice.identifier, productId: choice.product.identifier, term: choice === offering?.annual ? "year" : "month", price: choice.product.priceString,
        trialDays: eligible && intro?.price === 0 && days && intro.cycles === 1 ? days : null };
    });
  });
}

export function purchaseBillingPlan(userId: string, id: string): Promise<BillingOutcome> {
  return forUser(userId, async (client) => {
    const selected = packages.get(id);
    if (!selected) throw new Error("Refresh the available plans before purchasing.");
    try {
      await client.purchasePackage(selected);
      return "received";
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code === "1") return "cancelled";
      if (code === "20") return "pending";
      throw error;
    }
  });
}

export function restoreBillingPurchases(userId: string) {
  return forUser(userId, (client) => client.restorePurchases());
}

export function manageBillingSubscription(userId: string) {
  return forUser(userId, (client) => client.showManageSubscriptions());
}
