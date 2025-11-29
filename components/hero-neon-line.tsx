import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface HeroNeonLineProps {
  width?: number;
  height?: number;
  style?: any;
}

export function HeroNeonLine({
  width = 200,
  height = 2,
  style,
}: HeroNeonLineProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const translateX = useSharedValue(-width);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Start animation after a delay, then repeat occasionally
    const startAnimation = () => {
      opacity.value = withTiming(1, { duration: 300 });
      translateX.value = withSequence(
        withTiming(width * 2, {
          duration: 2000,
          easing: Easing.out(Easing.ease),
        }),
        withTiming(-width, { duration: 0 })
      );
    };

    // Initial delay
    const timeout1 = setTimeout(() => {
      startAnimation();
    }, 2000);

    // Repeat every 8-12 seconds
    const interval = setInterval(() => {
      const randomDelay = Math.random() * 2000 + 8000; // 8-10 seconds
      setTimeout(() => {
        startAnimation();
      }, randomDelay);
    }, 10000);

    return () => {
      clearTimeout(timeout1);
      clearInterval(interval);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      opacity: opacity.value,
    };
  });

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Animated.View
        style={[
          styles.line,
          {
            width,
            height,
            backgroundColor: colors.electricBlue,
            shadowColor: colors.electricBlue,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    overflow: "hidden",
  },
  line: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
});
