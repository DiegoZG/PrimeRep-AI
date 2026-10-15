import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedCheckmark } from "@/components/animated-checkmark";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { EquipmentWeightsContext } from "@/utils/equipmentWeightsContext";
import { OnboardingContext } from "@/utils/onboardingContext";

export const DUMBBELL_WEIGHTS = [
  2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 35, 40, 45,
  50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125,
];
export const PLATE_WEIGHTS = [1.25, 2.5, 5, 10, 15, 20, 25, 35, 45, 50];

type Props = {
  kind: "dumbbell" | "plate";
  mode: "onboarding" | "settings";
};

export function EquipmentWeightEditor({ kind, mode }: Props) {
  const router = useRouter();
  const { data, updateField } = useContext(OnboardingContext);
  const persisted = useContext(EquipmentWeightsContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const options = kind === "dumbbell" ? DUMBBELL_WEIGHTS : PLATE_WEIGHTS;
  const field = kind === "dumbbell" ? "dumbbellWeights" : "plateWeights";
  const title = kind === "dumbbell" ? "Dumbbells" : "Plates";
  const initial =
    mode === "settings"
      ? persisted[field]
      : data[field] === undefined
        ? options
        : data[field];
  const [selectedWeights, setSelectedWeights] = useState(
    () => new Set(initial)
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (mode !== "onboarding") return;
    updateField(
      field,
      Array.from(selectedWeights).sort((a, b) => a - b)
    );
  }, [field, mode, selectedWeights, updateField]);

  const handleToggleWeight = (weight: number) => {
    setSelectedWeights((previous) => {
      const next = new Set(previous);
      if (next.has(weight)) next.delete(weight);
      else next.add(weight);
      return next;
    });
  };

  const handleToggleAll = () => {
    setSelectedWeights(
      selectedWeights.size === options.length ? new Set() : new Set(options)
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const selected = Array.from(selectedWeights).sort((a, b) => a - b);
      await persisted.update({
        dumbbellWeights:
          kind === "dumbbell" ? selected : persisted.dumbbellWeights,
        plateWeights: kind === "plate" ? selected : persisted.plateWeights,
      });
      router.back();
    } catch {
      Alert.alert("Could not save", "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const allSelected = selectedWeights.size === options.length;

  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;

  return (
    <ThemedView style={[styles.container, mode === "settings" && { paddingTop: insets.top }]}>
      {mode === "settings" && (
        <View style={styles.settingsHeader}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Back from ${title}`} onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
          {!largeText && <Text accessibilityRole="header" style={[styles.settingsTitle, { color: colors.text }]}>{title}</Text>}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Save ${title}`} accessibilityState={{ disabled: isSaving, busy: isSaving }} onPress={handleSave} disabled={isSaving} hitSlop={10} style={styles.saveButton}>
            <Text style={[styles.saveText, { color: colors.primaryButton }]}>
              {isSaving ? "Saving…" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView
        testID="equipment-weight-scroll"
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, mode === "settings" && { paddingBottom: 40 + insets.bottom }]}
        contentInsetAdjustmentBehavior={mode === "onboarding" ? "automatic" : "never"}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, largeText && styles.stackedHeader]}>
          {(mode === "onboarding" || largeText) && (
            <Text testID="equipment-weight-title" accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
          )}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${allSelected ? "Deselect all" : "Select all"} ${title.toLowerCase()}`} onPress={handleToggleAll} style={styles.toggleAllButton}>
            <Text style={[styles.toggleAllText, { color: colors.text }]}>
              {allSelected ? "Deselect all" : "Select all"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weightsList}>
          {options.map((weight) => {
            const isSelected = selectedWeights.has(weight);
            return (
              <TouchableOpacity
                key={weight}
                accessible
                accessibilityRole="checkbox"
                accessibilityLabel={`${weight} lb`}
                accessibilityState={{ checked: isSelected }}
                onPress={() => handleToggleWeight(weight)}
                style={[styles.weightRow, { borderBottomColor: colors.inputBorder }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.weightText, { color: colors.text }]}>
                  {weight} lb
                </Text>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: isSelected ? colors.primaryButton : "transparent",
                      borderColor: isSelected ? colors.primaryButton : colors.inputBorder,
                    },
                  ]}
                >
                  <AnimatedCheckmark visible={isSelected}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" accessible={false} allowFontScaling={false} />
                  </AnimatedCheckmark>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

export function EquipmentWeightSettingsEditor({
  kind,
}: Pick<Props, "kind">) {
  const persisted = useContext(EquipmentWeightsContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  if (!persisted.hasLoaded) {
    return (
      <ThemedView style={styles.loadingContainer}>
        {persisted.isLoading ? (
          <ActivityIndicator color={colors.primaryButton} />
        ) : (
          <TouchableOpacity
            onPress={() => void persisted.refresh().catch(() => {})}
          >
            <Text
              style={[styles.retryText, { color: colors.primaryButton }]}
            >
              {persisted.error ?? "Load equipment weights"} Tap to retry.
            </Text>
          </TouchableOpacity>
        )}
      </ThemedView>
    );
  }

  return <EquipmentWeightEditor kind={kind} mode="settings" />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  retryText: { textAlign: "center", fontSize: 15, fontWeight: "600" },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  saveButton: { minWidth: 54, minHeight: 44, flexShrink: 1, marginLeft: 12, alignItems: "flex-end", justifyContent: "center" },
  settingsTitle: { flex: 1, marginHorizontal: 8, textAlign: "center", fontSize: 20, fontWeight: "700", fontFamily: Fonts.sans },
  saveText: { minWidth: 54, textAlign: "right", fontSize: 16, fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    columnGap: 12,
    rowGap: 8,
  },
  stackedHeader: { flexDirection: "column", alignItems: "flex-start" },
  title: { flexShrink: 1, fontSize: 28, fontWeight: "700", fontFamily: Fonts.sans },
  toggleAllButton: { minWidth: 44, minHeight: 44, maxWidth: "100%", paddingVertical: 8, justifyContent: "center" },
  toggleAllText: { fontSize: 16, fontWeight: "600", fontFamily: Fonts.sans },
  weightsList: { paddingHorizontal: 24 },
  weightRow: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  weightText: { flexShrink: 1, paddingRight: 12, fontSize: 16, fontWeight: "400", fontFamily: Fonts.sans },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
