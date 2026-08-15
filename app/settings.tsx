import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useContext, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthContext } from "@/utils/authContext";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, updateCoachPreference } = useContext(AuthContext);
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  const isPremium = user?.subscription_tier === "premium";
  const coachEnabled = user?.coach_insights_enabled ?? false;

  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = useCallback(
    async (value: boolean) => {
      if (!isPremium) {
        Alert.alert(
          "Premium Feature",
          "AI Coaching Insights are available with a Premium subscription.",
          [{ text: "OK" }]
        );
        return;
      }

      setIsToggling(true);
      try {
        await updateCoachPreference(value);
      } catch {
        Alert.alert("Error", "Could not update preference. Please try again.");
      } finally {
        setIsToggling(false);
      }
    },
    [isPremium, updateCoachPreference]
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>
          Settings
        </ThemedText>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Features section */}
        <ThemedText style={[styles.sectionLabel, { color: colors.placeholder }]}>
          AI Features
        </ThemedText>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
          ]}
        >
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <View style={styles.rowTitleRow}>
                <ThemedText style={styles.rowTitle}>AI Coaching Insights</ThemedText>
                {!isPremium && (
                  <View
                    style={[styles.premiumBadge, { backgroundColor: colors.primaryButton }]}
                  >
                    <ThemedText style={styles.premiumBadgeText}>Premium</ThemedText>
                  </View>
                )}
              </View>
              <ThemedText style={[styles.rowSubtitle, { color: colors.placeholder }]}>
                {isPremium
                  ? "Personalized intent and rationale for each workout"
                  : "Upgrade to unlock AI-generated workout coaching"}
              </ThemedText>
            </View>
            <Switch
              value={isPremium ? coachEnabled : false}
              onValueChange={handleToggle}
              disabled={isToggling || !isPremium}
              trackColor={{ false: colors.inputBorder, true: colors.primaryButton }}
              thumbColor={Platform.OS === "android" ? colors.background : undefined}
              ios_backgroundColor={colors.inputBorder}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  rowTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  premiumBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  premiumBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
