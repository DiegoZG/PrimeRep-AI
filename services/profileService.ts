import type { WeightUnit } from "@/utils/weightUnits";
import { requestJson } from "./httpClient";
import { requestBinary, blobDataUrl } from "./binaryClient";

export interface Profile {
  id: string;
  email: string;
  preferred_name: string;
  last_name: string | null;
  weight: number | null;
  weight_unit: WeightUnit;
  age: number | null;
  gender: string | null;
  avatar_version: string | null;
  updated_at: string;
}

export type ProfilePatch = Pick<Profile, "preferred_name" | "last_name" | "weight" | "weight_unit" | "age" | "gender">;
export interface Achievement {
  id: string;
  title: string;
  description: string;
  kind: "workouts" | "consistency";
  threshold: number;
  progress: number;
  earned_at: string | null;
}
export interface Achievements {
  total_completed: number;
  current_active_weeks: number;
  best_active_weeks: number;
  time_zone: string;
  weekly_activity: { week_start: string; completed_workouts: number; is_current: boolean }[];
  items: Achievement[];
}
export const getProfile = (token: string) => requestJson<Profile>("/v1/users/me/profile", { token });
export const patchProfile = (token: string, body: Partial<ProfilePatch>) => requestJson<Profile>("/v1/users/me/profile", { token, method: "PATCH", body });
export const removeAvatar = (token: string) => requestJson<Profile>("/v1/users/me/avatar", { token, method: "DELETE" });
export const getAchievements = (token: string) => requestJson<Achievements>(`/v1/users/me/achievements?time_zone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")}`, { token });
export async function getAvatar(token: string) {
  return requestBinary("/v1/users/me/avatar", token, async (response) => blobDataUrl(await response.blob()));
}
