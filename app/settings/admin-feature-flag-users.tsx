import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { ProfilePage, ProfileScroll, profileStyles } from "@/components/profile-ui";
import { WorkoutText as Text } from "@/components/workout/WorkoutText";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { accountGeneration, accountRequestGuard } from "@/services/accountScope";
import { getAdminFeatureFlags, getUserFeatureFlags, listUserFeatureFlags, lookupFeatureFlagUser, updateUserFeatureFlags, type AdminFeatureFlagSnapshot, type UserFlagList, type UserFlagOverrides, type UserFlagSnapshot } from "@/services/featureFlagService";
import { HttpError } from "@/services/httpClient";
import { AuthContext } from "@/utils/authContext";

const emptyOverrides = (): UserFlagOverrides => ({ subscriptions_purchases_enabled: null, subscriptions_enforcement_enabled: null });
const keys = ["subscriptions_purchases_enabled", "subscriptions_enforcement_enabled"] as const;
const names = { subscriptions_purchases_enabled: "Subscription purchases", subscriptions_enforcement_enabled: "Subscription enforcement" };
function resolveDraft(snapshot: UserFlagSnapshot, overrides: UserFlagOverrides) {
  const purchases = snapshot.global_flags.subscriptions_purchases_enabled && (overrides.subscriptions_purchases_enabled ?? snapshot.audiences.subscriptions_purchases_enabled === "everyone");
  const enforcement = purchases && snapshot.global_flags.subscriptions_enforcement_enabled && (overrides.subscriptions_enforcement_enabled ?? snapshot.audiences.subscriptions_enforcement_enabled === "everyone");
  return { subscriptions_purchases_enabled: purchases, subscriptions_enforcement_enabled: enforcement };
}

export default function FeatureFlagUsersScreen() {
  const { user } = useContext(AuthContext);
  return <AccountUsers key={`${user?.id ?? "guest"}:${accountGeneration()}`} />;
}

