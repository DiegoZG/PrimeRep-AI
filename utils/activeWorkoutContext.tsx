import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { getActiveSession, getSession } from "@/services/workoutLoggingService";
import { clearActiveWorkout, loadActiveWorkout } from "@/utils/activeWorkoutStore";
import { AuthContext } from "@/utils/authContext";

export interface ActiveWorkoutSummary {
  sessionId: string | null;
  workoutDayId: string;
  dayType: string;
  title: string;
  totalSets: number;
  startedAt: number;
  completedSets: number;
}

interface ActiveWorkoutContextValue {
  activeWorkout: ActiveWorkoutSummary | null;
  refreshActiveWorkout: () => Promise<void>;
  markWorkoutTerminal: () => void;
}

const ActiveWorkoutContext = createContext<ActiveWorkoutContextValue>({
  activeWorkout: null,
  refreshActiveWorkout: async () => {},
  markWorkoutTerminal: () => {},
});

export function ActiveWorkoutProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useContext(AuthContext);
  const authenticatedUserId = user?.id ?? null;
  const [activeState, setActiveState] = useState<{
    ownerUserId: string | null;
    workout: ActiveWorkoutSummary | null;
  }>({ ownerUserId: null, workout: null });
  const requestVersion = useRef(0);
  const activeWorkout = activeState.ownerUserId === authenticatedUserId
    ? activeState.workout
    : null;

  const refreshActiveWorkout = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!token || !user) {
      setActiveState({ ownerUserId: null, workout: null });
      return;
    }
    const requestUserId = user.id;
    const serverActiveRequest = getActiveSession(token).catch(() => null);
    const localActive = await loadActiveWorkout(user.id).catch(() => null);
    if (version !== requestVersion.current) return;
    if (localActive) {
      setActiveState({
        ownerUserId: requestUserId,
        workout: {
          sessionId: localActive.serverSessionId,
          workoutDayId: localActive.workoutDayId,
          dayType: localActive.dayType,
          title: (localActive.effectiveWorkout ?? localActive.workoutSnapshot)?.title ?? `${localActive.dayType.replace(/_/g, " ")} workout`,
          totalSets: (localActive.effectiveWorkout ?? localActive.workoutSnapshot)?.blocks.reduce(
            (total, block) => total + block.items.reduce((count, item) => count + item.prescription.sets, 0),
            0
          ) ?? 0,
          startedAt: localActive.startedAt,
          completedSets: localActive.sets.filter((set) => set.confirmed && !set.deleted).length,
        },
      });
    }
    const serverActive = await serverActiveRequest;
    if (version !== requestVersion.current) return;
    if (serverActive) {
      const matchingLocal = localActive && (
        localActive.serverSessionId === serverActive.id ||
        (serverActive.clientSessionId !== null && localActive.clientSessionId === serverActive.clientSessionId)
      );
      const completedSetKeys = new Set(
        serverActive.setLogs.map((set) => `${set.exerciseId}:${set.setNumber}`)
      );
      if (matchingLocal) {
        for (const set of localActive.sets) {
          if (set.confirmed && !set.deleted) completedSetKeys.add(`${set.exerciseId}:${set.setNumber}`);
        }
      }
      setActiveState({
        ownerUserId: requestUserId,
        workout: {
          sessionId: serverActive.id,
          workoutDayId: serverActive.workoutDayId,
          dayType: serverActive.dayType,
          title: (serverActive.effectiveWorkout ?? serverActive.workoutSnapshot)?.title ?? `${serverActive.dayType.replace(/_/g, " ")} workout`,
          totalSets: (serverActive.effectiveWorkout ?? serverActive.workoutSnapshot)?.exerciseBlocks.reduce(
            (total, block) => total + block.items.reduce((count, item) => count + item.prescription.sets, 0),
            0
          ) ?? 0,
          startedAt: new Date(serverActive.startedAt).getTime(),
          completedSets: completedSetKeys.size,
        },
      });
      return;
    }
    if (localActive) {
      if (localActive.serverSessionId) {
        const localSession = await getSession(token, localActive.serverSessionId).catch(() => null);
        if (version !== requestVersion.current) return;
        if (localSession && localSession.status !== "in_progress") {
          await clearActiveWorkout(user.id);
          if (version === requestVersion.current) {
            setActiveState({ ownerUserId: requestUserId, workout: null });
          }
          return;
        }
      }
      return;
    }
    setActiveState({ ownerUserId: requestUserId, workout: null });
  }, [token, user]);

  const markWorkoutTerminal = useCallback(() => {
    requestVersion.current += 1;
    setActiveState({ ownerUserId: authenticatedUserId, workout: null });
  }, [authenticatedUserId]);

  useEffect(() => {
    void refreshActiveWorkout();
  }, [refreshActiveWorkout]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshActiveWorkout();
    });
    return () => subscription.remove();
  }, [refreshActiveWorkout]);

  return (
    <ActiveWorkoutContext.Provider value={{ activeWorkout, refreshActiveWorkout, markWorkoutTerminal }}>
      {children}
    </ActiveWorkoutContext.Provider>
  );
}

export function useActiveWorkout() {
  return useContext(ActiveWorkoutContext);
}
