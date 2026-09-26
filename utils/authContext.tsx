// utils/authContext.tsx
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import * as authService from "@/services/authService";
import {
  getAccessToken,
  getCachedUser,
  getRefreshToken,
} from "@/services/tokenStorage";
import * as userService from "@/services/userService";
import { accountRequestGuard, invalidateAccountRequests } from "@/services/accountScope";
import { cleanupPrivateFiles } from "@/services/privateFiles";
import { cacheSessionUser, captureAndClearSessionTokens, clearCachedSessionUser, clearSessionTokens, persistSessionTokens, waitForTokenWrites } from "@/services/authTokenQueue";

export type AuthUser = userService.UserResponse;

type BootstrapError = "network" | "server" | null;

type AuthState = {
  isBootstrapping: boolean;
  token: string | null; // access token
  user: AuthUser | null;
  bootstrapError: BootstrapError;
  offlineSession: boolean;
};

type AuthContextValue = {
  isBootstrapping: boolean;
  isLoggedIn: boolean;
  token: string | null;
  user: AuthUser | null;
  hasCompletedOnboarding: boolean;
  bootstrapError: BootstrapError;
  offlineSession: boolean;

  logIn: (payload: authService.LoginPayload) => Promise<void>;
  signUp: (payload: authService.SignUpPayload) => Promise<void>;
  logOut: (options?: { forceLocal?: boolean }) => Promise<void>;

  refreshUser: () => Promise<void>;
  acceptProfileIdentity: (profile: Pick<AuthUser, "id" | "preferred_name" | "last_name" | "updated_at">) => void;
  retryBootstrap: () => Promise<void>;
  updateCoachPreference: (enabled: boolean) => Promise<void>;
};

const initialState: AuthState = {
  isBootstrapping: true,
  token: null,
  user: null,
  bootstrapError: null,
  offlineSession: false,
};

type Action =
  | { type: "BOOTSTRAP_START" }
  | { type: "BOOTSTRAP_LOGGED_OUT" }
  | { type: "BOOTSTRAP_ERROR"; error: Exclude<BootstrapError, null> }
  | { type: "BOOTSTRAP_OFFLINE"; user: AuthUser; error: Exclude<BootstrapError, null> }
  | { type: "AUTH_SUCCESS"; token: string; user: AuthUser }
  | { type: "SET_USER"; user: AuthUser }
  | { type: "SET_PROFILE_IDENTITY"; profile: Pick<AuthUser, "id" | "preferred_name" | "last_name" | "updated_at"> }
  | { type: "LOGOUT" };

function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case "BOOTSTRAP_START":
      return { ...state, isBootstrapping: !state.offlineSession, bootstrapError: null };

    case "BOOTSTRAP_LOGGED_OUT":
      return {
        isBootstrapping: false,
        token: null,
        user: null,
        bootstrapError: null,
        offlineSession: false,
      };

    case "BOOTSTRAP_ERROR":
      return {
        ...state,
        isBootstrapping: false,
        bootstrapError: action.error,
      };

    case "BOOTSTRAP_OFFLINE":
      return {
        ...state,
        isBootstrapping: false,
        token: null,
        user: action.user,
        bootstrapError: action.error,
        offlineSession: true,
      };

    case "AUTH_SUCCESS":
      return {
        isBootstrapping: false,
        token: action.token,
        user: action.user,
        bootstrapError: null,
        offlineSession: false,
      };

    case "SET_USER":
      return { ...state, user: action.user };

    case "SET_PROFILE_IDENTITY":
      return state.user?.id === action.profile.id ? { ...state, user: { ...state.user, ...action.profile } } : state;

    case "LOGOUT":
      return {
        isBootstrapping: false,
        token: null,
        user: null,
        bootstrapError: null,
        offlineSession: false,
      };

    default:
      return state;
  }
}

export const AuthContext = createContext<AuthContextValue>({
  isBootstrapping: true,
  isLoggedIn: false,
  token: null,
  user: null,
  hasCompletedOnboarding: false,
  bootstrapError: null,
  offlineSession: false,
  logIn: async () => {},
  signUp: async () => {},
  logOut: async () => {},
  refreshUser: async () => {},
  acceptProfileIdentity: () => {},
  retryBootstrap: async () => {},
  updateCoachPreference: async () => {},
});

async function fetchMe(accessToken: string): Promise<AuthUser> {
  return userService.getMe(accessToken);
}

function getStatus(err: any): number | undefined {
  // More explicit type guard for error status
  if (err && typeof err === "object" && typeof err.status === "number") {
    return err.status;
  }
  return undefined;
}

function classifyBootstrapError(err: any): Exclude<BootstrapError, null> {
  // If our request wrapper attaches `status`, it's "server reached".
  // If not, it's usually a network / fetch failure.
  const status = getStatus(err);
  if (typeof status !== "number") return "network";
  return "server";
}

