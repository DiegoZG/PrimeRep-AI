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
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthContext } from "@/utils/authContext";
import { NotificationsContext } from "@/utils/notificationsContext";
import { deleteAccount } from "@/services/userService";
import { pauseHealthExport, resumeHealthExport, waitForHealthExportIdle } from "@/services/health/exportSync";
import { clearHealthExportAccount } from "@/utils/healthExportAccountCleanup";
import {
  getCoachPreferences,
  updateCoachPreferences,
} from "@/services/coachService";
import type { CoachPreferences } from "@/interfaces/coach";
import {
  loadWeightUnit,
  saveWeightUnit,
  WeightUnit,
} from "@/utils/weightUnits";
import {
  ThemePreference,
  useAppearance,
} from "@/utils/appearanceContext";

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
  const {
    preference: themePreference,
    isReady: isAppearanceReady,
    isSaving: isSavingAppearance,
    setPreference: setThemePreference,
  } = useAppearance();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { width, fontScale } = useWindowDimensions();
  const stackedPreferences = width < 390 || fontScale >= 1.3;
  const stackedAppearance = width < 350 || fontScale >= 1.3;
  const scrollingTitle = fontScale >= 2;
  const destructiveColor = scheme === "dark" ? "#F18C86" : "#D14343";
  const switchTrack = scheme === "dark" ? colors.inputBackground : colors.inputBorder;

  const isPremium = user?.subscription_tier === "premium";
  const coachEnabled = user?.coach_insights_enabled ?? false;

  const [isToggling, setIsToggling] = useState(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("LB");
  const [isUnitReady, setIsUnitReady] = useState(false);
  const [isSavingUnit, setIsSavingUnit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [coachPreferences, setCoachPreferences] = useState<CoachPreferences | null>(null);
  const [coachReminderDraft, setCoachReminderDraft] = useState("08:00");
  const [isCoachPreferenceLoading, setIsCoachPreferenceLoading] = useState(false);
  const [isCoachPreferenceSaving, setIsCoachPreferenceSaving] = useState(false);
  const [coachPreferenceError, setCoachPreferenceError] = useState<string | null>(null);
  const [coachPreferenceSaved, setCoachPreferenceSaved] = useState(false);
  const [coachPreferenceRevision, setCoachPreferenceRevision] = useState(0);
  const deletingRef = useRef(false);
  const savingUnitRef = useRef(false);
  const coachPreferenceRequestRef = useRef(0);
  const settingsAccountRef = useRef(`${user?.id ?? "guest"}:${token ?? "anonymous"}`);
  settingsAccountRef.current = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const settingsAccountKey = settingsAccountRef.current;

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

  useEffect(() => {
    const requestId = ++coachPreferenceRequestRef.current;
    const requestAccount = settingsAccountKey;
    setCoachPreferences(null);
    setCoachReminderDraft("08:00");
    setCoachPreferenceError(null);
    setCoachPreferenceSaved(false);
    if (!token || !user) {
      setIsCoachPreferenceLoading(false);
      return;
    }
    setIsCoachPreferenceLoading(true);
    const currentTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    void getCoachPreferences(token)
      .then(async (preferences) => {
        if (coachPreferenceRequestRef.current !== requestId || settingsAccountRef.current !== requestAccount) return;
        setCoachPreferences(preferences);
        setCoachReminderDraft(preferences.reminderTime.slice(0, 5));
        if (preferences.notificationsEnabled && preferences.timeZone !== currentTimeZone) {
          try {
            const resolved = await updateCoachPreferences(token, { ...preferences, timeZone: currentTimeZone });
            if (coachPreferenceRequestRef.current !== requestId || settingsAccountRef.current !== requestAccount) return;
            setCoachPreferences(resolved);
            setCoachReminderDraft(resolved.reminderTime.slice(0, 5));
          } catch {
            if (coachPreferenceRequestRef.current === requestId && settingsAccountRef.current === requestAccount) {
              setCoachPreferenceError("Your timezone couldn’t be updated. Your existing Coach notification settings are still available.");
            }
          }
        }
      })
      .catch(() => {
        if (coachPreferenceRequestRef.current === requestId && settingsAccountRef.current === requestAccount) {
          setCoachPreferenceError("Coach notification settings couldn’t load. Try reopening Settings.");
        }
      })
      .finally(() => {
        if (coachPreferenceRequestRef.current === requestId && settingsAccountRef.current === requestAccount) {
          setIsCoachPreferenceLoading(false);
        }
      });
  }, [coachPreferenceRevision, settingsAccountKey, token, user]);

  const replaceCoachPreferences = useCallback(async (next: CoachPreferences) => {
    if (!token || !user || isCoachPreferenceLoading || isCoachPreferenceSaving) return false;
    const requestId = ++coachPreferenceRequestRef.current;
    const requestAccount = settingsAccountRef.current;
    setIsCoachPreferenceSaving(true);
    setCoachPreferenceError(null);
    setCoachPreferenceSaved(false);
    try {
      const saved = await updateCoachPreferences(token, next);
      if (coachPreferenceRequestRef.current !== requestId || settingsAccountRef.current !== requestAccount) return false;
      setCoachPreferences(saved);
      setCoachReminderDraft(saved.reminderTime.slice(0, 5));
      setCoachPreferenceSaved(true);
      return true;
    } catch {
      if (coachPreferenceRequestRef.current === requestId && settingsAccountRef.current === requestAccount) {
        setCoachPreferenceSaved(false);
        setCoachPreferenceError("Coach notification settings couldn’t be saved. Try again.");
      }
      return false;
    } finally {
      if (coachPreferenceRequestRef.current === requestId && settingsAccountRef.current === requestAccount) {
        setIsCoachPreferenceSaving(false);
      }
    }
  }, [isCoachPreferenceLoading, isCoachPreferenceSaving, token, user]);

  const handleCoachNotifications = useCallback(async (enabled: boolean) => {
    if (!coachPreferences || isCoachPreferenceLoading || isCoachPreferenceSaving) return;
    if (!enabled) {
      await replaceCoachPreferences({ ...coachPreferences, notificationsEnabled: false });
      return;
    }
    let permission = await refreshPermission();
    if (permission === "undetermined") permission = await requestPermission();
    if (permission !== "granted") {
      Alert.alert(
        "Allow Notifications First",
        permission === "unsupported"
          ? "Coach notifications aren’t available on this platform."
          : "Allow PrimeRep notifications in system settings, then turn on Coach notifications.",
        permission === "denied"
          ? [{ text: "Not Now", style: "cancel" }, { text: "Open Settings", onPress: () => void openNotificationSettings() }]
          : [{ text: "OK" }],
      );
      return;
    }
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    await replaceCoachPreferences({ ...coachPreferences, notificationsEnabled: true, timeZone });
  }, [coachPreferences, isCoachPreferenceLoading, isCoachPreferenceSaving, openNotificationSettings, refreshPermission, replaceCoachPreferences, requestPermission]);

  const saveCoachReminderTime = useCallback(async () => {
    if (!coachPreferences || isCoachPreferenceLoading || isCoachPreferenceSaving) return;
    const match = /^(\d{1,2}):(\d{2})$/.exec(coachReminderDraft.trim());
    const hour = match ? Number(match[1]) : -1;
    const minute = match ? Number(match[2]) : -1;
    if (!match || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      setCoachPreferenceSaved(false);
      setCoachPreferenceError("Enter a reminder time from 00:00 to 23:59.");
      return;
    }
    const reminderTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    await replaceCoachPreferences({ ...coachPreferences, reminderTime, timeZone });
  }, [coachPreferences, coachReminderDraft, isCoachPreferenceLoading, isCoachPreferenceSaving, replaceCoachPreferences]);

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

  const handleThemePreference = useCallback(async (preference: ThemePreference) => {
    try {
      await setThemePreference(preference);
    } catch {
      Alert.alert("Could Not Save Appearance", "Please try again.");
    }
  }, [setThemePreference]);

  const handleLogOut = useCallback(async () => {
    if (!token || isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await unregisterCurrentDevice(token).catch(() => {});
      await logOut();
    } finally {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, logOut, token, unregisterCurrentDevice]);

  const confirmDeleteAccount = useCallback(() => {
    if (isDeleting || !token || !user?.id) return;
    const deletingUserId = user.id;
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
            pauseHealthExport(deletingUserId);
            try {
              await deleteAccount(token);
            } catch {
              resumeHealthExport(deletingUserId);
              Alert.alert("Could Not Delete Account", "Please try again.");
              deletingRef.current = false;
              setIsDeleting(false);
              return;
            }
            try {
              await waitForHealthExportIdle();
              await clearHealthExportAccount(deletingUserId);
            } catch {
              console.warn("Account deleted, but local Health export cleanup was incomplete.");
            }
            if (!settingsAccountRef.current.startsWith(`${deletingUserId}:`)) {
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
  }, [isDeleting, logOut, token, user?.id]);

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
      edges={["top", "bottom"]}
    >
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back from Settings"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, { backgroundColor: pressed ? colors.inputBorder : "transparent" }]}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        {!scrollingTitle ? <ThemedText accessibilityRole="header" style={styles.headerTitle}>
          Settings
        </ThemedText> : null}
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        {scrollingTitle ? <ThemedText accessibilityRole="header" style={styles.scrollingTitle}>Settings</ThemedText> : null}
        <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>Preferences</ThemedText>
        <View
          style={[
            styles.card,
            styles.sectionCard,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
          ]}
        >
          <View style={[styles.preferenceRow, stackedAppearance && styles.stackedPreferenceRow]}>
            <ThemedText style={styles.preferenceLabel}>Appearance</ThemedText>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Appearance"
              style={[
                styles.inlinePreferenceControl,
                styles.appearancePreferenceControl,
                { backgroundColor: colors.background, borderColor: colors.inputBorder },
              ]}
            >
              {(["system", "light", "dark"] as const).map((preference) => {
                const selected = themePreference === preference;
                const disabled = !isAppearanceReady || isSavingAppearance;
                const icon = preference === "system" ? "contrast-outline" : preference === "light" ? "sunny-outline" : "moon-outline";
                return (
                  <Pressable
                    key={preference}
                    testID={`settings-appearance-${preference}`}
                    accessibilityRole="radio"
                    accessibilityLabel={`Use ${preference} appearance`}
                    accessibilityHint={preference === "system" ? "Follow your device's appearance" : undefined}
                    accessibilityState={{ checked: selected, disabled }}
                    onPress={() => void handleThemePreference(preference)}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.preferenceOption,
                      styles.appearancePreferenceOption,
                      { backgroundColor: selected || pressed ? colors.inputBorder : "transparent", opacity: disabled ? 0.5 : 1 },
                    ]}
                  >
                    <Ionicons name={icon} size={22} color={selected ? colors.text : colors.icon} accessible={false} />
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={[styles.preferenceDivider, { backgroundColor: colors.inputBorder }]} />
          <View style={[styles.preferenceRow, stackedPreferences && styles.stackedPreferenceRow]}>
            <ThemedText style={styles.preferenceLabel}>Units</ThemedText>
            <View
              accessibilityRole="radiogroup"
              style={[
                styles.inlinePreferenceControl,
                styles.unitPreferenceControl,
                stackedPreferences && styles.stackedUnitControl,
                { backgroundColor: colors.background, borderColor: colors.inputBorder },
              ]}
            >
              {(["LB", "KG"] as const).map((unit) => {
                const selected = weightUnit === unit;
                const disabled = !isUnitReady || isSavingUnit;
                return (
                  <Pressable
                    key={unit}
                    accessibilityRole="radio"
                    accessibilityLabel={`Use ${unit === "LB" ? "pounds" : "kilograms"}`}
                    accessibilityState={{ checked: selected, disabled }}
                    onPress={() => void handleWeightUnit(unit)}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.preferenceOption,
                      { backgroundColor: selected || pressed ? colors.inputBorder : "transparent", opacity: disabled ? 0.5 : 1 },
                    ]}
                  >
                    <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={18} color={selected ? colors.text : colors.icon} accessible={false} />
                    <ThemedText style={[styles.preferenceText, { color: selected ? colors.text : colors.icon }]}>
                      {unit}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>Notifications</ThemedText>
        <View
          style={[
            styles.card,
            styles.sectionCard,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
          ]}
        >
          <Pressable
            testID="settings-push-notifications"
            style={({ pressed }) => [styles.navigationRow, { backgroundColor: pressed ? colors.inputBorder : "transparent", opacity: isUpdatingNotifications || notificationPermission === "unsupported" ? 0.5 : 1 }]}
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
                style={[styles.rowSubtitle, { color: colors.icon }]}
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
              <Ionicons name="chevron-forward" size={20} color={colors.icon} accessible={false} />
            )}
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.inputBorder }]} />
          <View style={styles.row}>
            <View style={styles.settingHeader}>
              <ThemedText style={styles.rowTitle}>Coach Notifications</ThemedText>
              <View style={styles.settingSwitch}>
            <Switch
              testID="settings-coach-notifications"
              accessibilityLabel="Coach notifications"
              accessibilityHint="Sends at most one scheduled coaching reminder per day"
              accessibilityState={{ disabled: isCoachPreferenceLoading || isCoachPreferenceSaving || !coachPreferences, busy: isCoachPreferenceSaving }}
              value={coachPreferences?.notificationsEnabled ?? false}
              onValueChange={(value) => void handleCoachNotifications(value)}
              disabled={isCoachPreferenceLoading || isCoachPreferenceSaving || !coachPreferences}
              hitSlop={{ top: 7, bottom: 7 }}
              trackColor={{ false: switchTrack, true: switchTrack }}
              thumbColor={coachPreferences?.notificationsEnabled ? colors.primaryButton : colors.icon}
              ios_backgroundColor={switchTrack}
            />
              </View>
            </View>
            <ThemedText style={[styles.rowSubtitle, { color: colors.icon }]}>
              Actionable workout reminders only. Progress and recovery guidance stays in the app.
            </ThemedText>
          </View>
          {coachPreferences?.notificationsEnabled ? <>
            <View style={[styles.divider, { backgroundColor: colors.inputBorder }]} />
            <View style={styles.coachReminderRow}>
              <View style={styles.rowContent}>
                <ThemedText style={styles.rowTitle}>Daily Reminder Time</ThemedText>
                <ThemedText style={[styles.rowSubtitle, { color: colors.icon }]}>{coachPreferences.timeZone}</ThemedText>
              </View>
              <View style={styles.reminderControls}>
              <TextInput
                testID="settings-coach-reminder-time"
                accessibilityLabel="Coach reminder time in 24-hour format"
                value={coachReminderDraft}
                onChangeText={(value) => {
                  setCoachReminderDraft(value);
                  setCoachPreferenceSaved(false);
                  setCoachPreferenceError(null);
                }}
                placeholder="08:00"
                placeholderTextColor={colors.placeholder}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                selectTextOnFocus
                editable={!isCoachPreferenceLoading && !isCoachPreferenceSaving}
                accessibilityState={{ disabled: isCoachPreferenceLoading || isCoachPreferenceSaving, busy: isCoachPreferenceLoading || isCoachPreferenceSaving }}
                style={[styles.timeInput, fontScale >= 1.5 && styles.largeTimeInput, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.background }]}
              />
              <Pressable
                testID="settings-save-coach-time"
                accessibilityRole="button"
                accessibilityLabel="Save Coach reminder time"
                accessibilityState={{ disabled: isCoachPreferenceLoading || isCoachPreferenceSaving, busy: isCoachPreferenceLoading || isCoachPreferenceSaving }}
                disabled={isCoachPreferenceLoading || isCoachPreferenceSaving}
                onPress={() => void saveCoachReminderTime()}
                style={({ pressed }) => [styles.saveTimeButton, { borderColor: colors.primaryButton, backgroundColor: pressed ? "#5940D9" : colors.primaryButton, opacity: isCoachPreferenceLoading || isCoachPreferenceSaving ? 0.5 : 1 }]}
              >
                <ThemedText style={{ color: "#fff", fontWeight: "700" }}>Save</ThemedText>
              </Pressable>
              </View>
            </View>
          </> : null}
          {coachPreferenceError ? <View style={styles.coachPreferenceErrorRow}><ThemedText testID="settings-coach-error" accessibilityRole="alert" style={[styles.coachPreferenceError, { color: destructiveColor }]}>{coachPreferenceError}</ThemedText>{!coachPreferences ? <Pressable testID="settings-coach-retry" accessibilityRole="button" accessibilityLabel="Retry Coach notification settings" onPress={() => setCoachPreferenceRevision((revision) => revision + 1)} style={({ pressed }) => [styles.coachPreferenceRetry, { borderColor: colors.inputBorder, backgroundColor: pressed ? colors.inputBorder : "transparent" }]}><Ionicons name="refresh-outline" size={18} color={colors.text} accessible={false} /><ThemedText style={{ color: colors.text, fontWeight: "700" }}>Retry</ThemedText></Pressable> : null}</View> : null}
          {coachPreferenceSaved ? <ThemedText testID="settings-coach-saved" accessibilityLiveRegion="polite" style={[styles.coachPreferenceSaved, { color: colors.icon }]}>Coach notification settings saved.</ThemedText> : null}
        </View>

        <ThemedText
          style={[styles.sectionLabel, { color: colors.icon }]}
        >
          Training
        </ThemedText>
        <View
          style={[
            styles.card,
            styles.sectionCard,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
          ]}
        >
          <Pressable
            style={({ pressed }) => [styles.navigationRow, { backgroundColor: pressed ? colors.inputBorder : "transparent" }]}
            onPress={() => router.push("/settings/training-preferences" as Href)}
            accessibilityRole="button"
            accessibilityLabel="Training preferences"
            accessibilityHint="Edit your goal, experience, schedule, split, location, and equipment"
          >
            <View style={styles.rowContent}>
              <ThemedText style={styles.rowTitle}>Training Preferences</ThemedText>
              <ThemedText style={[styles.rowSubtitle, { color: colors.icon }]}>
                Goal, experience, schedule, split, and equipment
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} accessible={false} />
          </Pressable>
        </View>

        <ThemedText
          style={[styles.sectionLabel, { color: colors.icon }]}
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
            style={({ pressed }) => [styles.navigationRow, { backgroundColor: pressed ? colors.inputBorder : "transparent" }]}
            onPress={() => router.push("/settings/dumbbells" as Href)}
            accessibilityRole="button"
            accessibilityLabel="Dumbbells"
            accessibilityHint="Choose the dumbbell weights you own"
          >
            <View style={styles.rowContent}>
              <ThemedText style={styles.rowTitle}>Dumbbells</ThemedText>
              <ThemedText
                style={[styles.rowSubtitle, { color: colors.icon }]}
              >
                Choose the dumbbell weights you own
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} accessible={false} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.inputBorder }]} />
          <Pressable
            style={({ pressed }) => [styles.navigationRow, { backgroundColor: pressed ? colors.inputBorder : "transparent" }]}
            onPress={() => router.push("/settings/plates" as Href)}
            accessibilityRole="button"
            accessibilityLabel="Plates"
            accessibilityHint="Choose the plate weights you own"
          >
            <View style={styles.rowContent}>
              <ThemedText style={styles.rowTitle}>Plates</ThemedText>
              <ThemedText
                style={[styles.rowSubtitle, { color: colors.icon }]}
              >
                Choose the plate weights you own
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} accessible={false} />
          </Pressable>
        </View>

        <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>Health</ThemedText>
        <View style={[styles.card, styles.sectionCard, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
          <Pressable testID="settings-health" style={({ pressed }) => [styles.navigationRow, { backgroundColor: pressed ? colors.inputBorder : "transparent" }]} onPress={() => router.push("/settings/health" as Href)} accessibilityRole="button" accessibilityLabel="Health connections" accessibilityHint="View Apple Health and Health Connect availability">
            <View style={styles.rowContent}>
              <ThemedText style={styles.rowTitle}>Health connections</ThemedText>
              <ThemedText style={[styles.rowSubtitle, { color: colors.icon }]}>Steps, sleep, and workout export</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} accessible={false} />
          </Pressable>
        </View>

        <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>Legal</ThemedText>
        <View style={[styles.card, styles.sectionCard, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
          <Pressable testID="settings-terms" style={({ pressed }) => [styles.navigationRow, { backgroundColor: pressed ? colors.inputBorder : "transparent" }]} onPress={() => router.push("/legal/terms" as Href)} accessibilityRole="button" accessibilityLabel="Terms of Service">
            <View style={styles.rowContent}><ThemedText style={styles.rowTitle}>Terms of Service</ThemedText></View>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} accessible={false} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.inputBorder }]} />
          <Pressable testID="settings-privacy" style={({ pressed }) => [styles.navigationRow, { backgroundColor: pressed ? colors.inputBorder : "transparent" }]} onPress={() => router.push("/legal/privacy" as Href)} accessibilityRole="button" accessibilityLabel="Privacy Policy">
            <View style={styles.rowContent}><ThemedText style={styles.rowTitle}>Privacy Policy</ThemedText></View>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} accessible={false} />
          </Pressable>
        </View>

        <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>Help & Data</ThemedText>
        <View style={[styles.card, styles.sectionCard, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
          <Pressable testID="settings-help" style={({ pressed }) => [styles.navigationRow, { backgroundColor: pressed ? colors.inputBorder : "transparent" }]} onPress={() => router.push("/settings/help" as Href)} accessibilityRole="button" accessibilityLabel="Help and Support">
            <View style={styles.rowContent}><ThemedText style={styles.rowTitle}>Help & Support</ThemedText></View><Ionicons name="chevron-forward" size={20} color={colors.icon} accessible={false} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.inputBorder }]} />
          <Pressable testID="settings-export" style={({ pressed }) => [styles.navigationRow, { backgroundColor: pressed ? colors.inputBorder : "transparent" }]} onPress={() => router.push("/settings/export" as Href)} accessibilityRole="button" accessibilityLabel="Download my data">
            <View style={styles.rowContent}><ThemedText style={styles.rowTitle}>Download my data</ThemedText></View><Ionicons name="chevron-forward" size={20} color={colors.icon} accessible={false} />
          </Pressable>
        </View>

        {/* AI Features section */}
        {isPremium ? <>
        <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>
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
            <View style={styles.settingHeader}>
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
              <View style={styles.settingSwitch}>
            <Switch
              accessibilityLabel="AI Coaching Insights"
              accessibilityState={{ disabled: isToggling || !isPremium, busy: isToggling }}
              value={isPremium ? coachEnabled : false}
              onValueChange={handleToggle}
              disabled={isToggling || !isPremium}
              hitSlop={{ top: 7, bottom: 7 }}
              trackColor={{ false: switchTrack, true: switchTrack }}
              thumbColor={isPremium && coachEnabled ? colors.primaryButton : colors.icon}
              ios_backgroundColor={switchTrack}
            />
              </View>
            </View>
            <ThemedText style={[styles.rowSubtitle, { color: colors.icon }]}>
              {isPremium
                ? "Personalized intent and rationale for each workout"
                : "Upgrade to unlock AI-generated workout coaching"}
            </ThemedText>
          </View>
        </View>
        </> : null}

        <ThemedText style={[styles.sectionLabel, { color: colors.icon }]}>Account</ThemedText>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
          ]}
        >
          <Pressable
            style={({ pressed }) => [styles.accountRow, { backgroundColor: pressed ? colors.inputBorder : "transparent", opacity: isDeleting || isLoggingOut ? 0.5 : 1 }]}
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
            style={({ pressed }) => [styles.accountRow, { backgroundColor: pressed ? colors.inputBorder : "transparent", opacity: isDeleting ? 0.5 : 1 }]}
            onPress={confirmDeleteAccount}
            disabled={isDeleting}
            accessibilityRole="button"
            accessibilityLabel={isDeleting ? "Deleting account" : "Delete account"}
            accessibilityState={{ disabled: isDeleting }}
          >
            <ThemedText style={[styles.deleteText, { color: destructiveColor }]}>
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
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
  },
  scrollingTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  equipmentCard: {
    marginBottom: 24,
  },
  sectionCard: {
    marginBottom: 24,
  },
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  preferenceLabel: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  inlinePreferenceControl: {
    flex: 1,
    maxWidth: 240,
    flexDirection: "row",
    padding: 3,
    borderWidth: 1,
    borderRadius: 12,
  },
  unitPreferenceControl: {
    maxWidth: 156,
  },
  stackedPreferenceRow: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
  },
  stackedPreferenceControl: {
    flex: 0,
    maxWidth: undefined,
  },
  stackedUnitControl: {
    flex: 0,
    maxWidth: undefined,
    width: "100%",
  },
  appearancePreferenceControl: {
    flex: 0,
    width: 156,
  },
  appearancePreferenceOption: {
    minWidth: 44,
  },
  preferenceOption: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  preferenceText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  preferenceDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  navigationRow: {
    minHeight: 44,
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 6,
  },
  settingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingSwitch: {
    minHeight: 44,
    minWidth: 51,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  coachReminderRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  reminderControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  timeInput: {
    flexBasis: 88,
    flexShrink: 1,
    minWidth: 76,
    maxWidth: 120,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 15,
    textAlign: "center",
  },
  largeTimeInput: {
    flex: 1,
    flexBasis: 160,
    flexShrink: 0,
    maxWidth: undefined,
  },
  saveTimeButton: {
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  coachPreferenceError: {
    width: "100%",
    fontSize: 14,
  },
  coachPreferenceErrorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  coachPreferenceSaved: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    fontSize: 14,
  },
  coachPreferenceRetry: {
    flexDirection: "row",
    gap: 6,
    minWidth: 52,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  accountRow: {
    minHeight: 44,
    paddingVertical: 17,
    paddingHorizontal: 16,
  },
  deleteText: {
    fontSize: 16,
    fontWeight: "600",
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  rowSubtitle: {
    fontSize: 14,
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
