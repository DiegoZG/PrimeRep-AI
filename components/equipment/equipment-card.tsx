import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { AnimatedCheckmark } from "@/components/animated-checkmark";
import { equipmentIcons } from "@/constants/equipment/equipmentIcons";
import { EquipmentCategory } from "@/constants/equipment/types";
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
  iconKey?: string;
  imageUrl?: string;
  category?: EquipmentCategory;
  quiet?: boolean;
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
  iconKey,
  imageUrl,
  category,
  quiet = false,
}: EquipmentCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  // Determine which icon/image to show
  const iconToUse = iconKey || id;
  const localIcon = equipmentIcons[iconToUse];

  // Render icon/image with fallback chain
  const renderIcon = () => {
    // Priority 1: Remote image URL
    if (imageUrl) {
      return (
        <Image
          source={{ uri: imageUrl }}
          style={styles.equipmentIcon}
          contentFit="contain"
          transition={200}
        />
      );
    }

    // Priority 2: Local icon asset
    if (localIcon) {
      return (
        <Image
          source={localIcon}
          style={styles.equipmentIcon}
          contentFit="contain"
        />
      );
    }

    // Priority 3: Category-based placeholder or first letter
    return (
      <Text
        style={[styles.iconPlaceholderText, { color: colors.placeholder }]}
        {...(quiet ? { allowFontScaling: false, accessible: false } : {})}
      >
        {name.charAt(0).toUpperCase()}
      </Text>
    );
  };

  if (quiet) {
    return (
      <View
        accessible={false}
        style={[
          styles.quietCard,
          {
            backgroundColor: colors.inputBackground,
            borderColor: selected ? colors.primaryButton : colors.inputBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={onPress}
          accessibilityRole="checkbox"
          accessibilityLabel={subtitle ? `${name}, ${subtitle}` : name}
          accessibilityState={{ checked: selected }}
          style={styles.quietSelection}
          activeOpacity={0.7}
        >
          <View
            accessible={false}
            style={[
              styles.iconPlaceholder,
              { backgroundColor: colors.inputBorder },
            ]}
          >
            {renderIcon()}
          </View>
          <View style={styles.equipmentInfo}>
            <Text style={[styles.equipmentName, { color: colors.text }]}>
              {name}
            </Text>
            {subtitle && (
              <Text style={[styles.weightsText, { color: colors.icon }]}>
                {subtitle}
              </Text>
            )}
          </View>
          <View
            accessible={false}
            style={[
              styles.checkbox,
              {
                backgroundColor: selected ? colors.primaryButton : "transparent",
                borderColor: selected ? colors.primaryButton : colors.inputBorder,
              },
            ]}
          >
            <AnimatedCheckmark visible={selected}>
              <Ionicons
                name="checkmark"
                size={16}
                color="#FFFFFF"
                accessible={false}
                allowFontScaling={false}
              />
            </AnimatedCheckmark>
          </View>
        </TouchableOpacity>
        {subtitle && showEditButton && onPressEdit && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onPressEdit();
            }}
            accessibilityRole="button"
            accessibilityLabel={`${editLabel} ${name}`}
            activeOpacity={0.7}
            style={styles.quietEditButton}
          >
            <Text style={[styles.editButtonText, { color: colors.text }]}>
              {editLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

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
        {renderIcon()}
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
  quietCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  quietSelection: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    gap: 12,
  },
  quietEditButton: {
    alignSelf: "flex-start",
    marginLeft: 60,
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    paddingVertical: 8,
  },
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
