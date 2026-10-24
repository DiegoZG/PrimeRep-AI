import { requestJson } from "./httpClient";
import type { Exercise, ExerciseApiItem } from "@/interfaces/exercises";
import { mapApiItemToExercise } from "./exerciseService";
import type { WorkoutDayApiItem, WorkoutDayApiResponse } from "@/interfaces/workouts";

// ── API Response Types ───────────────────────────────────────────────────────

export interface SetLogResponse {
  id: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weightKg: number | null;
  loggedAt: string;
  updatedAt: string;
  version: number;
}

export interface ExerciseFeedbackResponse {
  exerciseId: string;
  effort: "easy" | "right" | "hard" | null;
  rir: number | null;
}

export interface WorkoutSessionSummary {
  title: string;
  durationSeconds: number;
  completedSetCount: number;
  totalVolumeKg: number;
}

export interface SessionResponse {
  id: string;
  workoutDayId: string;
  workoutDate: string;
  dayType: string;
  workoutSnapshot: WorkoutDayApiResponse | null;
  effectiveWorkout?: WorkoutDayApiResponse | null;
  arrangementRevision?: number;
  recoveryRequired: boolean;
  clientSessionId: string | null;
  status: "in_progress" | "completed" | "abandoned";
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  setLogs: SetLogResponse[];
  deletedSetLogs: SetLogResponse[];
  workoutNote: string | null;
  exerciseFeedback: ExerciseFeedbackResponse[];
  summary: WorkoutSessionSummary;
}

export interface SessionSummary {
  id: string;
  workoutDayId: string;
  workoutDate: string;
  dayType: string;
  completedAt: string | null;
  setCount: number;
  title: string;
  totalVolumeKg: number;
}

export interface SessionListResponse {
  items: SessionSummary[];
  total: number;
}

export interface StatsResponse {
  streak: number;
  totalCompleted: number;
  prsThisWeek: number;
  /** All-time weight x reps across completed sessions. Excludes unweighted sets. */
  totalVolumeKg: number;
}

export interface LastSet {
  id: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weightKg: number | null;
  loggedAt: string;
}

export interface LastSetsResponse {
  items: LastSet[];
}

// ── API Functions ────────────────────────────────────────────────────────────

/**
 * Create a workout session when the user taps "Start Workout".
 * POST /v1/workouts/sessions
 */
export async function createSession(
  token: string,
  workoutDayId: string,
  workoutDate: string,
  dayType: string,
  clientSessionId: string
): Promise<SessionResponse> {
  return requestJson<SessionResponse>("/v1/workouts/sessions", {
    method: "POST",
    token,
    body: { workoutDayId, workoutDate, dayType, clientSessionId },
  });
}

/**
 * Log one completed set within a session.
 * POST /v1/workouts/sessions/{sessionId}/sets
 */
export async function logSet(
  token: string,
  sessionId: string,
  exerciseId: string,
  setNumber: number,
  reps: number,
  weightKg: number | undefined,
  clientOperationId: string
): Promise<SetLogResponse> {
  return requestJson<SetLogResponse>(
    `/v1/workouts/sessions/${sessionId}/sets`,
    {
      method: "POST",
      token,
      body: { exerciseId, setNumber, reps, weightKg: weightKg ?? null, clientOperationId },
    }
  );
}

export async function updateLoggedSet(
  token: string,
  sessionId: string,
  setLogId: string,
  reps: number | undefined,
  weightKg: number | null | undefined,
  expectedVersion: number,
  clientOperationId: string
): Promise<SetLogResponse> {
  const body: Record<string, unknown> = { clientOperationId, expectedVersion };
  if (reps !== undefined) body.reps = reps;
  if (weightKg !== undefined) body.weightKg = weightKg;
  return requestJson<SetLogResponse>(`/v1/workouts/sessions/${sessionId}/sets/${setLogId}`, {
    method: "PATCH",
    token,
    body,
  });
}

export async function deleteLoggedSet(
  token: string,
  sessionId: string,
  setLogId: string,
  clientOperationId: string
): Promise<void> {
  await requestJson<null>(
    `/v1/workouts/sessions/${sessionId}/sets/${setLogId}?clientOperationId=${encodeURIComponent(clientOperationId)}`,
    { method: "DELETE", token }
  );
}

export async function restoreLoggedSet(
  token: string,
  sessionId: string,
  setLogId: string,
  clientOperationId: string
): Promise<SetLogResponse> {
  return requestJson<SetLogResponse>(`/v1/workouts/sessions/${sessionId}/sets/${setLogId}/restore`, {
    method: "POST",
    token,
    body: { clientOperationId },
  });
}

export async function updateWorkoutNote(
  token: string,
  sessionId: string,
  note: string | null,
  clientOperationId: string
): Promise<SessionResponse> {
  return requestJson<SessionResponse>(`/v1/workouts/sessions/${sessionId}/note`, {
    method: "PUT",
    token,
    body: { note, clientOperationId },
  });
}

export async function updateExerciseFeedback(
  token: string,
  sessionId: string,
  exerciseId: string,
  effort: "easy" | "right" | "hard" | null,
  rir: number | null,
  clientOperationId: string
): Promise<ExerciseFeedbackResponse> {
  return requestJson<ExerciseFeedbackResponse>(
    `/v1/workouts/sessions/${sessionId}/exercises/${exerciseId}/feedback`,
    { method: "PUT", token, body: { effort, rir, clientOperationId } }
  );
}

export interface UserExerciseNoteResponse { exerciseId: string; note: string }

export async function getUserExerciseNote(token: string, exerciseId: string): Promise<UserExerciseNoteResponse | null> {
  return requestJson<UserExerciseNoteResponse | null>(`/v1/users/me/exercises/${exerciseId}/note`, { method: "GET", token });
}

