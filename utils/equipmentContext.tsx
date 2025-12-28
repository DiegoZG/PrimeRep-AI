import { EQUIPMENT } from "@/constants/equipment";
import { Equipment } from "@/constants/equipment/types";
import {
  readEquipmentCache,
  writeEquipmentCache,
} from "@/services/equipmentCache";
import {
  getEquipment,
  mapApiItemToEquipment,
} from "@/services/equipmentService";
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
} from "react";

type EquipmentError = "network" | "server" | null;

interface EquipmentState {
  items: Equipment[];
  isLoading: boolean;
  error: EquipmentError;
  lastFetchedAt: number | null;
  isUsingFallback?: boolean;
}

type EquipmentAction =
  | { type: "FETCH_START" }
  | {
      type: "FETCH_SUCCESS";
      payload: {
        items: Equipment[];
        fetchedAt: number;
        isUsingFallback?: boolean;
      };
    }
  | { type: "FETCH_ERROR"; payload: { error: Exclude<EquipmentError, null> } };

function equipmentReducer(
  state: EquipmentState,
  action: EquipmentAction
): EquipmentState {
  switch (action.type) {
    case "FETCH_START":
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case "FETCH_SUCCESS":
      return {
        ...state,
        items: action.payload.items,
        lastFetchedAt: action.payload.fetchedAt,
        isLoading: false,
        error: null,
        isUsingFallback: action.payload.isUsingFallback,
      };

    case "FETCH_ERROR":
      return {
        ...state,
        isLoading: false,
        error: action.payload.error,
        // Keep existing items if we have them (stale-while-revalidate)
      };

    default:
      return state;
  }
}

interface EquipmentContextValue {
  items: Equipment[];
  isLoading: boolean;
  error: EquipmentError;
  lastFetchedAt: number | null;
  isUsingFallback?: boolean;
  ensureEquipmentLoaded: (options?: { force?: boolean }) => Promise<void>;
}

const initialState: EquipmentState = {
  items: [],
  isLoading: false,
  error: null,
  lastFetchedAt: null,
  isUsingFallback: false,
};

export const EquipmentContext = createContext<EquipmentContextValue>({
  items: [],
  isLoading: false,
  error: null,
  lastFetchedAt: null,
  isUsingFallback: false,
  ensureEquipmentLoaded: async () => {},
});

function getStatus(err: any): number | undefined {
  if (err && typeof err === "object" && typeof err.status === "number") {
    return err.status;
  }
  return undefined;
}

function classifyEquipmentError(err: any): Exclude<EquipmentError, null> {
  const status = getStatus(err);
  if (typeof status !== "number") return "network";
  return "server";
}

export function EquipmentProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(equipmentReducer, initialState);

  // Hydrate from cache on mount (no network call)
  useEffect(() => {
    let isMounted = true;

    async function hydrateFromCache() {
      try {
        const cached = await readEquipmentCache();
        if (cached && isMounted) {
          dispatch({
            type: "FETCH_SUCCESS",
            payload: {
              items: cached.items,
              fetchedAt: cached.fetchedAt,
              isUsingFallback: cached.isUsingFallback,
            },
          });
        }
      } catch (error) {
        // Silently fail - cache hydration errors shouldn't break the app
        console.warn("Failed to hydrate equipment from cache:", error);
      }
    }

    hydrateFromCache();

    return () => {
      isMounted = false;
    };
  }, []);

  // Non-blocking background refresh after cache hydration
  // This ensures equipment is available app-wide without screens needing to call ensureEquipmentLoaded()
  useEffect(() => {
    // Only refresh if we don't have items or cache is stale
    // This respects TTL and won't double-fetch if cache is fresh
    ensureEquipmentLoaded().catch((err) => {
      if (__DEV__) {
        console.warn("Equipment background refresh failed:", err);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const ensureEquipmentLoaded = useCallback(
    async (options?: { force?: boolean }) => {
      console.log("in ensure fucntion");
      const { force = false } = options || {};

      // If not forcing and we have fresh data, skip fetch
      if (!force && state.items.length > 0 && state.lastFetchedAt) {
        const now = Date.now();
        const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (now - state.lastFetchedAt < CACHE_TTL_MS) {
          return;
        }
      }

      dispatch({ type: "FETCH_START" });

      try {
        const apiItems = await getEquipment();
        const equipment = apiItems
          .map((item) => {
            try {
              return mapApiItemToEquipment(item);
            } catch {
              // Skip inactive items
              return null;
            }
          })
          .filter((eq): eq is Equipment => eq !== null);

        const fetchedAt = Date.now();

        // Update cache
        await writeEquipmentCache({
          items: equipment,
          fetchedAt,
          isUsingFallback: false,
        });

        dispatch({
          type: "FETCH_SUCCESS",
          payload: {
            items: equipment,
            fetchedAt,
            isUsingFallback: false,
          },
        });
      } catch (err: any) {
        const error = classifyEquipmentError(err);

        // Try to use cache if available
        const cached = await readEquipmentCache();
        if (cached && cached.items.length > 0) {
          // Use stale cache but mark error
          dispatch({
            type: "FETCH_SUCCESS",
            payload: {
              items: cached.items,
              fetchedAt: cached.fetchedAt,
              isUsingFallback: cached.isUsingFallback,
            },
          });
          // Still dispatch error so UI can show warning
          dispatch({ type: "FETCH_ERROR", payload: { error } });
        } else {
          // No cache available - use static fallback
          const fallbackItems: Equipment[] = EQUIPMENT;
          const fetchedAt = Date.now();

          // Cache the fallback so we don't keep trying
          await writeEquipmentCache({
            items: fallbackItems,
            fetchedAt,
            isUsingFallback: true,
          });

          dispatch({
            type: "FETCH_SUCCESS",
            payload: {
              items: fallbackItems,
              fetchedAt,
              isUsingFallback: true,
            },
          });
          dispatch({ type: "FETCH_ERROR", payload: { error } });
        }
      }
    },
    [state.items.length, state.lastFetchedAt]
  );

  const value = useMemo<EquipmentContextValue>(
    () => ({
      items: state.items,
      isLoading: state.isLoading,
      error: state.error,
      lastFetchedAt: state.lastFetchedAt,
      isUsingFallback: state.isUsingFallback,
      ensureEquipmentLoaded,
    }),
    [
      state.items,
      state.isLoading,
      state.error,
      state.lastFetchedAt,
      state.isUsingFallback,
      ensureEquipmentLoaded,
    ]
  );

  return (
    <EquipmentContext.Provider value={value}>
      {children}
    </EquipmentContext.Provider>
  );
}

export function useEquipment() {
  return React.useContext(EquipmentContext);
}
