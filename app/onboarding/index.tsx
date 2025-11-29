import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { AnimatedButton } from "@/components/animated-button";
import { AnimatedCard } from "@/components/animated-card";
import { AnimatedInput } from "@/components/animated-input";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import { useOnboardingStyles } from "./styles";

const OnboardingFirstScreen = () => {
  const [firstName, setFirstName] = useState("");
  const router = useRouter();
  const styles = useOnboardingStyles();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();

  const handleNext = () => {
    if (firstName.trim()) {
      router.push("/onboarding/final");
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
      <Animated.View style={[styles.keyboardAvoidingView, screenAnimatedStyle]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.keyboardAvoidingView}>
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Content */}
                <AnimatedCard delay={100}>
                  <View style={styles.content}>
                    <Text style={styles.question}>
                      What&apos;s your first name?
                    </Text>
                    <AnimatedInput
                      style={styles.input}
                      placeholder="Enter your first name"
                      value={firstName}
                      onChangeText={setFirstName}
                      autoFocus
                      autoCapitalize="words"
                      textContentType="givenName"
                    />
                  </View>
                </AnimatedCard>
              </ScrollView>

              {/* Bottom Button */}
              <View style={styles.buttonContainer}>
                <AnimatedButton
                  onPress={handleNext}
                  disabled={!firstName.trim()}
                >
                  <View
                    style={[
                      styles.primaryButton,
                      !firstName.trim() && { opacity: 0.5 },
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>NEXT</Text>
                  </View>
                </AnimatedButton>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Animated.View>
    </ThemedView>
  );
};

export default OnboardingFirstScreen;
