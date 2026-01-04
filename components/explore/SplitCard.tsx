import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { AnimatedButton } from "@/components/animated-button";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface SplitCardProps {
  title: string;
  subtitle: string;
  progress?: number; // 0-1 for progress bar
  accentColor?: string;
  imageUrl?: string;
  gradientColors?: [string, string];
  onPress?: () => void;
}

export function SplitCard({
  title,
  subtitle,
  progress = 0,
  accentColor,
  imageUrl,
  gradientColors,
  onPress,
}: SplitCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const accent = accentColor || colors.primaryButton;

  const defaultGradientColors: [string, string] = gradientColors || [
    "rgba(106, 79, 245, 0.95)",
    "rgba(106, 79, 245, 0.7)",
  ];

  return (
    <AnimatedButton onPress={onPress} style={styles.container}>
      {/* Background */}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.backgroundImage}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={defaultGradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.backgroundImage}
        />
      )}

      {/* Dark overlay for text readability */}
      <View style={styles.overlay} />

      {/* Content */}
      <View style={styles.content}>
        {/* Stacked title text */}
        <View style={styles.titleContainer}>
          {title.split(" ").map((word, index) => (
            <Text key={index} style={styles.titleWord}>
              {word.toUpperCase()}
            </Text>
          ))}
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: accent,
                },
              ]}
            />
          </View>
        </View>
      </View>
    </AnimatedButton>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 180,
    height: 220,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  titleContainer: {
    marginBottom: 8,
  },
  titleWord: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    fontFamily: Fonts.sans,
    lineHeight: 32,
    letterSpacing: 1,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
    fontWeight: "500",
    fontFamily: Fonts.sans,
    marginBottom: 12,
  },
  progressContainer: {
    width: "100%",
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
});

