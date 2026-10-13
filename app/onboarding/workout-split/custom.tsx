import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useContext, useEffect } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import { ADD_WORKOUT_MODAL, CUSTOM_SPLIT_SCREEN } from "@/features/onboarding/constants";

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
    <ThemedView testID="custom-split-screen" style={styles.container}>
      <Animated.View style={[styles.animatedContainer, screenAnimatedStyle]}>
        <ScrollView
          testID="custom-split-scroll"
          style={styles.scroll}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Question */}
            <Animated.View style={questionAnimatedStyle}>
              <AnimatedText
                testID="custom-split-heading"
                style={[styles.question, { color: colors.text }]}
              >
                {CUSTOM_SPLIT_SCREEN.question}
              </AnimatedText>
            </Animated.View>

            {/* Description */}
            <Animated.View style={descriptionAnimatedStyle}>
              <Text
                testID="custom-split-description"
                style={[styles.description, { color: colors.icon }]}
              >
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
                        testID={`custom-split-title-${workout.id}`}
                        selectable
                        style={[
                          styles.workoutCardTitle,
                          { color: colors.text },
                        ]}
                      >
                        {workout.name} - Workout {index + 1}
                      </Text>
                      <Pressable
                        testID={`custom-split-remove-${workout.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${workout.name}, workout ${index + 1}`}
                        onPress={() => handleRemoveWorkout(workout.id)}
                        style={({ pressed }) => [
                          styles.deleteButton,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={colors.icon}
                        />
                      </Pressable>
                    </View>

                    {/* Card Content - Clickable */}
                    <Pressable
                      testID={`custom-split-edit-${workout.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${workout.name}, workout ${index + 1}`}
                      onPress={() => handleEditWorkout(workout.id)}
                      style={({ pressed }) => [
                        styles.editButton,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      {/* Muscle Groups List */}
                      <Text
                        testID={`custom-split-muscles-${workout.id}`}
                        selectable
                        style={[
                          styles.muscleGroupsList,
                          { color: colors.icon },
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
                      <Text style={[styles.editButtonText, { color: colors.text }]}>
                        Edit workout
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Add Workout Button */}
            <Animated.View style={buttonAnimatedStyle}>
              <AnimatedButton
                testID="custom-split-add"
                accessibilityRole="button"
                accessibilityLabel="Add workout"
                onPress={handleAddWorkout}
                style={[
                  styles.addButton,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                  },
                ]}
              >
                <Ionicons name="add" size={20} color={colors.text} />
                <Text style={[styles.addButtonText, { color: colors.text }]}>
                  Add workout
                </Text>
              </AnimatedButton>
            </Animated.View>
          </View>

          {/* Continue Button */}
          <View testID="custom-split-footer" style={styles.buttonContainer}>
            {!data.customWorkouts?.length && (
              <Text
                testID="custom-split-validation"
                accessibilityLiveRegion="polite"
                style={[
                  styles.validationMessage,
                  { color: colorScheme === "dark" ? "#FF8B82" : "#B42318" },
                ]}
              >
                Add at least one workout day to continue.
              </Text>
            )}
            <AnimatedButton
              testID="custom-split-continue"
              accessibilityRole="button"
              accessibilityLabel="Continue"
              onPress={handleContinue}
              disabled={!data.customWorkouts?.length}
              accessibilityState={{ disabled: !data.customWorkouts?.length }}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: data.customWorkouts?.length
                    ? colors.primaryButton
                    : colors.inputBackground,
                  borderColor: data.customWorkouts?.length
                    ? colors.primaryButton
                    : colors.inputBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: data.customWorkouts?.length ? "#FFFFFF" : colors.icon },
                ]}
              >
                Continue
              </Text>
            </AnimatedButton>
          </View>
        </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 24,
  },
  content: {
    gap: 16,
  },
  workoutsList: {
    gap: 16,
  },
  workoutCard: {
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  workoutCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  workoutCardTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  deleteButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: {
    minHeight: 44,
    gap: 12,
    paddingVertical: 4,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  muscleGroupsList: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: Fonts.sans,
  },
  question: {
    fontSize: 26,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  description: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: Fonts.sans,
  },
  addButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    flexShrink: 1,
  },
  buttonContainer: {
    marginTop: "auto",
    gap: 12,
  },
  primaryButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    minHeight: 56,
    flexShrink: 0,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  validationMessage: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    alignSelf: "stretch",
    textAlign: "center",
  },
});
