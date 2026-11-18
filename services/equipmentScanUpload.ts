import * as FileSystem from "expo-file-system/legacy";
export async function uploadScanPhoto(url: string, uri: string, headers: Record<string, string>, signal: AbortSignal): Promise<{ status: number; body: string }> {
  const task = FileSystem.createUploadTask(url, uri, { httpMethod: "POST", uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers });
  const cancel = () => { void task.cancelAsync().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    if (signal.aborted) throw new Error("Scan cancelled");
    const response = await task.uploadAsync();
    if (!response) throw new Error("Scan interrupted");
    return { status: response.status, body: response.body };
  } finally { signal.removeEventListener("abort", cancel); }
}
