import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useContext, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 20, gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back from Workout History" onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={28} color={colors.text} /></Pressable>
        <ThemedText type="title" style={{ fontSize: 26 }}>Workout History</ThemedText>
      </View>
      {loading ? <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator color={colors.primaryButton} /></View> : error ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}><ThemedText>Couldn’t load your history.</ThemedText><Pressable onPress={load}><ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>Retry</ThemedText></Pressable></View> : sessions.length === 0 ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}><ThemedText type="defaultSemiBold">No completed workouts yet</ThemedText><ThemedText style={{ color: colors.placeholder, marginTop: 6, textAlign: "center" }}>Your completed workouts will appear here.</ThemedText></View> : <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        {sessions.map((session) => (
          <Pressable key={session.id} testID={`history-session-${session.id}`} onPress={() => router.push({ pathname: "/workout/history/[sessionId]", params: { sessionId: session.id } })} style={{ borderRadius: 16, padding: 16, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}><ThemedText type="defaultSemiBold" style={{ fontSize: 17 }}>{session.title}</ThemedText><ThemedText style={{ color: colors.placeholder, marginTop: 4 }}>{session.workoutDate} · {session.setCount} sets</ThemedText></View>
            <ThemedText style={{ color: colors.placeholder }}>{Math.round(session.totalVolumeKg).toLocaleString()} kg</ThemedText><Ionicons name="chevron-forward" size={20} color={colors.placeholder} style={{ marginLeft: 8 }} />
          </Pressable>
        ))}
      </ScrollView>}
    </SafeAreaView>
  );
}
