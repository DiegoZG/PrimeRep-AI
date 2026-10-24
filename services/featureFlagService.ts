import { requestJson } from "./httpClient";

export interface SubscriptionFlags {
  subscriptions_purchases_enabled: boolean;
  subscriptions_enforcement_enabled: boolean;
}

export type FeatureFlagAudience = "everyone" | "selected";
export type FeatureFlagAudiences = Record<keyof SubscriptionFlags, FeatureFlagAudience>;
export type UserFlagOverrides = Record<keyof SubscriptionFlags, boolean | null>;

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
  scope?: "global" | "user";
  target_user_id?: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface AdminFeatureFlagSnapshot extends FeatureFlagSnapshot {
  audiences?: FeatureFlagAudiences;
  history: FeatureFlagAudit[];
}

export interface FeatureFlagPatch {
  expected_version: number;
  flags?: Partial<SubscriptionFlags>;
  audiences?: Partial<FeatureFlagAudiences>;
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


export interface FeatureFlagUser {
  id: string;
  email: string;
  preferred_name: string;
}

export interface UserFlagSnapshot {
  environment: string;
  version: number;
  user: FeatureFlagUser;
  overrides: UserFlagOverrides;
  effective_flags: SubscriptionFlags;
  global_flags: SubscriptionFlags;
  audiences: FeatureFlagAudiences;
  subscriptions_launch_at: string | null;
  transition_ends_at: string | null;
  launch_locked: boolean;
}

export interface UserFlagList {
  environment: string;
  version: number;
  items: Pick<UserFlagSnapshot, "user" | "overrides" | "effective_flags">[];
  total: number;
  limit: number;
  offset: number;
}

export function lookupFeatureFlagUser(token: string, identifier: string) {
  return requestJson<UserFlagSnapshot>("/v1/admin/feature-flags/users/lookup", { method: "POST", token, body: { identifier } });
}

export function getUserFeatureFlags(token: string, userId: string) {
  return requestJson<UserFlagSnapshot>(`/v1/admin/feature-flags/users/${encodeURIComponent(userId)}`, { token });
}

export function updateUserFeatureFlags(token: string, userId: string, body: { expected_version: number; overrides: Partial<UserFlagOverrides> }) {
  return requestJson<UserFlagSnapshot>(`/v1/admin/feature-flags/users/${encodeURIComponent(userId)}`, { method: "PATCH", token, body });
}

export function listUserFeatureFlags(token: string, offset = 0) {
  return requestJson<UserFlagList>(`/v1/admin/feature-flags/users?limit=20&offset=${offset}`, { token });
}
