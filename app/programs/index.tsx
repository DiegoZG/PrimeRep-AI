import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProgramCard } from "@/components/program";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { ProgramFilters, ProgramGoal, ProgramLevel, ProgramSummary } from "@/interfaces/programs";
import { getActiveProgram, listPrograms } from "@/services/programService";
import { AuthContext } from "@/utils/authContext";
import { EquipmentContext } from "@/utils/equipmentContext";
import { useProgramDraft } from "@/utils/programDraftContext";
import { PROGRAM_GOAL_LABELS, PROGRAM_LEVEL_LABELS, todayIso } from "@/utils/programDisplay";

const PAGE_SIZE = 20;

export default function ProgramCatalogScreen() {
  const router = useRouter();
  const route = useLocalSearchParams<{ recommended?: string; scope?: string }>();
  const colors = Colors[useColorScheme() ?? "light"];
  const { fontScale, width = 375 } = useWindowDimensions();
  const expandedText = fontScale > 1.4;
  const chipWidth = Math.max(44, width - 40);
  const { token, user } = useContext(AuthContext);
  const { items: equipment } = useContext(EquipmentContext);
  const { resetDraft } = useProgramDraft();
  const accountKey = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const accountKeyRef = useRef(accountKey);
  accountKeyRef.current = accountKey;
  const requestRef = useRef(0);
  const [items, setItems] = useState<ProgramSummary[]>([]);
  const [contentOwnerKey, setContentOwnerKey] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ProgramFilters>({
    scope: route.scope === "private" ? "private" : "all",
    recommended: route.recommended === "true" || undefined,
  });

  useEffect(() => { setItems([]); setContentOwnerKey(null); setTotal(0); setError(null); setLoading(Boolean(token)); }, [accountKey, token]);

  const load = useCallback(async (offset = 0) => {
    if (!token) return;
    const requestId = ++requestRef.current;
    const requestAccount = accountKey;
    const current = () => requestRef.current === requestId && accountKeyRef.current === requestAccount;
    if (offset) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const [response, activePrograms] = await Promise.all([
        listPrograms(token, { ...filters, limit: PAGE_SIZE, offset }),
        getActiveProgram(token, todayIso()),
      ]);
      if (!current()) return;
      const taggedItems = response.items.map((item) => ({
        ...item,
        isActive: activePrograms.current?.templateId === item.id,
        isScheduled: activePrograms.scheduled?.templateId === item.id,
      }));
      setItems((existing) => offset ? [...existing, ...taggedItems.filter((item) => !existing.some((old) => old.id === item.id))] : taggedItems);
      setTotal(response.total);
      setContentOwnerKey(requestAccount);
    } catch (loadError) {
      if (!current()) return;
      console.warn("Programs couldn't load", loadError);
      setContentOwnerKey(requestAccount);
      setError("Programs couldn’t load. Check your connection and try again.");
    } finally {
      if (current()) { setLoading(false); setLoadingMore(false); }
    }
  }, [accountKey, filters, token]);

  useFocusEffect(useCallback(() => { void load(); return () => { requestRef.current += 1; }; }, [load]));

  const toggleFilter = <K extends "goal" | "level" | "frequency" | "maxDurationMinutes">(key: K, value: ProgramFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: current[key] === value ? undefined : value, recommended: undefined } as ProgramFilters));
  };

  const create = () => { resetDraft(); router.push("/programs/builder"); };
  const activeFilterCount = Number(Boolean(filters.goal)) + Number(Boolean(filters.level)) + Number(Boolean(filters.frequency)) + Number(Boolean(filters.maxDurationMinutes)) + (filters.equipmentIds?.length ?? 0);
  const toggleEquipment = (equipmentId: string) => {
    setFilters((current) => {
      const selected = current.equipmentIds ?? [];
      return {
        ...current,
        equipmentIds: selected.includes(equipmentId)
          ? selected.filter((id) => id !== equipmentId)
          : [...selected, equipmentId],
        recommended: undefined,
      };
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView testID="program-catalog-scroll" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back from Programs" onPress={() => router.back()} style={({ pressed }) => [styles.headerAction, { opacity: pressed ? 0.65 : 1 }]}><Ionicons name="arrow-back" size={24} color={colors.text} accessible={false} /></Pressable>
            {!expandedText ? <View style={styles.headerCopy}><CatalogText style={styles.title}>Programs</CatalogText><CatalogText style={[styles.subtitle, { color: colors.icon }]}>{filters.recommended ? "Recommended for you" : `${total || ""} training plans`.trim()}</CatalogText></View> : <View style={styles.headerSpace} />}
            <Pressable testID="program-catalog-create" accessibilityRole="button" accessibilityLabel="Build a program" onPress={create} style={({ pressed }) => [styles.add, { backgroundColor: pressed ? "#583BD0" : colors.primaryButton }]}><Ionicons name="add" size={23} color="#FFF" accessible={false} /></Pressable>
          </View>
          {expandedText ? <View style={styles.expandedHeaderCopy}><CatalogText style={styles.title}>Programs</CatalogText><CatalogText style={[styles.subtitle, { color: colors.icon }]}>{filters.recommended ? "Recommended for you" : `${total || ""} training plans`.trim()}</CatalogText></View> : null}
        </View>
        <View style={styles.scopeRow}>
          {(["all", "system", "private"] as const).map((scope) => <FilterChip key={scope} label={scope === "all" ? "All" : scope === "system" ? "PrimeRep" : "Mine"} active={filters.scope === scope} onPress={() => setFilters((current) => ({ ...current, scope, recommended: undefined }))} testID={`program-filter-scope-${scope}`} colors={colors} maxWidth={chipWidth} />)}
          <Pressable testID="program-filters-toggle" accessibilityRole="button" accessibilityLabel={`Program filters${activeFilterCount ? `, ${activeFilterCount} selected` : ""}`} accessibilityState={{ expanded: showFilters, selected: Boolean(activeFilterCount) }} onPress={() => setShowFilters((current) => !current)} style={({ pressed }) => [styles.filterToggle, { maxWidth: chipWidth, borderColor: showFilters || activeFilterCount ? colors.icon : colors.inputBorder, backgroundColor: showFilters || activeFilterCount ? selectedSurface(colors) : colors.inputBackground, opacity: pressed ? 0.75 : 1 }]}><Ionicons name="options-outline" size={18} color={colors.text} accessible={false} /><CatalogText style={styles.chipText}>Filters{activeFilterCount ? ` · ${activeFilterCount}` : ""}</CatalogText></Pressable>
        </View>
        {showFilters ? <View testID="program-filters-panel" style={[styles.filterPanel, { borderColor: colors.inputBorder }]}>
          <CatalogText style={[styles.filterLabel, { color: colors.icon }]}>Goal</CatalogText><FilterOptions expanded={expandedText}>{(Object.keys(PROGRAM_GOAL_LABELS) as ProgramGoal[]).map((goal) => <FilterChip key={goal} label={PROGRAM_GOAL_LABELS[goal]} active={filters.goal === goal} onPress={() => toggleFilter("goal", goal)} testID={`program-filter-goal-${goal}`} colors={colors} maxWidth={chipWidth} />)}</FilterOptions>
          <CatalogText style={[styles.filterLabel, { color: colors.icon }]}>Experience</CatalogText><FilterOptions expanded={expandedText}>{(Object.keys(PROGRAM_LEVEL_LABELS) as ProgramLevel[]).map((level) => <FilterChip key={level} label={PROGRAM_LEVEL_LABELS[level]} active={filters.level === level} onPress={() => toggleFilter("level", level)} testID={`program-filter-level-${level}`} colors={colors} maxWidth={chipWidth} />)}</FilterOptions>
          <CatalogText style={[styles.filterLabel, { color: colors.icon }]}>Schedule</CatalogText><FilterOptions expanded={expandedText}>{[1, 2, 3, 4, 5, 6, 7].map((frequency) => <FilterChip key={frequency} label={`${frequency} ${frequency === 1 ? "day" : "days"}`} active={filters.frequency === frequency} onPress={() => toggleFilter("frequency", frequency)} testID={`program-filter-frequency-${frequency}`} colors={colors} maxWidth={chipWidth} />)}{[25, 35, 45, 60].map((duration) => <FilterChip key={duration} label={`≤ ${duration} min`} active={filters.maxDurationMinutes === duration} onPress={() => toggleFilter("maxDurationMinutes", duration)} testID={`program-filter-duration-${duration}`} colors={colors} maxWidth={chipWidth} />)}</FilterOptions>
          <CatalogText style={[styles.filterLabel, { color: colors.icon }]}>Equipment</CatalogText><FilterOptions expanded={false}>{equipment.map((item) => <FilterChip key={item.id} label={item.name} active={filters.equipmentIds?.includes(item.id) ?? false} onPress={() => toggleEquipment(item.id)} testID={`program-filter-equipment-${item.id}`} colors={colors} maxWidth={chipWidth} />)}</FilterOptions>
          <Pressable testID="program-filters-close" accessibilityRole="button" accessibilityLabel="Hide program filters" onPress={() => setShowFilters(false)} style={({ pressed }) => [styles.closeFilters, { borderColor: colors.inputBorder, backgroundColor: pressed ? selectedSurface(colors) : colors.inputBackground }]}><Ionicons name="chevron-up" size={18} color={colors.text} accessible={false} /><CatalogText style={[styles.actionText, styles.flexibleAction]}>Hide filters</CatalogText></Pressable>
        </View> : null}

        {loading || contentOwnerKey !== accountKey ? <CatalogState colors={colors} kind="loading" title="Loading programs…" testID="program-catalog-loading" /> : error && items.length === 0 ? <CatalogState colors={colors} kind="error" title="Programs unavailable" message={error} actionLabel="Retry" onAction={() => void load()} testID="program-catalog-error" /> : (
        <View style={styles.list}>
          {error ? <CatalogText accessibilityRole="alert" style={[styles.error, { color: errorColor(colors) }]}>{error}</CatalogText> : null}
          {items.map((program) => <View key={program.id} style={styles.card}><ProgramCard compact program={program} onPress={() => router.push({ pathname: "/programs/[templateId]", params: { templateId: program.id } })} /></View>)}
          {items.length === 0 ? <CatalogState colors={colors} kind="empty" title="No programs match" message="Clear a filter or build a program that fits you." actionLabel="Build program" onAction={create} testID="program-catalog-empty" /> : null}
          {items.length < total ? <Pressable testID="program-load-more" accessibilityRole="button" accessibilityLabel="Load more programs" accessibilityState={{ busy: loadingMore, disabled: loadingMore }} disabled={loadingMore} onPress={() => void load(items.length)} style={({ pressed }) => [styles.loadMore, { borderColor: colors.inputBorder, backgroundColor: pressed ? selectedSurface(colors) : colors.inputBackground, opacity: loadingMore ? 0.6 : 1 }]}><CatalogText style={styles.actionText}>{loadingMore ? "Loading…" : "Load more"}</CatalogText></Pressable> : null}
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CatalogText({ style, ...props }: React.ComponentProps<typeof ThemedText>) {
  return <ThemedText {...props} style={[style, { lineHeight: undefined }]} />;
}

function selectedSurface(colors: typeof Colors.light) {
  return colors.background === Colors.dark.background ? "#282B2D" : "#F2F3F3";
}

function errorColor(colors: typeof Colors.light) {
  return colors.background === Colors.dark.background ? "#FF8C82" : "#D92D20";
}

function FilterOptions({ expanded, children }: { expanded: boolean; children: React.ReactNode }) {
  return expanded ? <View style={[styles.filterRow, styles.wrappedFilters]}>{children}</View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{children}</ScrollView>;
}

function FilterChip({ label, active, onPress, testID, colors, maxWidth }: { label: string; active: boolean; onPress: () => void; testID: string; colors: typeof Colors.light; maxWidth: number }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`Filter by ${label}`} onPress={onPress} style={({ pressed }) => [styles.chip, { maxWidth, borderColor: active ? colors.icon : colors.inputBorder, backgroundColor: active ? selectedSurface(colors) : colors.inputBackground, opacity: pressed ? 0.75 : 1 }]}>{active ? <Ionicons name="checkmark" size={16} color={colors.text} accessible={false} /> : null}<CatalogText style={styles.chipText}>{label}</CatalogText></Pressable>;
}

function CatalogState({ colors, kind, title, message, actionLabel, onAction, testID }: { colors: typeof Colors.light; kind: "loading" | "empty" | "error"; title: string; message?: string; actionLabel?: string; onAction?: () => void; testID: string }) {
  return <View testID={testID} style={styles.state}>
    {kind === "loading" ? <ActivityIndicator color={colors.icon} accessibilityLabel={title} /> : <Ionicons name={kind === "error" ? "cloud-offline-outline" : "barbell-outline"} size={28} color={kind === "error" ? errorColor(colors) : colors.icon} accessible={false} />}
    <CatalogText style={styles.stateTitle}>{title}</CatalogText>
    {message ? <CatalogText style={[styles.stateMessage, { color: colors.icon }]}>{message}</CatalogText> : null}
    {actionLabel && onAction ? <Pressable testID={`${testID}-action`} accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={({ pressed }) => [styles.stateAction, { borderColor: colors.inputBorder, backgroundColor: kind === "empty" ? pressed ? "#583BD0" : colors.primaryButton : pressed ? selectedSurface(colors) : colors.inputBackground }]}><CatalogText style={[styles.actionText, { color: kind === "empty" ? "#FFF" : colors.text }]}>{actionLabel}</CatalogText></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { flexGrow: 1, paddingBottom: 48 },
  header: { padding: 16 }, headerRow: { flexDirection: "row", alignItems: "center", gap: 8 }, headerAction: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, add: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, minWidth: 0 }, headerSpace: { flex: 1 }, expandedHeaderCopy: { marginTop: 12 }, title: { fontSize: 24, fontWeight: "800" }, subtitle: { marginTop: 4, fontSize: 13 },
  scopeRow: { marginHorizontal: 20, paddingBottom: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 8 }, filterPanel: { marginHorizontal: 20, marginBottom: 6, borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 12 }, filterLabel: { marginTop: 8, fontSize: 14, fontWeight: "700" }, filterRow: { paddingVertical: 8, flexDirection: "row", alignItems: "flex-start", gap: 8 }, wrappedFilters: { flexWrap: "wrap" }, filterToggle: { minHeight: 44, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  chip: { minHeight: 44, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, chipText: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
  list: { padding: 20 }, card: { marginBottom: 12 }, error: { textAlign: "center", marginBottom: 14 }, closeFilters: { minHeight: 44, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 8, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  loadMore: { minHeight: 48, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: "center", justifyContent: "center", marginTop: 8 }, actionText: { fontSize: 16, fontWeight: "700", textAlign: "center" }, flexibleAction: { flexShrink: 1, minWidth: 0 },
  state: { paddingHorizontal: 20, paddingVertical: 32, alignItems: "center" }, stateTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", marginTop: 12 }, stateMessage: { fontSize: 14, textAlign: "center", marginTop: 8 }, stateAction: { minHeight: 44, padding: 12, marginTop: 16, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
