import type { Href } from "expo-router";

import type { CoachTarget } from "@/interfaces/coach";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isCoachTarget(target: unknown): target is CoachTarget {
  if (!target || typeof target !== "object" || !("type" in target)) return false;
  const candidate = target as Record<string, unknown>;
  switch (candidate.type) {
    case "none":
      return true;
    case "active_workout":
    case "completed_session":
      return isNonEmptyString(candidate.sessionId);
    case "planned_workout":
      return isNonEmptyString(candidate.workoutDayId) && isNonEmptyString(candidate.weekStart);
    case "program_detail":
      return isNonEmptyString(candidate.templateId);
    case "program_review":
      return isNonEmptyString(candidate.activationId) &&
        (candidate.templateId == null || isNonEmptyString(candidate.templateId));
    case "settings":
      return candidate.section === "notifications" || candidate.section === "training_preferences" || candidate.section === "health";
    default:
      return false;
  }
}

export function coachTargetHref(target: unknown): Href | null {
  if (!isCoachTarget(target)) return null;
  switch (target.type) {
    case "active_workout":
      return {
        pathname: "/workout/active",
        params: { sessionId: target.sessionId },
      };
    case "planned_workout":
      return {
        pathname: "/workouts/[workoutDayId]",
        params: {
          workoutDayId: target.workoutDayId,
          weekStart: target.weekStart,
        },
      };
    case "completed_session":
      return {
        pathname: "/workout/history/[sessionId]",
        params: { sessionId: target.sessionId },
      };
    case "program_detail":
      return {
        pathname: "/programs/[templateId]",
        params: { templateId: target.templateId },
      };
    case "program_review":
      return target.templateId
        ? {
            pathname: "/programs/activate",
            params: {
              templateId: target.templateId,
              applyMode: "now",
              review: "equipment",
            },
          }
        : "/programs";
    case "settings":
      if (target.section === "training_preferences") return "/settings/training-preferences";
      if (target.section === "health") return "/settings/health" as Href;
      return "/settings";
    case "none":
      return null;
  }
}
