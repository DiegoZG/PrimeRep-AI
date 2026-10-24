import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WorkoutDay } from "@/interfaces/workouts";
import { createClientId, loadActiveWorkout, saveActiveWorkout, queueWorkoutPrestartOrder, type LocalActiveWorkout, type SequencedWorkoutOperation } from "@/utils/activeWorkoutStore";
import type { SessionResponse } from "@/services/workoutLoggingService";
import { mapApiWorkoutDay } from "@/services/workoutWeekService";
import { formatWeightInput, fromKg, loadWeightUnit } from "./weightUnits";
import { adoptSessionArrangement, PreWorkoutOrderConflict, reorderWorkout } from "./workoutArrangement";

export { PreWorkoutOrderConflict } from "./workoutArrangement";

const prefixFor = (userId: string) => `primerep.pre-workout-order.${encodeURIComponent(userId)}.`;
const keyFor = (userId: string, workoutDayId: string) => `${prefixFor(userId)}${encodeURIComponent(workoutDayId)}`;
const deletedOwners = new Set<string>();
let writeQueue: Promise<void> = Promise.resolve();

function write(action: () => Promise<void>): Promise<void> {
  const next = writeQueue.then(action, action);
  writeQueue = next.catch(() => undefined);
  return next;
}

export function preWorkoutOrderFingerprint(workout: WorkoutDay): string {
  return JSON.stringify({ workoutDayId: workout.workoutDayId, date: workout.date,
    dayType: workout.dayType, splitKey: workout.splitKey, durationMinutes: workout.durationMinutes,
    planningMode: workout.planningMode, timeBudgetMinutes: workout.timeBudgetMinutes, planningSource: workout.planningSource,
    programActivationId: workout.programActivationId, templateId: workout.templateId,
    templateVersion: workout.templateVersion, templateDayId: workout.templateDayId,
    items: workout.blocks.flatMap((block) => block.items.map((item) => ({
      blockType: block.blockType, exerciseId: item.exercise.id, prescription: item.prescription,
    }))) });
}

export async function loadPreWorkoutOrder(userId: string, workout: WorkoutDay): Promise<{ exerciseIds: string[] | null; invalidated: boolean }> {
  await writeQueue;
  const key = keyFor(userId, workout.workoutDayId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return { exerciseIds: null, invalidated: false };
  try {
    const saved = JSON.parse(raw);
    let matches = saved.fingerprint === preWorkoutOrderFingerprint(workout);
    if (!matches && typeof saved.fingerprint === "string" && (workout.programActivationId || (workout.planningMode === "time_budget" && workout.planningSource === "default" && workout.timeBudgetMinutes === workout.durationMinutes))) {
      const legacy = JSON.parse(saved.fingerprint);
      const current = JSON.parse(preWorkoutOrderFingerprint(workout));
      if (!("planningMode" in legacy) && !("timeBudgetMinutes" in legacy) && !("planningSource" in legacy)) {
        delete current.planningMode; delete current.timeBudgetMinutes; delete current.planningSource;
        matches = JSON.stringify(legacy) === JSON.stringify(current);
      }
    }
    if (saved.version !== 1 || !matches || !Array.isArray(saved.exerciseIds)
      || saved.exerciseIds.some((id: unknown) => typeof id !== "string")) throw new Error("Workout changed");
    reorderWorkout(workout, saved.exerciseIds);
    return { exerciseIds: [...saved.exerciseIds], invalidated: false };
  } catch {
    return { exerciseIds: null, invalidated: true };
  }
}

export function savePreWorkoutOrder(userId: string, workout: WorkoutDay, exerciseIds: string[]): Promise<void> {
  reorderWorkout(workout, exerciseIds);
  const key = keyFor(userId, workout.workoutDayId);
  const value = JSON.stringify({ version: 1, fingerprint: preWorkoutOrderFingerprint(workout), exerciseIds: [...exerciseIds] });
  return write(async () => {
    if (deletedOwners.has(userId)) throw new Error("This account was deleted.");
    await AsyncStorage.setItem(key, value);
  });
}

export function clearPreWorkoutOrder(userId: string, workoutDayId: string): Promise<void> {
  return write(() => AsyncStorage.removeItem(keyFor(userId, workoutDayId)));
}

export function clearPreWorkoutOrdersForUser(userId: string): Promise<void> {
  deletedOwners.add(userId);
  return write(async () => {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefixFor(userId)));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  });
}

