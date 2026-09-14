import type { ProgramGoal, ProgramLevel } from "@/interfaces/programs";
import { localDateIso } from "@/utils/localDate";

export const PROGRAM_GOAL_LABELS: Record<ProgramGoal, string> = {
  "build-muscle": "Build muscle",
  "get-stronger": "Get stronger",
  "general-fitness": "General fitness",
  conditioning: "Conditioning",
};

export const PROGRAM_LEVEL_LABELS: Record<ProgramLevel, string> = {
  "no-experience": "New to training",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function formatProgramMeta(frequency: number, durationMinutes: number) {
  return `${frequency} days per week · ${durationMinutes} min`;
}

export function todayIso() {
  return localDateIso();
}
