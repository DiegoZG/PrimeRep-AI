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
import { AnimatedCard } from "@/components/animated-card";
import { AnimatedInput } from "@/components/animated-input";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import type { WeightUnit } from "@/interfaces/onboarding/types";
import { OnboardingContext } from "@/utils/onboardingContext";
import { convertWeight } from "@/utils/weightConversion";
import { BODY_STATS_SCREEN } from "@/features/onboarding/constants";

export default function BodyStatsScreen() {
  const router = useRouter();
  const { data, updateField } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();

  const [gender, setGender] = useState<string>(data.gender || "");
  const [weight, setWeight] = useState<string>(
    data.weight ? String(data.weight) : ""
  );
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(
    data.weightUnit || "LB"
  );
  const [age, setAge] = useState<string>(data.age ? String(data.age) : "");
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  // Animation shared values
  const manualSectionOpacity = useSharedValue(0);
  const manualSectionTranslateY = useSharedValue(20);
  const formFieldsOpacity = useSharedValue(0);
  const formFieldsTranslateY = useSharedValue(20);

  useEffect(() => {
    setWeight(data.weight ? String(data.weight) : "");
    setWeightUnit(data.weightUnit || "LB");
  }, [data.weight, data.weightUnit]);

  useEffect(() => {
    // Manual section animation
    manualSectionOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 400 })
    );
    manualSectionTranslateY.value = withDelay(
      200,
      withTiming(0, { duration: 400 })
    );

    formFieldsOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
    formFieldsTranslateY.value = withDelay(
      500,
      withTiming(0, { duration: 400 })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screenAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateX: translateX.value }],
    };
  });

  const manualSectionAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: manualSectionOpacity.value,
      transform: [{ translateY: manualSectionTranslateY.value }],
    };
  });

  const formFieldsAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: formFieldsOpacity.value,
      transform: [{ translateY: formFieldsTranslateY.value }],
    };
  });

  const handleSelectGender = (selectedGender: string) => {
    setGender(selectedGender);
    updateField("gender", selectedGender);
    setShowGenderPicker(false);
  };

  const handleWeightChange = (value: string) => {
    setWeight(value);
    const numValue = Number(value);
    if (value.trim() && Number.isFinite(numValue) && numValue > 0 && numValue <= 700) {
      updateField("weight", numValue);
    } else {
      updateField("weight", undefined);
    }
  };

  const handleToggleWeightUnit = () => {
    const newUnit = weightUnit === "LB" ? "KG" : "LB";
    const parsedWeight = Number.parseFloat(weight);
    const convertedWeight = Number.isFinite(parsedWeight) && parsedWeight > 0
      ? convertWeight(parsedWeight, weightUnit, newUnit)
      : undefined;
    setWeightUnit(newUnit);
    if (convertedWeight !== undefined) {
      setWeight(String(convertedWeight));
    }
    updateField("weightUnit", newUnit);
    updateField("weight", convertedWeight);
    (['benchPress1RM', 'backSquat1RM', 'deadlift1RM'] as const).forEach((field) => {
      const value = data[field];
      updateField(
        field,
        typeof value === "number" ? convertWeight(value, weightUnit, newUnit) : value
      );
    });
  };

  const handleAgeChange = (value: string) => {
    setAge(value);
    const numValue = Number(value);
    if (value.trim() && Number.isInteger(numValue) && numValue >= 13 && numValue <= 120) {
      updateField("age", numValue);
    } else {
      updateField("age", undefined);
    }
  };

  const handleNext = () => {
    const numericWeight = Number(weight);
    const numericAge = Number(age);
    if (
      gender &&
      Number.isFinite(numericWeight) && numericWeight > 0 && numericWeight <= 700 &&
    Number.isInteger(numericAge) && numericAge >= 13 && numericAge <= 120
    ) {
      router.push("/onboarding/fitness-experience");
    }
  };

  const isFormValid =
    Boolean(gender) &&
    weight.trim().length > 0 &&
    Number.isFinite(Number(weight)) &&
    Number(weight) > 0 &&
    Number(weight) <= 700 &&
    age.trim().length > 0 &&
    Number.isInteger(Number(age)) &&
    Number(age) >= 13 &&
    Number(age) <= 120;

  const ageError = (() => {
    if (!age.trim()) return null;
    const numericAge = Number(age);
    if (!Number.isInteger(numericAge)) return "Enter your age in whole years.";
    if (numericAge <= 12) return "You need to be at least 13 to use PrimeRep.";
    if (numericAge > 120) return "Enter an age between 13 and 120.";
    return null;
  })();

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setShowGenderPicker(false);
  };

  return (
    <ThemedView style={styles.container}>
      <Animated.View style={[styles.animatedContainer, screenAnimatedStyle]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
          <ScrollView
            testID="body-stats-scroll"
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
              <View style={styles.content}>
                {/* Manual Entry Section */}
                <Animated.View style={manualSectionAnimatedStyle}>
                  <AnimatedCard delay={0}>
                    <View style={styles.manualSection}>
                      <Text testID="body-stats-heading" style={[styles.heading, { color: colors.text }]}>
                        {BODY_STATS_SCREEN.manualSection.heading}
                      </Text>
                      <Text
                        testID="body-stats-description"
                        style={[
                          styles.description,
                          { color: colors.icon },
                        ]}
                      >
                        {BODY_STATS_SCREEN.manualSection.description}
                      </Text>
                    </View>
                  </AnimatedCard>
                </Animated.View>

                {/* Form Fields */}
                <Animated.View style={formFieldsAnimatedStyle}>
                  <AnimatedCard delay={0}>
                    <View style={styles.formFields}>
                      {/* Gender Field */}
                      <View style={styles.fieldContainer}>
                        <Text
                          style={[styles.fieldLabel, { color: colors.text }]}
                        >
                          {BODY_STATS_SCREEN.formFields.gender.label}
                        </Text>
                        <TouchableOpacity
                          testID="body-stats-gender"
                          style={styles.genderControl}
                          accessibilityRole="button"
                          accessibilityLabel={`Gender, ${gender || BODY_STATS_SCREEN.formFields.gender.placeholder}`}
                          accessibilityState={{ expanded: showGenderPicker }}
                          onPress={() =>
                            setShowGenderPicker(!showGenderPicker)
                          }
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.genderInput,
                              {
                                backgroundColor: colors.inputBackground,
                                borderColor: showGenderPicker
                                  ? colors.text
                                  : colors.inputBorder,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.genderInputText,
                                {
                                  color: gender
                                    ? colors.text
                                    : colors.icon,
                                },
                              ]}
                            >
                              {gender ||
                                BODY_STATS_SCREEN.formFields.gender
                                  .placeholder}
                            </Text>
                            <Text
                              accessible={false}
                              accessibilityElementsHidden
                              importantForAccessibility="no-hide-descendants"
                              style={[
                                styles.chevron,
                                { color: colors.icon },
                              ]}
                            >
                              ▼
                            </Text>
                          </View>
                        </TouchableOpacity>
                        {showGenderPicker && (
                          <View
                            style={[
                              styles.pickerContainer,
                              {
                                backgroundColor: colors.inputBackground,
                                borderColor: colors.inputBorder,
                              },
                            ]}
                          >
                            {BODY_STATS_SCREEN.genderOptions.map(
                              (option, index) => {
                                const isLastOption =
                                  index ===
                                  BODY_STATS_SCREEN.genderOptions.length - 1;
                                return (
                                  <TouchableOpacity
                                    key={option}
                                    testID={`body-stats-gender-option-${index}`}
                                    accessibilityRole="radio"
                                    accessibilityLabel={option}
                                    accessibilityState={{ selected: gender === option, checked: gender === option }}
                                    onPress={() => handleSelectGender(option)}
                                    style={[
                                      styles.pickerOption,
                                      {
                                        borderBottomWidth: isLastOption
                                          ? 0
                                          : 1,
                                        borderBottomColor: isLastOption
                                          ? "transparent"
                                          : colors.inputBorder,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.pickerOptionText,
                                        {
                                          color: colors.text,
                                          fontWeight:
                                            gender === option ? "600" : "400",
                                        },
                                      ]}
                                    >
                                      {option}
                                    </Text>
                                    <View
                                      style={styles.choiceIndicator}
                                      accessible={false}
                                      accessibilityElementsHidden
                                      importantForAccessibility="no-hide-descendants"
                                    >
                                      {gender === option && (
                                        <View style={[styles.choiceCheck, { borderColor: colors.text }]} />
                                      )}
                                    </View>
                                  </TouchableOpacity>
                                );
                              }
                            )}
                          </View>
                        )}
                      </View>

                      {/* Weight Field */}
                      <View style={styles.fieldContainer}>
                        <View style={styles.weightLabelRow}>
                          <Text style={[styles.fieldLabel, { color: colors.text }]}>
                            {BODY_STATS_SCREEN.formFields.weight.label}
                          </Text>
                          <View style={[styles.unitControl, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}>
                            {(["LB", "KG"] as const).map((unit) => (
                              <TouchableOpacity
                                key={unit}
                                testID={`body-stats-unit-${unit.toLowerCase()}`}
                                onPress={() => { if (unit !== weightUnit) handleToggleWeightUnit(); }}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={`Use ${unit === "LB" ? "pounds" : "kilograms"} for body weight and one-rep maxes`}
                                accessibilityState={{ selected: unit === weightUnit }}
                                style={[styles.unitSegment, unit === weightUnit && { backgroundColor: colors.inputBorder }]}
                              >
                                <Text style={[styles.weightUnit, { color: colors.text }]}>{unit}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                        <AnimatedInput
                          testID="body-stats-weight-input"
                          authPresentation
                          accessibilityLabel={`Weight in ${weightUnit === "LB" ? "pounds" : "kilograms"}`}
                          style={styles.weightInput}
                          placeholder={
                            BODY_STATS_SCREEN.formFields.weight.placeholder
                          }
                          value={weight}
                          onChangeText={handleWeightChange}
                          keyboardType="numeric"
                        />
                      </View>

                      {/* Age Field */}
                      <View style={styles.fieldContainer}>
                        <Text
                          style={[styles.fieldLabel, { color: colors.text }]}
                        >
                          {BODY_STATS_SCREEN.formFields.age.label}
                        </Text>
                        {ageError && (
                          <Text
                            testID="body-stats-age-error"
                            accessibilityLiveRegion="polite"
                            style={[styles.fieldError, { color: colorScheme === "dark" ? "#FF8B82" : "#B42318" }]}
                          >
                            {ageError}
                          </Text>
                        )}
                        <AnimatedInput
                          testID="body-stats-age-input"
                          authPresentation
                          style={styles.input}
                          placeholder={
                            BODY_STATS_SCREEN.formFields.age.placeholder
                          }
                          value={age}
                          onChangeText={handleAgeChange}
                          keyboardType="numeric"
                          error={Boolean(ageError)}
                          accessibilityLabel="Age"
                          aria-invalid={Boolean(ageError)}
                          accessibilityHint={ageError || "Enter your age in whole years"}
                        />
                      </View>
                    </View>
                  </AnimatedCard>
                </Animated.View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>

          {/* Next Button */}
          <View testID="body-stats-footer" style={styles.buttonContainer}>
            <AnimatedButton
              testID="body-stats-continue"
              onPress={handleNext}
              disabled={!isFormValid}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              accessibilityState={{ disabled: !isFormValid }}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: isFormValid ? colors.primaryButton : colors.inputBackground,
                  borderColor: isFormValid ? colors.primaryButton : colors.inputBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: isFormValid ? "#FFFFFF" : colors.icon },
                ]}
              >
                Continue
              </Text>
            </AnimatedButton>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
  },
  syncSection: {
    gap: 16,
  },
  manualSection: {
    gap: 12,
  },
  heading: {
    fontSize: 26,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  description: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: Fonts.sans,
  },
  syncButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  syncButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  separatorText: {
    fontSize: 14,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    marginHorizontal: 12,
  },
  formFields: {
    gap: 20,
  },
  fieldContainer: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  fieldError: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    marginTop: -4,
  },
  genderControl: {
    minHeight: 56,
  },
  genderInput: {
    minHeight: 56,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 2,
  },
  genderInputText: {
    fontSize: 16,
    fontFamily: Fonts.sans,
    flex: 1,
  },
  chevron: {
    fontSize: 12,
    fontFamily: Fonts.sans,
    marginLeft: 8,
  },
  pickerContainer: {
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  pickerOption: {
    minHeight: 44,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pickerOptionText: {
    fontSize: 16,
    fontFamily: Fonts.sans,
    flex: 1,
    minWidth: 0,
  },
  choiceIndicator: {
    width: 24,
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceCheck: {
    width: 8,
    height: 14,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: "45deg" }],
  },
  weightLabelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  unitControl: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  unitSegment: {
    minHeight: 44,
    minWidth: 52,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  weightInput: {
    width: "100%",
    minHeight: 56,
    fontFamily: Fonts.sans,
  },
  weightUnit: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  input: {
    width: "100%",
    minHeight: 56,
    fontFamily: Fonts.sans,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
  },
  primaryButton: {
    minHeight: 56,
    flexShrink: 0,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    alignSelf: "stretch",
    textAlign: "center",
  },
});
