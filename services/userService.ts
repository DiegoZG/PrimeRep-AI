import { requestJson } from "./httpClient";

export interface UserResponse {
  id: string;
  email: string;
  preferred_name: string;
  last_name?: string | null;
  has_completed_onboarding: boolean;
  subscription_tier: "free" | "premium";
  coach_insights_enabled: boolean;
  terms_accepted_version?: string | null;
  privacy_accepted_version?: string | null;
  created_at: string;
  updated_at: string;
}

export function getMe(token: string) {
  return requestJson<UserResponse>("/v1/users/me", {
    method: "GET",
    token,
  });
}

export function acceptCurrentLegal(token: string, termsVersion: string, privacyVersion: string) {
  return requestJson<UserResponse>("/v1/users/me/legal-acceptance", {
    method: "PUT",
    token,
    body: { accepted: true, termsVersion, privacyVersion },
  });
}

export function updateCoachPreference(token: string, enabled: boolean) {
  return requestJson<UserResponse>("/v1/users/me/preferences", {
    method: "PATCH",
    token,
    body: { coach_insights_enabled: enabled },
  });
}

export async function deleteAccount(token: string): Promise<void> {
  await requestJson<void>("/v1/users/me", {
    method: "DELETE",
    token,
  });
}
