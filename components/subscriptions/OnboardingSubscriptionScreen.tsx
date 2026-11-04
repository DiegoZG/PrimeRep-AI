import { Ionicons } from "@expo/vector-icons";
import { Href, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSubscription } from "@/utils/subscriptionContext";
import { SubscriptionBenefits, SubscriptionCheckout, SubscriptionPlans, SubscriptionText as Text } from "./SubscriptionOffer";

export function OnboardingSubscriptionScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { fontScale } = useWindowDimensions();
  const inlineCheckout = fontScale >= 1.3;
  const { snapshot, plans, pending, busy, sdkReady, canPurchase, canClearPending, error, notice, refresh, loadPlans, purchase, restore, clearPending } = useSubscription();
  const [selected, setSelected] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const plan = plans.find(choice => choice.id === selected) ?? plans.find(choice => choice.term === "month") ?? plans[0];
  const verified = snapshot?.verification_status === "verified";
  const blocked = busy || restoring;

  useFocusEffect(useCallback(() => {
    let active = true;
    void (async () => {
      await refresh(true);
      if (!active) return;
      const checked = await refresh();
      // A GET already in flight before reconciliation may still contain unverified access.
      if (active && checked?.verification_status !== "verified") await refresh();
    })();
    return () => { active = false; };
  }, [refresh]));
  useEffect(() => { if (sdkReady && verified && snapshot?.flags.subscriptions_purchases_enabled) void loadPlans(); }, [sdkReady, verified, snapshot?.flags.subscriptions_purchases_enabled, loadPlans]);
  useEffect(() => { const listener = BackHandler.addEventListener("hardwareBackPress", () => true); return () => listener.remove(); }, []);

  const checkout = <View testID="onboarding-subscription-checkout" style={[styles.checkout, inlineCheckout && styles.inlineCheckout, { borderTopColor: colors.inputBorder, backgroundColor: colors.background }]}>
    {plan ? <SubscriptionCheckout plan={plan} disabled={blocked || !canPurchase || !verified || Boolean(pending)} busy={busy} onPurchase={() => void purchase(plan)} /> : null}
    <View style={styles.footerLinks}>
      <Pressable testID="subscription-restore" accessibilityRole="button" accessibilityLabel="Restore purchases" accessibilityState={{ disabled: blocked || !sdkReady, busy: restoring }} disabled={blocked || !sdkReady}
        onPress={() => { setRestoring(true); void restore().finally(() => setRestoring(false)); }} style={styles.link}>
        <Text style={[styles.linkText, { color: colors.primaryButton }]}>{restoring ? "Restoring…" : "Restore purchases"}</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.push("/legal/terms" as Href)} style={styles.link}><Text style={[styles.legalText, { color: colors.icon }]}>Terms</Text></Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.push("/legal/privacy" as Href)} style={styles.link}><Text style={[styles.legalText, { color: colors.icon }]}>Privacy</Text></Pressable>
    </View>
  </View>;

  return <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
    <View style={styles.header}>
      <Text style={styles.brand}>PrimeRep</Text>
      <Pressable testID="onboarding-account-options" accessibilityRole="button" accessibilityLabel="Account options" disabled={blocked} accessibilityState={{ disabled: blocked }}
        onPress={() => router.push("/onboarding-account" as Href)} style={[styles.account, { opacity: blocked ? 0.5 : 1 }]}>
        <Text style={[styles.accountText, { color: colors.icon }]}>Account options</Text><Ionicons name="ellipsis-horizontal" size={20} color={colors.icon} accessible={false} />
      </Pressable>
    </View>
    <ScrollView testID="onboarding-subscription-scroll" style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text accessibilityRole="header" allowFontScaling={false} style={[styles.title, { fontSize: 30 * Math.min(fontScale, 2) }]}>Your training starts here.</Text>
        <Text style={[styles.intro, { color: colors.icon }]}>Choose your plan for workouts, programs, and coaching built around you.</Text>
      </View>
      <SubscriptionBenefits />
      {pending || error || !verified ? <View testID="onboarding-subscription-recovery" accessibilityLiveRegion="polite" style={[styles.message, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
        <View style={styles.messageHeading}>{!error ? <ActivityIndicator color={colors.primaryButton} /> : <Ionicons name="cloud-offline-outline" size={22} color={colors.icon} accessible={false} />}
          <Text style={styles.messageTitle}>{pending ? pending.phase === "pending" ? "Awaiting Apple approval" : "Verifying your purchase" : "Checking your access"}</Text>
        </View>
        <Text style={[styles.messageBody, { color: colors.icon }]}>{error ?? (pending ? "Your purchase will continue here once access is confirmed." : "We’ll confirm your subscription before you continue.")}</Text>
        <Pressable testID="onboarding-subscription-retry" accessibilityRole="button" disabled={blocked} onPress={() => void refresh(true)} style={styles.link}><Text style={[styles.linkText, { color: colors.primaryButton }]}>Check again</Text></Pressable>
        {canClearPending ? <Pressable testID="subscription-clear-pending" accessibilityRole="button" disabled={blocked} accessibilityState={{ disabled: blocked }}
          onPress={() => Alert.alert("Clear purchase notice?", "No active subscription was found during verification. Try Restore Purchases first if you paid. Clearing this notice does not cancel Apple billing.", [{ text: "Cancel", style: "cancel" }, { text: "Clear notice", onPress: () => void clearPending() }])} style={styles.link}>
          <Text style={[styles.linkText, { color: colors.primaryButton }]}>Clear pending purchase notice</Text>
        </Pressable> : null}
      </View> : notice ? <Text testID="subscription-feedback" accessibilityLiveRegion="polite" style={[styles.messageBody, { color: colors.icon }]}>{notice}</Text> : null}
      <SubscriptionPlans plans={plans} selected={plan?.id} blocked={blocked} onSelect={setSelected} />
      {!plans.length && verified ? <Text style={[styles.messageBody, { color: colors.icon }]}>Plans aren’t available yet. Check again shortly or restore an existing purchase.</Text> : null}
      {inlineCheckout ? checkout : null}
    </ScrollView>
    {!inlineCheckout ? checkout : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 24, paddingVertical: 8 },
  brand: { fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  account: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  accountText: { fontSize: 14, fontWeight: "500", flexShrink: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, gap: 24 },
  hero: { gap: 12 },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.8 },
  intro: { fontSize: 16 },
  checkout: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 4, gap: 8 },
  inlineCheckout: { paddingHorizontal: 0 },
  footerLinks: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 16 },
  link: { minHeight: 44, justifyContent: "center", paddingVertical: 8 },
  linkText: { fontSize: 14, fontWeight: "600" },
  legalText: { fontSize: 13 },
  message: { padding: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, gap: 8 },
  messageHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  messageTitle: { fontSize: 16, fontWeight: "600" },
  messageBody: { fontSize: 14 },
});
