import type {
  Exercise,
  ExerciseApiItem,
  ExerciseApiResponse,
  GetExercisesParams,
} from "@/interfaces/exercises";
import { requestJson } from "./httpClient";

/**
 * Builds query string from params object, mapping equipmentId → equipment_id
 */
function buildExerciseQueryString(params?: GetExercisesParams): string {
  if (!params) return "";

  const queryParts: string[] = [];

  if (params.q) queryParts.push(`q=${encodeURIComponent(params.q)}`);
  if (params.muscle)
    queryParts.push(`muscle=${encodeURIComponent(params.muscle)}`);
  if (params.equipmentId)
    queryParts.push(`equipment_id=${encodeURIComponent(params.equipmentId)}`);
  if (params.type) queryParts.push(`type=${encodeURIComponent(params.type)}`);
  if (params.limit !== undefined) queryParts.push(`limit=${params.limit}`);
  if (params.offset !== undefined) queryParts.push(`offset=${params.offset}`);

  return queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
}

/**
 * Maps backend ExerciseApiItem to frontend Exercise model
 */
function mapApiItemToExercise(apiItem: ExerciseApiItem): Exercise {
  return {
    id: apiItem.id,
    name: apiItem.name,
    exerciseType: apiItem.exercise_type,
    primaryMuscle: apiItem.primary_muscle,
    imageUrl: apiItem.image_url || undefined,
  };
}

/**
 * Fetches exercises from the catalog with optional filters
 * GET /v1/exercises
 */
export async function getExercises(
  params?: GetExercisesParams
): Promise<Exercise[]> {
  const queryString = buildExerciseQueryString(params);
  const data = await requestJson<ExerciseApiResponse>(
    `/v1/exercises${queryString}`,
    {
      method: "GET",
    }
  );
  return (data.items || [])
    .filter((item) => item.is_active !== false)
    .map(mapApiItemToExercise);
}

/**
 * Fetches user's favorite exercises and returns their IDs
 * GET /v1/exercises/favorites
 */
export async function getFavoriteExercises(token: string): Promise<string[]> {
  const data = await requestJson<ExerciseApiResponse>(
    "/v1/exercises/favorites",
    {
      method: "GET",
      token,
    }
  );
  return (data.items || []).map((item) => item.id);
}

/**
 * Adds an exercise to user's favorites
 * POST /v1/exercises/{id}/favorite
 */
export async function favoriteExercise(
  id: string,
  token: string
): Promise<void> {
  await requestJson(`/v1/exercises/${id}/favorite`, {
    method: "POST",
    token,
  });
}

/**
 * Removes an exercise from user's favorites
 * DELETE /v1/exercises/{id}/favorite
 */
export async function unfavoriteExercise(
  id: string,
  token: string
): Promise<void> {
  await requestJson(`/v1/exercises/${id}/favorite`, {
    method: "DELETE",
    token,
  });
}

// Helper functions for filtering exercises by type

/**
 * Returns first 5 strength/accessory exercises for the Weights preview section
 */
export function getWeightsPreview(exercises: Exercise[]): Exercise[] {
  return exercises
    .filter(
      (e) => e.exerciseType === "strength" || e.exerciseType === "accessory"
    )
    .slice(0, 5);
}

/**
 * Returns first 5 bodyweight exercises for the Bodyweight preview section
 */
export function getBodyweightPreview(exercises: Exercise[]): Exercise[] {
  return exercises.filter((e) => e.exerciseType === "bodyweight").slice(0, 5);
}

/**
 * Returns first 5 cardio exercises for the Cardio preview section
 */
export function getCardioPreview(exercises: Exercise[]): Exercise[] {
  return exercises.filter((e) => e.exerciseType === "cardio").slice(0, 5);
}

/**
 * Fetches exercises for multiple types and merges them (unique by id, sorted by name)
 * Used for "weights" category which includes strength + accessory types
 */
export async function getExercisesByTypes(
  types: string[],
  params?: Omit<GetExercisesParams, "type">
): Promise<Exercise[]> {
  const results = await Promise.all(
    types.map((type) => getExercises({ ...params, type }))
  );

  // Merge and deduplicate by id
  const exerciseMap = new Map<string, Exercise>();
  for (const exercises of results) {
    for (const exercise of exercises) {
      if (!exerciseMap.has(exercise.id)) {
        exerciseMap.set(exercise.id, exercise);
      }
    }
  }

  // Sort by name and return
  return Array.from(exerciseMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
