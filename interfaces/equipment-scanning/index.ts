import type { ExerciseContent, ExerciseLoadProfile } from "@/interfaces/exercises/types";
export interface EquipmentSummary { id: string; name: string }
export interface ScanVersions { catalog_version: string; equipment_revision: string; mapping_revision: string; resolver_version: string }
export interface ExerciseOption {
  exercise_id: string; name: string; compatibility: "compatible" | "needs_equipment_confirmation";
  required_equipment: EquipmentSummary[]; missing_equipment: EquipmentSummary[]; missing_equipment_ids: string[];
  guidance_available: boolean; approved_video_available: boolean;
  tracking_mode: "reps" | "duration" | "distance" | null; load_profile: ExerciseLoadProfile | null;
}
export interface ScanCandidate { equipment: EquipmentSummary; confidence: { level: "high" | "medium" | "low" | "unknown"; score: number | null }; exercise_candidates: ExerciseOption[] }
export type ScanReason = "not_equipment" | "multiple_subjects" | "image_unclear" | "unsupported_equipment" | "uncertain";
export interface ScanResult { schema_version: 1; scan_id: string; status: "candidates" | "no_match"; requires_confirmation: boolean; versions: ScanVersions; candidates: ScanCandidate[]; reason: ScanReason | null; manual_search_available: true }
export interface EquipmentSearchPage { schema_version: 1; versions: ScanVersions; items: EquipmentSummary[]; next_cursor: string | null }
export interface ExerciseOptionsPage { schema_version: 1; versions: ScanVersions; equipment: EquipmentSummary; items: ExerciseOption[]; next_cursor: string | null }
export interface ExerciseGuidance {
  schema_version: 1; exercise_id: string; name: string; versions: ScanVersions;
  tracking_mode: "reps" | "duration" | "distance" | null; load_profile: ExerciseLoadProfile | null;
  instructions: { status: "published" | "instructions_unavailable"; content_version: string | null; content: ExerciseContent | null };
  video: { status: "approved" | "video_unavailable"; asset_id: string | null; url: string | null; mime_type: "video/mp4" | "video/webm" | null; poster_url: string | null };
}
export interface ScanErrorDetail { code: string; detail: string; request_id: string; retry_after_seconds: number | null; attempt_key: string | null }
export interface ScanAttemptStatus { schema_version: 1; attempt_key: string; status: "processing" | "completed" | "failed" | "unknown"; retry_after_seconds: number | null; result: ScanResult | null; error: ScanErrorDetail | null }
