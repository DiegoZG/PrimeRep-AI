import { createContext, PropsWithChildren, useState } from "react";
import type {
  OnboardingData,
  OnboardingFields,
} from "@/interfaces/onboarding/types";

interface OnboardingState {
  data: OnboardingData;
  updateField: <Key extends keyof OnboardingFields>(
    field: Key,
    value: OnboardingFields[Key]
  ) => void;
  updateMultipleFields: (fields: Partial<OnboardingData>) => void;
  resetOnboarding: () => void;
  getOnboardingData: () => OnboardingData;
}

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
});

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<OnboardingData>(initialData);

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
    setData(initialData);
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
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}
