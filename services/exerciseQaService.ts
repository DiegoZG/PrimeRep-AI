import { requestJson } from "./httpClient";

// API response shape (camelCase, as returned by the backend for this endpoint)
export interface QaItemApiResponse {
  id: string;
  exerciseId: string;
  question: string;
  answer: string;
  createdAt: string;
}

interface QaListApiResponse {
  items: QaItemApiResponse[];
}

// UI model — currently identical to the API shape since the backend already
// returns camelCase for this endpoint, but kept distinct so the UI isn't
// coupled to the wire format if it changes later.
export interface QaItem {
  id: string;
  exerciseId: string;
  question: string;
  answer: string;
  createdAt: string;
}

function mapApiItemToQaItem(apiItem: QaItemApiResponse): QaItem {
  return {
    id: apiItem.id,
    exerciseId: apiItem.exerciseId,
    question: apiItem.question,
    answer: apiItem.answer,
    createdAt: apiItem.createdAt,
  };
}

/**
 * Asks a question about an exercise using the on-demand AI coach.
 * POST /v1/exercises/{id}/ask
 */
export async function askExerciseQuestion(
  token: string,
  exerciseId: string,
  question: string
): Promise<QaItem> {
  const data = await requestJson<QaItemApiResponse>(
    `/v1/exercises/${exerciseId}/ask`,
    {
      method: "POST",
      token,
      body: { question },
    }
  );
  return mapApiItemToQaItem(data);
}

/**
 * Fetches the prior Q&A thread for an exercise, newest first.
 * GET /v1/exercises/{id}/questions
 */
export async function listExerciseQuestions(
  token: string,
  exerciseId: string
): Promise<QaItem[]> {
  const data = await requestJson<QaListApiResponse>(
    `/v1/exercises/${exerciseId}/questions`,
    {
      method: "GET",
      token,
    }
  );
  return (data.items || []).map(mapApiItemToQaItem);
}
