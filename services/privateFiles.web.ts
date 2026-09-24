import { requestBinary } from "./binaryClient";
import type { Profile } from "./profileService";
import type { WeightUnit } from "@/utils/weightUnits";

const urls = new Set<string>();
export async function cleanupPrivateFiles() {
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls.clear();
}
export async function discardPickedPhoto(uri: string) {
  if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
}
export async function uploadAvatar(token: string, uri: string): Promise<Profile> {
  const body = await (await fetch(uri)).blob();
  return requestBinary("/v1/users/me/avatar", token, (response) => response.json(), { method: "PUT", body, contentType: "image/jpeg" });
}
export async function exportAccount(token: string, _owner: string, unit: WeightUnit, isCurrent: () => boolean): Promise<void> {
  const blob = await requestBinary(`/v1/users/me/export?weight_unit=${unit}`, token, (response) => response.blob(), { timeoutMs: 120000 });
  if (!isCurrent()) return;
  const url = URL.createObjectURL(blob);
  urls.add(url);
  const link = document.createElement("a");
  link.href = url;
  link.download = `primerep-data-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 1000);
}
