import { AuthContext } from "@/utils/authContext";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedButton } from "@/components/animated-button";
import { AnimatedInput } from "@/components/animated-input";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { confirmPasswordReset } from "@/services/authService";
import { HttpError } from "@/services/httpClient";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = useMemo(() => Array.isArray(params.token) ? params.token[0] : params.token, [params.token]);
  const colors = Colors[useColorScheme() ?? "light"];
  const { isLoggedIn, logOut } = useContext(AuthContext);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "invalid">(token ? "idle" : "invalid");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web" && token && typeof window !== "undefined") {
      const scrubbedUrl = new URL(window.location.href);
      scrubbedUrl.searchParams.delete("token");
      window.history.replaceState(
        window.history.state,
        "",
        `${scrubbedUrl.pathname}${scrubbedUrl.search}${scrubbedUrl.hash}`,
      );
    }
  }, [token]);

  const submit = async () => {
    if (!token) { setStatus("invalid"); return; }
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    setError(null); setStatus("submitting");
    try {
      await confirmPasswordReset(token, password);
    } catch (requestError) {
      if (requestError instanceof HttpError && requestError.status === 400) {
        setStatus("invalid");
        return;
      }
      setStatus("idle");
      setError("We couldn't update your password. Check your connection and try again.");
      return;
    }
    if (isLoggedIn) {
      await logOut({ forceLocal: true }).catch(() => undefined);
    }
    setStatus("success");
  };

  const returnToLogin = () => {
    router.replace({ pathname: "/login", params: { passwordReset: "success" } });
  };

  if (status === "invalid" || status === "success") {
    const success = status === "success";
    return (
      <SafeAreaView testID={success ? "password-reset-success" : "password-reset-invalid"} style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.result}>
          <Ionicons name={success ? "checkmark-circle-outline" : "alert-circle-outline"} size={52} color={success ? colors.primaryButton : "#D92D20"} />
          <ThemedText type="title" style={styles.title}>{success ? "Password updated" : "Link unavailable"}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.placeholder }]}>{success ? "Your password is changed. Sign in again on this and any other device." : "This reset link is invalid, expired, or already used."}</ThemedText>
          <AnimatedButton testID={success ? "password-reset-login" : "password-reset-new-link"} accessibilityLabel={success ? "Go to login" : "Request a new reset link"} onPress={() => success ? returnToLogin() : router.replace("/forgot-password")} style={[styles.primaryButton, { backgroundColor: colors.primaryButton }]}>
            <ThemedText style={styles.primaryText}>{success ? "Go to login" : "Request a new link"}</ThemedText>
          </AnimatedButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close password reset" onPress={() => router.replace("/login")} style={styles.backButton}><Ionicons name="close" size={26} color={colors.text} /></Pressable>
      <KeyboardAvoidingView style={styles.form} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ThemedText type="title" style={styles.title}>Choose a new password</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.placeholder }]}>Use at least 8 characters, then sign in again.</ThemedText>
        <View style={styles.inputWrap}>
          <AnimatedInput testID="password-reset-new-password" value={password} onChangeText={(value) => { setPassword(value); setError(null); }} placeholder="New password" secureTextEntry={!visible} autoCapitalize="none" autoComplete="password-new" editable={status !== "submitting"} style={styles.input} />
          <Pressable accessibilityRole="button" accessibilityLabel={visible ? "Hide password" : "Show password"} onPress={() => setVisible((value) => !value)} style={styles.eye}><Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={22} color={colors.placeholder} /></Pressable>
        </View>
        <AnimatedInput testID="password-reset-confirm-password" value={confirmation} onChangeText={(value) => { setConfirmation(value); setError(null); }} placeholder="Confirm new password" secureTextEntry={!visible} autoCapitalize="none" autoComplete="password-new" editable={status !== "submitting"} style={styles.input} />
        {error ? <ThemedText accessibilityRole="alert" style={styles.error}>{error}</ThemedText> : null}
        <AnimatedButton testID="password-reset-confirm-submit" accessibilityLabel="Update password" accessibilityState={{ disabled: status === "submitting", busy: status === "submitting" }} onPress={() => void submit()} disabled={status === "submitting"} style={[styles.primaryButton, { backgroundColor: colors.primaryButton }, status === "submitting" && styles.disabled]}>
          {status === "submitting" ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText style={styles.primaryText}>Update password</ThemedText>}
        </AnimatedButton>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, backButton: { width: 44, height: 44, marginLeft: 14, alignItems: "center", justifyContent: "center" }, form: { flex: 1, justifyContent: "center", paddingHorizontal: 28, paddingBottom: 72 }, result: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28 }, title: { fontSize: 30, lineHeight: 36, textAlign: "center", marginTop: 14 }, subtitle: { fontSize: 16, lineHeight: 23, textAlign: "center", marginTop: 10, marginBottom: 28 }, inputWrap: { position: "relative", marginBottom: 14 }, input: { width: "100%" }, eye: { position: "absolute", right: 8, top: 5, width: 44, height: 44, alignItems: "center", justifyContent: "center" }, error: { color: "#D92D20", marginTop: 10 }, primaryButton: { width: "100%", minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 20 }, primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" }, disabled: { opacity: 0.55 },
});
