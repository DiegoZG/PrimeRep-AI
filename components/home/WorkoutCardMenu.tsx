import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Dimensions, Modal, Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

import { MENU_WIDTH, styles } from "./workout-card-menu.styles";

// Screen dimensions for positioning calculations
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SCREEN_PADDING = 12;
const MENU_OFFSET = 20; // Gap between button and menu

export interface MenuItemConfig {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WorkoutCardMenuProps {
  visible: boolean;
  title: string;
  subtitle: string;
  items: MenuItemConfig[];
  anchorRect: AnchorRect | null;
  onDismiss: () => void;
}

interface ComputedPosition {
  top: number;
  left: number;
}

export function WorkoutCardMenu({
  visible,
  title,
  subtitle,
  items,
  anchorRect,
  onDismiss,
}: WorkoutCardMenuProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  // Calculate menu position based on anchor rect
  const computedPosition = useMemo((): ComputedPosition | null => {
    if (!anchorRect) return null;

    // Estimate menu height based on items + header
    const menuHeight = 70 + items.length * 48;

    // Position menu below the button
    let top = anchorRect.y + anchorRect.height + MENU_OFFSET;

    // Align menu's right edge with button's right edge, shifted left a bit
    const LEFT_OFFSET = 32;
    let left = anchorRect.x + anchorRect.width - MENU_WIDTH - LEFT_OFFSET;

    // If menu would overflow left edge, align to left edge of button instead
    if (left < SCREEN_PADDING) {
      left = anchorRect.x;
    }

    // If menu would still overflow left, clamp to screen padding
    if (left < SCREEN_PADDING) {
      left = SCREEN_PADDING;
    }

    // If menu would overflow right edge, clamp it
    if (left + MENU_WIDTH + SCREEN_PADDING > SCREEN_WIDTH) {
      left = SCREEN_WIDTH - MENU_WIDTH - SCREEN_PADDING;
    }

    // If menu would overflow bottom, position above the button instead
    if (top + menuHeight + SCREEN_PADDING > SCREEN_HEIGHT) {
      top = anchorRect.y - menuHeight - MENU_OFFSET;
    }

    // Clamp top to screen bounds
    if (top < SCREEN_PADDING) {
      top = SCREEN_PADDING;
    }

    return { top, left };
  }, [anchorRect, items.length]);

  if (!visible || !anchorRect || !computedPosition) {
    return null;
  }

  const { top, left } = computedPosition;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      {/* Tap outside to dismiss */}
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <View
          style={[
            styles.menuContainer,
            {
              top,
              left,
              backgroundColor: colors.inputBackground,
            },
          ]}
        >
          {/* Menu content */}
          <View style={styles.menuContent}>
            {/* Header */}
            <View style={styles.menuHeader}>
              <ThemedText
                type="defaultSemiBold"
                style={styles.menuTitle}
                numberOfLines={1}
              >
                {title}
              </ThemedText>
              <ThemedText style={styles.menuSubtitle} numberOfLines={1}>
                {subtitle}
              </ThemedText>
            </View>

            <View style={styles.menuDivider} />

            {/* Menu items */}
            {items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  item.onPress();
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={item.destructive ? "#FF3B30" : colors.text}
                />
                <ThemedText
                  style={[
                    styles.menuItemText,
                    { color: item.destructive ? "#FF3B30" : colors.text },
                  ]}
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

export default WorkoutCardMenu;
