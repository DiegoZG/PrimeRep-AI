import { Stack, useRouter } from "expo-router";
import React, { useContext, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedButton } from "@/components/animated-button";
import { AnimatedCard } from "@/components/animated-card";
import { AnimatedInput } from "@/components/animated-input";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import { OnboardingContext } from "@/utils/onboardingContext";
import { useOnboardingStyles } from "@/features/onboarding/styles";

const OnboardingFirstScreen = () => {
  const { data, updateField } = useContext(OnboardingContext);
  const [preferredName, setPreferredName] = useState(data.preferredName || "");
  const router = useRouter();
  const styles = useOnboardingStyles();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();
  const insets = useSafeAreaInsets();

  const handleNext = () => {
    if (preferredName.trim()) {
      updateField("preferredName", preferredName.trim());
      router.push("/onboarding/welcome");
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const screenAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerRight: () => null }} />
      <Animated.View style={[styles.keyboardAvoidingView, screenAnimatedStyle]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
          <View style={styles.keyboardAvoidingView}>
            <ScrollView
              style={{ flex: 1 }}
              testID="onboarding-name-scroll"
              contentContainerStyle={[
                styles.scrollContent,
                { paddingTop: 24, paddingBottom: Math.max(24, insets.bottom + 12) },
              ]}
              contentInsetAdjustmentBehavior="automatic"
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Content */}
              <AnimatedCard delay={100}>
                <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
                  <View style={styles.content}>
                    <Text style={styles.question}>
                      What&apos;s your first name?
                    </Text>
                    <AnimatedInput
                      authPresentation
                      accessibilityLabel="First name"
                      testID="onboarding-name-input"
                      style={styles.input}
                      placeholder="Enter your first name"
                      value={preferredName}
                      onChangeText={setPreferredName}
                      autoFocus
                      autoCapitalize="words"
                      textContentType="givenName"
                    />
                  </View>
                </TouchableWithoutFeedback>
              </AnimatedCard>
              <View style={[styles.buttonContainer, { marginTop: 12, paddingBottom: 0 }]}>
                <AnimatedButton
                  onPress={handleNext}
                  disabled={!preferredName.trim()}
                  accessibilityState={{ disabled: !preferredName.trim() }}
                  accessibilityRole="button"
                  accessibilityLabel="Next"
                  testID="onboarding-name-next"
                >
                  <View
                    style={[
                      styles.primaryButton,
                      { minHeight: 56 },
                      !preferredName.trim() && { opacity: 0.5 },
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>NEXT</Text>
                  </View>
                </AnimatedButton>

                <Pressable
                  testID="onboarding-name-skip"
                  accessibilityRole="button"
                  accessibilityLabel="Skip"
                  onPress={() => router.push("/onboarding/final")}
                  style={({ pressed }) => ({
                    marginTop: 12,
                    minHeight: 44,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.inputBorder,
                    backgroundColor: pressed ? colors.inputBackground : "transparent",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <ThemedText style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
                    Skip
                  </ThemedText>
                </Pressable>

                {/* Login footer */}
                <View
                  style={{
                    marginTop: 16,
                    flexDirection: "row",
                    flexWrap: "wrap",
                    columnGap: 8,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <ThemedText type="default" style={{ fontSize: 14, maxWidth: "100%", flexShrink: 1, textAlign: "center" }}>
                    Already have an account?{" "}
                  </ThemedText>
                  <Pressable
                    testID="onboarding-login-link"
                    accessibilityRole="button"
                    accessibilityLabel="Log in"
                    onPress={() => router.push("/login")}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      minWidth: 44,
                      maxWidth: "100%",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      backgroundColor: pressed ? colors.inputBackground : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <ThemedText
                      type="link"
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: colors.text,
                      }}
                    >
                      Log in
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </ThemedView>
  );
};

export default OnboardingFirstScreen;
