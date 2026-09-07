import type { WorkoutBlock } from "./types";

// =============================================================================
// API Response Types (camelCase from backend)
// =============================================================================

export interface WorkoutDayApiExercise {
  id: number;
  name: string;
  exerciseType: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  imageUrl: string | null;
  demoVideoUrl: string | null;
  requiredEquipmentIds: number[];
}

export interface WorkoutDayApiItem {
  exercise: WorkoutDayApiExercise;
  prescription: {
    sets: number;
    reps?: string;
    repsMin?: number;
    repsMax?: number;
    restSeconds: number;
    suggestedWeightKg?: number | null;
    suggestedWeightReason?: "increase" | "hold" | "deload" | null;
  };
  exerciseRationale?: string | null;
}

export interface WorkoutDayApiBlock {
  blockType: string;
  items: WorkoutDayApiItem[];
}

export interface WorkoutDayApiResponse {
  workoutDayId: string;
  slotIndex: number;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  title: string;
  dayType: string;
  splitKey: string;
  workoutIntent?: string | null;
  deferredMuscles?: string[];
  unavailableMuscles?: string[];
  exerciseBlocks: WorkoutDayApiBlock[];
}

export interface WorkoutWeekPlanApiResponse {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  workouts: WorkoutDayApiResponse[];
}

// =============================================================================
// UI Models
// =============================================================================

export interface WorkoutDay {
  workoutDayId: string;
  slotIndex: number;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  title: string;
  dayType: string;
  splitKey: string;
  workoutIntent?: string;
  deferredMuscles?: string[];
  unavailableMuscles?: string[];
  blocks: WorkoutBlock[];
}

export interface WorkoutWeekPlan {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  workouts: WorkoutDay[];
}

// =============================================================================
// Request Params
// =============================================================================

export interface GetWorkoutWeekParams {
  weekStart?: string; // YYYY-MM-DD
  force?: boolean;
}

export interface SkipWorkoutDayParams {
  workoutDayId: string;
}

export interface UpdateWorkoutDurationParams {
  workoutDayId: string;
  durationMinutes: number;
}
