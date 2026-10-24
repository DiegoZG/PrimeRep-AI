import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, TextInput, useWindowDimensions, View } from "react-native";
import { ProfilePage, ProfileScroll, profileStyles } from "@/components/profile-ui";
import { WorkoutText as Text } from "@/components/workout/WorkoutText";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { accountGeneration, accountRequestGuard } from "@/services/accountScope";
import { getAdminFeatureFlags, updateFeatureFlags, type AdminFeatureFlagSnapshot, type FeatureFlagAudit, type SubscriptionFlags } from "@/services/featureFlagService";
import { HttpError } from "@/services/httpClient";
import { AuthContext } from "@/utils/authContext";

const label = (key: string) => ({ subscriptions_purchases_enabled: "Purchases", subscriptions_enforcement_enabled: "Enforcement", subscriptions_launch_at: "Launch (UTC)" })[key] ?? key;
const auditValues = (value: Record<string, unknown>) => ({ ...(typeof value.flags === "object" && value.flags ? value.flags : {}), ...Object.fromEntries(Object.entries(value).filter(([key]) => key !== "flags")) });
function auditChanges(entry: FeatureFlagAudit) {
  const before = auditValues(entry.before);
  const after = auditValues(entry.after);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => `${label(key)}: ${JSON.stringify(before[key] ?? null)} → ${JSON.stringify(after[key] ?? null)}`).join("\n");
}
const launchValue = (value: string | null) => value ? new Date(value).toISOString() : "";
const deadline = (launch: string) => {
  const millis = Date.parse(launch);
  return Number.isFinite(millis) ? new Date(millis + 30 * 86400000).toISOString() : null;
};

export default function FeatureFlagsScreen() {
  const { user } = useContext(AuthContext);
  return <AccountFeatureFlags key={`${user?.id ?? "guest"}:${accountGeneration()}`} />;
}

