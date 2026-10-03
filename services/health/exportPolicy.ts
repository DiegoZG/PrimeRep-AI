import type { HealthWorkoutExport } from './types';
import type { SessionResponse } from '@/services/workoutLoggingService';

export function workoutExportFromSession(session: SessionResponse, localTimes?: { startedAt: number; finishedAt: number }): HealthWorkoutExport | null {
  if (session.status !== 'completed' || !session.completedAt) return null;
  const start = localTimes?.startedAt ?? Date.parse(session.startedAt);
  const end = localTimes?.finishedAt ?? Date.parse(session.completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  const types = (session.workoutSnapshot?.exerciseBlocks ?? [])
    .flatMap((block) => block.items.map((item) => item.exercise.exerciseType));
  const hasCardio = types.includes('cardio');
  const hasStrength = types.some((type) => type === 'strength' || type === 'accessory' || type === 'bodyweight');
  const activityType = hasCardio && hasStrength ? 'mixed' : hasStrength && !hasCardio && types.every((type) => type === 'strength' || type === 'accessory' || type === 'bodyweight') ? 'strength' : 'other';

  return {
    sessionId: session.id,
    version: 1,
    startTime: localTimes ? new Date(start).toISOString() : session.startedAt,
    endTime: localTimes ? new Date(end).toISOString() : session.completedAt,
    title: session.summary.title,
    activityType,
  };
}

export function workoutExportFingerprint(workout: HealthWorkoutExport): string {
  return JSON.stringify([workout.sessionId, workout.startTime, workout.endTime, workout.title, workout.activityType]);
}
