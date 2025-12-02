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
import { OnboardingContext } from "@/utils/onboardingContext";
import { ONE_REP_MAX_SCREEN } from "../constants";

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

  const handleBenchPressChange = (value: string) => {
    setBenchPress(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      updateField("benchPress1RM", numValue);
    } else {
      updateField("benchPress1RM", undefined);
    }
  };

  const handleBackSquatChange = (value: string) => {
    setBackSquat(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      updateField("backSquat1RM", numValue);
    } else {
      updateField("backSquat1RM", undefined);
    }
  };

  const handleDeadliftChange = (value: string) => {
    setDeadlift(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
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
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.keyboardAvoidingView}>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.content}>
                  {/* Question */}
                  <Animated.View style={questionAnimatedStyle}>
                    <AnimatedText
                      style={[styles.question, { color: colors.text }]}
                    >
                      {ONE_REP_MAX_SCREEN.question}
                    </AnimatedText>
                  </Animated.View>

                  {/* Description */}
                  <Animated.View style={descriptionAnimatedStyle}>
                    <Text
                      style={[
                        styles.description,
                        { color: colors.placeholder },
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
                        onPress={handleOpenCalculator}
                        activeOpacity={0.7}
                        style={[
                          styles.calculatorButton,
                          { backgroundColor: colors.primaryButton },
                        ]}
                      >
                        <Entypo name="calculator" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
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
                                style={[
                                  styles.exerciseLabel,
                                  { color: colors.text },
                                ]}
                              >
                                {exercise.name}
                              </Text>
                              <View style={styles.inputContainer}>
                                <AnimatedInput
                                  style={styles.weightInput}
                                  placeholder="-"
                                  value={value}
                                  onChangeText={onChange}
                                  keyboardType="numeric"
                                />
                                <Text
                                  style={[
                                    styles.unitLabel,
                                    { color: colors.placeholder },
                                  ]}
                                >
                                  lb
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
              </ScrollView>

              {/* Next Button */}
              <View
                style={[
                  styles.buttonContainer,
                  { backgroundColor: colors.background },
                ]}
              >
                <AnimatedButton onPress={handleNext}>
                  <View
                    style={[
                      styles.primaryButton,
                      { backgroundColor: colors.primaryButton },
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>NEXT</Text>
                  </View>
                </AnimatedButton>
              </View>
            </View>
          </TouchableWithoutFeedback>
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
    paddingBottom: 120,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
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
    marginBottom: 8,
  },
  calculatorSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calculatorHeading: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  calculatorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  inputsContainer: {
    gap: 0,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  exerciseLabel: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    flex: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  weightInput: {
    width: 100,
    textAlign: "right",
  },
  unitLabel: {
    fontSize: 14,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    minWidth: 30,
  },
  separator: {
    height: 1,
    marginLeft: 0,
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

