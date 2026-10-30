import type { SetState, WorkoutDay } from "@/interfaces/workouts";
import type { SessionResponse } from "@/services/workoutLoggingService";
import { mapApiWorkoutDay } from "@/services/workoutWeekService";
import type { LocalActiveWorkout } from "./activeWorkoutStore.native";
import { mergeSetAcknowledgements } from "./workoutSetEntries";

export function reorderWorkout(workout: WorkoutDay, exerciseIds: string[]): WorkoutDay {
  const items = workout.blocks.flatMap((block) => block.items.map((item) => ({ item, blockType: block.blockType })));
  const byId = new Map(items.map((entry) => [entry.item.exercise.id, entry]));
  if (byId.size !== items.length || exerciseIds.length !== items.length || new Set(exerciseIds).size !== items.length
    || exerciseIds.some((id) => !byId.has(id))) throw new Error("Review the order: every workout exercise must appear once.");
  const blocks: WorkoutDay["blocks"] = [];
  for (const id of exerciseIds) {
    const entry = byId.get(id)!;
    if (blocks.at(-1)?.blockType !== entry.blockType) blocks.push({ blockType: entry.blockType, items: [] });
    blocks[blocks.length - 1].items.push(entry.item);
  }
  return { ...workout, blocks };
}

export function normalizeWorkoutArrangement(local: LocalActiveWorkout): LocalActiveWorkout {
  const effective = local.effectiveWorkout ?? local.workoutSnapshot;
  const ids = effective?.blocks.flatMap((block) => block.items.map((item) => item.exercise.id)) ?? [];
  const currentId = local.currentExerciseId ?? ids[local.currentExerciseIndex] ?? ids[0] ?? null;
  const currentIndex = currentId ? ids.indexOf(currentId) : 0;
  const restId = local.restContext?.exerciseId ?? ids[local.restContext?.exerciseIndex ?? -1];
  return { ...local, effectiveWorkout: effective, arrangementRevision: local.arrangementRevision,
    currentExerciseId: currentIndex >= 0 ? currentId : ids[0] ?? null,
    currentExerciseIndex: Math.max(0, currentIndex),
    restContext: local.restContext ? { ...local.restContext, exerciseId: restId,
      exerciseIndex: restId ? Math.max(0, ids.indexOf(restId)) : local.restContext.exerciseIndex } : null };
}

function keepBeyondTarget(set: SetState): boolean {
  return Boolean(set.logId || set.deletedLogId || set.confirmed || set.isAdded || set.hasUnsavedInput || set.editing
    || set.reps.trim() || set.weight.trim());
}

export function adoptSessionArrangement(local: LocalActiveWorkout, server: SessionResponse): LocalActiveWorkout {
  if (server.arrangementRevision != null && server.arrangementRevision < (local.arrangementRevision ?? 0)) return local;
  local = normalizeWorkoutArrangement(local);
  const apiWorkout = server.effectiveWorkout ?? server.workoutSnapshot;
  if (!apiWorkout) return local;
  const workout = mapApiWorkoutDay(apiWorkout);
  const items = workout.blocks.flatMap((block) => block.items);
  const counts = new Map(items.map((item) => [item.exercise.id, item.prescription.sets]));
  const sets = local.sets.filter((set) => counts.has(set.exerciseId)
    ? set.setNumber <= counts.get(set.exerciseId)! || keepBeyondTarget(set)
    : Boolean(set.logId || set.deletedLogId || set.confirmed));
  for (const item of items) {
    for (let setNumber = 1; setNumber <= item.prescription.sets; setNumber += 1) {
      if (!sets.some((set) => set.exerciseId === item.exercise.id && set.setNumber === setNumber)) {
        sets.push({ exerciseId: item.exercise.id, setNumber, reps: "", weight: "", confirmed: false,
          syncing: false, syncStatus: "synced", logId: null });
      }
    }
  }
  return normalizeWorkoutArrangement({ ...local,
    workoutSnapshot: local.workoutSnapshot ?? (server.workoutSnapshot ? mapApiWorkoutDay(server.workoutSnapshot) : null),
    effectiveWorkout: workout, arrangementRevision: server.arrangementRevision,
    serverSessionId: server.id, sets });
}

