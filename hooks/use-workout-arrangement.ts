import { useCallback, useEffect, useRef, useState } from "react";
import type { Exercise } from "@/interfaces/exercises";
import { HttpError } from "@/services/httpClient";
import { getReplacementCandidates, getSession, previewExerciseOrder, type ExerciseOrderPreview } from "@/services/workoutLoggingService";
import { createClientId, loadActiveWorkout, replayPendingWorkoutOperations, saveActiveWorkout, type LocalActiveWorkout, type PendingWorkoutOperation } from "@/utils/activeWorkoutStore";
import { adoptSessionArrangement, reorderWorkout } from "@/utils/workoutArrangement";

type Review = { exerciseIds: string[]; preview: ExerciseOrderPreview | null; conflict: boolean; invalid?: boolean; message: string };
export function useWorkoutArrangement({ token, userId, sessionKey, snapshot, apply, persist }: {
  token: string | null; userId?: string; sessionKey?: string; snapshot: () => LocalActiveWorkout | null;
  apply: (workout: LocalActiveWorkout) => void; persist: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false), lock = useRef(false);
  const owner = `${userId ?? "guest"}:${token ?? "anonymous"}:${sessionKey ?? "active"}`;
  const lifetime = useRef({ owner, epoch: 0, mounted: true });
  if (lifetime.current.owner !== owner) { lifetime.current = { owner, epoch: lifetime.current.epoch + 1, mounted: true }; lock.current = false; }
  useEffect(() => {
    lifetime.current.mounted = true;
    setBusy(false); setPicker(null); setReview(null); setGuidance(null); setMessage(""); setWaitingOperation(null);
    return () => { lifetime.current.mounted = false; lifetime.current.epoch += 1; lock.current = false; };
  }, [owner]);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [picker, setPicker] = useState<{ exerciseId: string; candidates: Exercise[]; selected: Exercise | null; discard: boolean } | null>(null);
  const [guidance, setGuidance] = useState<Exercise | null>(null);
  const [waitingOperation, setWaitingOperation] = useState<{ id: string; type: "order" | "replace" } | null>(null);
  const latestOperations = snapshot()?.operations;
  useEffect(() => {
    if (!waitingOperation || latestOperations?.some((operation) => operation.id === waitingOperation.id)) return;
    setMessage(waitingOperation.type === "replace" ? "Exercise replaced for this workout. Sets, reps and rest were kept." : "Order saved. Targets stayed the same.");
    setWaitingOperation(null);
  }, [waitingOperation, latestOperations]);
  const run = useCallback(async (work: (guard: () => void) => Promise<void>) => {
    if (lock.current) return;
    const epoch = lifetime.current.epoch;
    const guard = () => { if (!lifetime.current.mounted || lifetime.current.epoch !== epoch) throw new Error("Stale workout request"); };
    lock.current = true; setBusy(true);
    try { await work(guard); } catch (error) {
      if (lifetime.current.mounted && lifetime.current.epoch === epoch) setMessage(error instanceof Error ? error.message : "Couldn’t update this workout. Try again.");
    } finally {
      if (lifetime.current.mounted && lifetime.current.epoch === epoch) { lock.current = false; setBusy(false); }
    }
  }, []);
  const save = useCallback(async (local: LocalActiveWorkout, guard: () => void = () => {}) => {
    guard();
    if (local.userId !== userId) throw new Error("Stale workout request");
    local.revision += 1;
    await saveActiveWorkout(local);
    guard(); apply(local);
  }, [apply, userId]);
  const flush = useCallback(async (guard: () => void) => {
    guard(); await persist(); guard();
    if (!token || !userId) throw new Error("Connect to review workout changes.");
    const result = await replayPendingWorkoutOperations(token, userId);
    guard(); if (result.workout) apply(result.workout);
    const local = result.workout ?? await loadActiveWorkout(userId);
    guard(); if (!local?.serverSessionId) throw new Error("Connect to finish syncing this workout first.");
    if (local.operations.some((operation) => operation.type !== "order")) throw new Error("Sync pending workout changes before continuing.");
    return local;
  }, [persist, token, userId, apply]);
  const inspectOrder = useCallback(async (local: LocalActiveWorkout, ids: string[], conflict: boolean, guard: () => void) => {
    const server = await getSession(token!, local.serverSessionId!); guard();
    const canonical = adoptSessionArrangement(local, server);
    try { reorderWorkout(canonical.effectiveWorkout ?? canonical.workoutSnapshot!, ids); }
    catch {
      setReview({ exerciseIds: ids, preview: null, conflict: true, invalid: true, message: "An exercise changed on another device. Use the latest saved workout, then reorder its exercises again." });
      await save(canonical, guard);
      return;
    }
    let preview: ExerciseOrderPreview;
    try { preview = await previewExerciseOrder(token!, server.id, ids, server.arrangementRevision!); }
    catch (error) {
      if (!(error instanceof HttpError) || error.status !== 409) throw error;
      const latest = adoptSessionArrangement(canonical, await getSession(token!, server.id)); guard();
      await save(latest, guard);
      setReview({ exerciseIds: ids, preview: null, conflict: true, invalid: true, message: "This workout changed while you were reviewing it. Use the latest saved workout, then reorder again." });
      return;
    }
    guard();
    const dirty = canonical.sets.some((set) => ids.includes(set.exerciseId) && (set.hasUnsavedInput || set.editing));
    setReview({ exerciseIds: ids, preview: dirty ? { ...preview, targetsChanged: false, targetChanges: [], message: "Your entered sets are kept. Targets stay the same." } : preview,
      conflict, message: conflict ? "This workout changed elsewhere. Review your order against the latest saved workout." : dirty ? "Your entered sets are kept. Targets stay the same." : preview.message });
    await save(canonical, guard);
  }, [token, save]);
  const move = useCallback((exerciseId: string, destination: number) => void run(async (guard) => {
    const original = snapshot();
    if (!original?.effectiveWorkout || original.arrangementRevision == null) return;
    if (original.operations.some((operation) => operation.type === "replace" || (operation.type === "order" && (operation.attempts ?? 0) > 0))) throw new Error("Finish syncing your previous workout change first.");
    const ids = original.effectiveWorkout.blocks.flatMap((block) => block.items.map((item) => item.exercise.id));
    const source = ids.indexOf(exerciseId);
    if (source < 0 || source === destination) return;
    ids.splice(destination, 0, ids.splice(source, 1)[0]);
    try {
      const local = await flush(guard);
      await inspectOrder(local, ids, false, guard);
    } catch (error) {
      guard(); if (error instanceof HttpError && error.status != null) throw error;
      const local = snapshot() ?? original;
      const operation: PendingWorkoutOperation = { id: createClientId(), type: "order", status: "pending", payload: { exerciseIds: ids, expectedRevision: local.arrangementRevision!, applyRevisedTargets: false, requiresReview: true } };
      const next = { ...local, effectiveWorkout: reorderWorkout(local.effectiveWorkout ?? local.workoutSnapshot!, ids),
        currentExerciseId: local.sets.some((set) => set.confirmed || set.logId) ? local.currentExerciseId : ids[0],
        targetReviewExerciseIds: null,
        operations: [...local.operations.filter((item) => item.type !== "order" || (item.attempts ?? 0) > 0), operation] };
      await save(next, guard);
      setMessage("Order saved on this device and will sync when connected. Targets stay the same; you can review suggestions afterward.");
    }
  }), [snapshot, run, flush, inspectOrder, save]);
  const reviewPending = useCallback(() => void run(async (guard) => {
    const local = await flush(guard);
    const pending = local.operations.find((operation) => operation.type === "order");
    if (pending?.type === "order") {
      if (pending.payload.unsupported) {
        setReview({ exerciseIds: pending.payload.exerciseIds, preview: null, conflict: true, invalid: true, message: "This server doesn’t support workout changes yet. Use the latest saved workout and try again after the app service is updated." });
        return;
      }
      if ((pending.attempts ?? 0) > 0 && !pending.payload.conflict) throw new Error("Your previous order is still syncing. Retry it before reviewing another change.");
      await inspectOrder(local, pending.payload.exerciseIds, pending.payload.conflict === true, guard);
    }
    else if (local.targetReviewExerciseIds) await inspectOrder(local, local.targetReviewExerciseIds, false, guard);
  }), [run, flush, inspectOrder]);
  const applyOrder = useCallback((revised: boolean) => void run(async (guard) => {
    if (!review || review.invalid || !token || !userId) return;
    const local = await loadActiveWorkout(userId); guard();
    if (!local?.serverSessionId || local.arrangementRevision == null) return;
    const operation: PendingWorkoutOperation = { id: createClientId(), type: "order", status: "pending", payload: { exerciseIds: review.exerciseIds, expectedRevision: local.arrangementRevision, applyRevisedTargets: revised && Boolean(review.preview?.targetsChanged) } };
    const next = { ...local, effectiveWorkout: reorderWorkout(local.effectiveWorkout ?? local.workoutSnapshot!, review.exerciseIds),
      currentExerciseId: local.sets.some((set) => set.confirmed || set.logId) ? local.currentExerciseId : review.exerciseIds[0],
      targetReviewExerciseIds: null,
      operations: [...local.operations.filter((item) => item.type !== "order"), operation] };
    await save(next, guard); setReview(null);
    const result = await replayPendingWorkoutOperations(token, userId);
    guard(); if (result.workout) apply(result.workout);
    const failed = result.workout?.operations.find((item) => item.id === operation.id);
    if (failed) setWaitingOperation({ id: operation.id, type: "order" });
    setMessage(failed ? "Order saved on this device. Review any sync issue before continuing." : revised ? "Order and revised targets saved." : "Order saved. Targets stayed the same.");
  }), [review, token, userId, run, save, apply]);
  const openReplacement = useCallback((exerciseId: string) => void run(async (guard) => {
    const local = await flush(guard);
    if (local.operations.length) throw new Error("Review and sync your exercise order first.");
    if (local.sets.some((set) => set.exerciseId === exerciseId && (set.confirmed || set.logId))) throw new Error("You can replace an exercise only before its first saved set.");
    const candidates = await getReplacementCandidates(token!, local.serverSessionId!, exerciseId); guard();
    setPicker({ exerciseId, candidates, selected: null, discard: local.sets.some((set) => set.exerciseId === exerciseId && (set.hasUnsavedInput || set.editing)) });
  }), [run, flush, token]);
  const confirmReplacement = useCallback(() => void run(async (guard) => {
    if (!picker?.selected || !userId || !token) return;
    const local = await flush(guard);
    if (local.operations.length || local.sets.some((set) => set.exerciseId === picker.exerciseId && (set.confirmed || set.logId))) throw new Error("This exercise has saved or pending sets and can’t be replaced.");
    const operation: PendingWorkoutOperation = { id: createClientId(), type: "replace", status: "pending", payload: { exerciseId: picker.exerciseId, replacementExerciseId: picker.selected.id, expectedRevision: local.arrangementRevision! } };
    await save({ ...local, operations: [...local.operations, operation] }, guard);
    const result = await replayPendingWorkoutOperations(token, userId);
    guard(); if (result.workout) apply(result.workout);
    const pending = result.workout?.operations.find((item) => item.id === operation.id);
    setPicker(null);
    if (pending) setWaitingOperation({ id: operation.id, type: "replace" });
    setMessage(pending ? "Replacement is waiting to sync. Your current exercise is kept until it succeeds." : "Exercise replaced for this workout. Sets, reps and rest were kept.");
  }), [picker, userId, token, run, flush, save, apply]);
  const dismissPending = useCallback(() => void run(async (guard) => {
    guard(); await persist(); guard();
    const local = userId ? await loadActiveWorkout(userId) : null; guard();
    if (!token || !local?.serverSessionId) return;
    const server = await getSession(token, local.serverSessionId); guard();
    await save(adoptSessionArrangement({ ...local, targetReviewExerciseIds: null, operations: local.operations.filter((operation) => !(operation.type === "order" && (operation.payload.conflict || (operation.attempts ?? 0) === 0)) && !(operation.type === "replace" && operation.payload.conflict)) }, server), guard);
    setReview(null); setMessage("Latest saved workout restored.");
  }), [run, persist, userId, token, save]);
  return { busy, message, review, setReview, picker, setPicker, guidance, setGuidance, move, reviewPending, applyOrder, openReplacement, confirmReplacement, dismissPending };
}
