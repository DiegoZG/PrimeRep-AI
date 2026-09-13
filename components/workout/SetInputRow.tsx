import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import type { SetState } from "@/interfaces/workouts";
import type { WeightUnit } from "@/utils/weightUnits";

interface SetInputRowProps {
  setRow: SetState;
  displaySetNumber?: number;
  colors: typeof Colors.light;
  weightUnit: WeightUnit;
  /** e.g. "last time: 135lb × 8" — omitted when there's no history for this set. */
  lastTimeHint?: string;
  /** "▲" | "—" | "▼" — driven by suggestedWeightReason; omit when no suggestion. */
  progressionTag?: string;
  onUpdate: (setNumber: number, field: "reps" | "weight", value: string) => void;
  onConfirm: (setNumber: number) => void;
  onEdit: (setNumber: number) => void;
  onRemove: (setNumber: number) => void;
  onRestore: (setNumber: number) => void;
}

export const SetInputRow = React.memo(function SetInputRow({
  setRow,
  displaySetNumber,
  colors,
  weightUnit,
  lastTimeHint,
  progressionTag,
  onUpdate,
  onConfirm,
  onEdit,
  onRemove,
  onRestore,
}: SetInputRowProps) {
  const { setNumber, reps, weight, confirmed, syncStatus, deleted, editing } = setRow;
  const displayedReps = editing ? (setRow.editDraft?.reps ?? reps) : reps;
  const displayedWeight = editing ? (setRow.editDraft?.weight ?? weight) : weight;

  if (deleted) {
    return (
      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <ThemedText style={{ color: colors.placeholder }}>Removed set</ThemedText>
          <Pressable testID={`player-restore-set-${setRow.exerciseId}-${setNumber}`} onPress={() => onRestore(setNumber)}>
            <ThemedText style={{ color: colors.primaryButton, fontWeight: "700" }}>Undo</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        borderRadius: 14,
        backgroundColor: confirmed ? `${colors.primaryButton}10` : colors.inputBackground,
        borderWidth: 1,
        borderColor: confirmed ? "transparent" : colors.inputBorder,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Set number */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: confirmed ? colors.primaryButton : colors.background,
            borderWidth: confirmed ? 0 : 1,
            borderColor: colors.inputBorder,
            marginRight: 10,
          }}
        >
          <ThemedText
            style={{
              fontSize: 14,
              fontWeight: "700",
              fontFamily: Fonts.sans,
              color: confirmed ? "#FFFFFF" : colors.text,
            }}
          >
            {displaySetNumber ?? setNumber}
          </ThemedText>
        </View>

        {/* Progression tag — ▲ increase, — hold, ▼ deload */}
        {progressionTag != null ? (
          <ThemedText
            style={{
              fontSize: 13,
              fontFamily: Fonts.sans,
              fontWeight: "700",
              color: progressionTag === "—" ? colors.placeholder : colors.primaryButton,
              marginRight: 8,
              minWidth: 14,
              textAlign: "center",
            }}
          >
            {progressionTag}
          </ThemedText>
        ) : null}

        {/* Weight input */}
        <View style={{ flex: 1, paddingRight: 8 }}>
          <TextInput
            testID={`player-weight-input-${setRow.exerciseId}-${setNumber}`}
            value={displayedWeight}
            onChangeText={(v) => onUpdate(setNumber, "weight", v)}
            placeholder={weightUnit.toLowerCase()}
            placeholderTextColor={colors.placeholder}
            keyboardType="decimal-pad"
            editable={!confirmed || editing}
            style={{
              backgroundColor: confirmed ? "transparent" : colors.background,
              borderWidth: confirmed ? 0 : 1,
              borderColor: colors.inputBorder,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 15,
              fontFamily: Fonts.sans,
              fontWeight: "600",
              color: colors.text,
              opacity: confirmed ? 0.6 : 1,
            }}
          />
        </View>

        <ThemedText style={{ color: colors.placeholder, marginRight: 8 }}>×</ThemedText>

        {/* Reps input */}
        <View style={{ flex: 1, paddingRight: 8 }}>
          <TextInput
            testID={`player-reps-input-${setRow.exerciseId}-${setNumber}`}
            value={displayedReps}
            onChangeText={(v) => onUpdate(setNumber, "reps", v)}
            placeholder="reps"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
            editable={!confirmed || editing}
            style={{
              backgroundColor: confirmed ? "transparent" : colors.background,
              borderWidth: confirmed ? 0 : 1,
              borderColor: colors.inputBorder,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 15,
              fontFamily: Fonts.sans,
              fontWeight: "600",
              color: colors.text,
              opacity: confirmed ? 0.6 : 1,
            }}
          />
        </View>

        {/* Confirm button */}
        <Pressable
          testID={`player-confirm-set-${setRow.exerciseId}-${setNumber}`}
          onPress={() => onConfirm(setNumber)}
          disabled={confirmed && !editing}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: confirmed && !editing ? colors.primaryButton : colors.background,
            borderWidth: confirmed && !editing ? 0 : 1,
            borderColor: colors.inputBorder,
          }}
        >
          <Ionicons
            name={confirmed && !editing ? "checkmark" : "checkmark-outline"}
            size={20}
            color={confirmed && !editing ? "#FFFFFF" : colors.placeholder}
          />
        </Pressable>
      </View>

      {confirmed && !editing ? (
        <View style={{ flexDirection: "row", gap: 16, marginTop: 8, marginLeft: 42 }}>
          <Pressable
            testID={`player-edit-set-${setRow.exerciseId}-${setNumber}`}
            onPress={() => onEdit(setNumber)}
            disabled={syncStatus === "failed"}
            accessibilityState={{ disabled: syncStatus === "failed" }}
          >
            <ThemedText style={{ color: syncStatus === "failed" ? colors.placeholder : colors.primaryButton, fontWeight: "700", fontSize: 13 }}>Edit</ThemedText>
          </Pressable>
          <Pressable
            testID={`player-remove-set-${setRow.exerciseId}-${setNumber}`}
            onPress={() => onRemove(setNumber)}
            disabled={syncStatus === "failed"}
            accessibilityState={{ disabled: syncStatus === "failed" }}
          >
            <ThemedText style={{ color: syncStatus === "failed" ? colors.placeholder : "#D14343", fontWeight: "700", fontSize: 13 }}>Remove</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {!confirmed && lastTimeHint ? (
        <ThemedText
          style={{
            fontSize: 12,
            color: colors.placeholder,
            marginTop: 6,
            marginLeft: 42,
          }}
        >
          last time: {lastTimeHint}
        </ThemedText>
      ) : null}
    </View>
  );
});