/** Merge a network acknowledgement into the latest durable draft without replacing newer input. */
export function mergeReplayAcknowledgement(
  persisted: LocalActiveWorkout | null, replayed: LocalActiveWorkout, startedIds: readonly string[],
): LocalActiveWorkout {
  if (!persisted || persisted.clientSessionId !== replayed.clientSessionId) return normalizeWorkoutArrangement(replayed);
  const started = new Set(startedIds);
  const incomingById = new Map(replayed.operations.map((operation) => [operation.id, operation]));
  const operations = persisted.operations.filter((operation) => !started.has(operation.id));
  for (const operation of replayed.operations) {
    if (started.has(operation.id) && !persisted.operations.some((saved) => saved.id === operation.id)) continue;
    if (!operations.some((saved) => saved.id === operation.id)) operations.push(operation);
  }
  const newerArrangement = persisted.operations.some((operation) => (operation.type === "order" || operation.type === "replace")
    && !started.has(operation.id));
  const useReplayed = !newerArrangement && (replayed.arrangementRevision ?? 0) >= (persisted.arrangementRevision ?? 0);
  const replayedSets = new Map(replayed.sets.map((set) => [`${set.exerciseId}:${set.setNumber}`, set]));
  let authoritativeWorkout = useReplayed ? replayed.effectiveWorkout : persisted.effectiveWorkout;
  const pendingOrder = [...operations].reverse().find((operation) => operation.type === "order" && !operation.payload.conflict);
  if (authoritativeWorkout && pendingOrder?.type === "order") {
    try { authoritativeWorkout = reorderWorkout(authoritativeWorkout, pendingOrder.payload.exerciseIds); }
    catch { /* A remote replacement requires explicit review of the old order. */ }
  }
  const effectiveIds = new Set(authoritativeWorkout?.blocks.flatMap((block) => block.items.map((item) => item.exercise.id)) ?? []);
  const discardedSources = new Set(persisted.operations.filter((operation) => operation.type === "replace"
    && started.has(operation.id) && !incomingById.has(operation.id))
    .map((operation) => operation.type === "replace" ? operation.payload.exerciseId : ""));
  const counts = new Map(authoritativeWorkout?.blocks.flatMap((block) => block.items.map((item) => [item.exercise.id, item.prescription.sets] as const)) ?? []);
  const sets = persisted.sets.filter((set) => {
    if (discardedSources.has(set.exerciseId) && !effectiveIds.has(set.exerciseId)) return false;
    if (counts.has(set.exerciseId)) return set.setNumber <= counts.get(set.exerciseId)! || keepBeyondTarget(set);
    return !effectiveIds.size || keepBeyondTarget(set);
  })
    .map((set): SetState => {
      const ack = replayedSets.get(`${set.exerciseId}:${set.setNumber}`);
      if (!ack) return set;
      if (set.isAdded && set.deleted && !set.confirmed && !set.logId) {
        if (!ack.confirmed && !ack.logId) return set;
        return { ...set, ...ack, deleted: ack.deleted ?? false,
          acknowledgedOperationIds: mergeSetAcknowledgements(set, ack).acknowledgedOperationIds };
      }
      const draft = set.hasUnsavedInput || set.editing;
      const pendingSetMutation = operations.some((operation) => operation.status !== "failed"
        && (operation.type === "set" || operation.type === "update_set" || operation.type === "delete_set" || operation.type === "restore_set")
        && operation.payload.exerciseId === set.exerciseId && operation.payload.setNumber === set.setNumber);
      return { ...set, ...(!draft && !pendingSetMutation ? ack : {
        logId: ack.logId ?? set.logId, version: Math.max(set.version ?? 1, ack.version ?? 1),
      }), acknowledgedOperationIds: mergeSetAcknowledgements(set, ack).acknowledgedOperationIds };
    });
  for (const set of replayed.sets) {
    if (!sets.some((saved) => saved.exerciseId === set.exerciseId && saved.setNumber === set.setNumber)) sets.push(set);
  }
  const acknowledged = [...new Set([...(persisted.acknowledgedArrangementOperationIds ?? []), ...(replayed.acknowledgedArrangementOperationIds ?? [])])];
  const replacements = persisted.operations.filter((operation): operation is Extract<typeof operation, { type: "replace" }> =>
    operation.type === "replace" && acknowledged.includes(operation.id) && effectiveIds.has(operation.payload.replacementExerciseId));
  const replacementFor = (id?: string | null) => replacements.find((operation) => operation.payload.exerciseId === id)?.payload.replacementExerciseId ?? id;
  // Preserve the current exercise through replacement while retaining newer cursor and timer input.
  const merged = { ...persisted, serverSessionId: replayed.serverSessionId ?? persisted.serverSessionId,
    workoutSnapshot: persisted.workoutSnapshot ?? replayed.workoutSnapshot,
    effectiveWorkout: authoritativeWorkout,
    arrangementRevision: useReplayed ? replayed.arrangementRevision : persisted.arrangementRevision,
    targetReviewExerciseIds: !newerArrangement && (replayed.arrangementRevision ?? 0) > (persisted.arrangementRevision ?? 0)
      ? replayed.targetReviewExerciseIds : persisted.targetReviewExerciseIds,
    acknowledgedArrangementOperationIds: acknowledged,
    currentExerciseId: replacementFor(persisted.currentExerciseId),
    restContext: persisted.restContext ? { ...persisted.restContext, exerciseId: replacementFor(persisted.restContext.exerciseId) ?? undefined } : null,
    sets, operations, revision: Math.max(persisted.revision, replayed.revision) + 1 };
  // Keep failed conflict metadata from this pass even if its queue entry was saved earlier.
  merged.operations = merged.operations.map((operation) => incomingById.get(operation.id) ?? operation);
  return normalizeWorkoutArrangement(merged);
}


