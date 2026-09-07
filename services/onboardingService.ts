import { requestJson } from "./httpClient";
import type { OnboardingData } from "@/interfaces/onboarding/types";

export type { OnboardingData } from "@/interfaces/onboarding/types";

export interface OnboardingProfileResponse {
  data: OnboardingData;
  is_complete?: boolean;
}

export type TrainingPreferences = Pick<
  OnboardingData,
  | "fitnessGoal"
  | "experienceLevel"
  | "workoutFrequency"
  | "workoutSplit"
  | "trainingPlace"
  | "selectedEquipment"
  | "customWorkouts"
>;

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

export function getTrainingPreferences(token: string) {
  return requestJson<TrainingPreferences>("/v1/users/me/training-preferences", {
    method: "GET",
    token,
  });
}

export function updateTrainingPreferences(
  token: string,
  preferences: Partial<TrainingPreferences>
) {
  return requestJson<TrainingPreferences>("/v1/users/me/training-preferences", {
    method: "PATCH",
    token,
    body: preferences,
  });
}
