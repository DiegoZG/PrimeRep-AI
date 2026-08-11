import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import type { WorkoutItem } from "@/interfaces/workouts";

interface ExerciseListSheetProps {
  visible: boolean;
  exercises: WorkoutItem[];
  currentIndex: number;
  colors: typeof Colors.light;
  getProgress: (exerciseId: string) => { confirmed: number; total: number };
  onSelect: (index: number) => void;
  onClose: () => void;
}

/**
 * Bottom sheet listing every exercise in the workout with completion state,
 * letting the user jump to any exercise (skipping ahead is allowed — earlier
 * unfinished sets remain loggable when the user comes back).
 */
export function ExerciseListSheet({
  visible,
  exercises,
  currentIndex,
  colors,
  getProgress,
  onSelect,
  onClose,
}: ExerciseListSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        {/* The height cap belongs here rather than on the sheet itself: a
            percentage resolves only against a parent with a definite height,
            which the full-screen overlay has and a content-sized view does not. */}
        <Pressable style={{ maxHeight: "75%" }} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView
            edges={["bottom"]}
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              flexShrink: 1,
            }}
          >
            {/* Drag handle */}
            <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.inputBorder,
                }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingTop: 8,
                paddingBottom: 12,
              }}
            >
              <ThemedText type="defaultSemiBold" style={{ fontSize: 18 }}>
                Exercises
              </ThemedText>
              <Pressable testID="player-sheet-close" onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={{ paddingHorizontal: 12, flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {exercises.map((item, index) => {
                const { confirmed, total } = getProgress(item.exercise.id);
                const isComplete = total > 0 && confirmed === total;
                const isCurrent = index === currentIndex;

                return (
                  <Pressable
                    key={`${item.exercise.id}-${index}`}
                    testID="player-sheet-exercise-row"
                    onPress={() => onSelect(index)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      marginBottom: 4,
                      backgroundColor: isCurrent ? `${colors.primaryButton}14` : "transparent",
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isComplete ? colors.primaryButton : colors.inputBackground,
                        borderWidth: isComplete ? 0 : 1,
                        borderColor: colors.inputBorder,
                        marginRight: 12,
                      }}
                    >
                      {isComplete ? (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      ) : (
                        <ThemedText style={{ fontSize: 13, fontWeight: "700", fontFamily: Fonts.sans }}>
                          {index + 1}
                        </ThemedText>
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <ThemedText
                        type={isCurrent ? "defaultSemiBold" : "default"}
                        style={{ fontSize: 15 }}
                        numberOfLines={1}
                      >
                        {item.exercise.name}
                      </ThemedText>
                      <ThemedText style={{ fontSize: 12, color: colors.placeholder, marginTop: 1 }}>
                        {confirmed}/{total} sets
                      </ThemedText>
                    </View>

                    {isCurrent && (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 8,
                          backgroundColor: colors.primaryButton,
                        }}
                      >
                        <ThemedText style={{ fontSize: 11, fontWeight: "600", color: "#FFFFFF" }}>
                          Now
                        </ThemedText>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
