import React, { useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { AnimationTiming } from "@/constants/theme";

interface AnimatedCheckmarkProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  visible?: boolean;
}

export function AnimatedCheckmark({
  children,
  style,
  visible = true,
}: AnimatedCheckmarkProps) {
  const scale = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSequence(
        withTiming(1.15, { duration: AnimationTiming.fast }),
        withTiming(1, { duration: AnimationTiming.fast })
      );
    } else {
      scale.value = withTiming(0, { duration: AnimationTiming.fast });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: scale.value > 0 ? 1 : 0,
    };
  });

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
}
