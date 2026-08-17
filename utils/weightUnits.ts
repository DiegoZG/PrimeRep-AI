import AsyncStorage from "@react-native-async-storage/async-storage";

export type WeightUnit = "KG" | "LB";

const STORAGE_KEY = "primerep.weightUnit";
const KG_PER_LB = 0.45359237;
const LB_PER_KG = 2.2046226218;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/** Convert a weight in `from` units into kilograms for API storage. */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === "KG" ? value : lbToKg(value);
}

/** Convert kilograms into the display unit. */
export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === "KG" ? kg : kgToLb(kg);
}

/** Round for input fields: 1 decimal, strip trailing `.0`. */
export function formatWeightInput(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatWeightLabel(kg: number, unit: WeightUnit): string {
  return `${formatWeightInput(fromKg(kg, unit))}${unit.toLowerCase()}`;
}

/** Re-express a typed weight string when the user toggles units. */
export function convertWeightString(
  value: string,
  from: WeightUnit,
  to: WeightUnit
): string {
  if (!value || from === to) return value;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return value;
  const asKg = toKg(parsed, from);
  return formatWeightInput(fromKg(asKg, to));
}

export async function loadWeightUnit(): Promise<WeightUnit> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === "KG" || stored === "LB") return stored;
  } catch (err) {
    console.warn("Failed to load weight unit preference:", err);
  }
  // Match onboarding default (body-stats).
  return "LB";
}

export async function saveWeightUnit(unit: WeightUnit): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, unit);
    return true;
  } catch (err) {
    console.warn("Failed to save weight unit preference:", err);
    return false;
  }
}
