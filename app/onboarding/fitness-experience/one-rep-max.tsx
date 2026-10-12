import Entypo from "@expo/vector-icons/Entypo";
import { useRouter } from "expo-router";
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
import { useScreenTransition } from "@/hooks/use-screen-transition";
import type { WeightUnit } from "@/interfaces/onboarding/types";
import { OnboardingContext } from "@/utils/onboardingContext";
import { convertWeight } from "@/utils/weightConversion";
import { ONE_REP_MAX_SCREEN } from "@/features/onboarding/constants";

const AnimatedText = Animated.createAnimatedComponent(Text);

export default function OneRepMaxScreen() {
  const router = useRouter();
  const { data, updateField } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();

  // Sync state with context data
  const [benchPress, setBenchPress] = useState<string>(
    data.benchPress1RM ? String(data.benchPress1RM) : ""
  );
  const [backSquat, setBackSquat] = useState<string>(
    data.backSquat1RM ? String(data.backSquat1RM) : ""
  );
  const [deadlift, setDeadlift] = useState<string>(
    data.deadlift1RM ? String(data.deadlift1RM) : ""
  );
  const weightUnit = data.weightUnit ?? "LB";

  // Update local state when context data changes (e.g., after modal applies value)
  useEffect(() => {
    setBenchPress(data.benchPress1RM ? String(data.benchPress1RM) : "");
    setBackSquat(data.backSquat1RM ? String(data.backSquat1RM) : "");
    setDeadlift(data.deadlift1RM ? String(data.deadlift1RM) : "");
  }, [data.benchPress1RM, data.backSquat1RM, data.deadlift1RM]);

  // Animation shared values
  const questionOpacity = useSharedValue(0);
  const questionTranslateY = useSharedValue(20);
  const descriptionOpacity = useSharedValue(0);
  const descriptionTranslateY = useSharedValue(20);
  const calculatorOpacity = useSharedValue(0);
  const calculatorTranslateY = useSharedValue(20);
  const inputsOpacity = useSharedValue(0);
  const inputsTranslateY = useSharedValue(20);

  useEffect(() => {
    // Question animation
    questionOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    questionTranslateY.value = withDelay(200, withTiming(0, { duration: 400 }));

    // Description animation
    descriptionOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    descriptionTranslateY.value = withDelay(
      400,
      withTiming(0, { duration: 400 })
    );

    // Calculator section animation
    calculatorOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    calculatorTranslateY.value = withDelay(
      600,
      withTiming(0, { duration: 400 })
    );

    // Inputs animation
    inputsOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));
    inputsTranslateY.value = withDelay(800, withTiming(0, { duration: 400 }));
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

  const calculatorAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: calculatorOpacity.value,
      transform: [{ translateY: calculatorTranslateY.value }],
    };
  });

  const inputsAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: inputsOpacity.value,
      transform: [{ translateY: inputsTranslateY.value }],
    };
  });

  const handleOpenCalculator = (exerciseId?: string) => {
    const url = exerciseId
      ? `/onboarding/fitness-experience/calculator-modal?exercise=${exerciseId}`
      : "/onboarding/fitness-experience/calculator-modal";
    router.push(url as any);
  };

  const convertInputWeight = (value: string, fromUnit: WeightUnit) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return value;
    return String(convertWeight(parsed, fromUnit, fromUnit === "LB" ? "KG" : "LB"));
  };

  const handleWeightUnitChange = (nextUnit: WeightUnit) => {
    if (nextUnit === weightUnit) return;

    const nextBenchPress = convertInputWeight(benchPress, weightUnit);
    const nextBackSquat = convertInputWeight(backSquat, weightUnit);
    const nextDeadlift = convertInputWeight(deadlift, weightUnit);

    setBenchPress(nextBenchPress);
    setBackSquat(nextBackSquat);
    setDeadlift(nextDeadlift);
    updateField("weightUnit", nextUnit);
    updateField(
      "weight",
      typeof data.weight === "number"
        ? convertWeight(data.weight, weightUnit, nextUnit)
        : data.weight
    );
    updateField("benchPress1RM", Number.parseFloat(nextBenchPress) || undefined);
    updateField("backSquat1RM", Number.parseFloat(nextBackSquat) || undefined);
    updateField("deadlift1RM", Number.parseFloat(nextDeadlift) || undefined);
  };

  const handleBenchPressChange = (value: string) => {
    setBenchPress(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 1500) {
      updateField("benchPress1RM", numValue);
    } else {
      updateField("benchPress1RM", undefined);
    }
  };

  const handleBackSquatChange = (value: string) => {
    setBackSquat(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 1500) {
      updateField("backSquat1RM", numValue);
    } else {
      updateField("backSquat1RM", undefined);
    }
  };

  const handleDeadliftChange = (value: string) => {
    setDeadlift(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 1500) {
      updateField("deadlift1RM", numValue);
    } else {
      updateField("deadlift1RM", undefined);
    }
  };

  const handleNext = () => {
    router.push("/onboarding/fitness-goal");
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <ThemedView style={styles.container}>
      <Animated.View style={[styles.animatedContainer, screenAnimatedStyle]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
            <View style={styles.keyboardAvoidingView}>
              <ScrollView
                testID="one-rep-max-scroll"
                style={styles.scroll}
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >
                <TouchableWithoutFeedback
                  testID="one-rep-max-dismiss"
                  accessible={false}
                  onPress={dismissKeyboard}
                >
                <View style={styles.content}>
                  {/* Question */}
                  <Animated.View style={questionAnimatedStyle}>
                    <AnimatedText
                      testID="one-rep-max-question"
                      accessibilityRole="header"
                      style={[styles.question, { color: colors.text }]}
                    >
                      {ONE_REP_MAX_SCREEN.question}
                    </AnimatedText>
                  </Animated.View>

                  {/* Description */}
                  <Animated.View style={descriptionAnimatedStyle}>
                    <Text
                      testID="one-rep-max-description"
                      style={[
                        styles.description,
                        { color: colors.icon },
                      ]}
                    >
                      {ONE_REP_MAX_SCREEN.description}
                    </Text>
                  </Animated.View>

                  {/* Calculator Section */}
                  <Animated.View style={calculatorAnimatedStyle}>
                    <View style={styles.calculatorSection}>
                      <Text
                        style={[
                          styles.calculatorHeading,
                          { color: colors.text },
                        ]}
                      >
                        {ONE_REP_MAX_SCREEN.calculatorSection.heading}
                      </Text>
                      <TouchableOpacity
                        testID="one-rep-max-calculator"
                        accessibilityRole="button"
                        accessibilityLabel="Open one-rep max calculator"
                        onPress={() => handleOpenCalculator()}
                        activeOpacity={0.7}
                        style={[
                          styles.calculatorButton,
                          {
                            backgroundColor: colors.inputBackground,
                            borderColor: colors.inputBorder,
                          },
                        ]}
                      >
                        <View
                          accessible={false}
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                        >
                          <Entypo name="calculator" size={20} color={colors.text} />
                        </View>
                      </TouchableOpacity>
                    </View>

                    <View
                      style={[
                        styles.unitControl,
                        {
                          backgroundColor: colors.inputBackground,
                          borderColor: colors.inputBorder,
                        },
                      ]}
                    >
                      {(["LB", "KG"] as const).map((unit) => {
                        const selected = weightUnit === unit;
                        return (
                          <TouchableOpacity
                            key={unit}
                            testID={`one-rep-max-unit-${unit}`}
                            accessibilityRole="button"
                            accessibilityLabel={`Use ${unit === "LB" ? "pounds" : "kilograms"} for body weight and one-rep maxes`}
                            accessibilityState={{ selected }}
                            onPress={() => handleWeightUnitChange(unit)}
                            style={[
                              styles.unitOption,
                              selected && { backgroundColor: colors.inputBorder },
                            ]}
                          >
                            <Text
                              style={[
                                styles.unitOptionText,
                                { color: colors.text },
                              ]}
                            >
                              {unit}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </Animated.View>

                  {/* Input Fields */}
                  <Animated.View style={inputsAnimatedStyle}>
                    <View style={styles.inputsContainer}>
                      {ONE_REP_MAX_SCREEN.exercises.map((exercise, index) => {
                        let value = "";
                        let onChange = (val: string) => {};

                        if (exercise.id === "bench-press") {
                          value = benchPress;
                          onChange = handleBenchPressChange;
                        } else if (exercise.id === "back-squat") {
                          value = backSquat;
                          onChange = handleBackSquatChange;
                        } else if (exercise.id === "deadlift") {
                          value = deadlift;
                          onChange = handleDeadliftChange;
                        }

                        return (
                          <View key={exercise.id}>
                            <View style={styles.inputRow}>
                              <Text
                                testID={`one-rep-max-label-${exercise.id}`}
                                style={[
                                  styles.exerciseLabel,
                                  { color: colors.text },
                                ]}
                              >
                                {exercise.name}
                              </Text>
                              <View style={styles.inputContainer}>
                                <AnimatedInput
                                  testID={`one-rep-max-input-${exercise.id}`}
                                  accessibilityLabel={`${exercise.name} one-rep max, ${weightUnit === "LB" ? "pounds" : "kilograms"}`}
                                  authPresentation
                                  style={styles.weightInput}
                                  placeholder="-"
                                  value={value}
                                  onChangeText={onChange}
                                  keyboardType="numeric"
                                />
                                <Text
                                  testID={`one-rep-max-unit-${exercise.id}`}
                                  style={[
                                    styles.unitLabel,
                                    { color: colors.text },
                                  ]}
                                >
                                  {weightUnit.toLowerCase()}
                                </Text>
                              </View>
                            </View>
                            {index <
                              ONE_REP_MAX_SCREEN.exercises.length - 1 && (
                              <View
                                style={[
                                  styles.separator,
                                  { backgroundColor: colors.inputBorder },
                                ]}
                              />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </Animated.View>
                </View>
                </TouchableWithoutFeedback>
              </ScrollView>
              <View
                style={[
                  styles.buttonContainer,
                  { backgroundColor: colors.background },
                ]}
              >
                <AnimatedButton
                  testID="one-rep-max-continue"
                  accessibilityRole="button"
                  accessibilityLabel="Continue"
                  onPress={handleNext}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: colors.primaryButton },
                  ]}
                >
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </AnimatedButton>
              </View>
            </View>
        </KeyboardAvoidingView>
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
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    flexGrow: 1,
    gap: 24,
  },
  question: {
    fontSize: 28,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    marginBottom: 8,
  },
  calculatorSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 8,
  },
  unitControl: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
  },
  unitOption: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  unitOptionText: {
    alignSelf: "stretch",
    textAlign: "center",
    flexShrink: 0,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  calculatorHeading: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  calculatorButton: {
    minWidth: 44,
    minHeight: 44,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  inputsContainer: {
    gap: 0,
  },
  inputRow: {
    gap: 8,
    paddingVertical: 16,
  },
  exerciseLabel: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  weightInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    fontFamily: Fonts.sans,
    textAlign: "left",
  },
  unitLabel: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  separator: {
    height: 1,
    marginLeft: 0,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 24,
  },
  primaryButton: {
    minHeight: 56,
    flexShrink: 0,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    alignSelf: "stretch",
    textAlign: "center",
    flexShrink: 0,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
});
