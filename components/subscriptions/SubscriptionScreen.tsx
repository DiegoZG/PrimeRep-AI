import { Ionicons } from "@expo/vector-icons";
import { Href, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text as NativeText, type TextProps, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSubscription } from "@/utils/subscriptionContext";
import { SubscriptionBenefits, SubscriptionPlans, SubscriptionCheckout } from "./SubscriptionOffer";

type ToolAction = "check" | "restore" | "manage";

function dateLabel(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;
}

function Text({ style, ...props }: TextProps) {
  const color = Colors[useColorScheme() ?? "light"].text;
  return <NativeText {...props} style={[{ color, fontSize: 16 }, style]} />;
}

export function SubscriptionScreen({ paywall = false }: { paywall?: boolean }) {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.5;
  const dark = useColorScheme() === "dark";
  const colors = Colors[dark ? "dark" : "light"];
  const accent = dark ? "#B9ACFF" : colors.primaryButton;
  const tint = dark ? "#272236" : "#F5F2FF";
  const success = dark ? "#8BD6AE" : "#246B46";
  const failure = dark ? "#FFB4AB" : "#B42318";
  const { snapshot, plans, pending, busy, ready, sdkReady, canPurchase, canClearPending, error, notice, refresh, loadPlans, purchase, restore, manage, clearPending } = useSubscription();
  const [selected, setSelected] = useState<string | null>(null);
  const [action, setAction] = useState<ToolAction | null>(null);

  useFocusEffect(useCallback(() => { void refresh(Boolean(pending)); }, [refresh, pending]));
  useEffect(() => { if (sdkReady && snapshot?.flags.subscriptions_purchases_enabled) void loadPlans(); }, [sdkReady, snapshot?.flags.subscriptions_purchases_enabled, loadPlans]);

  const plan = plans.find((choice) => choice.id === selected) ?? plans.find((choice) => choice.term === "month") ?? plans[0];
  const memberPlan = plans.find((choice) => choice.productId === snapshot?.product_id);
  const premium = snapshot?.has_premium === true;
  const transition = snapshot?.access_source === "transition";
  const ended = snapshot?.billing_status === "expired" && !premium;
  const trial = premium && snapshot?.billing_status === "trial";
  const unavailable = snapshot?.verification_status === "unavailable";
  const showStatus = premium || transition || ended || unavailable;
  const showOffers = snapshot?.flags.subscriptions_purchases_enabled && !premium && !pending;
  const canManage = sdkReady || Boolean(snapshot?.management_url);
  const blocked = busy || action !== null;
  const accessDate = dateLabel(transition ? snapshot?.transition_ends_at ?? snapshot?.access_expires_at : snapshot?.expires_at ?? snapshot?.access_expires_at);
  const status = transition ? "Transition access" : trial ? "Free trial" : premium ? "Premium active" : ended ? "Subscription ended" : "Let's check your access";
  const dateTitle = transition ? "Available until" : ended ? "Ended" : trial ? "Trial ends" : snapshot?.will_renew ? "Renews" : "Access until";
  const statusDescription = unavailable ? "Connect and check your subscription to confirm your latest status."
    : snapshot?.billing_status === "grace" ? "Your access continues while Apple resolves a payment issue."
      : premium ? "Your workouts, programs, and coaching are ready."
        : transition ? "Keep training with Premium during your transition period."
          : "Your saved workouts and history are still here.";

  const close = () => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)" as Href); };
  const openManagement = async () => {
    if (sdkReady) await manage();
    else if (snapshot?.management_url?.startsWith("https://")) await Linking.openURL(snapshot.management_url);
  };
  const checkSubscription = async () => {
    const result = await refresh(true);
    if (result && !result.has_premium && !pending) await loadPlans();
  };
  const runTool = async (next: ToolAction, task: () => Promise<unknown>) => {
    if (blocked) return;
    setAction(next);
    try { await task(); }
    finally { setAction(null); }
  };
  const tools = [
    { action: "restore" as const, id: "subscription-restore", title: "Restore purchases", detail: "Recover a subscription you already have.", icon: "refresh-outline" as const, disabled: !sdkReady, run: restore },
    { action: "check" as const, id: "subscription-retry", title: "Check subscription", detail: "Refresh your current access status.", icon: "sync-outline" as const, disabled: false, run: checkSubscription },
    ...(!premium && canManage ? [{ action: "manage" as const, id: "subscription-manage", title: "Manage subscription", detail: "Review renewal or cancel your plan.", icon: "open-outline" as const, disabled: false, run: () => openManagement().catch(() => undefined) }] : []),
  ];

  // Recreate native text measurements when the system reading size changes.
  return <SafeAreaView key={fontScale} style={[styles.screen, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
    <View style={styles.header}>
      <Text accessibilityRole="header" allowFontScaling={false} style={[styles.headerTitle, { fontSize: 24 * Math.min(fontScale, 1.5) }]}>{paywall ? "PrimeRep Premium" : "Subscription"}</Text>
      <Pressable testID="subscription-close" accessibilityRole="button" accessibilityLabel="Close subscription" onPress={close}
        style={({ pressed }) => [styles.close, { backgroundColor: tint, opacity: pressed ? 0.6 : 1 }]}>
        <Ionicons name="close" size={22} color={colors.text} accessible={false} />
      </Pressable>
    </View>
    <ScrollView testID="subscription-scroll" style={styles.scroll} contentContainerStyle={styles.content}>
      {!ready ? <ActivityIndicator accessibilityLabel="Loading subscription" color={colors.primaryButton} /> : null}

      {showStatus ? <View testID="subscription-status" style={[styles.membership, { backgroundColor: premium || transition ? tint : colors.inputBackground, borderColor: colors.inputBorder }]}>
        <View style={[styles.statusHeading, largeText && styles.stacked]}>
          <View style={[styles.statusIcon, { backgroundColor: colors.background }]}>
            <Ionicons name={premium ? "checkmark-circle-outline" : transition ? "time-outline" : ended ? "calendar-outline" : "cloud-offline-outline"} size={28} color={premium || transition ? accent : colors.icon} accessible={false} />
          </View>
          <View style={[styles.flexible, largeText && styles.fullStatus]}>
            <Text accessibilityRole="header" allowFontScaling={false} style={[styles.statusTitle, { fontSize: 24 * Math.min(fontScale, 2) }]}>{status}</Text>
            <Text style={[styles.body, { color: colors.icon }]}>{statusDescription}</Text>
          </View>
        </View>
        {(memberPlan || accessDate) ? <View style={[styles.facts, { borderTopColor: dark ? "#433A58" : "#E4DDF8" }]}>
          {memberPlan ? <View style={[styles.fact, largeText && styles.fullFact]}><Text style={[styles.caption, { color: colors.icon }]}>Your plan</Text><Text style={styles.factValue}>{memberPlan.term === "month" ? "Monthly" : "Annual"}</Text></View> : null}
          {accessDate ? <View style={[styles.fact, largeText && styles.fullFact]}><Text style={[styles.caption, { color: colors.icon }]}>{dateTitle}</Text><Text style={styles.factValue}>{accessDate}</Text></View> : null}
        </View> : null}
      </View> : null}

      {showOffers && !showStatus ? <View style={styles.introduction}>
        <Text accessibilityRole="header" allowFontScaling={false} style={[styles.headline, { fontSize: 30 * Math.min(fontScale, 2) }]}>A plan that adapts to you.</Text>
        <Text style={[styles.body, { color: colors.icon }]}>Build your routine with workouts, programs, and coaching that fit your training.</Text>
      </View> : null}

      {(premium || transition || showOffers) ? <SubscriptionBenefits /> : null}

      {pending ? <View testID="subscription-pending" accessibilityLiveRegion="polite" style={[styles.message, { backgroundColor: tint }]}>
        <Ionicons name="time-outline" size={22} color={accent} accessible={false} />
        <View style={styles.flexible}>
          <Text style={styles.messageTitle}>{pending.phase === "pending" ? "Awaiting Apple approval" : "Verifying your purchase"}</Text>
          <Text style={[styles.body, { color: colors.icon }]}>You can keep using your saved workouts while we confirm access.</Text>
          {canClearPending ? <Pressable testID="subscription-clear-pending" accessibilityRole="button" disabled={blocked}
            accessibilityState={{ disabled: blocked }} onPress={() => Alert.alert("Clear purchase notice?", "No active subscription was found during verification. Try Restore Purchases first if you paid. Clearing this notice does not cancel Apple billing.", [{ text: "Cancel", style: "cancel" }, { text: "Clear notice", onPress: () => void clearPending() }])} style={styles.inlineAction}>
            <Text style={[styles.actionText, { color: accent }]}>Clear pending purchase notice</Text>
          </Pressable> : null}
        </View>
      </View> : null}

      {notice && !pending && !error ? <View testID="subscription-feedback" accessibilityLiveRegion="polite" style={[styles.message, { backgroundColor: premium ? dark ? "#1E3026" : "#EFF7F1" : tint }]}>
        <Ionicons name={premium ? "checkmark-circle-outline" : "information-circle-outline"} size={21} color={premium ? success : accent} accessible={false} />
        <Text style={[styles.body, styles.flexible, { color: premium ? success : colors.text }]}>{notice}</Text>
      </View> : null}
      {error ? <View testID="subscription-error" accessibilityRole="alert" style={[styles.message, { backgroundColor: dark ? "#382421" : "#FFF2F0" }]}>
        <Ionicons name="alert-circle-outline" size={22} color={failure} accessible={false} />
        <Text style={[styles.body, styles.flexible, { color: failure }]}>{error}</Text>
      </View> : null}

      {showOffers ? <View style={styles.offers}>
        <SubscriptionPlans plans={plans} selected={plan?.id} blocked={blocked} onSelect={setSelected} />
        {plan ? <SubscriptionCheckout plan={plan} disabled={blocked || !canPurchase} busy={busy} onPurchase={() => void purchase(plan)} /> : <Text style={[styles.body, { color: colors.icon }]}>{sdkReady ? "Plans are not available yet. Try again shortly." : "Purchases are available in a configured iPhone app build."}</Text>}
      </View> : null}

      {premium && canManage ? <Pressable testID="subscription-manage" accessibilityRole="button" accessibilityLabel="Manage subscription"
        disabled={blocked} accessibilityState={{ disabled: blocked, busy: action === "manage" }} onPress={() => void runTool("manage", () => openManagement().catch(() => undefined))}
        style={({ pressed }) => [styles.primary, { backgroundColor: colors.primaryButton, opacity: blocked ? 0.5 : pressed ? 0.8 : 1 }]}>
        <Text style={styles.primaryText}>{action === "manage" ? "Opening settings…" : "Manage subscription"}</Text>
        {action === "manage" ? <ActivityIndicator color="#FFFFFF" accessible={false} /> : <Ionicons name="open-outline" size={19} color="#FFFFFF" accessible={false} />}
      </Pressable> : null}

      <View style={[styles.tools, { borderColor: colors.inputBorder }]}>
        {tools.map((tool, index) => <Pressable key={tool.id} testID={tool.id} accessibilityRole="button" accessibilityLabel={tool.title} accessibilityHint={tool.detail}
          accessibilityState={{ disabled: blocked || tool.disabled, busy: action === tool.action }} disabled={blocked || tool.disabled} onPress={() => void runTool(tool.action, tool.run)}
          style={({ pressed }) => [styles.tool, { borderTopWidth: index ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.inputBorder, opacity: tool.disabled || blocked && action !== tool.action ? 0.5 : pressed ? 0.6 : 1 }]}>
          <Ionicons name={tool.icon} size={22} color={colors.icon} accessible={false} />
          <View style={styles.flexible}>
            <Text style={styles.toolTitle}>{action === tool.action ? tool.action === "restore" ? "Restoring purchases…" : tool.action === "check" ? "Checking subscription…" : "Opening settings…" : tool.title}</Text>
            <Text style={[styles.caption, { color: colors.icon }]}>{tool.detail}</Text>
          </View>
          {action === tool.action ? <ActivityIndicator accessibilityLabel={tool.action === "restore" ? "Restoring purchases" : "Checking subscription"} color={accent} /> : <Ionicons name="chevron-forward" size={18} color={colors.icon} accessible={false} />}
        </Pressable>)}
      </View>

      <View style={styles.footer}>
        <View style={styles.reassurance}>
          <Ionicons name="lock-closed-outline" size={15} color={colors.icon} accessible={false} />
          <Text style={[styles.caption, styles.flexible, { color: colors.icon }]}>Your saved workouts, history, and account tools stay accessible if your plan ends.</Text>
        </View>
        <View style={styles.legal}>
          <Pressable accessibilityRole="link" onPress={() => router.push("/legal/terms" as Href)} style={styles.legalLink}><Text style={[styles.caption, { color: colors.icon }]}>Terms</Text></Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.push("/legal/privacy" as Href)} style={styles.legalLink}><Text style={[styles.caption, { color: colors.icon }]}>Privacy</Text></Pressable>
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", flexShrink: 0, alignItems: "center", paddingHorizontal: 20, paddingVertical: 8, gap: 12 },
  headerTitle: { flex: 1, minWidth: 0, fontSize: 24, fontWeight: "700" },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { padding: 20, paddingTop: 16, paddingBottom: 24, gap: 24 },
  flexible: { flex: 1, minWidth: 0, gap: 4 },
  membership: { padding: 20, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, gap: 20 },
  statusHeading: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stacked: { flexDirection: "column" },
  fullStatus: { flex: 0, width: "100%" },
  statusIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  statusTitle: { fontSize: 24, fontWeight: "700" },
  body: { fontSize: 15 },
  caption: { fontSize: 13 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 16, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16 },
  fact: { flexGrow: 1, flexBasis: 120, gap: 4 },
  fullFact: { flexBasis: "100%" },
  factValue: { fontSize: 15, fontWeight: "600" },
  introduction: { gap: 10 },
  headline: { fontSize: 30, fontWeight: "700", letterSpacing: -0.6 },
  message: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12 },
  messageTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  inlineAction: { minHeight: 44, justifyContent: "center", paddingVertical: 8 },
  actionText: { fontSize: 14, fontWeight: "600" },
  offers: { gap: 12 },
  primary: { minHeight: 52, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 10 },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600", textAlign: "center", flexShrink: 1 },
  tools: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  tool: { minHeight: 72, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  toolTitle: { fontSize: 15, fontWeight: "600" },
  footer: { gap: 4 },
  reassurance: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  legal: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 8 },
  legalLink: { minWidth: 64, minHeight: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
});
