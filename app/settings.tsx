import { Ionicons } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
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
import { NotificationsContext } from "@/utils/notificationsContext";
import { deleteAccount } from "@/services/userService";
import {
  loadWeightUnit,
  saveWeightUnit,
  WeightUnit,
} from "@/utils/weightUnits";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, token, logOut, updateCoachPreference } = useContext(AuthContext);
  const {
    permission: notificationPermission,
    isLoading: isUpdatingNotifications,
    refreshPermission,
    requestPermission,
    unregisterCurrentDevice,
    openSettings: openNotificationSettings,
  } = useContext(NotificationsContext);
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  const isPremium = user?.subscription_tier === "premium";
  const coachEnabled = user?.coach_insights_enabled ?? false;

  const [isToggling, setIsToggling] = useState(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("LB");
  const [isUnitReady, setIsUnitReady] = useState(false);
  const [isSavingUnit, setIsSavingUnit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const deletingRef = useRef(false);
  const savingUnitRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadWeightUnit().then((unit) => {
      if (!cancelled) {
        setWeightUnit(unit);
        setIsUnitReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshPermission();
  }, [refreshPermission]);

  const handleNotifications = useCallback(async () => {
    try {
      if (
        notificationPermission === "granted" ||
        notificationPermission === "denied"
      ) {
        await openNotificationSettings();
        return;
      }
      await requestPermission();
    } catch {
      Alert.alert(
        "Could Not Update Notifications",
        "Please try again or manage notification access in system settings."
      );
    }
  }, [notificationPermission, openNotificationSettings, requestPermission]);

  const handleWeightUnit = useCallback(async (unit: WeightUnit) => {
    if (!isUnitReady || savingUnitRef.current || unit === weightUnit) return;
    const previousUnit = weightUnit;
    savingUnitRef.current = true;
    setIsSavingUnit(true);
    setWeightUnit(unit);
    const saved = await saveWeightUnit(unit);
    if (!saved) {
      setWeightUnit(previousUnit);
      Alert.alert("Could Not Save Units", "Please try again.");
    }
    savingUnitRef.current = false;
    setIsSavingUnit(false);
  }, [isUnitReady, weightUnit]);

  const handleLogOut = useCallback(async () => {
    if (!token || isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await unregisterCurrentDevice(token);
      await logOut();
    } catch {
      Alert.alert(
        "Could Not Log Out",
        "Could not finish signing out this device. Your session is still active; please try again."
      );
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, logOut, token, unregisterCurrentDevice]);

  const confirmDeleteAccount = useCallback(() => {
    if (isDeleting || !token) return;
    Alert.alert(
      "Delete Account?",
      "This permanently deletes your account and workout data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            if (deletingRef.current) return;
            deletingRef.current = true;
            setIsDeleting(true);
            try {
              await deleteAccount(token);
            } catch {
              Alert.alert("Could Not Delete Account", "Please try again.");
              deletingRef.current = false;
              setIsDeleting(false);
              return;
            }
            try {
              await logOut({ forceLocal: true });
            } catch {
              console.warn("Account deleted, but local token cleanup was incomplete.");
            }
          },
        },
      ]
    );
  }, [isDeleting, logOut, token]);

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
        <ThemedText style={[styles.sectionLabel, { color: colors.placeholder }]}>Units</ThemedText>
        <View
          style={[
            styles.card,
            styles.sectionCard,
            styles.unitControl,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
          ]}
        >
          {(["LB", "KG"] as const).map((unit) => {
            const selected = weightUnit === unit;
            const disabled = !isUnitReady || isSavingUnit;
            return (
              <Pressable
                key={unit}
                accessibilityRole="button"
                accessibilityLabel={`Use ${unit === "LB" ? "pounds" : "kilograms"}`}
                accessibilityState={{ selected, disabled }}
                onPress={() => void handleWeightUnit(unit)}
                disabled={disabled}
                style={[
                  styles.unitOption,
                  selected && { backgroundColor: colors.primaryButton },
                ]}
              >
                <ThemedText style={[styles.unitText, selected && styles.selectedUnitText]}>
                  {unit}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ThemedText style={[styles.sectionLabel, { color: colors.placeholder }]}>Notifications</ThemedText>
        <View
          style={[
            styles.card,
            styles.sectionCard,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
          ]}
        >
          <Pressable
            style={styles.navigationRow}
            onPress={() => void handleNotifications()}
            disabled={isUpdatingNotifications || notificationPermission === "unsupported"}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            accessibilityState={{
              disabled: isUpdatingNotifications || notificationPermission === "unsupported",
            }}
          >
            <View style={styles.rowContent}>
              <ThemedText style={styles.rowTitle}>Push Notifications</ThemedText>
              <ThemedText
                style={[styles.rowSubtitle, { color: colors.placeholder }]}
              >
                {isUpdatingNotifications
                  ? "Updating…"
                  : notificationPermission === "granted"
                    ? "Allowed — manage in system settings"
                    : notificationPermission === "denied"
                      ? "Blocked — open system settings"
                      : notificationPermission === "unsupported"
                        ? "Unavailable on this platform"
                        : "Not enabled"}
              </ThemedText>
            </View>
            {notificationPermission !== "unsupported" && (
              <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
            )}
          </Pressable>
        </View>

        <ThemedText
          style={[styles.sectionLabel, { color: colors.placeholder }]}
        >
          Equipment Weights
        </ThemedText>

        <View
          style={[
            styles.card,
            styles.equipmentCard,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
          ]}
        >
          <Pressable
            style={styles.navigationRow}
            onPress={() => router.push("/settings/dumbbells" as Href)}
            accessibilityRole="button"
            accessibilityLabel="Dumbbells"
            accessibilityHint="Choose the dumbbell weights you own"
          >
            <View style={styles.rowContent}>
              <ThemedText style={styles.rowTitle}>Dumbbells</ThemedText>
              <ThemedText
                style={[styles.rowSubtitle, { color: colors.placeholder }]}
              >
                Choose the dumbbell weights you own
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.inputBorder }]} />
          <Pressable
            style={styles.navigationRow}
            onPress={() => router.push("/settings/plates" as Href)}
            accessibilityRole="button"
            accessibilityLabel="Plates"
            accessibilityHint="Choose the plate weights you own"
          >
            <View style={styles.rowContent}>
              <ThemedText style={styles.rowTitle}>Plates</ThemedText>
              <ThemedText
                style={[styles.rowSubtitle, { color: colors.placeholder }]}
              >
                Choose the plate weights you own
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
          </Pressable>
        </View>

        {/* AI Features section */}
        <ThemedText style={[styles.sectionLabel, { color: colors.placeholder }]}>
          AI Features
        </ThemedText>

        <View
          style={[
            styles.card,
            styles.sectionCard,
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

        <ThemedText style={[styles.sectionLabel, { color: colors.placeholder }]}>Account</ThemedText>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
          ]}
        >
          <Pressable
            style={styles.accountRow}
            onPress={() => void handleLogOut()}
            disabled={isDeleting || isLoggingOut}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            accessibilityState={{ disabled: isDeleting || isLoggingOut, busy: isLoggingOut }}
          >
            <ThemedText style={styles.rowTitle}>
              {isLoggingOut ? "Logging Out…" : "Log Out"}
            </ThemedText>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.inputBorder }]} />
          <Pressable
            style={styles.accountRow}
            onPress={confirmDeleteAccount}
            disabled={isDeleting}
            accessibilityRole="button"
            accessibilityLabel={isDeleting ? "Deleting account" : "Delete account"}
            accessibilityState={{ disabled: isDeleting }}
          >
            <ThemedText style={styles.deleteText}>
              {isDeleting ? "Deleting Account…" : "Delete Account"}
            </ThemedText>
          </Pressable>
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
  equipmentCard: {
    marginBottom: 28,
  },
  sectionCard: {
    marginBottom: 28,
  },
  unitControl: {
    flexDirection: "row",
    padding: 4,
  },
  unitOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 11,
  },
  unitText: {
    fontSize: 14,
    fontWeight: "700",
  },
  selectedUnitText: {
    color: "#fff",
  },
  navigationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  accountRow: {
    paddingVertical: 17,
    paddingHorizontal: 16,
  },
  deleteText: {
    color: "#DC2626",
    fontSize: 15,
    fontWeight: "600",
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