function AccountUsers() {
  const { user, token } = useContext(AuthContext);
  const router = useRouter();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { fontScale } = useWindowDimensions();
  const [config, setConfig] = useState<AdminFeatureFlagSnapshot | null>(null);
  const [list, setList] = useState<UserFlagList | null>(null);
  const [snapshot, setSnapshot] = useState<UserFlagSnapshot | null>(null);
  const [overrides, setOverrides] = useState<UserFlagOverrides>(emptyOverrides);
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmation, setConfirmation] = useState<{ action: () => void } | null>(null);
  const mounted = useRef(true);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const pageGuard = useRef(accountRequestGuard()).current;
  const inFlight = useRef(false);
  const requestGeneration = useRef(0);
  const selectionGeneration = useRef(0);
  const confirmationGeneration = useRef(0);
  const configRef = useRef(config);
  const targetRef = useRef(snapshot);
  const offsetRef = useRef(0);
  const dirty = !!snapshot && keys.some((key) => overrides[key] !== snapshot.overrides[key]);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const renderedSelection = selectionGeneration.current;
  const accountCurrent = useCallback(() => mounted.current && pageGuard() && owner.current === user?.id && !!user?.id && !!token, [pageGuard, token, user?.id]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requestGeneration.current += 1; }; }, []);

  const clearTarget = useCallback(() => {
    targetRef.current = null;
    setSnapshot(null);
    setOverrides(emptyOverrides());
    setConflict(false);
    setSaved(false);
    dirtyRef.current = false;
    confirmationGeneration.current += 1;
  }, []);
  const applyTarget = useCallback((next: UserFlagSnapshot) => {
    targetRef.current = next;
    setSnapshot(next);
    setOverrides({ ...next.overrides });
    setConflict(false);
    confirmationGeneration.current += 1;
    dirtyRef.current = false;
  }, []);
  const handleFailure = useCallback((err: unknown) => {
    setSaved(false);
    if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
      clearTarget();
      configRef.current = null;
      setConfig(null);
      setList(null);
      setIdentifier("");
      setConfirmation(null);
      setForbidden(true);
      setError(null);
      setListError(null);
    } else if (err instanceof HttpError && err.status === 404) {
      clearTarget();
      setError(err.message);
    } else {
      if (err instanceof HttpError && err.status === 409) {
        setConflict(true);
        setError("Feature flags changed elsewhere. Your edits are preserved. Refresh to review the latest version before saving.");
      } else setError(err instanceof Error ? err.message : "User access couldn’t be updated. Try again.");
    }
  }, [clearTarget]);
  const request = useCallback(async (action: (current: () => boolean) => Promise<void>) => {
    if (!accountCurrent() || inFlight.current) return;
    const requestId = ++requestGeneration.current;
    const selectionId = selectionGeneration.current;
    const current = () => accountCurrent() && requestGeneration.current === requestId && selectionGeneration.current === selectionId;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setSaved(false);
    try { await action(current); }
    catch (err) { if (current()) handleFailure(err); }
    finally { if (current()) { inFlight.current = false; setBusy(false); } }
  }, [accountCurrent, handleFailure]);
  const fetchList = useCallback(async (current: () => boolean, offset: number) => {
    if (!current() || !token) return;
    let next = await listUserFeatureFlags(token, offset);
    if (!current()) return;
    if (next.offset >= next.total && next.offset > 0) {
      next = await listUserFeatureFlags(token, Math.max(0, Math.floor((next.total - 1) / 20) * 20));
      if (!current()) return;
    }
    offsetRef.current = next.offset;
    setList(next);
    setListError(null);
  }, [token]);
  const loadDashboard = useCallback(() => request(async (current) => {
    if (!current() || !token) return;
    const nextConfig = await getAdminFeatureFlags(token);
    if (!current()) return;
    if (!nextConfig.can_manage_flags) throw new HttpError("Administrator access required.", 403);
    configRef.current = nextConfig;
    setConfig(nextConfig);
    setForbidden(false);
    await fetchList(current, offsetRef.current);
    if (!current()) return;
    if (targetRef.current) {
      const target = await getUserFeatureFlags(token, targetRef.current.user.id);
      if (current()) applyTarget(target);
    }
  }), [applyTarget, fetchList, request, token]);
  useFocusEffect(useCallback(() => { if (!dirtyRef.current) void loadDashboard(); }, [loadDashboard]));

  const confirmDiscard = (action: () => void) => {
    if (!accountCurrent() || inFlight.current || renderedSelection !== selectionGeneration.current) return;
    if (!dirtyRef.current) { action(); return; }
    const generation = selectionGeneration.current;
    const confirmationId = ++confirmationGeneration.current;
    setConfirmation({ action: () => {
      if (!accountCurrent() || inFlight.current || generation !== selectionGeneration.current || confirmationId !== confirmationGeneration.current) return;
      setConfirmation(null);
      confirmationGeneration.current += 1;
      action();
    } });
  };
  const selectTarget = (target: { identifier: string } | { userId: string }) => {
    if (!accountCurrent() || !configRef.current?.can_manage_flags || inFlight.current || renderedSelection !== selectionGeneration.current) return;
    selectionGeneration.current += 1;
    clearTarget();
    setConfirmation(null);
    void request(async (current) => {
      if (!current() || !token) return;
      const next = "identifier" in target ? await lookupFeatureFlagUser(token, target.identifier) : await getUserFeatureFlags(token, target.userId);
      if (current()) { applyTarget(next); setIdentifier(next.user.email); }
    });
  };
  const search = () => {
    const value = identifier.trim();
    if (!value) { setError("Enter an exact email address or account UUID."); return; }
    confirmDiscard(() => selectTarget({ identifier: value }));
  };
  const save = () => {
    if (!accountCurrent() || !configRef.current?.can_manage_flags || !snapshot || targetRef.current?.user.id !== snapshot.user.id || renderedSelection !== selectionGeneration.current || !dirty || conflict || inFlight.current) return;
    const target = snapshot;
    const nextOverrides = { ...overrides };
    void request(async (current) => {
      if (!current() || !token) return;
      const next = await updateUserFeatureFlags(token, target.user.id, { expected_version: target.version, overrides: nextOverrides });
      if (!current()) return;
      applyTarget(next);
      setSaved(true);
      try { await fetchList(current, offsetRef.current); }
      catch (err) {
        if (!current()) return;
        if (err instanceof HttpError && (err.status === 401 || err.status === 403)) throw err;
        setListError("Changes saved, but the configured users list couldn’t refresh. Refresh to try again.");
      }
    });
  };
  const refresh = () => confirmDiscard(() => { void loadDashboard(); });
  const edit = (key: keyof UserFlagOverrides, value: boolean | null) => {
    if (!accountCurrent() || inFlight.current || renderedSelection !== selectionGeneration.current) return;
    setOverrides((old) => ({ ...old, [key]: value }));
    setSaved(false);
  };
  const effective = snapshot ? dirty ? resolveDraft(snapshot, overrides) : snapshot.effective_flags : null;
  const button = (disabled: boolean) => [profileStyles.button, { borderWidth: 1, borderColor: colors.inputBorder, opacity: disabled ? 0.5 : 1 }];
  const muted = { color: colors.icon };
  const blocked = busy || !!confirmation;

  return <ProfilePage title="User flag access" onBack={() => router.back()} testID="feature-flag-users-screen"><ProfileScroll>
    {!user || !token || forbidden ? <Text testID="flag-users-forbidden" accessibilityRole="alert">Administrator access is required to view or change user access.</Text> : <>
      <Text style={muted}>Choose individual users for a gradual rollout. Global switches always win: Allow cannot turn on a globally disabled flag. These controls do not grant a subscription or entitlement.</Text>
      {config ? <><Text testID="flag-users-environment" style={styles.heading}>Environment: {config.environment}</Text>
        <Text style={muted}>Search by exact email address or account UUID. Only accounts with configured overrides are listed below.</Text>
        <TextInput testID="flag-users-identifier" accessibilityLabel="Exact email or account UUID" value={identifier} editable={!blocked} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Email or account UUID" placeholderTextColor={colors.icon} style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]} />
        <Pressable testID="flag-users-lookup" accessibilityRole="button" accessibilityLabel="Find user" disabled={blocked} accessibilityState={{ disabled: blocked, busy }} onPress={search} style={button(blocked)}><Text style={styles.link}>Find user</Text></Pressable>
      </> : null}
      {busy ? <Text accessibilityLiveRegion="polite">Updating user access…</Text> : null}
      {confirmation ? <View testID="flag-users-discard-confirmation" style={[styles.section, { borderColor: colors.inputBorder }]}><Text accessibilityRole="alert">Discard unsaved changes? Continuing replaces the current user’s edits.</Text><Pressable testID="flag-users-keep-editing" accessibilityRole="button" onPress={() => { setConfirmation(null); confirmationGeneration.current += 1; }} style={button(false)}><Text>Keep editing</Text></Pressable><Pressable testID="flag-users-confirm-discard" accessibilityRole="button" onPress={confirmation.action} style={button(false)}><Text>Discard and continue</Text></Pressable></View> : null}
      {snapshot && effective ? <View style={styles.section}>
        <View testID="flag-users-selected" style={{ gap: 6 }}><Text style={styles.heading}>{snapshot.user.preferred_name || "Selected account"}</Text><Text selectable>{snapshot.user.email}</Text><Text selectable>Account UUID: {snapshot.user.id}</Text><Text>Version {snapshot.version}</Text></View>
        <Text style={muted}>Use default follows the flag’s audience: Everyone is on; Selected users is off. Allow opts this user in; Deny opts them out. Changes apply only after Save.</Text>
        {keys.map((key) => <View key={key} style={{ gap: 12 }}><Text style={styles.heading}>{names[key]}</Text><View accessibilityRole="radiogroup" accessibilityLabel={`${names[key]} override`} style={{ flexDirection: fontScale >= 1.5 ? "column" : "row", flexWrap: "wrap", gap: 10 }}>{([[null, "Use default", "default"], [true, "Allow", "allow"], [false, "Deny", "deny"]] as const).map(([value, title, id]) => <Pressable key={id} testID={`flag-users-${key}-${id}`} accessibilityRole="radio" accessibilityLabel={`${names[key]}: ${title}`} accessibilityState={{ checked: overrides[key] === value, disabled: blocked }} disabled={blocked} onPress={() => edit(key, value)} style={[button(blocked), { backgroundColor: overrides[key] === value ? colors.inputBorder : "transparent", flexShrink: 1 }]}><Text>{title}</Text></Pressable>)}</View>
          <Text testID={`flag-users-effective-${key}`}>{dirty ? "Preview after save" : "Effective now"}: {effective[key] ? "On" : "Off"}</Text>
          <Text style={muted}>Global master: {snapshot.global_flags[key] ? "On" : "Off"}. Audience: {snapshot.audiences[key] === "everyone" ? "Everyone" : "Selected users"}.</Text>
          {!snapshot.global_flags[key] ? <Text testID={`flag-users-global-disabled-${key}`} style={muted}>Globally disabled. Allow will take effect only when the global master is on.</Text> : null}
          {key === "subscriptions_enforcement_enabled" && !effective.subscriptions_purchases_enabled ? <Text testID="flag-users-purchases-prerequisite" style={muted}>Enforcement stays off while purchases are off for this user.</Text> : null}
        </View>)}
        <Text style={muted}>Global launch (UTC): {snapshot.subscriptions_launch_at ?? "Not scheduled"}. Transition ends (UTC): {snapshot.transition_ends_at ?? "Not scheduled"}. User overrides do not change this shared clock.</Text>
        {dirty ? <Text testID="flag-users-unsaved">Unsaved changes</Text> : null}
        <Pressable testID="flag-users-save" accessibilityRole="button" accessibilityLabel="Save user flag overrides" disabled={blocked || !dirty || conflict} accessibilityState={{ disabled: blocked || !dirty || conflict, busy }} onPress={save} style={button(blocked || !dirty || conflict)}><Text style={{ color: colors.primaryButton, fontWeight: "700" }}>Save user access</Text></Pressable>
        <Pressable testID="flag-users-reset" accessibilityRole="button" accessibilityLabel="Reset user overrides to default" disabled={blocked} accessibilityState={{ disabled: blocked }} onPress={() => { if (!accountCurrent() || inFlight.current || renderedSelection !== selectionGeneration.current) return; setOverrides(emptyOverrides()); setSaved(false); }} style={button(blocked)}><Text>Reset to default</Text></Pressable>
      </View> : null}
      {error ? <Text testID="flag-users-error" accessibilityRole="alert" style={{ color: scheme === "dark" ? "#F18C86" : "#B42318" }}>{error}</Text> : null}
      {saved ? <Text testID="flag-users-saved" accessibilityLiveRegion="polite">User access saved.</Text> : null}
      <Pressable testID="flag-users-refresh" accessibilityRole="button" accessibilityLabel="Refresh user flag access" disabled={blocked} accessibilityState={{ disabled: blocked, busy }} onPress={refresh} style={button(blocked)}><Text>Refresh</Text></Pressable>
      {list && config ? <View style={styles.section}><Text style={styles.heading}>Configured users</Text><Text testID="flag-users-list-count" style={muted}>{list.total ? `${list.offset + 1}–${Math.min(list.offset + list.limit, list.total)} of ${list.total}` : "No user overrides configured."}</Text>
        {list.items.map((item) => <Pressable key={item.user.id} testID={`flag-users-select-${item.user.id}`} accessibilityRole="button" accessibilityLabel={`Edit access for ${item.user.email}`} disabled={blocked} accessibilityState={{ disabled: blocked }} onPress={() => confirmDiscard(() => selectTarget({ userId: item.user.id }))} style={[button(blocked), { alignItems: "flex-start", gap: 6 }]}><Text style={{ fontWeight: "600" }}>{item.user.preferred_name || item.user.email}</Text><Text>{item.user.email}</Text><Text style={muted}>Purchases: {item.effective_flags.subscriptions_purchases_enabled ? "On" : "Off"} · Enforcement: {item.effective_flags.subscriptions_enforcement_enabled ? "On" : "Off"}</Text><Text style={{ color: colors.primaryButton }}>Edit access</Text></Pressable>)}
        <View style={{ gap: 10, flexDirection: fontScale >= 1.5 ? "column" : "row" }}>{([["Previous", list.offset - 20, list.offset === 0], ["Next", list.offset + 20, list.offset + list.limit >= list.total]] as const).map(([title, offset, boundary]) => <Pressable key={title} testID={`flag-users-page-${title.toLowerCase()}`} accessibilityRole="button" accessibilityLabel={`${title} configured users`} disabled={blocked || boundary} accessibilityState={{ disabled: blocked || boundary }} onPress={() => { if (!accountCurrent() || renderedSelection !== selectionGeneration.current || !configRef.current?.can_manage_flags) return; void request((current) => fetchList(current, offset)); }} style={button(blocked || boundary)}><Text>{title}</Text></Pressable>)}</View>
      </View> : null}
      {listError ? <Text testID="flag-users-list-error" accessibilityRole="alert">{listError}</Text> : null}
      <Text style={muted}>Billing purchases and training enforcement are not connected until Part 11 is implemented.</Text>
    </>}
  </ProfileScroll></ProfilePage>;
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  heading: { fontSize: 17, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, padding: 14, fontSize: 16 },
  link: { fontWeight: "600" },
});
