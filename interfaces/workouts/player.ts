// =============================================================================
// Workout Player — shared UI state types
// =============================================================================

/**
 * Local tracking state for a single set within the active workout player.
 * Mirrors the optimistic sync/revert semantics of the legacy all-in-one form.
 */
export interface SetState {
  exerciseId: string;
  setNumber: number;
  reps: string;
  weight: string;
  weightKg?: number | null;
  confirmed: boolean;
  syncing: boolean;
  syncStatus: "pending" | "synced" | "failed" | "retrying";
  logId: string | null;
  version?: number;
  deleted?: boolean;
  deletedLogId?: string | null;
  editing?: boolean;
  editDraft?: { reps: string; weight: string };
  hasUnsavedInput?: boolean;
  acknowledgedOperationIds?: string[];
  isAdded?: boolean;
}

/**
 * Per-exercise completion summary, used by the exercise list bottom sheet.
 */
export interface ExerciseProgress {
  exerciseId: string;
  confirmedSets: number;
  totalSets: number;
}

/**
 * Context describing which rest period is currently running, so the player
 * knows what to do once it ends (advance within the exercise vs. transition
 * to the next exercise).
 */
export interface RestContext {
  exerciseId?: string;
  exerciseIndex?: number;
  isLastSetOfExercise: boolean;
}
