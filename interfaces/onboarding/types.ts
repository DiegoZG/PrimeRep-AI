export type WeightUnit = "LB" | "KG";

export type ExperienceLevel =
  | "no-experience"
  | "beginner"
  | "intermediate"
  | "advanced";

export type FitnessGoal =
  | "build-muscle"
  | "general-fitness"
  | "conditioning"
  | "get-stronger";

export type WorkoutFrequency =
  | "1-day"
  | "2-days"
  | "3-days"
  | "4-days"
  | "5-days"
  | "6-days"
  | "every-day";

export type WorkoutSplit =
  | "ai-optimized"
  | "push-pull-legs"
  | "custom"
  | "upper-lower"
  | "push-pull-legs-full-body"
  | "push-pull-legs-upper-lower"
  | "upper-lower-full-body"
  | "full-body"
  | "bro-split"
  | "lower-focused-upper"
  | "push-pull-legs-upper-body";

export type VarietyLevel = "consistent" | "balanced" | "varied";

export type TrainingPlace = "large-gym" | "small-gym" | "garage-gym";

export interface CustomWorkout {
  id: string;
  name: string;
  type: "workout-split" | "custom";
  muscleGroups: string[];
}

export interface OnboardingFields {
  workoutPlanningMode?: "trainer_led" | "time_budget";
  preferredWorkoutMinutes?: number;
  preferredName?: string;
  lastName?: string;
  email?: string;
  age?: number;
  gender?: string;
  weight?: number;
  weightUnit?: WeightUnit;
  reason?: string;
  fitnessGoal?: FitnessGoal;
  experienceLevel?: ExperienceLevel;
  workoutFrequency?: WorkoutFrequency;
  workoutSplit?: WorkoutSplit;
  varietyLevel?: VarietyLevel;
  trainingPlace?: TrainingPlace;
  selectedEquipment?: string[];
  dumbbellWeights?: number[];
  plateWeights?: number[];
  customWorkouts?: CustomWorkout[];
  preferredWorkoutTime?: string;
  notificationsEnabled?: boolean;
  benchPress1RM?: number;
  backSquat1RM?: number;
  deadlift1RM?: number;
}

export interface OnboardingData extends OnboardingFields {
  [key: string]: unknown;
}
