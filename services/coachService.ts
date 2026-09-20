import type {
  CoachFeedResponse,
  CoachItemDetail,
  CoachPreferences,
  CoachReadReason,
} from "@/interfaces/coach";
import { isCoachFeedItem } from "@/interfaces/coach";
import { requestJson } from "@/services/httpClient";

export async function getCoachFeed(
  token: string,
  localDate: string,
  options: { cursor?: string; limit?: number } = {},
) {
  const params = new URLSearchParams({
    localDate,
    limit: String(options.limit ?? 20),
  });
  if (options.cursor) params.set("cursor", options.cursor);
  const response = await requestJson<Omit<CoachFeedResponse, "items"> & { items: CoachItemDetail[] }>(`/v1/coach/feed?${params.toString()}`, {
    token,
  });
  return { ...response, items: response.items.filter(isCoachFeedItem) };
}

export function getCoachItem(token: string, itemId: string) {
  return requestJson<CoachItemDetail>(
    `/v1/coach/items/${encodeURIComponent(itemId)}`,
    { token },
  );
}

export function markCoachItemRead(
  token: string,
  itemId: string,
  reason: CoachReadReason,
) {
  return requestJson<CoachItemDetail>(
    `/v1/coach/items/${encodeURIComponent(itemId)}/read`,
    { method: "POST", token, body: { reason } },
  );
}

export async function dismissCoachItem(token: string, itemId: string) {
  await requestJson<null>(
    `/v1/coach/items/${encodeURIComponent(itemId)}/dismiss`,
    { method: "POST", token },
  );
}

export function getCoachPreferences(token: string) {
  return requestJson<CoachPreferences>("/v1/users/me/coach-preferences", {
    token,
  });
}

export function updateCoachPreferences(
  token: string,
  preferences: CoachPreferences,
) {
  return requestJson<CoachPreferences>("/v1/users/me/coach-preferences", {
    method: "PUT",
    token,
    body: preferences,
  });
}
