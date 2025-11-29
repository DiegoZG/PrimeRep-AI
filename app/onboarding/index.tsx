import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useOnboardingStyles } from "./styles";

const OnboardingFirstScreen = () => {
  const [firstName, setFirstName] = useState("");
  const router = useRouter();
  const styles = useOnboardingStyles();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const handleNext = () => {
    if (firstName.trim()) {
      router.push("/onboarding/final");
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <ThemedView style={styles.container}>
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
              <View style={styles.content}>
                <Text style={styles.question}>
                  What&apos;s your first name?
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your first name"
                  placeholderTextColor={colors.placeholder}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoFocus
                  autoCapitalize="words"
                  textContentType="givenName"
                />
              </View>
            </ScrollView>

            {/* Bottom Button */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  !firstName.trim() && { opacity: 0.5 },
                ]}
                onPress={handleNext}
                disabled={!firstName.trim()}
              >
                <Text style={styles.primaryButtonText}>NEXT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </ThemedView>
  );
};

export default OnboardingFirstScreen;
