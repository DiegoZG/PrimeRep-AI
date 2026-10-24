import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { LinearTransition, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Colors } from "@/constants/theme";
import type { WorkoutItem } from "@/interfaces/workouts";

export interface OverviewSection { title: string; blockType: string; data: WorkoutItem[] }
export interface OverviewControls { handle: React.ReactNode; moves: React.ReactNode }
type RowBounds = { y: number; height: number };

export function WorkoutOverviewList({ sections, renderItem, renderSectionHeader, header, colors, disabled, onMove, contentContainerStyle }: {
  sections: OverviewSection[]; renderItem: (item: WorkoutItem, controls: OverviewControls) => React.ReactNode;
  renderSectionHeader: (section: OverviewSection) => React.ReactNode; header: React.ReactNode;
  colors: typeof Colors.light; disabled: boolean; onMove: (exerciseId: string, destination: number) => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const scroll = useRef<ScrollView>(null), rows = useRef(new Map<string, RowBounds>());
  const viewport = useRef({ top: 0, height: 0, offset: 0, contentHeight: 0 });
  const drag = useRef<{ id: string; pointerY: number; initialOffset: number } | null>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null), [scrollDelta, setScrollDelta] = useState(0);
  const items = sections.flatMap((section) => section.data);
  const itemsRef = useRef(items); itemsRef.current = items;
  const moveRef = useRef(onMove); moveRef.current = onMove;
  const measureViewport = useCallback(() => scroll.current?.getNativeScrollRef()?.measureInWindow((_x: number, top: number, _width: number, height: number) => { viewport.current.top = top; viewport.current.height = height; }), []);
  const cancel = useCallback(() => {
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    autoScrollTimer.current = null; drag.current = null;
    setDraggingId(null); setScrollDelta(0);
  }, []);
  useEffect(() => () => { if (autoScrollTimer.current) clearInterval(autoScrollTimer.current); }, []);
  useEffect(() => { if (disabled) cancel(); }, [disabled, cancel]);
  const begin = useCallback((id: string, pointerY: number) => {
    cancel(); measureViewport();
    drag.current = { id, pointerY, initialOffset: viewport.current.offset }; setDraggingId(id);
    autoScrollTimer.current = setInterval(() => {
      const active = drag.current, bounds = viewport.current;
      if (!active || bounds.height <= 0) return;
      const edge = Math.min(80, bounds.height / 4);
      const direction = active.pointerY < bounds.top + edge ? -1 : active.pointerY > bounds.top + bounds.height - edge ? 1 : 0;
      const nextOffset = Math.max(0, Math.min(Math.max(0, bounds.contentHeight - bounds.height), bounds.offset + direction * 22));
      if (nextOffset === bounds.offset) return;
      bounds.offset = nextOffset; scroll.current?.scrollTo({ y: nextOffset, animated: false });
      setScrollDelta(nextOffset - active.initialOffset);
    }, 50);
  }, [cancel, measureViewport]);
  const update = useCallback((pointerY: number) => { if (drag.current) drag.current.pointerY = pointerY; }, []);
  const drop = useCallback((pointerY: number) => {
    const active = drag.current;
    if (!active) return;
    const contentY = pointerY - viewport.current.top + viewport.current.offset;
    const others = itemsRef.current.filter((item) => item.exercise.id !== active.id);
    let destination = 0;
    for (const item of others) {
      const bounds = rows.current.get(item.exercise.id);
      if (bounds && contentY >= bounds.y + bounds.height / 2) destination += 1;
    }
    const source = itemsRef.current.findIndex((item) => item.exercise.id === active.id);
    cancel();
    if (source !== destination) moveRef.current(active.id, destination);
  }, [cancel]);
  let index = 0;
  return <ScrollView ref={scroll} testID="workout-detail-list" style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={contentContainerStyle}
    scrollEnabled={!draggingId} scrollEventThrottle={16} onLayout={(event) => { viewport.current.height = event.nativeEvent.layout.height; measureViewport(); }}
    onContentSizeChange={(_width, height) => { viewport.current.contentHeight = height; }}
    onScroll={(event) => { viewport.current.offset = event.nativeEvent.contentOffset.y; }}>
    {header}
    {sections.flatMap((section, sectionIndex) => [
      <React.Fragment key={`heading-${sectionIndex}-${section.blockType}`}>{renderSectionHeader(section)}</React.Fragment>,
      ...section.data.map((item) => {
        const position = index++;
        return <OverviewExercise key={item.exercise.id} item={item} index={position} count={items.length} colors={colors} disabled={disabled}
          dragging={draggingId === item.exercise.id} scrollDelta={draggingId === item.exercise.id ? scrollDelta : 0}
          onLayout={(bounds) => rows.current.set(item.exercise.id, bounds)}
          onMove={(destination) => { cancel(); onMove(item.exercise.id, destination); AccessibilityInfo.announceForAccessibility(`${item.exercise.name} moved to position ${destination + 1} of ${items.length}.`); }}
          onBegin={begin} onUpdate={update} onDrop={drop} onCancel={cancel}>{(controls) => renderItem(item, controls)}</OverviewExercise>;
      }),
    ])}
  </ScrollView>;
}

