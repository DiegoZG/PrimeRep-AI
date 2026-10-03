import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { LEGAL_RELEASE, type LegalSection } from "@/constants/legal";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function LegalDocumentScreen({ title, version, lastUpdated, sections, testID, draftNotice }: {
  title: string;
  version: string;
  lastUpdated: string;
  sections: LegalSection[];
  testID: string;
  draftNotice?: string;
}) {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  return (
    <SafeAreaView testID={testID} style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Back from ${title}`} hitSlop={10} onPress={() => router.canGoBack() ? router.back() : router.replace("/login")} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>{title}</ThemedText>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={[styles.meta, { color: colors.placeholder }]}>Version {version} · Last updated {lastUpdated}</ThemedText>
        {LEGAL_RELEASE.status !== "approved" ? (
          <View style={[styles.notice, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
            <Ionicons name="document-text-outline" size={20} color={colors.primaryButton} />
            <ThemedText style={[styles.noticeText, { color: colors.placeholder }]}>{draftNotice ?? 'Draft prepared for legal review before release.'}</ThemedText>
          </View>
        ) : null}
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>{section.title}</ThemedText>
            {section.paragraphs.map((paragraph) => (
              <ThemedText key={paragraph} style={[styles.paragraph, { color: colors.text }]}>{paragraph}</ThemedText>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { minHeight: 56, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#D8D8DD" },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", fontFamily: Fonts.sans },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48 },
  meta: { fontSize: 13, lineHeight: 18 },
  notice: { marginTop: 16, padding: 14, borderWidth: 1, borderRadius: 14, flexDirection: "row", gap: 10, alignItems: "center" },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 20, marginBottom: 10 },
  paragraph: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
});
