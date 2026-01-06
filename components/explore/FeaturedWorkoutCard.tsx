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
  compact?: boolean;
  onPress?: () => void;
}

export function FeaturedWorkoutCard({
  title,
  subtitle,
  duration,
  calories,
  badgeLabel = "TRENDING",
  imageUrl,
  compact = false,
  onPress,
}: FeaturedWorkoutCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  if (compact) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.compactContainer,
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
          <LinearGradient
            colors={["#6a4ff5", "#4338ca"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backgroundImage}
          />
        )}

        {/* Gradient overlay */}
        <LinearGradient
          colors={["rgba(0, 0, 0, 0.1)", "rgba(0, 0, 0, 0.6)"]}
          style={styles.gradient}
        />

        {/* Badge */}
        <View
          style={[
            styles.compactBadge,
            { backgroundColor: colors.primaryButton },
          ]}
        >
          <Text style={styles.compactBadgeText}>{badgeLabel}</Text>
        </View>

        {/* Content */}
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.compactMetrics}>
            <Ionicons
              name="time-outline"
              size={12}
              color="rgba(255, 255, 255, 0.85)"
            />
            <Text style={styles.compactMetricText}>{duration}</Text>
          </View>
        </View>
      </Pressable>
    );
  }

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
            <Ionicons
              name="time-outline"
              size={16}
              color="rgba(255, 255, 255, 0.8)"
            />
            <Text style={styles.metricText}>{duration}</Text>
          </View>
          <View style={styles.metric}>
            <Ionicons
              name="flame-outline"
              size={16}
              color="rgba(255, 255, 255, 0.8)"
            />
            <Text style={styles.metricText}>{calories}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Full-size card styles
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
  // Compact card styles
  compactContainer: {
    flex: 1,
    height: 130,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#6a4ff5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  compactBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  compactBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    letterSpacing: 0.5,
  },
  compactContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  compactTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    marginBottom: 6,
  },
  compactMetrics: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  compactMetricText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    fontWeight: "500",
    fontFamily: Fonts.sans,
  },
});
