import { requestJson } from "./httpClient";

export interface UserResponse {
  id: string;
  email: string;
  preferred_name: string;
  last_name?: string | null;
  has_completed_onboarding: boolean;
  subscription_tier: "free" | "premium";
  coach_insights_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function getMe(token: string) {
  return requestJson<UserResponse>("/v1/users/me", {
    method: "GET",
    token,
  });
}

export function updateCoachPreference(token: string, enabled: boolean) {
  return requestJson<UserResponse>("/v1/users/me/preferences", {
    method: "PATCH",
    token,
    body: { coach_insights_enabled: enabled },
  });
}
