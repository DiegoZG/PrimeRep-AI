import { requestJson } from "./httpClient";

export type PushPlatform = "ios" | "android";

export interface PushTokenRegistration {
  token: string;
  platform: PushPlatform;
}

export function registerPushToken(
  accessToken: string,
  registration: PushTokenRegistration
) {
  return requestJson<PushTokenRegistration>("/v1/users/me/push-token", {
    method: "POST",
    token: accessToken,
    body: registration,
  });
}

export function unregisterPushToken(accessToken: string, token: string) {
  return requestJson<void>("/v1/users/me/push-token", {
    method: "DELETE",
    token: accessToken,
    body: { token },
  });
}
