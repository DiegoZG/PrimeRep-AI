import { useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { AnimatedButton } from "@/components/animated-button";
import { SelectableOptionCard } from "@/components/selectable-option-card";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import { OnboardingContext } from "@/utils/onboardingContext";
import { TRAINING_FREQUENCY_SCREEN } from "./constants";

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

  const handleSelectFrequency = (frequencyId: string) => {
    setSelectedFrequency(frequencyId);
    updateField("workoutFrequency", frequencyId);
  };

  const handleNext = () => {
    if (selectedFrequency) {
      router.push("/onboarding/final");
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
                {TRAINING_FREQUENCY_SCREEN.question}
              </AnimatedText>
            </Animated.View>

            {/* Description */}
            <Animated.View style={descriptionAnimatedStyle}>
              <Text style={[styles.description, { color: colors.placeholder }]}>
                {TRAINING_FREQUENCY_SCREEN.description}
              </Text>
            </Animated.View>

            {/* Options */}
            <View style={styles.optionsContainer}>
              {TRAINING_FREQUENCY_SCREEN.options.map((option, index) => {
                const isSelected = selectedFrequency === option.id;
                const optionAnimatedStyle = optionAnimatedStyles[index];

                return (
                  <Animated.View key={option.id} style={optionAnimatedStyle}>
                    <SelectableOptionCard
                      title={option.title}
                      isSelected={isSelected}
                      onPress={() => handleSelectFrequency(option.id)}
                      tag={option.tag}
                      showCheckbox={true}
                    />
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
          <AnimatedButton onPress={handleNext} disabled={!selectedFrequency}>
            <View
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primaryButton },
                !selectedFrequency && { opacity: 0.5 },
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
