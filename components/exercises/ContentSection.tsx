import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
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
}: ContentSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!content) return null;

  if (highlight) {
    return (
      <View
        testID={testID}
        style={{
          backgroundColor: `${colors.primaryButton}14`,
          borderWidth: 1,
          borderColor: `${colors.primaryButton}40`,
          borderRadius: 16,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Ionicons name={icon || "sparkles"} size={18} color={colors.primaryButton} />
          <ThemedText
            type="defaultSemiBold"
            style={{ fontSize: 15, color: colors.primaryButton }}
          >
            {title}
          </ThemedText>
        </View>
        <ThemedText style={{ fontSize: 14, lineHeight: 21 }}>{content}</ThemedText>
      </View>
    );
  }

  return (
    <View
      testID={testID}
      style={{
        borderRadius: 16,
        backgroundColor: colors.inputBackground,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          {icon && <Ionicons name={icon} size={18} color={colors.text} />}
          <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>
            {title}
          </ThemedText>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.placeholder}
        />
      </Pressable>
      {expanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <ThemedText
            style={{ fontSize: 14, lineHeight: 21, color: colors.text, fontFamily: Fonts.sans }}
          >
            {content}
          </ThemedText>
        </View>
      )}
    </View>
  );
}
