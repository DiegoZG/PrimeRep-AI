import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Modal, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { LinearTransition, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { SafeAreaView } from "react-native-safe-area-context";

import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
import { Colors } from "@/constants/theme";
import type { WorkoutItem } from "@/interfaces/workouts";

interface ExerciseListSheetProps {
  visible: boolean;
  inline?: boolean;
  exercises: WorkoutItem[];
  currentIndex: number;
  colors: typeof Colors.light;
  getProgress: (exerciseId: string) => { confirmed: number; total: number };
  onSelect: (index: number) => void;
  onClose: () => void;
  canArrange?: boolean;
  busy?: boolean;
  onMove?: (exerciseId: string, destination: number) => void;
  onReplace?: (exerciseId: string) => void;
  canReplace?: (exerciseId: string) => boolean;
  message?: string;
}

export function ExerciseListSheet({ visible, inline = false, exercises, currentIndex, colors, getProgress, onSelect, onClose,
  canArrange = false, busy = false, onMove, onReplace, canReplace, message }: ExerciseListSheetProps) {
  const [dragging, setDragging] = useState(false);
  const move = (id: string, destination: number) => {
    setDragging(false);
    onMove?.(id, destination);
    const name = exercises.find((item) => item.exercise.id === id)?.exercise.name;
    AccessibilityInfo.announceForAccessibility(`${name} moved to position ${destination + 1} of ${exercises.length}.`);
  };
  const content = (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <Pressable accessibilityLabel="Close exercise list" onPress={onClose} style={{ flex: 1 }} />
        <SafeAreaView edges={["bottom"]} style={{ maxHeight: "85%", backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, flexShrink: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12 }}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>Exercises</ThemedText>
            <Pressable testID="player-sheet-close" accessibilityRole="button" accessibilityLabel="Close exercise list" onPress={onClose} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={22} color={colors.text} /></Pressable>
          </View>
          {canArrange ? <ThemedText style={{ paddingHorizontal: 20, paddingBottom: 12, color: colors.placeholder }}>Drag an exercise or use Move up and Move down. Changes apply to this workout.</ThemedText> : null}
          {message ? <ThemedText testID="player-arrangement-message" accessibilityLiveRegion="polite" style={{ paddingHorizontal: 20, paddingBottom: 12 }}>{message}</ThemedText> : null}
          <ScrollView scrollEnabled={!dragging} contentInsetAdjustmentBehavior="automatic" style={{ paddingHorizontal: 12, flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
            {exercises.map((item, index) => <ExerciseOrderRow key={item.exercise.id} item={item} index={index} count={exercises.length}
              isCurrent={index === currentIndex} colors={colors} progress={getProgress(item.exercise.id)} onSelect={() => onSelect(index)}
              enabled={canArrange && !busy} onDragStart={() => setDragging(true)} onDragCancel={() => setDragging(false)} onMove={(destination) => move(item.exercise.id, destination)}
              onReplace={onReplace ? () => onReplace(item.exercise.id) : undefined} canReplace={canReplace?.(item.exercise.id) ?? false} />)}
          </ScrollView>
        </SafeAreaView>
      </GestureHandlerRootView>
  );
  return inline ? (visible ? content : null) : <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>{content}</Modal>;
}

function ExerciseOrderRow({ item, index, count, isCurrent, colors, progress, onSelect, enabled, onDragStart, onDragCancel, onMove, onReplace, canReplace }: {
  item: WorkoutItem; index: number; count: number; isCurrent: boolean; colors: typeof Colors.light; progress: { confirmed: number; total: number };
  onSelect: () => void; enabled: boolean; onDragStart: () => void; onDragCancel: () => void; onMove: (destination: number) => void; onReplace?: () => void; canReplace: boolean;
}) {
  const translateY = useSharedValue(0), stride = useSharedValue(100), active = useSharedValue(0);
  const reduced = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const callbacks = useRef({ onDragStart, onDragCancel, onMove });
  callbacks.current = { onDragStart, onDragCancel, onMove };
  const begin = React.useCallback(() => callbacks.current.onDragStart(), []);
  const drop = React.useCallback((destination: number) => callbacks.current.onMove(destination), []);
  const cancel = React.useCallback(() => callbacks.current.onDragCancel(), []);
  const gesture = useMemo(() => Gesture.Pan().enabled(enabled).minDistance(3)
    .onStart(() => { active.value = 1; scheduleOnRN(begin); })
    .onUpdate((event) => { translateY.value = event.translationY; })
    .onEnd((event) => {
      const destination = Math.max(0, Math.min(count - 1, Math.round(index + event.translationY / Math.max(1, stride.value))));
      translateY.value = withTiming(0, { duration: reduced ? 0 : 180, reduceMotion: ReduceMotion.System }); active.value = 0;
      scheduleOnRN(drop, destination);
    }).onFinalize((_event, success) => { if (!success) { translateY.value = 0; active.value = 0; scheduleOnRN(cancel); } }), [enabled, active, begin, translateY, count, index, stride, reduced, drop, cancel]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }], zIndex: active.value ? 20 : 0, opacity: active.value ? 0.9 : 1 }));
  const complete = progress.total > 0 && progress.confirmed === progress.total;
  return <Animated.View testID={`player-order-row-${item.exercise.id}`} onLayout={(event) => { stride.value = event.nativeEvent.layout.height + 6; }} layout={LinearTransition.duration(reduced ? 0 : 180).reduceMotion(ReduceMotion.System)} style={[{ backgroundColor: isCurrent ? colors.inputBackground : colors.background, borderRadius: 14, borderWidth: 1, borderColor: isCurrent ? colors.primaryButton : colors.inputBorder, marginBottom: 6, padding: 6 }, animatedStyle]}>
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {enabled ? <GestureDetector gesture={gesture}><Animated.View><View testID={`player-order-handle-${item.exercise.id}`} accessible accessibilityRole="adjustable" accessibilityLabel={`Reorder ${item.exercise.name}`} accessibilityValue={{ text: `Position ${index + 1} of ${count}` }} accessibilityHint="Drag up or down, or use Move up and Move down" accessibilityActions={[...(index > 0 ? [{ name: "decrement", label: "Move up" }] : []), ...(index < count - 1 ? [{ name: "increment", label: "Move down" }] : [])]} onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === "decrement" && index > 0) onMove(index - 1); if (event.nativeEvent.actionName === "increment" && index < count - 1) onMove(index + 1); }} style={{ minHeight: 44, width: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="reorder-three-outline" size={24} color={colors.text} /></View></Animated.View></GestureDetector> : null}
      <Pressable testID="player-sheet-exercise-row" accessibilityRole="button" accessibilityLabel={`Open ${item.exercise.name}, position ${index + 1} of ${count}, ${progress.confirmed} of ${progress.total} sets saved${isCurrent ? ", current exercise" : ""}`} onPress={onSelect} style={{ flex: 1, minHeight: 52, padding: 8 }}>
        <ThemedText type={isCurrent ? "defaultSemiBold" : "default"}>{index + 1}. {item.exercise.name}</ThemedText>
        <ThemedText style={{ fontSize: 13, color: colors.placeholder }}>{complete ? "Complete · " : ""}{progress.confirmed}/{progress.total} sets{isCurrent ? " · Now" : ""}</ThemedText>
      </Pressable>
    </View>
    {enabled ? <View style={{ flexDirection: fontScale > 1.5 ? "column" : "row", flexWrap: "wrap" }}>
      <RowAction id={`player-move-up-${item.exercise.id}`} label="Move up" accessibilityLabel={`Move ${item.exercise.name} up`} disabled={index === 0} onPress={() => onMove(index - 1)} colors={colors} />
      <RowAction id={`player-move-down-${item.exercise.id}`} label="Move down" accessibilityLabel={`Move ${item.exercise.name} down`} disabled={index === count - 1} onPress={() => onMove(index + 1)} colors={colors} />
      {onReplace ? <RowAction id={`player-replace-${item.exercise.id}`} label="Replace" accessibilityLabel={`Replace ${item.exercise.name}`} disabled={!canReplace} onPress={onReplace} colors={colors} /> : null}
    </View> : null}
  </Animated.View>;
}
function RowAction({ id, label, accessibilityLabel, disabled, onPress, colors }: { id: string; label: string; accessibilityLabel?: string; disabled: boolean; onPress: () => void; colors: typeof Colors.light }) {
  return <Pressable testID={id} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", opacity: disabled ? 0.45 : pressed ? 0.65 : 1 })}><ThemedText style={{ color: colors.text, fontSize: 14 }}>{label}</ThemedText></Pressable>;
}
