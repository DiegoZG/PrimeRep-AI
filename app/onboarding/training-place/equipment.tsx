import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { AnimatedButton } from "@/components/animated-button";
import { AnimatedSearch } from "@/components/animated-search";
import { EquipmentCard } from "@/components/equipment/equipment-card";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenTransition } from "@/hooks/use-screen-transition";
import { useEquipment } from "@/utils/equipmentContext";
import { OnboardingContext } from "@/utils/onboardingContext";
import {
  getDefaultDumbbellWeights,
  getDefaultEquipmentSelections,
  getDefaultPlateWeights,
  groupEquipmentByDisplayCategory,
} from "./equipment-helpers";

export default function EquipmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gymType?: string }>();
  const { data, updateField } = useContext(OnboardingContext);
  const { items, ensureEquipmentLoaded } = useEquipment();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();

  // Load equipment on mount
  useEffect(() => {
    ensureEquipmentLoaded();
  }, [ensureEquipmentLoaded]);

  const gymType = (params.gymType || data.trainingPlace) as
    | "large-gym"
    | "small-gym"
    | "garage-gym";

  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(
    () => {
      // If gymType is provided via params, always use defaults for that gym type
      // This ensures fresh defaults when navigating from training-place selection
      if (params.gymType) {
        // Pass undefined if items is empty so helper uses fallback
        return getDefaultEquipmentSelections(
          gymType,
          items.length > 0 ? items : undefined
        );
      }

      // Otherwise, use existing selections from context if available
      const existingSelections = data.selectedEquipment || [];
      if (existingSelections.length > 0) {
        return new Set(existingSelections);
      }

      // Fallback to defaults based on current gym type
      // Pass undefined if items is empty so helper uses fallback
      return getDefaultEquipmentSelections(
        gymType,
        items.length > 0 ? items : undefined
      );
    }
  );

  const prevContextSelectionsRef = useRef<string>("");
  const isUpdatingFromContextRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const prevGymTypeRef = useRef<string>(gymType);
  const gymTypeParamRef = useRef<string | undefined>(params.gymType);

  // Reset to defaults when gym type changes or when gymType param is provided
  useEffect(() => {
    const gymTypeChanged = prevGymTypeRef.current !== gymType;
    const hasGymTypeParam = params.gymType !== undefined;
    const paramChanged = gymTypeParamRef.current !== params.gymType;

    // Reset if: gym type changed OR we have a gymType param (first time or param changed)
    if (
      (gymTypeChanged || hasGymTypeParam || paramChanged) &&
      !isUpdatingFromContextRef.current
    ) {
      // Pass undefined if items is empty so helper uses fallback
      const defaults = getDefaultEquipmentSelections(
        gymType,
        items.length > 0 ? items : undefined
      );
      const defaultSelections = Array.from(defaults).sort();
      setSelectedEquipment(defaults);
      isUpdatingFromContextRef.current = true;
      updateField("selectedEquipment", defaultSelections);

      // Initialize weight arrays if plates/dumbbells are selected by default
      if (defaults.has("plates")) {
        updateField("plateWeights", getDefaultPlateWeights());
      }
      if (defaults.has("dumbbells")) {
        updateField("dumbbellWeights", getDefaultDumbbellWeights());
      }

      prevContextSelectionsRef.current = JSON.stringify(defaultSelections);
      prevGymTypeRef.current = gymType;
      gymTypeParamRef.current = params.gymType;
      isInitialMountRef.current = false;
      return;
    }

    // On initial mount without gymType param, initialize from state (which was set in useState)
    if (isInitialMountRef.current) {
      const currentSelections = Array.from(selectedEquipment).sort();
      const currentKey = JSON.stringify(currentSelections);
      updateField("selectedEquipment", currentSelections);

      // Initialize weight arrays if plates/dumbbells are selected and not already set
      if (selectedEquipment.has("plates") && data.plateWeights === undefined) {
        updateField("plateWeights", getDefaultPlateWeights());
      }
      if (
        selectedEquipment.has("dumbbells") &&
        data.dumbbellWeights === undefined
      ) {
        updateField("dumbbellWeights", getDefaultDumbbellWeights());
      }

      prevContextSelectionsRef.current = currentKey;
      prevGymTypeRef.current = gymType;
      gymTypeParamRef.current = params.gymType;
      isInitialMountRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymType]);

  // Sync selected equipment from context when it changes (e.g., from search screen)
  // Only update if the values actually changed and we're not the ones updating it
  useEffect(() => {
    // Skip on initial mount or if we just reset due to gym type change
    if (isInitialMountRef.current || isUpdatingFromContextRef.current) {
      if (isUpdatingFromContextRef.current) {
        isUpdatingFromContextRef.current = false;
      }
      return;
    }

    const existingSelections = data.selectedEquipment || [];
    const contextKey = JSON.stringify([...existingSelections].sort());

    // Only update if context actually changed and it's not from a gym type reset
    if (prevContextSelectionsRef.current !== contextKey) {
      prevContextSelectionsRef.current = contextKey;
      setSelectedEquipment(new Set(existingSelections));
    }
  }, [data.selectedEquipment]);

  // Update context when selections change locally
  const handleToggleEquipment = (equipmentId: string) => {
    setSelectedEquipment((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(equipmentId)) {
        newSet.delete(equipmentId);
      } else {
        newSet.add(equipmentId);
      }
      const newSelections = Array.from(newSet).sort();
      const newKey = JSON.stringify(newSelections);

      // Only update if actually changed
      if (prevContextSelectionsRef.current !== newKey) {
        isUpdatingFromContextRef.current = true;
        updateField("selectedEquipment", newSelections);
        prevContextSelectionsRef.current = newKey;
      }

      return newSet;
    });
  };

  const equipmentGroups = useMemo(() => {
    // Pass undefined if items is empty so helper uses fallback
    return groupEquipmentByDisplayCategory(
      items.length > 0 ? items : undefined
    );
  }, [items]);

  const handleEditDumbbells = () => {
    router.push("/onboarding/training-place/edit-dumbbells");
  };

  const handleEditPlates = () => {
    router.push("/onboarding/training-place/edit-plates");
  };

  const handleSeeAll = (categoryTitle: string) => {
    router.push({
      pathname: "/onboarding/training-place/see-all",
      params: { category: categoryTitle },
    });
  };

  const handleNext = () => {
    router.push("/onboarding/notifications");
  };

  // Get selected weights for display
  const getSelectedWeights = (equipmentId: string): string[] => {
    if (equipmentId === "dumbbells") {
      return (data.dumbbellWeights || []).map(String);
    }
    if (equipmentId === "plates") {
      return (data.plateWeights || []).map(String);
    }
    return [];
  };

  const screenAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <ThemedView style={styles.container}>
      <Animated.View style={[styles.animatedContainer, screenAnimatedStyle]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {equipmentGroups.map((group) => (
              <View key={group.title} style={styles.categorySection}>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>
                  {group.title}
                </Text>

                {group.equipment.map((equipment) => {
                  const isSelected = selectedEquipment.has(equipment.id);
                  const hasEditButton =
                    equipment.id === "dumbbells" || equipment.id === "plates";
                  const selectedWeights = hasEditButton
                    ? getSelectedWeights(equipment.id)
                    : [];
                  const subtitle =
                    hasEditButton && selectedWeights.length > 0
                      ? `${selectedWeights.join(", ")}${
                          equipment.id === "dumbbells" ? "..." : ""
                        }`
                      : undefined;

                  return (
                    <EquipmentCard
                      key={equipment.id}
                      id={equipment.id}
                      name={equipment.name}
                      selected={isSelected}
                      onPress={() => handleToggleEquipment(equipment.id)}
                      iconKey={equipment.iconKey}
                      imageUrl={equipment.imageUrl}
                      category={equipment.category}
                      subtitle={subtitle}
                      showEditButton={
                        hasEditButton && selectedWeights.length > 0
                      }
                      onPressEdit={() => {
                        if (equipment.id === "dumbbells") {
                          handleEditDumbbells();
                        } else {
                          handleEditPlates();
                        }
                      }}
                    />
                  );
                })}

                {/* See all link */}
                <TouchableOpacity
                  onPress={() => handleSeeAll(group.title)}
                  style={styles.seeAllLink}
                >
                  <Text
                    style={[styles.seeAllText, { color: colors.placeholder }]}
                  >
                    See all {group.title}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.placeholder}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Search Component */}
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <AnimatedSearch
            placeholder="Search for equipment"
            value=""
            onPress={() =>
              router.push("/onboarding/training-place/search-equipment")
            }
            editable={false}
          />
        </View>

        {/* Next Button */}
        <View
          style={[
            styles.buttonContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <AnimatedButton onPress={handleNext}>
            <View
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primaryButton },
              ]}
            >
              <Text style={styles.primaryButtonText}>NEXT</Text>
            </View>
          </AnimatedButton>
        </View>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  animatedContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 180,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
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
  seeAllLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "400",
    fontFamily: Fonts.sans,
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  primaryButton: {
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
