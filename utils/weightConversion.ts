import type { WeightUnit } from "@/interfaces/onboarding/types";

const POUNDS_PER_KILOGRAM = 2.20462262;

export function convertWeight(
  value: number,
  fromUnit: WeightUnit,
  toUnit: WeightUnit
): number {
  if (fromUnit === toUnit) return value;

  const converted = fromUnit === "LB" ? value / POUNDS_PER_KILOGRAM : value * POUNDS_PER_KILOGRAM;
  return Math.round(converted * 10) / 10;
}
