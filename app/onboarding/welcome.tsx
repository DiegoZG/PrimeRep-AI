import React, { useContext, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { Logo } from "@/assets/svg-components/logo";
import { AnimatedCard } from "@/components/animated-card";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import { OnboardingContext } from "@/utils/onboardingContext";

export default function WelcomeScreen() {
  const { data } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();

  const firstName = data.firstName || "";

  // Text animations with delays
  const welcomeTextOpacity = useSharedValue(0);
  const welcomeTextTranslateY = useSharedValue(20);
  const nameTextOpacity = useSharedValue(0);
  const nameTextTranslateY = useSharedValue(20);

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

  return (
    <ThemedView style={styles.container}>
      <Animated.View style={[styles.animatedContainer, screenAnimatedStyle]}>
        <View style={styles.content}>
          {/* Logo */}
          <AnimatedCard delay={100}>
            <View style={styles.logoContainer}>
              <Logo
                width={180}
                height={180}
                style={{
                  shadowColor: colors.electricBlue,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 20,
                  elevation: 20,
                }}
              />
            </View>
          </AnimatedCard>

          {/* Welcome Message */}
          <View style={styles.welcomeContainer}>
            <Animated.View style={welcomeTextAnimatedStyle}>
              <Text style={[styles.welcomeText, { color: colors.text }]}>
                Welcome to PrimeRep AI,
              </Text>
            </Animated.View>
            <Animated.View style={nameTextAnimatedStyle}>
              <Text style={[styles.nameText, { color: colors.electricBlue }]}>
                {firstName || "there"}!
              </Text>
            </Animated.View>
          </View>
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
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 60,
  },
  welcomeContainer: {
    alignItems: "center",
  },
  welcomeText: {
    fontSize: 32,
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
});
