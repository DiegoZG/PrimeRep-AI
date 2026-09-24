import { API_BASE_URL } from "@/config/api";
import { HttpError } from "./httpClient";

export async function requestBinary<T>(path: string, token: string, read: (response: Response) => Promise<T>, options: { method?: string; body?: Blob; contentType?: string; timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, ...(options.contentType ? { "Content-Type": options.contentType } : {}) },
      body: options.body,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new HttpError(typeof data?.detail === "string" ? data.detail : "The request could not be completed. Please try again.", response.status);
    }
    return await read(response);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new HttpError("The request timed out. Please try again.", undefined, undefined, true);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Your photo could not load."));
    reader.readAsDataURL(blob);
  });
}
