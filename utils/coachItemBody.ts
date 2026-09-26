import type { CoachFeedItem } from "@/interfaces/coach";
import { resolveFriendlyLoad } from "@/utils/attainableLoads";
import type { WeightUnit } from "@/utils/weightUnits";

export function coachItemPresentation(
  item: CoachFeedItem,
  weightUnit: WeightUnit | null,
  dumbbellWeights: number[],
  plateWeights: number[],
): { body: string; adjustmentNote: string | null } {
  if (!item.weightData || !weightUnit) return { body: item.body, adjustmentNote: null };
  const friendlyLoad = resolveFriendlyLoad({
    targetWeightKg: item.weightData.weightKg,
    currentWeightKg: item.weightData.currentWeightKg,
    reason: item.weightData.context === "record"
      ? "record"
      : item.weightData.recommendation ?? "hold",
    equipmentIds: item.weightData.equipmentIds ?? [],
    loadProfile: item.weightData.loadProfile,
    weightUnit,
    dumbbellWeights,
    plateWeights,
  });
  return {
    body: item.weightData.context === "target"
      ? `Your next ${item.weightData.exerciseName} target is ${friendlyLoad.displayText}.`
      : `You lifted ${friendlyLoad.displayText}—your heaviest logged set for this exercise.`,
    adjustmentNote: friendlyLoad.adjustmentNote ?? null,
  };
}
