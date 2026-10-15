import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useContext, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import { ProfilePage, ProfileScroll, profileStyles as styles } from "@/components/profile-ui";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthContext } from "@/utils/authContext";
import { accountRequestGuard } from "@/services/accountScope";
import { exportAccount } from "@/services/privateFiles";
import { loadWeightUnit, type WeightUnit } from "@/utils/weightUnits";
import Animated, { FadeInDown, FadeOutUp, ReduceMotion } from "react-native-reanimated";

export default function ExportScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { user, token } = useContext(AuthContext);
  const [unit, setUnit] = useState<WeightUnit>("LB");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const focused = useRef(true);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    void loadWeightUnit().then((value) => { if (focused.current) setUnit(value); });
    return () => { focused.current = false; if (successTimer.current) clearTimeout(successTimer.current); };
  }, []));
  const download = async () => {
    if (!user || !token || busy) return;
    const guard = accountRequestGuard();
    const current = () => guard() && focused.current;
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = null;
    setBusy(true); setError(null); setSuccess(false);
    try {
      await exportAccount(token, user.id, unit, current);
      if (current()) {
        setSuccess(true);
        successTimer.current = setTimeout(() => { if (current()) setSuccess(false); successTimer.current = null; }, 4500);
      }
    }
    catch (failure) { if (current()) setError(failure instanceof Error ? failure.message : "Your archive couldn’t be created. Please try again."); }
    finally { if (current()) setBusy(false); }
  };
  return <ProfilePage title="Download my data" onBack={() => router.back()} testID="export-screen"><View style={{ flex: 1 }}><ProfileScroll>
    <View style={{ alignSelf: "flex-start", borderRadius: 18, padding: 16, backgroundColor: colors.inputBorder }}><Ionicons name="download-outline" size={34} color={colors.icon} /></View>
    <ThemedText accessibilityRole="header" style={{ fontSize: 27, lineHeight: 35, fontWeight: "700" }}>Your training, yours to keep.</ThemedText>
    <ThemedText style={{ color: colors.icon }}>Download a private ZIP archive of your information stored by PrimeRep.</ThemedText>
    <View style={{ gap: 18 }}>{[{ title: "Full account archive (JSON)", detail: "Your profile, preferences, programs, exercises, workout history, notes, feedback, and saved Coach content. This machine-readable file is useful for a full backup, other tools, or optional AI analysis—you don’t need to open it to review your workouts." }, { title: "Workout spreadsheets (CSV)", detail: `Easy-to-open spreadsheets of completed workouts and current sets, with weights labeled in ${unit === "LB" ? "pounds" : "kilograms"}. Use Excel, Google Sheets, or another spreadsheet app to browse them.` }, { title: "Photo and guide", detail: "Your current profile photo, if present, and a README explaining the files. The archive contains private information; review it before sharing it with another app or an AI tool." }].map((item) => <View key={item.title} style={{ gap: 5 }}><ThemedText style={{ fontWeight: "700" }}>{item.title}</ThemedText><ThemedText style={{ color: colors.icon, fontSize: 14, lineHeight: 21 }}>{item.detail}</ThemedText></View>)}</View>
    <ThemedText style={{ color: colors.icon, fontSize: 14, lineHeight: 21 }}>The archive reflects what’s stored by the service when it is created. Workout changes that are only on this device are not included yet. Exports are limited per hour; try again later if you reach the limit.</ThemedText>
    {error ? <ThemedText testID="export-error" accessibilityRole="alert" style={styles.error}>{error}</ThemedText> : null}
    <Pressable testID="export-create" onPress={() => void download()} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} style={[styles.button, { backgroundColor: colors.primaryButton, opacity: busy ? 0.65 : 1, flexDirection: "row", gap: 12 }]}>{busy ? <ActivityIndicator color="#fff" /> : null}<ThemedText style={styles.buttonText}>{busy ? "Preparing your archive…" : error ? "Try download again" : Platform.OS === "web" ? "Download archive" : "Create and save archive"}</ThemedText></Pressable>
    <ThemedText style={{ color: colors.icon, fontSize: 12, lineHeight: 18 }}>Your archive contains private information. Choose where you save or share it.</ThemedText>
  </ProfileScroll>{success ? <Animated.View testID="export-success" accessibilityRole="alert" accessibilityLiveRegion="polite" entering={FadeInDown.springify().damping(18).stiffness(240).reduceMotion(ReduceMotion.System)} exiting={FadeOutUp.duration(160).reduceMotion(ReduceMotion.System)} style={{ position: "absolute", zIndex: 2, elevation: 2, bottom: 12, left: 20, right: 20, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }}><View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}><Ionicons name="checkmark" size={23} color={colors.primaryButton} /></View><View style={{ flex: 1, gap: 2 }}><ThemedText style={{ fontWeight: "700" }}>Archive created</ThemedText><ThemedText style={{ color: colors.icon, fontSize: 13 }}>The ZIP archive was generated successfully.</ThemedText></View></Animated.View> : null}</View></ProfilePage>;
}
