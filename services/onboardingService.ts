import { requestJson } from "./httpClient";

// Minimal shape — the onboarding `data` blob is a flexible JSONB field on the
// backend, so we only type the parts the frontend currently reads from it.
export interface OnboardingData {
  experienceLevel?: "no-experience" | "beginner" | "intermediate" | "advanced";
  [key: string]: unknown;
}

export interface OnboardingProfileResponse {
  data: OnboardingData;
  is_complete?: boolean;
}

/**
 * Fetches the current user's onboarding profile.
 * GET /v1/onboarding/me
 */
export async function getOnboardingMe(
  token: string
): Promise<OnboardingData> {
  const res = await requestJson<OnboardingProfileResponse>(
    "/v1/onboarding/me",
    {
      method: "GET",
      token,
    }
  );
  return res.data || {};
}
