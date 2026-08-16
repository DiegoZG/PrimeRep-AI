import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as equipmentWeightsService from "@/services/equipmentWeightsService";
import { AuthContext } from "@/utils/authContext";

type EquipmentWeightsContextValue = {
  dumbbellWeights: number[];
  plateWeights: number[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  update: (weights: equipmentWeightsService.EquipmentWeights) => Promise<void>;
};

const emptyWeights: equipmentWeightsService.EquipmentWeights = {
  dumbbellWeights: [],
  plateWeights: [],
};

export const EquipmentWeightsContext = createContext<EquipmentWeightsContextValue>({
  ...emptyWeights,
  isLoading: false,
  hasLoaded: false,
  error: null,
  refresh: async () => {},
  update: async () => {},
});

export function EquipmentWeightsProvider({ children }: PropsWithChildren) {
  const { isBootstrapping, token } = useContext(AuthContext);
  const [weights, setWeights] = useState(emptyWeights);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stateToken, setStateToken] = useState<string | null>(null);
  const authStateRef = useRef({ token, isBootstrapping });
  const requestVersionRef = useRef(0);

  if (
    authStateRef.current.token !== token ||
    authStateRef.current.isBootstrapping !== isBootstrapping
  ) {
    authStateRef.current = { token, isBootstrapping };
    requestVersionRef.current += 1;
  }

  const refresh = useCallback(async () => {
    if (!token) {
      setWeights(emptyWeights);
      setIsLoading(false);
      setHasLoaded(false);
      setError(null);
      setStateToken(null);
      return;
    }

    const requestVersion = ++requestVersionRef.current;
    setStateToken(token);
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await equipmentWeightsService.getEquipmentWeights(token);
      if (
        authStateRef.current.token !== token ||
        requestVersionRef.current !== requestVersion
      ) return;
      setWeights(loaded);
      setHasLoaded(true);
    } catch (refreshError) {
      if (
        authStateRef.current.token !== token ||
        requestVersionRef.current !== requestVersion
      ) return;
      setError("Could not load equipment weights.");
      throw refreshError;
    } finally {
      if (
        authStateRef.current.token === token &&
        requestVersionRef.current === requestVersion
      ) setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isBootstrapping) {
      setWeights(emptyWeights);
      setIsLoading(false);
      setHasLoaded(false);
      setError(null);
      setStateToken(null);
      return;
    }
    if (!token) {
      requestVersionRef.current += 1;
      setWeights(emptyWeights);
      setIsLoading(false);
      setHasLoaded(false);
      setError(null);
      setStateToken(null);
      return;
    }
    setWeights(emptyWeights);
    setHasLoaded(false);
    setError(null);
    refresh().catch((error) => {
      if (__DEV__) console.warn("Equipment weights refresh failed:", error);
    });
  }, [isBootstrapping, refresh, token]);

  const update = useCallback(
    async (nextWeights: equipmentWeightsService.EquipmentWeights) => {
      if (!token) throw new Error("Authentication required");
      const requestVersion = ++requestVersionRef.current;
      setStateToken(token);
      setIsLoading(true);
      setError(null);
      try {
        const saved = await equipmentWeightsService.replaceEquipmentWeights(
          token,
          nextWeights
        );
        if (
          authStateRef.current.token !== token ||
          requestVersionRef.current !== requestVersion
        ) return;
        setWeights(saved);
        setHasLoaded(true);
      } catch (updateError) {
        if (
          authStateRef.current.token !== token ||
          requestVersionRef.current !== requestVersion
        ) return;
        setError("Could not save equipment weights.");
        throw updateError;
      } finally {
        if (
          authStateRef.current.token === token &&
          requestVersionRef.current === requestVersion
        ) setIsLoading(false);
      }
    },
    [token]
  );

  const value = useMemo(() => {
    const belongsToCurrentSession =
      !isBootstrapping && token !== null && stateToken === token;
    return {
      ...(belongsToCurrentSession ? weights : emptyWeights),
      isLoading: belongsToCurrentSession ? isLoading : false,
      hasLoaded: belongsToCurrentSession ? hasLoaded : false,
      error: belongsToCurrentSession ? error : null,
      refresh,
      update,
    };
  }, [error, hasLoaded, isBootstrapping, isLoading, refresh, stateToken, token, update, weights]);

  return (
    <EquipmentWeightsContext.Provider value={value}>
      {children}
    </EquipmentWeightsContext.Provider>
  );
}
