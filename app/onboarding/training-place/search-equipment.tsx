import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { AnimatedCheckmark } from "@/components/animated-checkmark";
import { AnimatedSearch } from "@/components/animated-search";
import { ThemedView } from "@/components/themed-view";
import { EQUIPMENT } from "@/constants/equipment/equipment";
import { equipmentIcons } from "@/constants/equipment/equipmentIcons";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { OnboardingContext } from "@/utils/onboardingContext";

export default function SearchEquipmentScreen() {
  const { data, updateField } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  // Source of truth: always use context
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(
    () => {
      // Always use what's in context - this is the single source of truth
      return new Set(data.selectedEquipment || []);
    }
  );
  const prevContextSelectionsRef = useRef<string>("");
  const isUpdatingFromContextRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const prevLocalSelectionsRef = useRef<string>("");

  // Initialize refs from context (only once on mount)
  useEffect(() => {
    const existingSelections = data.selectedEquipment || [];
    const contextKey = JSON.stringify([...existingSelections].sort());
    prevContextSelectionsRef.current = contextKey;
    prevLocalSelectionsRef.current = contextKey;
    isInitialMountRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync selected equipment from context when it changes (from equipment screen)
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountRef.current) {
      return;
    }

    // Skip if we're the one updating
    if (isUpdatingFromContextRef.current) {
      isUpdatingFromContextRef.current = false;
      return;
    }

    const existingSelections = data.selectedEquipment || [];
    const contextKey = JSON.stringify([...existingSelections].sort());

    // Only update if context actually changed
    if (prevContextSelectionsRef.current !== contextKey) {
      prevContextSelectionsRef.current = contextKey;
      prevLocalSelectionsRef.current = contextKey;
      setSelectedEquipment(new Set(existingSelections));
    }
  }, [data.selectedEquipment]);

  // Update context when selections change locally (only after initial mount)
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountRef.current) {
      return;
    }

    const currentSelections = Array.from(selectedEquipment).sort();
    const currentKey = JSON.stringify(currentSelections);

    // Only update if values actually changed
    if (prevLocalSelectionsRef.current !== currentKey) {
      prevLocalSelectionsRef.current = currentKey;
      prevContextSelectionsRef.current = currentKey;
      isUpdatingFromContextRef.current = true;
      updateField("selectedEquipment", currentSelections);
    }
  }, [selectedEquipment, updateField]);

  // Filter equipment based on search query
  const filteredEquipment = useMemo(() => {
    if (!searchQuery.trim()) {
      return EQUIPMENT;
    }

    const query = searchQuery.toLowerCase();
    return EQUIPMENT.filter(
      (eq) =>
        eq.name.toLowerCase().includes(query) ||
        eq.id.toLowerCase().includes(query) ||
        eq.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Group filtered equipment by category
  const groupedEquipment = useMemo(() => {
    const groups: Record<string, typeof EQUIPMENT> = {};

    filteredEquipment.forEach((eq) => {
      if (!groups[eq.category]) {
        groups[eq.category] = [];
      }
      groups[eq.category].push(eq);
    });

    // Sort categories and equipment within each category
    const sortedGroups: Record<string, typeof EQUIPMENT> = {};
    Object.keys(groups)
      .sort()
      .forEach((category) => {
        sortedGroups[category] = groups[category].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });

    return sortedGroups;
  }, [filteredEquipment]);

  // Category display names
  const categoryDisplayNames: Record<string, string> = {
    machine: "Weight Machines",
    plateLoaded: "Plated Machines",
    benchRack: "Benches and Racks",
    cable: "Cable Machines",
    freeWeight: "Free Weights",
    functional: "Functional Training",
    bandAccessory: "Bands & Accessories",
    cardio: "Cardio Equipment",
  };

  const handleToggleEquipment = (equipmentId: string) => {
    setSelectedEquipment((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(equipmentId)) {
        newSet.delete(equipmentId);
      } else {
        newSet.add(equipmentId);
      }
      return newSet;
    });
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <AnimatedSearch
            placeholder="Search for equipment"
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={true}
          />
        </View>

        {/* Equipment List */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {Object.keys(groupedEquipment).length === 0 ? (
            <View style={styles.emptyState}>
              <Text
                style={[styles.emptyStateText, { color: colors.placeholder }]}
              >
                No equipment found
              </Text>
            </View>
          ) : (
            Object.entries(groupedEquipment).map(([category, equipment]) => (
              <View key={category} style={styles.categorySection}>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>
                  {categoryDisplayNames[category] || category}
                </Text>

                {equipment.map((eq) => {
                  const isSelected = selectedEquipment.has(eq.id);

                  return (
                    <TouchableOpacity
                      key={eq.id}
                      onPress={() => handleToggleEquipment(eq.id)}
                      style={[
                        styles.equipmentRow,
                        {
                          backgroundColor: colors.inputBackground,
                          borderColor: isSelected
                            ? colors.primaryButton
                            : colors.inputBorder,
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
                            style={[
                              styles.iconPlaceholderText,
                              { color: colors.placeholder },
                            ]}
                          >
                            {eq.name.charAt(0)}
                          </Text>
                        )}
                      </View>

                      {/* Equipment Name */}
                      <View style={styles.equipmentInfo}>
                        <Text
                          style={[styles.equipmentName, { color: colors.text }]}
                        >
                          {eq.name}
                        </Text>
                      </View>

                      {/* Checkbox */}
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
            ))
          )}
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 24,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "400",
    fontFamily: Fonts.sans,
  },
  categorySection: {
    gap: 12,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    marginBottom: 4,
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
  },
  equipmentName: {
    fontSize: 16,
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