export function mergeSavedArrangement(persisted: LocalActiveWorkout | null, incoming: LocalActiveWorkout): LocalActiveWorkout {
  if (!persisted || persisted.clientSessionId !== incoming.clientSessionId) return normalizeWorkoutArrangement(incoming);
  const acknowledged = [...new Set([...(persisted.acknowledgedArrangementOperationIds ?? []),
    ...(incoming.acknowledgedArrangementOperationIds ?? [])])];
  const stale = (incoming.arrangementRevision ?? -1) < (persisted.arrangementRevision ?? -1);
  const effective = stale ? persisted.effectiveWorkout : incoming.effectiveWorkout ?? incoming.workoutSnapshot;
  const counts = new Map(effective?.blocks.flatMap((block) => block.items.map((item) => [item.exercise.id, item.prescription.sets] as const)) ?? []);
  const discardedSources = new Set(incoming.operations.filter((operation) => operation.type === "replace" && acknowledged.includes(operation.id))
    .map((operation) => operation.type === "replace" ? operation.payload.exerciseId : ""));
  const sets = incoming.sets.filter((set) => counts.has(set.exerciseId)
    ? set.setNumber <= counts.get(set.exerciseId)! || keepBeyondTarget(set)
    : !counts.size || Boolean(set.logId || set.deletedLogId || set.confirmed) || (!discardedSources.has(set.exerciseId) && keepBeyondTarget(set)));
  for (const [exerciseId, count] of counts) {
    for (let setNumber = 1; setNumber <= count; setNumber += 1) {
      if (sets.some((set) => set.exerciseId === exerciseId && set.setNumber === setNumber)) continue;
      const durable = persisted.sets.find((set) => set.exerciseId === exerciseId && set.setNumber === setNumber);
      sets.push(durable ?? { exerciseId, setNumber, reps: "", weight: "", confirmed: false, syncing: false, syncStatus: "synced", logId: null });
    }
  }
  return normalizeWorkoutArrangement({ ...incoming,
    workoutSnapshot: persisted.workoutSnapshot ?? incoming.workoutSnapshot,
    currentExerciseId: incoming.currentExerciseId && counts.has(incoming.currentExerciseId) ? incoming.currentExerciseId : persisted.currentExerciseId,
    restContext: incoming.restContext?.exerciseId && !counts.has(incoming.restContext.exerciseId) ? persisted.restContext : incoming.restContext,
    effectiveWorkout: effective, arrangementRevision: stale ? persisted.arrangementRevision : incoming.arrangementRevision,
    targetReviewExerciseIds: stale || incoming.targetReviewExerciseIds === undefined ? persisted.targetReviewExerciseIds : incoming.targetReviewExerciseIds,
    acknowledgedArrangementOperationIds: acknowledged,
    operations: incoming.operations.filter((operation) => (operation.type !== "order" && operation.type !== "replace") || !acknowledged.includes(operation.id)),
    sets });
}

export class PreWorkoutOrderConflict extends Error {
  constructor(message: string, readonly serverSessionId: string | null = null, readonly terminal = false) { super(message); }
}

export function applyPrestartOrder(current: LocalActiveWorkout, exerciseIds: string[], createId: () => string): LocalActiveWorkout {
  if (current.finishedAt != null || current.operations.some((operation) => operation.type === "complete" || operation.type === "abandon")) {
    throw new PreWorkoutOrderConflict("Finish syncing the active workout before changing its order.", current.serverSessionId);
  }
  if (current.serverSessionId && current.arrangementRevision == null) {
    throw new PreWorkoutOrderConflict("This workout needs the updated service before its order can be changed. Resume its saved order.", current.serverSessionId);
  }
  const effective = current.effectiveWorkout ?? current.workoutSnapshot;
  if (!effective) throw new PreWorkoutOrderConflict("Resume the saved workout before changing its order.", current.serverSessionId);
  let reordered: WorkoutDay;
  try { reordered = reorderWorkout(effective, exerciseIds); }
  catch { throw new PreWorkoutOrderConflict("This workout's exercises changed. Resume the saved workout and review its current exercises.", current.serverSessionId); }
  const currentIds = effective.blocks.flatMap((block) => block.items.map((item) => item.exercise.id));
  if (exerciseIds.every((id, index) => id === currentIds[index])) return current;
  if (current.operations.some((operation) => operation.type === "replace" || (operation.type === "order" && (operation.attempts ?? 0) > 0))) {
    throw new PreWorkoutOrderConflict("Sync the previous exercise change before applying this order.", current.serverSessionId);
  }
  return normalizeWorkoutArrangement({ ...current, effectiveWorkout: reordered, targetReviewExerciseIds: null,
    operations: [...current.operations.filter((operation) => operation.type !== "order"),
      { id: createId(), type: "order", status: "pending", payload: { exerciseIds: [...exerciseIds],
        expectedRevision: current.arrangementRevision ?? 0, applyRevisedTargets: false, requiresReview: true } }],
    revision: current.revision + 1 });
}
