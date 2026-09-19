import type {
  ExercisePrimaryMuscleValue,
  ExerciseSecondaryMuscleValue,
  ExerciseTypeValue,
} from "@/interfaces/programs";

export const EXERCISE_TYPE_OPTIONS: ReadonlyArray<{
  value: ExerciseTypeValue;
  label: string;
}> = [
  { value: "strength", label: "Strength" },
  { value: "accessory", label: "Accessory" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "cardio", label: "Cardio" },
];

export const EXERCISE_PRIMARY_MUSCLE_OPTIONS: ReadonlyArray<{
  value: ExercisePrimaryMuscleValue;
  label: string;
}> = [
  { value: "abs", label: "Abs" },
  { value: "back", label: "Back" },
  { value: "biceps", label: "Biceps" },
  { value: "calves", label: "Calves" },
  { value: "cardio", label: "Cardio" },
  { value: "chest", label: "Chest" },
  { value: "forearms", label: "Forearms" },
  { value: "glutes", label: "Glutes" },
  { value: "hamstrings", label: "Hamstrings" },
  { value: "neck", label: "Neck" },
  { value: "quads", label: "Quadriceps" },
  { value: "shoulders", label: "Shoulders" },
  { value: "triceps", label: "Triceps" },
];

export const EXERCISE_SECONDARY_MUSCLE_OPTIONS: ReadonlyArray<{
  value: ExerciseSecondaryMuscleValue;
  label: string;
}> = [
  ...EXERCISE_PRIMARY_MUSCLE_OPTIONS,
  { value: "full_body", label: "Full body" },
];
