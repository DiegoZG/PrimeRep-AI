import type {
  NextWorkoutParams,
  Workout,
  WorkoutApiBlock,
  WorkoutApiItem,
  WorkoutApiResponse,
  WorkoutBlock,
  WorkoutExercise,
  WorkoutItem,
} from "@/interfaces/workouts";
import { requestJson } from "./httpClient";

// =============================================================================
// Mappers (API → UI)
// =============================================================================

/**
 * Maps API exercise to UI WorkoutExercise model
 * Converts numeric id to string for consistency with ExerciseRow
 */
function mapApiExercise(
  apiExercise: WorkoutApiItem["exercise"]
): WorkoutExercise {
  return {
    id: String(apiExercise.id),
    name: apiExercise.name,
    exerciseType: apiExercise.exerciseType,
    primaryMuscle: apiExercise.primaryMuscle,
    secondaryMuscles: apiExercise.secondaryMuscles,
    imageUrl: apiExercise.imageUrl || undefined,
    demoVideoUrl: apiExercise.demoVideoUrl || undefined,
    requiredEquipmentIds: apiExercise.requiredEquipmentIds,
  };
}

/**
 * Maps API workout item to UI WorkoutItem model
 * Handles both `reps` (string) and `repsMin`/`repsMax` (numbers) from API
 */
function mapApiItem(apiItem: WorkoutApiItem): WorkoutItem {
  const { prescription } = apiItem;

  // Convert repsMin/repsMax to reps string if reps is not provided
  const reps =
    prescription.reps ??
    (prescription.repsMin != null && prescription.repsMax != null
      ? `${prescription.repsMin}-${prescription.repsMax}`
      : "");

  return {
    exercise: mapApiExercise(apiItem.exercise),
    prescription: {
      sets: prescription.sets,
      reps,
      restSeconds: prescription.restSeconds,
      suggestedWeightKg: prescription.suggestedWeightKg ?? undefined,
    },
  };
}

/**
 * Maps API workout block to UI WorkoutBlock model
 */
function mapApiBlock(apiBlock: WorkoutApiBlock): WorkoutBlock {
  return {
    blockType: apiBlock.blockType,
    items: apiBlock.items.map(mapApiItem),
  };
}

/**
 * Maps API workout response to UI Workout model
 */
function mapApiWorkout(apiWorkout: WorkoutApiResponse): Workout {
  return {
    workoutId: apiWorkout.workoutId,
    splitKey: apiWorkout.splitKey,
    dayType: apiWorkout.dayType,
    title: apiWorkout.title,
    estimatedMinutes: apiWorkout.estimatedMinutes,
    blocks: apiWorkout.exerciseBlocks.map(mapApiBlock),
  };
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Builds the request body from params, excluding the `force` query param
 */
function buildRequestBody(
  params?: NextWorkoutParams
): Record<string, unknown> | undefined {
  if (!params) return undefined;

  const { force: _force, ...bodyParams } = params;

  // Only include non-undefined values
  const body: Record<string, unknown> = {};
  if (bodyParams.goal !== undefined) body.goal = bodyParams.goal;
  if (bodyParams.durationMinutes !== undefined)
    body.durationMinutes = bodyParams.durationMinutes;
  if (bodyParams.splitPreference !== undefined)
    body.splitPreference = bodyParams.splitPreference;
  if (bodyParams.difficulty !== undefined)
    body.difficulty = bodyParams.difficulty;

  return Object.keys(body).length > 0 ? body : undefined;
}

/**
 * Fetches the next workout for the authenticated user
 * POST /v1/workouts/next
 *
 * @param token - Required auth token
 * @param params - Optional params: goal, durationMinutes, splitPreference, difficulty, force
 */
export async function getNextWorkout(
  token: string,
  params?: NextWorkoutParams
): Promise<Workout> {
  // Build query string for force param
  const queryString = params?.force ? "?force=true" : "";

  // Build request body (excludes force)
  const body = buildRequestBody(params);

  const data = await requestJson<WorkoutApiResponse>(
    `/v1/workouts/next${queryString}`,
    {
      method: "POST",
      token,
      body,
    }
  );

  return mapApiWorkout(data);
}
