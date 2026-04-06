import type { WorkoutDay, WorkoutWeekPlan } from "@/interfaces/workouts";
import {
  getWorkoutWeek,
  skipWorkoutDay,
  updateWorkoutDuration,
} from "@/services/workoutWeekService";
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";
import { AuthContext } from "./authContext";

// =============================================================================
// Types
// =============================================================================

interface WorkoutWeekState {
  weekPlan: WorkoutWeekPlan | null;
  isLoading: boolean;
  error: string | null;
  currentWeekStart: string; // YYYY-MM-DD
  staleIdRefreshed: boolean; // Flag to indicate a stale ID triggered a refresh
}

interface WorkoutWeekContextValue {
  weekPlan: WorkoutWeekPlan | null;
  isLoading: boolean;
  error: string | null;
  currentWeekStart: string;
  staleIdRefreshed: boolean;

  // Actions
  refreshWeek: (options?: {
    force?: boolean;
    weekStart?: string;
  }) => Promise<WorkoutWeekPlan | null>;
  skipDay: (workoutDayId: string) => Promise<WorkoutWeekPlan | null>;
  setDuration: (
    workoutDayId: string,
    durationMinutes: number
  ) => Promise<WorkoutWeekPlan | null>;
  clearStaleIdFlag: () => void;

  // Derived selectors
  getSortedWorkouts: () => WorkoutDay[];
  getHighlightedWorkout: (todayIso: string) => WorkoutDay | null;
  getWorkoutById: (workoutDayId: string) => WorkoutDay | null;
  getExerciseCount: (workout: WorkoutDay) => number;
}

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: WorkoutWeekPlan; weekStart?: string }
  | { type: "FETCH_ERROR"; payload: string }
  | { type: "SET_WEEK_START"; payload: string }
  | { type: "STALE_ID_REFRESHED" }
  | { type: "CLEAR_STALE_ID_FLAG" };

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get the start of the current week (Monday) in YYYY-MM-DD format
 */
function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  // Adjust so Monday is 0 (instead of Sunday being 0)
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split("T")[0];
}

/**
 * Check if error is a 404 stale ID error
 */
function isStaleIdError(err: any): boolean {
  return err?.status === 404;
}

/**
 * Check if error is a 401 unauthorized error
 */
function isUnauthorizedError(err: any): boolean {
  return err?.status === 401;
}

// =============================================================================
// Reducer
// =============================================================================

const initialState: WorkoutWeekState = {
  weekPlan: null,
  isLoading: false,
  error: null,
  currentWeekStart: getCurrentWeekStart(),
  staleIdRefreshed: false,
};

function reducer(state: WorkoutWeekState, action: Action): WorkoutWeekState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true, error: null };

    case "FETCH_SUCCESS":
      return {
        ...state,
        weekPlan: action.payload,
        isLoading: false,
        error: null,
        currentWeekStart: action.weekStart || state.currentWeekStart,
      };

    case "FETCH_ERROR":
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };

    case "SET_WEEK_START":
      return {
        ...state,
        currentWeekStart: action.payload,
      };

    case "STALE_ID_REFRESHED":
      return {
        ...state,
        staleIdRefreshed: true,
      };

    case "CLEAR_STALE_ID_FLAG":
      return {
        ...state,
        staleIdRefreshed: false,
      };

    default:
      return state;
  }
}

// =============================================================================
// Context
// =============================================================================

export const WorkoutWeekContext = createContext<WorkoutWeekContextValue>({
  weekPlan: null,
  isLoading: false,
  error: null,
  currentWeekStart: getCurrentWeekStart(),
  staleIdRefreshed: false,
  refreshWeek: async () => null,
  skipDay: async () => null,
  setDuration: async () => null,
  clearStaleIdFlag: () => {},
  getSortedWorkouts: () => [],
  getHighlightedWorkout: () => null,
  getWorkoutById: () => null,
  getExerciseCount: () => 0,
});

// =============================================================================
// Provider
// =============================================================================

