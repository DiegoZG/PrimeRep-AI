import { useRouter } from "expo-router";
import React, { useContext, useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { Logo } from "@/assets/svg-components/logo";
import { AnimatedButton } from "@/components/animated-button";
import { AnimatedCard } from "@/components/animated-card";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import { OnboardingContext } from "@/utils/onboardingContext";

export default function WelcomeScreen() {
  const router = useRouter();
  const { data } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();

  const preferredName = data.preferredName || "";

  // Text animations with delays
  const welcomeTextOpacity = useSharedValue(0);
  const welcomeTextTranslateY = useSharedValue(20);
  const nameTextOpacity = useSharedValue(0);
  const nameTextTranslateY = useSharedValue(20);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(20);

  useEffect(() => {
    // Welcome text animation - starts after 300ms delay
    welcomeTextOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    welcomeTextTranslateY.value = withDelay(
      300,
      withTiming(0, { duration: 400 })
    );

    // Name text animation - starts after 600ms delay (300ms after welcome text)
    nameTextOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    nameTextTranslateY.value = withDelay(600, withTiming(0, { duration: 400 }));

    // Button animation - starts after 900ms delay (300ms after name text)
    buttonOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));
    buttonTranslateY.value = withDelay(900, withTiming(0, { duration: 400 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screenAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateX: translateX.value }],
    };
  });

  const welcomeTextAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: welcomeTextOpacity.value,
      transform: [{ translateY: welcomeTextTranslateY.value }],
    };
  });

  const nameTextAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: nameTextOpacity.value,
      transform: [{ translateY: nameTextTranslateY.value }],
    };
  });

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: buttonOpacity.value,
      transform: [{ translateY: buttonTranslateY.value }],
    };
  });

  const handleNext = () => {
    router.push("/onboarding/first-reason");
  };

  return (
    <ThemedView style={styles.container}>
      <Animated.View style={[styles.animatedContainer, screenAnimatedStyle]}>
        <ScrollView
          testID="welcome-scroll"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.content}>
            <AnimatedCard delay={100}>
              <View
                style={styles.logoContainer}
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Logo width={144} height={176} color={colors.text} />
              </View>
            </AnimatedCard>

            <View style={styles.welcomeContainer}>
              <Animated.View style={[styles.messageLine, welcomeTextAnimatedStyle]}>
                <Text
                  testID="welcome-greeting"
                  style={[styles.welcomeText, { color: colors.icon }]}
                >
                  Welcome to PrimeRep AI,
                </Text>
              </Animated.View>
              <Animated.View style={[styles.messageLine, nameTextAnimatedStyle]}>
                <Text
                  testID="welcome-name"
                  style={[styles.nameText, { color: colors.text }]}
                >
                  {preferredName || "there"}!
                </Text>
              </Animated.View>
            </View>
          </View>

          <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
            <AnimatedButton
              testID="welcome-continue"
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
          </Animated.View>
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
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  welcomeContainer: {
    alignItems: "center",
    width: "100%",
  },
  messageLine: {
    width: "100%",
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
    fontFamily: Fonts.sans,
  },
  nameText: {
    fontSize: 32,
    fontWeight: "600",
    textAlign: "center",
    fontFamily: Fonts.sans,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 20,
  },
  primaryButton: {
    minHeight: 56,
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
  },
});
