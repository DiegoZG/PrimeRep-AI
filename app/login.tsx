import { AuthContext } from "@/utils/authContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useContext, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
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
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Welcome back
        </ThemedText>
        <ThemedText type="default" style={styles.subtitle}>
          Enter your details to continue
        </ThemedText>
        {passwordReset === "success" ? (
          <ThemedText accessibilityRole="alert" style={[styles.successMessage, { color: colors.primaryButton }]}>Your password was updated. Sign in with your new password.</ThemedText>
        ) : null}

        <View style={styles.inputContainer}>
          <View style={styles.inputWithIconContainer}>
            <AnimatedInput
              testID="email-input"
              placeholder="Email"
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
              testID="password-input"
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
              accessibilityState={{ disabled: isSubmitting }}
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              style={styles.eyeIcon}
              disabled={isSubmitting}
            >
              <Ionicons
                name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.placeholder}
              />
            </Pressable>
          </View>

          <Pressable
            testID="forgot-password-link"
            accessibilityRole="button"
            accessibilityLabel="Reset forgotten password"
            accessibilityState={{ disabled: isSubmitting }}
            onPress={() => router.push("/forgot-password")}
            style={styles.forgotPasswordContainer}
            disabled={isSubmitting}
          >
            <ThemedText type="link" style={styles.forgotPassword}>
              Forgot password?
            </ThemedText>
          </Pressable>
        </View>

        {errorMessage && (
          <ThemedText style={[styles.errorText, { color: "#FF3B30" }]}>
            {errorMessage}
          </ThemedText>
        )}

        <AnimatedButton
          testID="login-button"
          accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
          onPress={handleLogin}
          disabled={isSubmitting}
          style={[
            styles.loginButton,
            { backgroundColor: colors.primaryButton },
            isSubmitting && styles.loginButtonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginButtonText}>LOGIN</Text>
          )}
        </AnimatedButton>

        <View style={styles.footer}>
          <ThemedText type="default" style={styles.footerText}>
            Don{"'"}t have an account?{" "}
          </ThemedText>
          <Pressable
            onPress={() => router.push("/onboarding")}
            disabled={isSubmitting}
            accessibilityState={{ disabled: isSubmitting }}
          >
            <ThemedText
              type="link"
              style={[styles.signUpLink, { color: colors.primaryButton }]}
            >
              Sign up
            </ThemedText>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push("/onboarding")}
          disabled={isSubmitting}
          accessibilityState={{ disabled: isSubmitting }}
          style={styles.backToOnboardingContainer}
        >
          <ThemedText
            type="link"
            style={[styles.backToOnboarding, { color: colors.primaryButton }]}
          >
            Go back to onboarding
          </ThemedText>
        </Pressable>
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
  successMessage: {
    marginTop: -16,
    marginBottom: 20,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
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
  forgotPasswordContainer: {
    alignItems: "flex-end",
    marginTop: -8,
    marginBottom: 8,
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
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
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
  signUpLink: {
    fontSize: 14,
    fontWeight: "600",
  },
  backToOnboardingContainer: {
    marginTop: 4,
    alignItems: "center",
  },
  backToOnboarding: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default LoginScreen;
