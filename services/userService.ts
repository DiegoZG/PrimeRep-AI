import { requestJson } from "./httpClient";

export type UserResponse = {
  id: string;
  email: string;
  preferred_name: string;
  last_name?: string | null;
  has_completed_onboarding: boolean;
  created_at: string;
  updated_at: string;
};

export function getMe(token: string) {
  return requestJson<UserResponse>("/v1/users/me", {
    method: "GET",
    token,
  });
}
