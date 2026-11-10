import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useContext, useEffect } from "react";
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ExerciseMedia } from "@/components/exercises/ExerciseMedia";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useEquipmentScanner } from "@/hooks/use-equipment-scanner";
import type { EquipmentSummary, ExerciseGuidance } from "@/interfaces/equipment-scanning";
import { accountGeneration } from "@/services/accountScope";
import { AuthContext } from "@/utils/authContext";

type Palette = typeof Colors.light;
const reasons = { not_equipment: "We couldn’t find gym equipment in this photo.", multiple_subjects: "Move closer so one machine is the clear subject.", image_unclear: "Try a clearer photo with the whole machine visible.", unsupported_equipment: "This machine isn’t in our supported catalog yet.", uncertain: "We couldn’t identify this machine confidently." };
export function ScanEquipmentScreen() {
  const { user } = useContext(AuthContext);
  return <Scanner key={`${user?.id ?? "guest"}:${accountGeneration()}`} />;
}
function Scanner() {
  const scan = useEquipmentScanner(); const router = useRouter(); const colors = Colors[useColorScheme() ?? "light"];
  const blocked = scan.busy || scan.picking;
  const title = scan.stage === "manual" ? "Find equipment" : scan.stage === "confirm" ? "Confirm the machine" : scan.stage === "exercises" ? scan.machine?.name ?? "Exercises" : scan.stage === "guidance" ? scan.guidance?.name ?? "Exercise guide" : scan.enabled ? "Scan equipment" : "Find your equipment";
  useEffect(() => { AccessibilityInfo.announceForAccessibility(title); }, [title]);
  const back = () => scan.stage === "capture" ? router.back() : scan.back();
  return <SafeAreaView testID="equipment-scanner" style={[styles.page, { backgroundColor: colors.background }]}>
    <View style={styles.header}>
      <Pressable testID="scan-back" onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconButton}><Ionicons name="arrow-back" size={24} color={colors.text} /></Pressable>
      <Text accessibilityRole="header" style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      <Pressable testID="scan-close" onPress={() => { scan.cancelRequest(); router.back(); }} accessibilityRole="button" accessibilityLabel="Close equipment discovery" style={styles.iconButton}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
    </View>
    <ScrollView testID="scan-scroll" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {scan.error ? <View testID="scan-error" accessibilityRole="alert" style={[styles.notice, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}><Ionicons name="information-circle-outline" size={22} color={colors.icon} /><Text style={[styles.body, styles.flex, { color: colors.text }]}>{scan.error}</Text></View> : null}
      {scan.stage === "capture" ? <>
        {scan.enabled ? <>
          {scan.photo ? <View style={[styles.preview, { backgroundColor: colors.inputBackground }]}><Image testID="scan-photo-preview" source={{ uri: scan.photo.uri }} style={styles.photo} contentFit="contain" accessibilityLabel="Your photo of gym equipment, ready for review" /></View> : <View style={[styles.captureFrame, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}><View style={[styles.scanGlyph, { borderColor: colors.primaryButton }]}><Ionicons name="scan-outline" size={64} color={colors.primaryButton} /></View><Text style={[styles.hero, { color: colors.text }]}>Meet your next machine.</Text><Text style={[styles.body, styles.centered, { color: colors.icon }]}>One machine per photo. Keep its handles and attachments in view.</Text></View>}
          {scan.result?.status === "no_match" ? <View testID="scan-no-match" style={styles.copyBlock}><Text style={[styles.sectionTitle, { color: colors.text }]}>Let’s try another way</Text><Text style={[styles.body, { color: colors.icon }]}>{reasons[scan.result.reason ?? "uncertain"]}</Text></View> : null}
          {scan.photo ? <Text testID="scan-photo-disclosure" style={[styles.caption, { color: colors.icon }]}>Identify sends this photo to OpenAI for safety checks and equipment matching. Avoid people or personal details.</Text> : null}
          {scan.photo && !scan.attemptKey ? <Action id="scan-identify" title="Identify equipment" icon="scan-outline" primary colors={colors} disabled={!scan.photo || blocked} onPress={scan.identify} /> : scan.attemptKey ? <Action id="scan-check-result" title={scan.busy ? "Checking equipment…" : "Check result"} icon="refresh-outline" primary colors={colors} disabled={blocked} onPress={scan.check} /> : null}
          {blocked ? <View testID="scan-pending" accessibilityLiveRegion="polite" style={styles.pending}><ActivityIndicator color={colors.primaryButton} /><Text style={[styles.body, { color: colors.icon }]}>{scan.picking ? "Preparing your photo…" : "Finding possible matches…"}</Text></View> : null}
          <View style={styles.actionsRow}><Action id="scan-take-photo" title={scan.photo ? "Retake" : "Take photo"} icon="camera-outline" primary={!scan.photo} colors={colors} disabled={blocked} onPress={() => void scan.pick("camera")} /><Action id="scan-choose-photo" title="Choose photo" icon="image-outline" colors={colors} disabled={blocked} onPress={() => void scan.pick("library")} /></View>
          {scan.attemptKey ? <Text style={[styles.caption, { color: colors.icon }]}>Checking a result won’t send another photo. Cancelling here may not stop identification already in progress.</Text> : null}
        </> : <View style={styles.copyBlock}><Ionicons name="barbell-outline" size={40} color={colors.primaryButton} /><Text style={[styles.hero, { color: colors.text }]}>Find the right way to train.</Text><Text style={[styles.body, { color: colors.icon }]}>Search your machine, choose an exercise, and see the available guide.</Text></View>}
        <Action id="scan-manual-search" title={blocked ? "Cancel and search manually" : "Search equipment manually"} icon="search-outline" colors={colors} primary={!scan.enabled} onPress={scan.manual} />
      </> : null}
      {scan.stage === "manual" ? <>
        <Text style={[styles.body, { color: colors.icon }]}>Search by machine name. You’ll confirm it before choosing an exercise.</Text>
        <View style={[styles.searchField, { borderColor: colors.inputBorder }]}><Ionicons name="search" size={21} color={colors.icon} /><TextInput testID="scan-equipment-query" accessibilityLabel="Equipment name" value={scan.query} onChangeText={scan.setQuery} onSubmitEditing={() => scan.find()} placeholder="Machine name" placeholderTextColor={colors.icon} maxLength={100} returnKeyType="search" style={[styles.input, { color: colors.text }]} /></View>
        <Action id="scan-search-submit" title="Search equipment" colors={colors} primary disabled={blocked} onPress={() => scan.find()} />
        {scan.search?.items.map((item) => <EquipmentChoice key={item.id} equipment={item} selected={scan.selection?.id === item.id} disabled={blocked} onPress={() => scan.setSelection(item)} colors={colors} />)}
        {scan.search && !scan.search.items.length ? <Text testID="scan-search-empty" style={[styles.body, { color: colors.icon }]}>No equipment found. Try another name.</Text> : null}
        {scan.search?.next_cursor ? <Action id="scan-equipment-more" title="More equipment" colors={colors} disabled={blocked} onPress={() => scan.find(true)} /> : null}
        {scan.selection ? <Action id="scan-confirm-machine" title="Confirm machine" primary colors={colors} disabled={blocked} onPress={scan.confirm} /> : null}
      </> : null}
      {scan.stage === "confirm" ? <>
        <Text style={[styles.body, { color: colors.icon }]}>Choose the machine in your photo. Possible matches can be wrong.</Text>
        {scan.result?.candidates.map((candidate) => <EquipmentChoice key={candidate.equipment.id} equipment={candidate.equipment} selected={scan.selection?.id === candidate.equipment.id} disabled={blocked} onPress={() => scan.setSelection(candidate.equipment)} colors={colors} caption={candidate.confidence.level === "low" ? "Uncertain match — check carefully" : "Possible match"} />)}
        <Action id="scan-confirm-machine" title="Confirm machine" primary colors={colors} disabled={!scan.selection || blocked} onPress={scan.confirm} />
        <Action id="scan-none-match" title="None of these · Search manually" icon="search-outline" colors={colors} onPress={scan.manual} />
        <Action id="scan-retake" title="Try another photo" icon="camera-outline" colors={colors} disabled={blocked} onPress={scan.back} />
      </> : null}
      {scan.stage === "exercises" ? <>
        <Text style={[styles.body, { color: colors.icon }]}>Choose what you want to do. Check any extra equipment before starting.</Text>
        {scan.options?.items.map((item) => <Pressable key={item.exercise_id} testID={`scan-exercise-${item.exercise_id}`} accessibilityRole="button" accessibilityLabel={`${item.name}${item.missing_equipment.length ? `. Also needs ${item.missing_equipment.map((e) => e.name).join(", ")}` : ""}`} disabled={blocked} onPress={() => scan.openGuidance(item.exercise_id)} style={[styles.exerciseRow, { borderColor: colors.inputBorder }]}><View style={styles.flex}><Text style={[styles.sectionTitle, { color: colors.text }]}>{item.name}</Text><Text style={[styles.caption, { color: colors.icon }]}>{item.missing_equipment.length ? `Also needs ${item.missing_equipment.map((e) => e.name).join(", ")}` : "Uses this equipment"}</Text><Text style={[styles.caption, { color: colors.icon }]}>{item.guidance_available ? "Instructions available" : "Instructions unavailable"}{item.approved_video_available ? " · Video available" : ""}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.icon} /></Pressable>)}
        {scan.options && !scan.options.items.length ? <Text testID="scan-options-empty" style={[styles.body, { color: colors.icon }]}>No exercises are currently listed for this equipment. Try another machine.</Text> : null}
        {scan.options?.next_cursor ? <Action id="scan-exercises-more" title="More exercises" colors={colors} disabled={blocked} onPress={scan.moreExercises} /> : null}
        <Action id="scan-find-other" title="Find another machine" icon="search-outline" colors={colors} onPress={scan.manual} />
      </> : null}
      {scan.stage === "guidance" && scan.guidance ? <ScanSafeGuidance guidance={scan.guidance} colors={colors} /> : null}
      {(scan.busy && scan.stage !== "capture" || scan.stage === "guidance" && !scan.guidance && !scan.error) ? <ActivityIndicator testID="scan-discovery-loading" accessibilityLabel="Loading equipment information" color={colors.primaryButton} /> : null}
    </ScrollView>
  </SafeAreaView>;
}
function Action({ id, title, colors, primary = false, disabled = false, icon, onPress }: { id: string; title: string; colors: Palette; primary?: boolean; disabled?: boolean; icon?: React.ComponentProps<typeof Ionicons>["name"]; onPress: () => void }) {
  return <Pressable testID={id} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, { backgroundColor: primary ? colors.primaryButton : colors.inputBackground, borderColor: primary ? colors.primaryButton : colors.inputBorder, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>{icon ? <Ionicons name={icon} size={21} color={primary ? "#FFFFFF" : colors.text} /> : null}<Text style={[styles.actionText, { color: primary ? "#FFFFFF" : colors.text }]}>{title}</Text></Pressable>;
}
function EquipmentChoice({ equipment, selected, disabled, onPress, colors, caption }: { equipment: EquipmentSummary; selected: boolean; disabled: boolean; onPress: () => void; colors: Palette; caption?: string }) {
  return <Pressable testID={`scan-machine-${equipment.id}`} accessibilityRole="radio" accessibilityLabel={equipment.name} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.machineChoice, { borderColor: selected ? colors.primaryButton : colors.inputBorder, backgroundColor: colors.inputBackground }]}><Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={24} color={selected ? colors.primaryButton : colors.icon} /><View style={styles.flex}><Text style={[styles.sectionTitle, { color: colors.text }]}>{equipment.name}</Text>{caption ? <Text style={[styles.caption, { color: colors.icon }]}>{caption}</Text> : null}</View></Pressable>;
}
export function ScanSafeGuidance({ guidance, colors }: { guidance: ExerciseGuidance; colors: Palette }) {
  const content = guidance.instructions.status === "published" ? guidance.instructions.content : null;
  const video = guidance.video;
  return <View testID="scan-safe-guidance" style={styles.copyBlock}>
    {video.status === "approved" && video.asset_id && video.url && video.mime_type ? <ExerciseMedia exerciseName={guidance.name} colors={colors} media={{ id: video.asset_id, url: video.url, mime_type: video.mime_type, poster_url: video.poster_url }} /> : <View testID="scan-video-unavailable" style={[styles.unavailable, { backgroundColor: colors.inputBackground }]}><Ionicons name="videocam-off-outline" size={24} color={colors.icon} /><Text style={[styles.body, { color: colors.icon }]}>Video demonstration unavailable</Text></View>}
    {content ? <><Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>How to do it</Text>{content.steps.map((step, index) => <View key={index} style={styles.step}><Text style={[styles.stepNumber, { color: colors.primaryButton }]}>{index + 1}</Text><Text style={[styles.body, styles.flex, { color: colors.text }]}>{step}</Text></View>)}{[["Technique tips", content.cues], ["Avoid", content.mistakes], ["Getting started", [content.beginner_guidance]], ["Why this exercise", [content.benefits]]].map(([label, values]) => <View key={String(label)} style={styles.copyBlock}><Text style={[styles.sectionTitle, { color: colors.text }]}>{label}</Text>{(values as string[]).map((value, i) => <Text key={i} style={[styles.body, { color: colors.icon }]}>{value}</Text>)}</View>)}</> : <View testID="scan-instructions-unavailable" style={styles.copyBlock}><Text style={[styles.sectionTitle, { color: colors.text }]}>Instructions unavailable</Text><Text style={[styles.body, { color: colors.icon }]}>A reviewed guide isn’t available for this exercise yet. Ask a qualified trainer for help with setup and technique.</Text></View>}
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1 }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 }, headerTitle: { flex: 1, fontFamily: Fonts.sans, fontSize: 20, fontWeight: "700" }, iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingTop: 12, paddingBottom: 36, gap: 16 }, flex: { flex: 1, minWidth: 0 }, hero: { fontFamily: Fonts.sans, fontSize: 25, lineHeight: 31, fontWeight: "700" }, body: { fontFamily: Fonts.sans, fontSize: 16, lineHeight: 23 }, caption: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20 }, sectionTitle: { fontFamily: Fonts.sans, fontSize: 17, lineHeight: 23, fontWeight: "600" }, centered: { textAlign: "center" },
  captureFrame: { borderWidth: 1, borderStyle: "dashed", borderRadius: 24, minHeight: 280, padding: 24, alignItems: "center", justifyContent: "center", gap: 16 }, scanGlyph: { padding: 8 }, preview: { height: 290, borderRadius: 22, overflow: "hidden" }, photo: { width: "100%", height: "100%" }, copyBlock: { gap: 12 },
  action: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 1 }, actionText: { fontFamily: Fonts.sans, fontSize: 16, lineHeight: 22, fontWeight: "600", flexShrink: 1, textAlign: "center" }, actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, pending: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 10 },
  notice: { flexDirection: "row", padding: 14, borderWidth: 1, borderRadius: 14, gap: 10, alignItems: "flex-start" }, machineChoice: { borderWidth: 1.5, borderRadius: 16, minHeight: 70, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }, searchField: { minHeight: 48, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, gap: 10 }, input: { flex: 1, minHeight: 48, fontFamily: Fonts.sans, fontSize: 16, paddingVertical: 12 }, exerciseRow: { borderBottomWidth: 1, paddingVertical: 16, minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12 }, unavailable: { minHeight: 80, padding: 18, borderRadius: 16, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }, step: { flexDirection: "row", gap: 14 }, stepNumber: { width: 24, fontSize: 17, fontWeight: "700", lineHeight: 23 },
});
