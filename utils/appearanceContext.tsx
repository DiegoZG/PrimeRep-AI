import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, useColorScheme as useSystemColorScheme } from "react-native";

export type ThemePreference = "system" | "light" | "dark";
type EffectiveColorScheme = "light" | "dark";

type AppearanceContextValue = {
  preference: ThemePreference;
  colorScheme: EffectiveColorScheme;
  isReady: boolean;
  isSaving: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const STORAGE_KEY = "@primerep/theme-preference";

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function AppearanceProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(Platform.OS !== "web");
  const preferenceRef = useRef(preference);
  const savingRef = useRef(false);
  preferenceRef.current = preference;

  useEffect(() => {
    setHasHydrated(true);
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((storedPreference) => {
        if (!cancelled && isThemePreference(storedPreference)) {
          setPreferenceState(storedPreference);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback(async (nextPreference: ThemePreference) => {
    if (!isReady || savingRef.current || nextPreference === preferenceRef.current) return;
    const previousPreference = preferenceRef.current;
    savingRef.current = true;
    setIsSaving(true);
    setPreferenceState(nextPreference);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, nextPreference);
    } catch (error) {
      setPreferenceState(previousPreference);
      throw error;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [isReady]);

  const colorScheme: EffectiveColorScheme = !hasHydrated
    ? "light"
    : preference === "system"
      ? systemColorScheme === "dark" ? "dark" : "light"
      : preference;

  const value = useMemo<AppearanceContextValue>(() => ({
    preference,
    colorScheme,
    isReady,
    isSaving,
    setPreference,
  }), [colorScheme, isReady, isSaving, preference, setPreference]);

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used within AppearanceProvider");
  }
  return context;
}
