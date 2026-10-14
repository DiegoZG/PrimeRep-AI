import { Stack, useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import type { VarietyLevel } from "@/interfaces/onboarding/types";
import { OnboardingContext } from "@/utils/onboardingContext";
import { VARIETY_LEVEL_SCREEN } from "@/features/onboarding/constants";

const AnimatedText = Animated.createAnimatedComponent(Text);

export default function VarietyLevelScreen() {
  const router = useRouter();
  const { data, updateField } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const largeText = fontScale > 1.3;

  const [selectedVariety, setSelectedVariety] = useState<string>(
    data.varietyLevel || ""
  );

  // Question animation
  const questionOpacity = useSharedValue(0);
  const questionTranslateY = useSharedValue(20);
  const descriptionOpacity = useSharedValue(0);
  const descriptionTranslateY = useSharedValue(20);

  // Options animations - create shared values for each option (3 options total)
  const option0Opacity = useSharedValue(0);
  const option0TranslateY = useSharedValue(20);
  const option1Opacity = useSharedValue(0);
  const option1TranslateY = useSharedValue(20);
  const option2Opacity = useSharedValue(0);
  const option2TranslateY = useSharedValue(20);

  // Create arrays for easier access
  const optionOpacities = [option0Opacity, option1Opacity, option2Opacity];
  const optionTranslateYs = [
    option0TranslateY,
    option1TranslateY,
    option2TranslateY,
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

  const optionAnimatedStyles = useMemo(
    () => [option0AnimatedStyle, option1AnimatedStyle, option2AnimatedStyle],
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

  const handleSelectVariety = (varietyId: VarietyLevel) => {
    setSelectedVariety(varietyId);
    updateField("varietyLevel", varietyId);
  };

  const handleNext = () => {
    if (selectedVariety) {
      router.push("/onboarding/training-place");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: largeText ? () => null : () => (
            <TouchableOpacity
              onPress={() => router.push("/onboarding/final")}
              style={{ marginHorizontal: 16, minHeight: 44, minWidth: 44, justifyContent: "center" }}
            >
              <Text style={{ color: colors.electricBlue, fontSize: 16 }}>
                Skip
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Animated.View style={[styles.animatedContainer, screenAnimatedStyle]}>
        <ScrollView
          testID="variety-scroll"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={largeText ? [styles.scrollContent, styles.largeTextScrollContent] : styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {largeText && (
              <TouchableOpacity
                testID="variety-skip"
                accessibilityRole="button"
                onPress={() => router.push("/onboarding/final")}
                style={styles.skipButton}
              >
                <Text style={[styles.skipText, { color: colors.text }]}>Skip</Text>
              </TouchableOpacity>
            )}
            {/* Question */}
            <Animated.View style={questionAnimatedStyle}>
              <AnimatedText style={[styles.question, { color: colors.text }]}>
                {VARIETY_LEVEL_SCREEN.question}
              </AnimatedText>
            </Animated.View>

            {/* Description */}
            <Animated.View style={descriptionAnimatedStyle}>
              <Text style={[styles.description, { color: colors.placeholder }]}>
                {VARIETY_LEVEL_SCREEN.description}
              </Text>
            </Animated.View>

            {/* Options */}
            <View style={styles.optionsContainer}>
              {VARIETY_LEVEL_SCREEN.options.map((option, index) => {
                const isSelected = selectedVariety === option.id;
                const optionAnimatedStyle = optionAnimatedStyles[index];

                return (
                  <Animated.View key={option.id} style={optionAnimatedStyle}>
                    <SelectableOptionCard
                      title={option.title}
                      description={option.description}
                      isSelected={isSelected}
                      onPress={() => handleSelectVariety(option.id)}
                      showCheckbox={true}
                      fullWidthDescription={largeText}
                      accessibilityLabel={`${option.title}. ${option.description}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      aria-checked={isSelected}
                      testID={`variety-option-${option.id}`}
                    />
                  </Animated.View>
                );
              })}
            </View>
          </View>
          {largeText && (
            <View style={[styles.buttonContainer, { paddingBottom: Math.max(24, insets.bottom) }]}>
              <AnimatedButton onPress={handleNext} disabled={!selectedVariety} accessibilityState={{ disabled: !selectedVariety }}>
                <View
                  style={[
                    styles.primaryButton,
                    styles.largeTextPrimaryButton,
                    { backgroundColor: colors.primaryButton },
                    !selectedVariety && { opacity: 0.5 },
                  ]}
                >
                  <Text style={styles.primaryButtonText}>NEXT</Text>
                </View>
              </AnimatedButton>
            </View>
          )}
        </ScrollView>

        {/* Next Button */}
        {!largeText && <View
          style={[
            styles.buttonContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <AnimatedButton onPress={handleNext} disabled={!selectedVariety} accessibilityState={{ disabled: !selectedVariety }}>
            <View
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primaryButton },
                !selectedVariety && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.primaryButtonText}>NEXT</Text>
            </View>
          </AnimatedButton>
        </View>}
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
  largeTextScrollContent: {
    paddingBottom: 0,
  },
  skipButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 16,
    fontFamily: Fonts.sans,
  },
  largeTextPrimaryButton: {
    minHeight: 44,
    paddingHorizontal: 20,
  },
});
