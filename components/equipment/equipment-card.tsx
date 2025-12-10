import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { AnimatedCheckmark } from "@/components/animated-checkmark";
import { equipmentIcons } from "@/constants/equipment/equipmentIcons";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface EquipmentCardProps {
  id: string;
  name: string;
  selected: boolean;
  onPress: () => void;
  subtitle?: string;
  showEditButton?: boolean;
  onPressEdit?: () => void;
  editLabel?: string;
}

export function EquipmentCard({
  id,
  name,
  selected,
  onPress,
  subtitle,
  showEditButton = false,
  onPressEdit,
  editLabel = "Edit",
}: EquipmentCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.equipmentRow,
        {
          backgroundColor: colors.inputBackground,
          borderColor: selected ? colors.primaryButton : colors.inputBorder,
        },
      ]}
      activeOpacity={0.7}
    >
      {/* Equipment Icon */}
      <View
        style={[
          styles.iconPlaceholder,
          { backgroundColor: colors.inputBorder },
        ]}
      >
        {equipmentIcons.abductor_machine ? (
          <Image
            source={equipmentIcons.abductor_machine}
            style={styles.equipmentIcon}
            resizeMode="contain"
          />
        ) : (
          <Text
            style={[styles.iconPlaceholderText, { color: colors.placeholder }]}
          >
            {name.charAt(0)}
          </Text>
        )}
      </View>

      {/* Equipment Name and Optional Subtitle */}
      <View style={styles.equipmentInfo}>
        <Text style={[styles.equipmentName, { color: colors.text }]}>
          {name}
        </Text>
        {subtitle && (
          <View style={styles.weightsRow}>
            <Text style={[styles.weightsText, { color: colors.placeholder }]}>
              {subtitle}
            </Text>
            {showEditButton && onPressEdit && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  onPressEdit();
                }}
                style={styles.editButton}
              >
                <Text
                  style={[
                    styles.editButtonText,
                    { color: colors.primaryButton },
                  ]}
                >
                  {editLabel}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Checkbox */}
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: selected ? colors.primaryButton : "transparent",
            borderColor: selected ? colors.primaryButton : colors.inputBorder,
          },
        ]}
      >
        <AnimatedCheckmark visible={selected}>
          <Text style={styles.checkmarkText}>✓</Text>
        </AnimatedCheckmark>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  equipmentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  equipmentIcon: {
    width: "150%",
    height: "150%",
  },
  iconPlaceholderText: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  equipmentInfo: {
    flex: 1,
    gap: 4,
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  weightsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  weightsText: {
    fontSize: 14,
    fontWeight: "400",
    fontFamily: Fonts.sans,
  },
  editButton: {
    paddingVertical: 2,
  },
  editButtonText: {
    fontSize: 14,
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
