import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ScreenState } from '@/components/screen-state';
import { HEALTH_BRIDGE_TEST_ENABLED } from '@/config/healthBridgeTest';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/constants/legal';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { appleHealthAdapter } from '@/services/health/appleHealthAdapter';
import { syncAppleHealthRead } from '@/services/health/readSync';
import { confirmHealthExportOptIn, disableHealthExport, getHealthExportStop, pauseHealthExport, prepareHealthExport, reconcileAppleHealthExport, requestHealthExportStop, resumeHealthExport, waitForHealthExportIdle } from '@/services/health/exportSync';
import { setHealthExportSyncStatus, subscribeHealthExportSyncStatus, type HealthExportSyncStatus } from '@/services/health/exportStatus';
import { HttpError } from '@/services/httpClient';
import { disconnectHealthSource, getHealthState, setAppleHealthSource, setHealthPreferences } from '@/services/healthService';
import type { HealthState, HealthSourceName } from '@/services/health/types';
import { AuthContext } from '@/utils/authContext';
import { acceptCurrentLegal } from '@/services/userService';

const SOURCE_NAMES: Record<HealthSourceName, string> = {
  apple_health: 'Apple Health',
  health_connect: 'Health Connect',
};

export default function HealthSettingsScreen() {
  const router = useRouter();
  const { user, token, refreshUser } = useContext(AuthContext);
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const accountKey = `${user?.id ?? 'guest'}:${token ?? 'anonymous'}`;
  const accountKeyRef = useRef(accountKey);
  accountKeyRef.current = accountKey;
  const requestRef = useRef(0);
  const actionRef = useRef(0);
  const actionInFlightRef = useRef(false);
  const actionOwnerRef = useRef<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [ownerKey, setOwnerKey] = useState<string | null>(null);
  const [state, setState] = useState<HealthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [availability, setAvailability] = useState<'checking' | 'available' | 'unsupported'>('checking');
  const [workoutWriteAccess, setWorkoutWriteAccess] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [exportStatus, setExportStatus] = useState<{ userId: string; status: HealthExportSyncStatus } | null>(null);
  const [exportRetryOwner, setExportRetryOwner] = useState<string | null>(null);
  const [policyChecked, setPolicyChecked] = useState(false);
  const [policyBusy, setPolicyBusy] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    return subscribeHealthExportSyncStatus(userId, (status) => setExportStatus({ userId, status }));
  }, [user?.id]);

  useEffect(() => {
    if (actionInFlightRef.current && actionOwnerRef.current === accountKey) return;
    const requestId = ++requestRef.current;
    const requestAccount = accountKey;
    setOwnerKey(requestAccount);
    setState(null);
    setError(null);
    setLoading(true);
    if (!token || !user?.id) {
      setLoading(false);
      return;
    }
    void getHealthState(token)
      .then((response) => {
        if (requestRef.current !== requestId || accountKeyRef.current !== requestAccount) return;
        setState(response);
      })
      .catch(() => {
        if (requestRef.current !== requestId || accountKeyRef.current !== requestAccount) return;
        setError('Connection status could not load. Check your connection and retry.');
      })
      .finally(() => {
        if (requestRef.current !== requestId || accountKeyRef.current !== requestAccount) return;
        setLoading(false);
      });
    return () => {
      requestRef.current += 1;
    };
  }, [accountKey, revision, token, user?.id]);

  useEffect(() => {
    actionRef.current += 1;
    actionInFlightRef.current = false;
    actionOwnerRef.current = null;
    setBusy(null);
    setActionError(null);
    setNotice(null);
    setPolicyChecked(false);
    setPolicyBusy(false);
  }, [accountKey]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !state?.collectionAvailable || ownerKey !== accountKey) return;
    let current = true;
    void appleHealthAdapter.availability().then((value) => {
      if (current) setAvailability(value === 'available' ? 'available' : 'unsupported');
      if (value === 'available') void appleHealthAdapter.getPermissions().then((permissions) => {
        if (current) setWorkoutWriteAccess(permissions.writeWorkout);
      }).catch(() => { if (current) setWorkoutWriteAccess('unknown'); });
    }).catch(() => {
      if (current) setAvailability('unsupported');
    });
    return () => { current = false; };
  }, [accountKey, ownerKey, state?.collectionAvailable, revision]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !actionInFlightRef.current) setRevision((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);

  const visibleState = ownerKey === accountKey ? state : null;
  const visibleError = ownerKey === accountKey ? error : null;
  const isLoading = ownerKey !== accountKey || loading;
  const source = Platform.OS === 'ios' ? 'apple_health' : Platform.OS === 'android' ? 'health_connect' : null;
  const sourceName = source ? SOURCE_NAMES[source] : 'Apple Health and Health Connect';
  const connected = source ? visibleState?.sources.find((item) => item.source === source) : visibleState?.sources[0];
  const expectedRevision = connected?.connectionRevision ?? visibleState?.sourceRevisions?.apple_health ?? 0;
  const privacyRequired = Platform.OS === 'ios' && Boolean(user && user.privacy_accepted_version !== PRIVACY_VERSION);

  const canConnect = Platform.OS === 'ios' && !privacyRequired && visibleState?.collectionAvailable === true && availability === 'available';
  const readEnabled = Boolean(connected?.readEnabled);
  const exportEnabled = Boolean(connected?.exportEnabled);
  const primarySelected = visibleState?.primarySource === 'apple_health';
  const visibleExportStatus = exportStatus && exportStatus.userId === user?.id ? exportStatus.status : null;
  const exportRetrying = exportRetryOwner === accountKey;
  const exportStopPending = visibleExportStatus === 'export-off-pending' || visibleExportStatus === 'disconnect-pending';

  const acceptPolicy = async () => {
    if (!policyChecked || policyBusy || !token || !user?.id) return;
    const owner = accountKey;
    setPolicyBusy(true);
    setActionError(null);
    try {
      await acceptCurrentLegal(token, TERMS_VERSION, PRIVACY_VERSION);
      if (accountKeyRef.current !== owner) return;
      await refreshUser();
      if (accountKeyRef.current !== owner) return;
      setPolicyChecked(false);
      setRevision((value) => value + 1);
      setNotice('Updated Privacy Policy accepted. Health choices remain subject to availability and release approval.');
    } catch {
      if (accountKeyRef.current === owner) setActionError('Your acceptance could not be saved. Check your connection and try again.');
    } finally {
      if (accountKeyRef.current === owner) setPolicyBusy(false);
    }
  };

  const retryExport = () => {
    if (!token || !user?.id || exportRetrying) return;
    const owner = accountKey;
    setExportRetryOwner(owner);
    void reconcileAppleHealthExport(token, user.id, () => accountKeyRef.current === owner)
      .catch(() => undefined)
      .finally(() => setExportRetryOwner((current) => current === owner ? null : current));
  };

  const runAction = async (name: string, action: (isCurrent: () => boolean) => Promise<string | null>) => {
    const canDisconnect = name === 'disconnect' && connected?.source === 'apple_health';
    const canWithdraw = connected?.source === 'apple_health' && ((name === 'read-off' && readEnabled) || (name === 'export-off' && exportEnabled));
    if ((!canConnect && !canDisconnect && !canWithdraw) || !token || !user?.id || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    actionOwnerRef.current = accountKey;
    requestRef.current += 1;
    const actionId = ++actionRef.current;
    const owner = accountKey;
    const isCurrent = () => actionRef.current === actionId && accountKeyRef.current === owner;
    setBusy(name);
    setActionError(null);
    setNotice(null);
    try {
      const message = await action(isCurrent);
      if (!isCurrent()) return;
      const refreshed = await getHealthState(token);
      if (!isCurrent()) return;
      setState(refreshed);
      if (name === 'export-off' || name === 'disconnect') {
        resumeHealthExport(user.id);
        void reconcileAppleHealthExport(token, user.id, isCurrent).catch(() => undefined);
      }
      setNotice(message);
    } catch (caught) {
      if (!isCurrent()) return;
      let durableStop: Awaited<ReturnType<typeof getHealthExportStop>> = null;
      if (name === 'export-off' || name === 'disconnect') {
        try { durableStop = await getHealthExportStop(user.id); } catch {}
        if (!isCurrent()) return;
        if (durableStop) {
          setHealthExportSyncStatus(user.id, caught instanceof HttpError && caught.status === 409
            ? 'connection-changed'
            : durableStop.reason === 'disconnect' ? 'disconnect-pending' : 'export-off-pending');
        }
      }
      let refreshed: HealthState | null = null;
      try {
        refreshed = await getHealthState(token);
        if (!isCurrent()) return;
        setState(refreshed);
        setError(null);
      } catch {
        if (!isCurrent()) return;
        setState(null);
        setError('Connection status could not load. Check your connection and retry.');
      }
      if (!isCurrent()) return;
      const wasConnected = refreshed?.sources.some((item) => item.source === 'apple_health' && item.readEnabled);
      if (durableStop && refreshed) {
        resumeHealthExport(user.id);
        void reconcileAppleHealthExport(token, user.id, isCurrent).catch(() => undefined);
      }
      setActionError(durableStop && !(caught instanceof HttpError && caught.status === 409) ? null :
        name === 'connect' && wasConnected
          ? 'Apple Health is connected, but its first sync failed. Tap Sync now to retry.'
          : caught instanceof HttpError && caught.status === 409
            ? 'This connection changed while syncing. Refresh its status and try again.'
            : refreshed === null
              ? 'The action may have completed, but its status could not be confirmed. Retry loading connection status.'
            : caught instanceof Error ? caught.message : 'Health action failed. Please retry.',
      );
    } finally {
      if ((name === 'export-off' || name === 'disconnect') && user?.id) resumeHealthExport(user.id);
      if (isCurrent()) {
        actionInFlightRef.current = false;
        actionOwnerRef.current = null;
        setBusy(null);
      }
    }
  };

  const toggleRead = () => void runAction(readEnabled ? 'read-off' : 'connect', async (isCurrent) => {
    if (readEnabled) {
      if (connected?.exportEnabled) await setAppleHealthSource(token!, false, true, expectedRevision);
      else await disconnectHealthSource(token!, expectedRevision || undefined);
      return 'Apple Health daily summaries were removed from PrimeRep. Your Apple Health records remain on your phone.';
    }
    await appleHealthAdapter.requestReadPermission();
    if (!isCurrent()) return null;
    const connection = await setAppleHealthSource(token!, true, connected?.exportEnabled ?? false, expectedRevision);
    if (!isCurrent()) return null;
    if (!visibleState?.primarySource) await setHealthPreferences(token!, 'apple_health', false);
    if (!isCurrent()) return null;
    const hasData = await syncAppleHealthRead(token!, connection, isCurrent);
    if (!isCurrent()) return null;
    return hasData
      ? 'Apple Health is connected and recent daily summaries were synced.'
      : 'Apple Health is connected, but no step or sleep data was returned. Apple does not reveal read-access status; check access in the Health app.';
  });

  const toggleExport = () => void runAction(exportEnabled ? 'export-off' : 'export-on', async (isCurrent) => {
    if (exportEnabled) {
      pauseHealthExport(user!.id);
      await requestHealthExportStop(user!.id, 'export-off', expectedRevision, connected?.exportEnabledAt ?? null);
      await waitForHealthExportIdle();
      if (readEnabled) await setAppleHealthSource(token!, true, false, expectedRevision);
      else await disconnectHealthSource(token!, expectedRevision || undefined);
      return 'New workouts will no longer be saved to Apple Health. Previously exported workouts remain there.';
    }
    const permission = await appleHealthAdapter.requestWritePermission();
    if (!isCurrent()) return null;
    if (permission.writeWorkout !== 'granted') throw new Error('Allow workout write access in iOS settings before enabling export.');
    await prepareHealthExport(user!.id);
    try {
      const connection = await setAppleHealthSource(token!, readEnabled, true, expectedRevision);
      if (!isCurrent()) {
        await disableHealthExport(user!.id);
        return null;
      }
      if (!(await confirmHealthExportOptIn(user!.id, connection))) throw new Error('Workout export consent could not be confirmed. Refresh connection status and try again.');
    } catch (error) {
      await disableHealthExport(user!.id);
      throw error;
    }
    if (!isCurrent()) return null;
    resumeHealthExport(user!.id);
    void reconcileAppleHealthExport(token!, user!.id, isCurrent).catch(() => undefined);
    return 'Newly completed PrimeRep workouts will be saved to Apple Health after they sync to PrimeRep.';
  });

  const disconnect = () => void runAction('disconnect', async () => {
    pauseHealthExport(user!.id);
    await requestHealthExportStop(user!.id, 'disconnect', expectedRevision, connected?.exportEnabledAt ?? null);
    await waitForHealthExportIdle();
    await disconnectHealthSource(token!, connected?.connectionRevision);
    return 'Apple Health was disconnected from PrimeRep. Your Apple Health records remain on your phone.';
  });

  const syncNow = () => void runAction('sync', async (isCurrent) => {
    if (!connected?.readEnabled) return null;
    const hasData = await syncAppleHealthRead(token!, connected, isCurrent);
    if (!isCurrent()) return null;
    return hasData
      ? 'Recent daily summaries synced.'
      : 'Sync completed, but no step or sleep data was returned. Check access in the Health app.';
  });

  const toggleCoach = () => void runAction('coach', async (isCurrent) => {
    await setHealthPreferences(token!, 'apple_health', !visibleState?.coachEnabled);
    return isCurrent() ? (!visibleState?.coachEnabled ? 'Coach can now use daily summaries for rules-based context.' : 'Coach will no longer use your health summaries.') : null;
  });

  const selectPrimary = () => void runAction('primary', async (isCurrent) => {
    await setHealthPreferences(token!, 'apple_health', Boolean(visibleState?.coachEnabled));
    return isCurrent() ? 'Apple Health is your primary source.' : null;
  });

  const openSettings = () => {
    const owner = accountKey;
    void appleHealthAdapter.openAppSettings().catch(() => {
      if (accountKeyRef.current === owner) setActionError('Could not open iOS app settings. You can manage read access in the Health app.');
    });
  };

  const settingRow = (label: string, detail: string, testID: string, value: boolean, enabled: boolean, onChange?: () => void) => (
    <View testID={testID} style={[styles.settingRow, styles.settingToggleRow, { borderColor: colors.inputBorder }]}>
      <View style={styles.settingText}>
        <ThemedText style={styles.settingTitle}>{label}</ThemedText>
        <ThemedText style={[styles.settingDetail, { color: colors.icon }]}>{detail}</ThemedText>
      </View>
      <View style={styles.settingSwitch}>
        <Switch value={value} disabled={!enabled || Boolean(busy)} onValueChange={onChange} accessibilityLabel={label} accessibilityState={{ disabled: !enabled || Boolean(busy) }} trackColor={{ false: colors.inputBorder, true: colors.primaryButton }} thumbColor={value ? colors.primaryButton : colors.placeholder} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { borderColor: colors.inputBorder }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back from Health connections" style={styles.back}>
          <Ionicons name="arrow-back" size={25} color={colors.text} />
        </Pressable>
        <ThemedText accessibilityRole="header" style={styles.headerTitle}>Health connections</ThemedText>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View testID="health-release-status" style={[styles.status, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
          <View style={[styles.statusIcon, { backgroundColor: `${colors.primaryButton}20` }]}>
            <Ionicons name="heart-outline" size={27} color={colors.primaryButton} />
          </View>
          <ThemedText style={styles.statusTitle}>{connected ? 'Apple Health connection saved' : canConnect ? 'Connect Apple Health' : 'Health connections are not available yet'}</ThemedText>
          <ThemedText style={[styles.body, { color: colors.icon }]}>
            {connected
              ? canConnect
                ? 'Your PrimeRep connection is saved. Apple Health read access is managed in iOS and cannot be confirmed here.'
                : 'Your PrimeRep connection is saved, but syncing and new connections are unavailable right now. You can still disconnect it.'
              : canConnect
              ? 'Choose what to share. PrimeRep reads daily steps and sleep only after you opt in; your workout plan never changes automatically.'
              : visibleState?.collectionAvailable && Platform.OS === 'ios' && availability === 'unsupported'
                ? 'Apple Health is unavailable in this build or on this device.'
                : `PrimeRep is preparing ${sourceName} support. No steps, sleep, or workouts are read or written by this screen.`}
          </ThemedText>
        </View>
        {privacyRequired ? (
          <View testID="health-privacy-acceptance" style={[styles.status, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
            <Ionicons name="shield-checkmark-outline" size={25} color={colors.primaryButton} />
            <ThemedText style={styles.sectionTitle}>Review the updated Privacy Policy</ThemedText>
            <ThemedText style={[styles.body, { color: colors.icon }]}>It explains optional Apple Health steps, sleep, and workout export. Accepting the policy does not itself enable Health collection.</ThemedText>
            <Pressable testID="health-privacy-open" accessibilityRole="link" accessibilityLabel="Read updated Privacy Policy" onPress={() => router.push('/legal/privacy')} style={styles.policyAction}>
              <ThemedText style={[styles.settingTitle, { color: colors.primaryButton }]}>Read Privacy Policy</ThemedText>
            </Pressable>
            <Pressable testID="health-privacy-checkbox" accessibilityRole="checkbox" accessibilityState={{ checked: policyChecked }} onPress={() => setPolicyChecked((value) => !value)} style={styles.policyCheck}>
              <Ionicons name={policyChecked ? 'checkbox' : 'square-outline'} size={24} color={colors.primaryButton} />
              <ThemedText style={[styles.body, styles.policyCheckText]}>I have read and accept the updated Privacy Policy.</ThemedText>
            </Pressable>
            <Pressable testID="health-privacy-accept" accessibilityRole="button" accessibilityState={{ disabled: !policyChecked || policyBusy }} disabled={!policyChecked || policyBusy} onPress={() => void acceptPolicy()} style={[styles.policyAccept, { backgroundColor: colors.primaryButton, opacity: !policyChecked || policyBusy ? 0.5 : 1 }]}>
              <ThemedText style={styles.policyAcceptText}>{policyBusy ? 'Saving…' : 'Accept updated policy'}</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {isLoading ? (
          <ScreenState colors={colors} kind="loading" title="Checking connection status…" testID="health-state-loading" />
        ) : visibleError ? (
          <ScreenState colors={colors} kind="error" title="Status unavailable" message={visibleError} actionLabel="Retry" onAction={() => setRevision((value) => value + 1)} testID="health-state-error" />
        ) : visibleState ? (
          <View testID="health-server-status" style={styles.connectionStatus}>
            <ThemedText style={styles.sectionTitle}>PrimeRep connection status</ThemedText>
            <ThemedText style={[styles.body, { color: colors.icon }]}>
              {connected
                ? `${SOURCE_NAMES[connected.source]} is listed in your PrimeRep account. This does not confirm access in your phone's Health settings.`
                : source ? `No ${sourceName} connection is saved in your PrimeRep account.` : 'No health connection is saved in your PrimeRep account.'}
            </ThemedText>
            {connected?.lastSuccessfulSyncAt ? <ThemedText style={[styles.caption, { color: colors.icon }]}>Last PrimeRep sync: {new Date(connected.lastSuccessfulSyncAt).toLocaleString()}</ThemedText> : null}
            {connected?.readEnabled ? <ThemedText style={[styles.caption, { color: colors.icon }]}>Apple does not reveal read permission status. Missing data can mean no records or access was not granted.</ThemedText> : null}
          </View>
        ) : null}

        {actionError ? <ThemedText testID="health-action-error" accessibilityLiveRegion="polite" style={[styles.body, { color: '#D93632' }]}>{actionError}</ThemedText> : null}
        {visibleExportStatus === 'retry' || exportStopPending ? (
          <View testID="health-export-sync-error" style={styles.exportIssue}>
            <ThemedText accessibilityLiveRegion="polite" style={[styles.body, { color: '#D93632' }]}>{visibleExportStatus === 'export-off-pending' ? 'The PrimeRep server has not confirmed that Apple Health workout export stopped. This device will not export more workouts. Retry when online.' : visibleExportStatus === 'disconnect-pending' ? 'The PrimeRep server has not confirmed that Apple Health was disconnected. This device will not export more workouts. Retry when online.' : 'Apple Health sync could not finish. Your workout remains saved in PrimeRep. Retry when your connection or Health access is available.'}</ThemedText>
            <Pressable testID="health-export-retry" onPress={retryExport} disabled={exportRetrying} accessibilityRole="button" accessibilityLabel={visibleExportStatus === 'export-off-pending' ? 'Retry stopping Apple Health export' : visibleExportStatus === 'disconnect-pending' ? 'Retry disconnecting Apple Health' : 'Retry Apple Health sync'} accessibilityState={{ disabled: exportRetrying }} style={[styles.disabledAction, { borderColor: colors.inputBorder }]}>
              <ThemedText style={{ color: colors.primaryButton }}>{exportRetrying ? 'Retrying…' : visibleExportStatus === 'export-off-pending' ? 'Retry stopping export' : visibleExportStatus === 'disconnect-pending' ? 'Retry disconnect' : 'Retry Apple Health sync'}</ThemedText>
            </Pressable>
          </View>
        ) : null}
        {visibleExportStatus === 'connection-changed' ? <ThemedText testID="health-export-connection-changed" accessibilityLiveRegion="polite" style={[styles.body, { color: '#D93632' }]}>This Apple Health connection changed on another device. Workout export is paused here. Review your Save PrimeRep workouts choice above; turn it off before opting in again if you want this device to export.</ThemedText> : null}
        {exportEnabled && workoutWriteAccess === 'denied' ? <ThemedText testID="health-export-permission-warning" accessibilityLiveRegion="polite" style={[styles.body, { color: '#D93632' }]}>Workout export is paused because Apple Health write access is off. Restore workout access in iOS Health settings to resume.</ThemedText> : null}
        {notice ? <ThemedText testID="health-action-notice" accessibilityLiveRegion="polite" style={styles.body}>{notice}</ThemedText> : null}

        <ThemedText style={styles.sectionTitle}>Your choices</ThemedText>
        <View style={[styles.settingsGroup, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
          {settingRow('Read steps and sleep', 'Import recent daily totals from Apple Health.', 'health-read-toggle', readEnabled, canConnect || readEnabled, toggleRead)}
          {settingRow('Save PrimeRep workouts', 'Export newly completed workouts after PrimeRep confirms them. Existing Apple Health workouts stay there if you disconnect.', 'health-export-toggle', exportEnabled, canConnect || exportEnabled, toggleExport)}
          {settingRow('Use summaries in Coach', 'Optional, rules-based context; never changes your plan.', 'health-coach-toggle', Boolean(readEnabled && visibleState?.coachEnabled), Boolean(canConnect && readEnabled && primarySelected), toggleCoach)}
        </View>

        <View style={[styles.settingsGroup, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
          <View testID="health-primary-source" style={[styles.settingRow, { borderColor: colors.inputBorder }]}>
            <View style={styles.settingText}>
              <ThemedText style={styles.settingTitle}>Primary source</ThemedText>
              <ThemedText style={[styles.settingDetail, { color: colors.icon }]}>Only the selected source is used for Coach context.</ThemedText>
            </View>
            {primarySelected ? (
              <ThemedText style={[styles.unavailable, { color: colors.icon }]}>Apple Health selected</ThemedText>
            ) : (
              <Pressable onPress={selectPrimary} disabled={!canConnect || !connected?.readEnabled || Boolean(busy)} accessibilityRole="button" accessibilityLabel="Select Apple Health as primary source" accessibilityState={{ disabled: !canConnect || !connected?.readEnabled || Boolean(busy) }} style={styles.primaryButton}>
                <ThemedText style={{ color: colors.primaryButton }}>Select Apple Health</ThemedText>
              </Pressable>
            )}
          </View>
          <View style={styles.actions}>
            <Pressable onPress={syncNow} disabled={!canConnect || !readEnabled || Boolean(busy)} testID="health-sync-now" accessibilityRole="button" accessibilityState={{ disabled: !canConnect || !readEnabled || Boolean(busy) }} style={[styles.disabledAction, { borderColor: colors.inputBorder }]}>
              <ThemedText style={[styles.disabledActionText, { color: canConnect && readEnabled ? colors.primaryButton : colors.icon }]}>{busy === 'sync' ? 'Syncing…' : 'Sync now'}</ThemedText>
            </Pressable>
            <Pressable onPress={disconnect} disabled={connected?.source !== 'apple_health' || Boolean(busy)} testID="health-disconnect" accessibilityRole="button" accessibilityState={{ disabled: connected?.source !== 'apple_health' || Boolean(busy) }} style={[styles.disabledAction, { borderColor: colors.inputBorder }]}>
              <ThemedText style={[styles.disabledActionText, { color: connected?.source === 'apple_health' ? colors.primaryButton : colors.icon }]}>Disconnect</ThemedText>
            </Pressable>
            <Pressable onPress={openSettings} disabled={Platform.OS !== 'ios'} testID="health-open-health-app-settings" accessibilityRole="button" accessibilityState={{ disabled: Platform.OS !== 'ios' }} style={[styles.disabledAction, { borderColor: colors.inputBorder }]}>
              <ThemedText style={[styles.disabledActionText, { color: Platform.OS === 'ios' ? colors.primaryButton : colors.icon }]}>Open iOS app settings</ThemedText>
            </Pressable>
          </View>
        </View>

        <ThemedText style={[styles.privacy, { color: colors.icon }]}>When enabled, the first import covers 30 days. PrimeRep retains daily summaries for up to 90 days. Disconnect removes this source’s summaries from PrimeRep, but does not delete records in Apple Health.</ThemedText>
        <ThemedText style={[styles.privacy, { color: colors.icon }]}>Apple does not tell apps whether read access was granted or revoked. To review steps and sleep access, open the Health app’s Apps section and select PrimeRep. Health collection stays disabled until the privacy and platform release gates are approved.</ThemedText>
        {HEALTH_BRIDGE_TEST_ENABLED ? (
          <Pressable testID="health-bridge-test-link" accessibilityRole="button" accessibilityLabel="Open Apple Health bridge test" onPress={() => router.push('/settings/health-bridge-test')} style={[styles.disabledAction, { borderColor: colors.inputBorder }]}>
            <ThemedText style={[styles.disabledActionText, { color: colors.primaryButton }]}>Open developer bridge test</ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.sans, fontSize: 23, lineHeight: 30, fontWeight: '700', marginLeft: 8 },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 22 },
  status: { borderWidth: 1, borderRadius: 22, padding: 22, gap: 12 },
  statusIcon: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontFamily: Fonts.sans, fontSize: 23, lineHeight: 30, fontWeight: '700' },
  exportIssue: { gap: 12, alignItems: 'flex-start' },
  body: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 23 },
  connectionStatus: { gap: 6 },
  sectionTitle: { fontFamily: Fonts.sans, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  caption: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
  settingsGroup: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16 },
  settingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 82, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  settingToggleRow: { alignItems: 'flex-start' },
  settingText: { flex: 1, paddingVertical: 14, gap: 4 },
  settingSwitch: { paddingTop: 10, alignItems: 'center', justifyContent: 'flex-start' },
  settingTitle: { fontFamily: Fonts.sans, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  settingDetail: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
  unavailable: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18 },
  primaryButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  actions: { paddingVertical: 16, gap: 10 },
  disabledAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  disabledActionText: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  privacy: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21 },
  policyAction: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  policyCheck: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  policyCheckText: { flex: 1 },
  policyAccept: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  policyAcceptText: { fontFamily: Fonts.sans, fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#FFFFFF' },
});
