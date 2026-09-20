import {
  formatWeightInput,
  fromKg,
  toKg,
  type WeightUnit,
} from "@/utils/weightUnits";

type LoadReason = "increase" | "hold" | "deload" | "record";
export type LoadDisplayMode = "compact" | "detailed";
export const LOAD_DISPLAY_MODE: LoadDisplayMode = "compact";

type LoadCandidate = {
  displayWeight: number;
  platesPerSide?: number[];
};

export type FriendlyLoad = {
  workingWeightKg: number;
  displayText: string;
  adjustmentNote: string | null;
};

type FriendlyLoadInput = {
  targetWeightKg: number;
  currentWeightKg?: number | null;
  reason: LoadReason;
  equipmentIds: string[];
  loadProfile?: import("@/interfaces/exercises/types").ExerciseLoadProfile | null;
  weightUnit: WeightUnit;
  dumbbellWeights: number[];
  plateWeights: number[];
  displayMode?: LoadDisplayMode;
};

const LB_DUMBBELLS = [
  5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80,
  85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150,
];
const KG_DUMBBELLS = [
  2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36,
  38, 40, 42, 44, 46, 48, 50,
];
const LB_PLATES = [2.5, 5, 10, 25, 35, 45];
const KG_PLATES = [1.25, 2.5, 5, 10, 15, 20, 25];
const NON_STANDARD_BARS = new Set(["ez_bar", "trap_bar", "short_bar", "landmine"]);
const EPSILON = 0.01;

function label(value: number, unit: WeightUnit) {
  return `${formatWeightInput(value)} ${unit.toLowerCase()}`;
}

function usesDetailedDisplay(input: FriendlyLoadInput) {
  return (input.displayMode ?? LOAD_DISPLAY_MODE) === "detailed";
}

function uniquePositive(values: number[]) {
  return [...new Set(values.filter((value) => Number.isFinite(value) && value > 0))]
    .sort((a, b) => a - b);
}

function configuredWeights(
  savedPounds: number[],
  unit: WeightUnit,
  poundDefaults: number[],
  metricDefaults: number[],
) {
  if (unit === "KG") return metricDefaults;
  const saved = uniquePositive(savedPounds);
  return saved.length ? saved : poundDefaults;
}

function plateCandidates(
  plateWeights: number[],
  baseWeight: number,
  requestedTotal: number,
) {
  const weights = uniquePositive(plateWeights);
  const scale = 4;
  const largestPlate = weights.at(-1) ?? 0;
  const maximumPerSide = Math.max(
    0,
    (requestedTotal + largestPlate * 2 - baseWeight) / 2,
  );
  const maximumUnits = Math.ceil(maximumPerSide * scale);
  const weightUnits = weights.map((weight) => ({
    displayWeight: weight,
    units: Math.round(weight * scale),
  }));
  const bestPlatesByUnits = new Map<number, number[]>([[0, []]]);

  for (let sum = 0; sum <= maximumUnits; sum += 1) {
    const plates = bestPlatesByUnits.get(sum);
    if (!plates) continue;
    for (const weight of weightUnits) {
      const nextSum = sum + weight.units;
      if (nextSum > maximumUnits) continue;
      const existing = bestPlatesByUnits.get(nextSum);
      if (!existing || plates.length + 1 < existing.length) {
        bestPlatesByUnits.set(nextSum, [...plates, weight.displayWeight]);
      }
    }
  }

  const byWeight = new Map<number, LoadCandidate>();
  for (const [sumUnits, plates] of bestPlatesByUnits) {
    const displayWeight = baseWeight + (sumUnits / scale) * 2;
    byWeight.set(displayWeight, {
      displayWeight,
      platesPerSide: plates.sort((a, b) => b - a),
    });
  }
  return [...byWeight.values()].sort((a, b) => a.displayWeight - b.displayWeight);
}

function chooseCandidate(
  candidates: LoadCandidate[],
  target: number,
  current: number | null,
  reason: LoadReason,
) {
  if (!candidates.length) return { candidate: null, limited: false };
  if (reason === "record") {
    const exact = candidates.find(
      (candidate) => Math.abs(candidate.displayWeight - target) < 0.11,
    );
    return { candidate: exact ?? null, limited: false };
  }
  if (reason === "deload") {
    const candidate = [...candidates]
      .reverse()
      .find((item) => item.displayWeight <= target + EPSILON) ?? candidates[0];
    return { candidate, limited: candidate.displayWeight > target + EPSILON };
  }
  if (reason === "hold") {
    return {
      candidate: candidates.reduce((best, item) =>
        Math.abs(item.displayWeight - target) < Math.abs(best.displayWeight - target)
          ? item
          : best,
      ),
      limited: false,
    };
  }

  let candidate = candidates.find((item) => item.displayWeight >= target - EPSILON);
  let limited = false;
  if (!candidate) {
    candidate = candidates[candidates.length - 1];
    limited = true;
  }
  if (current != null && target > current) {
    const intendedIncrease = target - current;
    if (candidate.displayWeight - current > intendedIncrease * 2 + EPSILON) {
      const safer = [...candidates]
        .reverse()
        .find(
          (item) =>
            item.displayWeight <= target + EPSILON &&
            item.displayWeight >= current - EPSILON,
        );
      if (safer) candidate = safer;
      limited = true;
    }
  }
  return { candidate, limited };
}

