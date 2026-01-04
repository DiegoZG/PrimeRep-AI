import { requestJson } from "./httpClient";

// API response types (backend schema)
export interface ExerciseApiItem {
  id: string;
  name: string;
  exercise_type: string;
  primary_muscle: string;
  image_url?: string | null;
  demo_video_url?: string | null;
  is_active?: boolean;
}

export interface ExerciseApiResponse {
  items: ExerciseApiItem[];
}

// UI model
export interface Exercise {
  id: string;
  name: string;
  exerciseType: string;
  primaryMuscle: string;
  imageUrl?: string;
}

// Query parameters for getExercises
export interface GetExercisesParams {
  q?: string;
  muscle?: string;
  equipmentId?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

/**
 * Builds query string from params object, mapping equipmentId → equipment_id
 */
function buildExerciseQueryString(params?: GetExercisesParams): string {
  if (!params) return "";

  const queryParts: string[] = [];

  if (params.q) queryParts.push(`q=${encodeURIComponent(params.q)}`);
  if (params.muscle) queryParts.push(`muscle=${encodeURIComponent(params.muscle)}`);
  if (params.equipmentId) queryParts.push(`equipment_id=${encodeURIComponent(params.equipmentId)}`);
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
export async function getExercises(params?: GetExercisesParams): Promise<Exercise[]> {
  const queryString = buildExerciseQueryString(params);
  const data = await requestJson<ExerciseApiResponse>(`/v1/exercises${queryString}`, {
    method: "GET",
  });
  return (data.items || [])
    .filter((item) => item.is_active !== false)
    .map(mapApiItemToExercise);
}

/**
 * Fetches user's favorite exercises and returns their IDs
 * GET /v1/exercises/favorites
 */
export async function getFavoriteExercises(token: string): Promise<string[]> {
  const data = await requestJson<ExerciseApiResponse>("/v1/exercises/favorites", {
    method: "GET",
    token,
  });
  return (data.items || []).map((item) => item.id);
}

/**
 * Adds an exercise to user's favorites
 * POST /v1/exercises/{id}/favorite
 */
export async function favoriteExercise(id: string, token: string): Promise<void> {
  await requestJson(`/v1/exercises/${id}/favorite`, {
    method: "POST",
    token,
  });
}

/**
 * Removes an exercise from user's favorites
 * DELETE /v1/exercises/{id}/favorite
 */
export async function unfavoriteExercise(id: string, token: string): Promise<void> {
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
    .filter((e) => e.exerciseType === "strength" || e.exerciseType === "accessory")
    .slice(0, 5);
}

/**
 * Returns first 5 bodyweight exercises for the Bodyweight preview section
 */
export function getBodyweightPreview(exercises: Exercise[]): Exercise[] {
  return exercises.filter((e) => e.exerciseType === "bodyweight").slice(0, 5);
}

