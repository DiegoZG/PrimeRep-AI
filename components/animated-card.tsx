import React, { useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { AnimationTiming } from "@/constants/theme";

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  testID?: string;
}

export function AnimatedCard({
  children,
  style,
  delay = 0,
  testID,
}: AnimatedCardProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, {
      duration: AnimationTiming.normal,
    }));
    translateY.value = withDelay(delay, withTiming(0, {
      duration: AnimationTiming.normal,
    }));
  }, [delay, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  return (
    <Animated.View testID={testID} style={[style, animatedStyle]}>{children}</Animated.View>
  );
}
