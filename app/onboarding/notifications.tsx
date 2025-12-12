import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useState } from "react";
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
import { NOTIFICATIONS_SCREEN } from "./constants";

const AnimatedText = Animated.createAnimatedComponent(Text);

export default function NotificationsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { updateField } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();

  // Timer state for the first notification card - starts at 7 minutes (07:00)
  const [timerMinutes, setTimerMinutes] = useState(7);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Question animation
  const questionOpacity = useSharedValue(0);
  const questionTranslateY = useSharedValue(20);
  const descriptionOpacity = useSharedValue(0);
  const descriptionTranslateY = useSharedValue(20);

  // Card animations
  const card0Opacity = useSharedValue(0);
  const card0TranslateY = useSharedValue(20);
  const card1Opacity = useSharedValue(0);
  const card1TranslateY = useSharedValue(20);
  const card2Opacity = useSharedValue(0);
  const card2TranslateY = useSharedValue(20);
  const card3Opacity = useSharedValue(0);
  const card3TranslateY = useSharedValue(20);

  const cardOpacities = [
    card0Opacity,
    card1Opacity,
    card2Opacity,
    card3Opacity,
  ];
  const cardTranslateYs = [
    card0TranslateY,
    card1TranslateY,
    card2TranslateY,
    card3TranslateY,
  ];

  // Timer effect - resets when screen loses focus, starts when screen gains focus
  useFocusEffect(
    useCallback(() => {
      // Reset timer when screen comes into focus
      setTimerMinutes(7);
      setTimerSeconds(0);

      // Start timer interval
      const interval = setInterval(() => {
        setTimerSeconds((prevSeconds) => {
          if (prevSeconds === 59) {
            setTimerMinutes((prevMinutes) => prevMinutes + 1);
            return 0;
          }
          return prevSeconds + 1;
        });
      }, 1000);

      // Cleanup: clear interval when screen loses focus
      return () => clearInterval(interval);
    }, [])
  );

  // Format timer as MM:SS
  const formatTimer = (minutes: number, seconds: number): string => {
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

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

    // Cards animations - stagger starting at 600ms delay, 100ms apart
    cardOpacities.forEach((opacity, index) => {
      opacity.value = withDelay(
        600 + index * 100,
        withTiming(1, { duration: 400 })
      );
    });
    cardTranslateYs.forEach((translateY, index) => {
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

  const card0AnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: card0Opacity.value,
      transform: [{ translateY: card0TranslateY.value }],
    };
  });

  const card1AnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: card1Opacity.value,
      transform: [{ translateY: card1TranslateY.value }],
    };
  });

  const card2AnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: card2Opacity.value,
      transform: [{ translateY: card2TranslateY.value }],
    };
  });

  const card3AnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: card3Opacity.value,
      transform: [{ translateY: card3TranslateY.value }],
    };
  });

  const handleEnable = () => {
    updateField("notificationsEnabled", true);
    router.push("/onboarding/final");
  };

  const handleSkip = () => {
    updateField("notificationsEnabled", false);
    router.push("/onboarding/final");
  };

  // Set up Skip button in header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleSkip} style={{ marginHorizontal: 16 }}>
          <Text style={{ color: colors.electricBlue, fontSize: 16 }}>Skip</Text>
        </TouchableOpacity>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  return (
    <ThemedView style={styles.container}>
      <Animated.View style={[styles.animatedContainer, screenAnimatedStyle]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Heading */}
            <Animated.View style={questionAnimatedStyle}>
              <AnimatedText style={[styles.heading, { color: colors.text }]}>
                {NOTIFICATIONS_SCREEN.heading}
              </AnimatedText>
            </Animated.View>

            {/* Description */}
            <Animated.View style={descriptionAnimatedStyle}>
              <Text style={[styles.description, { color: colors.placeholder }]}>
                {NOTIFICATIONS_SCREEN.description}
              </Text>
            </Animated.View>

            {/* Notification Cards */}
            <View style={styles.cardsContainer}>
              {/* Card 1: Workout with timer */}
              <Animated.View style={card0AnimatedStyle}>
                <View
                  style={[
                    styles.notificationCard,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardLeft}>
                      <Text
                        style={[styles.cardType, { color: colors.placeholder }]}
                      >
                        {NOTIFICATIONS_SCREEN.notifications[0].title}
                      </Text>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        {NOTIFICATIONS_SCREEN.notifications[0].exercise}
                      </Text>
                      <Text
                        style={[styles.cardSubtitle, { color: colors.text }]}
                      >
                        {NOTIFICATIONS_SCREEN.notifications[0].nextSet}
                      </Text>
                      <Text
                        style={[styles.cardSubtitle, { color: colors.text }]}
                      >
                        {NOTIFICATIONS_SCREEN.notifications[0].rest}
                      </Text>
                    </View>
                    <Text
                      style={[styles.cardTimestamp, { color: colors.text }]}
                    >
                      {formatTimer(timerMinutes, timerSeconds)}
                    </Text>
                  </View>
                </View>
              </Animated.View>

              {/* Card 2: Rest time is over - Back Squat */}
              <Animated.View style={card1AnimatedStyle}>
                <View
                  style={[
                    styles.notificationCard,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardLeft}>
                      <View style={styles.cardHeader}>
                        <View
                          style={[
                            styles.iconPlaceholder,
                            { backgroundColor: colors.primaryButton },
                          ]}
                        >
                          <Text style={styles.iconText}>G</Text>
                        </View>
                        <Text
                          style={[styles.cardTitle, { color: colors.text }]}
                        >
                          {NOTIFICATIONS_SCREEN.notifications[1].title}
                        </Text>
                      </View>
                      <Text
                        style={[styles.cardSubtitle, { color: colors.text }]}
                      >
                        {NOTIFICATIONS_SCREEN.notifications[1].nextSet}
                      </Text>
                    </View>
                    <Text
                      style={[styles.cardTimestamp, { color: colors.text }]}
                    >
                      {NOTIFICATIONS_SCREEN.notifications[1].timestamp}
                    </Text>
                  </View>
                </View>
              </Animated.View>

              {/* Card 3: Rest time is over - Deadlift */}
              <Animated.View style={card2AnimatedStyle}>
                <View
                  style={[
                    styles.notificationCard,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardLeft}>
                      <View style={styles.cardHeader}>
                        <View
                          style={[
                            styles.iconPlaceholder,
                            { backgroundColor: colors.primaryButton },
                          ]}
                        >
                          <Text style={styles.iconText}>G</Text>
                        </View>
                        <Text
                          style={[styles.cardTitle, { color: colors.text }]}
                        >
                          {NOTIFICATIONS_SCREEN.notifications[2].title}
                        </Text>
                      </View>
                      <Text
                        style={[styles.cardSubtitle, { color: colors.text }]}
                      >
                        {NOTIFICATIONS_SCREEN.notifications[2].nextSet}
                      </Text>
                    </View>
                    <Text
                      style={[styles.cardTimestamp, { color: colors.text }]}
                    >
                      {NOTIFICATIONS_SCREEN.notifications[2].timestamp}
                    </Text>
                  </View>
                </View>
              </Animated.View>

              {/* Card 4: Strength Score */}
              <Animated.View style={card3AnimatedStyle}>
                <View
                  style={[
                    styles.notificationCard,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardLeft}>
                      <View style={styles.cardHeader}>
                        <View
                          style={[
                            styles.iconPlaceholder,
                            { backgroundColor: "#FF3B30" },
                          ]}
                        >
                          <Text style={styles.iconText}>↑↑</Text>
                        </View>
                        <Text
                          style={[styles.cardTitle, { color: colors.text }]}
                        >
                          {NOTIFICATIONS_SCREEN.notifications[3].title}
                        </Text>
                      </View>
                      <Text
                        style={[styles.cardSubtitle, { color: colors.text }]}
                      >
                        {NOTIFICATIONS_SCREEN.notifications[3].message}
                      </Text>
                    </View>
                    <Text
                      style={[styles.cardTimestamp, { color: colors.text }]}
                    >
                      {NOTIFICATIONS_SCREEN.notifications[3].timestamp}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            </View>
          </View>
        </ScrollView>

        {/* Enable Button */}
        <View
          style={[
            styles.buttonContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <AnimatedButton onPress={handleEnable}>
            <View
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primaryButton },
              ]}
            >
              <Text style={styles.primaryButtonText}>ENABLE</Text>
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
  heading: {
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
  cardsContainer: {
    gap: 12,
    marginTop: 8,
  },
  notificationCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  cardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardLeft: {
    flex: 1,
    gap: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: Fonts.sans,
  },
  cardType: {
    fontSize: 12,
    fontWeight: "400",
    fontFamily: Fonts.sans,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: "400",
    fontFamily: Fonts.sans,
  },
  cardTimestamp: {
    fontSize: 14,
    fontWeight: "400",
    fontFamily: Fonts.sans,
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
