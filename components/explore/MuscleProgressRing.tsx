import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface MuscleProgressRingProps {
  label: string;
  progress: number; // 0-1
  size?: number;
  strokeWidth?: number;
}

export function MuscleProgressRing({
  label,
  progress,
  size = 56,
  strokeWidth = 4,
}: MuscleProgressRingProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <View style={styles.container}>
      <View style={[styles.ringContainer, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          {/* Background track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.inputBorder}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress arc */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.electricBlue}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
      </View>
      <ThemedText style={styles.label}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 8,
  },
  ringContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    opacity: 0.7,
  },
});

