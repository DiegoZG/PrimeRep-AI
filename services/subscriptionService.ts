import type { SubscriptionFlags } from "./featureFlagService";
import { requestJson } from "./httpClient";

export interface SubscriptionSnapshot {
  onboarding_subscription_required?: boolean;
  environment: string;
  flags_version: number;
  flags: SubscriptionFlags;
  billing_status: "unknown" | "none" | "trial" | "active" | "grace" | "expired";
  verification_status: "unverified" | "verified" | "unavailable" | "not_configured";
  verified_at: string | null;
  product_id: string | null;
  expires_at: string | null;
  grace_expires_at: string | null;
  will_renew: boolean | null;
  management_url: string | null;
  has_premium: boolean;
  can_start_training: boolean | null;
  access_source: "legacy" | "subscription" | "transition" | "none" | "unknown";
  access_expires_at: string | null;
  transition_ends_at: string | null;
  provider_configured: boolean;
}

export function getSubscription(token: string) {
  return requestJson<SubscriptionSnapshot>("/v1/users/me/subscription", { token });
}

export function reconcileSubscription(token: string) {
  return requestJson<SubscriptionSnapshot>("/v1/users/me/subscription/reconcile", { method: "POST", token });
}
