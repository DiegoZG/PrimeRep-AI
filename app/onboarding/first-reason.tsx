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
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import { OnboardingContext } from "@/utils/onboardingContext";
import { REASON_SCREEN } from "./constants";

const AnimatedText = Animated.createAnimatedComponent(Text);

export default function FirstReasonScreen() {
  const router = useRouter();
  const { data, updateField } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();

  const [selectedReason, setSelectedReason] = useState<string>(
    data.reason || ""
  );

  // Question animation
  const questionOpacity = useSharedValue(0);
  const questionTranslateY = useSharedValue(20);

  // Options animations - create shared values for each option (5 options total)
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

  // Create arrays for easier access
  const optionOpacities = [
    option0Opacity,
    option1Opacity,
    option2Opacity,
    option3Opacity,
    option4Opacity,
  ];
  const optionTranslateYs = [
    option0TranslateY,
    option1TranslateY,
    option2TranslateY,
    option3TranslateY,
    option4TranslateY,
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

  // Memoize the animated styles array to prevent recreation on re-renders
  const optionAnimatedStyles = useMemo(
    () => [
      option0AnimatedStyle,
      option1AnimatedStyle,
      option2AnimatedStyle,
      option3AnimatedStyle,
      option4AnimatedStyle,
    ],
    [
      option0AnimatedStyle,
      option1AnimatedStyle,
      option2AnimatedStyle,
      option3AnimatedStyle,
      option4AnimatedStyle,
    ]
  );

  useEffect(() => {
    // Question animation - starts after 200ms delay
    questionOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    questionTranslateY.value = withDelay(200, withTiming(0, { duration: 400 }));

    // Options animations - staggered with 100ms delay between each
    // Set initial values immediately to prevent flickering
    optionOpacities.forEach((opacity) => {
      opacity.value = 0;
    });
    optionTranslateYs.forEach((translateY) => {
      translateY.value = 20;
    });

    // Animate them in
    REASON_SCREEN.options.forEach((_, index) => {
      const delay = 400 + index * 100;
      optionOpacities[index].value = withDelay(
        delay,
        withTiming(1, { duration: 400 })
      );
      optionTranslateYs[index].value = withDelay(
        delay,
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

  const handleSelectReason = (reasonId: string) => {
    setSelectedReason(reasonId);
    updateField("reason", reasonId);
  };

  const handleNext = () => {
    if (selectedReason) {
      router.push("/onboarding/body-stats");
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
            <AnimatedText
              style={[
                styles.question,
                { color: colors.text },
                questionAnimatedStyle,
              ]}
            >
              {REASON_SCREEN.question}
            </AnimatedText>

            {/* Options */}
            <View style={styles.optionsContainer}>
              {REASON_SCREEN.options.map((option, index) => {
                const isSelected = selectedReason === option.id;
                const optionAnimatedStyle = optionAnimatedStyles[index];

                return (
                  <Animated.View key={option.id} style={optionAnimatedStyle}>
                    <TouchableOpacity
                      onPress={() => handleSelectReason(option.id)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.optionCard,
                          {
                            backgroundColor: colors.inputBackground,
                            borderColor: isSelected
                              ? colors.electricBlue
                              : colors.inputBorder,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.optionTitle, { color: colors.text }]}
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
          <AnimatedButton onPress={handleNext} disabled={!selectedReason}>
            <View
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primaryButton },
                !selectedReason && { opacity: 0.5 },
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
    paddingBottom: 120, // Extra space for button to ensure last card border is visible
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24, // Extra padding at bottom of content
  },
  question: {
    fontSize: 32,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    marginBottom: 32,
    lineHeight: 40,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    marginBottom: 8,
    lineHeight: 24,
  },
  optionDescription: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    lineHeight: 20,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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
