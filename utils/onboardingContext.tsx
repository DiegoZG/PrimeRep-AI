import { createContext, PropsWithChildren, useState } from "react";

interface OnboardingData {
  firstName: string;
  lastName?: string;
  email?: string;
  age?: number;
  gender?: string;
  reason?: string; // Reason for using the fitness app
  fitnessGoals?: string[];
  experienceLevel?: string;
  workoutFrequency?: string;
  preferredWorkoutTime?: string;
  [key: string]: any; // Allow for additional fields
}

interface OnboardingState {
  data: OnboardingData;
  updateField: (field: keyof OnboardingData, value: any) => void;
  updateMultipleFields: (fields: Partial<OnboardingData>) => void;
  resetOnboarding: () => void;
  getOnboardingData: () => OnboardingData;
}

const initialData: OnboardingData = {
  firstName: "",
  lastName: "",
  email: "",
  age: undefined,
  gender: "",
  reason: "",
  fitnessGoals: [],
  experienceLevel: "",
  workoutFrequency: "",
  preferredWorkoutTime: "",
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

  const updateField = (field: keyof OnboardingData, value: any) => {
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