function AccountFeatureFlags() {
  const { user, token } = useContext(AuthContext);
  const router = useRouter();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { fontScale } = useWindowDimensions();
  const [snapshot, setSnapshot] = useState<AdminFeatureFlagSnapshot | null>(null);
  const [flags, setFlags] = useState<SubscriptionFlags>({ subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false });
  const [launch, setLaunch] = useState("");
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState(false);
  const pageAccountGuard = useRef(accountRequestGuard()).current;
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const applySnapshot = useCallback((next: AdminFeatureFlagSnapshot) => {
    setSnapshot(next);
    setFlags({ ...next.flags });
    setLaunch(launchValue(next.subscriptions_launch_at));
    setForbidden(false);
    setConflict(false);
  }, []);
  const handleFailure = useCallback((err: unknown) => {
    setSaved(false);
    if (err instanceof HttpError && (err.status === 403 || err.status === 401)) {
      setSnapshot(null);
      setFlags({ subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false });
      setLaunch("");
      setForbidden(true);
      setError(null);
    } else {
      const stale = err instanceof HttpError && err.status === 409;
      if (stale) setConflict(true);
      setError(stale ? "These flags changed elsewhere. Your edits are preserved. Refresh to review the latest version before saving." : err instanceof Error ? err.message : "Feature flags couldn’t be updated. Try again.");
    }
  }, []);
  const load = useCallback(async () => {
    if (!mounted.current || !pageAccountGuard() || owner.current !== user?.id || inFlight.current || !token || !user?.id) return;
    const isCurrent = accountRequestGuard();
    const startedOwner = user.id;
    const current = () => mounted.current && isCurrent() && owner.current === startedOwner;
    inFlight.current = true;
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const next = await getAdminFeatureFlags(token);
      if (current()) {
        if (!next.can_manage_flags) throw new HttpError("Administrator access required.", 403);
        applySnapshot(next);
      }
    } catch (err) { if (current()) handleFailure(err); }
    finally { if (current()) { inFlight.current = false; setBusy(false); } }
  }, [applySnapshot, handleFailure, pageAccountGuard, token, user?.id]);
  useFocusEffect(useCallback(() => { if (!snapshotRef.current) void load(); }, [load]));

  const dirty = !!snapshot && (flags.subscriptions_purchases_enabled !== snapshot.flags.subscriptions_purchases_enabled || flags.subscriptions_enforcement_enabled !== snapshot.flags.subscriptions_enforcement_enabled || launch !== launchValue(snapshot.subscriptions_launch_at));
  const editFlags = (key: keyof SubscriptionFlags, value: boolean) => { setFlags((old) => ({ ...old, [key]: value })); setSaved(false); };
  const refresh = () => {
    if (inFlight.current) return;
    if (dirty) Alert.alert("Discard unsaved changes?", "Refreshing replaces your edits with the current server settings.", [{ text: "Keep editing", style: "cancel" }, { text: "Discard and refresh", style: "destructive", onPress: () => void load() }]);
    else void load();
  };
  const save = async () => {
    if (!mounted.current || !pageAccountGuard() || owner.current !== user?.id || !snapshot || !token || !user?.id || inFlight.current || conflict || !dirty) return;
    setSaved(false);
    const trimmedLaunch = launch.trim();
    if (trimmedLaunch && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(trimmedLaunch) || !Number.isFinite(Date.parse(trimmedLaunch)))) {
      setError("Enter a UTC timestamp ending in Z, such as 2026-11-01T12:00:00Z, or leave it blank.");
      return;
    }
    const isCurrent = accountRequestGuard();
    const startedOwner = user.id;
    const current = () => mounted.current && isCurrent() && owner.current === startedOwner;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await updateFeatureFlags(token, {
        expected_version: snapshot.version,
        flags: { ...flags },
        ...(!snapshot.launch_locked ? { subscriptions_launch_at: trimmedLaunch || null } : {}),
      });
      if (current()) {
        if (!next.can_manage_flags) throw new HttpError("Administrator access required.", 403);
        applySnapshot(next);
        setSaved(true);
      }
    } catch (err) { if (current()) handleFailure(err); }
    finally { if (current()) { inFlight.current = false; setBusy(false); } }
  };
  const transition = dirty ? deadline(launch) : snapshot?.transition_ends_at;
  const muted = { color: colors.icon };
  const button = (disabled: boolean) => [profileStyles.button, { borderWidth: 1, borderColor: colors.inputBorder, opacity: disabled ? 0.5 : 1 }];

  return <ProfilePage title="Feature flags" onBack={() => router.back()} testID="feature-flags-screen"><ProfileScroll>
    {!user || !token || forbidden ? <Text testID="feature-flags-forbidden" accessibilityRole="alert">Administrator access is required to view or change feature flags.</Text> : <>
      <Text style={muted}>Subscription rollout controls. Billing purchases and training enforcement are not connected until Part 11 is implemented.</Text>
      {busy ? <Text accessibilityLiveRegion="polite">Updating feature flags…</Text> : null}
      {snapshot ? <>
        <View style={styles.section}><Text testID="feature-flags-environment" style={styles.heading}>Environment: {snapshot.environment}</Text><Text>Version {snapshot.version}</Text><Text style={muted}>Last updated: {snapshot.updated_at ?? "Never"}</Text></View>
        <View style={styles.section}>{([
          ["subscriptions_purchases_enabled", "Subscription purchases", "Allows subscription offers and purchases when billing is connected."],
          ["subscriptions_enforcement_enabled", "Subscription enforcement", "Requires entitlement for new training when Part 11 is connected."],
        ] as const).map(([key, title, description]) => <View key={key} style={[styles.control, { flexDirection: fontScale >= 1.5 ? "column" : "row", alignItems: fontScale >= 1.5 ? "flex-start" : "center" }]}>
          <View style={{ flexShrink: 1, flexGrow: 1, gap: 6 }}><Text style={styles.heading}>{title}</Text><Text style={muted}>{description}</Text></View>
          <Switch testID={`feature-flag-${key}`} accessibilityLabel={title} accessibilityState={{ disabled: busy, busy }} disabled={busy} value={flags[key]} onValueChange={(value) => editFlags(key, value)} trackColor={{ false: colors.inputBorder, true: colors.inputBorder }} thumbColor={flags[key] ? colors.primaryButton : colors.icon} ios_backgroundColor={colors.inputBorder} />
        </View>)}</View>
        <View style={styles.section}>
          <Text style={styles.heading}>Launch date (UTC)</Text>
          <Text style={muted}>Enforcement requires purchases to be enabled and a launch date at or before the current time. Existing accounts receive access until 30 days after this date.</Text>
          <TextInput testID="feature-flags-launch" accessibilityLabel="Subscription launch date in UTC" accessibilityHint="ISO 8601 timestamp ending in Z. Leave blank for no launch date." value={launch} onChangeText={(value) => { setLaunch(value); setSaved(false); }} editable={!busy && !snapshot.launch_locked} accessibilityState={{ disabled: busy || snapshot.launch_locked }} autoCapitalize="none" autoCorrect={false} placeholder="YYYY-MM-DDTHH:mm:ssZ" placeholderTextColor={colors.icon} style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]} />
          {snapshot.launch_locked ? <Text testID="feature-flags-launch-locked" style={muted}>The launch date is locked because enforcement has been enabled. Turning enforcement off does not unlock it.</Text> : null}
          <Text testID="feature-flags-transition">Transition ends (UTC): {transition ?? "Not scheduled"}</Text>
        </View>
        {dirty ? <Text testID="feature-flags-unsaved">Unsaved changes</Text> : null}
        <Pressable testID="feature-flags-save" accessibilityRole="button" accessibilityLabel="Save feature flags" accessibilityState={{ disabled: busy || !dirty || conflict, busy }} disabled={busy || !dirty || conflict} onPress={() => void save()} style={button(busy || !dirty || conflict)}><Text style={{ color: colors.primaryButton, fontWeight: "700" }}>Save changes</Text></Pressable>
      </> : null}
      {error ? <Text testID="feature-flags-error" accessibilityRole="alert" style={{ color: scheme === "dark" ? "#F18C86" : "#B42318" }}>{error}</Text> : null}
      {saved ? <Text testID="feature-flags-saved" accessibilityLiveRegion="polite">Changes saved.</Text> : null}
      <Pressable testID="feature-flags-refresh" accessibilityRole="button" accessibilityLabel="Refresh feature flags" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={refresh} style={button(busy)}><Text style={{ color: colors.primaryButton, fontWeight: "600" }}>Refresh</Text></Pressable>
      {snapshot ? <View style={styles.section}><Text style={styles.heading}>Recent changes</Text>{snapshot.history.length ? snapshot.history.map((entry) => <View key={entry.version} testID={`feature-flags-audit-${entry.version}`} style={{ gap: 6 }}><Text style={{ fontWeight: "600" }}>Version {entry.version} · {entry.changed_at}</Text><Text style={muted}>Changed by: {entry.changed_by ?? "Unknown administrator"}</Text><Text>{auditChanges(entry)}</Text></View>) : <Text style={muted}>No changes yet.</Text>}</View> : null}
    </>}
  </ProfileScroll></ProfilePage>;
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  heading: { fontSize: 17, fontWeight: "600" },
  control: { gap: 14, minHeight: 60 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, padding: 14, fontSize: 16 },
});
