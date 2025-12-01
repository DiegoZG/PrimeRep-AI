import { useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useState } from "react";
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
import { AnimatedCheckmark } from "@/components/animated-checkmark";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import { OnboardingContext } from "@/utils/onboardingContext";
import { FITNESS_EXPERIENCE_SCREEN } from "../constants";

const AnimatedText = Animated.createAnimatedComponent(Text);

export default function FitnessExperienceScreen() {
  const router = useRouter();
  const { data, updateField } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();

  const [selectedExperience, setSelectedExperience] = useState<string>(
    data.experienceLevel || ""
  );

  // Question animation
  const questionOpacity = useSharedValue(0);
  const questionTranslateY = useSharedValue(20);
  const descriptionOpacity = useSharedValue(0);
  const descriptionTranslateY = useSharedValue(20);

  // Options animations - create shared values for each option (4 options total)
  const option0Opacity = useSharedValue(0);
  const option0TranslateY = useSharedValue(20);
  const option1Opacity = useSharedValue(0);
  const option1TranslateY = useSharedValue(20);
  const option2Opacity = useSharedValue(0);
  const option2TranslateY = useSharedValue(20);
  const option3Opacity = useSharedValue(0);
  const option3TranslateY = useSharedValue(20);

  // Create arrays for easier access
  const optionOpacities = [
    option0Opacity,
    option1Opacity,
    option2Opacity,
    option3Opacity,
  ];
  const optionTranslateYs = [
    option0TranslateY,
    option1TranslateY,
    option2TranslateY,
    option3TranslateY,
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

  const optionAnimatedStyles = useMemo(
    () => [
      option0AnimatedStyle,
      option1AnimatedStyle,
      option2AnimatedStyle,
      option3AnimatedStyle,
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

  const handleSelectExperience = (experienceId: string) => {
    setSelectedExperience(experienceId);
    updateField("experienceLevel", experienceId);
  };

  const handleNext = () => {
    if (selectedExperience) {
      // Navigate to one-rep-max screen for Intermediate or Advanced
      if (
        selectedExperience === "intermediate" ||
        selectedExperience === "advanced"
      ) {
        router.push("/onboarding/fitness-experience/one-rep-max");
      } else {
        // Navigate directly to fitness-goal for No Experience or Beginner
        router.push("/onboarding/fitness-goal");
      }
    }
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
                {FITNESS_EXPERIENCE_SCREEN.question}
              </AnimatedText>
            </Animated.View>

            {/* Description */}
            <Animated.View style={descriptionAnimatedStyle}>
              <Text style={[styles.description, { color: colors.placeholder }]}>
                {FITNESS_EXPERIENCE_SCREEN.description}
              </Text>
            </Animated.View>

            {/* Options */}
            <View style={styles.optionsContainer}>
              {FITNESS_EXPERIENCE_SCREEN.options.map((option, index) => {
                const isSelected = selectedExperience === option.id;
                const optionAnimatedStyle = optionAnimatedStyles[index];

                return (
                  <Animated.View key={option.id} style={optionAnimatedStyle}>
                    <TouchableOpacity
                      onPress={() => handleSelectExperience(option.id)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.optionCard,
                          {
                            backgroundColor: isSelected
                              ? "rgba(106, 79, 245, 0.12)" // 12% opacity of primaryButton
                              : colors.inputBackground,
                            borderColor: isSelected
                              ? colors.primaryButton
                              : colors.inputBorder,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                      >
                        <View style={styles.optionContent}>
                          <View style={styles.optionTextContainer}>
                            <Text
                              style={[
                                styles.optionTitle,
                                { color: colors.text },
                              ]}
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
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Next Button */}
        <View
          style={[
            styles.buttonContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <AnimatedButton onPress={handleNext} disabled={!selectedExperience}>
            <View
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primaryButton },
                !selectedExperience && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.primaryButtonText}>NEXT</Text>
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
  optionsContainer: {
    gap: 12,
    marginTop: 8,
  },
  optionCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  optionTextContainer: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 17,
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

