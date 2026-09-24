import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import React, { useCallback, useContext, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ScreenState } from "@/components/screen-state";
import { AchievementRow, ProfileAvatar, profileStyles as styles } from "@/components/profile-ui";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAccountResource } from "@/hooks/use-account-resource";
import { getAchievements } from "@/services/profileService";
import { accountRequestGuard } from "@/services/accountScope";
import { getStats, listCompletedSessions } from "@/services/workoutLoggingService";
import { AuthContext } from "@/utils/authContext";
import { NotificationsContext } from "@/utils/notificationsContext";
import { useProfile } from "@/utils/profileContext";
import { formatWeightInput, fromKg, loadWeightUnit, toKg, type WeightUnit } from "@/utils/weightUnits";

async function loadDashboard(token: string) {
  const [achievements, stats, history] = await Promise.allSettled([getAchievements(token), getStats(token), listCompletedSessions(token, 3)]);
  return { achievements: achievements.status === "fulfilled" ? achievements.value : null, stats: stats.status === "fulfilled" ? stats.value : null, history: history.status === "fulfilled" ? history.value.items : null, incomplete: [achievements, stats, history].some((result) => result.status === "rejected") };
}

export default function ProfileScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { logOut, token } = useContext(AuthContext);
  const { unregisterCurrentDevice } = useContext(NotificationsContext);
  const { profile, avatar, loading, error, refresh, avatarError, retryAvatar } = useProfile();
  const dashboard = useAccountResource(loadDashboard);
  const { fontScale } = useWindowDimensions();
  const [unit, setUnit] = useState<WeightUnit>("LB");
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    void refresh();
    void loadWeightUnit().then((value) => { if (active) setUnit(value); });
    return () => { active = false; };
  }, [refresh]));
  const data = dashboard.data;
  const achievements = data?.achievements;
  const fullName = [profile?.preferred_name, profile?.last_name].filter(Boolean).join(" ");
  const earned = achievements?.items.filter((item) => item.earned_at).sort((a, b) => (b.earned_at ?? "").localeCompare(a.earned_at ?? "")) ?? [];
  const next = achievements?.items.find((item) => !item.earned_at) ?? null;
  const preview = [...earned.slice(0, 2), ...(next ? [next] : [])];
  const refreshAll = async (showIndicator = false) => {
    const current = accountRequestGuard();
    if (showIndicator) setRefreshing(true);
    try { await Promise.all([refresh(), dashboard.refresh()]); }
    finally { if (current()) setRefreshing(false); }
  };
  const edit = () => router.push("/profile/edit" as Href);
  return <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }} testID="profile-screen">
    <ScrollView contentContainerStyle={[styles.pageContent, { gap: 0, paddingTop: 8 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshAll(true)} tintColor={colors.primaryButton} />}>
      <View style={[styles.sectionHeader, { marginBottom: 18 }]}><ThemedText accessibilityRole="header" style={{ fontSize: 34, lineHeight: 43, fontWeight: "800" }}>Profile</ThemedText><Pressable accessibilityRole="button" accessibilityLabel="Open Settings" testID="profile-settings-button" onPress={() => router.push("/settings")} style={styles.iconButton}><Ionicons name="settings-outline" size={25} color={colors.text} /></Pressable></View>
      {!profile ? <ScreenState colors={colors} kind={loading ? "loading" : "error"} title={loading ? "Loading your profile" : "Profile couldn’t load"} message={error ?? undefined} actionLabel={loading ? undefined : "Retry"} onAction={() => void refreshAll()} testID="profile-load-state" /> : <>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 18, paddingBottom: 22 }}><ProfileAvatar uri={avatar} name={fullName} /><View style={{ flex: 1, gap: 4 }}><ThemedText style={{ fontSize: 22, lineHeight: 29, fontWeight: "700" }}>{fullName}</ThemedText><ThemedText style={{ color: colors.icon, fontSize: 14, lineHeight: 20 }}>{profile.email}</ThemedText><Pressable onPress={edit} testID="profile-edit" accessibilityRole="button" accessibilityLabel="Edit Profile" style={[styles.link, { alignSelf: "flex-start" }]}><ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>Edit Profile</ThemedText></Pressable></View></View>
        {avatarError ? <Pressable onPress={() => void retryAvatar()} accessibilityRole="button" accessibilityLabel="Retry loading profile photo" style={styles.link}><ThemedText style={{ color: colors.primaryButton }}>Photo couldn’t load. Retry</ThemedText></Pressable> : null}
        {error || data?.incomplete || dashboard.error ? <View style={{ gap: 8, marginBottom: 16 }}><ThemedText accessibilityRole="alert" style={styles.error}>{error ?? "Some training details couldn’t load."}</ThemedText><Pressable testID="profile-retry" accessibilityRole="button" accessibilityLabel="Retry profile details" style={styles.link} onPress={() => void refreshAll()}><ThemedText style={{ color: colors.primaryButton }}>Retry</ThemedText></Pressable></View> : null}
        <View style={[styles.section, { borderColor: colors.inputBorder, flexDirection: fontScale > 1.3 ? "column" : "row", justifyContent: "space-between" }]}>
          {[{ label: "Workouts", value: achievements?.total_completed ?? data?.stats?.totalCompleted }, { label: "Active weeks", value: achievements?.current_active_weeks }, { label: "PRs this week", value: data?.stats?.prsThisWeek }].map((metric) => <View key={metric.label} style={{ flex: 1, alignItems: fontScale > 1.3 ? "flex-start" : "center", gap: 3 }} accessibilityLabel={`${metric.value ?? "Unavailable"} ${metric.label}`}><ThemedText style={{ fontSize: 26, lineHeight: 34, fontWeight: "700" }}>{metric.value ?? "—"}</ThemedText><ThemedText style={{ color: colors.icon, fontSize: 12, lineHeight: 18 }}>{metric.label}</ThemedText></View>)}
        </View>
        <View style={[styles.section, { borderColor: colors.inputBorder }]}><View style={styles.sectionHeader}><ThemedText style={styles.heading}>Training rhythm</ThemedText><ThemedText style={{ color: colors.icon, fontSize: 13 }}>Last 12 weeks</ThemedText></View>
          {achievements ? <><View style={{ flexDirection: "row", gap: 6 }}>{achievements.weekly_activity.map((week) => <View key={week.week_start} style={{ flex: 1, gap: 6, alignItems: "center" }} accessible accessibilityLabel={`Week of ${week.week_start}: ${week.completed_workouts} completed workouts${week.is_current ? ", this week" : ""}`}><View style={{ width: "100%", height: 27, borderRadius: 5, borderWidth: week.is_current ? 2 : 0, borderColor: colors.primaryButton, backgroundColor: week.completed_workouts ? colors.primaryButton : colors.inputBorder }} /></View>)}</View><ThemedText style={{ color: colors.icon, fontSize: 12, lineHeight: 18 }}>Purple: a completed workout · Outline: this week</ThemedText></> : <ThemedText style={{ color: colors.icon }}>Your training rhythm will appear here.</ThemedText>}
        </View>
        <View style={[styles.section, { borderColor: colors.inputBorder }]}><View style={styles.sectionHeader}><ThemedText style={styles.heading}>Body stats</ThemedText><Pressable onPress={edit} testID="profile-edit-body" accessibilityRole="button" accessibilityLabel="Edit body statistics" style={styles.link}><ThemedText style={{ color: colors.primaryButton }}>Edit</ThemedText></Pressable></View><View style={{ flexDirection: fontScale > 1.3 ? "column" : "row", gap: 18 }}>{[{ label: "Weight", value: profile.weight === null ? "—" : `${formatWeightInput(fromKg(toKg(profile.weight, profile.weight_unit), unit))} ${unit.toLowerCase()}` }, { label: "Age", value: profile.age ?? "—" }, { label: "Gender", value: profile.gender ?? "—" }].map((field) => <View key={field.label} style={{ flex: 1, gap: 5 }}><ThemedText style={{ fontWeight: "700" }}>{field.value}</ThemedText><ThemedText style={{ color: colors.icon, fontSize: 13 }}>{field.label}</ThemedText></View>)}</View></View>
        <View style={[styles.section, { borderColor: colors.inputBorder }]}><View style={styles.sectionHeader}><ThemedText style={styles.heading}>Achievements</ThemedText><Pressable onPress={() => router.push("/profile/achievements" as Href)} testID="profile-achievements" accessibilityRole="button" accessibilityLabel="View all achievements" style={styles.link}><ThemedText style={{ color: colors.primaryButton }}>View all</ThemedText></Pressable></View>{preview.map((item) => <AchievementRow key={item.id} item={item} />)}{achievements?.total_completed === 0 ? <ThemedText style={{ color: colors.icon }}>Your first milestone is ahead. Complete one workout to begin.</ThemedText> : null}</View>
        <View style={[styles.section, { borderColor: colors.inputBorder }]}><View style={styles.sectionHeader}><ThemedText style={styles.heading}>Recent training</ThemedText><Pressable onPress={() => router.push("/workout/history")} testID="profile-workout-history" accessibilityRole="button" accessibilityLabel="View Workout History" style={styles.link}><ThemedText style={{ color: colors.primaryButton }}>View all</ThemedText></Pressable></View>{data?.history?.map((session) => <Pressable key={session.id} testID={`profile-session-${session.id}`} onPress={() => router.push({ pathname: "/workout/history/[sessionId]", params: { sessionId: session.id } })} accessibilityRole="button" accessibilityLabel={`Open ${session.title}`} style={{ flexDirection: "row", gap: 12, alignItems: "center", minHeight: 66 }}><Ionicons name="barbell-outline" size={25} color={colors.icon} /><View style={{ flex: 1 }}><ThemedText style={{ fontWeight: "600" }}>{session.title}</ThemedText><ThemedText style={{ color: colors.icon, fontSize: 13, lineHeight: 20 }}>{session.completedAt ? new Date(session.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : session.workoutDate} · {session.setCount} sets</ThemedText></View><Ionicons name="chevron-forward" size={18} color={colors.icon} /></Pressable>)}{data?.history?.length === 0 ? <ScreenState colors={colors} kind="empty" title="No completed workouts yet" message="Finish your first workout to see it here." actionLabel="View your workouts" onAction={() => router.push("/(tabs)")} /> : null}</View>
        {data?.stats ? <ThemedText style={{ color: colors.icon, fontSize: 13, paddingBottom: 20 }}>Total volume: {Math.round(fromKg(data.stats.totalVolumeKg, unit)).toLocaleString()} {unit.toLowerCase()}</ThemedText> : null}
        <Pressable testID="profile-logout" accessibilityRole="button" accessibilityLabel="Log out" disabled={loggingOut} accessibilityState={{ disabled: loggingOut, busy: loggingOut }} style={[styles.button, { borderWidth: 1, borderColor: colors.inputBorder, opacity: loggingOut ? 0.5 : 1 }]} onPress={async () => { setLoggingOut(true); setLogoutError(false); try { if (token) await unregisterCurrentDevice(token).catch(() => {}); await logOut(); } catch { setLogoutError(true); } finally { setLoggingOut(false); } }}><ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>{loggingOut ? "Logging out…" : "Log out"}</ThemedText></Pressable>{logoutError ? <ThemedText accessibilityRole="alert" style={styles.error}>Couldn’t log out. Please try again.</ThemedText> : null}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
