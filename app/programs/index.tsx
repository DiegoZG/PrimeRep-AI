import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProgramCard, ProgramHeader } from "@/components/program";
import { ScreenState } from "@/components/screen-state";
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
      <ProgramHeader title="Programs" subtitle={filters.recommended ? "Recommended for you" : `${total || ""} training plans`.trim()} onBack={() => router.back()} action={<Pressable testID="program-catalog-create" accessibilityRole="button" accessibilityLabel="Build a program" onPress={create} style={[styles.add, { backgroundColor: colors.primaryButton }]}><Ionicons name="add" size={23} color="#FFF" /></Pressable>} />
      <ScrollView horizontal style={styles.scopeScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeRow}>
        {(["all", "system", "private"] as const).map((scope) => <FilterChip key={scope} label={scope === "all" ? "All" : scope === "system" ? "PrimeRep" : "Mine"} active={filters.scope === scope} onPress={() => setFilters((current) => ({ ...current, scope, recommended: undefined }))} testID={`program-filter-scope-${scope}`} colors={colors} />)}
        <Pressable testID="program-filters-toggle" accessibilityRole="button" accessibilityLabel={`Program filters${activeFilterCount ? `, ${activeFilterCount} selected` : ""}`} accessibilityState={{ expanded: showFilters }} onPress={() => setShowFilters((current) => !current)} style={[styles.filterToggle, { borderColor: showFilters || activeFilterCount ? colors.primaryButton : colors.inputBorder, backgroundColor: showFilters || activeFilterCount ? "rgba(106,79,245,0.11)" : colors.inputBackground }]}><Ionicons name="options-outline" size={17} color={showFilters || activeFilterCount ? colors.primaryButton : colors.text} /><ThemedText style={[styles.chipText, { color: showFilters || activeFilterCount ? colors.primaryButton : colors.text }]}>Filters{activeFilterCount ? ` · ${activeFilterCount}` : ""}</ThemedText></Pressable>
      </ScrollView>
      {showFilters ? <View testID="program-filters-panel" style={[styles.filterPanel, { borderColor: colors.inputBorder }]}>
        <ThemedText style={[styles.filterLabel, { color: colors.placeholder }]}>Goal</ThemedText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{(Object.keys(PROGRAM_GOAL_LABELS) as ProgramGoal[]).map((goal) => <FilterChip key={goal} label={PROGRAM_GOAL_LABELS[goal]} active={filters.goal === goal} onPress={() => toggleFilter("goal", goal)} testID={`program-filter-goal-${goal}`} colors={colors} />)}</ScrollView>
        <ThemedText style={[styles.filterLabel, { color: colors.placeholder }]}>Experience</ThemedText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{(Object.keys(PROGRAM_LEVEL_LABELS) as ProgramLevel[]).map((level) => <FilterChip key={level} label={PROGRAM_LEVEL_LABELS[level]} active={filters.level === level} onPress={() => toggleFilter("level", level)} testID={`program-filter-level-${level}`} colors={colors} />)}</ScrollView>
        <ThemedText style={[styles.filterLabel, { color: colors.placeholder }]}>Schedule</ThemedText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{[1, 2, 3, 4, 5, 6, 7].map((frequency) => <FilterChip key={frequency} label={`${frequency} ${frequency === 1 ? "day" : "days"}`} active={filters.frequency === frequency} onPress={() => toggleFilter("frequency", frequency)} testID={`program-filter-frequency-${frequency}`} colors={colors} />)}{[25, 35, 45, 60].map((duration) => <FilterChip key={duration} label={`≤ ${duration} min`} active={filters.maxDurationMinutes === duration} onPress={() => toggleFilter("maxDurationMinutes", duration)} testID={`program-filter-duration-${duration}`} colors={colors} />)}</ScrollView>
        <ThemedText style={[styles.filterLabel, { color: colors.placeholder }]}>Equipment</ThemedText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{equipment.map((item) => <FilterChip key={item.id} label={item.name} active={filters.equipmentIds?.includes(item.id) ?? false} onPress={() => toggleEquipment(item.id)} testID={`program-filter-equipment-${item.id}`} colors={colors} />)}</ScrollView>
      </View> : null}

      {loading || contentOwnerKey !== accountKey ? <ScreenState colors={colors} kind="loading" title="Loading programs…" testID="program-catalog-loading" /> : error && items.length === 0 ? <ScreenState colors={colors} kind="error" title="Programs unavailable" message={error} actionLabel="Retry" onAction={() => void load()} testID="program-catalog-error" /> : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {error ? <ThemedText accessibilityRole="alert" style={styles.error}>{error}</ThemedText> : null}
          {items.map((program) => <View key={program.id} style={styles.card}><ProgramCard compact program={program} onPress={() => router.push({ pathname: "/programs/[templateId]", params: { templateId: program.id } })} /></View>)}
          {items.length === 0 ? <ScreenState colors={colors} kind="empty" title="No programs match" message="Clear a filter or build a program that fits you." actionLabel="Build program" onAction={create} testID="program-catalog-empty" /> : null}
          {items.length < total ? <Pressable testID="program-load-more" accessibilityRole="button" accessibilityLabel="Load more programs" accessibilityState={{ busy: loadingMore, disabled: loadingMore }} disabled={loadingMore} onPress={() => void load(items.length)} style={[styles.loadMore, { borderColor: colors.inputBorder }]}><ThemedText style={{ color: colors.primaryButton, fontWeight: "800" }}>{loadingMore ? "Loading…" : "Load more"}</ThemedText></Pressable> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function FilterChip({ label, active, onPress, testID, colors }: { label: string; active: boolean; onPress: () => void; testID: string; colors: typeof Colors.light }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`Filter by ${label}`} onPress={onPress} style={[styles.chip, { borderColor: active ? colors.primaryButton : colors.inputBorder, backgroundColor: active ? "rgba(106,79,245,0.11)" : colors.inputBackground }]}><ThemedText style={[styles.chipText, { color: active ? colors.primaryButton : colors.text }]}>{label}</ThemedText></Pressable>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, add: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  scopeScroll: { flexGrow: 0, flexShrink: 0, height: 48 }, scopeRow: { minHeight: 48, paddingHorizontal: 20, paddingBottom: 8, alignItems: "center", gap: 8 }, filterPanel: { marginHorizontal: 20, marginBottom: 6, borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 10 }, filterLabel: { marginTop: 5, paddingHorizontal: 2, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }, filterRow: { paddingVertical: 6, gap: 8 }, filterToggle: { minHeight: 40, borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  chip: { minHeight: 40, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }, chipText: { fontSize: 13, fontWeight: "700" },
  list: { padding: 20, paddingBottom: 48 }, card: { marginBottom: 12 }, error: { color: "#D92D20", textAlign: "center", marginBottom: 14 },
  loadMore: { minHeight: 50, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 8 },
});
