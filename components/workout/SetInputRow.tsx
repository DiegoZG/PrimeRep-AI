import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Keyboard, Modal, Pressable, TextInput, View } from "react-native";

import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
import { Colors, Fonts } from "@/constants/theme";
import type { SetState } from "@/interfaces/workouts";
import type { WeightUnit } from "@/utils/weightUnits";

interface SetInputRowProps {
  setRow: SetState;
  displaySetNumber?: number;
  colors: typeof Colors.light;
  weightUnit: WeightUnit;
  lastTimeHint?: string;
  progressionTag?: string;
  readOnly?: boolean;
  issue?: string;
  onUpdate: (setNumber: number, field: "reps" | "weight", value: string) => void;
  onConfirm: (setNumber: number) => void;
  onEdit: (setNumber: number) => void;
  onRemove: (setNumber: number) => void;
  onRestore: (setNumber: number) => void;
  onRetry: () => void;
}

export const SetInputRow = React.memo(function SetInputRow({
  setRow, displaySetNumber, colors, weightUnit, lastTimeHint, progressionTag, readOnly, issue,
  onUpdate, onConfirm, onEdit, onRemove, onRestore, onRetry,
}: SetInputRowProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const { setNumber, reps, weight, confirmed, syncStatus, deleted, editing } = setRow;
  const number = displaySetNumber ?? setNumber;
  const logged = confirmed && !editing;
  const unsaved = setRow.hasUnsavedInput && (!confirmed || editing);
  const editable = !readOnly && !logged;
  const successColor = colors.background === Colors.dark.background ? "#70D5AD" : "#237858";
  const secondaryColor = colors.background === Colors.dark.background ? colors.placeholder : "#68727A";
  const id = `${setRow.exerciseId}-${setNumber}`;
  const status = unsaved ? "Unsaved" : editing ? "Editing" : logged
    ? syncStatus === "failed" ? "Sync failed" : syncStatus !== "synced" ? "Saved · pending sync" : "Logged"
    : weight || reps ? "Suggested · confirm when done" : "";
  const inputStyle = {
    minHeight: 44, flex: 1, borderWidth: logged ? 0 : 1, borderColor: colors.inputBorder,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 16,
    fontFamily: Fonts.sans, fontWeight: "600" as const, color: colors.text,
    backgroundColor: logged ? "transparent" : colors.background,
  };

  if (deleted) return (
    <View style={{ borderBottomWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <ThemedText style={{ color: secondaryColor, fontSize: 13 }}>Set {number} removed</ThemedText>
      <Pressable testID={`player-restore-set-${id}`} accessibilityRole="button" accessibilityLabel={`Undo removal of set ${number}`}
        accessibilityState={{ disabled: Boolean(readOnly) }}
        disabled={readOnly} onPress={() => onRestore(setNumber)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12 }}>
        <ThemedText style={{ fontWeight: "600" }}>Undo</ThemedText>
      </Pressable>
    </View>
  );

  return (
    <View testID={`player-set-row-${id}`} style={{ borderRadius: 12, backgroundColor: colors.inputBackground,
      borderWidth: 1, borderColor: issue ? "#D14343" : unsaved ? colors.placeholder : colors.inputBorder,
      paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 28, alignItems: "center", gap: 2 }}>
          <ThemedText style={{ fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{number}</ThemedText>
          {logged ? <Ionicons name="checkmark" size={15} color={successColor} accessibilityLabel={`Set ${number} logged`} /> : null}
        </View>
        <TextInput testID={`player-weight-input-${id}`} accessibilityLabel={`Set ${number} weight in ${weightUnit}`}
          value={editing ? setRow.editDraft?.weight ?? weight : weight}
          onChangeText={(value) => onUpdate(setNumber, "weight", value)} placeholder={weightUnit.toLowerCase()}
          placeholderTextColor={secondaryColor} keyboardType="decimal-pad" editable={editable} style={inputStyle} />
        <TextInput testID={`player-reps-input-${id}`} accessibilityLabel={`Set ${number} reps`}
          value={editing ? setRow.editDraft?.reps ?? reps : reps}
          onChangeText={(value) => onUpdate(setNumber, "reps", value)} placeholder="reps"
          placeholderTextColor={secondaryColor} keyboardType="number-pad" editable={editable} style={inputStyle} />
        <Pressable testID={logged ? `player-set-menu-${id}` : `player-confirm-set-${id}`} accessibilityRole="button"
          accessibilityLabel={logged ? `Actions for set ${number}` : `${editing ? "Save changes to" : "Log"} set ${number}`}
          accessibilityState={{ disabled: Boolean(readOnly) }} disabled={readOnly}
          onPress={() => { Keyboard.dismiss(); if (logged) setMenuVisible(true); else onConfirm(setNumber); }}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 8,
            borderWidth: logged ? 0 : 1, borderColor: colors.inputBorder }}>
          <Ionicons name={logged ? "ellipsis-horizontal" : "checkmark"} size={21} color={colors.text} />
        </Pressable>
      </View>
      {status ? <ThemedText testID={`player-set-status-${id}`} style={{ fontSize: 12, lineHeight: 18, marginLeft: 36, marginTop: 4,
        color: issue || syncStatus === "failed" ? "#D14343" : logged && syncStatus === "synced" ? successColor : secondaryColor }}>{status}</ThemedText> : null}
      {issue ? <ThemedText accessibilityLiveRegion="polite" style={{ fontSize: 12, lineHeight: 18, color: "#D14343", marginLeft: 36 }}>{issue}</ThemedText> : null}
      {syncStatus === "failed" ? <Pressable testID={`player-retry-set-${id}`} accessibilityRole="button" disabled={readOnly}
        accessibilityState={{ disabled: Boolean(readOnly) }}
        onPress={onRetry} style={{ minHeight: 44, marginLeft: 36, justifyContent: "center" }}>
        <ThemedText style={{ fontSize: 13, fontWeight: "600" }}>Retry sync</ThemedText>
      </Pressable> : null}
      {!confirmed && lastTimeHint ? <ThemedText style={{ fontSize: 12, lineHeight: 18, color: secondaryColor, marginLeft: 36, marginTop: 2 }}>
        Last time: {lastTimeHint}{progressionTag ? ` · ${progressionTag}` : ""}
      </ThemedText> : null}

      <Modal visible={menuVisible} transparent animationType="none" onRequestClose={() => setMenuVisible(false)}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close set actions" onPress={() => setMenuVisible(false)}
            style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.45)" }} />
          <View accessibilityViewIsModal style={{ width: "100%", maxWidth: 360, borderRadius: 18, padding: 16, backgroundColor: colors.background }}>
            <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>Set {number}</ThemedText>
            {(["Edit", "Remove"] as const).map((action) => <Pressable key={action} testID={`player-${action.toLowerCase()}-set-${id}`}
              accessibilityRole="button" disabled={syncStatus === "failed"} accessibilityState={{ disabled: syncStatus === "failed" }}
              onPress={() => { setMenuVisible(false); if (action === "Edit") onEdit(setNumber); else onRemove(setNumber); }}
              style={{ minHeight: 48, justifyContent: "center" }}>
              <ThemedText style={{ color: action === "Remove" ? "#D14343" : colors.text }}>{action}</ThemedText>
            </Pressable>)}
            <Pressable accessibilityRole="button" onPress={() => setMenuVisible(false)} style={{ minHeight: 48, justifyContent: "center" }}>
              <ThemedText>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
});
