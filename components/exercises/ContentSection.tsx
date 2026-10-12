import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { WorkoutText } from "@/components/workout/WorkoutText";
import { Colors, Fonts } from "@/constants/theme";

interface ContentSectionProps {
  title: string;
  content?: string | null;
  colors: typeof Colors.light;
  /** Renders as an always-expanded highlighted card instead of a collapsible row. */
  highlight?: boolean;
  /** Icon shown next to the title (defaults differ for highlight vs. regular). */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Starts expanded when not in highlight mode. */
  defaultExpanded?: boolean;
  testID?: string;
  detailPresentation?: boolean;
}

/**
 * A single piece of exercise content (how-to, why-it-works, common mistakes,
 * beginner notes). Renders nothing when `content` is empty so callers can
 * unconditionally render every section.
 *
 * Two visual modes:
 * - `highlight`: always-expanded card with a tinted background (beginner notes)
 * - default: collapsible row, tap header to expand/collapse
 */
export function ContentSection({
  title,
  content,
  colors,
  highlight = false,
  icon,
  defaultExpanded = false,
  testID,
  detailPresentation = false,
}: ContentSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const SectionText = detailPresentation ? WorkoutText : ThemedText;

  if (!content) return null;

  if (highlight) {
    return (
      <View
        testID={testID}
        style={{
          backgroundColor: detailPresentation ? colors.inputBackground : `${colors.primaryButton}14`,
          borderWidth: 1,
          borderColor: detailPresentation ? colors.inputBorder : `${colors.primaryButton}40`,
          borderRadius: 16,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Ionicons name={icon || "sparkles"} size={18} color={detailPresentation ? colors.icon : colors.primaryButton} />
          <SectionText
            type="defaultSemiBold"
            style={{ fontSize: 15, color: detailPresentation ? colors.text : colors.primaryButton, ...(detailPresentation ? { flex: 1 } : {}) }}
          >
            {title}
          </SectionText>
        </View>
        <SectionText style={{ fontSize: 14, lineHeight: 21 }}>{content}</SectionText>
      </View>
    );
  }

  return (
    <View
      testID={testID}
      style={{
        borderRadius: 16,
        backgroundColor: colors.inputBackground,
        ...(detailPresentation ? { borderWidth: 1, borderColor: colors.inputBorder } : {}),
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityLabel={detailPresentation ? title : undefined}
        {...(detailPresentation ? { testID: testID ? `${testID}-toggle` : undefined, accessibilityRole: "button" as const, accessibilityState: { expanded } } : {})}
        onPress={() => setExpanded((prev) => !prev)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 14,
          ...(detailPresentation ? { minHeight: 44, gap: 10 } : {}),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          {icon && <Ionicons name={icon} size={18} color={colors.text} />}
          <SectionText type="defaultSemiBold" style={{ fontSize: 15, ...(detailPresentation ? { flex: 1 } : {}) }}>
            {title}
          </SectionText>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={detailPresentation ? colors.icon : colors.placeholder}
        />
      </Pressable>
      {expanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <SectionText
            style={{ fontSize: 14, lineHeight: 21, color: colors.text, fontFamily: Fonts.sans }}
          >
            {content}
          </SectionText>
        </View>
      )}
    </View>
  );
}
