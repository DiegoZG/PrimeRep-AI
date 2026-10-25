import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { WORKOUT_TIME_OPTIONS, type WorkoutPlanningChoice } from "@/utils/workoutPlanning";

export function WorkoutPlanningSheet({ visible, value, onClose, onApply, onDismiss, disabled = false }: {
  visible: boolean; value: WorkoutPlanningChoice; onClose: () => void;
  onApply: (choice: WorkoutPlanningChoice) => void; disabled?: boolean;
  onDismiss?: () => void;
}) {
  const colors = Colors[useColorScheme() ?? "light"];
  const { fontScale } = useWindowDimensions();
  const scrollingTitle = fontScale >= 2;
  const [mode, setMode] = useState(value.planningMode);
  const [minutes, setMinutes] = useState(value.timeBudgetMinutes ?? 35);
  const reducedMotion = useReducedMotion();
  const [rendered, setRendered] = useState(visible);
  useEffect(() => { if (visible) setRendered(true); }, [visible]);
  useEffect(() => { if (Platform.OS === "android" && !visible && rendered) { setRendered(false); onDismiss?.(); } }, [visible, rendered, onDismiss]);
  useEffect(() => { if (visible) { setMode(value.planningMode); setMinutes(value.timeBudgetMinutes ?? 35); } }, [visible, value.planningMode, value.timeBudgetMinutes]);
  if (!visible && !rendered) return null;
  return <Modal visible={visible} animationType={reducedMotion ? "none" : "slide"} presentationStyle="pageSheet" onRequestClose={onClose} onDismiss={() => { setRendered(false); onDismiss?.(); }}>
    {visible ? <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, scrollingTitle && styles.compactHeader]}>
        {!scrollingTitle ? <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Workout planning</Text> : <View style={{ flex: 1 }} />}
        <Pressable accessibilityRole="button" accessibilityLabel="Close workout planning" onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {scrollingTitle && <Text accessibilityRole="header" style={[styles.title, { color: colors.text, flex: undefined }]}>Workout planning</Text>}
        <View accessibilityRole="radiogroup" accessibilityLabel="Workout planning mode" style={styles.choices}>
          {([
            { value: "trainer_led", title: "Trainer-led", description: "Follow a complete workout chosen for you. No time limit to set." },
            { value: "time_budget", title: "Time budget", description: "Tell us how much time you have. Your workout can finish sooner." },
          ] as const).map((choice) => <Pressable key={choice.value} testID={`planning-mode-${choice.value}`} accessibilityRole="radio" accessibilityLabel={choice.title} accessibilityState={{ checked: mode === choice.value, disabled }} disabled={disabled} onPress={() => setMode(choice.value)}
            style={({ pressed }) => [styles.choice, { borderColor: mode === choice.value ? colors.primaryButton : colors.inputBorder, backgroundColor: pressed ? colors.inputBorder : colors.inputBackground }]}>
            <View style={styles.choiceText}><Text style={[styles.choiceTitle, { color: colors.text }]}>{choice.title}</Text><Text style={[styles.description, { color: colors.icon }]}>{choice.description}</Text></View>
            <Ionicons name={mode === choice.value ? "checkmark-circle" : "ellipse-outline"} size={24} color={mode === choice.value ? colors.primaryButton : colors.icon} accessible={false} />
          </Pressable>)}
        </View>
        {mode === "time_budget" && <View style={styles.choices}>
          <Text style={[styles.choiceTitle, { color: colors.text }]}>How much time do you have?</Text>
          <View style={styles.times} accessibilityRole="radiogroup" accessibilityLabel="Workout time budget">
            {WORKOUT_TIME_OPTIONS.map((duration) => <Pressable key={duration} testID={`planning-minutes-${duration}`} accessibilityRole="radio" accessibilityLabel={`Up to ${duration} minutes`} accessibilityState={{ checked: duration === minutes, disabled }} disabled={disabled} onPress={() => setMinutes(duration)}
              style={({ pressed }) => [styles.time, fontScale >= 1.5 && styles.largeTime, { borderColor: colors.inputBorder, backgroundColor: duration === minutes ? colors.primaryButton : pressed ? colors.inputBorder : colors.inputBackground }]}>
              <Text style={[styles.timeText, { color: duration === minutes ? "#FFFFFF" : colors.text }]}>{duration} min</Text>
            </Pressable>)}
          </View>
          <Text style={[styles.description, { color: colors.icon }]}>This is a maximum, not a target. We won’t add exercises just to fill the time.</Text>
        </View>}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.inputBorder }]}>
        <Pressable testID="planning-apply" accessibilityRole="button" accessibilityLabel="Use this workout planning" accessibilityState={{ disabled }} disabled={disabled} onPress={() => onApply({ planningMode: mode, timeBudgetMinutes: mode === "time_budget" ? minutes : null })}
          style={({ pressed }) => [styles.apply, { backgroundColor: colors.primaryButton, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}><Text style={styles.applyText}>Use this option</Text></Pressable>
      </View>
    </SafeAreaView> : null}
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  compactHeader: { minHeight: 44, paddingVertical: 0 },
  title: { fontFamily: Fonts.sans, fontSize: 22, fontWeight: "700", flex: 1 }, close: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 24 }, choices: { gap: 12 }, choice: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderWidth: 1, borderRadius: 14, minHeight: 72 },
  choiceText: { flex: 1, gap: 6 }, choiceTitle: { fontFamily: Fonts.sans, fontSize: 16, fontWeight: "600" }, description: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21 },
  times: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, time: { flexBasis: "22%", flexGrow: 1, minWidth: 72, minHeight: 48, paddingHorizontal: 8, paddingVertical: 12, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1 }, largeTime: { flexBasis: "45%" },
  timeText: { fontFamily: Fonts.sans, fontSize: 15, fontWeight: "600", textAlign: "center", fontVariant: ["tabular-nums"] },
  footer: { padding: 20, borderTopWidth: StyleSheet.hairlineWidth }, apply: { minHeight: 52, padding: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" }, applyText: { fontFamily: Fonts.sans, fontSize: 16, fontWeight: "700", color: "#FFFFFF", textAlign: "center" },
});
