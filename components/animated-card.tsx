import React, { useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
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
    opacity.value = withTiming(1, {
      duration: AnimationTiming.normal,
      delay,
    });
    translateY.value = withTiming(0, {
      duration: AnimationTiming.normal,
      delay,
    });
  }, [delay]);

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
