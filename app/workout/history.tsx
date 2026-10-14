import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useContext, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { listCompletedSessions, type SessionSummary } from "@/services/workoutLoggingService";
import { AuthContext } from "@/utils/authContext";

export default function WorkoutHistoryScreen() {
  const router = useRouter();
  const { token } = useContext(AuthContext);
  const colors = Colors[useColorScheme() ?? "light"];
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(false);
    void listCompletedSessions(token).then((response) => setSessions(response.items)).catch(() => setError(true)).finally(() => setLoading(false));
  }, [token]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <View testID="history-header" style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: largeText ? 8 : 20, gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back from Workout History" onPress={() => router.back()} hitSlop={10} style={{ minWidth: 44, minHeight: 44, flexShrink: 0, alignItems: "center", justifyContent: "center" }}><Ionicons name="chevron-back" size={28} color={colors.text} /></Pressable>
        {!largeText && <ThemedText type="title" style={{ fontSize: 24, flex: 1, minWidth: 0, flexShrink: 1 }}>Workout History</ThemedText>}
      </View>
      <ScrollView testID="history-scroll" style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, paddingVertical: 20, paddingHorizontal: largeText ? 8 : 20, gap: 12 }}>
        {largeText && <ThemedText type="title" style={{ fontSize: 24 }}>Workout History</ThemedText>}
        {loading ? <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator color={colors.primaryButton} /></View> : error ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}><ThemedText style={{ textAlign: "center" }}>Couldn’t load your history.</ThemedText><Pressable accessibilityRole="button" accessibilityLabel="Retry workout history" onPress={load} style={{ minWidth: 44, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}><Ionicons name="refresh" size={20} color={colors.icon} /><ThemedText style={{ color: colors.text, fontWeight: "700", flexShrink: 1 }}>Retry</ThemedText></Pressable></View> : sessions.length === 0 ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 4 }}><ThemedText type="defaultSemiBold" style={{ textAlign: "center" }}>No completed workouts yet</ThemedText><ThemedText style={{ color: colors.placeholder, marginTop: 6, textAlign: "center" }}>Your completed workouts will appear here.</ThemedText></View> : sessions.map((session) => (
          <Pressable key={session.id} testID={`history-session-${session.id}`} accessibilityRole="button" accessibilityLabel={`${session.title}. ${session.workoutDate} · ${session.setCount} sets. ${Math.round(session.totalVolumeKg).toLocaleString()} kg.`} onPress={() => router.push({ pathname: "/workout/history/[sessionId]", params: { sessionId: session.id } })} style={{ minHeight: 44, borderRadius: 16, padding: 16, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, flexDirection: largeText ? "column" : "row", alignItems: largeText ? "stretch" : "center" }}>
            <View style={{ flex: largeText ? undefined : 1, minWidth: 0, gap: 8 }}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 17, flexShrink: 1 }}>{session.title}</ThemedText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 }}>
                {largeText ? <><ThemedText style={{ color: colors.placeholder }}>{session.workoutDate}</ThemedText><ThemedText style={{ color: colors.placeholder }}>· {session.setCount} sets</ThemedText></> : <ThemedText style={{ color: colors.placeholder }}>{session.workoutDate} · {session.setCount} sets</ThemedText>}
                <ThemedText style={{ color: colors.placeholder }}>{Math.round(session.totalVolumeKg).toLocaleString()} kg</ThemedText>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.placeholder} style={{ marginLeft: largeText ? 0 : 8, marginTop: largeText ? 8 : 0, alignSelf: largeText ? "flex-end" : undefined, flexShrink: 0 }} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