function machineLoad(input: FriendlyLoadInput): FriendlyLoad {
  const target = fromKg(input.targetWeightKg, input.weightUnit);
  const increment = input.weightUnit === "LB" ? 5 : 2.5;
  const displayWeight = input.reason === "increase"
    ? Math.ceil((target - EPSILON) / increment) * increment
    : input.reason === "deload"
      ? Math.floor((target + EPSILON) / increment) * increment
      : input.reason === "hold"
        ? Math.round(target / increment) * increment
        : target;
  return {
    workingWeightKg: toKg(displayWeight, input.weightUnit),
    displayText: label(displayWeight, input.weightUnit),
    adjustmentNote: null,
  };
}

export function resolveFriendlyLoad(input: FriendlyLoadInput): FriendlyLoad {
  const target = fromKg(input.targetWeightKg, input.weightUnit);
  const current = input.currentWeightKg == null
    ? null
    : fromKg(input.currentWeightKg, input.weightUnit);
  const equipment = new Set(input.equipmentIds);

  if (equipment.has("dumbbells") && (!input.loadProfile || input.loadProfile.basis === "per_implement")) {
    const count = input.loadProfile?.implement_count ?? 2;
    const choices = configuredWeights(
      input.dumbbellWeights,
      input.weightUnit,
      LB_DUMBBELLS,
      KG_DUMBBELLS,
    ).map((displayWeight) => ({ displayWeight }));
    const { candidate, limited } = chooseCandidate(
      choices,
      target,
      current,
      input.reason,
    );
    const perHand = candidate?.displayWeight ?? target;
    return {
      workingWeightKg: toKg(perHand, input.weightUnit),
      displayText: count === 1 ? label(perHand, input.weightUnit) : usesDetailedDisplay(input)
        ? `2 × ${label(perHand, input.weightUnit)} (${label(perHand * 2, input.weightUnit)} total)`
        : `${label(perHand * 2, input.weightUnit)} total`,
      adjustmentNote: limited
        ? `The next available dumbbell${count === 2 ? " pair" : ""} would be too large a jump, so keep the current weight for now.`
        : null,
    };
  }

  if (equipment.has("olympic_barbell") && equipment.has("plates")) {
    const plateWeights = configuredWeights(
      input.plateWeights,
      input.weightUnit,
      LB_PLATES,
      KG_PLATES,
    );
    const barWeight = input.weightUnit === "LB" ? 45 : 20;
    const candidates = plateCandidates(
      plateWeights,
      barWeight,
      Math.max(target, current ?? 0),
    );
    const { candidate, limited } = chooseCandidate(
      candidates,
      target,
      current,
      input.reason,
    );
    if (!candidate) return machineLoad(input);
    const plates = candidate.platesPerSide ?? [];
    const side = plates.length
      ? `${plates.map((plate) => formatWeightInput(plate)).join(" + ")} ${input.weightUnit.toLowerCase()} per side`
      : "no plates";
    return {
      workingWeightKg: toKg(candidate.displayWeight, input.weightUnit),
      displayText: usesDetailedDisplay(input)
        ? `${label(candidate.displayWeight, input.weightUnit)} total — ${label(barWeight, input.weightUnit)} bar + ${side}`
        : label(candidate.displayWeight, input.weightUnit),
      adjustmentNote: limited
        ? "The next available plate setup would be too large a jump, so use the closest safer setup for now."
        : null,
    };
  }

  if ([...NON_STANDARD_BARS].some((bar) => equipment.has(bar))) {
    return machineLoad(input);
  }

  if (equipment.has("plates")) {
    const plateWeights = configuredWeights(
      input.plateWeights,
      input.weightUnit,
      LB_PLATES,
      KG_PLATES,
    );
    const candidates = plateCandidates(
      plateWeights,
      0,
      Math.max(target, current ?? 0),
    ).filter(
      (candidate) => candidate.displayWeight > 0,
    );
    const { candidate, limited } = chooseCandidate(
      candidates,
      target,
      current,
      input.reason,
    );
    if (!candidate) return machineLoad(input);
    const plates = candidate.platesPerSide ?? [];
    return {
      workingWeightKg: toKg(candidate.displayWeight, input.weightUnit),
      displayText: usesDetailedDisplay(input)
        ? `${label(candidate.displayWeight, input.weightUnit)} loaded — ${plates.map((plate) => formatWeightInput(plate)).join(" + ")} ${input.weightUnit.toLowerCase()} per side`
        : label(candidate.displayWeight, input.weightUnit),
      adjustmentNote: limited
        ? "The next available plate setup would be too large a jump, so use the closest safer setup for now."
        : null,
    };
  }

  return machineLoad(input);
}
