import React, { useContext, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { AnimatedCheckmark } from "@/components/animated-checkmark";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { OnboardingContext } from "@/utils/onboardingContext";

export default function EditDumbbellsScreen() {
  const { data, updateField } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  // Generate dumbbell weights: 2.5-30lb in 2.5 increments, then 35-125lb in 5 increments
  const dumbbellWeights: number[] = [];
  for (let i = 2.5; i <= 30; i += 2.5) {
    dumbbellWeights.push(i);
  }
  for (let i = 35; i <= 125; i += 5) {
    dumbbellWeights.push(i);
  }

  const [selectedWeights, setSelectedWeights] = useState<Set<number>>(() => {
    // Use existing weights from context if explicitly set (even if empty),
    // otherwise use defaults
    if (data.dumbbellWeights !== undefined) {
      return new Set(data.dumbbellWeights);
    }
    return new Set(dumbbellWeights); // All selected by default
  });

  useEffect(() => {
    // Save selected weights to context
    updateField(
      "dumbbellWeights",
      Array.from(selectedWeights).sort((a, b) => a - b)
    );
  }, [selectedWeights, updateField]);

  const handleToggleWeight = (weight: number) => {
    setSelectedWeights((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(weight)) {
        newSet.delete(weight);
      } else {
        newSet.add(weight);
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    const allSelected = selectedWeights.size === dumbbellWeights.length;
    if (allSelected) {
      setSelectedWeights(new Set());
    } else {
      setSelectedWeights(new Set(dumbbellWeights));
    }
  };

  const allSelected = selectedWeights.size === dumbbellWeights.length;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Dumbbells</Text>
          <TouchableOpacity onPress={handleToggleAll}>
            <Text
              style={[styles.deselectAllText, { color: colors.primaryButton }]}
            >
              {allSelected ? "Deselect all" : "Select all"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weightsList}>
          {dumbbellWeights.map((weight) => {
            const isSelected = selectedWeights.has(weight);
            return (
              <TouchableOpacity
                key={weight}
                onPress={() => handleToggleWeight(weight)}
                style={[
                  styles.weightRow,
                  {
                    borderBottomColor: colors.inputBorder,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.weightText, { color: colors.text }]}>
                  {weight} lb
                </Text>
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
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  deselectAllText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  weightsList: {
    paddingHorizontal: 24,
  },
  weightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  weightText: {
    fontSize: 16,
    fontWeight: "400",
    fontFamily: Fonts.sans,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
