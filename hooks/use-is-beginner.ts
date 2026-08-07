import { useContext, useEffect, useState } from "react";

import { getOnboardingMe } from "@/services/onboardingService";
import { AuthContext } from "@/utils/authContext";

const BEGINNER_EXPERIENCE_LEVELS = new Set(["no-experience", "beginner"]);

/**
 * Whether the logged-in user's onboarding experience level is beginner-ish
 * ("no-experience" or "beginner"). Used to decide when to surface beginner
 * notes prominently. Always false when logged out or experience is unknown.
 */
export function useIsBeginner(): boolean {
  const { token, isLoggedIn } = useContext(AuthContext);
  const [isBeginner, setIsBeginner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadExperience() {
      if (!isLoggedIn || !token) return;
      try {
        const data = await getOnboardingMe(token);
        if (!cancelled && data.experienceLevel) {
          setIsBeginner(BEGINNER_EXPERIENCE_LEVELS.has(data.experienceLevel));
        }
      } catch (err) {
        console.warn("Failed to load onboarding profile:", err);
      }
    }
    loadExperience();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, token]);

  return isBeginner;
}
