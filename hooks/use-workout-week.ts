import { WorkoutWeekContext } from "@/utils/workoutWeekContext";
import { useContext } from "react";

/**
 * Hook to access the WorkoutWeekContext.
 * Throws an error if used outside of WorkoutWeekProvider.
 */
export function useWorkoutWeek() {
  const context = useContext(WorkoutWeekContext);

  if (!context) {
    throw new Error(
      "useWorkoutWeek must be used within a WorkoutWeekProvider"
    );
  }

  return context;
}

