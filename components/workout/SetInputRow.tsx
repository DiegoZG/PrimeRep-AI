import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import type { SetState } from "@/interfaces/workouts";
import type { WeightUnit } from "@/utils/weightUnits";

interface SetInputRowProps {
  setRow: SetState;
  colors: typeof Colors.light;
  weightUnit: WeightUnit;
  /** e.g. "last time: 135lb × 8" — omitted when there's no history for this set. */
  lastTimeHint?: string;
  onUpdate: (setNumber: number, field: "reps" | "weight", value: string) => void;
  onConfirm: (setNumber: number) => void;
}

export const SetInputRow = React.memo(function SetInputRow({
  setRow,
  colors,
  weightUnit,
  lastTimeHint,
  onUpdate,
  onConfirm,
}: SetInputRowProps) {
  const { setNumber, reps, weight, confirmed, syncing } = setRow;

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
            {setNumber}
          </ThemedText>
        </View>

        {/* Weight input */}
        <View style={{ flex: 1, paddingRight: 8 }}>
          <TextInput
            testID="player-weight-input"
            value={weight}
            onChangeText={(v) => onUpdate(setNumber, "weight", v)}
            placeholder={weightUnit.toLowerCase()}
            placeholderTextColor={colors.placeholder}
            keyboardType="decimal-pad"
            editable={!confirmed}
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
            testID="player-reps-input"
            value={reps}
            onChangeText={(v) => onUpdate(setNumber, "reps", v)}
            placeholder="reps"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
            editable={!confirmed}
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
          testID="player-confirm-set"
          onPress={() => onConfirm(setNumber)}
          disabled={confirmed}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: confirmed ? colors.primaryButton : colors.background,
            borderWidth: confirmed ? 0 : 1,
            borderColor: colors.inputBorder,
          }}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons
              name={confirmed ? "checkmark" : "checkmark-outline"}
              size={20}
              color={confirmed ? "#FFFFFF" : colors.placeholder}
            />
          )}
        </Pressable>
      </View>

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
