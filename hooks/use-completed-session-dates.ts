import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useContext, useState } from "react";

import { listSessions } from "@/services/workoutLoggingService";
import { AuthContext } from "@/utils/authContext";

/**
 * Dates (YYYY-MM-DD) on which the user completed a workout, for the activity
 * heatmap. Sessions that were started but never completed are excluded, so the
 * grid reflects finished training rather than opened screens.
 */
export function useCompletedSessionDates(limit = 100): Set<string> {
  const { token, isLoggedIn } = useContext(AuthContext);
  const [dates, setDates] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!isLoggedIn || !token) {
      setDates(new Set());
      return;
    }

    try {
      const response = await listSessions(token, limit);
      setDates(
        new Set(
          response.items
            .filter((session) => session.completedAt)
            .map((session) => session.workoutDate)
        )
      );
    } catch (err) {
      console.warn("Failed to load session history:", err);
    }
  }, [isLoggedIn, token, limit]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return dates;
}
