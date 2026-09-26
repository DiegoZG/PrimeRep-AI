import { useAccountResource } from "@/hooks/use-account-resource";
import { getStats, type StatsResponse } from "@/services/workoutLoggingService";

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
  const resource = useAccountResource(getStats);
  return {
    stats: resource.data,
    isLoading: resource.loading,
    error: resource.error ? "Couldn't load your stats." : null,
    refresh: resource.refresh,
  };
}
