import { useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { AnimatedButton } from "@/components/animated-button";
import { AnimatedCheckmark } from "@/components/animated-checkmark";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import type { WorkoutFrequency } from "@/interfaces/onboarding/types";
import { OnboardingContext } from "@/utils/onboardingContext";
import { TRAINING_FREQUENCY_SCREEN } from "@/features/onboarding/constants";

const AnimatedText = Animated.createAnimatedComponent(Text);

export default function TrainingFrequencyScreen() {
  const router = useRouter();
  const { data, updateField } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();

  const [selectedFrequency, setSelectedFrequency] = useState<string>(
    data.workoutFrequency || ""
  );

  // Question animation
  const questionOpacity = useSharedValue(0);
  const questionTranslateY = useSharedValue(20);
  const descriptionOpacity = useSharedValue(0);
  const descriptionTranslateY = useSharedValue(20);

  // Options animations - create shared values for each option (7 options total)
  const option0Opacity = useSharedValue(0);
  const option0TranslateY = useSharedValue(20);
  const option1Opacity = useSharedValue(0);
  const option1TranslateY = useSharedValue(20);
  const option2Opacity = useSharedValue(0);
  const option2TranslateY = useSharedValue(20);
  const option3Opacity = useSharedValue(0);
  const option3TranslateY = useSharedValue(20);
  const option4Opacity = useSharedValue(0);
  const option4TranslateY = useSharedValue(20);
  const option5Opacity = useSharedValue(0);
  const option5TranslateY = useSharedValue(20);
  const option6Opacity = useSharedValue(0);
  const option6TranslateY = useSharedValue(20);

  // Create arrays for easier access
  const optionOpacities = [
    option0Opacity,
    option1Opacity,
    option2Opacity,
    option3Opacity,
    option4Opacity,
    option5Opacity,
    option6Opacity,
  ];
  const optionTranslateYs = [
    option0TranslateY,
    option1TranslateY,
    option2TranslateY,
    option3TranslateY,
    option4TranslateY,
    option5TranslateY,
    option6TranslateY,
  ];

  // Create animated styles for each option at the top level
  const option0AnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: optionOpacities[0].value,
      transform: [{ translateY: optionTranslateYs[0].value }],
    };
  });
  const option1AnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: optionOpacities[1].value,
      transform: [{ translateY: optionTranslateYs[1].value }],
    };
  });
  const option2AnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: optionOpacities[2].value,
      transform: [{ translateY: optionTranslateYs[2].value }],
    };
  });
  const option3AnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: optionOpacities[3].value,
      transform: [{ translateY: optionTranslateYs[3].value }],
    };
  });
  const option4AnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: optionOpacities[4].value,
      transform: [{ translateY: optionTranslateYs[4].value }],
    };
  });
  const option5AnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: optionOpacities[5].value,
      transform: [{ translateY: optionTranslateYs[5].value }],
    };
  });
  const option6AnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: optionOpacities[6].value,
      transform: [{ translateY: optionTranslateYs[6].value }],
    };
  });

  const optionAnimatedStyles = useMemo(
    () => [
      option0AnimatedStyle,
      option1AnimatedStyle,
      option2AnimatedStyle,
      option3AnimatedStyle,
      option4AnimatedStyle,
      option5AnimatedStyle,
      option6AnimatedStyle,
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

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

    // Options animations - stagger starting at 600ms delay, 100ms apart
    optionOpacities.forEach((opacity, index) => {
      opacity.value = withDelay(
        600 + index * 100,
        withTiming(1, { duration: 400 })
      );
    });
    optionTranslateYs.forEach((translateY, index) => {
      translateY.value = withDelay(
        600 + index * 100,
        withTiming(0, { duration: 400 })
      );
    });
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

  const handleSelectFrequency = (frequencyId: WorkoutFrequency) => {
    setSelectedFrequency(frequencyId);
    updateField("workoutFrequency", frequencyId);
  };

  const handleNext = () => {
    if (selectedFrequency) {
      router.push("/onboarding/workout-split");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Animated.View style={[styles.animatedContainer, screenAnimatedStyle]}>
        <ScrollView
          testID="training-frequency-scroll"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Animated.View style={questionAnimatedStyle}>
              <AnimatedText testID="training-frequency-question" accessibilityRole="header" style={[styles.question, { color: colors.text }]}>
                {TRAINING_FREQUENCY_SCREEN.question}
              </AnimatedText>
            </Animated.View>

            <Animated.View style={descriptionAnimatedStyle}>
              <Text testID="training-frequency-description" style={[styles.description, { color: colors.icon }]}>
                {TRAINING_FREQUENCY_SCREEN.description}
              </Text>
            </Animated.View>

            <View style={styles.optionsContainer}>
              {TRAINING_FREQUENCY_SCREEN.options.map((option, index) => {
                const isSelected = selectedFrequency === option.id;
                const optionAnimatedStyle = optionAnimatedStyles[index];

                return (
                  <Animated.View key={option.id} style={optionAnimatedStyle}>
                    <TouchableOpacity
                      testID={`training-frequency-option-${option.id}`}
                      accessible
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={`${option.title}${option.tag ? `. ${option.tag.text}` : ""}`}
                      onPress={() => handleSelectFrequency(option.id)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.optionCard,
                          {
                            backgroundColor: colors.inputBackground,
                            borderColor: isSelected ? colors.icon : colors.inputBorder,
                          },
                        ]}
                      >
                        <View style={styles.optionContent}>
                          <View style={styles.optionTextContainer}>
                            {option.tag && (
                              <View testID={`training-frequency-tag-${option.id}`} style={[styles.tag, { backgroundColor: colors.inputBorder }]}>
                                <Text testID={`training-frequency-tag-text-${option.id}`} style={[styles.tagText, { color: colors.text }]}>
                                  {option.tag.text}
                                </Text>
                              </View>
                            )}
                            <Text testID={`training-frequency-title-${option.id}`} style={[styles.optionTitle, { color: colors.text }]}>
                              {option.title}
                            </Text>
                          </View>
                          <View
                            testID={`training-frequency-indicator-${option.id}`}
                            accessible={false}
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                            style={styles.checkbox}
                          >
                            <AnimatedCheckmark visible={isSelected}>
                              <View style={[styles.checkmark, { borderColor: colors.icon }]} />
                            </AnimatedCheckmark>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>
          <View style={styles.buttonContainer}>
            <AnimatedButton
              testID="training-frequency-continue"
              onPress={handleNext}
              disabled={!selectedFrequency}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              accessibilityState={{ disabled: !selectedFrequency }}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: selectedFrequency ? colors.primaryButton : colors.inputBackground,
                  borderColor: selectedFrequency ? colors.primaryButton : colors.inputBorder,
                },
              ]}
            >
              <Text style={[styles.primaryButtonText, { color: selectedFrequency ? "#FFFFFF" : colors.icon }]}>
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 16,
  },
  question: {
    fontSize: 28,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  description: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: Fonts.sans,
  },
  optionsContainer: {
    gap: 12,
    marginTop: 8,
  },
  optionCard: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    minHeight: 44,
  },
  tag: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  optionTextContainer: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  checkbox: {
    width: 20,
    height: 20,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    width: 7,
    height: 12,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: "45deg" }],
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 24,
  },
  primaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 56,
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    alignSelf: "stretch",
    textAlign: "center",
    flexShrink: 0,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
});
