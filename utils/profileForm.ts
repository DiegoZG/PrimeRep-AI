import type { Profile, ProfilePatch } from "@/services/profileService";
import { formatWeightInput, fromKg, toKg, type WeightUnit } from "./weightUnits";

export type ProfileForm = { preferred_name: string; last_name: string; weight: string; weight_unit: WeightUnit; age: string; gender: string; weight_edited: boolean; weight_source_kg: number | null };
export const PROFILE_GENDERS = ["Male", "Female", "Other", "Prefer not to say"];
export function profileForm(profile: Profile, unit: WeightUnit): ProfileForm {
  const weightKg = profile.weight === null ? null : toKg(profile.weight, profile.weight_unit);
  const gender = PROFILE_GENDERS.find((value) => value.toLowerCase() === profile.gender?.toLowerCase()) ?? profile.gender ?? "";
  return { preferred_name: profile.preferred_name, last_name: profile.last_name ?? "", weight: weightKg === null ? "" : formatWeightInput(fromKg(weightKg, unit)), weight_unit: unit, age: profile.age === null ? "" : String(profile.age), gender, weight_edited: false, weight_source_kg: weightKg };
}
export function validateProfileForm(form: ProfileForm, baseline?: ProfileForm): string | null {
  const changed = baseline ? changedProfilePayload(form, baseline) : null;
  const check = (key: keyof ProfilePatch) => !changed || key in changed;
  if (check("preferred_name") && (!form.preferred_name.trim() || form.preferred_name.trim().length > 50)) return "Enter a preferred name between 1 and 50 characters.";
  if (check("last_name") && form.last_name.trim().length > 50) return "Your last name can have up to 50 characters.";
  if (check("weight") && form.weight.trim() && (!/^\d+(?:\.\d+)?$/.test(form.weight.trim()) || Number(form.weight) <= 0 || toKg(Number(form.weight), form.weight_unit) > 317.514659)) return "Enter a weight greater than zero and no more than 700 lb (317.5 kg).";
  if (check("age") && form.age.trim() && (!/^\d+$/.test(form.age.trim()) || Number(form.age) < 13 || Number(form.age) > 120)) return "Enter an age between 13 and 120, or leave it blank.";
  if (check("gender") && form.gender && !PROFILE_GENDERS.includes(form.gender)) return "Choose one of the available gender options.";
  return null;
}
export function profilePayload(form: ProfileForm): ProfilePatch {
  return { preferred_name: form.preferred_name.trim(), last_name: form.last_name.trim() || null, weight: form.weight.trim() ? Number(form.weight) : null, weight_unit: form.weight_unit, age: form.age.trim() ? Number(form.age) : null, gender: form.gender || null };
}

export function changedProfilePayload(form: ProfileForm, baseline: ProfileForm): Partial<ProfilePatch> {
  const current = profilePayload(form);
  const previous = profilePayload(baseline);
  const changes: Partial<ProfilePatch> = {};
  if (current.preferred_name !== previous.preferred_name) changes.preferred_name = current.preferred_name;
  if (current.last_name !== previous.last_name) changes.last_name = current.last_name;
  if (current.age !== previous.age) changes.age = current.age;
  if (current.gender !== previous.gender) changes.gender = current.gender;
  if (form.weight_edited && (current.weight !== previous.weight || current.weight_unit !== previous.weight_unit)) { changes.weight = current.weight; changes.weight_unit = current.weight_unit; }
  return changes;
}
