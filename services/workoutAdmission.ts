import type { WorkoutDay } from "@/interfaces/workouts";
import { loadActiveWorkout, saveActiveWorkout } from "@/utils/activeWorkoutStore";
import { prepareWorkoutStart, PreWorkoutOrderConflict } from "@/utils/preWorkoutOrderStore";
import { getFeatureFlags } from "./featureFlagService";
import { HttpError } from "./httpClient";
import { createSession, type SessionResponse } from "./workoutLoggingService";
import { knownSubscriptionFlags, rememberSubscriptionFlags } from "./subscriptionFlagState";

export async function ensureWorkoutAdmission(token: string | null, userId: string, workout: WorkoutDay, isCurrent: () => boolean): Promise<SessionResponse | null> {
  const existing = await loadActiveWorkout(userId);
  if (!isCurrent() || existing?.serverSessionId) return null;
  if (!token) {
    if (knownSubscriptionFlags(userId)?.subscriptions_enforcement_enabled === false) return null;
    throw new HttpError("Reconnect to verify access before starting a new workout. Your saved workouts remain available.", 503, { code: "subscription_verification_unavailable" });
  }
  let flags;
  try { flags = await getFeatureFlags(token); }
  catch (error) {
    if (!isCurrent()) return null;
    if (error instanceof HttpError && error.status === 401) throw error;
    if (knownSubscriptionFlags(userId)?.subscriptions_enforcement_enabled === false) return null;
    throw new HttpError("Reconnect to verify access before starting a new workout. Your entries are safe.", 503, { code: "subscription_verification_unavailable" });
  }
  if (!isCurrent()) return null;
  rememberSubscriptionFlags(userId, flags.flags);
  if (!flags.flags.subscriptions_enforcement_enabled) return null;
  const baseline = await prepareWorkoutStart(userId, workout, undefined, isCurrent);
  if (!baseline || !isCurrent()) return null;
  if (baseline.workoutDayId !== workout.workoutDayId) throw new PreWorkoutOrderConflict("Resume your saved workout before starting another one.", baseline.serverSessionId);
  const session = await createSession(token, baseline.workoutDayId, baseline.workoutDate, baseline.dayType, baseline.clientSessionId);
  if (!isCurrent()) return null;
  const admitted = await prepareWorkoutStart(userId, workout, session, isCurrent);
  if (!admitted || !isCurrent()) return null;
  await saveActiveWorkout({ ...admitted, revision: admitted.revision + 1 }, isCurrent);
  return session;
}
