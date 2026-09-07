import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from "react";
import type {
  OnboardingData,
  OnboardingFields,
} from "@/interfaces/onboarding/types";
import { AuthContext } from "@/utils/authContext";

interface OnboardingState {
  data: OnboardingData;
  updateField: <Key extends keyof OnboardingFields>(
    field: Key,
    value: OnboardingFields[Key]
  ) => void;
  updateMultipleFields: (fields: Partial<OnboardingData>) => void;
  resetOnboarding: () => void;
  getOnboardingData: () => OnboardingData;
  isRestoring: boolean;
}

const ONBOARDING_DRAFT_KEY = "primerep.onboardingDraft.v1";

const initialData: OnboardingData = {
  preferredName: "",
  lastName: "",
  email: "",
  age: undefined,
  gender: "",
  weight: undefined,
  weightUnit: "LB",
  reason: "",
  fitnessGoal: undefined,
  experienceLevel: undefined,
  workoutFrequency: undefined,
  workoutSplit: undefined,
  varietyLevel: undefined,
  trainingPlace: undefined,
  selectedEquipment: [],
  dumbbellWeights: [],
  plateWeights: [],
  customWorkouts: [],
  preferredWorkoutTime: "",
  notificationsEnabled: false,
  benchPress1RM: undefined,
  backSquat1RM: undefined,
  deadlift1RM: undefined,
};

export const OnboardingContext = createContext<OnboardingState>({
  data: initialData,
  updateField: () => {},
  updateMultipleFields: () => {},
  resetOnboarding: () => {},
  getOnboardingData: () => initialData,
  isRestoring: true,
});

export function OnboardingProvider({ children }: PropsWithChildren) {
  const { isBootstrapping, isLoggedIn } = useContext(AuthContext);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [isRestoring, setIsRestoring] = useState(true);
  const suppressPersistRef = useRef(false);

  useEffect(() => {
    let active = true;
    if (isBootstrapping) return () => { active = false; };

    if (isLoggedIn) {
      suppressPersistRef.current = true;
      setData(initialData);
      void AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
      setIsRestoring(false);
      return () => { active = false; };
    }

    void AsyncStorage.getItem(ONBOARDING_DRAFT_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        const restored = JSON.parse(stored) as OnboardingData;
        if (restored && typeof restored === "object") {
          setData({ ...initialData, ...restored });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [isBootstrapping, isLoggedIn]);

  useEffect(() => {
    if (!isRestoring && !isLoggedIn) {
      if (suppressPersistRef.current) {
        suppressPersistRef.current = false;
        return;
      }
      void AsyncStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(data));
    }
  }, [data, isLoggedIn, isRestoring]);

  const updateField = <Key extends keyof OnboardingFields>(
    field: Key,
    value: OnboardingFields[Key]
  ) => {
    setData((prevData) => ({
      ...prevData,
      [field]: value,
    }));
  };

  const updateMultipleFields = (fields: Partial<OnboardingData>) => {
    setData((prevData) => ({
      ...prevData,
      ...fields,
    }));
  };

  const resetOnboarding = () => {
    suppressPersistRef.current = true;
    setData(initialData);
    void AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
  };

  const getOnboardingData = () => {
    return data;
  };

  return (
    <OnboardingContext.Provider
      value={{
        data,
        updateField,
        updateMultipleFields,
        resetOnboarding,
        getOnboardingData,
        isRestoring,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
