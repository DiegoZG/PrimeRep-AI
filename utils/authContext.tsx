import { useRouter } from "expo-router";
import { createContext, PropsWithChildren, useState } from "react";
type AuthState = {
  isLoggedIn: boolean;
  logIn: () => void;
  logOut: () => void;
  shouldCreateAccount: boolean;
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
};

export const AuthContext = createContext<AuthState>({
  isLoggedIn: false,
  logIn: () => {},
  logOut: () => {},
  shouldCreateAccount: false,
  hasCompletedOnboarding: false,
  completeOnboarding: () => {},
  resetOnboarding: () => {},
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [shouldCreateAccount, setShouldCreateAccount] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const router = useRouter();

  const logIn = () => {
    setIsLoggedIn(true);
    router.replace("/");
  };

  const logOut = () => {
    setIsLoggedIn(false);
  };

  const completeOnboarding = () => {
    setHasCompletedOnboarding(true);
  };

  const resetOnboarding = () => {
    setHasCompletedOnboarding(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        logIn,
        logOut,
        shouldCreateAccount,
        hasCompletedOnboarding,
        completeOnboarding,
        resetOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
