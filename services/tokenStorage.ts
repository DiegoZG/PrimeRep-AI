import * as SecureStore from "expo-secure-store";
import type { UserResponse } from "./userService";

const ACCESS_TOKEN_KEY = "primerep_access_token";
const REFRESH_TOKEN_KEY = "primerep_refresh_token";
const CACHED_USER_KEY = "primerep_cached_user";

export async function getCachedUser(): Promise<UserResponse | null> {
  const stored = await SecureStore.getItemAsync(CACHED_USER_KEY);
  if (!stored) return null;
  try {
    const user = JSON.parse(stored) as UserResponse;
    return typeof user.id === "string" && user.has_completed_onboarding === true ? user : null;
  } catch {
    return null;
  }
}

export async function setCachedUser(user: UserResponse): Promise<void> {
  await SecureStore.setItemAsync(CACHED_USER_KEY, JSON.stringify(user));
}

export async function clearCachedUser(): Promise<void> {
  await SecureStore.deleteItemAsync(CACHED_USER_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function clearAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([clearAccessToken(), clearRefreshToken(), clearCachedUser()]);
}
