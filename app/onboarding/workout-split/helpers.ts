/**
 * Helper functions and constants for workout split logic.
 * This module centralizes the mapping between workout split options and muscle groups.
 */

/**
 * Maps workout split option IDs to their corresponding muscle groups.
 * These are the base muscle groups before any Core additions.
 */
export const WORKOUT_SPLIT_MUSCLE_GROUP_MAP: Record<string, string[]> = {
  "full-body": ["chest", "back", "shoulders", "hamstrings", "quads", "abs"],
  "upper-body": ["chest", "back", "shoulders", "biceps", "triceps"],
  legs: ["hamstrings", "quads", "calves", "glutes"],
  push: ["chest", "shoulders", "triceps"],
  pull: ["back", "biceps"],
};

/**
 * Builds the complete muscle group array from a workout split selection.
 * Handles Core toggle by adding abs and lower-back when enabled.
 *
 * @param splitId - The ID of the selected workout split option
 * @param coreEnabled - Whether Core is enabled (adds abs and lower-back)
 * @returns Array of muscle group IDs
 */
export function buildMuscleGroupsFromSplitSelection(
  splitId: string,
  coreEnabled: boolean
): string[] {
  let muscleGroups = WORKOUT_SPLIT_MUSCLE_GROUP_MAP[splitId] || [];

  // Add Core if enabled
  if (coreEnabled) {
    muscleGroups = [...muscleGroups, "abs", "lower-back"];
    // Remove duplicates (e.g., if "abs" was already in the base option)
    muscleGroups = Array.from(new Set(muscleGroups));
  }

  return muscleGroups;
}

/**
 * Infers which workout split option was selected based on muscle groups.
 * This is used when editing a workout to pre-fill the modal selections.
 *
 * @param muscleGroups - Array of muscle group IDs from a saved workout
 * @returns Object with the matched splitId (if found) and coreEnabled flag
 */
export function inferSplitSelectionFromMuscleGroups(muscleGroups: string[]): {
  splitId?: string;
  coreEnabled: boolean;
} {
  // Check if Core is enabled (has both abs and lower-back)
  const coreEnabled =
    muscleGroups.includes("abs") && muscleGroups.includes("lower-back");

  // Remove "lower-back" (only added by Core) to match base options
  let groupsToMatch = muscleGroups.filter((mg) => mg !== "lower-back");

  // Find matching workout split option
  let matchingEntry = Object.entries(WORKOUT_SPLIT_MUSCLE_GROUP_MAP).find(
    ([_, groups]) => {
      const workoutGroupsSet = new Set(groupsToMatch);
      // Check if all groups in the map are in the workout groups
      // and the sizes match exactly
      return (
        groups.every((g) => workoutGroupsSet.has(g)) &&
        groups.length === workoutGroupsSet.size
      );
    }
  );

  // If no match found and Core is enabled, try removing "abs" too
  // (Core adds "abs" even if base option doesn't include it)
  if (!matchingEntry && coreEnabled) {
    groupsToMatch = groupsToMatch.filter((mg) => mg !== "abs");
    matchingEntry = Object.entries(WORKOUT_SPLIT_MUSCLE_GROUP_MAP).find(
      ([_, groups]) => {
        const workoutGroupsSet = new Set(groupsToMatch);
        return (
          groups.every((g) => workoutGroupsSet.has(g)) &&
          groups.length === workoutGroupsSet.size
        );
      }
    );
  }

  return {
    splitId: matchingEntry?.[0],
    coreEnabled,
  };
}
