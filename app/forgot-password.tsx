import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedButton } from "@/components/animated-button";
import { AnimatedInput } from "@/components/animated-input";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { requestPasswordReset } from "@/services/authService";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setStatus("submitting");
    try {
      await requestPasswordReset(normalized);
      setStatus("sent");
    } catch {
      setStatus("idle");
      setError("We couldn't send the request. Check your connection and try again.");
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to login" onPress={() => router.replace("/login")} style={styles.backButton}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {status === "sent" ? (
          <View testID="password-reset-requested" style={styles.centered}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.primaryButton}18` }]}><Ionicons name="mail-open-outline" size={36} color={colors.primaryButton} /></View>
            <ThemedText type="title" style={styles.title}>Check your email</ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.placeholder }]}>If an account exists for that email, we sent a password reset link.</ThemedText>
            <AnimatedButton testID="password-reset-return-login" accessibilityLabel="Return to login" onPress={() => router.replace("/login")} style={[styles.primaryButton, { backgroundColor: colors.primaryButton }]}>
              <ThemedText style={styles.primaryText}>Return to login</ThemedText>
            </AnimatedButton>
          </View>
        ) : (
          <View>
            <ThemedText type="title" style={styles.title}>Reset your password</ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.placeholder }]}>Enter your email and we’ll send you a secure reset link.</ThemedText>
            <AnimatedInput testID="password-reset-email" value={email} onChangeText={(value) => { setEmail(value); setError(null); }} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={status !== "submitting"} style={styles.input} />
            {error ? <ThemedText testID="password-reset-request-error" accessibilityRole="alert" style={styles.error}>{error}</ThemedText> : null}
            <AnimatedButton testID="password-reset-request-submit" accessibilityLabel="Send reset link" accessibilityState={{ disabled: status === "submitting", busy: status === "submitting" }} onPress={() => void submit()} disabled={status === "submitting"} style={[styles.primaryButton, { backgroundColor: colors.primaryButton }, status === "submitting" && styles.disabled]}>
              {status === "submitting" ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.primaryText}>Send reset link</ThemedText>}
            </AnimatedButton>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, backButton: { width: 44, height: 44, marginLeft: 14, alignItems: "center", justifyContent: "center" }, content: { flex: 1, justifyContent: "center", paddingHorizontal: 28, paddingBottom: 72 }, centered: { alignItems: "center" }, iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 22 }, title: { fontSize: 30, lineHeight: 36, textAlign: "center" }, subtitle: { fontSize: 16, lineHeight: 23, textAlign: "center", marginTop: 10, marginBottom: 28 }, input: { width: "100%" }, error: { color: "#D92D20", marginTop: 10, lineHeight: 20 }, primaryButton: { width: "100%", minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 20 }, primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" }, disabled: { opacity: 0.55 },
});
