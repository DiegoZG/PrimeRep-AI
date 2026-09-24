import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Linking, Platform, Pressable, Switch, View } from "react-native";
import { ProfilePage, ProfileScroll, profileStyles as styles } from "@/components/profile-ui";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { SUPPORT_AVAILABLE, SUPPORT_EMAIL, SUPPORT_FAQS, supportMailto } from "@/constants/support";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function HelpScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const [open, setOpen] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const contact = async (report: boolean) => {
    setBusy(true); setError(false);
    try {
      const url = supportMailto(SUPPORT_EMAIL, report, diagnostics ? { version: Constants.expoConfig?.version ?? "Unknown", platform: Platform.OS, os: String(Platform.Version ?? "Unknown") } : undefined);
      await Linking.openURL(url);
    } catch { setError(true); } finally { setBusy(false); }
  };
  return <ProfilePage title="Help & Support" onBack={() => router.back()} testID="help-screen"><ProfileScroll>
    <ThemedText style={{ color: colors.icon }}>Answers to common questions about training with PrimeRep.</ThemedText>
    <View>{SUPPORT_FAQS.map((faq) => <View key={faq.id} style={{ borderBottomWidth: 1, borderBottomColor: colors.inputBorder }}><Pressable testID={`help-faq-${faq.id}`} onPress={() => setOpen(open === faq.id ? null : faq.id)} accessibilityRole="button" accessibilityState={{ expanded: open === faq.id }} style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, paddingVertical: 14 }}><ThemedText style={{ flex: 1, fontWeight: "600" }}>{faq.title}</ThemedText><Ionicons name={open === faq.id ? "chevron-up" : "chevron-down"} size={18} color={colors.icon} /></Pressable>{open === faq.id ? <ThemedText style={{ color: colors.icon, lineHeight: 24, paddingBottom: 18 }}>{faq.body}</ThemedText> : null}</View>)}</View>
    <ThemedText style={styles.heading}>Need more help?</ThemedText>
    {SUPPORT_AVAILABLE ? <>
      <ThemedText style={{ color: colors.icon }}>Open an email draft, or write to:</ThemedText><ThemedText selectable style={{ color: colors.primaryButton }}>{SUPPORT_EMAIL}</ThemedText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}><View style={{ flex: 1 }}><ThemedText style={{ fontWeight: "600" }}>Include app details</ThemedText><ThemedText style={[styles.muted, { color: colors.icon }]}>App version, platform, and OS version only.</ThemedText></View><Switch testID="help-diagnostics" value={diagnostics} onValueChange={setDiagnostics} accessibilityLabel="Include app version, platform, and OS version" trackColor={{ true: colors.primaryButton }} /></View>
      <Pressable testID="help-contact" onPress={() => void contact(false)} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} style={[styles.button, { backgroundColor: colors.primaryButton, opacity: busy ? 0.5 : 1 }]}><ThemedText style={styles.buttonText}>Contact support</ThemedText></Pressable>
      <Pressable testID="help-report" onPress={() => void contact(true)} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }} style={[styles.button, { borderColor: colors.inputBorder, borderWidth: 1, opacity: busy ? 0.5 : 1 }]}><ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>Report a problem</ThemedText></Pressable>
      {error ? <ThemedText testID="help-mail-error" accessibilityRole="alert" style={styles.error}>Your email app couldn’t open. Select and copy the address above, then send your message from any email service.</ThemedText> : null}
    </> : <ThemedText testID="help-unavailable" style={{ color: colors.icon }}>Email support isn’t configured in this build. You can still find answers in the help topics above.</ThemedText>}
  </ProfileScroll></ProfilePage>;
}
