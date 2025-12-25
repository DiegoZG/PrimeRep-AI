import { useRouter } from "expo-router";
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

import { AnimatedButton } from "@/components/animated-button";
import { AnimatedCard } from "@/components/animated-card";
import { AnimatedInput } from "@/components/animated-input";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import { OnboardingContext } from "@/utils/onboardingContext";
import { useOnboardingStyles } from "./styles";

const OnboardingFirstScreen = () => {
  const { data, updateField } = useContext(OnboardingContext);
  const [preferredName, setPreferredName] = useState(data.preferredName || "");
  const router = useRouter();
  const styles = useOnboardingStyles();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();

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
                      value={preferredName}
                      onChangeText={setPreferredName}
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
                  disabled={!preferredName.trim()}
                >
                  <View
                    style={[
                      styles.primaryButton,
                      !preferredName.trim() && { opacity: 0.5 },
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>NEXT</Text>
                  </View>
                </AnimatedButton>

                {/* Login footer */}
                <View
                  style={{
                    marginTop: 16,
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <ThemedText type="default" style={{ fontSize: 14 }}>
                    Already have an account?{" "}
                  </ThemedText>
                  <Pressable onPress={() => router.push("/login")}>
                    <ThemedText
                      type="link"
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: colors.primaryButton,
                      }}
                    >
                      Log in
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Animated.View>
    </ThemedView>
  );
};

export default OnboardingFirstScreen;
