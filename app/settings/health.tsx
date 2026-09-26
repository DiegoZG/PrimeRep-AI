import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ScreenState } from '@/components/screen-state';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getHealthState } from '@/services/healthService';
import type { HealthState, HealthSourceName } from '@/services/health/types';
import { AuthContext } from '@/utils/authContext';

const SOURCE_NAMES: Record<HealthSourceName, string> = {
  apple_health: 'Apple Health',
  health_connect: 'Health Connect',
};

export default function HealthSettingsScreen() {
  const router = useRouter();
  const { user, token } = useContext(AuthContext);
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const accountKey = `${user?.id ?? 'guest'}:${token ?? 'anonymous'}`;
  const accountKeyRef = useRef(accountKey);
  accountKeyRef.current = accountKey;
  const requestRef = useRef(0);
  const [revision, setRevision] = useState(0);
  const [ownerKey, setOwnerKey] = useState<string | null>(null);
  const [state, setState] = useState<HealthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  const visibleState = ownerKey === accountKey ? state : null;
  const visibleError = ownerKey === accountKey ? error : null;
  const isLoading = ownerKey !== accountKey || loading;
  const source = Platform.OS === 'ios' ? 'apple_health' : Platform.OS === 'android' ? 'health_connect' : null;
  const sourceName = source ? SOURCE_NAMES[source] : 'Apple Health and Health Connect';
  const connected = source ? visibleState?.sources.find((item) => item.source === source) : visibleState?.sources[0];

  const settingRow = (label: string, detail: string, testID: string) => (
    <View testID={testID} accessibilityLabel={`${label}. Unavailable until health connections are enabled.`} style={[styles.settingRow, { borderColor: colors.inputBorder }]}>
      <View style={styles.settingText}>
        <ThemedText style={styles.settingTitle}>{label}</ThemedText>
        <ThemedText style={[styles.settingDetail, { color: colors.icon }]}>{detail}</ThemedText>
      </View>
      <Switch value={false} disabled accessibilityLabel={`${label}, unavailable`} trackColor={{ false: colors.inputBorder, true: colors.primaryButton }} thumbColor={colors.placeholder} />
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
          <ThemedText style={styles.statusTitle}>Health connections are not available yet</ThemedText>
          <ThemedText style={[styles.body, { color: colors.icon }]}>PrimeRep is preparing {sourceName} support. No steps, sleep, or workouts are read or written by this screen.</ThemedText>
        </View>

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
          </View>
        ) : null}

        <ThemedText style={styles.sectionTitle}>When available</ThemedText>
        <View style={[styles.settingsGroup, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
          {settingRow('Read steps and sleep', 'Import recent daily totals from your health app.', 'health-read-toggle')}
          {settingRow('Save PrimeRep workouts', 'Export only newly completed workouts after you opt in.', 'health-export-toggle')}
          {settingRow('Use summaries in Coach', 'Optional, rules-based context; never changes your plan.', 'health-coach-toggle')}
        </View>

        <View style={[styles.settingsGroup, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
          <View testID="health-primary-source" style={[styles.settingRow, { borderColor: colors.inputBorder }]}>
            <View style={styles.settingText}>
              <ThemedText style={styles.settingTitle}>Primary source</ThemedText>
              <ThemedText style={[styles.settingDetail, { color: colors.icon }]}>Choose which source Coach uses if you connect more than one.</ThemedText>
            </View>
            <ThemedText style={[styles.unavailable, { color: colors.icon }]}>Unavailable</ThemedText>
          </View>
          <View style={styles.actions}>
            {['Sync now', 'Disconnect', 'Open health app settings'].map((label) => (
              <View key={label} testID={`health-${label.toLowerCase().replaceAll(' ', '-')}`} accessibilityRole="button" accessibilityState={{ disabled: true }} accessibilityLabel={`${label}, unavailable`} style={[styles.disabledAction, { borderColor: colors.inputBorder }]}>
                <ThemedText style={[styles.disabledActionText, { color: colors.icon }]}>{label}</ThemedText>
              </View>
            ))}
          </View>
        </View>

        <ThemedText style={[styles.privacy, { color: colors.icon }]}>When enabled, the first import will cover 30 days and PrimeRep will keep daily summaries for up to 90 days. Disconnecting will remove that source’s summaries from PrimeRep, but workouts already saved to Apple Health or Health Connect will remain there. You can manage them in the health app.</ThemedText>
        <ThemedText style={[styles.privacy, { color: colors.icon }]}>Health access requires a supported native build, verified permissions, and updated privacy disclosures. This preview cannot connect or sync, and cannot determine whether phone access was denied or revoked.</ThemedText>
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
  body: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 23 },
  connectionStatus: { gap: 6 },
  sectionTitle: { fontFamily: Fonts.sans, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  caption: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
  settingsGroup: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16 },
  settingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 82, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  settingText: { flex: 1, paddingVertical: 14, gap: 4 },
  settingTitle: { fontFamily: Fonts.sans, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  settingDetail: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
  unavailable: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18 },
  actions: { paddingVertical: 16, gap: 10 },
  disabledAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  disabledActionText: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  privacy: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21 },
});
