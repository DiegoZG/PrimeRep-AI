import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Fonts } from "@/constants/theme";

interface FavoritesCardProps {
  count: number;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FavoritesCard({ count, onPress }: FavoritesCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <AnimatedPressable
      testID="explore-favorites"
      accessibilityRole="button"
      accessibilityLabel={`Open favorites, ${count} ${count === 1 ? "exercise" : "exercises"}`}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.container, animatedStyle]}
    >
      <LinearGradient
        colors={["#FF6B8A", "#FF4B6E", "#E8364F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Decorative circles */}
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
        <View style={styles.decorativeCircle3} />
        
        {/* Main content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="heart" size={28} color="#FFFFFF" />
          </View>
          
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>Favorites</Text>
            <Text style={styles.count} numberOfLines={1}>
              {count} {count === 1 ? "exercise" : "exercises"}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 130,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#FF4B6E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  gradient: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  decorativeCircle1: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.1)",
    top: -35,
    right: -25,
  },
  decorativeCircle2: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.08)",
    bottom: -20,
    left: 25,
  },
  decorativeCircle3: {
    position: "absolute",
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: 25,
    right: 70,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  count: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: Fonts.sans,
    color: "rgba(255,255,255,0.85)",
  },
});
