export type CoachFeedItemKind =
  | "progression"
  | "recovery"
  | "missed_workout"
  | "personal_record"
  | "consistency"
  | "program_review";

export type CoachItemDetailKind = CoachFeedItemKind | "upcoming_workout";

export type CoachTarget =
  | { type: "none" }
  | { type: "active_workout"; sessionId: string }
  | { type: "planned_workout"; workoutDayId: string; weekStart: string }
  | { type: "completed_session"; sessionId: string }
  | { type: "program_detail"; templateId: string }
  | { type: "program_review"; activationId: string; templateId?: string | null }
  | { type: "settings"; section: "notifications" | "training_preferences" };

export interface CoachNextAction {
  type: "active_workout" | "planned_workout" | "caught_up";
  title: string;
  body: string;
  target: CoachTarget;
}

export interface CoachItemDetail {
  id: string;
  kind: CoachItemDetailKind;
  priority: number;
  title: string;
  body: string;
  detail: string | null;
  target: CoachTarget;
  weightData?: {
    context: "target" | "record";
    exerciseName: string;
    weightKg: number;
    currentWeightKg?: number | null;
    recommendation?: "increase" | "hold" | "deload" | null;
    equipmentIds: string[];
    loadProfile?: import("@/interfaces/exercises/types").ExerciseLoadProfile | null;
  } | null;
  isAiAssisted: boolean;
  readAt: string | null;
  createdAt: string;
  expiresAt: string;
}

export type CoachFeedItem = Omit<CoachItemDetail, "kind"> & {
  kind: CoachFeedItemKind;
};

export interface CoachFeedResponse {
  nextAction: CoachNextAction;
  items: CoachFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
  generatedAt: string;
}

export interface CoachPreferences {
  notificationsEnabled: boolean;
  reminderTime: string;
  timeZone: string;
}

export type CoachReadReason = "expanded" | "primaryAction";
export type CoachFeedView = "now" | "yesterday" | "last7Days";

const FEED_ITEM_KINDS: ReadonlySet<string> = new Set([
  "progression",
  "recovery",
  "missed_workout",
  "personal_record",
  "consistency",
  "program_review",
]);

export function isCoachFeedItem(item: CoachItemDetail): item is CoachFeedItem {
  return FEED_ITEM_KINDS.has(item.kind);
}
