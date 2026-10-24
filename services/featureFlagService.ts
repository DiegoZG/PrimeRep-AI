import { requestJson } from "./httpClient";

export interface SubscriptionFlags {
  subscriptions_purchases_enabled: boolean;
  subscriptions_enforcement_enabled: boolean;
}

export interface FeatureFlagSnapshot {
  environment: string;
  version: number;
  flags: SubscriptionFlags;
  subscriptions_launch_at: string | null;
  transition_ends_at: string | null;
  launch_locked: boolean;
  can_manage_flags: boolean;
  updated_at: string | null;
}

export interface FeatureFlagAudit {
  version: number;
  changed_at: string;
  changed_by: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface AdminFeatureFlagSnapshot extends FeatureFlagSnapshot {
  history: FeatureFlagAudit[];
}

export interface FeatureFlagPatch {
  expected_version: number;
  flags?: Partial<SubscriptionFlags>;
  subscriptions_launch_at?: string | null;
}

export function getFeatureFlags(token: string) {
  return requestJson<FeatureFlagSnapshot>("/v1/feature-flags", { token });
}

export function getAdminFeatureFlags(token: string) {
  return requestJson<AdminFeatureFlagSnapshot>("/v1/admin/feature-flags", { token });
}

export function updateFeatureFlags(token: string, body: FeatureFlagPatch) {
  return requestJson<AdminFeatureFlagSnapshot>("/v1/admin/feature-flags", { method: "PATCH", token, body });
}
