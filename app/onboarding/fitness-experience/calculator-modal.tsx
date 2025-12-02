import { router, useLocalSearchParams } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
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

import { AnimatedButton } from "@/components/animated-button";
import { AnimatedInput } from "@/components/animated-input";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { OnboardingContext } from "@/utils/onboardingContext";
import {
  ONE_REP_MAX_CALCULATOR_MODAL,
  ONE_REP_MAX_SCREEN,
  calculateOneRepMax,
} from "../constants";

export default function CalculatorModal() {
  const params = useLocalSearchParams<{ exercise?: string }>();
  const { updateField } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [reps, setReps] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [calculated1RM, setCalculated1RM] = useState<number | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(
    params.exercise || null
  );

  // Animation shared values
  const modalOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(50);

  useEffect(() => {
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

  const handleCalculate = () => {
    const repsNum = parseInt(reps, 10);
    const weightNum = parseFloat(weight);

    if (repsNum >= 1 && repsNum <= 30 && weightNum > 0) {
      const oneRM = calculateOneRepMax(weightNum, repsNum);
      setCalculated1RM(oneRM);
    } else {
      setCalculated1RM(null);
    }
  };

  const handleApply = () => {
    if (calculated1RM && selectedExercise) {
      if (selectedExercise === "bench-press") {
        updateField("benchPress1RM", calculated1RM);
      } else if (selectedExercise === "back-squat") {
        updateField("backSquat1RM", calculated1RM);
      } else if (selectedExercise === "deadlift") {
        updateField("deadlift1RM", calculated1RM);
      }
      router.back();
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const canGoBack = router.canGoBack();

  return (
    <ThemedView style={styles.container}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={canGoBack ? () => router.back() : undefined}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <Animated.View
            style={[
              styles.modal,
              {
                backgroundColor: colors.inputBackground,
              },
              modalAnimatedStyle,
            ]}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.keyboardAvoidingView}
            >
              {/* Title */}
              <Text style={[styles.title, { color: colors.text }]}>
                {ONE_REP_MAX_CALCULATOR_MODAL.title}
              </Text>

              {/* Description */}
              <Text style={[styles.description, { color: colors.placeholder }]}>
                {ONE_REP_MAX_CALCULATOR_MODAL.description}
              </Text>

              {/* Input Fields */}
              <View style={styles.inputsContainer}>
                {/* Reps Input */}
                <View style={styles.inputRow}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>
                    {ONE_REP_MAX_CALCULATOR_MODAL.inputs.reps.label}
                  </Text>
                  <AnimatedInput
                    style={styles.input}
                    placeholder={
                      ONE_REP_MAX_CALCULATOR_MODAL.inputs.reps.placeholder
                    }
                    value={reps}
                    onChangeText={setReps}
                    keyboardType="numeric"
                  />
                </View>

                {/* Weight Input */}
                <View style={styles.inputRow}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>
                    {ONE_REP_MAX_CALCULATOR_MODAL.inputs.weight.label}
                  </Text>
                  <View style={styles.weightInputContainer}>
                    <AnimatedInput
                      style={styles.input}
                      placeholder={
                        ONE_REP_MAX_CALCULATOR_MODAL.inputs.weight.placeholder
                      }
                      value={weight}
                      onChangeText={setWeight}
                      keyboardType="numeric"
                    />
                    <Text
                      style={[styles.unitLabel, { color: colors.placeholder }]}
                    >
                      {ONE_REP_MAX_CALCULATOR_MODAL.inputs.weight.unit}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Calculated Result */}
              {calculated1RM !== null && (
                <View style={styles.resultContainer}>
                  <Text
                    style={[styles.resultLabel, { color: colors.placeholder }]}
                  >
                    Estimated 1RM:
                  </Text>
                  <Text
                    style={[styles.resultValue, { color: colors.electricBlue }]}
                  >
                    {calculated1RM} lb
                  </Text>
                </View>
              )}

              {/* Exercise Selection (only show if calculated) */}
              {calculated1RM !== null && (
                <View style={styles.exerciseSelectionContainer}>
                  <Text
                    style={[
                      styles.exerciseSelectionLabel,
                      { color: colors.text },
                    ]}
                  >
                    Apply to:
                  </Text>
                  <View style={styles.exerciseButtonsContainer}>
                    {ONE_REP_MAX_SCREEN.exercises.map((exercise) => {
                      const isSelected = selectedExercise === exercise.id;
                      return (
                        <TouchableOpacity
                          key={exercise.id}
                          onPress={() => setSelectedExercise(exercise.id)}
                          style={[
                            styles.exerciseButton,
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
                        >
                          <Text
                            style={[
                              styles.exerciseButtonText,
                              {
                                color: isSelected
                                  ? colors.primaryButton
                                  : colors.text,
                                fontWeight: isSelected ? "600" : "500",
                              },
                            ]}
                          >
                            {exercise.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Calculate Button */}
              <AnimatedButton
                onPress={handleCalculate}
                disabled={!reps || !weight}
              >
                <View
                  style={[
                    styles.calculateButton,
                    { backgroundColor: colors.primaryButton },
                    (!reps || !weight) && { opacity: 0.5 },
                  ]}
                >
                  <Text style={styles.calculateButtonText}>
                    {ONE_REP_MAX_CALCULATOR_MODAL.calculateButton}
                  </Text>
                </View>
              </AnimatedButton>

              {/* Apply Button (only show if calculated and exercise selected) */}
              {calculated1RM !== null && selectedExercise && (
                <AnimatedButton onPress={handleApply}>
                  <View
                    style={[
                      styles.applyButton,
                      {
                        backgroundColor: colors.electricBlue,
                        marginTop: 12,
                      },
                    ]}
                  >
                    <Text style={styles.applyButtonText}>
                      Apply {calculated1RM} lb to{" "}
                      {
                        ONE_REP_MAX_SCREEN.exercises.find(
                          (e) => e.id === selectedExercise
                        )?.name
                      }
                    </Text>
                  </View>
                </AnimatedButton>
              )}
            </KeyboardAvoidingView>
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
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  keyboardAvoidingView: {
    width: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    lineHeight: 22,
    marginBottom: 24,
  },
  inputsContainer: {
    gap: 20,
    marginBottom: 24,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    minWidth: 80,
  },
  input: {
    flex: 1,
  },
  weightInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  unitLabel: {
    fontSize: 14,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    minWidth: 30,
  },
  resultContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(0, 212, 255, 0.1)",
    marginBottom: 24,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  resultValue: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  calculateButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  calculateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    textTransform: "uppercase",
  },
  applyButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  exerciseSelectionContainer: {
    marginBottom: 24,
  },
  exerciseSelectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    marginBottom: 12,
  },
  exerciseButtonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  exerciseButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  exerciseButtonText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: Fonts.sans,
  },
});

