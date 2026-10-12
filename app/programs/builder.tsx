import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  findNodeHandle,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
  type AccessibilityActionEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolateColor,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { SafeAreaView } from "react-native-safe-area-context";

import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { DraftProgramDay, ProgramGoal, ProgramLevel } from "@/interfaces/programs";
import { createProgram, updateProgram } from "@/services/programService";
import { HttpError } from "@/services/httpClient";
import { AuthContext } from "@/utils/authContext";
import { useProgramDraft } from "@/utils/programDraftContext";
import { PROGRAM_GOAL_LABELS, PROGRAM_LEVEL_LABELS } from "@/utils/programDisplay";

const MOVE_DURATION_MS = 210;
const MOVED_HIGHLIGHT_MS = 850;
const DAY_GAP = 11;

type DayActionState = { dayId: string; step: "actions" | "confirmRemove" } | null;

export default function ProgramBuilderScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? "light"];
  const { fontScale } = useWindowDimensions();
  const dark = colors.background === Colors.dark.background;
  const danger = dark ? "#FF8B82" : "#B42318";
  const { token, user } = useContext(AuthContext);
  const { draft, updateMetadata, addDay, removeDay, moveDay, toPayload, loadProgram } = useProgramDraft();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aliasesText, setAliasesText] = useState(draft.aliases.join(", "));
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [movedDayId, setMovedDayId] = useState<string | null>(null);
  const [dayAction, setDayAction] = useState<DayActionState>(null);
  const reduceMotion = useReducedMotion();
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEditing = Boolean(draft.templateId);
  const accountRef = useRef(`${user?.id ?? "guest"}:${token ?? "anonymous"}`);
  accountRef.current = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const mountedRef = useRef(true);
  const mutationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mutationRef.current += 1;
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (dragTimerRef.current) clearTimeout(dragTimerRef.current);
    };
  }, []);

  const showMovedState = (dayId: string, title: string, destination: number) => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setMovedDayId(dayId);
    highlightTimerRef.current = setTimeout(() => setMovedDayId((current) => current === dayId ? null : current), MOVED_HIGHLIGHT_MS);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(`${title} moved to position ${destination + 1} of ${draft.days.length}.`);
    }, reduceMotion ? 0 : 80);
  };

  const moveDayTo = (dayId: string, destination: number) => {
    const source = draft.days.findIndex((day) => day.localId === dayId);
    const clampedDestination = Math.max(0, Math.min(destination, draft.days.length - 1));
    if (source < 0 || source === clampedDestination) return false;
    const direction: -1 | 1 = clampedDestination > source ? 1 : -1;
    for (let step = 0; step < Math.abs(clampedDestination - source); step += 1) moveDay(dayId, direction);
    const day = draft.days[source];
    showMovedState(dayId, day.title, clampedDestination);
    setError(null);
    return true;
  };

  const moveDayBy = (dayId: string, direction: -1 | 1) => {
    const source = draft.days.findIndex((day) => day.localId === dayId);
    if (source >= 0) moveDayTo(dayId, source + direction);
  };

  const finishDrag = (dayId: string, destination: number) => {
    const moved = moveDayTo(dayId, destination);
    if (dragTimerRef.current) clearTimeout(dragTimerRef.current);
    if (reduceMotion || !moved) setActiveDragId(null);
    else dragTimerRef.current = setTimeout(() => setActiveDragId((current) => current === dayId ? null : current), MOVE_DURATION_MS);
  };

  const cancelDrag = (dayId: string) => setActiveDragId((current) => current === dayId ? null : current);

  const selectedActionDay = dayAction ? draft.days.find((day) => day.localId === dayAction.dayId) ?? null : null;
  const selectedActionIndex = selectedActionDay ? draft.days.findIndex((day) => day.localId === selectedActionDay.localId) : -1;

  const moveSelectedDay = (direction: -1 | 1) => {
    if (!selectedActionDay) return;
    moveDayBy(selectedActionDay.localId, direction);
    setDayAction(null);
  };

  const removeSelectedDay = () => {
    if (!selectedActionDay) return;
    removeDay(selectedActionDay.localId);
    setError(null);
    setDayAction(null);
  };

  const validation = useMemo(() => {
    if (draft.name.trim().length < 2) return "Give your program a name.";
    if (draft.description.trim().length < 10) return "Add a short description so the plan is clear.";
    if (draft.days.length < 1) return "Add at least one workout day.";
    if (draft.days.some((day) => !day.title.trim())) return "Every workout day needs a name.";
    if (draft.days.some((day) => day.exercises.length < 1)) return "Add at least one exercise to every workout day.";
    if (draft.days.some((day) => day.exercises.some((item) => item.sets < 1 || item.sets > 20))) return "Sets must be between 1 and 20.";
    if (draft.days.some((day) => day.exercises.some((item) => item.repsMin < 1 || item.repsMax > 100))) return "Reps must be between 1 and 100.";
    if (draft.days.some((day) => day.exercises.some((item) => item.repsMin > item.repsMax))) return "Minimum reps cannot exceed maximum reps.";
    if (draft.days.some((day) => day.exercises.some((item) => item.restSeconds < 0 || item.restSeconds > 900))) return "Rest must be between 0 and 900 seconds.";
    return null;
  }, [draft]);

  const save = async () => {
    if (!token || !user || saving) return;
    if (validation) { setError(validation); return; }
    setSaving(true);
    setError(null);
    const account = accountRef.current;
    const mutationId = ++mutationRef.current;
    const isCurrent = () => mountedRef.current && accountRef.current === account && mutationRef.current === mutationId;
    try {
      const payload = { ...toPayload(), aliases: aliasesText.split(",").map((item) => item.trim()).filter(Boolean) };
      const saved = draft.templateId
        ? await updateProgram(token, draft.templateId, payload)
        : await createProgram(token, payload);
      if (!isCurrent()) return;
      loadProgram({
        ...saved,
        isActive: draft.isActive,
        isScheduled: draft.isScheduled,
      });
      if (draft.isActive || draft.isScheduled) {
        Alert.alert("Update scheduled workouts?", "Choose when the new version should change unfinished workouts.", [
          { text: "Next week", onPress: () => router.replace({ pathname: "/programs/activate", params: { templateId: saved.id, applyMode: "next-week" } }) },
          { text: "Apply now", onPress: () => router.replace({ pathname: "/programs/activate", params: { templateId: saved.id, applyMode: "now" } }) },
        ]);
      } else {
        router.replace({ pathname: "/programs/[templateId]", params: { templateId: saved.id } });
      }
    } catch (saveError) {
      if (!isCurrent()) return;
      if (saveError instanceof HttpError && saveError.status === 409) setError("This program changed elsewhere. Return to its details and reopen Edit.");
      else setError("Your program couldn’t be saved. Check your connection and try again.");
    } finally { if (isCurrent()) setSaving(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View testID="program-builder-header" style={styles.header} onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }}>
        <Pressable testID="program-builder-back" accessibilityRole="button" accessibilityLabel={`Back from ${isEditing ? "Edit program" : "Build program"}`} accessibilityState={{ disabled: saving }} disabled={saving} onPress={() => { Keyboard.dismiss(); router.back(); }} style={styles.headerAction}>
          <Ionicons name="arrow-back" size={24} color={saving ? colors.icon : colors.text} />
        </Pressable>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}><View style={styles.headerCopy}>{fontScale < 2 ? <ThemedText style={styles.headerTitle}>Program</ThemedText> : null}</View></TouchableWithoutFeedback>
        <View style={styles.headerAction} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView testID="program-builder-scroll" contentContainerStyle={styles.content} keyboardShouldPersistTaps="always" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }} showsVerticalScrollIndicator={false} scrollEnabled={!activeDragId}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }}>
          <ThemedText testID="program-builder-title" style={styles.title}>{isEditing ? "Edit program" : "Build program"}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.icon }]}>Repeats every week</ThemedText>
          <FieldLabel text="Program name" />
          <TextInput testID="program-name-input" accessibilityLabel="Program name" value={draft.name} onChangeText={(name) => { updateMetadata({ name }); setError(null); }} placeholder="My strength plan" placeholderTextColor={colors.icon} style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]} />
          <FieldLabel text="What is this program for?" />
          <TextInput testID="program-description-input" accessibilityLabel="Program description" value={draft.description} onChangeText={(description) => { updateMetadata({ description }); setError(null); }} placeholder="A clear description of the plan" placeholderTextColor={colors.icon} multiline style={[styles.input, styles.description, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]} />
          <FieldLabel text="Search aliases (optional)" />
          <TextInput testID="program-aliases-input" accessibilityLabel="Program search aliases" value={aliasesText} onChangeText={setAliasesText} placeholder="push pull legs, ppl" placeholderTextColor={colors.icon} style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]} />
          <ThemedText style={[styles.helper, { color: colors.icon }]}>Separate alternate names with commas.</ThemedText>

          <FieldLabel text="Goal" />
          <View style={styles.wrap}>{(Object.keys(PROGRAM_GOAL_LABELS) as ProgramGoal[]).map((goal) => <Choice key={goal} testID={`program-goal-${goal}`} label={PROGRAM_GOAL_LABELS[goal]} selected={draft.goal === goal} onPress={() => updateMetadata({ goal })} colors={colors} />)}</View>
          <FieldLabel text="Experience" />
          <View style={styles.wrap}>{(Object.keys(PROGRAM_LEVEL_LABELS) as ProgramLevel[]).map((level) => <Choice key={level} testID={`program-level-${level}`} label={PROGRAM_LEVEL_LABELS[level]} selected={draft.level === level} onPress={() => updateMetadata({ level })} colors={colors} />)}</View>
          <FieldLabel text="Workout duration" />
          <View style={styles.wrap}>{[25, 35, 45, 60].map((duration) => <Choice key={duration} testID={`program-duration-${duration}`} label={`${duration} min`} selected={draft.durationMinutes === duration} onPress={() => updateMetadata({ durationMinutes: duration })} colors={colors} />)}</View>

          <View style={styles.daysTitle}><View style={styles.flex}><ThemedText style={styles.sectionTitle}>Workout days</ThemedText><ThemedText style={[styles.helper, { color: colors.icon }]}>{draft.days.length}/7 days · Drag nearby or use Options to move farther</ThemedText></View><Pressable testID="program-add-day" accessibilityRole="button" accessibilityLabel="Add workout day" accessibilityState={{ disabled: draft.days.length >= 7 }} disabled={draft.days.length >= 7} onPress={() => { Keyboard.dismiss(); addDay(); setError(null); }} style={({ pressed }) => [styles.addDay, { borderColor: colors.inputBorder, backgroundColor: pressed && draft.days.length < 7 ? dark ? "#2C2C2C" : "#F5F5F5" : colors.inputBackground }]}><Ionicons name="add" size={22} color={draft.days.length >= 7 ? colors.icon : colors.text} /></Pressable></View>
          {draft.days.map((day, index) => <ReorderableDay
            key={day.localId}
            day={day}
            index={index}
            count={draft.days.length}
            colors={colors}
            reduceMotion={reduceMotion}
            isDragging={activeDragId === day.localId}
            isMoved={movedDayId === day.localId}
            onOpen={() => router.push({ pathname: "/programs/day", params: { dayId: day.localId } })}
            onOptions={() => { Keyboard.dismiss(); setDayAction({ dayId: day.localId, step: "actions" }); }}
            onMove={(direction) => moveDayBy(day.localId, direction)}
            onDragStart={() => setActiveDragId(day.localId)}
            onDrop={(destination) => finishDrag(day.localId, destination)}
            onDragCancel={() => cancelDrag(day.localId)}
          />)}
          {error ? <ThemedText testID="program-builder-error" accessibilityRole="alert" style={[styles.error, { color: danger }]}>{error}</ThemedText> : null}
          <Pressable testID="program-save" accessibilityRole="button" accessibilityLabel={isEditing ? "Save program changes" : "Create program"} accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} onPress={() => { Keyboard.dismiss(); void save(); }} style={({ pressed }) => [styles.save, { borderColor: saving ? colors.inputBorder : colors.primaryButton, backgroundColor: saving ? colors.inputBackground : colors.primaryButton, transform: [{ scale: pressed && !saving ? 0.99 : 1 }] }]}><ThemedText style={[styles.saveText, { color: saving ? colors.icon : "#FFF" }]}>{saving ? "Saving…" : isEditing ? "Save changes" : "Create program"}</ThemedText></Pressable>
          </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
      <DayActionSheet
        visible={Boolean(selectedActionDay)}
        step={dayAction?.step ?? "actions"}
        day={selectedActionDay}
        index={selectedActionIndex}
        count={draft.days.length}
        colors={colors}
        reduceMotion={reduceMotion}
        onClose={() => setDayAction(null)}
        onMove={moveSelectedDay}
        onRequestRemove={() => selectedActionDay && setDayAction({ dayId: selectedActionDay.localId, step: "confirmRemove" })}
        onConfirmRemove={removeSelectedDay}
      />
    </SafeAreaView>
  );
}

