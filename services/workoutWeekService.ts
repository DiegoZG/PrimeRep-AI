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
import type { WorkoutPlanningChoice } from "@/utils/workoutPlanning";

export async function updateWorkoutPlanning(token: string, workoutDayId: string, choice: WorkoutPlanningChoice, dates: { weekStart: string; effectiveDate: string }): Promise<WorkoutWeekPlan> {
  const data = await requestJson<WorkoutWeekPlanApiResponse>("/v1/workouts/week/planning", {
    method: "PATCH", token, body: { workoutDayId, ...choice, ...dates },
  });
  return mapApiWeekPlan(data);
}

export async function applyWorkoutPlanningPreference(token: string, dates: { weekStart: string; effectiveDate: string }): Promise<{ weekPlan: WorkoutWeekPlan; updatedWorkoutCount: number; protectedWorkoutCount: number }> {
  const data = await requestJson<{ weekPlan: WorkoutWeekPlanApiResponse; updatedWorkoutCount: number; protectedWorkoutCount: number }>("/v1/workouts/week/apply-planning-preference", { method: "POST", token, body: dates });
  return { ...data, weekPlan: mapApiWeekPlan(data.weekPlan) };
}

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
    loadProfile: apiExercise.loadProfile,
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
      suggestedWeightKg: prescription.suggestedWeightKg ?? undefined,
      suggestedPreviousWeightKg: prescription.suggestedPreviousWeightKg ?? undefined,
      suggestedWeightReason: prescription.suggestedWeightReason ?? undefined,
    },
    exerciseRationale: apiItem.exerciseRationale ?? undefined,
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
export function mapApiWorkoutDay(apiDay: WorkoutDayApiResponse): WorkoutDay {
  return {
    workoutDayId: apiDay.workoutDayId,
    slotIndex: apiDay.slotIndex,
    date: apiDay.date,
    durationMinutes: apiDay.durationMinutes,
    planningMode: apiDay.planningMode,
    planningEditable: apiDay.planningEditable,
    timeBudgetMinutes: apiDay.timeBudgetMinutes,
    estimatedMinutes: apiDay.estimatedMinutes,
    planningSource: apiDay.planningSource,
    title: apiDay.title,
    dayType: apiDay.dayType,
    splitKey: apiDay.splitKey,
    workoutIntent: apiDay.workoutIntent ?? undefined,
    deferredMuscles: apiDay.deferredMuscles ?? [],
    unavailableMuscles: apiDay.unavailableMuscles ?? [],
    blocks: (apiDay.exerciseBlocks || []).map(mapApiBlock),
    programActivationId: apiDay.programActivationId ?? undefined,
    templateId: apiDay.templateId ?? undefined,
    templateVersion: apiDay.templateVersion ?? undefined,
    templateDayId: apiDay.templateDayId ?? undefined,
  };
}

/**
 * Maps API week plan to UI WorkoutWeekPlan model
 */
export function mapApiWeekPlan(apiPlan: WorkoutWeekPlanApiResponse): WorkoutWeekPlan {
  const end = new Date(`${apiPlan.weekStart}T00:00:00`);
  end.setDate(end.getDate() + 6);
  const fallbackWeekEnd = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  return {
    weekStart: apiPlan.weekStart,
    weekEnd: apiPlan.weekEnd ?? fallbackWeekEnd,
    workouts: (apiPlan.workouts || []).map(mapApiWorkoutDay),
    programActivationId: apiPlan.programActivationId ?? undefined,
    templateId: apiPlan.templateId ?? undefined,
    templateVersion: apiPlan.templateVersion ?? undefined,
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
  workoutDayId: string,
  weekStart?: string
): Promise<WorkoutWeekPlan> {
  const data = await requestJson<WorkoutWeekPlanApiResponse>(
    "/v1/workouts/week/skip",
    {
      method: "POST",
      token,
      body: { workoutDayId, weekStart },
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
  durationMinutes: number,
  weekStart?: string
): Promise<WorkoutWeekPlan> {
  const data = await requestJson<WorkoutWeekPlanApiResponse>(
    "/v1/workouts/week/duration",
    {
      method: "PATCH",
      token,
      body: { workoutDayId, durationMinutes, weekStart },
    }
  );

  return mapApiWeekPlan(data);
}
