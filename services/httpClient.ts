import { API_BASE_URL } from "@/config/api";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function requestJson<T>(
  path: string,
  options: {
    method?: HttpMethod;
    token?: string | null;
    body?: unknown;
  } = {}
): Promise<T> {
  const { method = "GET", token = null, body } = options;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message =
      data?.detail ||
      data?.error ||
      `Request failed (${res.status}) ${method} ${path}`;
    const err = new Error(message) as Error & {
      status?: number;
      payload?: any;
    };
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data as T;
}
