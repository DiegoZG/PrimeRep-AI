import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useContext, useState } from "react";

import { getStats, type StatsResponse } from "@/services/workoutLoggingService";
import { AuthContext } from "@/utils/authContext";

interface UseStatsResult {
  stats: StatsResponse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Quick Stats for the logged-in user, shared by Home and Profile.
 *
 * Refetches whenever the screen regains focus: finishing a workout changes the
 * streak and completed count, and those screens are what the user lands back on.
 */
export function useStats(): UseStatsResult {
  const { token, isLoggedIn } = useContext(AuthContext);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isLoggedIn || !token) {
      setStats(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setStats(await getStats(token));
    } catch (err) {
      console.warn("Failed to load workout stats:", err);
      setError("Couldn't load your stats.");
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn, token]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { stats, isLoading, error, refresh };
}
