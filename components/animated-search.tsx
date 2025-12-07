import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface AnimatedSearchProps {
  placeholder?: string;
  value: string;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onPress?: () => void; // For navigation when used as a button
  editable?: boolean; // Whether the input is editable
}

export function AnimatedSearch({
  placeholder = "Search for equipment",
  value,
  onChangeText,
  onFocus,
  onBlur,
  onPress,
  editable = true,
}: AnimatedSearchProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [isFocused, setIsFocused] = useState(false);

  // Only initialize animation values when used as an editable input (not a button)
  const scale = useSharedValue(1);
  const borderWidth = useSharedValue(1);
  const borderColor = useSharedValue(colors.inputBorder);

  const handleFocus = () => {
    if (onPress) {
      // If onPress is provided, navigate instead of focusing
      onPress();
      return;
    }
    setIsFocused(true);
    scale.value = withSpring(1.02, { damping: 15, stiffness: 300 });
    borderWidth.value = withTiming(2, { duration: 200 });
    borderColor.value = withTiming(colors.primaryButton, { duration: 200 });
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    borderWidth.value = withTiming(1, { duration: 200 });
    borderColor.value = withTiming(colors.inputBorder, { duration: 200 });
    onBlur?.();
  };

  const animatedStyle = useAnimatedStyle(() => {
    // No animations when used as a button
    if (onPress) {
      return {
        borderWidth: 1,
        borderColor: colors.inputBorder,
      };
    }
    return {
      transform: [{ scale: scale.value }],
      borderWidth: borderWidth.value,
      borderColor: borderColor.value,
    };
  });

  const content = (
    <>
      <Ionicons
        name="search"
        size={20}
        color={isFocused ? colors.primaryButton : colors.placeholder}
        style={styles.searchIcon}
      />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        editable={editable && !onPress}
        pointerEvents={onPress ? "none" : "auto"}
      />
    </>
  );

  if (onPress) {
    // Simple button without animations
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.inputBackground,
              borderWidth: 1,
              borderColor: colors.inputBorder,
            },
          ]}
        >
          {content}
        </View>
      </TouchableOpacity>
    );
  }

  // Editable input with animations
  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.inputBackground,
        },
        animatedStyle,
      ]}
    >
      {content}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchIcon: {
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "400",
    fontFamily: Fonts.sans,
  },
});
