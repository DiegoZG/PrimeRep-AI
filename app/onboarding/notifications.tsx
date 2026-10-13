import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useContext, useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedButton } from "@/components/animated-button";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { NOTIFICATIONS_SCREEN } from "@/features/onboarding/constants";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import { OnboardingContext } from "@/utils/onboardingContext";
import { NotificationsContext } from "@/utils/notificationsContext";

const AnimatedText = Animated.createAnimatedComponent(Text);

export default function NotificationsScreen() {
  const router = useRouter();
  const { updateField } = useContext(OnboardingContext);
  const { requestPermission, isLoading } = useContext(NotificationsContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const insets = useSafeAreaInsets();
  const { opacity, translateX } = useScreenTransition();

  const questionOpacity = useSharedValue(0);
  const questionTranslateY = useSharedValue(20);
  const descriptionOpacity = useSharedValue(0);
  const descriptionTranslateY = useSharedValue(20);
  const card0Opacity = useSharedValue(0);
  const card0TranslateY = useSharedValue(20);
  const card1Opacity = useSharedValue(0);
  const card1TranslateY = useSharedValue(20);
  const card2Opacity = useSharedValue(0);
  const card2TranslateY = useSharedValue(20);

  const cardOpacities = [card0Opacity, card1Opacity, card2Opacity];
  const cardTranslateYs = [card0TranslateY, card1TranslateY, card2TranslateY];

  useEffect(() => {
    questionOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    questionTranslateY.value = withDelay(200, withTiming(0, { duration: 400 }));
    descriptionOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    descriptionTranslateY.value = withDelay(
      400,
      withTiming(0, { duration: 400 })
    );
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

  const screenAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));
  const questionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: questionOpacity.value,
    transform: [{ translateY: questionTranslateY.value }],
  }));
  const descriptionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: descriptionOpacity.value,
    transform: [{ translateY: descriptionTranslateY.value }],
  }));
  const card0AnimatedStyle = useAnimatedStyle(() => ({
    opacity: card0Opacity.value,
    transform: [{ translateY: card0TranslateY.value }],
  }));
  const card1AnimatedStyle = useAnimatedStyle(() => ({
    opacity: card1Opacity.value,
    transform: [{ translateY: card1TranslateY.value }],
  }));
  const card2AnimatedStyle = useAnimatedStyle(() => ({
    opacity: card2Opacity.value,
    transform: [{ translateY: card2TranslateY.value }],
  }));
  const cardAnimatedStyles = [card0AnimatedStyle, card1AnimatedStyle, card2AnimatedStyle];

  const handleEnable = async () => {
    try {
      const status = await requestPermission();
      updateField("notificationsEnabled", status === "granted");
    } catch {
      updateField("notificationsEnabled", false);
    } finally {
      router.push("/onboarding/final");
    }
  };

  const handleSkip = () => {
    updateField("notificationsEnabled", false);
    router.push("/onboarding/final");
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerRight: () => null }} />
      <Animated.View style={[styles.container, screenAnimatedStyle]}>
        <ScrollView
          testID="onboarding-notifications-scroll"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={questionAnimatedStyle}>
            <AnimatedText
              testID="onboarding-notifications-heading"
              accessibilityRole="header"
              style={[styles.heading, { color: colors.text }]}
            >
              {NOTIFICATIONS_SCREEN.heading}
            </AnimatedText>
          </Animated.View>
          <Animated.View style={descriptionAnimatedStyle}>
            <Text
              testID="onboarding-notifications-description"
              style={[styles.bodyText, { color: colors.icon }]}
            >
              {NOTIFICATIONS_SCREEN.description}
            </Text>
          </Animated.View>
          <View style={styles.examplesSection}>
            <Text
              accessibilityRole="header"
              style={[styles.sectionTitle, { color: colors.text }]}
            >
              {NOTIFICATIONS_SCREEN.examplesHeading}
            </Text>
            <Text style={[styles.bodyText, { color: colors.icon }]}>
              {NOTIFICATIONS_SCREEN.examplesDescription}
            </Text>
            {NOTIFICATIONS_SCREEN.notifications.map((notification, index) => (
              <Animated.View key={notification.id} style={cardAnimatedStyles[index]}>
                <View
                  testID={`onboarding-notifications-example-${notification.id}`}
                  style={[
                    styles.notificationCard,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View
                      accessible={false}
                      style={[styles.iconTile, { borderColor: colors.inputBorder }]}
                    >
                      <Ionicons
                        name="notifications-outline"
                        size={20}
                        color={colors.icon}
                        accessible={false}
                      />
                    </View>
                    <View style={styles.cardHeaderText}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        {notification.title}
                      </Text>
                      <Text style={[styles.metadata, { color: colors.icon }]}>
                        {notification.timestamp}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.bodyText, { color: colors.text }]}>
                    {notification.message}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </View>
          <View testID="onboarding-notifications-footer" style={styles.footer}>
            <AnimatedButton
              testID="onboarding-notifications-enable"
              onPress={() => void handleEnable()}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Enable notifications"
              accessibilityState={{ disabled: isLoading, busy: isLoading }}
              style={styles.action}
            >
              <View
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: isLoading ? colors.inputBorder : colors.primaryButton,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    { color: isLoading ? colors.icon : "#FFFFFF" },
                  ]}
                >
                  {isLoading ? "Enabling…" : "Enable notifications"}
                </Text>
              </View>
            </AnimatedButton>
            <Pressable
              testID="onboarding-notifications-skip"
              onPress={handleSkip}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Skip notifications"
              accessibilityState={{ disabled: isLoading, busy: isLoading }}
              style={({ pressed }) => [
                styles.skipButton,
                {
                  backgroundColor: pressed ? colors.inputBorder : colors.inputBackground,
                  borderColor: colors.inputBorder,
                  opacity: isLoading ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.skipText, { color: colors.text }]}>Skip</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    flexShrink: 1,
  },
  bodyText: {
    fontSize: 16,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    flexShrink: 1,
  },
  examplesSection: { gap: 12 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  notificationCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  cardHeaderText: {
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  iconTile: {
    minWidth: 40,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  metadata: {
    fontSize: 14,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    flexShrink: 1,
  },
  skipButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "stretch",
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    flexShrink: 1,
    alignSelf: "stretch",
    textAlign: "center",
  },
  footer: { gap: 12 },
  action: { marginTop: 8 },
  primaryButton: {
    minHeight: 56,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    alignSelf: "stretch",
    textAlign: "center",
    flexShrink: 1,
  },
});
