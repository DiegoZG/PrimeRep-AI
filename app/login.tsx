import { AuthContext } from "@/utils/authContext";
import { useLocalSearchParams, useRouter } from "expo-router";
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

const LoginScreen = () => {
  const { logIn } = useContext(AuthContext);
  const router = useRouter();
  const { passwordReset } = useLocalSearchParams<{ passwordReset?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    // Basic validation
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

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await logIn({ email: email.trim(), password });
      // Navigation will be handled automatically by _layout.tsx based on hasCompletedOnboarding
    } catch (error: any) {
      setErrorMessage(error?.message || "Invalid email or password");
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
          testID="login-scroll"
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ThemedView style={styles.content}>
              <ThemedText type="title" style={styles.title}>
                Welcome back
              </ThemedText>
              <ThemedText type="default" style={[styles.subtitle, { color: colors.icon }]}>
                Enter your details to continue
              </ThemedText>
              {passwordReset === "success" ? (
                <ThemedText testID="password-reset-success" accessibilityRole="alert" style={[styles.successMessage, { color: colors.text }]}>Your password was updated. Sign in with your new password.</ThemedText>
              ) : null}

              <View style={styles.inputContainer}>
                <View style={styles.field}>
                  <ThemedText style={styles.fieldLabel}>Email</ThemedText>
                  <AnimatedInput
                    testID="email-input"
                    authPresentation
                    accessibilityLabel="Email"
                    placeholder="Email"
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
                      autoComplete="password"
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

                <Pressable
                  testID="forgot-password-link"
                  accessibilityRole="button"
                  accessibilityLabel="Reset forgotten password"
                  accessibilityState={{ disabled: isSubmitting }}
                  onPress={() => router.push("/forgot-password")}
                  style={({ pressed }) => [styles.forgotPasswordContainer, pressed && { backgroundColor: colors.inputBackground }]}
                  disabled={isSubmitting}
                >
                  <ThemedText style={[styles.forgotPassword, { color: colors.icon }]}>
                    Forgot password?
                  </ThemedText>
                </Pressable>
              </View>

              {errorMessage && (
                <ThemedText testID="login-error" accessibilityRole="alert" style={[styles.errorText, { color: colorScheme === "dark" ? "#FF8B82" : "#B42318" }]}>
                  {errorMessage}
                </ThemedText>
              )}

              <AnimatedButton
                testID="login-button"
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
                onPress={handleLogin}
                disabled={isSubmitting}
                style={[
                  styles.loginButton,
                  { backgroundColor: colors.primaryButton },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.loginButtonText}>Sign in</ThemedText>
                )}
              </AnimatedButton>

              <View style={styles.footer}>
                <ThemedText type="default" style={styles.footerText}>
                  Don{"'"}t have an account?{" "}
                </ThemedText>
                <Pressable
                  testID="signup-link"
                  accessibilityRole="button"
                  accessibilityLabel="Sign up"
                  onPress={() => router.push("/onboarding")}
                  disabled={isSubmitting}
                  accessibilityState={{ disabled: isSubmitting }}
                  style={({ pressed }) => [styles.tertiaryAction, pressed && { backgroundColor: colors.inputBackground }]}
                >
                  <ThemedText
                    style={[styles.signUpLink, { color: colors.text }]}
                  >
                    Sign up
                  </ThemedText>
                </Pressable>
              </View>

              <Pressable
                testID="onboarding-return-link"
                accessibilityRole="button"
                accessibilityLabel="Go back to onboarding"
                onPress={() => router.push("/onboarding")}
                disabled={isSubmitting}
                accessibilityState={{ disabled: isSubmitting }}
                style={({ pressed }) => [styles.backToOnboardingContainer, pressed && { backgroundColor: colors.inputBackground }]}
              >
                <ThemedText
                  style={[styles.backToOnboarding, { color: colors.icon }]}
                >
                  Go back to onboarding
                </ThemedText>
              </Pressable>
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
  successMessage: {
    marginTop: -16,
    marginBottom: 20,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
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
  forgotPasswordContainer: {
    alignSelf: "flex-end",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  forgotPassword: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  loginButton: {
    width: "100%",
    minHeight: 52,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  loginButtonText: {
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
  signUpLink: {
    fontSize: 14,
    fontWeight: "600",
  },
  tertiaryAction: {
    minHeight: 44,
    paddingHorizontal: 8,
    justifyContent: "center",
    borderRadius: 10,
  },
  backToOnboardingContainer: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  backToOnboarding: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default LoginScreen;
