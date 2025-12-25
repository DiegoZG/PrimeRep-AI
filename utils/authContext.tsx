// utils/authContext.tsx
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
} from "react";

import * as authService from "@/services/authService";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "@/services/tokenStorage";
import * as userService from "@/services/userService";

export type AuthUser = userService.UserResponse;

type BootstrapError = "network" | "server" | null;

type AuthState = {
  isBootstrapping: boolean;
  token: string | null; // access token
  user: AuthUser | null;
  bootstrapError: BootstrapError;
};

type AuthContextValue = {
  isBootstrapping: boolean;
  isLoggedIn: boolean;
  token: string | null;
  user: AuthUser | null;
  hasCompletedOnboarding: boolean;
  bootstrapError: BootstrapError;

  logIn: (payload: authService.LoginPayload) => Promise<void>;
  signUp: (payload: authService.SignUpPayload) => Promise<void>;
  logOut: () => Promise<void>;

  refreshUser: () => Promise<void>;
  retryBootstrap: () => Promise<void>;
};

const initialState: AuthState = {
  isBootstrapping: true,
  token: null,
  user: null,
  bootstrapError: null,
};

type Action =
  | { type: "BOOTSTRAP_START" }
  | { type: "BOOTSTRAP_LOGGED_OUT" }
  | { type: "BOOTSTRAP_ERROR"; error: Exclude<BootstrapError, null> }
  | { type: "AUTH_SUCCESS"; token: string; user: AuthUser }
  | { type: "SET_USER"; user: AuthUser }
  | { type: "LOGOUT" };

function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case "BOOTSTRAP_START":
      return { ...state, isBootstrapping: true, bootstrapError: null };

    case "BOOTSTRAP_LOGGED_OUT":
      return {
        isBootstrapping: false,
        token: null,
        user: null,
        bootstrapError: null,
      };

    case "BOOTSTRAP_ERROR":
      return {
        ...state,
        isBootstrapping: false,
        bootstrapError: action.error,
      };

    case "AUTH_SUCCESS":
      return {
        isBootstrapping: false,
        token: action.token,
        user: action.user,
        bootstrapError: null,
      };

    case "SET_USER":
      return { ...state, user: action.user };

    case "LOGOUT":
      return {
        isBootstrapping: false,
        token: null,
        user: null,
        bootstrapError: null,
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
  logIn: async () => {},
  signUp: async () => {},
  logOut: async () => {},
  refreshUser: async () => {},
  retryBootstrap: async () => {},
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
 * Note: backend currently returns only access_token (no refresh rotation).
 */
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await authService.refresh({ refresh_token: refreshToken });
  await setAccessToken(res.access_token);
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
async function ensureValidSession(): Promise<
  | { kind: "ok"; accessToken: string; user: AuthUser }
  | { kind: "logged_out" }
  | { kind: "error"; error: Exclude<BootstrapError, null> }
> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await clearTokens();
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
    const newAccessToken = await refreshAccessToken(refreshToken);
    const user = await fetchMe(newAccessToken);
    return { kind: "ok", accessToken: newAccessToken, user };
  } catch (err: any) {
    const status = getStatus(err);

    // If refresh token is invalid, clear tokens and force logout
    if (status === 401) {
      await clearTokens();
      return { kind: "logged_out" };
    }

    // Otherwise keep tokens; user can retry later
    return { kind: "error", error: classifyBootstrapError(err) };
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const bootstrap = useCallback(async () => {
    dispatch({ type: "BOOTSTRAP_START" });

    try {
      const result = await ensureValidSession();

      if (result.kind === "ok") {
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

      dispatch({ type: "BOOTSTRAP_ERROR", error: result.error });
    } catch (err: any) {
      // If something truly unexpected happened, keep tokens and allow retry.
      dispatch({ type: "BOOTSTRAP_ERROR", error: classifyBootstrapError(err) });
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const isLoggedIn = !!state.token && !!state.user;
  const hasCompletedOnboarding = state.user?.has_completed_onboarding ?? false;

  const refreshUser = useCallback(async () => {
    if (!state.token) return;

    try {
      const me = await fetchMe(state.token);
      dispatch({ type: "SET_USER", user: me });
    } catch (err: any) {
      const status = getStatus(err);

      // Only 401 should trigger refresh logic
      if (status !== 401) return;

      const result = await ensureValidSession();

      if (result.kind === "ok") {
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
  }, [state.token]);

  const logIn = useCallback(async (payload: authService.LoginPayload) => {
    const res = await authService.login(payload);
    await Promise.all([
      setAccessToken(res.access_token),
      setRefreshToken(res.refresh_token),
    ]);

    const me = await fetchMe(res.access_token);
    dispatch({ type: "AUTH_SUCCESS", token: res.access_token, user: me });
  }, []);

  const signUp = useCallback(async (payload: authService.SignUpPayload) => {
    const res = await authService.signup(payload);
    await Promise.all([
      setAccessToken(res.access_token),
      setRefreshToken(res.refresh_token),
    ]);

    const me = await fetchMe(res.access_token);
    dispatch({ type: "AUTH_SUCCESS", token: res.access_token, user: me });
  }, []);

  const logOut = useCallback(async () => {
    await clearTokens();
    dispatch({ type: "LOGOUT" });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isBootstrapping: state.isBootstrapping,
      isLoggedIn,
      token: state.token,
      user: state.user,
      hasCompletedOnboarding,
      bootstrapError: state.bootstrapError,
      logIn,
      signUp,
      logOut,
      refreshUser,
      retryBootstrap: bootstrap,
    }),
    [
      state.isBootstrapping,
      state.token,
      state.user,
      state.bootstrapError,
      isLoggedIn,
      hasCompletedOnboarding,
      logIn,
      signUp,
      logOut,
      refreshUser,
      bootstrap,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
