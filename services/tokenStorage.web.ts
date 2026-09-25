// Browsers do not provide SecureStore; keep tokens in memory rather than
// persisting bearer credentials in unencrypted browser storage.
import type { UserResponse } from "./userService";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let cachedUser: UserResponse | null = null;

export async function getCachedUser() { return cachedUser; }
export async function setCachedUser(user: UserResponse) { cachedUser = user; }
export async function clearCachedUser() { cachedUser = null; }

export async function getAccessToken() { return accessToken; }
export async function setAccessToken(token: string) { accessToken = token; }
export async function clearAccessToken() { accessToken = null; }
export async function getRefreshToken() { return refreshToken; }
export async function setRefreshToken(token: string) { refreshToken = token; }
export async function clearRefreshToken() { refreshToken = null; }
export async function clearTokens() { accessToken = null; refreshToken = null; cachedUser = null; }
