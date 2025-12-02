import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { AnimatedCheckmark } from "@/components/animated-checkmark";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface SelectableOptionCardProps {
  title: string;
  isSelected: boolean;
  onPress: () => void;
  tag?: {
    text: string;
    type: "popular" | "recommended" | "powerlifting";
  };
  showCheckbox?: boolean;
}

export function SelectableOptionCard({
  title,
  isSelected,
  onPress,
  tag,
  showCheckbox = true,
}: SelectableOptionCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const getTagBackgroundColor = () => {
    switch (tag?.type) {
      case "popular":
        return colors.primaryButton;
      case "recommended":
        return colors.primaryButton;
      case "powerlifting":
        return "rgba(155, 161, 166, 0.2)";
      default:
        return colors.primaryButton;
    }
  };

  const getTagTextColor = () => {
    switch (tag?.type) {
      case "popular":
      case "recommended":
        return "#FFFFFF";
      case "powerlifting":
        return colors.text;
      default:
        return "#FFFFFF";
    }
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View
        style={[
          styles.optionCard,
          {
            backgroundColor: isSelected
              ? "rgba(106, 79, 245, 0.12)" // 12% opacity of primaryButton
              : colors.inputBackground,
            borderColor: isSelected ? colors.primaryButton : colors.inputBorder,
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
      >
        <View style={styles.cardContent}>
          {/* Left side: Tag and Title */}
          <View style={styles.leftContent}>
            {/* Tag */}
            {tag && (
              <View
                style={[
                  styles.tag,
                  {
                    backgroundColor: getTagBackgroundColor(),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    {
                      color: getTagTextColor(),
                    },
                  ]}
                >
                  {tag.text}
                </Text>
              </View>
            )}

            {/* Title */}
            <Text style={[styles.optionTitle, { color: colors.text }]}>
              {title}
            </Text>
          </View>

          {/* Right side: Checkbox */}
          {showCheckbox && (
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: isSelected
                    ? colors.primaryButton
                    : "transparent",
                  borderColor: isSelected
                    ? colors.primaryButton
                    : colors.inputBorder,
                },
              ]}
            >
              <AnimatedCheckmark visible={isSelected}>
                <Text style={styles.checkmarkText}>✓</Text>
              </AnimatedCheckmark>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  optionCard: {
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  leftContent: {
    flex: 1,
    gap: 8,
  },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    textTransform: "uppercase",
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
