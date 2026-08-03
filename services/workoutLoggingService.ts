import { requestJson } from "./httpClient";

// ── API Response Types ───────────────────────────────────────────────────────

export interface SetLogResponse {
  id: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weightKg: number | null;
  loggedAt: string;
}

export interface SessionResponse {
  id: string;
  workoutDayId: string;
  workoutDate: string;
  dayType: string;
  completedAt: string | null;
  createdAt: string;
  setLogs: SetLogResponse[];
}

export interface SessionSummary {
  id: string;
  workoutDayId: string;
  workoutDate: string;
  dayType: string;
  completedAt: string | null;
  setCount: number;
}

export interface SessionListResponse {
  items: SessionSummary[];
  total: number;
}

export interface StatsResponse {
  streak: number;
  totalCompleted: number;
  prsThisWeek: number;
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
  dayType: string
): Promise<SessionResponse> {
  return requestJson<SessionResponse>("/v1/workouts/sessions", {
    method: "POST",
    token,
    body: { workoutDayId, workoutDate, dayType },
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
  weightKg?: number
): Promise<SetLogResponse> {
  return requestJson<SetLogResponse>(
    `/v1/workouts/sessions/${sessionId}/sets`,
    {
      method: "POST",
      token,
      body: { exerciseId, setNumber, reps, weightKg: weightKg ?? null },
    }
  );
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
