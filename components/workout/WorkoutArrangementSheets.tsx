import React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
import { Colors } from "@/constants/theme";
import type { WorkoutItem } from "@/interfaces/workouts";
import type { useWorkoutArrangement } from "@/hooks/use-workout-arrangement";

type Controller = ReturnType<typeof useWorkoutArrangement>;
export function WorkoutArrangementSheets({ controller, colors, exercises, inline = false }: { controller: Controller; colors: typeof Colors.light; exercises: WorkoutItem[]; inline?: boolean }) {
  const { picker, review, busy } = controller;
  const name = (id: string) => exercises.find((item) => item.exercise.id === id)?.exercise.name ?? id;
  const prescription = (value: { sets: number; reps?: string | null; repsMin?: number | null; repsMax?: number | null; restSeconds: number }) => `${value.sets} sets · ${value.reps ?? `${value.repsMin}–${value.repsMax}`} reps · ${value.restSeconds}s rest`;
  return <>
    <Sheet inline={inline} visible={Boolean(review) && !controller.guidance} title={review?.conflict ? "Review changed workout" : "Review exercise order"} colors={colors} busy={busy} close={() => controller.setReview(null)}>
      <ThemedText>{review?.message}</ThemedText>
      {review?.exerciseIds.map((id, index) => <ThemedText key={id}>{index + 1}. {name(id)}</ThemedText>)}
      {review?.preview?.targetsChanged ? <>
        <ThemedText type="defaultSemiBold">Suggested target changes</ThemedText>
        {review.preview.targetChanges.map((change) => <View key={change.exerciseId} style={{ gap: 4 }}><ThemedText type="defaultSemiBold">{name(change.exerciseId)}</ThemedText><ThemedText>Before: {prescription(change.before)}</ThemedText><ThemedText>After: {prescription(change.after)}</ThemedText></View>)}
        <Action id="player-order-apply-targets" label="Apply revised targets" disabled={busy} onPress={() => controller.applyOrder(true)} colors={colors} primary />
      </> : <ThemedText>Sets, reps and rest stay the same.</ThemedText>}
      <Action id="player-order-keep-targets" label="Keep current targets and save order" disabled={busy || review?.invalid === true} onPress={() => controller.applyOrder(false)} colors={colors} primary={!review?.preview?.targetsChanged} />
      {review?.conflict ? <Action id="player-order-use-server" label="Use latest saved order" disabled={busy} onPress={controller.dismissPending} colors={colors} /> : null}
    </Sheet>
    <Sheet inline={inline} visible={Boolean(picker) && !review && !controller.guidance} title={picker?.selected ? "Replace exercise?" : "Choose a replacement"} colors={colors} busy={busy} close={() => controller.setPicker(null)}>
      {picker?.selected ? <>
        <ThemedText>Replace {name(picker.exerciseId)} with {picker.selected.name} for this workout?</ThemedText>
        <ThemedText>Sets, reps and rest stay the same. Any weight suggestion comes from your history with {picker.selected.name}.</ThemedText>
        {picker.discard ? <ThemedText testID="player-replacement-discard-warning">Your unsaved entries for {name(picker.exerciseId)} will be discarded.</ThemedText> : null}
        <Action id="player-replacement-guidance" label={`How to do ${picker.selected.name}`} onPress={() => controller.setGuidance(picker.selected)} disabled={busy} colors={colors} />
        <Action id="player-replacement-confirm" label={picker.discard ? "Discard entries and replace" : "Replace exercise"} onPress={controller.confirmReplacement} disabled={busy} colors={colors} primary />
        <Action id="player-replacement-back" label="Choose another exercise" onPress={() => controller.setPicker({ ...picker, selected: null })} disabled={busy} colors={colors} />
      </> : <>
        <ThemedText>These exercises match your equipment and this exercise’s role.</ThemedText>
        {picker?.candidates.length === 0 ? <ThemedText>No compatible replacements are available for this workout.</ThemedText> : null}
        {picker?.candidates.map((candidate) => <View key={candidate.id} style={{ borderBottomWidth: 1, borderColor: colors.inputBorder, paddingBottom: 8, gap: 4 }}>
          <Action id={`player-replacement-candidate-${candidate.id}`} label={candidate.name} onPress={() => controller.setPicker({ ...picker, selected: candidate })} disabled={busy} colors={colors} />
          <Action id={`player-replacement-info-${candidate.id}`} label={`How to do ${candidate.name}`} onPress={() => controller.setGuidance(candidate)} disabled={busy} colors={colors} />
        </View>)}
      </>}
    </Sheet>
  </>;
}
function Sheet({ visible, inline, title, colors, busy, close, children }: { visible: boolean; inline: boolean; title: string; colors: typeof Colors.light; busy: boolean; close: () => void; children: React.ReactNode }) {
  const content = <View style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }}><Pressable accessibilityLabel="Close workout changes" disabled={busy} onPress={close} style={{ flex: 1 }} /><SafeAreaView edges={["bottom"]} style={{ maxHeight: "85%", backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}><ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 14 }}><ThemedText type="subtitle">{title}</ThemedText>{busy ? <ActivityIndicator color={colors.text} /> : null}{children}<Action id="player-arrangement-cancel" label="Cancel" onPress={close} disabled={busy} colors={colors} /></ScrollView></SafeAreaView></View>;
  return inline ? (visible ? content : null) : <Modal transparent visible={visible} animationType="slide" onRequestClose={() => { if (!busy) close(); }}>{content}</Modal>;
}
function Action({ id, label, onPress, disabled, colors, primary = false }: { id: string; label: string; onPress: () => void; disabled: boolean; colors: typeof Colors.light; primary?: boolean }) {
  return <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 48, padding: 12, borderRadius: 12, justifyContent: "center", backgroundColor: primary ? colors.primaryButton : colors.inputBackground, opacity: disabled ? 0.5 : pressed ? 0.65 : 1 })}><ThemedText style={{ textAlign: "center", color: primary ? "#FFFFFF" : colors.text, fontWeight: "600" }}>{label}</ThemedText></Pressable>;
}