/** Claim the active slot only after Start; revision zero makes the first durable claimant win. */
export async function prepareWorkoutStart(userId: string, originalWorkout: WorkoutDay, serverActive?: SessionResponse | null, isCurrent: () => boolean = () => true): Promise<LocalActiveWorkout | null> {
  if (!isCurrent() || deletedOwners.has(userId)) return null;
  const existing = await loadActiveWorkout(userId);
  if (!isCurrent() || deletedOwners.has(userId)) return null;
  const { exerciseIds } = await loadPreWorkoutOrder(userId, originalWorkout);
  if (!isCurrent() || deletedOwners.has(userId)) return null;
  if (existing || serverActive) {
    if (serverActive && serverActive.workoutDayId !== originalWorkout.workoutDayId) {
      throw new PreWorkoutOrderConflict("Resume the already active workout before starting another one.", serverActive.id);
    }
    if (existing && existing.workoutDayId !== originalWorkout.workoutDayId) return existing;
    if (existing && serverActive && existing.serverSessionId !== serverActive.id && existing.clientSessionId !== serverActive.clientSessionId) {
      throw new PreWorkoutOrderConflict("Another workout session is already active. Resume its saved progress before changing the order.", serverActive.id);
    }
    let baseline = existing;
    if (serverActive) {
      const source = serverActive.workoutSnapshot ?? serverActive.effectiveWorkout;
      if (!source) throw new PreWorkoutOrderConflict("This workout cannot be recovered. Review its saved session.", serverActive.id);
      const unit = await loadWeightUnit();
      if (!isCurrent() || deletedOwners.has(userId)) return null;
      const base: LocalActiveWorkout = existing ?? { userId, workoutDayId: serverActive.workoutDayId,
        workoutDate: serverActive.workoutDate, dayType: serverActive.dayType, workoutSnapshot: mapApiWorkoutDay(source),
        clientSessionId: serverActive.clientSessionId ?? serverActive.id, serverSessionId: serverActive.id,
        startedAt: new Date(serverActive.startedAt).getTime(), currentExerciseIndex: 0, restEndsAt: null,
        restTotalSeconds: 0, restContext: null, revision: 0, sets: [], operations: [], workoutNote: serverActive.workoutNote,
        exerciseFeedback: Object.fromEntries((serverActive.exerciseFeedback ?? []).map((feedback) => [feedback.exerciseId, { effort: feedback.effort, rir: feedback.rir }])) };
      baseline = adoptSessionArrangement(base, serverActive);
      for (const [logs, deleted] of [[serverActive.setLogs ?? [], false], [serverActive.deletedSetLogs ?? [], true]] as const) {
        for (const log of logs) {
          const local = baseline.sets.find((set) => set.exerciseId === log.exerciseId && set.setNumber === log.setNumber);
          const saved = { ...(local ?? {}), exerciseId: log.exerciseId, setNumber: log.setNumber,
            reps: local?.hasUnsavedInput || local?.editing ? local.reps : String(log.reps),
            weight: local?.hasUnsavedInput || local?.editing ? local.weight : log.weightKg == null ? "" : formatWeightInput(fromKg(log.weightKg, unit)),
            weightKg: log.weightKg, confirmed: true, syncing: local?.syncing ?? false, syncStatus: local?.syncStatus ?? "synced" as const,
            logId: log.id, version: log.version, deleted, deletedLogId: deleted ? log.id : null };
          baseline.sets = [...baseline.sets.filter((set) => set.exerciseId !== log.exerciseId || set.setNumber !== log.setNumber), saved];
        }
      }
      baseline.operations = baseline.operations.filter((operation) => operation.type !== "create");
    }
    if (!baseline) return null;
    if (!exerciseIds) return baseline;
    return queueWorkoutPrestartOrder(baseline, exerciseIds, () => isCurrent() && !deletedOwners.has(userId));
  }
  const original = JSON.parse(JSON.stringify(originalWorkout)) as WorkoutDay;
  const effective = exerciseIds ? reorderWorkout(original, exerciseIds) : original;
  const clientSessionId = createClientId();
  const operations: SequencedWorkoutOperation[] = [{ id: createClientId(), type: "create", status: "pending", sequence: 1,
    payload: { workoutDayId: original.workoutDayId, workoutDate: original.date, dayType: original.dayType, clientSessionId } }];
  const originalIds = original.blocks.flatMap((block) => block.items.map((item) => item.exercise.id));
  if (exerciseIds && exerciseIds.some((id, index) => originalIds[index] !== id)) {
    operations.push({ id: createClientId(), type: "order", status: "pending", sequence: 2,
      payload: { exerciseIds: [...exerciseIds], expectedRevision: 0, applyRevisedTargets: false, requiresReview: true } });
  }
  const sets = effective.blocks.flatMap((block) => block.items.flatMap((item) =>
    Array.from({ length: item.prescription.sets }, (_, index) => ({ exerciseId: item.exercise.id,
      setNumber: index + 1, reps: "", weight: "", confirmed: false, syncing: false, syncStatus: "synced" as const, logId: null }))));
  await saveActiveWorkout({ userId, workoutDayId: original.workoutDayId, workoutDate: original.date, dayType: original.dayType,
    workoutSnapshot: original, effectiveWorkout: effective, arrangementRevision: 0, currentExerciseId: effective.blocks[0]?.items[0]?.exercise.id ?? null,
    clientSessionId, serverSessionId: null, startedAt: Date.now(), finishedAt: null, currentExerciseIndex: 0,
    restEndsAt: null, restTotalSeconds: 0, restContext: null, revision: 0, sets, operations }, () => isCurrent() && !deletedOwners.has(userId));
  if (!isCurrent() || deletedOwners.has(userId)) return null;
  return loadActiveWorkout(userId);
}
