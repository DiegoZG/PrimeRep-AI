import { Ionicons } from "@expo/vector-icons";
import { Href, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useContext, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { WorkoutText } from "@/components/workout/WorkoutText";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { accountGeneration, accountRequestGuard } from "@/services/accountScope";
import { getFeatureFlags } from "@/services/featureFlagService";
import { AuthContext } from "@/utils/authContext";

export function FeatureFlagsSettingsLink() {
  const { user } = useContext(AuthContext);
  return <AccountLink key={`${user?.id ?? "guest"}:${accountGeneration()}`} />;
}

function AccountLink() {
  const { user, token } = useContext(AuthContext);
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const [canManage, setCanManage] = useState(false);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  useFocusEffect(useCallback(() => {
    let active = true;
    const isCurrent = accountRequestGuard();
    const startedOwner = user?.id;
    setCanManage(false);
    if (token && startedOwner) {
      void getFeatureFlags(token).then((snapshot) => {
        if (active && isCurrent() && owner.current === startedOwner) setCanManage(snapshot.can_manage_flags);
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [token, user?.id]));
  if (!canManage) return null;
  return <View style={{ gap: 10 }}>
    <WorkoutText accessibilityRole="header" style={{ fontSize: 13, fontWeight: "600", color: colors.icon }}>Administration</WorkoutText>
    <Pressable testID="settings-feature-flags" onPress={() => router.push("/settings/admin-feature-flags" as Href)} accessibilityRole="button" accessibilityLabel="Feature flags" style={({ pressed }) => ({ minHeight: 60, padding: 18, borderWidth: 1, borderRadius: 18, borderColor: colors.inputBorder, backgroundColor: pressed ? colors.inputBorder : colors.inputBackground, flexDirection: "row", alignItems: "center", gap: 14 })}>
      <View style={{ flex: 1, gap: 4 }}><WorkoutText style={{ fontWeight: "600" }}>Feature flags</WorkoutText><WorkoutText style={{ color: colors.icon, fontSize: 13 }}>Subscription rollout controls</WorkoutText></View>
      <Ionicons name="chevron-forward" size={20} color={colors.icon} accessible={false} />
    </Pressable>
  </View>;
}
