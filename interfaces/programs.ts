import type { Exercise } from "@/interfaces/exercises";
import type { WorkoutWeekPlanApiResponse } from "@/interfaces/workouts";

export type ProgramScope = "system" | "private";
export type ProgramGoal =
  | "build-muscle"
  | "get-stronger"
  | "general-fitness"
  | "conditioning";
export type ProgramLevel =
  | "no-experience"
  | "beginner"
  | "intermediate"
  | "advanced";
export type ProgramApplyMode = "now" | "next-week";

export interface ProgramPrescription {
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
}

export interface ProgramExercise {
  id: string;
  position: number;
  exerciseId: string;
  blockType: string;
  exercise: Exercise;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  cue?: string | null;
}

export interface ProgramDay {
  id: string;
  position: number;
  title: string;
  dayType: string;
  exercises: ProgramExercise[];
}

export interface ProgramSummary {
  id: string;
  scope: ProgramScope;
  name: string;
  description: string;
  goal: ProgramGoal;
  level: ProgramLevel;
  frequency: number;
  durationMinutes: number;
  featuredRank?: number | null;
  version: number;
  equipmentIds: string[];
  equipmentCompatible: boolean | null;
  missingEquipmentIds: string[];
  recommendationScore?: number | null;
  matchReasons: string[];
  isActive?: boolean;
  isScheduled?: boolean;
}

export interface ProgramDetail extends ProgramSummary {
  aliases: string[];
  days: ProgramDay[];
  archivedAt?: string | null;
}

export interface ProgramListResponse {
  items: ProgramSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProgramFilters {
  scope?: "all" | ProgramScope;
  query?: string;
  goal?: ProgramGoal;
  level?: ProgramLevel;
  frequency?: number;
  maxDurationMinutes?: number;
  equipmentIds?: string[];
  featured?: boolean;
  recommended?: boolean;
  limit?: number;
  offset?: number;
}

export interface ExploreSearchResponse {
  programs: ProgramSummary[];
  exercises: Exercise[];
  program_pagination?: import("@/interfaces/exercises/types").CatalogPagination;
  exercise_pagination?: import("@/interfaces/exercises/types").CatalogPagination;
}

export interface ProgramSubstitution {
  templateExerciseId: string;
  originalExercise: Exercise;
  replacementExercise: Exercise;
  reason: string;
}

export interface ProgramEquipmentConflict {
  templateExerciseId: string;
  templateDayId: string;
  originalExerciseId: string;
  missingEquipmentIds: string[];
  suggestedExerciseId?: string | null;
  alternativeExerciseIds: string[];
  suggestedExercise?: Exercise | null;
  alternatives: Exercise[];
}

export interface ActivationPreview {
  template: ProgramSummary;
  weekdays: number[];
  scheduleImpact: {
    preservedWorkoutDayIds: string[];
    replacedWorkoutDayIds: string[];
    scheduledDates: string[];
  };
  equipmentConflicts: ProgramEquipmentConflict[];
  unresolvedConflictCount: number;
}

export interface ActiveProgram {
  id: string;
  templateId?: string | null;
  templateVersion: number;
  templateName: string;
  effectiveDate: string;
  weekdays: number[];
  applyMode: ProgramApplyMode;
  status: string;
  requiresReview: boolean;
  createdAt: string;
}

export interface ActiveProgramState {
  current: ActiveProgram | null;
  scheduled: ActiveProgram | null;
}

export interface ProgramActivationResponse {
  activeProgram: ActiveProgram;
  weekPlan: WorkoutWeekPlanApiResponse;
}

export interface ProgramMutationPayload {
  name: string;
  description: string;
  goal: ProgramGoal;
  level: ProgramLevel;
  durationMinutes: number;
  aliases: string[];
  days: Array<{
    title: string;
    dayType: string;
    exercises: Array<{
      blockType: string;
      exerciseId: string;
      sets: number;
      repsMin: number;
      repsMax: number;
      restSeconds: number;
      cue?: string | null;
    }>;
  }>;
  version?: number;
}

export interface DraftProgramExercise {
  localId: string;
  id?: string;
  position: number;
  blockType: string;
  exerciseId: string;
  exercise: Exercise;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  cue?: string | null;
}

export interface DraftProgramDay {
  localId: string;
  id?: string;
  position: number;
  title: string;
  dayType: string;
  exercises: DraftProgramExercise[];
}

export interface ProgramDraft {
  templateId?: string;
  scope?: ProgramScope;
  isActive?: boolean;
  isScheduled?: boolean;
  version?: number;
  name: string;
  description: string;
  goal: ProgramGoal;
  level: ProgramLevel;
  durationMinutes: number;
  aliases: string[];
  days: DraftProgramDay[];
}

export interface ActivationRequest {
  weekStart: string;
  effectiveDate: string;
  weekdays: number[];
  templateVersion: number;
  substitutions: Record<string, string>;
  applyMode: ProgramApplyMode;
  clientOperationId: string;
}

export interface CustomExercisePayload {
  name: string;
  exerciseType: ExerciseTypeValue;
  primaryMuscle: ExercisePrimaryMuscleValue;
  secondaryMuscles: ExerciseSecondaryMuscleValue[];
  equipmentIds: string[];
  instructions?: string | null;
}


export type ExerciseTypeValue =
  | "strength"
  | "accessory"
  | "bodyweight"
  | "cardio";

export type ExercisePrimaryMuscleValue =
  | "abs"
  | "back"
  | "biceps"
  | "calves"
  | "cardio"
  | "chest"
  | "forearms"
  | "glutes"
  | "hamstrings"
  | "neck"
  | "quads"
  | "shoulders"
  | "triceps";

export type ExerciseSecondaryMuscleValue =
  | ExercisePrimaryMuscleValue
  | "full_body";
