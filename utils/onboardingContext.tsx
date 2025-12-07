import { createContext, PropsWithChildren, useState } from "react";

interface OnboardingData {
  firstName: string;
  lastName?: string;
  email?: string;
  age?: number;
  gender?: string;
  weight?: number; // Weight value
  weightUnit?: "LB" | "KG"; // Weight unit (pounds or kilograms)
  reason?: string; // Reason for using the fitness app
  fitnessGoal?: string; // Single fitness goal (changed from array to single value)
  experienceLevel?: string;
  workoutFrequency?: string;
  workoutSplit?: string; // Preferred workout split
  varietyLevel?: string; // Exercise variety preference
  trainingPlace?: string; // Where user exercises
  selectedEquipment?: string[]; // Selected equipment IDs
  dumbbellWeights?: number[]; // Selected dumbbell weights
  plateWeights?: number[]; // Selected plate weights
  customWorkouts?: {
    id: string;
    name: string;
    type: "workout-split" | "custom";
    muscleGroups: string[]; // Array of muscle group IDs
  }[];
  preferredWorkoutTime?: string;
  // One-rep max values (for Intermediate/Advanced users)
  benchPress1RM?: number; // Bench press one-rep max in pounds
  backSquat1RM?: number; // Back squat one-rep max in pounds
  deadlift1RM?: number; // Deadlift one-rep max in pounds
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
  weight: undefined,
  weightUnit: "LB",
  reason: "",
  fitnessGoal: "",
  experienceLevel: "",
  workoutFrequency: "",
  workoutSplit: "",
  varietyLevel: "",
  trainingPlace: "",
  selectedEquipment: [],
  dumbbellWeights: [],
  plateWeights: [],
  customWorkouts: [],
  preferredWorkoutTime: "",
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
