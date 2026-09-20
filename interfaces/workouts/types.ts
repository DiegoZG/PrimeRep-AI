// =============================================================================
// API Response Types (camelCase from backend)
// =============================================================================

export interface WorkoutApiPrescription {
  sets: number;
  reps?: string;
  repsMin?: number;
  repsMax?: number;
  restSeconds: number;
  suggestedWeightKg?: number | null;
  suggestedPreviousWeightKg?: number | null;
  suggestedWeightReason?: "increase" | "hold" | "deload" | null;
}

export interface WorkoutApiExercise {
  id: number;
  name: string;
  exerciseType: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  imageUrl: string | null;
  demoVideoUrl: string | null;
  requiredEquipmentIds: string[];
}

export interface WorkoutApiItem {
  exercise: WorkoutApiExercise;
  prescription: WorkoutApiPrescription;
  exerciseRationale?: string | null;
}

export interface WorkoutApiBlock {
  blockType: string;
  items: WorkoutApiItem[];
}

export interface WorkoutApiResponse {
  workoutId: string;
  splitKey: string;
  dayType: string;
  title: string;
  estimatedMinutes: number;
  workoutIntent?: string | null;
  exerciseBlocks: WorkoutApiBlock[];
}

// =============================================================================
// UI Models
// =============================================================================

export interface Prescription {
  sets: number;
  reps: string;
  restSeconds: number;
  suggestedWeightKg?: number;
  suggestedPreviousWeightKg?: number;
  suggestedWeightReason?: "increase" | "hold" | "deload";
}

export interface WorkoutExercise {
  id: string; // Converted from number to string for consistency with ExerciseRow
  name: string;
  exerciseType: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  imageUrl?: string;
  demoVideoUrl?: string;
  requiredEquipmentIds: string[];
}

export interface WorkoutItem {
  exercise: WorkoutExercise;
  prescription: Prescription;
  exerciseRationale?: string;
}

export interface WorkoutBlock {
  blockType: string;
  items: WorkoutItem[];
}

export interface Workout {
  workoutId: string;
  splitKey: string;
  dayType: string;
  title: string;
  estimatedMinutes: number;
  workoutIntent?: string;
  blocks: WorkoutBlock[];
}

// =============================================================================
// Request Params
// =============================================================================

export interface NextWorkoutParams {
  goal?: string;
  durationMinutes?: number;
  splitPreference?: string;
  difficulty?: string;
  force?: boolean; // Query param for regeneration
}
