import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { getActiveSession } from "@/services/workoutLoggingService";
import { loadActiveWorkout } from "@/utils/activeWorkoutStore";
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
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutSummary | null>(null);
  const requestVersion = useRef(0);

  const refreshActiveWorkout = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!token || !user) {
      setActiveWorkout(null);
      return;
    }
    const [serverActive, localActive] = await Promise.all([
      getActiveSession(token).catch(() => null),
      loadActiveWorkout(user.id).catch(() => null),
    ]);
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
          if (set.confirmed) completedSetKeys.add(`${set.exerciseId}:${set.setNumber}`);
        }
      }
      setActiveWorkout({
        sessionId: serverActive.id,
        workoutDayId: serverActive.workoutDayId,
        dayType: serverActive.dayType,
        title: serverActive.workoutSnapshot?.title ?? `${serverActive.dayType.replace(/_/g, " ")} workout`,
        totalSets: serverActive.workoutSnapshot?.exerciseBlocks.reduce(
          (total, block) => total + block.items.reduce((count, item) => count + item.prescription.sets, 0),
          0
        ) ?? 0,
        startedAt: new Date(serverActive.startedAt).getTime(),
        completedSets: completedSetKeys.size,
      });
      return;
    }
    if (localActive) {
      setActiveWorkout({
        sessionId: localActive.serverSessionId,
        workoutDayId: localActive.workoutDayId,
        dayType: localActive.dayType,
        title: localActive.workoutSnapshot?.title ?? `${localActive.dayType.replace(/_/g, " ")} workout`,
        totalSets: localActive.workoutSnapshot?.blocks.reduce(
          (total, block) => total + block.items.reduce((count, item) => count + item.prescription.sets, 0),
          0
        ) ?? 0,
        startedAt: localActive.startedAt,
        completedSets: localActive.sets.filter((set) => set.confirmed).length,
      });
      return;
    }
    setActiveWorkout(null);
  }, [token, user]);

  const markWorkoutTerminal = useCallback(() => {
    requestVersion.current += 1;
    setActiveWorkout(null);
  }, []);

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
