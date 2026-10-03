import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Fonts } from "@/constants/theme";
import type { CoachFeedItem, CoachFeedItemKind } from "@/interfaces/coach";
import { coachItemPresentation } from "@/utils/coachItemBody";
import type { WeightUnit } from "@/utils/weightUnits";

export interface CoachPalette {
  canvas: string;
  surface: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  signal: string;
  signalSoft: string;
  success: string;
  neutralNode: string;
  separator: string;
  error: string;
  errorSoft: string;
}

const KIND_PRESENTATION: Record<
  CoachFeedItemKind,
  {
    label: string;
    node: "action" | "guidance" | "progress" | "program";
    action: string;
  }
> = {
  progression: { label: "ACTION", node: "action", action: "Review suggestion" },
  recovery: { label: "GUIDANCE", node: "guidance", action: "Open workout" },
  missed_workout: { label: "ACTION", node: "action", action: "Review workout" },
  personal_record: { label: "PROGRESS", node: "progress", action: "View workout" },
  consistency: { label: "PROGRESS", node: "progress", action: "View history" },
  program_review: { label: "PROGRAM", node: "program", action: "Review program" },
  health_context: { label: "GUIDANCE", node: "guidance", action: "Health settings" },
};

const UNKNOWN_PRESENTATION = {
  label: "GUIDANCE",
  node: "program" as const,
  action: "Open",
};

function actionLabel(item: CoachFeedItem, fallback: string) {
  if (item.kind !== "health_context") return fallback;
  switch (item.target.type) {
    case "settings":
      return item.target.section === "health" ? "Health settings" : "Open settings";
    case "active_workout":
    case "planned_workout":
      return "Open workout";
    case "completed_session":
      return "View workout";
    case "program_detail":
      return "View program";
    case "program_review":
      return "Review program";
    case "none":
      return fallback;
  }
}

function timeLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  if (isToday) return `Today · ${time}`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

type Props = {
  item: CoachFeedItem;
  palette: CoachPalette;
  expanded: boolean;
  busy: boolean;
  isLast: boolean;
  weightUnit: WeightUnit | null;
  dumbbellWeights: number[];
  plateWeights: number[];
  historical?: boolean;
  onToggleDetail: () => void;
  onPrimaryAction: () => void;
  onDismiss: () => void;
};

