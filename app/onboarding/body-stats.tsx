import { useRouter } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import {
  Alert,
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
import { BODY_STATS_SCREEN } from "./constants";

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
  const syncSectionOpacity = useSharedValue(0);
  const syncSectionTranslateY = useSharedValue(20);
  const manualSectionOpacity = useSharedValue(0);
  const manualSectionTranslateY = useSharedValue(20);
  const formFieldsOpacity = useSharedValue(0);
  const formFieldsTranslateY = useSharedValue(20);

  useEffect(() => {
    setWeight(data.weight ? String(data.weight) : "");
    setWeightUnit(data.weightUnit || "LB");
  }, [data.weight, data.weightUnit]);

  useEffect(() => {
    // Sync section animation - starts after 200ms delay
    syncSectionOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    syncSectionTranslateY.value = withDelay(
      200,
      withTiming(0, { duration: 400 })
    );

    // Manual section animation - starts after 500ms delay
    manualSectionOpacity.value = withDelay(
      500,
      withTiming(1, { duration: 400 })
    );
    manualSectionTranslateY.value = withDelay(
      500,
      withTiming(0, { duration: 400 })
    );

    // Form fields animation - starts after 800ms delay
    formFieldsOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));
    formFieldsTranslateY.value = withDelay(
      800,
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

  const syncSectionAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: syncSectionOpacity.value,
      transform: [{ translateY: syncSectionTranslateY.value }],
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

  const handleSyncAppleHealth = () => {
    Alert.alert(
      "Apple Health sync is coming soon",
      "You can enter your details below. HealthKit syncing will be available in a future iOS update."
    );
  };

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
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.keyboardAvoidingView}>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.content}>
                  {/* Sync with Apple Health Section */}
                  <Animated.View style={syncSectionAnimatedStyle}>
                    <AnimatedCard delay={0}>
                      <View style={styles.syncSection}>
                        <Text style={[styles.heading, { color: colors.text }]}>
                          {BODY_STATS_SCREEN.syncSection.heading}
                        </Text>
                        <Text
                          style={[
                            styles.description,
                            { color: colors.placeholder },
                          ]}
                        >
                          {BODY_STATS_SCREEN.syncSection.description}
                        </Text>
                        <AnimatedButton onPress={handleSyncAppleHealth}>
                          <View
                            style={[
                              styles.syncButton,
                              {
                                backgroundColor: colors.background,
                                borderColor: colors.inputBorder,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.syncButtonText,
                                { color: colors.text },
                              ]}
                            >
                              ❤️ {BODY_STATS_SCREEN.syncSection.buttonText}
                            </Text>
                          </View>
                        </AnimatedButton>
                        <View style={styles.separator}>
                          <View
                            style={[
                              styles.separatorLine,
                              { backgroundColor: colors.inputBorder },
                            ]}
                          />
                          <Text
                            style={[
                              styles.separatorText,
                              { color: colors.placeholder },
                            ]}
                          >
                            OR
                          </Text>
                          <View
                            style={[
                              styles.separatorLine,
                              { backgroundColor: colors.inputBorder },
                            ]}
                          />
                        </View>
                      </View>
                    </AnimatedCard>
                  </Animated.View>

                  {/* Manual Entry Section */}
                  <Animated.View style={manualSectionAnimatedStyle}>
                    <AnimatedCard delay={0}>
                      <View style={styles.manualSection}>
                        <Text style={[styles.heading, { color: colors.text }]}>
                          {BODY_STATS_SCREEN.manualSection.heading}
                        </Text>
                        <Text
                          style={[
                            styles.description,
                            { color: colors.placeholder },
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
                                    ? colors.electricBlue
                                    : colors.inputBorder,
                                  borderWidth: showGenderPicker ? 2 : 1,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.genderInputText,
                                  {
                                    color: gender
                                      ? colors.text
                                      : colors.placeholder,
                                  },
                                ]}
                              >
                                {gender ||
                                  BODY_STATS_SCREEN.formFields.gender
                                    .placeholder}
                              </Text>
                              <Text
                                style={[
                                  styles.chevron,
                                  { color: colors.placeholder },
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
                                            color:
                                              gender === option
                                                ? colors.electricBlue
                                                : colors.text,
                                            fontWeight:
                                              gender === option ? "600" : "400",
                                          },
                                        ]}
                                      >
                                        {option}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                }
                              )}
                            </View>
                          )}
                        </View>

                        {/* Weight Field */}
                        <View style={styles.fieldContainer}>
                          <Text
                            style={[styles.fieldLabel, { color: colors.text }]}
                          >
                            {BODY_STATS_SCREEN.formFields.weight.label}
                          </Text>
                          <View style={styles.weightContainer}>
                            <AnimatedInput
                              style={styles.weightInput}
                              placeholder={
                                BODY_STATS_SCREEN.formFields.weight.placeholder
                              }
                              value={weight}
                              onChangeText={handleWeightChange}
                              keyboardType="numeric"
                            />
                            <TouchableOpacity
                              onPress={handleToggleWeightUnit}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.weightUnit,
                                  { color: colors.electricBlue },
                                ]}
                              >
                                {weightUnit}
                              </Text>
                            </TouchableOpacity>
                          </View>
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
                              accessibilityLiveRegion="polite"
                              style={styles.fieldError}
                            >
                              {ageError}
                            </Text>
                          )}
                          <AnimatedInput
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
              </ScrollView>

              {/* Next Button */}
              <View style={styles.buttonContainer}>
                <AnimatedButton onPress={handleNext} disabled={!isFormValid}>
                  <View
                    style={[
                      styles.primaryButton,
                      { backgroundColor: colors.primaryButton },
                      !isFormValid && { opacity: 0.5 },
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
  syncSection: {
    gap: 16,
  },
  manualSection: {
    gap: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    lineHeight: 32,
  },
  description: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    lineHeight: 22,
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
    color: "#D14343",
    fontSize: 14,
    fontWeight: "600",
    marginTop: -4,
  },
  genderInput: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
  },
  genderInputText: {
    fontSize: 16,
    fontFamily: Fonts.sans,
    flex: 1,
  },
  chevron: {
    fontSize: 12,
    marginLeft: 8,
  },
  pickerContainer: {
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  pickerOption: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  pickerOptionText: {
    fontSize: 16,
    fontFamily: Fonts.sans,
  },
  weightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  weightInput: {
    flex: 1,
  },
  weightUnit: {
    fontSize: 16,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    minWidth: 40,
  },
  input: {
    width: "100%",
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
