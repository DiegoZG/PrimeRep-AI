import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, TextInput, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

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
  compact?: boolean;
  readOnly?: boolean;
  actionsOpen?: boolean;
  issue?: string;
  onActionsOpen?: () => void;
  onActionsClose?: () => void;
  onUpdate: (setNumber: number, field: "reps" | "weight", value: string) => void;
  onConfirm: (setNumber: number) => void;
  onEdit: (setNumber: number) => void;
  onRemove: (setNumber: number) => void;
  onRestore: (setNumber: number) => void;
  onRetry: () => void;
}

export const SetInputRow = React.memo(function SetInputRow({
  setRow, displaySetNumber, colors, weightUnit, lastTimeHint, progressionTag, compact = false, readOnly, actionsOpen, issue,
  onActionsOpen, onActionsClose,
  onUpdate, onConfirm, onEdit, onRemove, onRestore, onRetry,
}: SetInputRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const [actionsVisible, setActionsVisible] = useState(false);
  const { setNumber, reps, weight, confirmed, syncStatus, deleted, editing } = setRow;
  const number = displaySetNumber ?? setNumber;
  const logged = confirmed && !editing;
  const emptyAdded = Boolean(setRow.isAdded && !confirmed && !setRow.logId && !editing && !weight.trim() && !reps.trim());
  const canRevealActions = Boolean((logged || setRow.isAdded) && !readOnly && syncStatus !== "failed");
  const trailingDisabled = Boolean(readOnly || ((logged || emptyAdded) && !canRevealActions));
  const unsaved = setRow.hasUnsavedInput && (!confirmed || editing);
  const editable = !readOnly && !logged;
  const successColor = "#55BC22";
  const completedBackground = colors.background === Colors.dark.background ? "#163008" : "#EEF7E9";
  const secondaryColor = colors.background === Colors.dark.background ? colors.placeholder : "#68727A";
  const id = `${setRow.exerciseId}-${setNumber}`;
  const saved = logged && syncStatus === "synced";
  const status = issue ? `Needs attention: ${issue}` : syncStatus === "failed" ? "Sync failed. Retry available."
    : unsaved ? "Unsaved changes" : editing ? "Editing saved set" : logged
      ? saved ? "Saved and synced" : "Saved on this device. Pending sync."
      : weight || reps ? "Suggested values. Not logged yet." : "Not logged yet.";
  const inputStyle = {
    minHeight: 44, width: "100%" as const, borderWidth: 1, borderColor: "transparent",
    borderRadius: 8, paddingHorizontal: compact ? 0 : 10, paddingVertical: compact ? 6 : 10, fontSize: 16,
    fontFamily: Fonts.sans, fontWeight: "600" as const, color: colors.text,
    textAlign: compact ? "center" as const : "left" as const, backgroundColor: "transparent",
  };
  const fieldOutlineStyle = {
    position: "absolute" as const, alignSelf: "center" as const, width: compact ? "88%" as const : "100%" as const,
    maxWidth: compact ? 124 : undefined, top: compact ? 5 : 0, bottom: compact ? 5 : 0,
    borderWidth: 1, borderColor: logged ? "transparent" : colors.inputBorder, borderRadius: 8,
    backgroundColor: logged ? "transparent" : colors.background,
  };

  useEffect(() => {
    if (actionsOpen === false || !canRevealActions) {
      swipeableRef.current?.close();
      setActionsVisible(false);
    }
  }, [actionsOpen, canRevealActions]);

  const openActions = () => {
    Keyboard.dismiss();
    if (actionsVisible) {
      swipeableRef.current?.close();
      onActionsClose?.();
      return;
    }
    onActionsOpen?.();
    swipeableRef.current?.openRight();
  };

  const chooseAction = (action: "edit" | "remove") => {
    swipeableRef.current?.close();
    setActionsVisible(false);
    onActionsClose?.();
    if (action === "edit") onEdit(setNumber);
    else onRemove(setNumber);
  };

  if (deleted) return (
    <View style={{ borderBottomWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: compact ? 4 : 12, marginBottom: compact ? 0 : 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <ThemedText style={{ color: secondaryColor, fontSize: 13 }}>Set {number} removed</ThemedText>
      <Pressable testID={`player-restore-set-${id}`} accessibilityRole="button" accessibilityLabel={`Undo removal of set ${number}`}
        accessibilityState={{ disabled: Boolean(readOnly) }}
        disabled={readOnly} onPress={() => onRestore(setNumber)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12 }}>
        <ThemedText style={{ fontWeight: "600" }}>Undo</ThemedText>
      </Pressable>
    </View>
  );

  return (
    <ReanimatedSwipeable ref={swipeableRef} enabled={canRevealActions} friction={1.5} rightThreshold={40}
      dragOffsetFromRightEdge={16} overshootRight={false} enableTrackpadTwoFingerGesture
      onSwipeableWillOpen={() => { setActionsVisible(true); onActionsOpen?.(); }}
      onSwipeableWillClose={() => setActionsVisible(false)} onSwipeableClose={() => onActionsClose?.()}
      containerStyle={{ borderRadius: compact ? 0 : 12, marginBottom: compact ? 0 : 8 }}
      renderRightActions={() => <View testID={`player-set-actions-${id}`}
        accessibilityElementsHidden={!actionsVisible} importantForAccessibility={actionsVisible ? "auto" : "no-hide-descendants"}
        style={{ flexDirection: "row", alignItems: "stretch", borderColor: colors.inputBorder }}>
        {logged ? <Pressable testID={`player-edit-set-${id}`} accessibilityRole="button" accessibilityLabel={`Edit set ${number}`}
          disabled={!canRevealActions} accessibilityState={{ disabled: !canRevealActions }} onPress={() => chooseAction("edit")}
          style={{ width: 64, minHeight: 44, alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: colors.inputBackground }}>
          <Ionicons name="create-outline" size={20} color={colors.text} />
          <ThemedText style={{ fontSize: 11, color: colors.text }}>Edit</ThemedText>
        </Pressable> : null}
        <Pressable testID={`player-remove-set-${id}`} accessibilityRole="button" accessibilityLabel={`Remove set ${number}`}
          disabled={!canRevealActions} accessibilityState={{ disabled: !canRevealActions }} onPress={() => chooseAction("remove")}
          style={{ width: 64, minHeight: 44, alignItems: "center", justifyContent: "center", gap: 2,
            backgroundColor: colors.background === Colors.dark.background ? "#3B2323" : "#FBEAEA" }}>
          <Ionicons name="trash-outline" size={20} color={colors.background === Colors.dark.background ? "#FF8E86" : "#B42318"} />
          <ThemedText style={{ fontSize: 11, color: colors.background === Colors.dark.background ? "#FF8E86" : "#B42318" }}>Remove</ThemedText>
        </Pressable>
      </View>}>
    <View testID={`player-set-row-${id}`} style={{ borderRadius: compact ? 0 : 12, backgroundColor: logged ? completedBackground : compact ? colors.background : colors.inputBackground,
      borderWidth: compact ? 0 : 1,
      borderColor: issue ? "#D14343" : unsaved ? colors.placeholder : colors.inputBorder,
      paddingHorizontal: compact ? 4 : 12, paddingVertical: compact ? 0 : 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 28, alignSelf: "stretch", alignItems: "center", justifyContent: "center" }}>
          <ThemedText testID={`player-set-number-${id}`} accessibilityRole="text"
            accessibilityLabel={`Set ${number}: ${status}`} accessibilityLiveRegion="polite"
            style={{ fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{number}</ThemedText>
        </View>
        <View style={{ flex: 1, minHeight: 44, justifyContent: "center" }}>
          <View pointerEvents="none" accessible={false} style={fieldOutlineStyle} />
          <TextInput testID={`player-weight-input-${id}`} accessibilityLabel={`Set ${number} weight in ${weightUnit}`}
            value={editing ? setRow.editDraft?.weight ?? weight : weight}
            onChangeText={(value) => onUpdate(setNumber, "weight", value)} keyboardType="decimal-pad" editable={editable} style={inputStyle} />
        </View>
        <View style={{ flex: 1, minHeight: 44, justifyContent: "center" }}>
          <View pointerEvents="none" accessible={false} style={fieldOutlineStyle} />
          <TextInput testID={`player-reps-input-${id}`} accessibilityLabel={`Set ${number} reps`}
            value={editing ? setRow.editDraft?.reps ?? reps : reps}
            onChangeText={(value) => onUpdate(setNumber, "reps", value)} keyboardType="number-pad" editable={editable} style={inputStyle} />
        </View>
        <Pressable testID={emptyAdded || logged ? `player-set-menu-${id}` : `player-confirm-set-${id}`} accessibilityRole="button"
          accessibilityLabel={logged ? `Set ${number} recorded. Show actions` : emptyAdded ? `Actions for set ${number}` : `${editing ? "Save changes to" : "Log"} set ${number}`}
          accessibilityHint={emptyAdded ? "Swipe left on the row or tap to show Remove" : logged ? "Swipe left on the row or tap to show Edit and Remove" : setRow.isAdded ? "Swipe left on this row to remove it" : undefined}
          accessibilityActions={setRow.isAdded && !logged && !emptyAdded && canRevealActions ? [{ name: "showSetActions", label: "Show set actions" }] : undefined}
          onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === "showSetActions") openActions(); }}
          accessibilityState={{ disabled: trailingDisabled }} disabled={trailingDisabled}
          onPress={() => { if (emptyAdded || logged) openActions(); else onConfirm(setNumber); }}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <View pointerEvents="none" style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8,
            borderWidth: 1, borderColor: logged || emptyAdded ? "transparent" : colors.inputBorder,
            backgroundColor: logged ? successColor : colors.inputBackground }}>
            <Ionicons name="checkmark" size={20} color={logged ? "#FFFFFF" : colors.text} accessible={false} />
          </View>
        </Pressable>
      </View>
      {issue ? <ThemedText accessibilityLiveRegion="polite" style={{ fontSize: 12, lineHeight: 18, color: "#D14343", marginLeft: 36 }}>{issue}</ThemedText> : null}
      {syncStatus === "failed" ? <Pressable testID={`player-retry-set-${id}`} accessibilityRole="button" disabled={readOnly}
        accessibilityState={{ disabled: Boolean(readOnly) }}
        onPress={onRetry} style={{ minHeight: 44, marginLeft: 36, justifyContent: "center" }}>
        <ThemedText style={{ fontSize: 13, fontWeight: "600" }}>Retry sync</ThemedText>
      </Pressable> : null}
      {lastTimeHint ? <ThemedText accessibilityElementsHidden={confirmed} importantForAccessibility={confirmed ? "no-hide-descendants" : "auto"}
        style={{ fontSize: 12, lineHeight: 18, color: secondaryColor, marginLeft: 36, marginTop: 2, opacity: confirmed ? 0 : 1 }}>
        Last time: {lastTimeHint}{progressionTag ? ` · ${progressionTag}` : ""}
      </ThemedText> : null}

    </View>
    </ReanimatedSwipeable>
  );
});
