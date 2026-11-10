import { requestJson } from "./httpClient";

export interface SubscriptionFlags {
  subscriptions_purchases_enabled: boolean;
  subscriptions_enforcement_enabled: boolean;
  subscriptions_onboarding_enabled?: boolean;
  workout_reliability_monitoring_enabled?: boolean;
  equipment_scanning_enabled?: boolean;
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
  return requestJson<FeatureFlagSnapshot>("/v1/feature-flags", { token }).then(normalizeSnapshot);
}

export function getAdminFeatureFlags(token: string) {
  return requestJson<AdminFeatureFlagSnapshot>("/v1/admin/feature-flags", { token }).then(normalizeSnapshot);
}

export function updateFeatureFlags(token: string, body: FeatureFlagPatch) {
  return requestJson<AdminFeatureFlagSnapshot>("/v1/admin/feature-flags", { method: "PATCH", token, body }).then(normalizeSnapshot);
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

function normalizeFlags(flags: SubscriptionFlags): SubscriptionFlags {
  return { ...flags, workout_reliability_monitoring_enabled: flags.workout_reliability_monitoring_enabled === true, equipment_scanning_enabled: flags.equipment_scanning_enabled === true };
}

function normalizeSnapshot<T extends FeatureFlagSnapshot>(snapshot: T): T {
  return { ...snapshot, flags: normalizeFlags(snapshot.flags) };
}

function normalizeUserFlags<T extends Pick<UserFlagSnapshot, "overrides" | "effective_flags">>(snapshot: T): T {
  return {
    ...snapshot,
    overrides: { ...snapshot.overrides, equipment_scanning_enabled: snapshot.overrides.equipment_scanning_enabled ?? null, workout_reliability_monitoring_enabled: snapshot.overrides.workout_reliability_monitoring_enabled ?? null },
    effective_flags: normalizeFlags(snapshot.effective_flags),
  };
}

function normalizeUserSnapshot(snapshot: UserFlagSnapshot): UserFlagSnapshot {
  return {
    ...normalizeUserFlags(snapshot),
    global_flags: normalizeFlags(snapshot.global_flags),
    audiences: { ...snapshot.audiences, equipment_scanning_enabled: snapshot.audiences.equipment_scanning_enabled ?? "everyone", workout_reliability_monitoring_enabled: snapshot.audiences.workout_reliability_monitoring_enabled ?? "everyone" },
  };
}

export function lookupFeatureFlagUser(token: string, identifier: string) {
  return requestJson<UserFlagSnapshot>("/v1/admin/feature-flags/users/lookup", { method: "POST", token, body: { identifier } }).then(normalizeUserSnapshot);
}

export function getUserFeatureFlags(token: string, userId: string) {
  return requestJson<UserFlagSnapshot>(`/v1/admin/feature-flags/users/${encodeURIComponent(userId)}`, { token }).then(normalizeUserSnapshot);
}

export function updateUserFeatureFlags(token: string, userId: string, body: { expected_version: number; overrides: Partial<UserFlagOverrides> }) {
  return requestJson<UserFlagSnapshot>(`/v1/admin/feature-flags/users/${encodeURIComponent(userId)}`, { method: "PATCH", token, body }).then(normalizeUserSnapshot);
}

export function listUserFeatureFlags(token: string, offset = 0) {
  return requestJson<UserFlagList>(`/v1/admin/feature-flags/users?limit=20&offset=${offset}`, { token }).then(snapshot => ({ ...snapshot, items: snapshot.items.map(normalizeUserFlags) }));
}
