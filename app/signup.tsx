import { AuthContext } from "@/utils/authContext";
import { OnboardingContext } from "@/utils/onboardingContext";
import { useRouter } from "expo-router";
import React, { useContext, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedButton } from "@/components/animated-button";
import { AnimatedInput } from "@/components/animated-input";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

const SignUpScreen = () => {
  const { signUp } = useContext(AuthContext);
  const { getOnboardingData, resetOnboarding, data } =
    useContext(OnboardingContext);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignUp = async () => {
    // Validation
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password");
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage("Please enter a valid email address");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }

    if (!hasAcceptedTerms) {
      setErrorMessage("Please accept the Terms and Conditions");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Get onboarding snapshot from context
      const onboardingSnapshot = getOnboardingData();

      // Extract preferred_name from onboarding or fallback to email prefix
      const preferredName =
        onboardingSnapshot.preferredName?.trim() ||
        email.trim().split("@")[0] ||
        "";

      // Build signup payload
      const payload = {
        email: email.trim(),
        password,
        preferred_name: preferredName,
        last_name: onboardingSnapshot.lastName?.trim() || null,
        onboarding: onboardingSnapshot,
      };

      await signUp(payload);

      // Optionally reset onboarding data after successful signup
      resetOnboarding();

      // Navigation will be handled automatically by _layout.tsx based on hasCompletedOnboarding
    } catch (error: any) {
      setErrorMessage(
        error?.message || "Failed to create account. Please try again."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Create account
        </ThemedText>
        <ThemedText type="default" style={styles.subtitle}>
          Join PrimeRep AI and start your journey
        </ThemedText>

        <View style={styles.inputContainer}>
          <View style={styles.inputWithIconContainer}>
            <AnimatedInput
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isSubmitting}
              style={[styles.input, styles.inputWithLeftIcon]}
            />
            <View style={styles.leftIcon}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={colors.placeholder}
              />
            </View>
          </View>

          <View
            style={[styles.passwordContainer, styles.inputWithIconContainer]}
          >
            <AnimatedInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!isPasswordVisible}
              autoCapitalize="none"
              autoComplete="password-new"
              editable={!isSubmitting}
              style={[
                styles.input,
                styles.passwordInput,
                styles.inputWithLeftIcon,
              ]}
            />
            <View style={styles.leftIcon}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={colors.placeholder}
              />
            </View>
            <TouchableOpacity
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              style={styles.eyeIcon}
              disabled={isSubmitting}
            >
              <Ionicons
                name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.placeholder}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setHasAcceptedTerms(!hasAcceptedTerms)}
          style={styles.termsContainer}
          disabled={isSubmitting}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: hasAcceptedTerms }}
        >
          <View
            style={[
              styles.checkbox,
              hasAcceptedTerms && { backgroundColor: colors.primaryButton },
            ]}
          >
            {hasAcceptedTerms && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </View>
          <View style={styles.termsTextContainer}>
            <ThemedText type="default" style={styles.termsText}>
              I agree to the{" "}
            </ThemedText>
            <TouchableOpacity
              onPress={() => {
                // TODO: Open terms and conditions screen/modal
              }}
              disabled={isSubmitting}
            >
              <ThemedText
                type="link"
                style={[styles.termsLink, { color: colors.primaryButton }]}
              >
                Terms and Conditions
              </ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {errorMessage && (
          <ThemedText style={[styles.errorText, { color: "#FF3B30" }]}>
            {errorMessage}
          </ThemedText>
        )}

        <AnimatedButton
          onPress={handleSignUp}
          disabled={isSubmitting}
          style={[
            styles.signUpButton,
            { backgroundColor: colors.primaryButton },
            isSubmitting && styles.signUpButtonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.signUpButtonText}>SIGN UP</Text>
          )}
        </AnimatedButton>

        <View style={styles.footer}>
          <ThemedText type="default" style={styles.footerText}>
            Already have an account?{" "}
          </ThemedText>
          <TouchableOpacity
            onPress={() => router.push("/login")}
            disabled={isSubmitting}
          >
            <ThemedText
              type="link"
              style={[styles.logInLink, { color: colors.primaryButton }]}
            >
              Log in
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  title: {
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    marginBottom: 32,
    textAlign: "center",
    opacity: 0.7,
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  inputWithIconContainer: {
    position: "relative",
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 50,
  },
  inputWithLeftIcon: {
    paddingLeft: 48,
  },
  leftIcon: {
    position: "absolute",
    left: 18,
    top: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  eyeIcon: {
    position: "absolute",
    right: 16,
    top: 16,
    padding: 4,
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#E5E5E5",
    marginRight: 12,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  termsTextContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  termsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  termsLink: {
    fontSize: 14,
    lineHeight: 20,
    textDecorationLine: "underline",
  },
  errorText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  signUpButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
  signUpButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
  },
  logInLink: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default SignUpScreen;
