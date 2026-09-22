import type {
  ActivationPreview,
  ActivationRequest,
  ActiveProgramState,
  ExploreSearchResponse,
  ProgramActivationResponse,
  ProgramDetail,
  ProgramFilters,
  ProgramListResponse,
  ProgramMutationPayload,
  ProgramSummary,
} from "@/interfaces/programs";
import { uuid } from "expo-modules-core";
import { requestJson } from "./httpClient";
import { mapApiItemToExercise } from "./exerciseService";

function appendQuery(
  query: string[],
  key: string,
  value: string | number | boolean | undefined,
) {
  if (value !== undefined && value !== "") {
    query.push(`${key}=${encodeURIComponent(String(value))}`);
  }
}

function buildTemplateQuery(filters: ProgramFilters = {}): string {
  const query: string[] = [];
  if (filters.scope !== "all") appendQuery(query, "scope", filters.scope);
  appendQuery(query, "query", filters.query?.trim());
  appendQuery(query, "goal", filters.goal);
  appendQuery(query, "level", filters.level);
  appendQuery(query, "frequency", filters.frequency);
  appendQuery(query, "maxDuration", filters.maxDurationMinutes);
  filters.equipmentIds?.forEach((id) => appendQuery(query, "equipment", id));
  appendQuery(query, "featured", filters.featured);
  appendQuery(query, "recommended", filters.recommended);
  appendQuery(query, "limit", filters.limit);
  appendQuery(query, "offset", filters.offset);
  return query.length ? `?${query.join("&")}` : "";
}

export function createProgramOperationId(): string {
  return `program-${uuid.v4()}`;
}

export function listPrograms(token: string, filters?: ProgramFilters) {
  return requestJson<ProgramListResponse>(
    `/v1/workout-templates${buildTemplateQuery(filters)}`,
    { method: "GET", token },
  );
}

export async function getRecommendedPrograms(token: string): Promise<ProgramSummary[]> {
  const response = await listPrograms(token, {
    recommended: true,
    limit: 3,
  });
  return response.items;
}

export function getProgram(token: string, templateId: string) {
  return requestJson<ProgramDetail>(
    `/v1/workout-templates/${encodeURIComponent(templateId)}`,
    { method: "GET", token },
  ).then(normalizeProgramDetail);
}

export function createProgram(token: string, payload: ProgramMutationPayload) {
  return requestJson<ProgramDetail>("/v1/workout-templates", {
    method: "POST",
    token,
    body: payload,
  }).then(normalizeProgramDetail);
}

export function updateProgram(
  token: string,
  templateId: string,
  payload: ProgramMutationPayload,
) {
  return requestJson<ProgramDetail>(
    `/v1/workout-templates/${encodeURIComponent(templateId)}`,
    { method: "PUT", token, body: payload },
  ).then(normalizeProgramDetail);
}

export async function archiveProgram(token: string, templateId: string): Promise<void> {
  await requestJson<void>(
    `/v1/workout-templates/${encodeURIComponent(templateId)}`,
    { method: "DELETE", token },
  );
}

export function cloneProgram(token: string, templateId: string) {
  return requestJson<ProgramDetail>(
    `/v1/workout-templates/${encodeURIComponent(templateId)}/clone`,
    { method: "POST", token },
  ).then(normalizeProgramDetail);
}

export function previewProgramActivation(
  token: string,
  templateId: string,
  payload: Pick<ActivationRequest, "weekStart" | "effectiveDate" | "weekdays" | "applyMode">,
) {
  return requestJson<ActivationPreview>(
    `/v1/workout-templates/${encodeURIComponent(templateId)}/activation-preview`,
    { method: "POST", token, body: payload },
  ).then((preview) => ({
    ...preview,
    equipmentConflicts: preview.equipmentConflicts.map((conflict) => ({
      ...conflict,
      suggestedExercise: conflict.suggestedExercise
        ? mapApiItemToExercise(conflict.suggestedExercise as never)
        : null,
      alternatives: (conflict.alternatives ?? []).map((exercise) =>
        mapApiItemToExercise(exercise as never),
      ),
    })),
  }));
}

export function activateProgram(
  token: string,
  templateId: string,
  payload: ActivationRequest,
) {
  return requestJson<ProgramActivationResponse>(
    `/v1/workout-templates/${encodeURIComponent(templateId)}/activate`,
    { method: "POST", token, body: payload },
  );
}

export function getActiveProgram(token: string, effectiveDate: string) {
  return requestJson<ActiveProgramState>(`/v1/workout-templates/active?effectiveDate=${encodeURIComponent(effectiveDate)}`, {
    method: "GET",
    token,
  });
}

export async function deactivateProgram(
  token: string,
  dates: { weekStart: string; effectiveDate: string },
): Promise<import("@/interfaces/workouts").WorkoutWeekPlanApiResponse> {
  const query = `weekStart=${encodeURIComponent(dates.weekStart)}&effectiveDate=${encodeURIComponent(dates.effectiveDate)}`;
  return requestJson<import("@/interfaces/workouts").WorkoutWeekPlanApiResponse>(`/v1/workout-templates/active?${query}`, {
    method: "DELETE",
    token,
  });
}

export async function cancelScheduledProgram(
  token: string,
  effectiveDate: string,
): Promise<void> {
  const query = `effectiveDate=${encodeURIComponent(effectiveDate)}`;
  await requestJson<void>(`/v1/workout-templates/active/scheduled?${query}`, {
    method: "DELETE",
    token,
  });
}

export function searchExplore(
  token: string,
  query: string,
  scope: "all" | "programs" | "exercises" = "all",
  pages: { programOffset?: number; exerciseOffset?: number } = {},
) {
  const params = `query=${encodeURIComponent(query.trim())}&scope=${scope}&limit=50&programOffset=${pages.programOffset ?? 0}&exerciseOffset=${pages.exerciseOffset ?? 0}`;
  return requestJson<ExploreSearchResponse>(`/v1/explore/search?${params}`, {
    method: "GET",
    token,
  }).then((response) => ({
    ...response,
    exercises: response.exercises.map((item) => mapApiItemToExercise(item as never)),
  }));
}

function normalizeProgramDetail(program: ProgramDetail): ProgramDetail {
  return {
    ...program,
    days: program.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((item) => ({
        ...item,
        exercise: mapApiItemToExercise(item.exercise as never),
      })),
    })),
  };
}
