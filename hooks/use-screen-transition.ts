import { useEffect } from "react";
import { useSharedValue, withTiming } from "react-native-reanimated";

import { AnimationTiming } from "@/constants/theme";

export function useScreenTransition() {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(30);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: AnimationTiming.normal,
    });
    translateX.value = withTiming(0, {
      duration: AnimationTiming.normal,
    });
  }, []);

  return { opacity, translateX };
}
