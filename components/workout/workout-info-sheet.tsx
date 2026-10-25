import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { WorkoutText as Text } from "@/components/workout/WorkoutText";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { WorkoutDay } from "@/interfaces/workouts";
import { workoutPlanningMode, workoutTimeBudget } from "@/utils/workoutPlanning";

export function WorkoutInfoSheet({ visible, workout, locked, noticeDetails, onClose, onDismiss }: {
  visible: boolean; workout: WorkoutDay; locked: boolean; noticeDetails?: string | null; onClose: () => void; onDismiss: () => void;
}) {
  const colors = Colors[useColorScheme() ?? "light"], { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [rendered, setRendered] = useState(visible);
  useEffect(() => { if (visible) setRendered(true); }, [visible]);
  useEffect(() => { if (Platform.OS === "android" && !visible && rendered) { setRendered(false); onDismiss(); } }, [visible, rendered, onDismiss]);
  if (!visible && !rendered) return null;
  const program = Boolean(workout.programActivationId), trainer = workoutPlanningMode(workout) === "trainer_led";
  const title = <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Workout information</Text>;
  const section = (heading: string, content?: string | null) => content?.trim() ? <View style={styles.section}><Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>{heading}</Text><Text style={[styles.copy, { color: colors.icon }]}>{content}</Text></View> : null;
  return <Modal visible={visible} animationType={reducedMotion ? "none" : "slide"} presentationStyle="pageSheet" onRequestClose={onClose} onDismiss={() => { setRendered(false); onDismiss(); }}>
    {visible ? <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, fontScale >= 2 && styles.compactHeader]}>
        {fontScale < 2 ? <View style={{ flex: 1 }}>{title}</View> : <View style={{ flex: 1 }} />}
        <Pressable testID="workout-info-close" accessibilityRole="button" accessibilityLabel="Close workout information" onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
      </View>
      <ScrollView testID="workout-info-scroll" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {fontScale >= 2 && title}
        <View style={[styles.facts, { borderColor: colors.inputBorder }]}>
          {[
            ["Estimated time", `About ${workout.estimatedMinutes ?? workout.durationMinutes} min`],
            ["Workout mode", program ? "Program" : trainer ? "Trainer-led" : "Time budget"],
            ...(!program && !trainer ? [["Time budget", `${workoutTimeBudget(workout)} min maximum`]] : []),
          ].map(([label, value]) => <View key={label} style={[styles.fact, fontScale >= 1.6 && styles.stackedFact]}><Text style={[styles.copy, { color: colors.icon }]}>{label}</Text><Text style={[styles.factValue, { color: colors.text }]}>{value}</Text></View>)}
        </View>
        {section("Today's focus", workout.workoutIntent)}
        {section("Preparation and rest", program ? "Follow the rest targets on each exercise card." : "Includes preparation and rest. Your pace may vary.")}
        {section("Exercise order", "• Drag a handle or use the move buttons.\n• Your order is saved for this workout.\n• Review target changes after Start, when available.")}
        {section("Equipment update", workout.unavailableMuscles?.length ? `We couldn't add ${workout.unavailableMuscles.join(", ")} with your current equipment.` : null)}
        {section("Muscle rotation", workout.deferredMuscles?.length ? `${workout.deferredMuscles.join(", ")} will be prioritized in your next custom workout.` : null)}
        {section("Editing this workout", program ? "Duration and set targets come from your active program." : locked ? "Started and past workouts keep their original plan. You can still review workout information and resume an active session." : null)}
        {section("Exercise order update", noticeDetails)}
      </ScrollView>
    </SafeAreaView> : null}
  </Modal>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12 }, compactHeader: { minHeight: 44, paddingVertical: 0 },
  close: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }, title: { fontSize: 22, fontWeight: "700" },
  content: { padding: 20, gap: 24 }, facts: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  fact: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 8 }, stackedFact: { flexDirection: "column", alignItems: "flex-start", gap: 4 },
  factValue: { fontSize: 16, fontWeight: "600", flexShrink: 1 }, section: { gap: 8 }, sectionTitle: { fontSize: 18, fontWeight: "600" }, copy: { fontSize: 16 },
});
