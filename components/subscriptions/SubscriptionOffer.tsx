import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text as NativeText, type TextProps, View } from "react-native";
import Animated, { FadeIn, ReduceMotion, useReducedMotion, ZoomIn } from "react-native-reanimated";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { BillingPlan } from "@/services/revenueCat";

export function SubscriptionText({ style, ...props }: TextProps) {
  const colors = Colors[useColorScheme() ?? "light"];
  return <NativeText {...props} style={[{ color: colors.text, fontSize: 16 }, style]} />;
}

export function SubscriptionBenefits({ compact = false }: { compact?: boolean }) {
  const dark = useColorScheme() === "dark";
  const reducedMotion = useReducedMotion();
  const Container = compact ? Animated.View : View;
  return <Container entering={compact && !reducedMotion ? FadeIn.duration(320).reduceMotion(ReduceMotion.System) : undefined}
    style={[styles.benefits, compact && styles.compactBenefits, compact && { backgroundColor: dark ? "#211C30" : "#F7F5FF" }]}>{([
    ["barbell", "Workouts built around your goals"],
    ["swap-horizontal", "Swap exercises when plans change"],
    ["chatbubble-ellipses", "Personal programs and coaching"],
  ] as const).map(([icon, title], index) => <View key={icon} style={styles.benefit}>
    {compact ? <Animated.View accessible={false} entering={reducedMotion ? undefined : ZoomIn.duration(360).delay(80 + index * 80).withInitialValues({ transform: [{ scale: 0.86 }] }).reduceMotion(ReduceMotion.System)} style={styles.featureIconShadow}>
      <LinearGradient colors={dark ? ["#9C83FF", "#6A4FF5", "#453090"] : ["#9278FF", "#6A4FF5", "#5136C6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featureIcon}>
        <Ionicons name={icon} size={26} color="#FFFFFF" accessible={false} />
      </LinearGradient>
    </Animated.View> : <View style={[styles.benefitIcon, { backgroundColor: dark ? "#343B42" : "#292E33" }]}>
      <Ionicons name={icon} size={28} color="#FFFFFF" accessible={false} />
    </View>}
    <SubscriptionText style={[styles.benefitText, compact && styles.compactBenefitText]}>{title}</SubscriptionText>
  </View>)}</Container>;
}

export function SubscriptionPlans({ plans, selected, blocked, onSelect }: { plans: BillingPlan[]; selected?: string; blocked: boolean; onSelect: (id: string) => void }) {
  const dark = useColorScheme() === "dark";
  const colors = Colors[dark ? "dark" : "light"];
  return <View style={styles.plans}>{plans.map(choice => {
    const chosen = selected === choice.id;
    return <Pressable testID={`subscription-plan-${choice.term}`} key={choice.id} accessibilityRole="radio"
      accessibilityLabel={`${choice.term === "month" ? "Monthly" : "Annual"}, ${choice.price} per ${choice.term}`}
      accessibilityState={{ selected: chosen, disabled: blocked }} disabled={blocked} onPress={() => onSelect(choice.id)}
      style={({ pressed }) => [styles.plan, { borderColor: chosen ? colors.primaryButton : colors.inputBorder, backgroundColor: chosen ? dark ? "#272236" : "#F5F2FF" : colors.inputBackground, opacity: pressed || blocked ? 0.65 : 1 }]}>
      <Ionicons name={chosen ? "radio-button-on" : "radio-button-off"} size={22} color={chosen ? dark ? "#B9ACFF" : colors.primaryButton : colors.icon} accessible={false} />
      <View style={styles.flexible}>
        <View style={styles.planHeading}>
          <SubscriptionText style={styles.planTitle}>{choice.term === "month" ? "Monthly" : "Annual"}</SubscriptionText>
          <View style={styles.price}><SubscriptionText style={styles.planPrice}>{choice.price}</SubscriptionText><SubscriptionText style={[styles.caption, { color: colors.icon }]}> / {choice.term}</SubscriptionText></View>
        </View>
        <SubscriptionText style={[styles.caption, { color: colors.icon }]}>{choice.trialDays ? `${choice.trialDays}-day free trial included` : choice.term === "year" ? "Billed once a year" : "Billed monthly"}</SubscriptionText>
      </View>
    </Pressable>;
  })}</View>;
}

export function SubscriptionCheckout({ plan, disabled, busy, onPurchase }: { plan: BillingPlan; disabled: boolean; busy: boolean; onPurchase: () => void }) {
  const colors = Colors[useColorScheme() ?? "light"];
  return <View style={styles.checkout}>
    <Pressable testID="subscription-purchase" accessibilityRole="button" accessibilityLabel={plan.trialDays ? `Start ${plan.trialDays}-day trial` : "Subscribe"}
      accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPurchase}
      style={({ pressed }) => [styles.primary, { backgroundColor: colors.primaryButton, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
      {busy ? <ActivityIndicator color="#FFFFFF" accessible={false} /> : null}
      <SubscriptionText style={styles.primaryText}>{busy ? "Please wait…" : plan.trialDays ? `Start ${plan.trialDays}-day trial` : "Subscribe"}</SubscriptionText>
    </Pressable>
    <SubscriptionText style={[styles.terms, { color: colors.icon }]}>{plan.trialDays ? `After the trial, ${plan.price} per ${plan.term}. ` : `${plan.price} per ${plan.term}. `}Renews automatically. Cancel in Apple subscription settings.</SubscriptionText>
  </View>;
}

const styles = StyleSheet.create({
  benefits: { gap: 20, paddingVertical: 4 },
  compactBenefits: { gap: 16, paddingHorizontal: 16, paddingVertical: 16, borderRadius: 20 },
  benefit: { flexDirection: "row", alignItems: "center", gap: 14 },
  benefitIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  featureIconShadow: { flexShrink: 0, borderRadius: 13, shadowColor: "#5136C6", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 5 },
  featureIcon: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, borderColor: "#FFFFFF30", alignItems: "center", justifyContent: "center" },
  benefitText: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: "600", letterSpacing: -0.25 },
  compactBenefitText: { fontSize: 16, fontWeight: "600", letterSpacing: -0.2 },
  plans: { gap: 12 },
  flexible: { flex: 1, minWidth: 0, gap: 4 },
  plan: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, minHeight: 80, borderRadius: 16, borderWidth: 1.5 },
  planHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 12, rowGap: 4 },
  planTitle: { fontSize: 17, fontWeight: "600" },
  price: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", maxWidth: "100%", flexShrink: 1 },
  planPrice: { fontSize: 20, fontWeight: "700", flexShrink: 1 },
  caption: { fontSize: 13 },
  checkout: { gap: 12, marginTop: 4 },
  primary: { minHeight: 52, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 10 },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600", textAlign: "center", flexShrink: 1 },
  terms: { fontSize: 12, textAlign: "center" },
});
