import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useContext, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { accountRequestGuard } from "@/services/accountScope";
import { getFeatureFlags } from "@/services/featureFlagService";
import { AuthContext } from "@/utils/authContext";
export function EquipmentDiscoveryEntry() {
  const { user, token } = useContext(AuthContext); const router = useRouter(); const colors = Colors[useColorScheme() ?? "light"];
  const [enabledFor, setEnabledFor] = useState<string | null>(null); const request = useRef(0);
  useFocusEffect(useCallback(() => {
    const generation = ++request.current; const accountCurrent = accountRequestGuard(); setEnabledFor(null);
    if (token && user?.id && Platform.OS !== "web") void getFeatureFlags(token).then((snapshot) => { if (generation === request.current && accountCurrent() && snapshot.flags.equipment_scanning_enabled === true) setEnabledFor(user.id); }).catch(() => {});
    return () => { request.current += 1; };
  }, [token, user?.id]));
  const enabled = enabledFor === user?.id;
  return <Pressable testID="explore-equipment-entry" accessibilityRole="button" accessibilityLabel={enabled ? "Scan gym equipment" : "Find gym equipment"} onPress={() => router.push("/explore/scan-equipment")} style={({ pressed }) => [styles.entry, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, opacity: pressed ? 0.75 : 1 }]}><View style={[styles.glyph, { backgroundColor: colors.primaryButton }]}><Ionicons name={enabled ? "scan" : "barbell"} size={24} color="#FFFFFF" /></View><View style={styles.copy}><Text style={[styles.title, { color: colors.text }]}>{enabled ? "Scan equipment" : "Find equipment"}</Text><Text style={[styles.subtitle, { color: colors.icon }]}>{enabled ? "Match a machine. Find your exercise." : "Machine guides and exercise options"}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.icon} /></Pressable>;
}
const styles = StyleSheet.create({ entry: { minHeight: 72, marginHorizontal: 24, marginBottom: 12, padding: 12, borderWidth: 1, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 12 }, glyph: { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center" }, copy: { flex: 1, minWidth: 0, gap: 3 }, title: { fontFamily: Fonts.sans, fontSize: 16, fontWeight: "600" }, subtitle: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18 } });
