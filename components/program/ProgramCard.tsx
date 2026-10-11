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
  const statusLabel = program.isActive ? ", Active" : program.isScheduled ? ", Starts next week" : "";
  const warningColor = colorScheme === "dark" ? "#FF8C82" : "#D92D20";

  return (
    <Pressable
      testID={`program-card-${program.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Open ${program.name}, ${levelLabel}, ${formatProgramMeta(program.frequency, program.durationMinutes)}, ${equipmentLabel}${statusLabel}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.compact,
        { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, opacity: pressed ? 0.86 : 1 },
      ]}
    >
      <View style={styles.headingRow}>
        <View style={[styles.scopeIcon, { borderColor: colors.inputBorder }]}>
          <Ionicons name={program.scope === "private" ? "person-outline" : "sparkles-outline"} size={18} color={colors.icon} />
        </View>
        {program.isActive ? <View style={styles.activePill}><ThemedText maxFontSizeMultiplier={0} style={[styles.activeText, { color: colorScheme === "dark" ? "#6EDB91" : "#127536" }]}>Active</ThemedText></View> : null}
        {!program.isActive && program.isScheduled ? <View style={styles.scheduledPill}><ThemedText maxFontSizeMultiplier={0} style={[styles.scheduledText, { color: colorScheme === "dark" ? "#B4A5FF" : "#583BD0" }]}>Starts next week</ThemedText></View> : null}
        <Ionicons name="chevron-forward" size={20} color={colors.icon} />
      </View>
      <ThemedText maxFontSizeMultiplier={0} style={styles.name}>{program.name}</ThemedText>
      <ThemedText maxFontSizeMultiplier={0} style={[styles.description, { color: colors.icon }]}>{program.description}</ThemedText>
      <View style={styles.cadence} accessibilityLabel={`${program.frequency} training days per week`}>
        {Array.from({ length: 7 }, (_, index) => (
          <View key={index} style={[styles.cadenceMark, { backgroundColor: index < program.frequency ? colors.icon : colors.inputBorder }]} />
        ))}
      </View>
      <ThemedText maxFontSizeMultiplier={0} style={[styles.meta, { color: colors.icon }]}>{formatProgramMeta(program.frequency, program.durationMinutes)}</ThemedText>
      <View style={styles.factsRow}>
        <View style={[styles.fact, { borderColor: colors.inputBorder }]}>
          <Ionicons name="speedometer-outline" size={14} color={colors.icon} />
          <ThemedText maxFontSizeMultiplier={0} testID={`program-card-level-${program.id}`} style={[styles.factText, { color: colors.text }]}>{levelLabel}</ThemedText>
        </View>
        <View style={[styles.fact, styles.equipmentFact, { borderColor: program.equipmentCompatible === false ? warningColor : colors.inputBorder }]}>
          <Ionicons name={program.equipmentCompatible === false ? "alert-circle-outline" : "barbell-outline"} size={14} color={program.equipmentCompatible === false ? warningColor : colors.icon} />
          <ThemedText maxFontSizeMultiplier={0} testID={`program-card-equipment-${program.id}`} style={[styles.factText, { color: program.equipmentCompatible === false ? warningColor : colors.text }]}>{equipmentLabel}</ThemedText>
        </View>
      </View>
      <ThemedText maxFontSizeMultiplier={0} style={[styles.goal, { color: colors.text }]}>{PROGRAM_GOAL_LABELS[program.goal]}</ThemedText>
      {program.matchReasons?.[0] ? <ThemedText maxFontSizeMultiplier={0} style={[styles.reason, { color: colors.icon }]}>{program.matchReasons[0]}</ThemedText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 282, minHeight: 252, borderRadius: 22, borderWidth: 1, padding: 18 },
  compact: { width: "100%", minHeight: 0 },
  headingRow: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 8 },
  scopeIcon: { width: 32, height: 32, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: "auto" },
  activePill: { minHeight: 26, flexShrink: 1, borderRadius: 13, backgroundColor: "rgba(39,196,92,0.14)", paddingHorizontal: 10, justifyContent: "center" },
  activeText: { fontSize: 12, fontWeight: "700" },
  scheduledPill: { minHeight: 26, flexShrink: 1, borderRadius: 13, backgroundColor: "rgba(106,79,245,0.12)", paddingHorizontal: 10, justifyContent: "center" },
  scheduledText: { fontSize: 12, fontWeight: "700" },
  name: { marginTop: 16, fontSize: 21, lineHeight: 26, fontWeight: "800", fontFamily: Fonts.sans },
  description: { marginTop: 7, minHeight: 38, fontSize: 14, lineHeight: 19 },
  cadence: { marginTop: 16, flexDirection: "row", gap: 6 },
  cadenceMark: { height: 5, flex: 1, borderRadius: 3 },
  meta: { marginTop: 10, fontSize: 13 },
  factsRow: { marginTop: 9, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  fact: { minHeight: 28, maxWidth: "100%", borderWidth: 1, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 5 },
  equipmentFact: { flexShrink: 1 },
  factText: { flexShrink: 1, fontSize: 12, fontWeight: "700" },
  goal: { marginTop: 6, fontSize: 13, fontWeight: "700" },
  reason: { marginTop: 6, fontSize: 12, lineHeight: 17 },
});