export function CoachBriefingItem({
  item,
  palette,
  expanded,
  busy,
  isLast,
  weightUnit,
  dumbbellWeights,
  plateWeights,
  historical = false,
  onToggleDetail,
  onPrimaryAction,
  onDismiss,
}: Props) {
  const presentation = KIND_PRESENTATION[item.kind] ?? UNKNOWN_PRESENTATION;
  const primaryActionLabel = actionLabel(item, presentation.action);
  const { body, adjustmentNote } = coachItemPresentation(item, weightUnit, dumbbellWeights, plateWeights);
  const hasDestination = !historical && item.target.type !== "none";
  const nodeStyle =
    presentation.node === "action"
      ? { backgroundColor: palette.accent, borderColor: palette.accent }
      : presentation.node === "guidance"
        ? { backgroundColor: palette.canvas, borderColor: palette.signal }
        : presentation.node === "progress"
          ? { backgroundColor: palette.canvas, borderColor: palette.success }
          : { backgroundColor: palette.neutralNode, borderColor: palette.neutralNode };
  const nodeRound = presentation.node === "progress" || presentation.node === "program";
  const labelColors =
    presentation.node === "action"
      ? { color: palette.accent, backgroundColor: palette.accentSoft }
      : presentation.node === "guidance"
        ? { color: palette.signal, backgroundColor: palette.signalSoft }
        : { color: palette.ink2, backgroundColor: palette.surface };

  return (
    <View
      testID={`coach-item-${item.id}`}
      style={styles.row}
    >
      <View style={styles.railColumn} importantForAccessibility="no-hide-descendants">
        <View
          style={[
            styles.node,
            nodeRound && styles.roundNode,
            nodeStyle,
          ]}
        />
        {!isLast ? (
          <View style={[styles.rail, { backgroundColor: palette.separator }]} />
        ) : null}
      </View>

      <View style={styles.copy}>
        <View style={styles.metaRow}>
          <View testID={`coach-item-kind-${item.kind}`} style={[styles.kindLabel, labelColors]}>
            <ThemedText style={[styles.kindText, { color: labelColors.color }]}>
              {presentation.label}
            </ThemedText>
          </View>
          <ThemedText style={[styles.meta, { color: palette.ink3 }]}>
            {timeLabel(item.createdAt)}
          </ThemedText>
          {!historical ? !item.readAt ? (
            <ThemedText
              testID={`coach-item-new-${item.id}`}
              style={[styles.newLabel, { color: palette.accent }]}
            >
              NEW
            </ThemedText>
          ) : <View testID={`coach-item-read-${item.id}`} style={styles.stateMarker} /> : null}
          {item.isAiAssisted ? (
            <ThemedText
              testID={`coach-item-ai-${item.id}`}
              accessibilityLabel="AI-assisted wording"
              style={[styles.aiLabel, { color: palette.ink3 }]}
            >
              AI-assisted
            </ThemedText>
          ) : null}
        </View>

        <ThemedText style={[styles.title, { color: palette.ink }]}>
          {item.title}
        </ThemedText>
        <ThemedText style={[styles.body, { color: palette.ink2 }]}>
          {body}
        </ThemedText>
        {adjustmentNote ? (
          <ThemedText
            testID={`coach-item-load-note-${item.id}`}
            style={[styles.loadNote, { color: palette.ink3 }]}
          >
            {adjustmentNote}
          </ThemedText>
        ) : null}

        {expanded && item.detail ? (
          <View
            testID={`coach-item-detail-${item.id}`}
            accessibilityLiveRegion="polite"
            style={[styles.detail, { borderLeftColor: palette.separator }]}
          >
            <ThemedText style={[styles.detailText, { color: palette.ink2 }]}>
              {item.detail}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.actions}>
          {hasDestination ? (
            <Pressable
              testID={`coach-item-action-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${primaryActionLabel}: ${item.title}`}
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={onPrimaryAction}
              style={[
                styles.primaryAction,
                { borderColor: palette.separator, opacity: busy ? 0.5 : 1 },
              ]}
            >
              <ThemedText style={[styles.primaryActionText, { color: palette.accent }]}>
                {primaryActionLabel}
              </ThemedText>
            </Pressable>
          ) : null}
          {item.detail ? (
            <Pressable
              testID={`coach-item-why-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${expanded ? "Hide" : "Show"} reasoning for ${item.title}`}
              accessibilityState={{ expanded, disabled: busy }}
              disabled={busy}
              onPress={onToggleDetail}
              style={styles.detailAction}
            >
              <ThemedText style={[styles.detailActionText, { color: palette.ink2 }]}>
                {expanded ? "Hide reasoning" : "Why this"}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
        {!historical ? (
          <Pressable
            testID={`coach-item-dismiss-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${presentation.label.toLowerCase()} item: ${item.title}`}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            hitSlop={8}
            onPress={onDismiss}
            style={styles.overflow}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={palette.ink3} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  railColumn: {
    width: 22,
    alignItems: "center",
  },
  node: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1.5,
    marginTop: 7,
    zIndex: 2,
  },
  roundNode: {
    borderRadius: 5,
  },
  rail: {
    width: StyleSheet.hairlineWidth,
    flex: 1,
    marginTop: 4,
    marginBottom: -22,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    paddingBottom: 22,
    position: "relative",
  },
  metaRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 7,
    rowGap: 4,
    paddingRight: 34,
  },
  kindLabel: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  kindText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: "700",
    letterSpacing: 0.85,
  },
  meta: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
  },
  newLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  aiLabel: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  stateMarker: {
    width: 1,
    height: 1,
  },
  overflow: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    lineHeight: 22.5,
    fontWeight: "600",
    marginTop: 2,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 20.25,
    marginTop: 5,
  },
  loadNote: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 5,
  },
  detail: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    marginTop: 12,
  },
  detailText: {
    fontSize: 13.5,
    lineHeight: 20.25,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  primaryAction: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  detailAction: {
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  detailActionText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
});