/**
 * Refresh access token using refresh token.
 */
class RefreshTokenPersistenceError extends Error {}

async function refreshAccessToken(refreshToken: string, isCurrent: () => boolean): Promise<string> {
  const res = await authService.refresh({ refresh_token: refreshToken });
  if (!isCurrent()) throw new Error("Account changed");
  // A rotated refresh token must be durable before we accept its access token.
  try {
    await persistSessionTokens(res.access_token, res.refresh_token, isCurrent);
  } catch (error) {
    throw new RefreshTokenPersistenceError("Could not persist rotated refresh token", {
      cause: error,
    });
  }
  if (!isCurrent()) throw new Error("Account changed");
  return res.access_token;
}

/**
 * Core helper:
 * Try to produce a valid { accessToken, user } using current stored tokens.
 *
 * Rules:
 * - If refresh token missing => logged out
 * - If access token works => use it
 * - If access token 401 => try refresh => use refreshed access token
 * - If refresh 401 => tokens invalid => clear + logged out
 * - If network/server issues => do NOT clear tokens (allow retry)
 */
async function ensureValidSession(isCurrent: () => boolean): Promise<
  | { kind: "ok"; accessToken: string; user: AuthUser }
  | { kind: "logged_out" }
  | { kind: "error"; error: Exclude<BootstrapError, null> }