export function WorkoutWeekProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { token, logOut } = useContext(AuthContext);

  // -------------------------------------------------------------------------
  // Helper: Handle unauthorized errors
  // -------------------------------------------------------------------------

  /**
   * Handles 401 unauthorized errors by clearing loading state and logging out
   * This ensures isLoading never gets stuck when auth fails
   */
  const handleUnauthorized = useCallback(async () => {
    dispatch({
      type: "FETCH_ERROR",
      payload: "Session expired. Please sign in again.",
    });
    try {
      await logOut();
    } catch (err) {
      // Log but don't throw - we've already cleared loading state
      console.warn("Failed to log out after 401:", err);
    }
  }, [logOut]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const refreshWeek = useCallback(
    async (options?: { force?: boolean; weekStart?: string }) => {
      if (!token) {
        dispatch({ type: "FETCH_ERROR", payload: "Authentication required" });
        return null;
      }

      const weekStart = options?.weekStart || state.currentWeekStart;
      const force = options?.force ?? false;

      dispatch({ type: "FETCH_START" });

      try {
        // Timeout is now handled by requestJson in httpClient
        const plan = await getWorkoutWeek(token, weekStart, force);
        dispatch({ type: "FETCH_SUCCESS", payload: plan, weekStart });
        return plan;
      } catch (err: any) {
        if (isUnauthorizedError(err)) {
          await handleUnauthorized();
          return null;
        }

        const message = err?.message || "Failed to load workout week";
        dispatch({ type: "FETCH_ERROR", payload: message });
        return null;
      }
    },
    [token, state.currentWeekStart, handleUnauthorized]
  );

  const skipDay = useCallback(
    async (workoutDayId: string) => {
      if (!token) {
        dispatch({ type: "FETCH_ERROR", payload: "Authentication required" });
        return null;
      }

      dispatch({ type: "FETCH_START" });

      try {
        const plan = await skipWorkoutDay(token, workoutDayId);
        dispatch({ type: "FETCH_SUCCESS", payload: plan });
        return plan;
      } catch (err: any) {
        if (isUnauthorizedError(err)) {
          await handleUnauthorized();
          return null;
        }

        // Handle 404 stale ID: refresh + inform + stop (no auto-retry)
        if (isStaleIdError(err)) {
          try {
            const refreshedPlan = await getWorkoutWeek(
              token,
              state.currentWeekStart,
              false
            );
            dispatch({ type: "FETCH_SUCCESS", payload: refreshedPlan });
            dispatch({ type: "STALE_ID_REFRESHED" });
          } catch (refreshErr: any) {
            if (isUnauthorizedError(refreshErr)) {
              await handleUnauthorized();
              return null;
            }
            const message =
              refreshErr?.message || "Failed to refresh workout week";
            dispatch({ type: "FETCH_ERROR", payload: message });
          }
          return null; // Return null to signal the mutation didn't apply
        }

        const message = err?.message || "Failed to skip workout day";
        dispatch({ type: "FETCH_ERROR", payload: message });
        return null;
      }
    },
    [token, state.currentWeekStart, handleUnauthorized]
  );

  const setDuration = useCallback(
    async (workoutDayId: string, durationMinutes: number) => {
      if (!token) {
        dispatch({ type: "FETCH_ERROR", payload: "Authentication required" });
        return null;
      }

      dispatch({ type: "FETCH_START" });

      try {
        const plan = await updateWorkoutDuration(
          token,
          workoutDayId,
          durationMinutes
        );
        dispatch({ type: "FETCH_SUCCESS", payload: plan });
        return plan;
      } catch (err: any) {
        if (isUnauthorizedError(err)) {
          await handleUnauthorized();
          return null;
        }

        // Handle 404 stale ID: refresh + inform + stop (no auto-retry)
        if (isStaleIdError(err)) {
          try {
            const refreshedPlan = await getWorkoutWeek(
              token,
              state.currentWeekStart,
              false
            );
            dispatch({ type: "FETCH_SUCCESS", payload: refreshedPlan });
            dispatch({ type: "STALE_ID_REFRESHED" });
          } catch (refreshErr: any) {
            if (isUnauthorizedError(refreshErr)) {
              await handleUnauthorized();
              return null;
            }
            const message =
              refreshErr?.message || "Failed to refresh workout week";
            dispatch({ type: "FETCH_ERROR", payload: message });
          }
          return null; // Return null to signal the mutation didn't apply
        }

        const message = err?.message || "Failed to update workout duration";
        dispatch({ type: "FETCH_ERROR", payload: message });
        return null;
      }
    },
    [token, state.currentWeekStart, handleUnauthorized]
  );

  const clearStaleIdFlag = useCallback(() => {
    dispatch({ type: "CLEAR_STALE_ID_FLAG" });
  }, []);

  // -------------------------------------------------------------------------
  // Derived Selectors
  // -------------------------------------------------------------------------

  const getSortedWorkouts = useCallback((): WorkoutDay[] => {
    if (!state.weekPlan?.workouts) return [];
    return [...state.weekPlan.workouts].sort((a, b) => a.slotIndex - b.slotIndex);
  }, [state.weekPlan]);

  const getHighlightedWorkout = useCallback(
    (todayIso: string): WorkoutDay | null => {
      const sorted = getSortedWorkouts();
      if (sorted.length === 0) return null;

      // First, try to find a workout matching today
      const todayWorkout = sorted.find((w) => w.date === todayIso);
      if (todayWorkout) return todayWorkout;

      // Otherwise, find the next upcoming workout (min date >= today)
      const upcoming = sorted.filter((w) => w.date >= todayIso);
      if (upcoming.length > 0) {
        return upcoming[0]; // Already sorted by slotIndex, which should align with date order
      }

      // If no upcoming workouts, return the first one
      return sorted[0];
    },
    [getSortedWorkouts]
  );

  const getWorkoutById = useCallback(
    (workoutDayId: string): WorkoutDay | null => {
      if (!state.weekPlan?.workouts) return null;
      return (
        state.weekPlan.workouts.find((w) => w.workoutDayId === workoutDayId) ||
        null
      );
    },
    [state.weekPlan]
  );

  const getExerciseCount = useCallback((workout: WorkoutDay): number => {
    if (!workout?.blocks) return 0;
    return workout.blocks.reduce(
      (total, block) => total + (block.items?.length || 0),
      0
    );
  }, []);

  // -------------------------------------------------------------------------
  // Context Value
  // -------------------------------------------------------------------------

  const value = useMemo<WorkoutWeekContextValue>(
    () => ({
      weekPlan: state.weekPlan,
      isLoading: state.isLoading,
      error: state.error,
      currentWeekStart: state.currentWeekStart,
      staleIdRefreshed: state.staleIdRefreshed,
      refreshWeek,
      skipDay,
      setDuration,
      clearStaleIdFlag,
      getSortedWorkouts,
      getHighlightedWorkout,
      getWorkoutById,
      getExerciseCount,
    }),
    [
      state.weekPlan,
      state.isLoading,
      state.error,
      state.currentWeekStart,
      state.staleIdRefreshed,
      refreshWeek,
      skipDay,
      setDuration,
      clearStaleIdFlag,
      getSortedWorkouts,
      getHighlightedWorkout,
      getWorkoutById,
      getExerciseCount,
    ]
  );

  return (
    <WorkoutWeekContext.Provider value={value}>
      {children}
    </WorkoutWeekContext.Provider>
  );
}

