import { accountGeneration } from "./accountScope";
import type { SubscriptionFlags } from "./featureFlagService";

let known: { userId: string; generation: number; flags: SubscriptionFlags } | null = null;

export function rememberSubscriptionFlags(userId: string, flags: SubscriptionFlags) {
  known = { userId, generation: accountGeneration(), flags: { ...flags } };
}

export function knownSubscriptionFlags(userId: string): SubscriptionFlags | null {
  return known?.userId === userId && known.generation === accountGeneration() ? known.flags : null;
}