> {
  await waitForTokenWrites();
  const refreshToken = await getRefreshToken();
  if (!isCurrent()) return { kind: "logged_out" };
  if (!refreshToken) {
    await clearSessionTokens(isCurrent);
    return { kind: "logged_out" };
  }

  const accessToken = await getAccessToken();

  // 1) If we have an access token, try it first.
  if (accessToken) {
    try {
      const user = await fetchMe(accessToken);
      return { kind: "ok", accessToken, user };
    } catch (err: any) {
      const status = getStatus(err);

      // Only 401 should trigger refresh attempt
      if (status !== 401) {
        return { kind: "error", error: classifyBootstrapError(err) };
      }
    }
  }

  // 2) Access token missing or rejected (401) => refresh flow
  try {
    const newAccessToken = await refreshAccessToken(refreshToken, isCurrent);
    const user = await fetchMe(newAccessToken);
    return { kind: "ok", accessToken: newAccessToken, user };
  } catch (err: any) {
    if (!isCurrent()) return { kind: "logged_out" };
    if (err instanceof RefreshTokenPersistenceError) {
      try {
        await clearSessionTokens(isCurrent);
      } finally {
        return { kind: "logged_out" };
      }
    }
    const status = getStatus(err);

    // If refresh token is invalid, clear tokens and force logout
    if (status === 401) {
      await clearSessionTokens(isCurrent);
      return { kind: "logged_out" };
    }

    // Otherwise keep tokens; user can retry later
    return { kind: "error", error: classifyBootstrapError(err) };
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const userRequest = useRef(0);

  const bootstrap = useCallback(async () => {
    invalidateAccountRequests();
    const isCurrent = accountRequestGuard();
    dispatch({ type: "BOOTSTRAP_START" });

    try {
      const result = await ensureValidSession(isCurrent);
      if (!isCurrent()) return;

      if (result.kind === "ok") {
        await cacheSessionUser(result.user, isCurrent).catch(() => {});
        if (!isCurrent()) return;
        dispatch({
          type: "AUTH_SUCCESS",
          token: result.accessToken,
          user: result.user,
        });
        return;
      }

      if (result.kind === "logged_out") {
        // Refresh token was missing or invalid - tokens already cleared in ensureValidSession
        dispatch({ type: "BOOTSTRAP_LOGGED_OUT" });
        return;
      }

      const cached = result.error === "network" ? await getCachedUser().catch(() => null) : null;
      const refreshToken = cached ? await getRefreshToken().catch(() => null) : null;
      if (!isCurrent()) return;
      dispatch(cached && refreshToken
        ? { type: "BOOTSTRAP_OFFLINE", user: cached, error: result.error }
        : { type: "BOOTSTRAP_ERROR", error: result.error });
    } catch (err: any) {
      if (!isCurrent()) return;
      // If something truly unexpected happened, keep tokens and allow retry.
      dispatch({ type: "BOOTSTRAP_ERROR", error: classifyBootstrapError(err) });
    }
  }, []);

  useEffect(() => {
    void cleanupPrivateFiles().catch(() => {});
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!state.offlineSession) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const retry = async () => {
      await bootstrap();
      if (!cancelled) timer = setTimeout(retry, 15_000);
    };
    timer = setTimeout(retry, 15_000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state.offlineSession, bootstrap]);

  const isLoggedIn = !!state.user && (!!state.token || state.offlineSession);
  const hasCompletedOnboarding = state.user?.has_completed_onboarding ?? false;

  const acceptProfileIdentity = useCallback((profile: Pick<AuthUser, "id" | "preferred_name" | "last_name" | "updated_at">) => {
    userRequest.current += 1;
    dispatch({ type: "SET_PROFILE_IDENTITY", profile: { id: profile.id, preferred_name: profile.preferred_name, last_name: profile.last_name, updated_at: profile.updated_at } });
  }, []);

  const refreshUser = useCallback(async () => {
    if (!state.token) return;
    const guard = accountRequestGuard();
    const attempt = ++userRequest.current;
    const isCurrent = () => guard() && attempt === userRequest.current;
    const owner = state.user?.id;

    try {
      const me = await fetchMe(state.token);
      if (!isCurrent() || me.id !== owner) return;
      await cacheSessionUser(me, isCurrent).catch(() => {});
      if (!isCurrent()) return;
      dispatch({ type: "SET_USER", user: me });
    } catch (err: any) {
      if (!isCurrent()) return;
      const status = getStatus(err);

      // Only 401 should trigger refresh logic
      if (status !== 401) return;

      const result = await ensureValidSession(isCurrent);
      if (!isCurrent()) return;

      if (result.kind === "ok") {
        if (result.user.id !== owner) return;
        await cacheSessionUser(result.user, isCurrent).catch(() => {});
        if (!isCurrent()) return;
        dispatch({
          type: "AUTH_SUCCESS",
          token: result.accessToken,
          user: result.user,
        });
        return;
      }

      if (result.kind === "logged_out") {
        dispatch({ type: "LOGOUT" });
        return;
      }

      // If it's network/server error, we keep tokens and do nothing (user can retry)
      // Error is already handled by ensureValidSession, no need to surface it here
    }
  }, [state.token, state.user?.id]);

  const logIn = useCallback(async (payload: authService.LoginPayload) => {
    invalidateAccountRequests();
    const isCurrent = accountRequestGuard();
    const res = await authService.login(payload);
    if (!isCurrent()) return;
    await clearCachedSessionUser(isCurrent);
    await persistSessionTokens(res.access_token, res.refresh_token, isCurrent);
    if (!isCurrent()) return;

    const me = await fetchMe(res.access_token);
    if (!isCurrent()) return;
    await cacheSessionUser(me, isCurrent).catch(() => {});
    if (!isCurrent()) return;
    dispatch({ type: "AUTH_SUCCESS", token: res.access_token, user: me });
  }, []);

  const signUp = useCallback(async (payload: authService.SignUpPayload) => {
    invalidateAccountRequests();
    const isCurrent = accountRequestGuard();
    const res = await authService.signup(payload);
    if (!isCurrent()) return;
    await clearCachedSessionUser(isCurrent);
    await persistSessionTokens(res.access_token, res.refresh_token, isCurrent);
    if (!isCurrent()) return;

    const me = await fetchMe(res.access_token);
    if (!isCurrent()) return;
    await cacheSessionUser(me, isCurrent).catch(() => {});
    if (!isCurrent()) return;
    dispatch({ type: "AUTH_SUCCESS", token: res.access_token, user: me });
  }, []);

  const logOut = useCallback(async (options?: { forceLocal?: boolean }) => {
    invalidateAccountRequests();
    const capturedCredentials = captureAndClearSessionTokens();
    dispatch({ type: "LOGOUT" });
    void cleanupPrivateFiles().catch(() => {});
    const refreshToken = await capturedCredentials;
    if (options?.forceLocal) return;

    try {
      if (refreshToken) {
        await authService.logout({ refresh_token: refreshToken });
      }
    } catch {
      // Logout must remain usable while offline; server revocation is best effort.
    }
  }, []);

  const updateCoachPreference = useCallback(
    async (enabled: boolean) => {
      if (!state.token) return;
      const guard = accountRequestGuard();
      const attempt = ++userRequest.current;
      const isCurrent = () => guard() && attempt === userRequest.current;
      const updated = await userService.updateCoachPreference(state.token, enabled);
      if (!isCurrent() || updated.id !== state.user?.id) return;
      dispatch({ type: "SET_USER", user: updated });
    },
    [state.token, state.user?.id]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isBootstrapping: state.isBootstrapping,
      isLoggedIn,
      token: state.token,
      user: state.user,
      hasCompletedOnboarding,
      bootstrapError: state.bootstrapError,
      offlineSession: state.offlineSession,
      logIn,
      signUp,
      logOut,
      refreshUser,
      acceptProfileIdentity,
      retryBootstrap: bootstrap,
      updateCoachPreference,
    }),
    [
      state.isBootstrapping,
      state.token,
      state.user,
      state.bootstrapError,
      state.offlineSession,
      isLoggedIn,
      hasCompletedOnboarding,
      logIn,
      signUp,
      logOut,
      refreshUser,
      acceptProfileIdentity,
      bootstrap,
      updateCoachPreference,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