export async function updateUserExerciseNote(
  token: string, exerciseId: string, note: string | null
): Promise<UserExerciseNoteResponse | null> {
  return requestJson<UserExerciseNoteResponse | null>(`/v1/users/me/exercises/${exerciseId}/note`, {
    method: "PUT", token, body: { note },
  });
}

/**
 * Mark a session as complete.
 * PATCH /v1/workouts/sessions/{sessionId}/complete
 */
export async function completeSession(
  token: string,
  sessionId: string
): Promise<SessionResponse> {
  return requestJson<SessionResponse>(
    `/v1/workouts/sessions/${sessionId}/complete`,
    { method: "PATCH", token }
  );
}

export async function abandonSession(token: string, sessionId: string): Promise<SessionResponse> {
  return requestJson<SessionResponse>(`/v1/workouts/sessions/${sessionId}/abandon`, {
    method: "PATCH",
    token,
  });
}

export async function getActiveSession(token: string): Promise<SessionResponse | null> {
  return requestJson<SessionResponse | null>("/v1/workouts/sessions/active", { method: "GET", token });
}

export async function getSession(token: string, sessionId: string): Promise<SessionResponse> {
  return requestJson<SessionResponse>(`/v1/workouts/sessions/${sessionId}`, { method: "GET", token });
}

/**
 * List past sessions for the authenticated user.
 * GET /v1/workouts/sessions
 */
export async function listSessions(
  token: string,
  limit = 20,
  offset = 0
): Promise<SessionListResponse> {
  return requestJson<SessionListResponse>(
    `/v1/workouts/sessions?limit=${limit}&offset=${offset}`,
    { method: "GET", token }
  );
}

export async function listCompletedSessions(
  token: string,
  limit = 20,
  offset = 0
): Promise<SessionListResponse> {
  return requestJson<SessionListResponse>(
    `/v1/workouts/sessions/history?limit=${limit}&offset=${offset}`,
    { method: "GET", token }
  );
}

/**
 * Get Quick Stats for the authenticated user.
 * GET /v1/workouts/sessions/stats
 */
export async function getStats(token: string): Promise<StatsResponse> {
  return requestJson<StatsResponse>("/v1/workouts/sessions/stats", {
    method: "GET",
    token,
  });
}

/**
 * Get the most recent logged sets for a single exercise (used to pre-fill
 * weight/reps and detect PRs).
 * GET /v1/exercises/{exerciseId}/last-sets?limit=3
 */
export async function getLastSets(
  token: string,
  exerciseId: string,
  limit = 3
): Promise<LastSet[]> {
  const data = await requestJson<LastSetsResponse>(
    `/v1/exercises/${exerciseId}/last-sets?limit=${limit}`,
    { method: "GET", token }
  );
  return data.items || [];
}

/**
 * Fetches last-sets for many exercises in parallel, at the start of a
 * session, so the player can pre-fill inputs and detect PRs without
 * refetching per-exercise while the user navigates the player.
 * Failures for an individual exercise are swallowed (fall back to []) so one
 * bad lookup doesn't block the whole workout from starting.
 */
export async function fetchLastSetsForExercises(
  token: string,
  exerciseIds: string[]
): Promise<Record<string, LastSet[]>> {
  const uniqueIds = Array.from(new Set(exerciseIds));

  const results = await Promise.all(
    uniqueIds.map(async (exerciseId) => {
      try {
        const items = await getLastSets(token, exerciseId);
        return [exerciseId, items] as const;
      } catch (err) {
        console.warn(`Failed to fetch last sets for ${exerciseId}:`, err);
        return [exerciseId, [] as LastSet[]] as const;
      }
    })
  );

  const map: Record<string, LastSet[]> = {};
  for (const [exerciseId, items] of results) {
    map[exerciseId] = items;
  }
  return map;
}

export interface ExerciseOrderPreview {
  arrangementRevision: number;
  exerciseIds: string[];
  targetsChanged: boolean;
  targetChanges: { exerciseId: string; fromBlockType: string; toBlockType: string;
    before: WorkoutDayApiItem["prescription"]; after: WorkoutDayApiItem["prescription"] }[];
  effectiveWorkout: WorkoutDayApiResponse;
  message: string;
}

export async function getReplacementCandidates(token: string, sessionId: string, exerciseId: string): Promise<Exercise[]> {
  const result = await requestJson<{ items: ExerciseApiItem[] }>(`/v1/workouts/sessions/${sessionId}/exercises/${encodeURIComponent(exerciseId)}/replacement-candidates`, { method: "GET", token });
  return result.items.map(mapApiItemToExercise);
}

export function replaceSessionExercise(token: string, sessionId: string, exerciseId: string, replacementExerciseId: string, expectedRevision: number, clientOperationId: string): Promise<SessionResponse> {
  return requestJson(`/v1/workouts/sessions/${sessionId}/exercises/${encodeURIComponent(exerciseId)}/replace`, { method: "POST", token, body: { replacementExerciseId, expectedRevision, clientOperationId } });
}

export function previewExerciseOrder(token: string, sessionId: string, exerciseIds: string[], expectedRevision: number): Promise<ExerciseOrderPreview> {
  return requestJson(`/v1/workouts/sessions/${sessionId}/order/preview`, { method: "POST", token, body: { exerciseIds, expectedRevision } });
}

export function updateExerciseOrder(token: string, sessionId: string, exerciseIds: string[], expectedRevision: number, clientOperationId: string, applyRevisedTargets: boolean): Promise<SessionResponse> {
  return requestJson(`/v1/workouts/sessions/${sessionId}/order`, { method: "PATCH", token, body: { exerciseIds, expectedRevision, clientOperationId, applyRevisedTargets } });
}
