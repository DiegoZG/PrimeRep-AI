import { router, useLocalSearchParams } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
} from "@/features/onboarding/constants";

export default function CalculatorModal() {
  const params = useLocalSearchParams<{ exercise?: string }>();
  const { data, updateField } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [reps, setReps] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [calculated1RM, setCalculated1RM] = useState<number | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(
    params.exercise || null
  );
  const weightUnit = data.weightUnit ?? "LB";

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
    Keyboard.dismiss();
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
  const hasResult = calculated1RM !== null;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.backdrop}>
          <TouchableOpacity
            testID="calculator-dismiss"
            style={styles.backdropDismiss}
            activeOpacity={1}
            accessible={false}
            onPress={canGoBack ? () => router.back() : undefined}
          />
          <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
            <Animated.View
              accessibilityViewIsModal
              style={[
                styles.modal,
                {
                  backgroundColor: colors.inputBackground,
                },
                modalAnimatedStyle,
              ]}
            >
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                {/* Title */}
                <Text
                  accessibilityRole="header"
                  style={[styles.title, { color: colors.text }]}
                >
                  {ONE_REP_MAX_CALCULATOR_MODAL.title}
                </Text>

                {/* Description */}
                <Text style={[styles.description, { color: colors.icon }]}>
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
                      testID="calculator-reps-input"
                      accessibilityLabel="Reps"
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
                        testID="calculator-weight-input"
                        accessibilityLabel={`Weight in ${weightUnit.toLowerCase()}`}
                        style={[styles.input, styles.weightInput]}
                        placeholder={
                          ONE_REP_MAX_CALCULATOR_MODAL.inputs.weight.placeholder
                        }
                        value={weight}
                        onChangeText={setWeight}
                        keyboardType="numeric"
                      />
                      <Text
                        style={[styles.unitLabel, { color: colors.icon }]}
                      >
                        {weightUnit.toLowerCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Calculated Result */}
                {calculated1RM !== null && (
                  <View
                    testID="calculator-result"
                    accessible
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={`Estimated one-rep max: ${calculated1RM} ${weightUnit.toLowerCase()}`}
                    style={[
                      styles.resultContainer,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.inputBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.resultLabel, { color: colors.icon }]}
                    >
                      Estimated 1RM:
                    </Text>
                    <Text
                      testID="calculator-result-value"
                      style={[styles.resultValue, { color: colors.text }]}
                    >
                      {calculated1RM} {weightUnit.toLowerCase()}
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
                            testID={`calculator-exercise-${exercise.id}`}
                            accessibilityRole="button"
                            accessibilityLabel={exercise.name}
                            accessibilityState={{ selected: isSelected }}
                            onPress={() => setSelectedExercise(exercise.id)}
                            style={[
                              styles.exerciseButton,
                              {
                                backgroundColor: colors.inputBackground,
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
                                  color: colors.text,
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
                  testID="calculator-calculate"
                  accessibilityRole="button"
                  accessibilityLabel="Calculate one-rep max"
                  onPress={handleCalculate}
                  disabled={!reps || !weight}
                  accessibilityState={{ disabled: !reps || !weight }}
                  style={[
                    styles.calculateButton,
                    {
                      backgroundColor: hasResult
                        ? colors.inputBackground
                        : colors.primaryButton,
                      borderColor: hasResult
                        ? colors.inputBorder
                        : colors.primaryButton,
                    },
                    (!reps || !weight) && { opacity: 0.5 },
                  ]}
                >
                  <Text
                    style={[
                      styles.calculateButtonText,
                      { color: hasResult ? colors.text : "#FFFFFF" },
                    ]}
                  >
                    Calculate
                  </Text>
                </AnimatedButton>

                {/* Apply Button (only show if calculated and exercise selected) */}
                {calculated1RM !== null && selectedExercise && (
                  <AnimatedButton
                    testID="calculator-apply"
                    accessibilityRole="button"
                    onPress={handleApply}
                    style={[
                      styles.applyButton,
                      { backgroundColor: colors.primaryButton },
                    ]}
                  >
                    <Text style={styles.applyButtonText}>
                      Apply {calculated1RM} {weightUnit.toLowerCase()} to{" "}
                      {
                        ONE_REP_MAX_SCREEN.exercises.find(
                          (e) => e.id === selectedExercise
                        )?.name
                      }
                    </Text>
                  </AnimatedButton>
                )}
                {canGoBack && (
                  <TouchableOpacity
                    testID="calculator-cancel"
                    accessibilityRole="button"
                    accessibilityLabel="Cancel calculator"
                    style={styles.cancelButton}
                    onPress={() => router.back()}
                  >
                    <Text
                      style={[styles.cancelButtonText, { color: colors.text }]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </KeyboardAvoidingView>
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
  backdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    maxHeight: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flexShrink: 1,
  },
  modalContent: {
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
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
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  input: {
    minHeight: 44,
  },
  weightInput: {
    flex: 1,
    minWidth: 0,
  },
  weightInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unitLabel: {
    fontSize: 14,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    minWidth: 30,
  },
  resultContainer: {
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
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
    minHeight: 48,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calculateButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    textAlign: "center",
  },
  applyButton: {
    minHeight: 48,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    textAlign: "center",
  },
  cancelButton: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: Fonts.sans,
    textAlign: "center",
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
    minHeight: 44,
    maxWidth: "100%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
  },
  exerciseButtonText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: Fonts.sans,
  },
});
