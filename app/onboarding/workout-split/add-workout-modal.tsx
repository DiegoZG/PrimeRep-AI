import { router } from "expo-router";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { AnimatedCheckmark } from "@/components/animated-checkmark";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ADD_WORKOUT_MODAL } from "../constants";

export default function AddWorkoutModal() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [activeTab, setActiveTab] = useState<string>("workout-split");
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(
    new Set()
  );
  const [coreEnabled, setCoreEnabled] = useState<boolean>(false);

  // Modal animation
  const modalOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(50);

  React.useEffect(() => {
    modalOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    modalTranslateY.value = withDelay(100, withTiming(0, { duration: 300 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modalAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: modalOpacity.value,
      transform: [{ translateY: modalTranslateY.value }],
    };
  });

  const handleToggleOption = (optionId: string) => {
    setSelectedOptions((prev) => {
      // If clicking the same option, deselect it
      if (prev.has(optionId)) {
        return new Set();
      }
      // Otherwise, select only this option (deselect all others)
      return new Set([optionId]);
    });
  };

  const handleAdd = () => {
    // TODO: Save selected workouts
    router.back();
  };

  const canGoBack = router.canGoBack();

  return (
    <ThemedView style={styles.container}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={canGoBack ? () => router.back() : undefined}
      >
        <TouchableWithoutFeedback>
          <Animated.View
            style={[
              styles.modalContainer,
              {
                backgroundColor: colors.inputBackground,
              },
              modalAnimatedStyle,
            ]}
          >
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                  {ADD_WORKOUT_MODAL.title}
                </Text>
                <TouchableOpacity onPress={handleAdd}>
                  <Text
                    style={[
                      styles.addButton,
                      {
                        color: colors.primaryButton,
                        opacity:
                          selectedOptions.size > 0 || coreEnabled ? 1 : 0.5,
                      },
                    ]}
                  >
                    Add
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Description */}
              <Text style={[styles.description, { color: colors.placeholder }]}>
                {ADD_WORKOUT_MODAL.description}
              </Text>

              {/* Tabs */}
              <View style={styles.tabContainer}>
                {ADD_WORKOUT_MODAL.tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      onPress={() => setActiveTab(tab.id)}
                      style={[
                        styles.tab,
                        {
                          backgroundColor: isActive
                            ? colors.inputBackground
                            : colors.inputBorder,
                          borderColor: isActive
                            ? colors.primaryButton
                            : colors.inputBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          {
                            color: isActive
                              ? colors.primaryButton
                              : colors.placeholder,
                          },
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Options List */}
              <ScrollView
                style={styles.optionsList}
                contentContainerStyle={styles.optionsListContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {activeTab === "workout-split" &&
                  ADD_WORKOUT_MODAL.workoutSplitOptions.map((option) => {
                    const isSelected = selectedOptions.has(option.id);
                    const isCore = option.id === "core";

                    return (
                      <TouchableOpacity
                        key={option.id}
                        onPress={() =>
                          isCore ? null : handleToggleOption(option.id)
                        }
                        style={styles.optionRow}
                        activeOpacity={isCore ? 1 : 0.7}
                      >
                        <View style={styles.optionContent}>
                          <Text
                            style={[styles.optionTitle, { color: colors.text }]}
                          >
                            {option.title}
                          </Text>
                          <Text
                            style={[
                              styles.optionDescription,
                              { color: colors.placeholder },
                            ]}
                          >
                            {option.description}
                          </Text>
                        </View>
                        {isCore ? (
                          <Switch
                            value={coreEnabled}
                            onValueChange={setCoreEnabled}
                            trackColor={{
                              false: colors.inputBorder,
                              true: colors.primaryButton,
                            }}
                            thumbColor="#FFFFFF"
                          />
                        ) : (
                          <View
                            style={[
                              styles.checkbox,
                              {
                                backgroundColor: isSelected
                                  ? colors.primaryButton
                                  : "transparent",
                                borderColor: isSelected
                                  ? colors.primaryButton
                                  : colors.inputBorder,
                              },
                            ]}
                          >
                            <AnimatedCheckmark visible={isSelected}>
                              <Text style={styles.checkmarkText}>✓</Text>
                            </AnimatedCheckmark>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                {activeTab === "custom" && (
                  <View style={styles.customTabPlaceholder}>
                    <Text
                      style={[
                        styles.placeholderText,
                        { color: colors.placeholder },
                      ]}
                    >
                      Custom workout creation coming soon
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </Animated.View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    height: "100%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  modalContent: {
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  addButton: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  description: {
    fontSize: 14,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    lineHeight: 20,
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  optionsList: {
    flex: 1,
    marginTop: 8,
  },
  optionsListContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  optionContent: {
    flex: 1,
    marginRight: 16,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    lineHeight: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  customTabPlaceholder: {
    paddingVertical: 40,
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
});