function OverviewExercise({ item, index, count, colors, disabled, dragging, scrollDelta, onLayout, onMove, onBegin, onUpdate, onDrop, onCancel, children }: {
  item: WorkoutItem; index: number; count: number; colors: typeof Colors.light; disabled: boolean; dragging: boolean; scrollDelta: number;
  onLayout: (bounds: RowBounds) => void; onMove: (destination: number) => void; onBegin: (id: string, pointerY: number) => void;
  onUpdate: (pointerY: number) => void; onDrop: (pointerY: number) => void; onCancel: () => void; children: (controls: OverviewControls) => React.ReactNode;
}) {
  const translation = useSharedValue(0), compensation = useSharedValue(0), reduced = useReducedMotion();
  const callbacks = useRef({ onBegin, onUpdate, onDrop, onCancel }); callbacks.current = { onBegin, onUpdate, onDrop, onCancel };
  useEffect(() => { compensation.value = scrollDelta; }, [scrollDelta, compensation]);
  const begin = useCallback((pointerY: number) => callbacks.current.onBegin(item.exercise.id, pointerY), [item.exercise.id]);
  const update = useCallback((pointerY: number) => callbacks.current.onUpdate(pointerY), []);
  const drop = useCallback((pointerY: number) => callbacks.current.onDrop(pointerY), []);
  const cancel = useCallback(() => callbacks.current.onCancel(), []);
  const gesture = useMemo(() => Gesture.Pan().enabled(!disabled).minDistance(4)
    .onStart((event) => { translation.value = 0; scheduleOnRN(begin, event.absoluteY); })
    .onUpdate((event) => { translation.value = event.translationY; scheduleOnRN(update, event.absoluteY); })
    .onEnd((event) => { translation.value = withTiming(0, { duration: reduced ? 0 : 180, reduceMotion: ReduceMotion.System }); scheduleOnRN(drop, event.absoluteY); })
    .onFinalize((_event, success) => { if (!success) { translation.value = 0; scheduleOnRN(cancel); } }), [disabled, translation, begin, update, reduced, drop, cancel]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: translation.value + compensation.value }] }));
  const moves = <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Pressable testID={`workout-overview-up-${item.exercise.id}`} accessibilityRole="button" accessibilityLabel={`Move ${item.exercise.name} up`} disabled={disabled || index === 0} accessibilityState={{ disabled: disabled || index === 0 }} onPress={() => onMove(index - 1)} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", opacity: disabled || index === 0 ? 0.35 : pressed ? 0.6 : 1 })}><Ionicons name="arrow-up" size={18} color={colors.text} /></Pressable>
      <Pressable testID={`workout-overview-down-${item.exercise.id}`} accessibilityRole="button" accessibilityLabel={`Move ${item.exercise.name} down`} disabled={disabled || index === count - 1} accessibilityState={{ disabled: disabled || index === count - 1 }} onPress={() => onMove(index + 1)} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", opacity: disabled || index === count - 1 ? 0.35 : pressed ? 0.6 : 1 })}><Ionicons name="arrow-down" size={18} color={colors.text} /></Pressable>
    </View>;
  const handle = <GestureDetector gesture={gesture}><Animated.View><View testID={`workout-overview-handle-${item.exercise.id}`} accessible accessibilityRole="adjustable" accessibilityLabel={`Drag to reorder ${item.exercise.name}`} accessibilityValue={{ text: `Position ${index + 1} of ${count}` }} accessibilityHint="Drag up or down. The list scrolls when you hold near its top or bottom. Move actions are also available." accessibilityState={{ disabled }}
        accessibilityActions={disabled ? [] : [...(index > 0 ? [{ name: "decrement", label: "Move up" }] : []), ...(index < count - 1 ? [{ name: "increment", label: "Move down" }] : [])]}
        onAccessibilityAction={(event) => { if (!disabled && event.nativeEvent.actionName === "decrement" && index > 0) onMove(index - 1); if (!disabled && event.nativeEvent.actionName === "increment" && index < count - 1) onMove(index + 1); }}
        style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1 }}><Ionicons name="reorder-three" size={22} color={colors.icon} /></View></Animated.View></GestureDetector>;
  return <Animated.View testID={`workout-overview-card-${item.exercise.id}`} onLayout={(event) => onLayout(event.nativeEvent.layout)}
    layout={dragging ? undefined : LinearTransition.duration(reduced ? 0 : 180).reduceMotion(ReduceMotion.System)}
    style={[{ marginBottom: 12, borderWidth: 1, borderColor: dragging ? colors.primaryButton : colors.inputBorder, borderRadius: 16, padding: 12, paddingBottom: 4, backgroundColor: colors.inputBackground, zIndex: dragging ? 30 : 0, boxShadow: dragging ? "0 8px 24px rgba(0,0,0,0.18)" : undefined }, animated]}>
    {children({ handle, moves })}
  </Animated.View>;
}
