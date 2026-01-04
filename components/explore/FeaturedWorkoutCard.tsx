import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface FeaturedWorkoutCardProps {
  title: string;
  subtitle: string;
  duration: string;
  calories: string;
  badgeLabel?: string;
  imageUrl?: string;
  onPress?: () => void;
}

export function FeaturedWorkoutCard({
  title,
  subtitle,
  duration,
  calories,
  badgeLabel = "TRENDING",
  imageUrl,
  onPress,
}: FeaturedWorkoutCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { opacity: pressed ? 0.95 : 1 },
      ]}
    >
      {/* Background image */}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.backgroundImage}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            styles.backgroundImage,
            styles.placeholderBackground,
            { backgroundColor: colors.primaryButton },
          ]}
        />
      )}

      {/* Gradient overlay */}
      <LinearGradient
        colors={["transparent", "rgba(0, 0, 0, 0.7)", "rgba(0, 0, 0, 0.9)"]}
        locations={[0, 0.6, 1]}
        style={styles.gradient}
      />

      {/* Badge */}
      <View style={[styles.badge, { backgroundColor: colors.primaryButton }]}>
        <Text style={styles.badgeText}>{badgeLabel}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Footer metrics */}
        <View style={styles.footer}>
          <View style={styles.metric}>
            <Ionicons name="time-outline" size={16} color="rgba(255, 255, 255, 0.8)" />
            <Text style={styles.metricText}>{duration}</Text>
          </View>
          <View style={styles.metric}>
            <Ionicons name="flame-outline" size={16} color="rgba(255, 255, 255, 0.8)" />
            <Text style={styles.metricText}>{calories}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholderBackground: {
    opacity: 0.8,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  badge: {
    position: "absolute",
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    letterSpacing: 0.5,
  },
  content: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    marginBottom: 4,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 14,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    gap: 16,
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 13,
    fontWeight: "500",
    fontFamily: Fonts.sans,
  },
});

