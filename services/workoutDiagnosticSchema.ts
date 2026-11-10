import type { DiagnosticError, DiagnosticOperationType } from "@/utils/workoutDiagnosticsBridge";

export type DiagnosticEventType = "local_save" | "operation_queued" | "sync_attempt" | "sync_result" | "retry_scheduled" | "operation_terminal" | "queue_snapshot" | "finish_result" | "diagnostics_dropped";
export interface DiagnosticEvent {
  event_id: string; event_type: DiagnosticEventType; occurred_at_ms: number;
  trace_id?: string; operation_type?: DiagnosticOperationType;
  outcome?: "success" | "failure" | "acknowledged" | "superseded" | "cancelled";
  error_category?: DiagnosticError; http_status?: number; duration_ms?: number; queue_age_ms?: number;
  queue_depth?: number; unknown_age_count?: number; saved_count?: number; dropped_count?: number;
  retry_delay_ms?: number; request_attempt?: number; acknowledgment_kind?: "direct" | "reconciled";
  recovered_after_restart?: boolean; player_active?: boolean; clock_invalid?: boolean; finish_stage?: "server" | "local_cleanup";
}
export type DiagnosticPlatform = "ios" | "android" | "web";
export type DiagnosticBatch = { schema_version: 1; platform: DiagnosticPlatform; app_version: string; events: DiagnosticEvent[] };
export type DiagnosticReceipt = { enabled: boolean; accepted: number; duplicates: number; discarded: number };
export const MAX_EVENTS = 200;
export const MAX_BYTES = 128 * 1024;
export const MAX_BATCH_BYTES = 32 * 1024;
export const TTL = 7 * 86_400_000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const operations = new Set("create set update_set delete_set restore_set update_workout_note update_exercise_feedback update_exercise_note order replace complete abandon".split(" "));
const errors = new Set("network timeout auth rate_limited server validation admission_conflict storage unknown".split(" "));
const types = new Set("local_save operation_queued sync_attempt sync_result retry_scheduled operation_terminal queue_snapshot finish_result diagnostics_dropped".split(" "));
const operationEvents = new Set("operation_queued sync_attempt sync_result retry_scheduled operation_terminal".split(" "));
const results = new Set(["local_save", "sync_result", "finish_result"]);
const numbers: Record<string, number> = { occurred_at_ms: 8_640_000_000_000_000, http_status: 599, duration_ms: 86_400_000, queue_age_ms: 31_536_000_000, queue_depth: 1_000_000, unknown_age_count: 1_000_000, saved_count: 1_000_000, dropped_count: 1_000_000, retry_delay_ms: 86_400_000, request_attempt: 1_000_000 };
const allowed = new Set(["event_id", "event_type", "trace_id", "operation_type", "outcome", "error_category", "acknowledgment_kind", "recovered_after_restart", "player_active", "clock_invalid", "finish_stage", ...Object.keys(numbers)]);
export function validRelease(value: unknown): value is string { return typeof value === "string" && /^(?:unknown|[0-9][0-9A-Za-z.+-]{0,63})$/.test(value); }
export function validUuid(value: unknown): value is string { return typeof value === "string" && uuid.test(value); }
export function jsonBytes(value: unknown) {
  let bytes = 0;
  for (const character of JSON.stringify(value)) {
    const code = character.codePointAt(0)!;
    bytes += code < 128 ? 1 : code < 2048 ? 2 : code < 65536 ? 3 : 4;
  }
  return bytes;
}
export function validEvent(value: unknown): value is DiagnosticEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  if (Object.keys(event).some((key) => !allowed.has(key)) || !validUuid(event.event_id) || !types.has(event.event_type as string)) return false;
  if (event.occurred_at_ms == null) return false;
  for (const [key, max] of Object.entries(numbers)) if (event[key] !== undefined && (typeof event[key] !== "number" || !Number.isInteger(event[key]) || (event[key] as number) < (key === "http_status" ? 100 : 0) || (event[key] as number) > max)) return false;
  for (const key of ["recovered_after_restart", "player_active", "clock_invalid"]) if (event[key] !== undefined && typeof event[key] !== "boolean") return false;
  if (event.trace_id !== undefined && !validUuid(event.trace_id)) return false;
  if (event.operation_type !== undefined && !operations.has(event.operation_type as string)) return false;
  if (event.error_category !== undefined && !errors.has(event.error_category as string)) return false;
  if (operationEvents.has(event.event_type as string) && (!validUuid(event.trace_id) || !operations.has(event.operation_type as string))) return false;
  if (results.has(event.event_type as string) && event.outcome !== "success" && event.outcome !== "failure") return false;
  if (event.event_type === "local_save" && event.outcome === "success" && !(Number(event.saved_count) > 0)) return false;
  if (event.event_type === "operation_terminal") {
    if (!["acknowledged", "superseded", "cancelled"].includes(event.outcome as string)) return false;
    if (event.outcome === "acknowledged" && !["direct", "reconciled"].includes(event.acknowledgment_kind as string)) return false;
  } else if (event.outcome !== undefined && !results.has(event.event_type as string)) return false;
  if (event.acknowledgment_kind !== undefined && !(event.event_type === "operation_terminal" && event.outcome === "acknowledged" && ["direct", "reconciled"].includes(event.acknowledgment_kind as string))) return false;
  if (event.error_category !== undefined && event.outcome !== "failure" && event.event_type !== "retry_scheduled") return false;
  if (event.event_type === "queue_snapshot" && event.queue_depth === undefined) return false;
  if (event.unknown_age_count !== undefined && event.queue_depth !== undefined && Number(event.unknown_age_count) > Number(event.queue_depth)) return false;
  if (event.event_type === "diagnostics_dropped" && event.dropped_count === undefined) return false;
  if (event.event_type === "finish_result" && !["server", "local_cleanup"].includes(event.finish_stage as string)) return false;
  if (event.finish_stage !== undefined && event.event_type !== "finish_result") return false;
  return !(event.clock_invalid && event.queue_age_ms !== undefined);
}
