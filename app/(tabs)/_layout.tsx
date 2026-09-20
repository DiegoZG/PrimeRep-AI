import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useActiveWorkout } from "@/utils/activeWorkoutContext";

import AntDesign from "@expo/vector-icons/AntDesign";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? "light"];
  const { activeWorkout } = useActiveWorkout();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: themeColors.tabIconSelected,
        tabBarInactiveTintColor: themeColors.tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <View testID="tab-home" style={{ position: "relative" }}>
              <Ionicons name="barbell-sharp" size={size || 24} color={color} />
              {activeWorkout ? (
                <View
                  accessibilityLabel="Workout in progress"
                  style={{ position: "absolute", top: -1, right: -5, width: 7, height: 7, borderRadius: 4, backgroundColor: themeColors.primaryButton, borderWidth: 1, borderColor: themeColors.background }}
                />
              ) : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: "Coach",
          tabBarActiveTintColor: colorScheme === "dark" ? "#5CC8F5" : "#06628F",
          tabBarIcon: ({ color, size }) => (
            <View testID="tab-coach">
              <Ionicons name="stats-chart" size={size || 24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size }) => (
            <View testID="tab-explore">
              <AntDesign name="bars" size={size || 24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <View testID="tab-profile">
              <Ionicons name="person" size={size || 24} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
