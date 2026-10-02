import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { HEALTH_BRIDGE_TEST_ENABLED } from '@/config/healthBridgeTest';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { HealthDailySummary } from '@/services/health/types';

const dateKey = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};

function BridgeDiagnostic() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState('No Apple Health operation has run.');
  const [readRequested, setReadRequested] = useState(false);
  const [writeAuthorized, setWriteAuthorized] = useState(false);
  const [workoutWritten, setWorkoutWritten] = useState(false);
  const [days, setDays] = useState<HealthDailySummary[] | null>(null);

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    try {
      await action();
    } catch (error) {
      setStatus(`${name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setBusy(null);
    }
  };

  const action = (label: string, testID: string, onPress: () => void, disabled = false) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy !== null }}
      disabled={disabled || busy !== null}
      onPress={onPress}
      style={[styles.action, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, opacity: disabled ? 0.55 : 1 }]}
    >
      <ThemedText style={styles.actionText}>{label}</ThemedText>
      <Ionicons name="chevron-forward" size={20} color={colors.icon} />
    </Pressable>
  );

  const writeTestWorkout = () => {
    Alert.alert(
      'Add a test workout to Apple Health?',
      'This adds one 1-minute Other workout to your personal Apple Health record. Its custom title may not appear in the Health app; identify it by PrimeRep as the source, workout type, and time. It contains no sets, calories, notes, or steps. PrimeRep does not upload this test to its server. You can remove it afterward.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add test workout',
          onPress: () => void run('Test workout write', async () => {
            const { appleHealthAdapter } = await import('@/services/health/appleHealthAdapter');
            const now = Date.now();
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            await appleHealthAdapter.writeWorkout({
              sessionId: `healthkit-bridge-test-${dateKey(new Date(now), timeZone)}`,
              version: 1,
              startTime: new Date(now - 120_000).toISOString(),
              endTime: new Date(now - 60_000).toISOString(),
              title: 'PrimeRep HealthKit test (1 minute)',
              activityType: 'other',
            });
            setWorkoutWritten(true);
            setStatus('One 1-minute test workout was saved. In Apple Health, find it by PrimeRep source, Other workout type, and time; its custom title may not appear.');
          }),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { borderColor: colors.inputBorder }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back from Apple Health bridge test" style={styles.back}>
          <Ionicons name="arrow-back" size={25} color={colors.text} />
        </Pressable>
        <ThemedText accessibilityRole="header" style={styles.headerTitle}>Apple Health bridge test</ThemedText>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.notice, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
          <ThemedText style={styles.noticeTitle}>Development build only</ThemedText>
          <ThemedText style={[styles.body, { color: colors.icon }]}>These checks run only when you tap them. Read results stay on this screen. Nothing here connects to PrimeRep’s server or enables the public Health feature.</ThemedText>
        </View>

        <ThemedText style={styles.sectionTitle}>Bridge and read checks</ThemedText>
        {action('Check HealthKit availability', 'health-bridge-availability', () => void run('Availability check', async () => {
          const { appleHealthAdapter } = await import('@/services/health/appleHealthAdapter');
          setStatus(`HealthKit is ${await appleHealthAdapter.availability()}.`);
        }))}
        {action('Request steps and sleep read access', 'health-bridge-request-read', () => void run('Read permission request', async () => {
          const { appleHealthAdapter } = await import('@/services/health/appleHealthAdapter');
          await appleHealthAdapter.requestReadPermission();
          setReadRequested(true);
          setStatus('Read-access request completed. Apple does not reveal whether individual read types were approved.');
        }))}
        {action('Read yesterday and today', 'health-bridge-read-days', () => void run('Daily summary read', async () => {
          const { appleHealthAdapter } = await import('@/services/health/appleHealthAdapter');
          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const result = await appleHealthAdapter.readDailySummaries(dateKey(yesterday, timeZone), dateKey(new Date(), timeZone), timeZone);
          setDays(result);
          setStatus('Read completed. Missing values do not prove access was denied.');
        }), !readRequested)}
        {days?.map((day) => (
          <View key={day.localDate} testID={`health-bridge-day-${day.localDate}`} style={[styles.day, { borderColor: colors.inputBorder }]}>
            <ThemedText style={styles.dayDate}>{day.localDate}</ThemedText>
            <ThemedText style={[styles.body, { color: colors.icon }]}>Steps: {day.steps ?? 'Not recorded'} · Asleep: {day.asleepMinutes === null ? 'Not recorded' : `${day.asleepMinutes} min`}</ThemedText>
          </View>
        ))}

        <ThemedText style={styles.sectionTitle}>Workout write check</ThemedText>
        <ThemedText style={[styles.body, { color: colors.icon }]}>The final action creates a real Apple Health record. It will ask for confirmation first.</ThemedText>
        {action('Request workout write access', 'health-bridge-request-write', () => void run('Write permission request', async () => {
          const { appleHealthAdapter } = await import('@/services/health/appleHealthAdapter');
          const permission = await appleHealthAdapter.requestWritePermission();
          setWriteAuthorized(permission.writeWorkout === 'granted');
          setStatus(permission.writeWorkout === 'granted' ? 'Workout write access is granted.' : 'Workout write access is not granted.');
        }))}
        {action('Add 1-minute test workout', 'health-bridge-write-test', writeTestWorkout, !writeAuthorized || workoutWritten)}
        <ThemedText testID="health-bridge-status" accessibilityLiveRegion="polite" style={[styles.body, styles.result, { color: colors.text, borderColor: colors.inputBorder }]}>{busy ? `${busy}…` : status}</ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function HealthBridgeTestScreen() {
  return HEALTH_BRIDGE_TEST_ENABLED ? <BridgeDiagnostic /> : <Redirect href="/settings/health" />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.sans, fontSize: 22, lineHeight: 29, fontWeight: '700', marginLeft: 8, flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 44, gap: 14 },
  notice: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 8, marginBottom: 10 },
  noticeTitle: { fontFamily: Fonts.sans, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21 },
  sectionTitle: { fontFamily: Fonts.sans, fontSize: 18, lineHeight: 24, fontWeight: '700', marginTop: 12 },
  action: { minHeight: 52, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  actionText: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 21, fontWeight: '600', flex: 1 },
  day: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8, gap: 3 },
  dayDate: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  result: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, marginTop: 8 },
});
