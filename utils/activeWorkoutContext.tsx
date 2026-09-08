import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { getActiveSession } from "@/services/workoutLoggingService";
import { loadActiveWorkout } from "@/utils/activeWorkoutStore";
import { AuthContext } from "@/utils/authContext";

export interface ActiveWorkoutSummary {
  workoutDayId: string;
  dayType: string;
  startedAt: number;
  completedSets: number;
}

interface ActiveWorkoutContextValue {
  activeWorkout: ActiveWorkoutSummary | null;
  refreshActiveWorkout: () => Promise<void>;
}

const ActiveWorkoutContext = createContext<ActiveWorkoutContextValue>({
  activeWorkout: null,
  refreshActiveWorkout: async () => {},
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
      setActiveWorkout({
        workoutDayId: serverActive.workoutDayId,
        dayType: serverActive.dayType,
        startedAt: new Date(serverActive.startedAt).getTime(),
        completedSets: serverActive.setLogs.length,
      });
      return;
    }
    if (localActive) {
      setActiveWorkout({
        workoutDayId: localActive.workoutDayId,
        dayType: localActive.dayType,
        startedAt: localActive.startedAt,
        completedSets: localActive.sets.filter((set) => set.confirmed).length,
      });
      return;
    }
    setActiveWorkout(null);
  }, [token, user]);

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
    <ActiveWorkoutContext.Provider value={{ activeWorkout, refreshActiveWorkout }}>
      {children}
    </ActiveWorkoutContext.Provider>
  );
}

export function useActiveWorkout() {
  return useContext(ActiveWorkoutContext);
}
