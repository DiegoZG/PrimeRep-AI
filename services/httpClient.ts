import { API_BASE_URL } from "@/config/api";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// Default timeout for requests (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;

export interface RequestOptions {
  method?: HttpMethod;
  token?: string | null;
  body?: unknown;
  timeoutMs?: number;
}

/**
 * Custom error class for HTTP requests that preserves status and payload
 */
export class HttpError extends Error {
  status?: number;
  payload?: unknown;
  isTimeout?: boolean;

  constructor(
    message: string,
    status?: number,
    payload?: unknown,
    isTimeout?: boolean
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.payload = payload;
    this.isTimeout = isTimeout;
  }
}

/**
 * Make a JSON request with timeout support
 *
 * @param path - API path (will be appended to API_BASE_URL)
 * @param options - Request options including method, token, body, and timeoutMs
 * @returns Parsed JSON response
 * @throws HttpError on non-2xx response, timeout, or network error
 */
export async function requestJson<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = "GET",
    token = null,
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const message =
        data?.detail ||
        data?.error ||
        `Request failed (${res.status}) ${method} ${path}`;
      throw new HttpError(message, res.status, data);
    }

    return data as T;
  } catch (err: unknown) {
    // Handle abort (timeout)
    if (err instanceof Error && err.name === "AbortError") {
      throw new HttpError(
        "Request timeout - please check your connection",
        undefined,
        undefined,
        true
      );
    }

    // Re-throw HttpError as-is
    if (err instanceof HttpError) {
      throw err;
    }

    // Handle other errors (network errors, etc.)
    const message =
      err instanceof Error ? err.message : "Network request failed";
    throw new HttpError(message);
  } finally {
    clearTimeout(timeoutId);
  }
}
