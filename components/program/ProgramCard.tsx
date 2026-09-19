import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { ProgramSummary } from "@/interfaces/programs";
import { PROGRAM_GOAL_LABELS, PROGRAM_LEVEL_LABELS, formatProgramMeta } from "@/utils/programDisplay";

function equipmentFitLabel(program: ProgramSummary): string {
  if (program.equipmentCompatible === null || program.equipmentCompatible === undefined) {
    return "Equipment not set";
  }
  if (program.equipmentCompatible) return "Equipment ready";
  const missingCount = program.missingEquipmentIds.length;
  return missingCount > 0
    ? `${missingCount} ${missingCount === 1 ? "item" : "items"} missing`
    : "Equipment needs review";
}

export function ProgramCard({ program, onPress, compact = false }: { program: ProgramSummary; onPress: () => void; compact?: boolean }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const levelLabel = PROGRAM_LEVEL_LABELS[program.level];
  const equipmentLabel = equipmentFitLabel(program);

  return (
    <Pressable
      testID={`program-card-${program.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Open ${program.name}, ${levelLabel}, ${formatProgramMeta(program.frequency, program.durationMinutes)}, ${equipmentLabel}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.compact,
        { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, opacity: pressed ? 0.86 : 1 },
      ]}
    >
      <View style={styles.headingRow}>
        <View style={[styles.scopeIcon, { backgroundColor: program.scope === "private" ? "rgba(0,212,255,0.13)" : "rgba(106,79,245,0.12)" }]}>
          <Ionicons name={program.scope === "private" ? "person-outline" : "sparkles-outline"} size={18} color={program.scope === "private" ? "#009FC4" : colors.primaryButton} />
        </View>
        {program.isActive ? <View style={styles.activePill}><ThemedText style={styles.activeText}>Active</ThemedText></View> : null}
        {!program.isActive && program.isScheduled ? <View style={styles.scheduledPill}><ThemedText style={styles.scheduledText}>Starts next week</ThemedText></View> : null}
        <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
      </View>
      <ThemedText numberOfLines={2} style={styles.name}>{program.name}</ThemedText>
      <ThemedText numberOfLines={compact ? 2 : 3} style={[styles.description, { color: colors.placeholder }]}>{program.description}</ThemedText>
      <View style={styles.cadence} accessibilityLabel={`${program.frequency} training days per week`}>
        {Array.from({ length: 7 }, (_, index) => (
          <View key={index} style={[styles.cadenceMark, { backgroundColor: index < program.frequency ? colors.primaryButton : colors.inputBorder }]} />
        ))}
      </View>
      <ThemedText style={[styles.meta, { color: colors.placeholder }]}>{formatProgramMeta(program.frequency, program.durationMinutes)}</ThemedText>
      <View style={styles.factsRow}>
        <View style={[styles.fact, { backgroundColor: "rgba(106,79,245,0.09)" }]}>
          <Ionicons name="speedometer-outline" size={14} color={colors.primaryButton} />
          <ThemedText testID={`program-card-level-${program.id}`} numberOfLines={1} style={[styles.factText, { color: colors.primaryButton }]}>{levelLabel}</ThemedText>
        </View>
        <View style={[styles.fact, styles.equipmentFact, { backgroundColor: program.equipmentCompatible === false ? "rgba(217,45,32,0.08)" : "rgba(0,159,196,0.09)" }]}>
          <Ionicons name={program.equipmentCompatible === false ? "alert-circle-outline" : "barbell-outline"} size={14} color={program.equipmentCompatible === false ? "#D92D20" : "#0087A6"} />
          <ThemedText testID={`program-card-equipment-${program.id}`} numberOfLines={1} style={[styles.factText, { color: program.equipmentCompatible === false ? "#D92D20" : "#0087A6" }]}>{equipmentLabel}</ThemedText>
        </View>
      </View>
      <ThemedText style={[styles.goal, { color: colors.primaryButton }]}>{PROGRAM_GOAL_LABELS[program.goal]}</ThemedText>
      {program.matchReasons?.[0] ? <ThemedText numberOfLines={2} style={[styles.reason, { color: colors.placeholder }]}>{program.matchReasons[0]}</ThemedText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 282, minHeight: 252, borderRadius: 22, borderWidth: 1, padding: 18 },
  compact: { width: "100%", minHeight: 0 },
  headingRow: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 8 },
  scopeIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: "auto" },
  activePill: { minHeight: 26, borderRadius: 13, backgroundColor: "rgba(39,196,92,0.14)", paddingHorizontal: 10, justifyContent: "center" },
  activeText: { color: "#168A3D", fontSize: 12, fontWeight: "700" },
  scheduledPill: { minHeight: 26, borderRadius: 13, backgroundColor: "rgba(106,79,245,0.12)", paddingHorizontal: 10, justifyContent: "center" },
  scheduledText: { color: "#6A4FF5", fontSize: 12, fontWeight: "700" },
  name: { marginTop: 16, fontSize: 21, lineHeight: 26, fontWeight: "800", fontFamily: Fonts.sans },
  description: { marginTop: 7, minHeight: 38, fontSize: 14, lineHeight: 19 },
  cadence: { marginTop: 16, flexDirection: "row", gap: 6 },
  cadenceMark: { height: 5, flex: 1, borderRadius: 3 },
  meta: { marginTop: 10, fontSize: 13 },
  factsRow: { marginTop: 9, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  fact: { minHeight: 28, maxWidth: "100%", borderRadius: 9, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  equipmentFact: { flexShrink: 1 },
  factText: { flexShrink: 1, fontSize: 12, fontWeight: "700" },
  goal: { marginTop: 6, fontSize: 13, fontWeight: "700" },
  reason: { marginTop: 6, fontSize: 12, lineHeight: 17 },
});
