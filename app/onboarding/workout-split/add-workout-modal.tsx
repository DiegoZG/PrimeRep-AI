import { OnboardingContext } from "@/utils/onboardingContext";
import { router, useLocalSearchParams } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
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
import {
  buildMuscleGroupsFromSplitSelection,
  inferSplitSelectionFromMuscleGroups,
} from "./helpers";

export default function AddWorkoutModal() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { data, updateField } = useContext(OnboardingContext);
  const params = useLocalSearchParams<{
    workoutId?: string;
    workoutName?: string;
    workoutType?: string;
    muscleGroups?: string;
  }>();

  const isEditing = !!params.workoutId;
  const editingWorkout = isEditing
    ? data.customWorkouts?.find((w) => w.id === params.workoutId)
    : null;

  const [activeTab, setActiveTab] = useState<string>("workout-split");
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(
    new Set()
  );
  const [coreEnabled, setCoreEnabled] = useState<boolean>(false);
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<Set<string>>(
    new Set()
  );

  // Pre-fill selections when editing
  useEffect(() => {
    if (editingWorkout) {
      // Set the active tab based on workout type
      setActiveTab(
        editingWorkout.type === "custom" ? "custom" : "workout-split"
      );

      if (editingWorkout.type === "workout-split") {
        // Use helper to infer which split option and Core state from muscle groups
        const { splitId, coreEnabled: hasCore } =
          inferSplitSelectionFromMuscleGroups(editingWorkout.muscleGroups);

        if (splitId) {
          setSelectedOptions(new Set([splitId]));
        }

        setCoreEnabled(hasCore);
      } else {
        // Custom workout - pre-select muscle groups
        setSelectedMuscleGroups(new Set(editingWorkout.muscleGroups));
      }
    }
  }, [editingWorkout]);

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

  const handleToggleMuscleGroup = (muscleGroupId: string) => {
    setSelectedMuscleGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(muscleGroupId)) {
        newSet.delete(muscleGroupId);
      } else {
        newSet.add(muscleGroupId);
      }
      return newSet;
    });
  };

  const handleAdd = () => {
    const currentWorkouts = data.customWorkouts || [];
    let updatedWorkout;

    if (activeTab === "workout-split") {
      // Get the selected workout split option
      const selectedOption = ADD_WORKOUT_MODAL.workoutSplitOptions.find((opt) =>
        selectedOptions.has(opt.id)
      );
      if (selectedOption) {
        // Use helper to build muscle groups from split selection and Core toggle
        const muscleGroups = buildMuscleGroupsFromSplitSelection(
          selectedOption.id,
          coreEnabled
        );

        updatedWorkout = {
          id:
            isEditing && editingWorkout
              ? editingWorkout.id
              : `workout-${Date.now()}`,
          name: selectedOption.title,
          type: "workout-split" as const,
          muscleGroups,
        };
      }
    } else {
      // Custom tab - use selected muscle groups
      if (selectedMuscleGroups.size > 0) {
        updatedWorkout = {
          id:
            isEditing && editingWorkout
              ? editingWorkout.id
              : `workout-${Date.now()}`,
          name: "Custom",
          type: "custom" as const,
          muscleGroups: Array.from(selectedMuscleGroups),
        };
      }
    }

    if (updatedWorkout) {
      if (isEditing && editingWorkout) {
        // Update existing workout
        const updatedWorkouts = currentWorkouts.map((w) =>
          w.id === editingWorkout.id ? updatedWorkout : w
        );
        updateField("customWorkouts", updatedWorkouts);
      } else {
        // Add new workout
        updateField("customWorkouts", [...currentWorkouts, updatedWorkout]);
      }
    }

    router.back();
  };

  const hasSelections =
    (activeTab === "workout-split" &&
      (selectedOptions.size > 0 || coreEnabled)) ||
    (activeTab === "custom" && selectedMuscleGroups.size > 0);

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
                        opacity: hasSelections ? 1 : 0.5,
                      },
                    ]}
                  >
                    {isEditing ? "Update" : "Add"}
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
                  <View style={styles.muscleGroupGrid}>
                    {ADD_WORKOUT_MODAL.customMuscleGroups.map((muscleGroup) => {
                      const isSelected = selectedMuscleGroups.has(
                        muscleGroup.id
                      );
                      return (
                        <TouchableOpacity
                          key={muscleGroup.id}
                          onPress={() =>
                            handleToggleMuscleGroup(muscleGroup.id)
                          }
                          style={[
                            styles.muscleGroupCard,
                            {
                              backgroundColor: isSelected
                                ? "rgba(106, 79, 245, 0.12)"
                                : colors.inputBackground,
                              borderColor: isSelected
                                ? colors.primaryButton
                                : colors.inputBorder,
                              borderWidth: isSelected ? 2 : 1,
                            },
                          ]}
                          activeOpacity={0.7}
                        >
                          {/* Placeholder for muscle icon */}
                          <View
                            style={[
                              styles.muscleIconPlaceholder,
                              {
                                backgroundColor: colors.inputBorder,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.placeholderText,
                                { color: colors.placeholder },
                              ]}
                            >
                              Image coming soon
                            </Text>
                          </View>
                          {/* Muscle group name */}
                          <Text
                            style={[
                              styles.muscleGroupName,
                              { color: colors.text },
                            ]}
                          >
                            {muscleGroup.name}
                          </Text>
                          {/* Checkbox indicator */}
                          {isSelected && (
                            <View
                              style={[
                                styles.cardCheckbox,
                                {
                                  backgroundColor: colors.primaryButton,
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
  muscleGroupGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingBottom: 20,
  },
  muscleGroupCard: {
    width: "22%",
    aspectRatio: 0.85,
    borderRadius: 12,
    padding: 8,
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    borderWidth: 1,
  },
  muscleIconPlaceholder: {
    width: "100%",
    flex: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    minHeight: 60,
  },
  placeholderText: {
    fontSize: 10,
    fontFamily: Fonts.sans,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  muscleGroupName: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    textAlign: "center",
  },
  cardCheckbox: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
