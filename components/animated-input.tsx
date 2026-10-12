import React, { useState } from "react";
import { StyleSheet, TextInput, TextInputProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface AnimatedInputProps extends TextInputProps {
  style?: any;
  error?: boolean;
  authPresentation?: boolean;
}

export function AnimatedInput({
  style,
  error = false,
  authPresentation = false,
  onFocus,
  onBlur,
  ...props
}: AnimatedInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const glowOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    if (authPresentation) {
      return {
        borderColor: error ? (colorScheme === "dark" ? "#FF8B82" : "#B42318") : isFocused ? colors.text : colors.inputBorder,
        borderWidth: isFocused ? 2 : 1,
        shadowOpacity: 0,
        elevation: 0,
      };
    }
    return {
      borderColor: error ? "#D14343" : isFocused ? colors.electricBlue : colors.inputBorder,
      borderWidth: isFocused ? 2 : 1,
      shadowColor: error ? "#D14343" : colors.electricBlue,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: glowOpacity.value,
      shadowRadius: 8,
      elevation: isFocused ? 8 : 0,
    };
  });

  const handleFocus = (event: any) => {
    setIsFocused(true);
    glowOpacity.value = withTiming(0.6, { duration: 250 });
    onFocus?.(event);
  };

  const handleBlur = (event: any) => {
    setIsFocused(false);
    glowOpacity.value = withTiming(0, { duration: 250 });
    onBlur?.(event);
  };

  return (
    <AnimatedTextInput
      {...props}
      style={[
        styles.input,
        {
          backgroundColor: colors.inputBackground,
          color: colors.text,
        },
        style,
        animatedStyle,
      ]}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholderTextColor={authPresentation ? colors.icon : colors.placeholder}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
  },
});
