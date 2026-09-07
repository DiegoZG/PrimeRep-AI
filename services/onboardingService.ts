import { requestJson } from "./httpClient";
import type { OnboardingData } from "@/interfaces/onboarding/types";

export type { OnboardingData } from "@/interfaces/onboarding/types";

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