function FieldLabel({ text }: { text: string }) { return <ThemedText style={styles.label}>{text}</ThemedText>; }
function Choice({ label, selected, onPress, colors, testID }: { label: string; selected: boolean; onPress: () => void; colors: typeof Colors.light; testID: string }) {
  const activeSurface = colors.background === Colors.dark.background ? "#2C2C2C" : "#F5F5F5";
  return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.choice, { borderColor: selected ? colors.icon : colors.inputBorder, backgroundColor: selected || pressed ? activeSurface : colors.inputBackground }]}>{selected ? <Ionicons name="checkmark" size={18} color={colors.text} /> : null}<ThemedText style={[styles.choiceText, { color: colors.text }]}>{label}</ThemedText></Pressable>;
}

function DayActionSheet({ visible, step, day, index, count, colors, reduceMotion, onClose, onMove, onRequestRemove, onConfirmRemove }: {
  visible: boolean;
  step: "actions" | "confirmRemove";
  day: DraftProgramDay | null;
  index: number;
  count: number;
  colors: typeof Colors.light;
  reduceMotion: boolean;
  onClose: () => void;
  onMove: (direction: -1 | 1) => void;
  onRequestRemove: () => void;
  onConfirmRemove: () => void;
}) {
  if (!day) return null;
  const isConfirmation = step === "confirmRemove";
  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetOverlay}>
        <Pressable testID="program-day-options-backdrop" accessibilityRole="button" accessibilityLabel="Close workout day options" onPress={onClose} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={["bottom"]} style={[styles.sheet, { backgroundColor: colors.background }]} accessibilityViewIsModal>
          <ScrollView testID="program-day-options-scroll" style={styles.sheetScroll} contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.sheetGrabber, { backgroundColor: colors.inputBorder }]} />
          <ThemedText style={styles.sheetTitle}>{isConfirmation ? `Remove ${day.title}?` : day.title}</ThemedText>
          <ThemedText style={[styles.sheetMessage, { color: colors.icon }]}>
            {isConfirmation
              ? "This removes the workout day and all of its exercises from this draft."
              : `Position ${index + 1} of ${count}. Move it one place at a time or remove it.`}
          </ThemedText>
          {isConfirmation ? (
            <>
              <SheetAction testID="program-day-confirm-remove" icon="trash-outline" label="Remove workout day" destructive onPress={onConfirmRemove} colors={colors} />
              <SheetAction testID="program-day-confirm-cancel" icon="close" label="Keep workout day" onPress={onClose} colors={colors} />
            </>
          ) : (
            <>
              <SheetAction testID="program-day-move-earlier" icon="arrow-up" label="Move earlier" disabled={index <= 0} onPress={() => onMove(-1)} colors={colors} />
              <SheetAction testID="program-day-move-later" icon="arrow-down" label="Move later" disabled={index >= count - 1} onPress={() => onMove(1)} colors={colors} />
              <SheetAction testID="program-day-request-remove" icon="trash-outline" label="Remove workout day" destructive onPress={onRequestRemove} colors={colors} />
              <SheetAction testID="program-day-options-cancel" icon="close" label="Cancel" onPress={onClose} colors={colors} />
            </>
          )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function SheetAction({ testID, icon, label, destructive = false, disabled = false, onPress, colors }: {
  testID: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
  colors: typeof Colors.light;
}) {
  const dark = colors.background === Colors.dark.background;
  const color = disabled ? colors.icon : destructive ? dark ? "#FF8B82" : "#B42318" : colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.sheetAction, { borderTopColor: colors.inputBorder, backgroundColor: pressed && !disabled ? dark ? "#2C2C2C" : "#F5F5F5" : colors.background }]}
    >
      <Ionicons name={icon} size={21} color={color} />
      <ThemedText style={[styles.sheetActionText, { color }]}>{label}</ThemedText>
    </Pressable>
  );
}

