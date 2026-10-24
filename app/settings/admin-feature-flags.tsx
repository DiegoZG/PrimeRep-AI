import { Href, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Switch, TextInput, useWindowDimensions, View } from "react-native";
import { ProfilePage, ProfileScroll, profileStyles } from "@/components/profile-ui";
import { WorkoutText as Text } from "@/components/workout/WorkoutText";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { accountGeneration, accountRequestGuard } from "@/services/accountScope";
import { getAdminFeatureFlags, updateFeatureFlags, type AdminFeatureFlagSnapshot, type FeatureFlagAudit, type FeatureFlagAudiences, type SubscriptionFlags } from "@/services/featureFlagService";
import { HttpError } from "@/services/httpClient";
import { AuthContext } from "@/utils/authContext";

function label(key: string): string {
  if (key.startsWith("audiences.")) return `Audience: ${label(key.slice(10))}`;
  if (key.startsWith("overrides.")) return `Override: ${label(key.slice(10))}`;
  return ({ subscriptions_purchases_enabled: "Purchases", subscriptions_enforcement_enabled: "Enforcement", subscriptions_launch_at: "Launch (UTC)" })[key] ?? key;
}
const defaultAudiences: FeatureFlagAudiences = { subscriptions_purchases_enabled: "everyone", subscriptions_enforcement_enabled: "everyone" };
const auditValues = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).flatMap(([key, nested]) => ["flags", "audiences", "overrides"].includes(key) && typeof nested === "object" && nested ? Object.entries(nested).map(([field, setting]) => [`${key === "flags" ? "" : `${key}.`}${field}`, setting]) : [[key, nested]]));
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
  const [audiences, setAudiences] = useState<FeatureFlagAudiences>({ ...defaultAudiences });
  const [launch, setLaunch] = useState("");
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirmation, setConfirmation] = useState<{ action: () => void } | null>(null);
  const pageAccountGuard = useRef(accountRequestGuard()).current;
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const dirtyRef = useRef(false);
  const confirmationGeneration = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const applySnapshot = useCallback((next: AdminFeatureFlagSnapshot) => {
    setSnapshot(next);
    setFlags({ ...next.flags });
    setAudiences({ ...defaultAudiences, ...next.audiences });
    setLaunch(launchValue(next.subscriptions_launch_at));
    setForbidden(false);
    setConflict(false);
    setConfirmation(null);
    confirmationGeneration.current += 1;
  }, []);
  const handleFailure = useCallback((err: unknown) => {
    setSaved(false);
    if (err instanceof HttpError && (err.status === 403 || err.status === 401)) {
      setSnapshot(null);
      setFlags({ subscriptions_purchases_enabled: false, subscriptions_enforcement_enabled: false });
      setAudiences({ ...defaultAudiences });
      setLaunch("");
      setConfirmation(null);
      confirmationGeneration.current += 1;
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
  useFocusEffect(useCallback(() => { if (!dirtyRef.current) void load(); }, [load]));

  const dirty = !!snapshot && (flags.subscriptions_purchases_enabled !== snapshot.flags.subscriptions_purchases_enabled || flags.subscriptions_enforcement_enabled !== snapshot.flags.subscriptions_enforcement_enabled || launch !== launchValue(snapshot.subscriptions_launch_at) || audiences.subscriptions_purchases_enabled !== (snapshot.audiences?.subscriptions_purchases_enabled ?? "everyone") || audiences.subscriptions_enforcement_enabled !== (snapshot.audiences?.subscriptions_enforcement_enabled ?? "everyone"));
  dirtyRef.current = dirty;
  const editFlags = (key: keyof SubscriptionFlags, value: boolean) => { setFlags((old) => ({ ...old, [key]: value })); setSaved(false); };
  const confirmDiscard = (action: () => void) => {
    if (!mounted.current || !pageAccountGuard() || owner.current !== user?.id || inFlight.current) return;
    if (!dirty) { action(); return; }
    const generation = ++confirmationGeneration.current;
    setConfirmation({ action: () => {
      if (!mounted.current || !pageAccountGuard() || owner.current !== user?.id || inFlight.current || generation !== confirmationGeneration.current) return;
      setConfirmation(null);
      confirmationGeneration.current += 1;
      action();
    } });
  };
  const refresh = () => confirmDiscard(() => { void load(); });
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
        audiences: { ...audiences },
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
  const blocked = busy || !!confirmation;
  const button = (disabled: boolean) => [profileStyles.button, { borderWidth: 1, borderColor: colors.inputBorder, opacity: disabled ? 0.5 : 1 }];

  return <ProfilePage title="Feature flags" onBack={() => router.back()} testID="feature-flags-screen"><ProfileScroll>
    {!user || !token || forbidden ? <Text testID="feature-flags-forbidden" accessibilityRole="alert">Administrator access is required to view or change feature flags.</Text> : <>
      <Text style={muted}>The global switches are master controls: turning a flag off disables it for everyone, including users with Allow overrides.</Text>
      <Text style={muted}>Subscription rollout controls. Billing purchases and training enforcement are not connected until Part 11 is implemented.</Text>
      {busy ? <Text accessibilityLiveRegion="polite">Updating feature flags…</Text> : null}
      {confirmation ? <View testID="feature-flags-discard-confirmation" style={styles.section}><Text accessibilityRole="alert">Discard unsaved changes? Continuing replaces the current edits.</Text><Pressable testID="feature-flags-keep-editing" accessibilityRole="button" onPress={() => { setConfirmation(null); confirmationGeneration.current += 1; }} style={button(false)}><Text>Keep editing</Text></Pressable><Pressable testID="feature-flags-confirm-discard" accessibilityRole="button" onPress={confirmation.action} style={button(false)}><Text>Discard and continue</Text></Pressable></View> : null}
      {snapshot ? <>
        <View style={styles.section}><Text testID="feature-flags-environment" style={styles.heading}>Environment: {snapshot.environment}</Text><Text>Version {snapshot.version}</Text><Text style={muted}>Last updated: {snapshot.updated_at ?? "Never"}</Text></View>
        <Pressable testID="feature-flags-manage-users" accessibilityRole="button" accessibilityLabel="Manage user access" disabled={blocked} onPress={() => confirmDiscard(() => { applySnapshot(snapshot); dirtyRef.current = false; router.push("/settings/admin-feature-flag-users" as Href); })} style={button(blocked)}><Text style={{ color: colors.primaryButton, fontWeight: "600" }}>Manage user access</Text></Pressable>
        <View style={styles.section}>{([
          ["subscriptions_purchases_enabled", "Subscription purchases", "Allows subscription offers and purchases when billing is connected."],
          ["subscriptions_enforcement_enabled", "Subscription enforcement", "Requires entitlement for new training when Part 11 is connected."],
        ] as const).map(([key, title, description]) => <View key={key} style={{ gap: 12 }}><View style={[styles.control, { flexDirection: fontScale >= 1.5 ? "column" : "row", alignItems: fontScale >= 1.5 ? "flex-start" : "center" }]}>
          <View style={{ flexShrink: 1, flexGrow: 1, gap: 6 }}><Text style={styles.heading}>{title}</Text><Text style={muted}>{description}</Text></View>
          <Switch testID={`feature-flag-${key}`} accessibilityLabel={title} accessibilityState={{ disabled: blocked, busy }} disabled={blocked} value={flags[key]} onValueChange={(value) => editFlags(key, value)} trackColor={{ false: colors.inputBorder, true: colors.inputBorder }} thumbColor={flags[key] ? colors.primaryButton : colors.icon} ios_backgroundColor={colors.inputBorder} />
        </View><View accessibilityRole="radiogroup" accessibilityLabel={`${title} audience`} style={{ flexDirection: fontScale >= 1.5 ? "column" : "row", gap: 10 }}>{([['everyone', 'Everyone'], ['selected', 'Selected users']] as const).map(([value, name]) => <Pressable key={value} testID={`feature-flags-audience-${key}-${value}`} accessibilityRole="radio" accessibilityLabel={`${title}: ${name}`} accessibilityState={{ checked: audiences[key] === value, disabled: blocked }} disabled={blocked} onPress={() => { setAudiences((old) => ({ ...old, [key]: value })); setSaved(false); }} style={[button(blocked), { backgroundColor: audiences[key] === value ? colors.inputBorder : 'transparent', flexShrink: 1 }]}><Text>{name}</Text></Pressable>)}</View><Text style={muted}>Everyone uses the enabled default. Selected users stay off unless individually allowed. A Deny override stays off.</Text></View>)}</View>
        <View style={styles.section}>
          <Text style={styles.heading}>Launch date (UTC)</Text>
          <Text style={muted}>Enforcement requires purchases to be enabled and a launch date at or before the current time. Existing accounts receive access until 30 days after this date.</Text>
          <TextInput testID="feature-flags-launch" accessibilityLabel="Subscription launch date in UTC" accessibilityHint="ISO 8601 timestamp ending in Z. Leave blank for no launch date." value={launch} onChangeText={(value) => { setLaunch(value); setSaved(false); }} editable={!blocked && !snapshot.launch_locked} accessibilityState={{ disabled: blocked || snapshot.launch_locked }} autoCapitalize="none" autoCorrect={false} placeholder="YYYY-MM-DDTHH:mm:ssZ" placeholderTextColor={colors.icon} style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]} />
          {snapshot.launch_locked ? <Text testID="feature-flags-launch-locked" style={muted}>The launch date is locked because enforcement has been enabled. Turning enforcement off does not unlock it.</Text> : null}
          <Text testID="feature-flags-transition">Transition ends (UTC): {transition ?? "Not scheduled"}</Text>
        </View>
        {dirty ? <Text testID="feature-flags-unsaved">Unsaved changes</Text> : null}
        <Pressable testID="feature-flags-save" accessibilityRole="button" accessibilityLabel="Save feature flags" accessibilityState={{ disabled: blocked || !dirty || conflict, busy }} disabled={blocked || !dirty || conflict} onPress={() => void save()} style={button(blocked || !dirty || conflict)}><Text style={{ color: colors.primaryButton, fontWeight: "700" }}>Save changes</Text></Pressable>
      </> : null}
      {error ? <Text testID="feature-flags-error" accessibilityRole="alert" style={{ color: scheme === "dark" ? "#F18C86" : "#B42318" }}>{error}</Text> : null}
      {saved ? <Text testID="feature-flags-saved" accessibilityLiveRegion="polite">Changes saved.</Text> : null}
      <Pressable testID="feature-flags-refresh" accessibilityRole="button" accessibilityLabel="Refresh feature flags" accessibilityState={{ disabled: blocked, busy }} disabled={blocked} onPress={refresh} style={button(blocked)}><Text style={{ color: colors.primaryButton, fontWeight: "600" }}>Refresh</Text></Pressable>
      {snapshot ? <View style={styles.section}><Text style={styles.heading}>Recent changes</Text>{snapshot.history.length ? snapshot.history.map((entry) => <View key={entry.version} testID={`feature-flags-audit-${entry.version}`} style={{ gap: 6 }}><Text style={{ fontWeight: "600" }}>Version {entry.version} · {entry.changed_at}</Text><Text style={muted}>Scope: {(entry.scope ?? "global") === "user" ? `User · ${entry.target_user_id ?? "Removed account"}` : "Global"}</Text><Text style={muted}>Changed by: {entry.changed_by ?? "Unknown administrator"}</Text><Text>{auditChanges(entry)}</Text></View>) : <Text style={muted}>No changes yet.</Text>}</View> : null}
    </>}
  </ProfileScroll></ProfilePage>;
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  heading: { fontSize: 17, fontWeight: "600" },
  control: { gap: 14, minHeight: 60 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, padding: 14, fontSize: 16 },
});
