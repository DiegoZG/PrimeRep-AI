import type {
  Exercise,
  ExerciseApiItem,
  ExerciseApiResponse,
  ExerciseDetail,
  ExerciseDetailApiResponse,
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
export function mapApiItemToExercise(apiItem: ExerciseApiItem): Exercise {
  const source = apiItem.source === "custom" || apiItem.source === "user" ? "custom" : "seed";
  return {
    id: apiItem.id,
    name: apiItem.name,
    exerciseType: apiItem.exerciseType ?? apiItem.exercise_type,
    primaryMuscle: apiItem.primaryMuscle ?? apiItem.primary_muscle,
    imageUrl: apiItem.imageUrl ?? apiItem.image_url ?? undefined,
    isFavorited: apiItem.isFavorited ?? apiItem.is_favorited ?? false,
    secondaryMuscles: apiItem.secondaryMuscles ?? apiItem.secondary_muscles,
    equipmentIds: apiItem.equipmentIds ?? apiItem.required_equipment_ids,
    source,
    isEditable: apiItem.isEditable ?? apiItem.is_editable,
    contentVersion: apiItem.content_version,
    trackingMode: apiItem.tracking_mode,
    movementPattern: apiItem.movement_pattern,
    loadProfile: apiItem.load_profile,
  };
}

/**
 * Maps backend ExerciseDetailApiResponse to frontend ExerciseDetail model
 * Backend returns snake_case fields
 */
export function mapApiDetailToExerciseDetail(
  apiDetail: ExerciseDetailApiResponse
): ExerciseDetail {
  return {
    id: String(apiDetail.id),
    name: apiDetail.name,
    exerciseType: apiDetail.exerciseType ?? apiDetail.exercise_type,
    primaryMuscle: apiDetail.primaryMuscle ?? apiDetail.primary_muscle,
    secondaryMuscles: apiDetail.secondaryMuscles ?? apiDetail.secondary_muscles ?? [],
    imageUrl: apiDetail.imageUrl ?? apiDetail.image_url ?? undefined,
    demoVideoUrl: apiDetail.demoVideoUrl ?? apiDetail.demo_video_url ?? undefined,
    equipmentIds:
      apiDetail.requiredEquipmentIds ?? apiDetail.equipmentIds ?? apiDetail.required_equipment_ids ?? apiDetail.equipment_ids ?? [],
    howTo: apiDetail.structured_content?.steps.map((step, index) => `${index + 1}. ${step}`).join("\n\n") || apiDetail.how_to || apiDetail.instructions || undefined,
    whyItWorks: apiDetail.structured_content?.benefits || apiDetail.why_it_works || undefined,
    commonMistakes: apiDetail.structured_content?.mistakes.join("\n\n") || apiDetail.common_mistakes || undefined,
    beginnerNotes: apiDetail.structured_content?.beginner_guidance || apiDetail.beginner_notes || undefined,
    isFavorited: apiDetail.isFavorited ?? apiDetail.is_favorited ?? false,
    source: apiDetail.source === "custom" || apiDetail.source === "user" ? "custom" : "seed",
    isEditable: apiDetail.isEditable ?? apiDetail.is_editable,
    instructions: apiDetail.instructions ?? undefined,
    contentVersion: apiDetail.content_version,
    structuredContent: apiDetail.structured_content,
    loadProfile: apiDetail.load_profile,
    media: apiDetail.media,
  };
}

/**
 * Fetches exercises from the catalog with optional filters
 * GET /v1/exercises
 */
export async function getExercises(
  params?: GetExercisesParams,
  token?: string | null
): Promise<Exercise[]> {
  return (await getExercisePage(params, token)).items;
}

export async function getExercisePage(params?: GetExercisesParams, token?: string | null) {
  const queryString = buildExerciseQueryString(params);
  const data = await requestJson<ExerciseApiResponse>(
    `/v1/exercises${queryString}`,
    {
      method: "GET",
      token,
    }
  );
  const items = (data.items || [])
    .filter((item) => item.is_active !== false)
    .map(mapApiItemToExercise);
  return {
    items,
    limit: data.limit ?? params?.limit ?? 50,
    offset: data.offset ?? params?.offset ?? 0,
    total: data.total,
    has_more: data.has_more ?? ((data.items || []).length === (params?.limit ?? 50)),
    catalog_version: data.catalog_version,
  };
}

/**
 * Fetches user's favorite exercises and returns their IDs
 * GET /v1/exercises/favorites
 */
export async function getFavoriteExercises(token: string): Promise<string[]> {
  const exercises = await getFavoriteExerciseItems(token);
  return exercises.map((item) => item.id);
}

export async function getFavoriteExerciseItems(token: string): Promise<Exercise[]> {
  const data = await requestJson<ExerciseApiResponse>(
    "/v1/exercises/favorites",
    {
      method: "GET",
      token,
    }
  );
  return (data.items || []).map(mapApiItemToExercise);
}

export async function createCustomExercise(
  token: string,
  payload: import("@/interfaces/programs").CustomExercisePayload,
): Promise<ExerciseDetail> {
  const data = await requestJson<ExerciseDetailApiResponse>(
    "/v1/users/me/exercises",
    { method: "POST", token, body: payload },
  );
  return mapApiDetailToExerciseDetail(data);
}

export async function updateCustomExercise(
  token: string,
  exerciseId: string,
  payload: import("@/interfaces/programs").CustomExercisePayload,
): Promise<ExerciseDetail> {
  const data = await requestJson<ExerciseDetailApiResponse>(
    `/v1/users/me/exercises/${encodeURIComponent(exerciseId)}`,
    { method: "PUT", token, body: payload },
  );
  return mapApiDetailToExerciseDetail(data);
}

export async function archiveCustomExercise(token: string, exerciseId: string): Promise<void> {
  await requestJson<void>(
    `/v1/users/me/exercises/${encodeURIComponent(exerciseId)}`,
    { method: "DELETE", token },
  );
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

/**
 * Fetches a single exercise by ID
 * GET /v1/exercises/{exerciseId}
 */
export async function getExerciseById(
  exerciseId: string,
  token?: string | null
): Promise<ExerciseDetail> {
  const data = await requestJson<ExerciseDetailApiResponse>(
    `/v1/exercises/${exerciseId}`,
    {
      method: "GET",
      token,
    }
  );
  return mapApiDetailToExerciseDetail(data);
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
  params?: Omit<GetExercisesParams, "type">,
  token?: string | null,
): Promise<Exercise[]> {
  const results = await Promise.all(
    types.map((type) => getExercises({ ...params, type }, token))
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
