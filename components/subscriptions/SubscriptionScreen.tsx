import { Ionicons } from "@expo/vector-icons";
import { Href, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WorkoutText as Text } from "@/components/workout/WorkoutText";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSubscription } from "@/utils/subscriptionContext";

function dateLabel(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;
}

export function SubscriptionScreen({ paywall = false }: { paywall?: boolean }) {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { snapshot, plans, pending, busy, ready, sdkReady, canPurchase, canClearPending, error, notice, refresh, loadPlans, purchase, restore, manage, clearPending } = useSubscription();
  const [selected, setSelected] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { void refresh(Boolean(pending)); }, [refresh, pending]));
  useEffect(() => { if (sdkReady && snapshot?.flags.subscriptions_purchases_enabled) void loadPlans(); }, [sdkReady, snapshot?.flags.subscriptions_purchases_enabled, loadPlans]);
  const plan = plans.find((choice) => choice.id === selected) ?? plans.find((choice) => choice.term === "month") ?? plans[0];
  const close = () => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)" as Href); };
  const status = snapshot?.access_source === "transition" ? "Transition access" : snapshot?.has_premium ? snapshot.billing_status === "trial" ? "Free trial" : "Premium active"
    : snapshot?.billing_status === "expired" ? "Subscription ended" : snapshot?.verification_status === "unavailable" ? "Verification unavailable" : "Subscription";
  const accessDate = dateLabel(snapshot?.access_expires_at);
  const actionStyle = { minHeight: 48, borderRadius: 12, padding: 12, alignItems: "center" as const, justifyContent: "center" as const };
  const managementUrl = snapshot?.management_url;
  const openManagement = async () => {
    if (sdkReady) await manage();
    else if (managementUrl?.startsWith("https://")) await Linking.openURL(managementUrl);
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 8, gap: 8 }}>
      <Text accessibilityRole="header" style={{ flex: 1, fontSize: 24, fontWeight: "700" }}>{paywall ? "PrimeRep Premium" : "Subscription"}</Text>
      <Pressable testID="subscription-close" accessibilityRole="button" accessibilityLabel="Close subscription" onPress={close} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
    </View>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }}>
      {paywall ? <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 26, fontWeight: "700" }}>Your next chapter of training</Text>
        <Text style={{ color: colors.icon, fontSize: 16 }}>Personal workouts, flexible programming, and guidance that moves with you.</Text>
        {["Generate and adapt your workouts", "Start new training sessions", "Build personal programs", "Get AI exercise and Coach guidance"].map((benefit) => <View key={benefit} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Ionicons name="checkmark" size={20} color={colors.primaryButton} accessible={false} /><Text style={{ flex: 1, fontSize: 15 }}>{benefit}</Text></View>)}
      </View> : null}
      {!ready ? <ActivityIndicator accessibilityLabel="Loading subscription" color={colors.primaryButton} /> : null}
      {(snapshot?.has_premium || snapshot?.access_source === "transition" || snapshot?.billing_status === "expired") ? <View style={{ gap: 6, padding: 16, borderRadius: 16, backgroundColor: colors.inputBackground }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>{status}</Text>
        {accessDate ? <Text style={{ color: colors.icon }}>{snapshot?.access_source === "transition" ? "Available until" : snapshot?.will_renew ? "Renews" : "Access until"} {accessDate}</Text> : null}
        {snapshot?.billing_status === "grace" ? <Text style={{ color: colors.icon }}>Apple is resolving a billing issue. Your verified access remains available.</Text> : null}
      </View> : null}
      {pending ? <View testID="subscription-pending" accessibilityLiveRegion="polite" style={{ gap: 6, padding: 16, borderRadius: 16, backgroundColor: colors.inputBackground }}>
        <Text style={{ fontWeight: "600" }}>{pending.phase === "pending" ? "Awaiting Apple approval" : "Purchase received. Verifying access."}</Text>
        <Text style={{ color: colors.icon }}>You can keep using your saved data while we check your subscription.</Text>
        {canClearPending ? <Pressable testID="subscription-clear-pending" accessibilityRole="button" disabled={busy} onPress={() => Alert.alert("Clear purchase notice?", "No active subscription was found during verification. Try Restore Purchases first if you paid. Clearing this notice does not cancel Apple billing.", [{ text: "Cancel", style: "cancel" }, { text: "Clear notice", onPress: () => void clearPending() }])} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.primaryButton, fontWeight: "600" }}>Clear pending purchase notice</Text></Pressable> : null}
      </View> : null}
      {notice ? <Text accessibilityLiveRegion="polite">{notice}</Text> : null}
      {error ? <Text testID="subscription-error" accessibilityRole="alert" style={{ color: colors.icon }}>{error}</Text> : null}
      {snapshot?.flags.subscriptions_purchases_enabled && !snapshot.has_premium && !pending ? <View style={{ gap: 12 }}>
        {plans.map((choice) => <Pressable testID={`subscription-plan-${choice.term}`} key={choice.id} accessibilityRole="radio" accessibilityLabel={`${choice.term === "month" ? "Monthly" : "Annual"}, ${choice.price} per ${choice.term}`} accessibilityState={{ selected: plan?.id === choice.id, disabled: busy }} disabled={busy} onPress={() => setSelected(choice.id)}
          style={{ padding: 16, minHeight: 64, borderRadius: 14, borderWidth: plan?.id === choice.id ? 2 : 1, borderColor: plan?.id === choice.id ? colors.primaryButton : colors.inputBorder, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}><Text style={{ flex: 1, fontWeight: "600", fontSize: 17 }}>{choice.term === "month" ? "Monthly" : "Annual"}</Text><Text style={{ fontWeight: "700", fontSize: 18 }}>{choice.price}/{choice.term}</Text></View>
          {choice.trialDays ? <Text style={{ color: colors.icon }}>{choice.trialDays}-day free trial, then {choice.price} per {choice.term}</Text> : <Text style={{ color: colors.icon }}>{choice.term === "year" ? "Full annual charge" : "Billed monthly"}</Text>}
        </Pressable>)}
        {plan ? <>
          <Pressable testID="subscription-purchase" accessibilityRole="button" accessibilityLabel={plan.trialDays ? `Start ${plan.trialDays}-day trial` : "Subscribe"} accessibilityState={{ disabled: !canPurchase, busy }} disabled={!canPurchase} onPress={() => void purchase(plan)} style={[actionStyle, { backgroundColor: colors.primaryButton, opacity: canPurchase ? 1 : 0.5 }]}><Text style={{ fontWeight: "700", color: "#FFFFFF" }}>{busy ? "Please wait…" : plan.trialDays ? `Start ${plan.trialDays}-day trial` : "Subscribe"}</Text></Pressable>
          <Text style={{ fontSize: 13, color: colors.icon }}>{plan.trialDays ? `After the trial, ${plan.price} is charged per ${plan.term}. ` : `${plan.price} is charged per ${plan.term}. `}Renews automatically unless cancelled in Apple subscription settings.</Text>
        </> : <Text style={{ color: colors.icon }}>{sdkReady ? "Plans are not available yet. Try again shortly." : "Purchases are available in a configured iPhone app build."}</Text>}
      </View> : null}
      <View style={{ gap: 8 }}>
        <Pressable testID="subscription-retry" accessibilityRole="button" disabled={busy} onPress={() => { void refresh(true); if (!pending) void loadPlans(); }} style={[actionStyle, { borderWidth: 1, borderColor: colors.inputBorder }]}><Text style={{ fontWeight: "600" }}>Check subscription</Text></Pressable>
        <Pressable testID="subscription-restore" accessibilityRole="button" accessibilityState={{ disabled: busy || !sdkReady }} disabled={busy || !sdkReady} onPress={() => void restore()} style={[actionStyle, { opacity: sdkReady ? 1 : 0.5 }]}><Text style={{ color: colors.primaryButton, fontWeight: "600" }}>Restore Purchases</Text></Pressable>
        {sdkReady || managementUrl ? <Pressable testID="subscription-manage" accessibilityRole="button" disabled={busy} onPress={() => void openManagement().catch(() => undefined)} style={actionStyle}><Text style={{ color: colors.primaryButton, fontWeight: "600" }}>Manage Subscription</Text></Pressable> : null}
      </View>
      <Text style={{ fontSize: 13, color: colors.icon }}>Your saved workouts, history, and account tools stay accessible after a subscription ends.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pressable accessibilityRole="link" onPress={() => router.push("/legal/terms" as Href)} style={[actionStyle, { flex: 1 }]}><Text style={{ color: colors.primaryButton }}>Terms</Text></Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push("/legal/privacy" as Href)} style={[actionStyle, { flex: 1 }]}><Text style={{ color: colors.primaryButton }}>Privacy</Text></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
