import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { API_BASE_URL } from "@/config/api";
import { HttpError } from "./httpClient";
import type { Profile } from "./profileService";
import type { WeightUnit } from "@/utils/weightUnits";

const directory = `${FileSystem.cacheDirectory}primerep-private-exports/`;
const pending = new Set<() => Promise<unknown>>();
let cleanup: Promise<void> = Promise.resolve();

export function cleanupPrivateFiles() {
  const cancellations = [...pending].map((cancel) => cancel());
  cleanup = cleanup.catch(() => {}).then(async () => {
    const files = await FileSystem.readDirectoryAsync(directory).catch(() => [] as string[]);
    await Promise.allSettled(cancellations);
    await Promise.allSettled(files.map((file) => FileSystem.deleteAsync(`${directory}${file}`, { idempotent: true })));
  });
  return cleanup;
}

export async function discardPickedPhoto(uri: string) {
  if (FileSystem.cacheDirectory && uri.startsWith(FileSystem.cacheDirectory)) await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function uploadAvatar(token: string, uri: string): Promise<Profile> {
  const task = FileSystem.createUploadTask(`${API_BASE_URL}/v1/users/me/avatar`, uri, {
    httpMethod: "PUT", uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" },
  });
  const cancel = () => task.cancelAsync();
  pending.add(cancel);
  const timeout = setTimeout(() => { void cancel().catch(() => {}); }, 30000);
  try {
    const response = await task.uploadAsync();
    if (!response) throw new Error("Photo upload was interrupted. Please try again.");
    const body = JSON.parse(response.body);
    if (response.status < 200 || response.status >= 300) throw new HttpError(typeof body.detail === "string" ? body.detail : "Your photo could not be updated.", response.status);
    return body;
  } finally {
    pending.delete(cancel);
    clearTimeout(timeout);
  }
}

export async function exportAccount(token: string, owner: string, unit: WeightUnit, isCurrent: () => boolean): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is unavailable on this device. Try downloading from PrimeRep on the web.");
  await cleanup;
  if (!isCurrent()) return;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  if (!isCurrent()) return;
  const uri = `${directory}${encodeURIComponent(owner)}-${Date.now()}-primerep.zip`;
  const task = FileSystem.createDownloadResumable(`${API_BASE_URL}/v1/users/me/export?weight_unit=${unit}`, uri, { headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-store" } });
  const cancel = () => task.cancelAsync();
  pending.add(cancel);
  const timeout = setTimeout(() => { void cancel().catch(() => {}); }, 120000);
  try {
    const response = await task.downloadAsync();
    clearTimeout(timeout);
    if (!isCurrent()) return;
    if (!response) throw new Error("Your download was interrupted. Please try again.");
    if (response.status !== 200) throw new HttpError(response.status === 429 ? "You’ve reached the hourly export limit. Please try again later." : "Your archive could not be created. Please try again.", response.status);
    await Sharing.shareAsync(uri, { mimeType: "application/zip", UTI: "public.zip-archive", dialogTitle: "Save your PrimeRep data" });
  } finally {
    pending.delete(cancel);
    clearTimeout(timeout);
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
