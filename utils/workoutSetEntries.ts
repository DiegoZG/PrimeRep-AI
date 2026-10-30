import type { SetState } from "@/interfaces/workouts";
import type { LocalActiveWorkout, PendingWorkoutOperation } from "@/utils/activeWorkoutStore.native";
import { toKg, type WeightUnit } from "@/utils/weightUnits";

export const setEntryKey = (set: Pick<SetState, "exerciseId" | "setNumber">) => `${set.exerciseId}:${set.setNumber}`;

export function enteredSets(sets: SetState[], exerciseId?: string): SetState[] {
  return sets.filter((set) => !set.deleted && set.hasUnsavedInput && (!set.confirmed || set.editing)
    && (exerciseId == null || set.exerciseId === exerciseId));
}

export function isAppliedSetOperation(operation: PendingWorkoutOperation, sets: SetState[]): boolean {
  if (operation.type !== "set" && operation.type !== "update_set" && operation.type !== "delete_set" && operation.type !== "restore_set") return false;
  const saved = sets.find((set) => setEntryKey(set) === setEntryKey(operation.payload));
  return saved?.acknowledgedOperationIds?.includes(operation.id) ?? false;
}

export function mergeSetAcknowledgements(set: SetState, durable?: SetState): SetState {
  return { ...set, acknowledgedOperationIds: [...new Set([
    ...(durable?.acknowledgedOperationIds ?? []), ...(set.acknowledgedOperationIds ?? []),
  ])] };
}

export function acknowledgeSetOperation(set: SetState, operationId: string): SetState {
  return { ...set, acknowledgedOperationIds: [...new Set([...(set.acknowledgedOperationIds ?? []), operationId])] };
}

export function resolveSetCorrection(operation: PendingWorkoutOperation, sets: SetState[]): PendingWorkoutOperation | null {
  if ((operation.type !== "update_set" && operation.type !== "delete_set" && operation.type !== "restore_set") || !operation.payload.resolveAfterPending) return operation;
  const set = sets.find((row) => setEntryKey(row) === setEntryKey(operation.payload));
  if (!set?.logId) return null;
  if (operation.type !== "update_set") return { ...operation, payload: { ...operation.payload, logId: set.logId, resolveAfterPending: undefined } };
  return { ...operation, payload: { ...operation.payload, logId: set.logId, expectedVersion: set.version ?? 1,
    previousReps: set.reps, previousVersion: set.version ?? 1, resolveAfterPending: undefined } };
}

export function validateSetEntry(set: SetState, unit: WeightUnit):
  { reps: number; weightKg: number | null } | { error: string } {
  const draft = set.editing ? set.editDraft ?? set : set;
  const repsText = draft.reps.trim();
  if (!/^\d+$/.test(repsText) || !Number.isSafeInteger(Number(repsText)) || Number(repsText) <= 0) {
    return { error: "Enter a whole number of reps greater than zero." };
  }
  const weightText = draft.weight.trim().replace(",", ".");
  if (weightText && (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(weightText) || !Number.isFinite(Number(weightText)))) {
    return { error: "Enter a valid, nonnegative weight, or leave it blank for an unweighted set." };
  }
  const kg = weightText ? Math.round(toKg(Number(weightText), unit) * 100) / 100 : null;
  if (kg != null && !Number.isFinite(kg)) return { error: "Enter a smaller weight." };
  return { reps: Number(repsText), weightKg: kg };
}

export function prepareSetEntries(
  incoming: LocalActiveWorkout,
  durable: LocalActiveWorkout | null,
  keys: string[],
  unit: WeightUnit,
  createId: () => string,
) {
  const selected = new Set(keys);
  const durableSets = new Map(durable?.sets.map((set) => [setEntryKey(set), set]));
  let operations: PendingWorkoutOperation[] = [...(durable?.operations ?? incoming.operations)];
  if (durable) {
    const storedIds = new Set(operations.map((operation) => operation.id));
    for (const operation of incoming.operations) {
      if (storedIds.has(operation.id)) continue;
      const changed = operation.type === "update_workout_note" ? incoming.workoutNote !== durable.workoutNote
        : operation.type === "update_exercise_note" ? incoming.exerciseNotes?.[operation.payload.exerciseId] !== durable.exerciseNotes?.[operation.payload.exerciseId]
        : operation.type === "update_exercise_feedback" ? JSON.stringify(incoming.exerciseFeedback?.[operation.payload.exerciseId]) !== JSON.stringify(durable.exerciseFeedback?.[operation.payload.exerciseId])
        : false;
      if (changed) operations.push(operation);
    }
  }
  const issues: Record<string, string> = {};
  let savedCount = 0;
  const sets = incoming.sets.map((incomingSet): SetState => {
    const original = mergeSetAcknowledgements(incomingSet, durableSets.get(setEntryKey(incomingSet)));
    const key = setEntryKey(original);
    const stored = durableSets.get(key);
    if (!selected.has(key) || original.deleted || (original.confirmed && !original.editing)) {
      return stored && !original.hasUnsavedInput && !original.editing ? {
        ...stored, ...original, confirmed: original.confirmed || stored.confirmed,
        ...(stored.confirmed ? { reps: stored.reps, weight: stored.weight, weightKg: stored.weightKg } : {}),
        logId: stored.logId, version: stored.version, syncing: stored.syncing, syncStatus: stored.syncStatus,
      } : original;
    }
    const validation = validateSetEntry(original, unit);
    if ("error" in validation) {
      issues[key] = validation.error;
      return { ...original, logId: stored?.logId ?? original.logId, version: stored?.version ?? original.version };
    }
    const target = { ...original, logId: stored?.logId ?? original.logId, version: stored?.version ?? original.version };
    const draft = original.editing ? original.editDraft ?? original : original;
    const { reps, weightKg } = validation;
    const pendingIndex = operations.map((operation) =>
      (operation.type === "set" || operation.type === "update_set") ? setEntryKey(operation.payload) : "").lastIndexOf(key);
    const pending = operations[pendingIndex];
    // Replay may already hold this payload; corrections must keep its operation ID immutable.
    if (target.logId || pending) {
      const operation: PendingWorkoutOperation = {
        id: createId(), type: "update_set", status: "pending",
        payload: {
          logId: target.logId ?? "", exerciseId: target.exerciseId, setNumber: target.setNumber, reps, weightKg,
          displayWeight: draft.weight,
          expectedVersion: target.version ?? 1,
          previousReps: stored?.reps ?? target.reps,
          previousWeight: stored?.weight ?? target.weight,
          previousVersion: target.version ?? 1,
          resolveAfterPending: Boolean(pending) || undefined,
        },
      };
      operations.push(operation);
    } else {
      operations.push({ id: createId(), type: "set", status: "pending",
        payload: { exerciseId: target.exerciseId, setNumber: target.setNumber, reps, weightKg: weightKg ?? undefined } });
    }
    savedCount += 1;
    return { ...target, reps: String(reps), weight: draft.weight, weightKg, confirmed: true,
      editing: false, editDraft: undefined, hasUnsavedInput: false, syncing: false, syncStatus: "pending" };
  });
  return { workout: { ...incoming, serverSessionId: durable?.serverSessionId ?? incoming.serverSessionId,
    sets, operations, revision: Math.max(incoming.revision, durable?.revision ?? 0) + 1 }, savedCount, issues };
}
