import { requestJson } from "./httpClient";
import type { OnboardingData } from "@/interfaces/onboarding/types";

export type SignUpPayload = {
  email: string;
  password: string;
  preferred_name: string;
  last_name?: string | null;
  onboarding?: OnboardingData | null;
  legalAcceptance: {
    accepted: true;
    termsVersion: string;
    privacyVersion: string;
  };
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
};

export type RefreshTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
};

export type RefreshPayload = {
  refresh_token: string;
};

export function signup(payload: SignUpPayload) {
  return requestJson<TokenResponse>("/v1/auth/signup", {
    method: "POST",
    body: payload,
  });
}

export function login(payload: LoginPayload) {
  return requestJson<TokenResponse>("/v1/auth/login", {
    method: "POST",
    body: payload,
  });
}

export function refresh(payload: RefreshPayload) {
  return requestJson<RefreshTokenResponse>("/v1/auth/refresh", {
    method: "POST",
    body: payload,
  });
}

export function logout(payload: RefreshPayload) {
  return requestJson<void>("/v1/auth/logout", {
    method: "POST",
    body: payload,
  });
}

export function requestPasswordReset(email: string) {
  return requestJson<{ message: string }>("/v1/auth/password-reset/request", {
    method: "POST",
    body: { email },
  });
}

export function confirmPasswordReset(token: string, newPassword: string) {
  return requestJson<void>("/v1/auth/password-reset/confirm", {
    method: "POST",
    body: { token, newPassword },
  });
}
