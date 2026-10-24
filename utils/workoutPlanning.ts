import type { WorkoutDay } from "@/interfaces/workouts";

export const WORKOUT_TIME_OPTIONS = [25, 35, 45, 60, 75, 90, 105, 120] as const;
export type WorkoutPlanningMode = "trainer_led" | "time_budget";
export interface WorkoutPlanningChoice { planningMode: WorkoutPlanningMode; timeBudgetMinutes: number | null }

export function workoutPlanningMode(workout: WorkoutDay): WorkoutPlanningMode {
  return workout.planningMode ?? "time_budget";
}

export function workoutTimeBudget(workout: WorkoutDay): number {
  return workout.timeBudgetMinutes ?? (workoutPlanningMode(workout) === "trainer_led" ? 35 : workout.durationMinutes);
}

export function workoutPlanningSummary(workout: WorkoutDay): string {
  if (workout.programActivationId) return `${workout.durationMinutes} min`;
  if (workoutPlanningMode(workout) === "trainer_led") {
    const count = workout.blocks.reduce((total, block) => total + block.items.length, 0);
    return `${count} ${count === 1 ? "exercise" : "exercises"}`;
  }
  const budget = workoutTimeBudget(workout);
  return workout.estimatedMinutes != null && workout.estimatedMinutes > budget ? `About ${workout.estimatedMinutes} min · ${budget} min budget` : `Up to ${budget} min`;
}

export function workoutPlanningError(error: unknown): string {
  const failure = error as { message?: string; payload?: { detail?: { message?: string; minimumUsefulMinutes?: number } | string } };
  const detail = failure?.payload?.detail;
  if (detail && typeof detail === "object") {
    if (detail.minimumUsefulMinutes) return `This workout needs at least about ${detail.minimumUsefulMinutes} minutes. Choose a longer budget or Trainer-led.`;
    if (detail.message) return detail.message;
  }
  return typeof detail === "string" ? detail : failure?.message || "Your workout could not be updated. Please try again.";
}

export function workoutPlanningSpokenSummary(workout: WorkoutDay): string {
  return workoutPlanningMode(workout) === "trainer_led" && !workout.programActivationId ? "Trainer-led" : workoutPlanningSummary(workout).replace(/\bmin\b/g, "minutes");
}

export function planningUpdateWasRejected(error: unknown): boolean {
  if ((error as { payload?: { detail?: { code?: string } } })?.payload?.detail?.code === "workout_changed") return false;
  const status = (error as { status?: number })?.status;
  return status != null && status >= 400 && status < 500 && status !== 404 && status !== 408;
}
