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
