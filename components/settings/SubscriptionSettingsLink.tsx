import { Ionicons } from "@expo/vector-icons";
import { Href, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useContext } from "react";
import { Pressable, View } from "react-native";
import { WorkoutText } from "@/components/workout/WorkoutText";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthContext } from "@/utils/authContext";
import { useSubscription } from "@/utils/subscriptionContext";
import { nativeBillingAvailable } from "@/services/revenueCat";

export function SubscriptionSettingsLink() {
  const { user } = useContext(AuthContext);
  const { snapshot, pending, refresh } = useSubscription();
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const visible = nativeBillingAvailable() || pending || user?.subscription_tier === "premium" || snapshot?.flags.subscriptions_purchases_enabled || snapshot?.flags.subscriptions_enforcement_enabled || (snapshot && !["none", "unknown"].includes(snapshot.billing_status));
  if (!visible) return null;
  return <Pressable testID="settings-subscription" accessibilityRole="button" accessibilityLabel="Subscription" onPress={() => { void refresh(); router.push("/settings/subscription" as Href); }} style={{ minHeight: 64, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, flexDirection: "row", alignItems: "center", gap: 12 }}>
    <View style={{ flex: 1, gap: 4 }}><WorkoutText style={{ fontWeight: "600" }}>Subscription</WorkoutText><WorkoutText style={{ color: colors.icon, fontSize: 13 }}>{pending ? "Check purchase status" : snapshot?.has_premium ? "Premium active" : "Plans, restore, and billing"}</WorkoutText></View><Ionicons name="chevron-forward" size={20} color={colors.icon} accessible={false} />
  </Pressable>;
}
