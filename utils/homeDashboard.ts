import type { CoachFeedItem, CoachNextAction } from "@/interfaces/coach";
import type { Achievements } from "@/services/profileService";
import { coachTargetHref } from "@/utils/coachNavigation";

export function selectHomeCoachItem(items: CoachFeedItem[]): CoachFeedItem | null {
  return [...items]
    .sort((a, b) => b.priority - a.priority || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
    .find((item) => !item.readAt && coachTargetHref(item.target) !== null) ?? null;
}

export function fourWeekActivity(achievements: Achievements) {
  return [...achievements.weekly_activity]
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .slice(-4);
}

export function homeWorkoutState(
  hasActiveWorkout: boolean,
  nextAction: CoachNextAction | null,
  completedCount: number | null,
): "resume" | "planned" | "first" | "complete" | "unavailable" {
  if (hasActiveWorkout) return "resume";
  if (!nextAction) return "unavailable";
  if (nextAction.type === "planned_workout" && coachTargetHref(nextAction.target)) return "planned";
  if (nextAction.type === "active_workout" && coachTargetHref(nextAction.target)) return "resume";
  if (nextAction.type === "caught_up") return completedCount === null ? "unavailable" : completedCount === 0 ? "first" : "complete";
  return "unavailable";
}
