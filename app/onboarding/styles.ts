import { StyleSheet } from "react-native";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function useOnboardingStyles() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 40,
      justifyContent: "center",
    },
    question: {
      fontSize: 32,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 32,
      fontFamily: Fonts.sans,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      fontSize: 16,
      color: "#11181C", // Dark text color for visibility on white background
      fontFamily: Fonts.sans,
    },
    buttonContainer: {
      paddingHorizontal: 24,
      paddingBottom: 40,
      paddingTop: 20,
      backgroundColor: colors.background,
    },
    primaryButton: {
      backgroundColor: colors.primaryButton,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
      fontFamily: Fonts.sans,
      textTransform: "uppercase",
    },
  });
}
