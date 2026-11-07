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
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const accent = scheme === "dark" ? "#B9ACFF" : colors.primaryButton;
  const { fontScale } = useWindowDimensions();
  const inlineCheckout = fontScale >= 1.3;
  const { snapshot, plans, pending, busy, sdkReady, canPurchase, canClearPending, error, notice, refresh, loadPlans, recoverBilling, purchase, restore, clearPending } = useSubscription();
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
        accessibilityHint="Checks for an existing subscription without starting a new purchase."
        onPress={() => { setRestoring(true); void restore().finally(() => setRestoring(false)); }}
        style={({ pressed }) => [styles.restore, { backgroundColor: scheme === "dark" ? pressed ? "#372F49" : "#272236" : pressed ? "#ECE7FF" : "#F5F2FF", opacity: blocked || !sdkReady ? 0.5 : 1 }]}>
        <View style={styles.restoreIcon}>{restoring ? <ActivityIndicator size="small" color={accent} accessible={false} /> : <Ionicons name="refresh" size={16} color={accent} accessible={false} />}</View>
        <Text style={[styles.restoreText, { color: accent }]}>{restoring ? "Restoring…" : "Restore purchases"}</Text>
      </Pressable>
      <View style={styles.legalLinks}>
        <Pressable accessibilityRole="link" onPress={() => router.push("/legal/terms" as Href)} style={({ pressed }) => [styles.legalLink, { opacity: pressed ? 0.5 : 1 }]}><Text style={[styles.legalText, { color: colors.icon }]}>Terms</Text></Pressable>
        <View accessible={false} style={[styles.legalDivider, { backgroundColor: colors.icon }]} />
        <Pressable accessibilityRole="link" onPress={() => router.push("/legal/privacy" as Href)} style={({ pressed }) => [styles.legalLink, { opacity: pressed ? 0.5 : 1 }]}><Text style={[styles.legalText, { color: colors.icon }]}>Privacy</Text></Pressable>
      </View>
    </View>
  </View>;

  return <SafeAreaView key={fontScale} style={[styles.screen, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
    <View style={styles.header}>
      <Text allowFontScaling={false} style={[styles.brand, { fontSize: 20 * Math.min(fontScale, 1.5) }]}>PrimeRep</Text>
      <Pressable testID="onboarding-account-options" accessibilityRole="button" accessibilityLabel="Account options" disabled={blocked} accessibilityState={{ disabled: blocked }}
        onPress={() => router.push("/onboarding-account" as Href)} style={({ pressed }) => [styles.account, { backgroundColor: pressed ? colors.inputBorder : scheme === "dark" ? "#23272B" : "#F2F3F5", opacity: blocked ? 0.5 : 1 }]}>
        <Ionicons name="person-outline" size={24} color={colors.text} accessible={false} />
      </Pressable>
    </View>
    <ScrollView testID="onboarding-subscription-scroll" style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text accessibilityRole="header" allowFontScaling={false} style={[styles.title, { fontSize: 24 * Math.min(fontScale, 2) }]}>Your training starts here.</Text>
        <Text style={[styles.intro, { color: colors.icon }]}>Choose your plan.</Text>
      </View>
      {pending || error || !verified || !sdkReady || !plans.length ? <View testID="onboarding-subscription-recovery" accessibilityLiveRegion="polite" style={[styles.message, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
        <View style={styles.messageHeading}>{blocked || (!verified && !error) ? <ActivityIndicator color={colors.primaryButton} /> : <Ionicons name={error ? "cloud-offline-outline" : "information-circle-outline"} size={22} color={colors.icon} accessible={false} />}
          <Text style={styles.messageTitle}>{pending ? pending.phase === "pending" ? "Awaiting Apple approval" : "Verifying your purchase" : !verified ? "Checking your access" : !sdkReady ? "Connect to billing" : "Plans unavailable"}</Text>
        </View>
        <Text style={[styles.messageBody, { color: colors.icon }]}>{error ?? (pending ? "Your purchase will continue here once access is confirmed." : !verified ? "We’ll confirm your subscription before you continue." : !sdkReady ? "Connect to the store to load plans or restore an existing purchase." : "Plans aren’t available yet. Try again shortly or restore an existing purchase.")}</Text>
        <Pressable testID="onboarding-subscription-retry" accessibilityRole="button" accessibilityState={{ disabled: blocked, busy }} disabled={blocked} onPress={() => void recoverBilling()} style={styles.link}><Text style={[styles.linkText, { color: accent }]}>{busy ? "Trying again…" : "Try again"}</Text></Pressable>
        {canClearPending ? <Pressable testID="subscription-clear-pending" accessibilityRole="button" disabled={blocked} accessibilityState={{ disabled: blocked }}
          onPress={() => Alert.alert("Clear purchase notice?", "No active subscription was found during verification. Try Restore Purchases first if you paid. Clearing this notice does not cancel Apple billing.", [{ text: "Cancel", style: "cancel" }, { text: "Clear notice", onPress: () => void clearPending() }])} style={styles.link}>
          <Text style={[styles.linkText, { color: accent }]}>Clear pending purchase notice</Text>
        </Pressable> : null}
      </View> : notice ? <Text testID="subscription-feedback" accessibilityLiveRegion="polite" style={[styles.messageBody, { color: colors.icon }]}>{notice}</Text> : null}
      <SubscriptionPlans plans={plans} selected={plan?.id} blocked={blocked} onSelect={setSelected} />
      <SubscriptionBenefits compact />
      {inlineCheckout ? checkout : null}
    </ScrollView>
    {!inlineCheckout ? checkout : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 24, paddingVertical: 8 },
  brand: { fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  account: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, gap: 20 },
  hero: { gap: 6 },
  title: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  intro: { fontSize: 16 },
  checkout: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 4, gap: 8 },
  inlineCheckout: { paddingHorizontal: 0 },
  footerLinks: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: 12, rowGap: 4 },
  restore: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, maxWidth: "100%", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  restoreIcon: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  restoreText: { fontSize: 13, fontWeight: "600", flexShrink: 1 },
  legalLinks: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 4, maxWidth: "100%" },
  legalLink: { minHeight: 44, minWidth: 44, maxWidth: "100%", paddingHorizontal: 6, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  legalDivider: { width: StyleSheet.hairlineWidth, height: 12, opacity: 0.35 },
  link: { minHeight: 44, justifyContent: "center", paddingVertical: 8 },
  linkText: { fontSize: 14, fontWeight: "600" },
  legalText: { fontSize: 13, fontWeight: "500" },
  message: { padding: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, gap: 8 },
  messageHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  messageTitle: { fontSize: 16, fontWeight: "600" },
  messageBody: { fontSize: 14 },
});