function ReorderableDay({ day, index, count, colors, reduceMotion, isDragging, isMoved, onOpen, onOptions, onMove, onDragStart, onDrop, onDragCancel }: {
  day: DraftProgramDay;
  index: number;
  count: number;
  colors: typeof Colors.light;
  reduceMotion: boolean;
  isDragging: boolean;
  isMoved: boolean;
  onOpen: () => void;
  onOptions: () => void;
  onMove: (direction: -1 | 1) => void;
  onDragStart: () => void;
  onDrop: (destination: number) => void;
  onDragCancel: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  const translateY = useSharedValue(0);
  const dragActive = useSharedValue(0);
  const movedProgress = useSharedValue(0);
  const rowStride = useSharedValue(89);
  const handleRef = useRef<View>(null);
  const dragStartRef = useRef(onDragStart);
  const dropRef = useRef(onDrop);
  const dragCancelRef = useRef(onDragCancel);
  dragStartRef.current = onDragStart;
  dropRef.current = onDrop;
  dragCancelRef.current = onDragCancel;
  const beginDragOnRN = useCallback(() => dragStartRef.current(), []);
  const finishDropOnRN = useCallback((destination: number) => dropRef.current(destination), []);
  const cancelDragOnRN = useCallback(() => dragCancelRef.current(), []);

  useEffect(() => {
    movedProgress.value = withTiming(isMoved ? 1 : 0, { duration: reduceMotion ? 0 : 160, reduceMotion: ReduceMotion.System });
    if (!isMoved) return;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      const node = findNodeHandle(handleRef.current);
      if (enabled && node) AccessibilityInfo.setAccessibilityFocus(node);
    });
  }, [isMoved, movedProgress, reduceMotion]);

  const dragGesture = useMemo(() => Gesture.Pan()
    .minDistance(3)
    .onStart(() => {
      dragActive.value = 1;
      translateY.value = 0;
      scheduleOnRN(beginDragOnRN);
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const stride = Math.max(1, rowStride.value);
      const destination = Math.max(0, Math.min(count - 1, Math.round(index + event.translationY / stride)));
      if (destination !== index) translateY.value = event.translationY - (destination - index) * stride;
      translateY.value = withTiming(0, { duration: reduceMotion ? 0 : MOVE_DURATION_MS, reduceMotion: ReduceMotion.System });
      dragActive.value = 0;
      scheduleOnRN(finishDropOnRN, destination);
    })
    .onFinalize((_event, success) => {
      if (success) return;
      translateY.value = withTiming(0, { duration: reduceMotion ? 0 : 140, reduceMotion: ReduceMotion.System });
      dragActive.value = 0;
      scheduleOnRN(cancelDragOnRN);
    }), [beginDragOnRN, cancelDragOnRN, count, dragActive, finishDropOnRN, index, reduceMotion, rowStride, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(movedProgress.value, [0, 1], [colors.inputBorder, colors.primaryButton]),
    borderWidth: 1 + movedProgress.value,
    transform: [
      { translateY: translateY.value },
      { scale: reduceMotion ? 1 : 1 + dragActive.value * 0.018 },
    ],
    zIndex: dragActive.value ? 20 : 0,
  }), [colors.inputBorder, colors.primaryButton, reduceMotion]);

  const accessibilityActions = [
    ...(index > 0 ? [{ name: "decrement", label: "Move earlier" }] : []),
    ...(index < count - 1 ? [{ name: "increment", label: "Move later" }] : []),
  ];
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "decrement" && index > 0) onMove(-1);
    if (event.nativeEvent.actionName === "increment" && index < count - 1) onMove(1);
  };
  const orderTestKey = day.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "untitled";

  const handle = (
    <GestureDetector gesture={dragGesture}>
      <Animated.View style={styles.handleContainer}>
        <View
          ref={handleRef}
          testID={`program-day-handle-${index + 1}`}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Reorder ${day.title}, position ${index + 1} of ${count}`}
          accessibilityValue={{ text: `Position ${index + 1} of ${count}` }}
          accessibilityHint="Drag up or down, or use the move actions"
          accessibilityActions={accessibilityActions}
          onAccessibilityAction={onAccessibilityAction}
          style={styles.handle}
        >
          <Ionicons name="reorder-three-outline" size={23} color={isDragging ? colors.primaryButton : colors.icon} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
  const main = (
    <Pressable testID={`program-builder-day-open-${index + 1}`} accessibilityRole="button" accessibilityLabel={`Edit ${day.title}, position ${index + 1} of ${count}`} onPress={onOpen} style={[styles.dayMain, fontScale >= 1.4 && styles.dayMainExpanded]}>
      <View style={[styles.dayNumber, { backgroundColor: colors.background, borderColor: colors.inputBorder }]}><ThemedText style={styles.dayNumberText}>{index + 1}</ThemedText></View>
      <View style={styles.flex}><ThemedText style={styles.dayName}>{day.title}</ThemedText><ThemedText style={[styles.helper, { color: colors.icon }]}>{day.exercises.length} {day.exercises.length === 1 ? "exercise" : "exercises"}</ThemedText></View>
      <Ionicons name="chevron-forward" size={20} color={colors.icon} />
    </Pressable>
  );
  const menu = (
    <Pressable testID={`program-day-menu-${index + 1}`} accessibilityRole="button" accessibilityLabel={`Options for ${day.title}`} accessibilityHint="Move or remove this workout day" onPress={onOptions} style={styles.menu}>
      <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
    </Pressable>
  );

  return (
    <Animated.View
      testID={`program-builder-day-${index + 1}`}
      onLayout={(event) => { rowStride.value = event.nativeEvent.layout.height + DAY_GAP; }}
      layout={isDragging ? undefined : LinearTransition.duration(reduceMotion ? 0 : MOVE_DURATION_MS).reduceMotion(ReduceMotion.System)}
      style={[
        styles.dayCard,
        { backgroundColor: colors.inputBackground },
        isDragging && styles.draggingCard,
        animatedStyle,
      ]}
    >
      <View testID={`program-day-order-${orderTestKey}-${index + 1}`} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} />
      <View style={[styles.dayRow, fontScale >= 1.4 && styles.dayRowExpanded]}>
        {fontScale >= 1.4 ? <>{main}<View style={styles.dayActions}>{handle}{menu}</View></> : <>{handle}{main}{menu}</>}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, flex: { flex: 1 }, content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28 },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 }, headerAction: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, alignItems: "center", paddingHorizontal: 8 }, headerTitle: { fontSize: 22, fontWeight: "800" }, title: { fontSize: 30, fontWeight: "800" }, subtitle: { marginTop: 6, fontSize: 15 }, label: { marginTop: 22, marginBottom: 8, fontSize: 16, fontWeight: "700" },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16 }, description: { minHeight: 112, textAlignVertical: "top" }, wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, choice: { minHeight: 44, maxWidth: "100%", borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }, choiceText: { fontWeight: "700", flexShrink: 1 },
  daysTitle: { marginTop: 28, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 }, sectionTitle: { fontSize: 22, fontWeight: "800" }, helper: { marginTop: 5, fontSize: 14 }, addDay: { minWidth: 44, minHeight: 44, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dayCard: { borderRadius: 19, marginBottom: 11 }, dayRow: { minHeight: 78, paddingHorizontal: 7, paddingVertical: 7, flexDirection: "row", alignItems: "center" }, dayRowExpanded: { flexDirection: "column", alignItems: "stretch", gap: 8 }, dayActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, draggingCard: { elevation: 9, shadowColor: "#000", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.22, shadowRadius: 12 }, handleContainer: { width: 44, height: 44 }, handle: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, dayMain: { minHeight: 64, flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }, dayMainExpanded: { flex: 0 }, dayNumber: { minWidth: 38, minHeight: 38, padding: 8, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" }, dayNumberText: { fontWeight: "800", fontVariant: ["tabular-nums"] }, dayName: { fontSize: 16, fontWeight: "700" }, menu: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.52)" }, sheet: { maxHeight: "85%", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10 }, sheetScroll: { flexGrow: 0, flexShrink: 1 }, sheetContent: { paddingBottom: 12 }, sheetGrabber: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 }, sheetTitle: { fontSize: 22, fontWeight: "800", textAlign: "center" }, sheetMessage: { marginTop: 8, marginBottom: 18, paddingHorizontal: 12, textAlign: "center" }, sheetAction: { minHeight: 54, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 10, paddingVertical: 14 }, sheetActionText: { fontSize: 16, fontWeight: "700", flex: 1 },
  error: { marginTop: 14 }, save: { minHeight: 56, marginTop: 22, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 15, alignItems: "center", justifyContent: "center" }, saveText: { fontSize: 17, fontWeight: "800" },
});
