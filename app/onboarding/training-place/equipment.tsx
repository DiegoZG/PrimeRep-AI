import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { AnimatedButton } from "@/components/animated-button";
import { AnimatedCheckmark } from "@/components/animated-checkmark";
import { AnimatedSearch } from "@/components/animated-search";
import { ThemedView } from "@/components/themed-view";
import { equipmentIcons } from "@/constants/equipment/equipmentIcons";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useScreenTransition } from "@/hooks/use-screen-transition";
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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { opacity, translateX } = useScreenTransition();

  const gymType = (params.gymType || data.trainingPlace) as
    | "large-gym"
    | "small-gym"
    | "garage-gym";

  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(
    () => {
      // If gymType is provided via params, always use defaults for that gym type
      // This ensures fresh defaults when navigating from training-place selection
      if (params.gymType) {
        return getDefaultEquipmentSelections(gymType);
      }

      // Otherwise, use existing selections from context if available
      const existingSelections = data.selectedEquipment || [];
      if (existingSelections.length > 0) {
        return new Set(existingSelections);
      }

      // Fallback to defaults based on current gym type
      return getDefaultEquipmentSelections(gymType);
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
      const defaults = getDefaultEquipmentSelections(gymType);
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
    return groupEquipmentByDisplayCategory();
  }, []);

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
    router.push("/onboarding/final");
  };

  // Get selected weights for display
  const getSelectedWeights = (equipmentId: string): string[] => {
    if (equipmentId === "dumbbells") {
      // Display only weights up to 20lb, then ellipsis
      const weights: number[] = [];
      for (let i = 2.5; i <= 20; i += 2.5) {
        weights.push(i);
      }
      return weights.map((w) => `${w}`);
    }
    if (equipmentId === "plates") {
      // Default plate weights from screenshot
      return ["1.25", "2.5", "5", "10", "15", "20", "25", "35", "45", "50"];
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

                  return (
                    <TouchableOpacity
                      key={equipment.id}
                      onPress={() => handleToggleEquipment(equipment.id)}
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
                            {equipment.name.charAt(0)}
                          </Text>
                        )}
                      </View>

                      {/* Equipment Name and Weights */}
                      <View style={styles.equipmentInfo}>
                        <Text
                          style={[styles.equipmentName, { color: colors.text }]}
                        >
                          {equipment.name}
                        </Text>
                        {hasEditButton && selectedWeights.length > 0 && (
                          <View style={styles.weightsRow}>
                            <Text
                              style={[
                                styles.weightsText,
                                { color: colors.placeholder },
                              ]}
                            >
                              {selectedWeights.join(", ")}
                              {equipment.id === "dumbbells" && "..."}
                            </Text>
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                if (equipment.id === "dumbbells") {
                                  handleEditDumbbells();
                                } else {
                                  handleEditPlates();
                                }
                              }}
                              style={styles.editButton}
                            >
                              <Text
                                style={[
                                  styles.editButtonText,
                                  { color: colors.primaryButton },
                                ]}
                              >
                                Edit
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
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
