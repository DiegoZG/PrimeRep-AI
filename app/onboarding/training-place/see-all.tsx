import { useLocalSearchParams, useNavigation } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AnimatedSearch } from "@/components/animated-search";
import { EquipmentCard } from "@/components/equipment/equipment-card";
import { ThemedView } from "@/components/themed-view";
import { EQUIPMENT } from "@/constants/equipment/equipment";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { OnboardingContext } from "@/utils/onboardingContext";
import { getEquipmentCategoryType } from "./equipment-helpers";

export default function SeeAllScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const navigation = useNavigation();
  const { data, updateField } = useContext(OnboardingContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const categoryTitle = params.category || "Equipment";
  const categoryType = getEquipmentCategoryType(categoryTitle);

  // Update header title dynamically
  useEffect(() => {
    navigation.setOptions({
      headerTitle: categoryTitle,
    });
  }, [categoryTitle, navigation]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Source of truth: always use context
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(
    () => {
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

  // Sync selected equipment from context when it changes
  useEffect(() => {
    if (isInitialMountRef.current) {
      return;
    }

    if (isUpdatingFromContextRef.current) {
      isUpdatingFromContextRef.current = false;
      return;
    }

    const existingSelections = data.selectedEquipment || [];
    const contextKey = JSON.stringify([...existingSelections].sort());

    if (prevContextSelectionsRef.current !== contextKey) {
      prevContextSelectionsRef.current = contextKey;
      prevLocalSelectionsRef.current = contextKey;
      setSelectedEquipment(new Set(existingSelections));
    }
  }, [data.selectedEquipment]);

  // Update context when selections change locally (only after initial mount)
  useEffect(() => {
    if (isInitialMountRef.current) {
      return;
    }

    const currentSelections = Array.from(selectedEquipment).sort();
    const currentKey = JSON.stringify(currentSelections);

    if (prevLocalSelectionsRef.current !== currentKey) {
      prevLocalSelectionsRef.current = currentKey;
      prevContextSelectionsRef.current = currentKey;
      isUpdatingFromContextRef.current = true;
      updateField("selectedEquipment", currentSelections);
    }
  }, [selectedEquipment, updateField]);

  // Filter equipment by category type and search query
  const filteredEquipment = useMemo(() => {
    if (!categoryType) {
      return [];
    }

    // First filter by category type
    let equipment = EQUIPMENT.filter((eq) => eq.category === categoryType);

    // Then filter by search query if provided
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      equipment = equipment.filter(
        (eq) =>
          eq.name.toLowerCase().includes(query) ||
          eq.id.toLowerCase().includes(query)
      );
    }

    // Sort alphabetically
    return equipment.sort((a, b) => a.name.localeCompare(b.name));
  }, [categoryType, searchQuery]);

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
          {filteredEquipment.length === 0 ? (
            <View style={styles.emptyState}>
              <Text
                style={[styles.emptyStateText, { color: colors.placeholder }]}
              >
                No equipment found
              </Text>
            </View>
          ) : (
            <View style={styles.equipmentList}>
              {filteredEquipment.map((eq) => {
                const isSelected = selectedEquipment.has(eq.id);

                return (
                  <EquipmentCard
                    key={eq.id}
                    id={eq.id}
                    name={eq.name}
                    selected={isSelected}
                    onPress={() => handleToggleEquipment(eq.id)}
                  />
                );
              })}
            </View>
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
    paddingTop: 24,
    paddingBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  equipmentList: {
    gap: 12,
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
});
