import type { Exercise } from "@/interfaces/exercises";

export function isReferenceOnlyExercise(exercise: Pick<Exercise, "contentVersion" | "trackingMode">) {
  return Boolean(exercise.contentVersion && exercise.trackingMode && exercise.trackingMode !== "reps");
}
