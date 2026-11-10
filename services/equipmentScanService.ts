import { API_BASE_URL } from "@/config/api";
import type { EquipmentSearchPage, EquipmentSummary, ExerciseGuidance, ExerciseOption, ExerciseOptionsPage, ScanAttemptStatus, ScanErrorDetail, ScanResult, ScanVersions } from "@/interfaces/equipment-scanning";
import { uploadScanPhoto } from "./equipmentScanUpload";

export class EquipmentScanError extends Error {
  constructor(public code: string, message: string, public status?: number, public retryAfter: number | null = null, public attemptKey: string | null = null) { super(message); this.name = "EquipmentScanError"; }
}
const invalid = () => new EquipmentScanError("scan_invalid_response", "This result couldn’t be verified. Search for the equipment or try again.");
const object = (value: unknown): Record<string, any> => { if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(); return value as Record<string, any>; };
const text = (value: unknown, max = 160): string => { if (typeof value !== "string" || !value.trim() || value.length > max) throw invalid(); return value; };
const list = <T>(value: unknown, max: number, parse: (item: unknown) => T): T[] => { if (!Array.isArray(value) || value.length > max) throw invalid(); return value.map(parse); };
function versioned(value: unknown) { const data = object(value); if (data.schema_version !== 1) throw invalid(); return data; }
function versions(value: unknown): ScanVersions { const v = object(value); return { catalog_version: text(v.catalog_version, 128), equipment_revision: text(v.equipment_revision, 128), mapping_revision: text(v.mapping_revision, 128), resolver_version: text(v.resolver_version, 64) }; }
function equipment(value: unknown): EquipmentSummary { const v = object(value); return { id: text(v.id, 120), name: text(v.name) }; }
const cursor = (value: unknown) => value == null ? null : text(value, 2048);
const bool = (value: unknown): boolean => { if (typeof value !== "boolean") throw invalid(); return value; };
function tracking(value: unknown): "reps" | "duration" | "distance" | null { if (value == null) return null; if (!["reps", "duration", "distance"].includes(String(value))) throw invalid(); return value as "reps" | "duration" | "distance"; }
function loadProfile(value: unknown): ExerciseOption["load_profile"] {
  if (value == null) return null; const v = object(value);
  if (!["per_implement", "total", "machine", "bodyweight", "added", "assistance"].includes(v.basis) || ![1, 2].includes(v.implement_count)) throw invalid();
  return { basis: v.basis, implement_count: v.implement_count };
}
function option(value: unknown): ExerciseOption {
  const v = object(value); const required = list(v.required_equipment, 32, equipment); const missing = list(v.missing_equipment, 32, equipment); const ids = list(v.missing_equipment_ids, 32, (id) => text(id, 120));
  if (!["compatible", "needs_equipment_confirmation"].includes(v.compatibility) || JSON.stringify(ids) !== JSON.stringify(missing.map((item) => item.id)) || missing.some((item) => !required.some((r) => r.id === item.id)) || (v.compatibility === "compatible") !== (missing.length === 0)) throw invalid();
  return { exercise_id: text(v.exercise_id, 120), name: text(v.name), compatibility: v.compatibility, required_equipment: required, missing_equipment: missing, missing_equipment_ids: ids, guidance_available: bool(v.guidance_available), approved_video_available: bool(v.approved_video_available), tracking_mode: tracking(v.tracking_mode), load_profile: loadProfile(v.load_profile) };
}
export function normalizeScanResult(value: unknown): ScanResult {
  const v = versioned(value); const candidates = list(v.candidates, 5, (raw) => {
    const c = object(raw); const confidence = object(c.confidence);
    if (!["high", "medium", "low", "unknown"].includes(confidence.level)) throw invalid();
    if (confidence.score != null && (typeof confidence.score !== "number" || !Number.isFinite(confidence.score) || confidence.score < 0 || confidence.score > 1)) throw invalid();
    return { equipment: equipment(c.equipment), confidence: { level: confidence.level, score: confidence.score ?? null }, exercise_candidates: list(c.exercise_candidates, 3, option) };
  });
  if (v.manual_search_available !== true || !["candidates", "no_match"].includes(v.status) || new Set(candidates.map((c) => c.equipment.id)).size !== candidates.length) throw invalid();
  if (v.status === "candidates" ? !candidates.length || v.requires_confirmation !== true || v.reason != null : candidates.length > 0 || v.requires_confirmation !== false || !["not_equipment", "multiple_subjects", "image_unclear", "unsupported_equipment", "uncertain"].includes(v.reason)) throw invalid();
  return { schema_version: 1, scan_id: text(v.scan_id, 64), status: v.status, requires_confirmation: v.requires_confirmation, versions: versions(v.versions), candidates, reason: v.reason ?? null, manual_search_available: true };
}
export function normalizeEquipmentPage(value: unknown): EquipmentSearchPage { const v = versioned(value); return { schema_version: 1, versions: versions(v.versions), items: list(v.items, 20, equipment), next_cursor: cursor(v.next_cursor) }; }
export function normalizeExerciseOptions(value: unknown): ExerciseOptionsPage { const v = versioned(value); return { schema_version: 1, versions: versions(v.versions), equipment: equipment(v.equipment), items: list(v.items, 20, option), next_cursor: cursor(v.next_cursor) }; }
export function normalizeGuidance(value: unknown): ExerciseGuidance {
  const v = versioned(value); const i = object(v.instructions); const video = object(v.video);
  let instructions: ExerciseGuidance["instructions"];
  if (i.status === "published") {
    const content = object(i.content);
    instructions = { status: "published", content_version: text(i.content_version, 128), content: { steps: list(content.steps, 20, (s) => text(s, 4000)), cues: list(content.cues, 12, (s) => text(s, 4000)), mistakes: list(content.mistakes, 12, (s) => text(s, 4000)), benefits: text(content.benefits, 4000), beginner_guidance: text(content.beginner_guidance, 4000) } };
    if (!instructions.content?.steps.length) throw invalid();
  } else if (i.status === "instructions_unavailable" && i.content == null && i.content_version == null) instructions = { status: "instructions_unavailable", content_version: null, content: null };
  else throw invalid();
  let media: ExerciseGuidance["video"];
  if (video.status === "approved") {
    const url = text(video.url, 2048); const poster = video.poster_url == null ? null : text(video.poster_url, 2048);
    if (!/^https:\/\//i.test(url) || poster && !/^https:\/\//i.test(poster) || !["video/mp4", "video/webm"].includes(video.mime_type)) throw invalid();
    media = { status: "approved", asset_id: text(video.asset_id, 120), url, mime_type: video.mime_type, poster_url: poster };
  } else if (video.status === "video_unavailable" && [video.asset_id, video.url, video.mime_type, video.poster_url].every((x) => x == null)) media = { status: "video_unavailable", asset_id: null, url: null, mime_type: null, poster_url: null };
  else throw invalid();
  return { schema_version: 1, exercise_id: text(v.exercise_id, 120), name: text(v.name), versions: versions(v.versions), tracking_mode: tracking(v.tracking_mode), load_profile: loadProfile(v.load_profile), instructions, video: media };
}
function detail(value: unknown): ScanErrorDetail {
  const v = object(value); const retry = v.retry_after_seconds;
  if (retry != null && (!Number.isInteger(retry) || retry < 1 || retry > 86400)) throw invalid();
  return { code: text(v.code, 80), detail: text(v.detail, 240), request_id: text(v.request_id, 64), retry_after_seconds: retry ?? null, attempt_key: v.attempt_key == null ? null : text(v.attempt_key, 64) };
}
export function normalizeAttempt(value: unknown): ScanAttemptStatus {
  const v = versioned(value); if (!["processing", "completed", "failed", "unknown"].includes(v.status)) throw invalid();
  const error = v.error == null ? null : detail(v.error); const result = v.result == null ? null : normalizeScanResult(v.result);
  if (v.status === "completed" && (!result || error) || v.status !== "completed" && result || v.status === "processing" && error || ["failed", "unknown"].includes(v.status) && !error) throw invalid();
  return { schema_version: 1, attempt_key: text(v.attempt_key, 64), status: v.status, retry_after_seconds: v.retry_after_seconds ?? null, result, error };
}
async function request(path: string, token: string, signal: AbortSignal, upload?: { uri: string; key: string }): Promise<unknown> {
  const controller = new AbortController(); let timedOut = false;
  const cancel = () => controller.abort(); signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, upload ? 45000 : 20000);
  try {
    if (signal.aborted) throw new EquipmentScanError("scan_cancelled", "Identification cancelled.");
    let status: number; let body: string;
    if (upload) ({ status, body } = await uploadScanPhoto(`${API_BASE_URL}${path}`, upload.uri, { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg", "Idempotency-Key": upload.key }, controller.signal));
    else { const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store" }); status = response.status; body = await response.text(); }
    let data: unknown; try { data = body ? JSON.parse(body) : null; } catch { throw invalid(); }
    if (status < 200 || status >= 300) {
      const raw = object(data); const error = raw.schema_version === 1 && raw.error ? detail(raw.error) : null;
      throw new EquipmentScanError(error?.code ?? "scan_request_failed", error?.detail ?? "This request couldn’t finish. Search manually or check your connection.", status, error?.retry_after_seconds, error?.attempt_key);
    }
    return data;
  } catch (error) {
    if (error instanceof EquipmentScanError) throw error;
    if (signal.aborted) throw new EquipmentScanError("scan_cancelled", "Identification cancelled.");
    throw new EquipmentScanError(upload ? "scan_outcome_unknown" : "scan_connection_failed", timedOut ? "This is taking longer than expected. Check the result without sending another photo." : "Check your connection. Your photo won’t be sent again automatically.");
  } finally { clearTimeout(timeout); signal.removeEventListener("abort", cancel); }
}
export async function identifyEquipment(token: string, photoUri: string, attemptKey: string, signal: AbortSignal) { return normalizeScanResult(await request("/v1/equipment-scans", token, signal, { uri: photoUri, key: attemptKey })); }
export async function checkEquipmentAttempt(token: string, attemptKey: string, signal: AbortSignal) { return normalizeAttempt(await request(`/v1/equipment-scans/attempts/${encodeURIComponent(attemptKey)}`, token, signal)); }
export async function searchEquipment(token: string, query: string, next: string | null, signal: AbortSignal) { const q = new URLSearchParams({ q: query.trim().slice(0, 100), limit: "20" }); if (next) q.set("cursor", next); return normalizeEquipmentPage(await request(`/v1/equipment/search?${q}`, token, signal)); }
export async function getEquipmentExercises(token: string, equipmentId: string, next: string | null, signal: AbortSignal) { const q = new URLSearchParams({ limit: "20" }); if (next) q.set("cursor", next); return normalizeExerciseOptions(await request(`/v1/equipment/${encodeURIComponent(equipmentId)}/exercise-options?${q}`, token, signal)); }
export async function getScanGuidance(token: string, exerciseId: string, signal: AbortSignal) { const result = normalizeGuidance(await request(`/v1/exercises/${encodeURIComponent(exerciseId)}/guidance`, token, signal)); if (result.exercise_id !== exerciseId) throw invalid(); return result; }
