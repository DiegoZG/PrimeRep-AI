import { Ionicons } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import React, { useContext, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SubscriptionText as Text } from "@/components/subscriptions/SubscriptionOffer";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { accountRequestGuard } from "@/services/accountScope";
import { deleteAccount } from "@/services/userService";
import { pauseHealthExport, resumeHealthExport, waitForHealthExportIdle } from "@/services/health/exportSync";
import { AuthContext } from "@/utils/authContext";
import { NotificationsContext } from "@/utils/notificationsContext";
import { clearHealthExportAccount } from "@/utils/healthExportAccountCleanup";
import { clearPendingPurchaseForUser } from "@/utils/pendingPurchase";
import { clearPreWorkoutOrdersForUser } from "@/utils/preWorkoutOrderStore";
import { clearWorkoutLayoutForUser } from "@/utils/workoutLayoutPreference";
import { useSubscription } from "@/utils/subscriptionContext";

export default function OnboardingAccount() {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { user, token, logOut } = useContext(AuthContext);
  const { unregisterCurrentDevice } = useContext(NotificationsContext);
  const { sdkReady, busy: billingBusy, manage, error } = useSubscription();
  const [busy, setBusy] = useState(false);
  const mutation = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const signOut = async () => {
    if (mutation.current) return;
    const current = accountRequestGuard();
    mutation.current = true;
    setBusy(true);
    try {
      if (token) await unregisterCurrentDevice(token).catch(() => undefined);
      if (current()) await logOut();
    } catch { if (mounted.current && current()) Alert.alert("Could not sign out", "Please try again.");
    } finally { if (mounted.current && current()) { mutation.current = false; setBusy(false); } }
  };

  const confirmDelete = () => {
    if (!user || !token || mutation.current) return;
    const owner = user.id;
    const current = accountRequestGuard();
    Alert.alert("Delete account?", "This permanently deletes your account and workout data. Deleting PrimeRep does not cancel an Apple subscription; manage billing in Apple subscription settings. This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete account", style: "destructive", onPress: async () => {
        if (!mounted.current || !current() || mutation.current) return;
        mutation.current = true;
        setBusy(true);
        pauseHealthExport(owner);
        try { await deleteAccount(token); }
        catch {
          resumeHealthExport(owner);
          if (mounted.current && current()) { mutation.current = false; setBusy(false); Alert.alert("Could not delete account", "Please try again."); }
          return;
        }
        try {
          await Promise.all([clearPreWorkoutOrdersForUser(owner), clearWorkoutLayoutForUser(owner), clearPendingPurchaseForUser(owner)]);
          await waitForHealthExportIdle();
          await clearHealthExportAccount(owner);
        } catch { console.warn("Account deleted, but local workout or Health export cleanup was incomplete."); }
        if (current()) {
          try { await logOut({ forceLocal: true }); }
          catch { console.warn("Account deleted, but local token cleanup was incomplete."); }
        }
      } },
    ]);
  };

  return <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
    <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Account options</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close account options" disabled={busy || billingBusy} onPress={() => router.canGoBack() ? router.back() : router.replace("/onboarding-subscription" as Href)} style={styles.close}><Ionicons name="close" size={24} color={colors.text} accessible={false} /></Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.email, { color: colors.icon }]}>{user?.email}</Text>
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {([
        ["Manage subscription", "open-outline", () => void manage()],
        ["Download my data", "download-outline", () => router.push("/settings/export" as Href)],
        ["Terms", "document-text-outline", () => router.push("/legal/terms" as Href)],
        ["Privacy", "shield-checkmark-outline", () => router.push("/legal/privacy" as Href)],
        ["Sign out", "log-out-outline", () => void signOut()],
        ["Delete account", "trash-outline", confirmDelete],
      ] as const).map(([title, icon, action]) => <Pressable key={title} testID={`onboarding-account-${icon}`} accessibilityRole="button" accessibilityState={{ disabled: busy || billingBusy || (title === "Manage subscription" && !sdkReady) }} disabled={busy || billingBusy || (title === "Manage subscription" && !sdkReady)} onPress={action}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.inputBackground : "transparent", opacity: busy || billingBusy || (title === "Manage subscription" && !sdkReady) ? 0.5 : 1 }]}>
        <Ionicons name={icon} size={24} color={title === "Delete account" ? "#D32F2F" : colors.icon} accessible={false} />
        <Text style={[styles.rowText, title === "Delete account" && { color: "#D32F2F" }]}>{title}</Text>
      </Pressable>)}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20 },
  title: { flex: 1, minWidth: 0, fontSize: 24, fontWeight: "700" },
  close: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 8 },
  email: { fontSize: 15, marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 56, paddingVertical: 12, borderRadius: 12 },
  rowText: { flex: 1, minWidth: 0, fontSize: 17 },
});
