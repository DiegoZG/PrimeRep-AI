import { requestJson } from "./httpClient";

export type SignUpPayload = {
  email: string;
  password: string;
  preferred_name: string;
  last_name?: string | null;
  onboarding?: Record<string, any> | null;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
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
