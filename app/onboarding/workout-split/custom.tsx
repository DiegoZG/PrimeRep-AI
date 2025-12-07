import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useContext, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { AnimatedButton } from "@/components/animated-button";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import { OnboardingContext } from "@/utils/onboardingContext";
import { ADD_WORKOUT_MODAL, CUSTOM_SPLIT_SCREEN } from "../constants";

const AnimatedText = Animated.createAnimatedComponent(Text);

export default function CustomSplitScreen() {
  const router = useRouter();
  const { data, updateField } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();

  // Question animation
  const questionOpacity = useSharedValue(0);
  const questionTranslateY = useSharedValue(20);
  const descriptionOpacity = useSharedValue(0);
  const descriptionTranslateY = useSharedValue(20);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(20);

  useEffect(() => {
    // Question animation - starts after 200ms delay
    questionOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    questionTranslateY.value = withDelay(200, withTiming(0, { duration: 400 }));

    // Description animation - starts after 400ms delay
    descriptionOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    descriptionTranslateY.value = withDelay(
      400,
      withTiming(0, { duration: 400 })
    );

    // Button animation - starts after 600ms delay
    buttonOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    buttonTranslateY.value = withDelay(600, withTiming(0, { duration: 400 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screenAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateX: translateX.value }],
    };
  });

  const questionAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: questionOpacity.value,
      transform: [{ translateY: questionTranslateY.value }],
    };
  });

  const descriptionAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: descriptionOpacity.value,
      transform: [{ translateY: descriptionTranslateY.value }],
    };
  });

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: buttonOpacity.value,
      transform: [{ translateY: buttonTranslateY.value }],
    };
  });

  const handleAddWorkout = () => {
    router.push("/onboarding/workout-split/add-workout-modal");
  };

  const handleEditWorkout = (workoutId: string) => {
    const workout = data.customWorkouts?.find((w) => w.id === workoutId);
    if (workout) {
      router.push({
        pathname: "/onboarding/workout-split/add-workout-modal",
        params: {
          workoutId: workout.id,
          workoutName: workout.name,
          workoutType: workout.type,
          muscleGroups: workout.muscleGroups.join(","),
        },
      });
    }
  };

  const handleRemoveWorkout = (workoutId: string) => {
    const currentWorkouts = data.customWorkouts || [];
    const updatedWorkouts = currentWorkouts.filter((w) => w.id !== workoutId);
    updateField("customWorkouts", updatedWorkouts);
  };

  const handleContinue = () => {
    // Save custom split selection
    updateField("workoutSplit", "custom");
    router.push("/onboarding/variety-level");
  };

  return (
    <ThemedView style={styles.container}>
      <Animated.View style={[styles.animatedContainer, screenAnimatedStyle]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Question */}
            <Animated.View style={questionAnimatedStyle}>
              <AnimatedText style={[styles.question, { color: colors.text }]}>
                {CUSTOM_SPLIT_SCREEN.question}
              </AnimatedText>
            </Animated.View>

            {/* Description */}
            <Animated.View style={descriptionAnimatedStyle}>
              <Text style={[styles.description, { color: colors.placeholder }]}>
                {CUSTOM_SPLIT_SCREEN.description}
              </Text>
            </Animated.View>

            {/* Workout Cards */}
            {data.customWorkouts && data.customWorkouts.length > 0 && (
              <View style={styles.workoutsList}>
                {data.customWorkouts.map((workout, index) => (
                  <View
                    key={workout.id}
                    style={[
                      styles.workoutCard,
                      {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.inputBorder,
                      },
                    ]}
                  >
                    {/* Header */}
                    <View style={styles.workoutCardHeader}>
                      <Text
                        style={[
                          styles.workoutCardTitle,
                          { color: colors.text },
                        ]}
                      >
                        {workout.name} - Workout {index + 1}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveWorkout(workout.id)}
                        activeOpacity={0.7}
                        style={styles.deleteButton}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={colors.placeholder}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Card Content - Clickable */}
                    <TouchableOpacity
                      onPress={() => handleEditWorkout(workout.id)}
                      activeOpacity={0.7}
                    >
                      {/* Muscle Icons Row */}
                      <View style={styles.muscleIconsRow}>
                        {workout.muscleGroups.slice(0, 6).map((muscleId) => {
                          const muscleGroup =
                            ADD_WORKOUT_MODAL.customMuscleGroups.find(
                              (mg) => mg.id === muscleId
                            );
                          return (
                            <View
                              key={muscleId}
                              style={[
                                styles.muscleIconSmall,
                                {
                                  backgroundColor: colors.inputBorder,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.muscleIconPlaceholderSmall,
                                  { color: colors.placeholder },
                                ]}
                              >
                                {muscleGroup?.name.charAt(0) || "?"}
                              </Text>
                            </View>
                          );
                        })}
                      </View>

                      {/* Muscle Groups List */}
                      <Text
                        style={[
                          styles.muscleGroupsList,
                          { color: colors.placeholder },
                        ]}
                      >
                        {workout.muscleGroups
                          .map((muscleId) => {
                            const muscleGroup =
                              ADD_WORKOUT_MODAL.customMuscleGroups.find(
                                (mg) => mg.id === muscleId
                              );
                            return muscleGroup?.name || muscleId;
                          })
                          .join(", ")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Add Workout Button */}
            <Animated.View style={buttonAnimatedStyle}>
              <AnimatedButton onPress={handleAddWorkout}>
                <View
                  style={[
                    styles.addButton,
                    { backgroundColor: colors.primaryButton },
                  ]}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>ADD WORKOUT</Text>
                </View>
              </AnimatedButton>
            </Animated.View>
          </View>
        </ScrollView>

        {/* Continue Button */}
        <View
          style={[
            styles.buttonContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <AnimatedButton onPress={handleContinue}>
            <View
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primaryButton },
              ]}
            >
              <Text style={styles.primaryButtonText}>CONTINUE</Text>
            </View>
          </AnimatedButton>
        </View>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  animatedContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 16,
  },
  workoutsList: {
    gap: 16,
    marginTop: 8,
  },
  workoutCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  workoutCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  workoutCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  deleteButton: {
    padding: 4,
  },
  muscleIconsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  muscleIconSmall: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  muscleIconPlaceholderSmall: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  muscleGroupsList: {
    fontSize: 14,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    lineHeight: 20,
  },
  question: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    lineHeight: 36,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    lineHeight: 22,
    marginBottom: 24,
  },
  addButton: {
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    textTransform: "uppercase",
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    textTransform: "uppercase",
  },
});
