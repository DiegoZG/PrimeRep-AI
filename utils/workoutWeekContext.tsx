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
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { AuthContext } from "./authContext";

// =============================================================================
// Types
// =============================================================================

interface WorkoutWeekState {
  ownerUserId: string | null;
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
  skipDay: (
    workoutDayId: string,
    weekStart?: string
  ) => Promise<WorkoutWeekPlan | null>;
  setDuration: (
    workoutDayId: string,
    durationMinutes: number,
    weekStart?: string
  ) => Promise<WorkoutWeekPlan | null>;
  clearStaleIdFlag: () => void;

  // Derived selectors
  getSortedWorkouts: () => WorkoutDay[];
  getHighlightedWorkout: (todayIso: string) => WorkoutDay | null;
  getWorkoutById: (workoutDayId: string) => WorkoutDay | null;
  getExerciseCount: (workout: WorkoutDay) => number;
}

type Action =
  | { type: "RESET_OWNER"; userId: string | null }
  | { type: "FETCH_START"; userId: string }
  | {
      type: "FETCH_SUCCESS";
      userId: string;
      payload: WorkoutWeekPlan;
      weekStart?: string;
    }
  | { type: "FETCH_ERROR"; userId: string; payload: string }
  | { type: "STALE_ID_REFRESHED"; userId: string }
  | { type: "CLEAR_STALE_ID_FLAG"; userId: string };

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
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const date = String(monday.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
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

function createInitialState(ownerUserId: string | null): WorkoutWeekState {
  return {
    ownerUserId,
    weekPlan: null,
    isLoading: ownerUserId !== null,
    error: null,
    currentWeekStart: getCurrentWeekStart(),
    staleIdRefreshed: false,
  };
}

const initialState = createInitialState(null);

function reducer(state: WorkoutWeekState, action: Action): WorkoutWeekState {
  if (action.type === "RESET_OWNER") {
    return createInitialState(action.userId);
  }

  if (action.userId !== state.ownerUserId) {
    return state;
  }

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
  const { token, user, logOut } = useContext(AuthContext);
  const authenticatedUserId = user?.id ?? null;
  const authenticatedUserIdRef = useRef(authenticatedUserId);
  const initializedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    authenticatedUserIdRef.current = authenticatedUserId;
  }, [authenticatedUserId]);

  // -------------------------------------------------------------------------
  // Helper: Handle unauthorized errors
  // -------------------------------------------------------------------------

  /**
   * Handles 401 unauthorized errors by clearing loading state and logging out
   * This ensures isLoading never gets stuck when auth fails
   */
  const handleUnauthorized = useCallback(async (requestUserId: string) => {
    dispatch({
      type: "FETCH_ERROR",
      userId: requestUserId,
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
      const requestUserId = authenticatedUserId;
      if (!token || !requestUserId) {
        return null;
      }

      const weekStart = options?.weekStart || state.currentWeekStart;
      const force = options?.force ?? false;

      if (state.ownerUserId !== requestUserId) {
        dispatch({ type: "RESET_OWNER", userId: requestUserId });
      }
      dispatch({ type: "FETCH_START", userId: requestUserId });

      try {
        // Timeout is now handled by requestJson in httpClient
        const plan = await getWorkoutWeek(token, weekStart, force);
        if (authenticatedUserIdRef.current !== requestUserId) return null;
        dispatch({
          type: "FETCH_SUCCESS",
          userId: requestUserId,
          payload: plan,
          weekStart,
        });
        return plan;
      } catch (err: any) {
        if (authenticatedUserIdRef.current !== requestUserId) return null;
        if (isUnauthorizedError(err)) {
          await handleUnauthorized(requestUserId);
          return null;
        }

        const message = err?.message || "Failed to load workout week";
        dispatch({
          type: "FETCH_ERROR",
          userId: requestUserId,
          payload: message,
        });
        return null;
      }
    },
    [authenticatedUserId, token, state.currentWeekStart, state.ownerUserId, handleUnauthorized]
  );

  useEffect(() => {
    if (!authenticatedUserId) {
      initializedUserIdRef.current = null;
      dispatch({ type: "RESET_OWNER", userId: null });
      return;
    }

    if (!token) {
      dispatch({ type: "RESET_OWNER", userId: authenticatedUserId });
      return;
    }

    if (initializedUserIdRef.current === authenticatedUserId) return;
    initializedUserIdRef.current = authenticatedUserId;
    dispatch({ type: "RESET_OWNER", userId: authenticatedUserId });
    void refreshWeek({
      force: false,
      weekStart: getCurrentWeekStart(),
    });
  }, [authenticatedUserId, token, refreshWeek]);

  const skipDay = useCallback(
    async (workoutDayId: string, requestedWeekStart?: string) => {
      const requestUserId = authenticatedUserId;
      if (!token || !requestUserId) {
        return null;
      }

      const weekStart =
        requestedWeekStart || state.weekPlan?.weekStart || state.currentWeekStart;
      if (state.ownerUserId !== requestUserId) return null;
      dispatch({ type: "FETCH_START", userId: requestUserId });

      try {
        const plan = await skipWorkoutDay(token, workoutDayId, weekStart);
        if (authenticatedUserIdRef.current !== requestUserId) return null;
        dispatch({
          type: "FETCH_SUCCESS",
          userId: requestUserId,
          payload: plan,
          weekStart: plan.weekStart,
        });
        return plan;
      } catch (err: any) {
        if (authenticatedUserIdRef.current !== requestUserId) return null;
        if (isUnauthorizedError(err)) {
          await handleUnauthorized(requestUserId);
          return null;
        }

        // Handle 404 stale ID: refresh + inform + stop (no auto-retry)
        if (isStaleIdError(err)) {
          try {
            const refreshedPlan = await getWorkoutWeek(
              token,
              weekStart,
              false
            );
            if (authenticatedUserIdRef.current !== requestUserId) return null;
            dispatch({
              type: "FETCH_SUCCESS",
              userId: requestUserId,
              payload: refreshedPlan,
              weekStart: refreshedPlan.weekStart,
            });
            dispatch({ type: "STALE_ID_REFRESHED", userId: requestUserId });
          } catch (refreshErr: any) {
            if (authenticatedUserIdRef.current !== requestUserId) return null;
            if (isUnauthorizedError(refreshErr)) {
              await handleUnauthorized(requestUserId);
              return null;
            }
            const message =
              refreshErr?.message || "Failed to refresh workout week";
            dispatch({
              type: "FETCH_ERROR",
              userId: requestUserId,
              payload: message,
            });
          }
          return null; // Return null to signal the mutation didn't apply
        }

        const message = err?.message || "Failed to skip workout day";
        dispatch({
          type: "FETCH_ERROR",
          userId: requestUserId,
          payload: message,
        });
        return null;
      }
    },
    [authenticatedUserId, token, state.currentWeekStart, state.ownerUserId, state.weekPlan?.weekStart, handleUnauthorized]
  );

  const setDuration = useCallback(
    async (
      workoutDayId: string,
      durationMinutes: number,
      requestedWeekStart?: string
    ) => {
      const requestUserId = authenticatedUserId;
      if (!token || !requestUserId) {
        return null;
      }

      const weekStart =
        requestedWeekStart || state.weekPlan?.weekStart || state.currentWeekStart;
      if (state.ownerUserId !== requestUserId) return null;
      dispatch({ type: "FETCH_START", userId: requestUserId });

      try {
        const plan = await updateWorkoutDuration(
          token,
          workoutDayId,
          durationMinutes,
          weekStart
        );
        if (authenticatedUserIdRef.current !== requestUserId) return null;
        dispatch({
          type: "FETCH_SUCCESS",
          userId: requestUserId,
          payload: plan,
          weekStart: plan.weekStart,
        });
        return plan;
      } catch (err: any) {
        if (authenticatedUserIdRef.current !== requestUserId) return null;
        if (isUnauthorizedError(err)) {
          await handleUnauthorized(requestUserId);
          return null;
        }

        // Handle 404 stale ID: refresh + inform + stop (no auto-retry)
        if (isStaleIdError(err)) {
          try {
            const refreshedPlan = await getWorkoutWeek(
              token,
              weekStart,
              false
            );
            if (authenticatedUserIdRef.current !== requestUserId) return null;
            dispatch({
              type: "FETCH_SUCCESS",
              userId: requestUserId,
              payload: refreshedPlan,
              weekStart: refreshedPlan.weekStart,
            });
            dispatch({ type: "STALE_ID_REFRESHED", userId: requestUserId });
          } catch (refreshErr: any) {
            if (authenticatedUserIdRef.current !== requestUserId) return null;
            if (isUnauthorizedError(refreshErr)) {
              await handleUnauthorized(requestUserId);
              return null;
            }
            const message =
              refreshErr?.message || "Failed to refresh workout week";
            dispatch({
              type: "FETCH_ERROR",
              userId: requestUserId,
              payload: message,
            });
          }
          return null; // Return null to signal the mutation didn't apply
        }

        const message = err?.message || "Failed to update workout duration";
        dispatch({
          type: "FETCH_ERROR",
          userId: requestUserId,
          payload: message,
        });
        return null;
      }
    },
    [authenticatedUserId, token, state.currentWeekStart, state.ownerUserId, state.weekPlan?.weekStart, handleUnauthorized]
  );

  const clearStaleIdFlag = useCallback(() => {
    if (!authenticatedUserId) return;
    dispatch({
      type: "CLEAR_STALE_ID_FLAG",
      userId: authenticatedUserId,
    });
  }, [authenticatedUserId]);

  // -------------------------------------------------------------------------
  // Derived Selectors
  // -------------------------------------------------------------------------

  const ownsPlan = state.ownerUserId === authenticatedUserId;
  const visibleWeekPlan = ownsPlan ? state.weekPlan : null;

  const getSortedWorkouts = useCallback((): WorkoutDay[] => {
    if (!visibleWeekPlan?.workouts) return [];
    return [...visibleWeekPlan.workouts].sort((a, b) => a.slotIndex - b.slotIndex);
  }, [visibleWeekPlan]);

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
      if (!visibleWeekPlan?.workouts) return null;
      return (
        visibleWeekPlan.workouts.find((w) => w.workoutDayId === workoutDayId) ||
        null
      );
    },
    [visibleWeekPlan]
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
      weekPlan: visibleWeekPlan,
      isLoading: ownsPlan ? state.isLoading : authenticatedUserId !== null,
      error: ownsPlan ? state.error : null,
      currentWeekStart: ownsPlan
        ? state.currentWeekStart
        : getCurrentWeekStart(),
      staleIdRefreshed: ownsPlan ? state.staleIdRefreshed : false,
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
      visibleWeekPlan,
      ownsPlan,
      authenticatedUserId,
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
