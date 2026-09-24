import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { ProfilePage, ProfileScroll, AchievementRow, profileStyles } from "@/components/profile-ui";
import { ScreenState } from "@/components/screen-state";
import { ThemedText } from "@/components/themed-text";
import { useAccountResource } from "@/hooks/use-account-resource";
import { getAchievements } from "@/services/profileService";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function AchievementsScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { data, loading, error, refresh } = useAccountResource(getAchievements);
  return <ProfilePage title="Achievements" onBack={() => router.back()} testID="achievements-screen"><ProfileScroll>
    {!data ? <ScreenState colors={colors} kind={loading ? "loading" : "error"} title={loading ? "Loading achievements" : "Achievements couldn’t load"} actionLabel={loading ? undefined : "Retry"} onAction={() => void refresh()} /> : <>
      <ThemedText style={{ color: colors.icon }}>Every completed workout counts. Build consistency at your own pace.</ThemedText>
      {data.total_completed === 0 ? <View style={{ paddingVertical: 12 }}><ThemedText style={profileStyles.heading}>Your first milestone is ahead</ThemedText><ThemedText style={{ color: colors.icon, marginTop: 6 }}>Complete one workout to begin.</ThemedText></View> : null}
      {error ? <ScreenState colors={colors} kind="error" title="Couldn’t refresh achievements" actionLabel="Retry" onAction={() => void refresh()} /> : null}
      {[{ kind: "workouts", title: "Workout milestones" }, { kind: "consistency", title: "Consistent weeks" }].map((group) => <View key={group.kind}><ThemedText accessibilityRole="header" style={profileStyles.heading}>{group.title}</ThemedText>{data.items.filter((item) => item.kind === group.kind).map((item) => <AchievementRow key={item.id} item={item} />)}</View>)}
      <ThemedText style={{ color: colors.icon, fontSize: 13 }}>An active week has at least one completed workout, Monday through Sunday. Rest days do not undo earned milestones.</ThemedText>
    </>}
  </ProfileScroll></ProfilePage>;
}
