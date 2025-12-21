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
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/services/tokenStorage";
import * as userService from "@/services/userService";

export type AuthUser = userService.UserResponse;

type AuthState = {
  isBootstrapping: boolean;
  token: string | null;
  user: AuthUser | null;
};

type AuthContextValue = {
  isBootstrapping: boolean;
  isLoggedIn: boolean;
  token: string | null;
  user: AuthUser | null;
  hasCompletedOnboarding: boolean;
  logIn: (payload: authService.LoginPayload) => Promise<void>;
  signUp: (payload: authService.SignUpPayload) => Promise<void>;
  logOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const initialState: AuthState = {
  isBootstrapping: true,
  token: null,
  user: null,
};

type Action =
  | { type: "BOOTSTRAP_START" }
  | { type: "BOOTSTRAP_LOGGED_OUT" }
  | { type: "BOOTSTRAP_SUCCESS"; token: string; user: AuthUser }
  | { type: "AUTH_SUCCESS"; token: string; user: AuthUser }
  | { type: "SET_USER"; user: AuthUser }
  | { type: "LOGOUT" };

function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case "BOOTSTRAP_START":
      return { ...state, isBootstrapping: true };
    case "BOOTSTRAP_LOGGED_OUT":
      return { isBootstrapping: false, token: null, user: null };
    case "BOOTSTRAP_SUCCESS":
      return { isBootstrapping: false, token: action.token, user: action.user };
    case "AUTH_SUCCESS":
      return { isBootstrapping: false, token: action.token, user: action.user };
    case "SET_USER":
      return { ...state, user: action.user };
    case "LOGOUT":
      return { isBootstrapping: false, token: null, user: null };
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
  logIn: async () => {},
  signUp: async () => {},
  logOut: async () => {},
  refreshUser: async () => {},
});

async function fetchMe(token: string): Promise<AuthUser> {
  return userService.getMe(token);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      dispatch({ type: "BOOTSTRAP_START" });
      try {
        const token = await getAccessToken();
        if (!token) {
          if (isMounted) dispatch({ type: "BOOTSTRAP_LOGGED_OUT" });
          return;
        }
        const me = await fetchMe(token);
        if (isMounted) dispatch({ type: "BOOTSTRAP_SUCCESS", token, user: me });
      } catch {
        await clearAccessToken();
        if (isMounted) dispatch({ type: "BOOTSTRAP_LOGGED_OUT" });
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const isLoggedIn = !!state.token && !!state.user;
  const hasCompletedOnboarding = state.user?.has_completed_onboarding ?? false;

  const refreshUser = useCallback(async () => {
    if (!state.token) return;
    try {
      const me = await fetchMe(state.token);
      dispatch({ type: "SET_USER", user: me });
    } catch {
      await clearAccessToken();
      dispatch({ type: "LOGOUT" });
    }
  }, [state.token]);

  const logIn = useCallback(async (payload: authService.LoginPayload) => {
    const res = await authService.login(payload);
    await setAccessToken(res.access_token);
    const me = await fetchMe(res.access_token);
    dispatch({ type: "AUTH_SUCCESS", token: res.access_token, user: me });
  }, []);

  const signUp = useCallback(async (payload: authService.SignUpPayload) => {
    const res = await authService.signup(payload);
    await setAccessToken(res.access_token);
    const me = await fetchMe(res.access_token);
    dispatch({ type: "AUTH_SUCCESS", token: res.access_token, user: me });
  }, []);

  const logOut = useCallback(async () => {
    await clearAccessToken();
    dispatch({ type: "LOGOUT" });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isBootstrapping: state.isBootstrapping,
      isLoggedIn,
      token: state.token,
      user: state.user,
      hasCompletedOnboarding,
      logIn,
      signUp,
      logOut,
      refreshUser,
    }),
    [
      state.isBootstrapping,
      state.token,
      state.user,
      isLoggedIn,
      hasCompletedOnboarding,
      logIn,
      signUp,
      logOut,
      refreshUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
