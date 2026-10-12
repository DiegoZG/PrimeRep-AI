import { AuthContext } from "@/utils/authContext";
import { OnboardingContext } from "@/utils/onboardingContext";
import { useRouter } from "expo-router";
import React, { useContext, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedButton } from "@/components/animated-button";
import { AnimatedInput } from "@/components/animated-input";
import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/constants/legal";

const SignUpScreen = () => {
  const { signUp } = useContext(AuthContext);
  const { getOnboardingData, resetOnboarding } =
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

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters");
      return;
    }

    if (!hasAcceptedTerms) {
      setErrorMessage("Accept the Terms of Service and acknowledge the Privacy Policy to continue.");
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
        legalAcceptance: {
          accepted: true as const,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
        },
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
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          testID="signup-scroll"
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ThemedView style={styles.content}>
              <ThemedText type="title" style={styles.title}>
                Create account
              </ThemedText>
              <ThemedText type="default" style={[styles.subtitle, { color: colors.icon }]}>
                Join PrimeRep AI and start your journey
              </ThemedText>

              <View style={styles.inputContainer}>
                <View style={styles.field}>
                  <ThemedText style={styles.fieldLabel}>Email</ThemedText>
                  <AnimatedInput
                    testID="email-input"
                    authPresentation
                    accessibilityLabel="Email"
                    placeholder="Email address"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    editable={!isSubmitting}
                    style={styles.input}
                  />
                </View>

                <View style={styles.field}>
                  <ThemedText style={styles.fieldLabel}>Password</ThemedText>
                  <View style={styles.passwordContainer}>
                    <AnimatedInput
                      testID="password-input"
                      authPresentation
                      accessibilityLabel="Password"
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
                      ]}
                    />
                    <Pressable
                      testID="password-visibility-button"
                      accessibilityRole="button"
                      accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
                      accessibilityState={{ disabled: isSubmitting }}
                      onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                      style={({ pressed }) => [styles.eyeIcon, pressed && { backgroundColor: colors.inputBorder }]}
                      disabled={isSubmitting}
                    >
                      <Ionicons
                        name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={colors.icon}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.termsContainer}>
                <Pressable
                  testID="legal-acceptance-checkbox"
                  style={({ pressed }) => [styles.checkboxButton, pressed && { backgroundColor: colors.inputBackground }]}
                  onPress={() => setHasAcceptedTerms(!hasAcceptedTerms)}
                  disabled={isSubmitting}
                  accessibilityRole="checkbox"
                  accessibilityLabel="Accept Terms of Service and acknowledge Privacy Policy"
                  accessibilityState={{ checked: hasAcceptedTerms, disabled: isSubmitting }}
                >
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: colors.icon },
                      hasAcceptedTerms && { backgroundColor: colors.text, borderColor: colors.text },
                    ]}
                  >
                    {hasAcceptedTerms && (
                      <Ionicons name="checkmark" size={16} color={colors.background} />
                    )}
                  </View>
                </Pressable>
                <View style={styles.termsTextContainer}>
                  <ThemedText type="default" style={styles.termsText}>
                    I agree to the{" "}
                  </ThemedText>
                  <Pressable
                    testID="signup-terms-link"
                    accessibilityRole="link"
                    accessibilityLabel="Open Terms of Service"
                    accessibilityState={{ disabled: isSubmitting }}
                    style={({ pressed }) => [styles.legalAction, pressed && { backgroundColor: colors.inputBackground }]}
                    onPress={() => router.push("/legal/terms")}
                    disabled={isSubmitting}
                  >
                    <ThemedText
                      style={[styles.termsLink, { color: colors.text }]}
                    >
                      Terms of Service
                    </ThemedText>
                  </Pressable>
                  <ThemedText type="default" style={styles.termsText}> and acknowledge the </ThemedText>
                  <Pressable
                    testID="signup-privacy-link"
                    accessibilityRole="link"
                    accessibilityLabel="Open Privacy Policy"
                    accessibilityState={{ disabled: isSubmitting }}
                    style={({ pressed }) => [styles.legalAction, pressed && { backgroundColor: colors.inputBackground }]}
                    onPress={() => router.push("/legal/privacy")}
                    disabled={isSubmitting}
                  >
                    <ThemedText style={[styles.termsLink, { color: colors.text }]}>Privacy Policy</ThemedText>
                  </Pressable>
                </View>
              </View>

              {errorMessage && (
                <ThemedText testID="signup-error" accessibilityRole="alert" style={[styles.errorText, { color: colorScheme === "dark" ? "#FF8B82" : "#B42318" }]}>
                  {errorMessage}
                </ThemedText>
              )}

              <AnimatedButton
                testID="signup-button"
                accessibilityRole="button"
                accessibilityLabel="Sign up"
                onPress={handleSignUp}
                disabled={isSubmitting}
                accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
                style={[
                  styles.signUpButton,
                  { backgroundColor: colors.primaryButton },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.signUpButtonText}>Sign up</ThemedText>
                )}
              </AnimatedButton>

              <View style={styles.footer}>
                <ThemedText type="default" style={styles.footerText}>
                  Already have an account?{" "}
                </ThemedText>
                <Pressable
                  testID="signup-login-link"
                  accessibilityRole="link"
                  accessibilityLabel="Log in"
                  onPress={() => router.push("/login")}
                  disabled={isSubmitting}
                  accessibilityState={{ disabled: isSubmitting }}
                  style={({ pressed }) => [styles.tertiaryAction, pressed && { backgroundColor: colors.inputBackground }]}
                >
                  <ThemedText
                    style={[styles.logInLink, { color: colors.text }]}
                  >
                    Log in
                  </ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  title: {
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    marginBottom: 32,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    minHeight: 56,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 60,
  },
  eyeIcon: {
    position: "absolute",
    right: 4,
    top: 0,
    bottom: 0,
    width: 52,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  checkboxButton: {
    width: 44,
    height: 44,
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  termsTextContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  termsText: {
    fontSize: 14,
    maxWidth: "100%",
    flexShrink: 1,
  },
  termsLink: {
    fontSize: 14,
    textDecorationLine: "underline",
    flexShrink: 1,
  },
  legalAction: {
    minHeight: 44,
    minWidth: 44,
    maxWidth: "100%",
    flexShrink: 1,
    justifyContent: "center",
    borderRadius: 10,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  signUpButton: {
    width: "100%",
    minHeight: 52,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  signUpButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    columnGap: 4,
  },
  footerText: {
    fontSize: 14,
  },
  logInLink: {
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  tertiaryAction: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    justifyContent: "center",
    borderRadius: 10,
  },
});

export default SignUpScreen;
