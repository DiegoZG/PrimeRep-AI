import type {
  WorkoutBlock,
  WorkoutDay,
  WorkoutDayApiBlock,
  WorkoutDayApiItem,
  WorkoutDayApiResponse,
  WorkoutExercise,
  WorkoutItem,
  WorkoutWeekPlan,
  WorkoutWeekPlanApiResponse,
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
  apiExercise: WorkoutDayApiItem["exercise"]
): WorkoutExercise {
  return {
    id: String(apiExercise.id),
    name: apiExercise.name,
    exerciseType: apiExercise.exerciseType,
    primaryMuscle: apiExercise.primaryMuscle,
    secondaryMuscles: apiExercise.secondaryMuscles || [],
    imageUrl: apiExercise.imageUrl || undefined,
    demoVideoUrl: apiExercise.demoVideoUrl || undefined,
    requiredEquipmentIds: apiExercise.requiredEquipmentIds || [],
  };
}

/**
 * Maps API workout item to UI WorkoutItem model
 * Handles both `reps` (string) and `repsMin`/`repsMax` (numbers) from API
 */
function mapApiItem(apiItem: WorkoutDayApiItem): WorkoutItem {
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
    },
  };
}

/**
 * Maps API workout block to UI WorkoutBlock model
 */
function mapApiBlock(apiBlock: WorkoutDayApiBlock): WorkoutBlock {
  return {
    blockType: apiBlock.blockType,
    items: (apiBlock.items || []).map(mapApiItem),
  };
}

/**
 * Maps API workout day to UI WorkoutDay model
 */
function mapApiWorkoutDay(apiDay: WorkoutDayApiResponse): WorkoutDay {
  return {
    workoutDayId: apiDay.workoutDayId,
    slotIndex: apiDay.slotIndex,
    date: apiDay.date,
    durationMinutes: apiDay.durationMinutes,
    title: apiDay.title,
    dayType: apiDay.dayType,
    splitKey: apiDay.splitKey,
    blocks: (apiDay.exerciseBlocks || []).map(mapApiBlock),
  };
}

/**
 * Maps API week plan to UI WorkoutWeekPlan model
 */
function mapApiWeekPlan(apiPlan: WorkoutWeekPlanApiResponse): WorkoutWeekPlan {
  return {
    weekStart: apiPlan.weekStart,
    weekEnd: apiPlan.weekEnd,
    workouts: (apiPlan.workouts || []).map(mapApiWorkoutDay),
  };
}

// =============================================================================
// Query String Builder
// =============================================================================

function buildWeekQueryString(params?: {
  weekStart?: string;
  force?: boolean;
}): string {
  if (!params) return "";

  const queryParts: string[] = [];

  if (params.weekStart) {
    queryParts.push(`weekStart=${encodeURIComponent(params.weekStart)}`);
  }
  if (params.force) {
    queryParts.push("force=true");
  }

  return queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetches the workout week plan for the authenticated user
 * GET /v1/workouts/week
 *
 * @param token - Required auth token
 * @param weekStart - Optional week start date (YYYY-MM-DD), defaults to current week
 * @param force - If true, regenerates the week plan
 */
export async function getWorkoutWeek(
  token: string,
  weekStart?: string,
  force?: boolean
): Promise<WorkoutWeekPlan> {
  const queryString = buildWeekQueryString({ weekStart, force });

  const data = await requestJson<WorkoutWeekPlanApiResponse>(
    `/v1/workouts/week${queryString}`,
    {
      method: "GET",
      token,
    }
  );
  return mapApiWeekPlan(data);
}

/**
 * Skips a workout day and appends a new one
 * POST /v1/workouts/week/skip
 *
 * @param token - Required auth token
 * @param workoutDayId - The ID of the workout day to skip
 */
export async function skipWorkoutDay(
  token: string,
  workoutDayId: string
): Promise<WorkoutWeekPlan> {
  const data = await requestJson<WorkoutWeekPlanApiResponse>(
    "/v1/workouts/week/skip",
    {
      method: "POST",
      token,
      body: { workoutDayId },
    }
  );
  return mapApiWeekPlan(data);
}

/**
 * Updates the duration of a workout day (triggers week regen preserving workoutDayIds)
 * PATCH /v1/workouts/week/duration
 *
 * @param token - Required auth token
 * @param workoutDayId - The ID of the workout day to update
 * @param durationMinutes - The new duration in minutes
 */
export async function updateWorkoutDuration(
  token: string,
  workoutDayId: string,
  durationMinutes: number
): Promise<WorkoutWeekPlan> {
  const data = await requestJson<WorkoutWeekPlanApiResponse>(
    "/v1/workouts/week/duration",
    {
      method: "PATCH",
      token,
      body: { workoutDayId, durationMinutes },
    }
  );

  return mapApiWeekPlan(data);
}
