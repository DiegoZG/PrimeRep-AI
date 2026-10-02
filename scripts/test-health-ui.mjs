import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function load(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const require = (name) => name in mocks ? mocks[name] : fallback(name);
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require, setTimeout, clearTimeout, console }, { filename });
  return module.exports;
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const quietExportStatus = { subscribeHealthExportSyncStatus: (_userId, listener) => { listener(null); return () => {}; }, setHealthExportSyncStatus() {} };

test('Coach health guidance has a valid Settings destination', () => {
  const nav = load('utils/coachNavigation.ts');
  assert.equal(nav.isCoachTarget({ type: 'settings', section: 'health' }), true);
  assert.equal(nav.coachTargetHref({ type: 'settings', section: 'health' }), '/settings/health');
  assert.equal(nav.isCoachTarget({ type: 'settings', section: 'unknown' }), false);
});

test('Coach health action copy follows the actual destination', async () => {
  const { CoachBriefingItem } = load('components/coach/CoachBriefingItem.tsx', {
    react: React,
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'react-native': { Pressable: 'Pressable', View: 'View', StyleSheet: { create: (styles) => styles } },
    '@/components/themed-text': { ThemedText: 'ThemedText' },
    '@/constants/theme': { Fonts: { sans: 'system-ui' } },
    '@/utils/coachItemBody': { coachItemPresentation: (item) => ({ body: item.body, adjustmentNote: null }) },
  });
  const palette = Object.fromEntries(['canvas', 'surface', 'ink', 'ink2', 'ink3', 'accent', 'accentText', 'accentSoft', 'signal', 'signalSoft', 'success', 'neutralNode', 'separator', 'error', 'errorSoft'].map((key) => [key, '#555']));
  const baseItem = { id: 'h1', kind: 'health_context', priority: 55, title: 'Check in', body: 'Notice how you feel.', detail: 'Source data.', isAiAssisted: false, readAt: null, createdAt: '2026-09-26T12:00:00Z', expiresAt: '2026-09-27T00:00:00Z' };
  const element = (target) => React.createElement(CoachBriefingItem, { item: { ...baseItem, target }, palette, expanded: false, busy: false, isLast: true, weightUnit: null, dumbbellWeights: [], plateWeights: [], onToggleDetail() {}, onPrimaryAction() {}, onDismiss() {} });
  let tree;
  await act(async () => { tree = create(element({ type: 'settings', section: 'health' })); });
  assert.equal(tree.root.findByProps({ testID: 'coach-item-action-h1' }).props.accessibilityLabel, 'Health settings: Check in');
  await act(async () => { tree.update(element({ type: 'planned_workout', workoutDayId: 'day1', weekStart: '2026-09-21' })); });
  assert.equal(tree.root.findByProps({ testID: 'coach-item-action-h1' }).props.accessibilityLabel, 'Open workout: Check in');
  await act(async () => { tree.update(element({ type: 'completed_session', sessionId: 'session1' })); });
  assert.equal(tree.root.findByProps({ testID: 'coach-item-action-h1' }).props.accessibilityLabel, 'View workout: Check in');
  await act(async () => { tree.unmount(); });
});

test('Health screen keeps all controls disabled and fences delayed account responses', async () => {
  const AuthContext = React.createContext(null);
  const calls = [];
  const getHealthState = (token) => { const call = deferred(); calls.push({ token, ...call }); return call.promise; };
  const rn = {
    Platform: { OS: 'ios' },
    AppState: { addEventListener: () => ({ remove() {} }) },
    Pressable: 'Pressable', ScrollView: 'ScrollView', StatusBar: 'StatusBar', Switch: 'Switch', View: 'View',
    StyleSheet: { hairlineWidth: 1, create: (styles) => styles },
  };
  const { default: HealthScreen } = load('app/settings/health.tsx', {
    react: React,
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { useRouter: () => ({ back() {} }) },
    'react-native': rn,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/components/themed-text': { ThemedText: 'ThemedText' },
    '@/components/screen-state': { ScreenState: 'ScreenState' },
    '@/config/healthBridgeTest': { HEALTH_BRIDGE_TEST_ENABLED: false },
    '@/constants/theme': { Colors: { dark: { background: '#151718', inputBackground: '#1F1F1F', inputBorder: '#3A3A3A', text: '#ECEDEE', icon: '#9BA1A6', primaryButton: '#6a4ff5', placeholder: '#9BA1A6' } }, Fonts: { sans: 'system-ui' } },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'dark' },
    '@/services/healthService': { getHealthState },
    '@/services/health/appleHealthAdapter': { appleHealthAdapter: { availability: async () => 'available', getPermissions: async () => ({ writeWorkout: 'unknown' }) } },
    '@/services/health/readSync': { syncAppleHealthRead: async () => false },
    '@/services/health/exportSync': { disableHealthExport: async () => {}, prepareHealthExport: async () => {}, confirmHealthExportOptIn: async () => ({ server: 1, local: 1 }), reconcileAppleHealthExport: async () => {}, requestHealthExportStop: async () => {}, waitForHealthExportIdle: async () => {}, pauseHealthExport() {}, resumeHealthExport() {} },
    '@/services/health/exportStatus': quietExportStatus,
    '@/services/httpClient': { HttpError: Error },
    '@/utils/authContext': { AuthContext },
  });
  const render = (id) => React.createElement(AuthContext.Provider, { value: { token: id, user: { id } } }, React.createElement(HealthScreen));
  let tree;
  await act(async () => { tree = create(render('A')); });
  assert.equal(calls[0].token, 'A');
  await act(async () => { tree.update(render('B')); });
  await act(async () => { tree.update(render('A')); });
  await act(async () => { calls[0].resolve({ collectionAvailable: true, sources: [{ source: 'apple_health', lastSuccessfulSyncAt: null }], primarySource: 'apple_health', coachEnabled: true, days: [] }); });
  assert.equal(tree.root.findAllByProps({ testID: 'health-server-status' }).length, 0);
  await act(async () => { calls[1].resolve({ collectionAvailable: true, sources: [], primarySource: null, coachEnabled: false, days: [] }); });
  assert.equal(tree.root.findAllByProps({ testID: 'health-server-status' }).length, 0);
  await act(async () => { calls[2].resolve({ collectionAvailable: false, sources: [], primarySource: null, coachEnabled: false, days: [] }); });
  assert.equal(tree.root.findAllByProps({ testID: 'health-server-status' }).length, 1);
  assert.equal(tree.root.findAllByType('Switch').every((node) => node.props.disabled && node.props.value === false), true);
  for (const id of ['health-sync-now', 'health-disconnect']) {
    assert.equal(tree.root.findByProps({ testID: id }).props.accessibilityState.disabled, true);
  }
  assert.equal(tree.root.findByProps({ testID: 'health-open-health-app-settings' }).props.accessibilityState.disabled, false);
  await act(async () => { tree.unmount(); });
});

test('Health connection remains visible after first sync fails and rapid taps do not repeat mutations', async () => {
  const AuthContext = React.createContext(null);
  let foreground;
  let permissionRequests = 0;
  let connections = 0;
  let disconnections = 0;
  let statusReads = 0;
  const disconnected = { collectionAvailable: true, sources: [], primarySource: null, coachEnabled: false, days: [] };
  const connected = { collectionAvailable: true, sources: [{ source: 'apple_health', readEnabled: true, exportEnabled: false, connectionRevision: 1, lastSuccessfulSyncAt: null }], primarySource: 'apple_health', coachEnabled: false, days: [] };
  const { default: HealthScreen } = load('app/settings/health.tsx', {
    react: React,
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { useRouter: () => ({ back() {} }) },
    'react-native': {
      Platform: { OS: 'ios' }, AppState: { addEventListener: (_event, handler) => { foreground = handler; return { remove() {} }; } },
      Pressable: 'Pressable', ScrollView: 'ScrollView', StatusBar: 'StatusBar', Switch: 'Switch', View: 'View',
      StyleSheet: { hairlineWidth: 1, create: (styles) => styles },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/components/themed-text': { ThemedText: 'ThemedText' },
    '@/components/screen-state': { ScreenState: 'ScreenState' },
    '@/config/healthBridgeTest': { HEALTH_BRIDGE_TEST_ENABLED: false },
    '@/constants/theme': { Colors: { dark: { background: '#151718', inputBackground: '#1F1F1F', inputBorder: '#3A3A3A', text: '#ECEDEE', icon: '#9BA1A6', primaryButton: '#6a4ff5', placeholder: '#9BA1A6' } }, Fonts: { sans: 'system-ui' } },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'dark' },
    '@/services/healthService': {
      getHealthState: async () => { statusReads += 1; return statusReads === 1 || statusReads >= 3 ? disconnected : connected; },
      setAppleHealthSource: async () => { connections += 1; return connected.sources[0]; },
      setHealthPreferences: async () => {},
      disconnectHealthSource: async () => { disconnections += 1; },
    },
    '@/services/health/appleHealthAdapter': { appleHealthAdapter: {
      availability: async () => 'available', getPermissions: async () => ({ writeWorkout: 'unknown' }), requestReadPermission: async () => { permissionRequests += 1; },
    } },
    '@/services/health/readSync': { syncAppleHealthRead: async () => { throw new Error('temporary sync failure'); } },
    '@/services/health/exportSync': { disableHealthExport: async () => {}, prepareHealthExport: async () => {}, reconcileAppleHealthExport: async () => {}, requestHealthExportStop: async () => {}, waitForHealthExportIdle: async () => {}, pauseHealthExport() {}, resumeHealthExport() {} },
    '@/services/health/exportStatus': quietExportStatus,
    '@/services/httpClient': { HttpError: Error },
    '@/utils/authContext': { AuthContext },
  });
  let tree;
  await act(async () => { tree = create(React.createElement(AuthContext.Provider, { value: { token: 'A', user: { id: 'A' } } }, React.createElement(HealthScreen))); });
  const readSwitch = () => tree.root.findByProps({ accessibilityLabel: 'Read steps and sleep' });
  assert.equal(readSwitch().props.value, false);
  await act(async () => {
    readSwitch().props.onValueChange(true);
    readSwitch().props.onValueChange(true);
    foreground('active');
    await new Promise(setImmediate);
  });
  assert.equal(permissionRequests, 1);
  assert.equal(connections, 1);
  assert.equal(statusReads, 2);
  assert.equal(readSwitch().props.value, true);
  assert.match(tree.root.findByProps({ testID: 'health-action-error' }).props.children, /connected, but its first sync failed/);
  await act(async () => { tree.root.findByProps({ testID: 'health-disconnect' }).props.onPress(); await new Promise(setImmediate); });
  assert.equal(disconnections, 1);
  assert.equal(readSwitch().props.value, false);
  await act(async () => { tree.unmount(); });
});

test('Saved Apple Health sources can be disconnected even when collection or HealthKit is unavailable', async () => {
  for (const { collectionAvailable, nativeAvailability } of [
    { collectionAvailable: false, nativeAvailability: 'available' },
    { collectionAvailable: true, nativeAvailability: 'unsupported' },
  ]) {
    const AuthContext = React.createContext(null);
    let disconnects = 0;
    let saved = true;
    const { default: HealthScreen } = load('app/settings/health.tsx', {
      react: React,
      '@expo/vector-icons': { Ionicons: 'Ionicons' },
      'expo-router': { useRouter: () => ({ back() {} }) },
      'react-native': {
        Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove() {} }) },
        Pressable: 'Pressable', ScrollView: 'ScrollView', StatusBar: 'StatusBar', Switch: 'Switch', View: 'View',
        StyleSheet: { hairlineWidth: 1, create: (styles) => styles },
      },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '@/components/themed-text': { ThemedText: 'ThemedText' },
      '@/components/screen-state': { ScreenState: 'ScreenState' },
      '@/config/healthBridgeTest': { HEALTH_BRIDGE_TEST_ENABLED: false },
      '@/constants/theme': { Colors: { dark: { background: '#151718', inputBackground: '#1F1F1F', inputBorder: '#3A3A3A', text: '#ECEDEE', icon: '#9BA1A6', primaryButton: '#6a4ff5', placeholder: '#9BA1A6' } }, Fonts: { sans: 'system-ui' } },
      '@/hooks/use-color-scheme': { useColorScheme: () => 'dark' },
      '@/services/healthService': {
        getHealthState: async () => ({ collectionAvailable, sources: saved ? [{ source: 'apple_health', readEnabled: true, exportEnabled: false, connectionRevision: 1, lastSuccessfulSyncAt: null }] : [], primarySource: saved ? 'apple_health' : null, coachEnabled: false, days: [] }),
        disconnectHealthSource: async () => { disconnects += 1; saved = false; },
      },
      '@/services/health/appleHealthAdapter': { appleHealthAdapter: { availability: async () => nativeAvailability, getPermissions: async () => ({ writeWorkout: 'unknown' }) } },
      '@/services/health/readSync': { syncAppleHealthRead: async () => false },
      '@/services/health/exportSync': { disableHealthExport: async () => {}, prepareHealthExport: async () => {}, reconcileAppleHealthExport: async () => {}, requestHealthExportStop: async () => {}, waitForHealthExportIdle: async () => {}, pauseHealthExport() {}, resumeHealthExport() {} },
      '@/services/health/exportStatus': quietExportStatus,
      '@/services/httpClient': { HttpError: Error },
      '@/utils/authContext': { AuthContext },
    });
    let tree;
    await act(async () => { tree = create(React.createElement(AuthContext.Provider, { value: { token: 'A', user: { id: 'A' } } }, React.createElement(HealthScreen))); });
    assert.equal(tree.root.findByProps({ testID: 'health-release-status' }).findAllByType('ThemedText')[0].props.children, 'Apple Health connection saved');
    assert.equal(tree.root.findByProps({ accessibilityLabel: 'Read steps and sleep' }).props.disabled, false);
    assert.equal(tree.root.findByProps({ testID: 'health-sync-now' }).props.accessibilityState.disabled, true);
    assert.equal(tree.root.findByProps({ testID: 'health-disconnect' }).props.accessibilityState.disabled, false);
    await act(async () => { tree.root.findByProps({ testID: 'health-disconnect' }).props.onPress(); await new Promise(setImmediate); });
    assert.equal(disconnects, 1);
    assert.equal(tree.root.findByProps({ testID: 'health-disconnect' }).props.accessibilityState.disabled, true);
    await act(async () => { tree.unmount(); });
  }
});

test('read and workout export can be withdrawn separately while collection or HealthKit is unavailable', async () => {
  for (const { collectionAvailable, nativeAvailability } of [
    { collectionAvailable: false, nativeAvailability: 'available' },
    { collectionAvailable: true, nativeAvailability: 'unsupported' },
  ]) {
    const AuthContext = React.createContext(null);
    let source = { source: 'apple_health', readEnabled: true, exportEnabled: true, connectionRevision: 1, exportEnabledAt: '2026-10-01T12:00:00Z' };
    const mutations = [];
    let permissionRequests = 0;
    const { default: HealthScreen } = load('app/settings/health.tsx', {
      react: React,
      '@expo/vector-icons': { Ionicons: 'Ionicons' },
      'expo-router': { useRouter: () => ({ back() {} }) },
      'react-native': { Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove() {} }) }, Pressable: 'Pressable', ScrollView: 'ScrollView', StatusBar: 'StatusBar', Switch: 'Switch', View: 'View', StyleSheet: { hairlineWidth: 1, create: (styles) => styles } },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '@/components/themed-text': { ThemedText: 'ThemedText' },
      '@/components/screen-state': { ScreenState: 'ScreenState' },
      '@/config/healthBridgeTest': { HEALTH_BRIDGE_TEST_ENABLED: false },
      '@/constants/theme': { Colors: { dark: { background: '#151718', inputBackground: '#1F1F1F', inputBorder: '#3A3A3A', text: '#ECEDEE', icon: '#9BA1A6', primaryButton: '#6a4ff5', placeholder: '#9BA1A6' } }, Fonts: { sans: 'system-ui' } },
      '@/hooks/use-color-scheme': { useColorScheme: () => 'dark' },
      '@/services/healthService': {
        getHealthState: async () => ({ collectionAvailable, sources: source ? [source] : [], primarySource: 'apple_health', coachEnabled: false, days: [] }),
        setAppleHealthSource: async (_token, readEnabled, exportEnabled, revision) => {
          mutations.push([readEnabled, exportEnabled, revision]);
          source = { ...source, readEnabled, exportEnabled, connectionRevision: source.connectionRevision + 1, exportEnabledAt: exportEnabled ? source.exportEnabledAt : null };
          return source;
        },
        disconnectHealthSource: async (_token, revision) => { mutations.push(['disconnect', revision]); source = null; },
      },
      '@/services/health/appleHealthAdapter': { appleHealthAdapter: { availability: async () => nativeAvailability, getPermissions: async () => ({ writeWorkout: 'unknown' }), requestReadPermission: async () => { permissionRequests += 1; }, requestWritePermission: async () => { permissionRequests += 1; } } },
      '@/services/health/readSync': { syncAppleHealthRead: async () => false },
      '@/services/health/exportSync': { disableHealthExport: async () => {}, prepareHealthExport: async () => {}, reconcileAppleHealthExport: async () => {}, requestHealthExportStop: async () => {}, waitForHealthExportIdle: async () => {}, pauseHealthExport() {}, resumeHealthExport() {} },
      '@/services/health/exportStatus': quietExportStatus,
      '@/services/httpClient': { HttpError: Error },
      '@/utils/authContext': { AuthContext },
    });
    let tree;
    await act(async () => { tree = create(React.createElement(AuthContext.Provider, { value: { token: 'token', user: { id: 'user' } } }, React.createElement(HealthScreen))); });
    const read = () => tree.root.findByProps({ accessibilityLabel: 'Read steps and sleep' });
    const exportWorkouts = () => tree.root.findByProps({ accessibilityLabel: 'Save PrimeRep workouts' });
    assert.equal(read().props.disabled, false);
    assert.equal(exportWorkouts().props.disabled, false);
    await act(async () => { read().props.onValueChange(); await new Promise(setImmediate); });
    assert.deepEqual(mutations, [[false, true, 1]]);
    assert.equal(read().props.value, false);
    assert.equal(exportWorkouts().props.value, true);
    await act(async () => { exportWorkouts().props.onValueChange(); await new Promise(setImmediate); });
    assert.deepEqual(mutations, [[false, true, 1], ['disconnect', 2]]);
    assert.equal(exportWorkouts().props.value, false);
    assert.equal(permissionRequests, 0);
    await act(async () => { tree.unmount(); });
  }
});

test('Opening iOS settings cannot display an error after an account switch', async () => {
  const AuthContext = React.createContext(null);
  const opened = deferred();
  const { default: HealthScreen } = load('app/settings/health.tsx', {
    react: React,
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { useRouter: () => ({ back() {} }) },
    'react-native': {
      Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove() {} }) },
      Pressable: 'Pressable', ScrollView: 'ScrollView', StatusBar: 'StatusBar', Switch: 'Switch', View: 'View',
      StyleSheet: { hairlineWidth: 1, create: (styles) => styles },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/components/themed-text': { ThemedText: 'ThemedText' },
    '@/components/screen-state': { ScreenState: 'ScreenState' },
    '@/config/healthBridgeTest': { HEALTH_BRIDGE_TEST_ENABLED: false },
    '@/constants/theme': { Colors: { dark: { background: '#151718', inputBackground: '#1F1F1F', inputBorder: '#3A3A3A', text: '#ECEDEE', icon: '#9BA1A6', primaryButton: '#6a4ff5', placeholder: '#9BA1A6' } }, Fonts: { sans: 'system-ui' } },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'dark' },
    '@/services/healthService': { getHealthState: async () => ({ collectionAvailable: false, sources: [], primarySource: null, coachEnabled: false, days: [] }) },
    '@/services/health/appleHealthAdapter': { appleHealthAdapter: { openAppSettings: () => opened.promise } },
    '@/services/health/readSync': { syncAppleHealthRead: async () => false },
    '@/services/health/exportSync': { disableHealthExport: async () => {}, prepareHealthExport: async () => {}, reconcileAppleHealthExport: async () => {}, requestHealthExportStop: async () => {}, waitForHealthExportIdle: async () => {}, pauseHealthExport() {}, resumeHealthExport() {} },
    '@/services/health/exportStatus': quietExportStatus,
    '@/services/httpClient': { HttpError: Error },
    '@/utils/authContext': { AuthContext },
  });
  const render = (id) => React.createElement(AuthContext.Provider, { value: { token: id, user: { id } } }, React.createElement(HealthScreen));
  let tree;
  await act(async () => { tree = create(render('A')); });
  await act(async () => { tree.root.findByProps({ testID: 'health-open-health-app-settings' }).props.onPress(); tree.update(render('B')); });
  await act(async () => { opened.reject(new Error('Cannot open settings')); await new Promise(setImmediate); });
  assert.equal(tree.root.findAllByProps({ testID: 'health-action-error' }).length, 0);
  await act(async () => { tree.unmount(); });
});

test('Health read sync uploads a 30-day nullable window and rejects stale revisions', async () => {
  const aggregation = load('services/health/aggregation.ts');
  let upload;
  const adapter = {
    availability: async () => 'available',
    getPermissions: async () => ({ writeWorkout: 'unknown' }),
    readDailySummaries: async (_start, end, timeZone) => [
      { localDate: end, timeZone, steps: 925, asleepMinutes: null },
    ],
  };
  const { syncAppleHealthRead } = load('services/health/readSync.ts', {
    '@/services/health/appleHealthAdapter': { appleHealthAdapter: adapter },
    './appleHealthAdapter': { appleHealthAdapter: adapter },
    './aggregation': aggregation,
    '@/services/healthService': { uploadHealthDays: async (...args) => { upload = args; } },
  });
  const connection = { source: 'apple_health', connectionRevision: 7, readEnabled: true };
  const synced = await syncAppleHealthRead('user-token', connection, () => true, new Date('2026-10-01T12:00:00Z'));
  assert.equal(synced, true);
  assert.equal(upload[0], 'user-token');
  assert.equal(upload[1], 7);
  assert.equal(upload[2].length, 30);
  assert.equal(upload[2].filter((day) => day.steps === null && day.asleepMinutes === null).length, 29);
  assert.equal(upload[2].at(-1).steps, 925);
  assert.equal(upload[2].at(-1).asleepMinutes, null);
  upload = undefined;
  assert.equal(await syncAppleHealthRead('user-token', connection, () => false), false);
  assert.equal(upload, undefined);
  const { syncAppleHealthRead: conflictingSync } = load('services/health/readSync.ts', {
    './appleHealthAdapter': { appleHealthAdapter: adapter },
    './aggregation': aggregation,
    '@/services/healthService': { uploadHealthDays: async () => { const error = new Error('stale revision'); error.status = 409; throw error; } },
  });
  await assert.rejects(conflictingSync('user-token', connection, () => true), { status: 409 });
});

test('Health screen gates read and workout export actions on server availability', () => {
  const source = readFileSync(path.join(root, 'app/settings/health.tsx'), 'utf8');
  assert.match(source, /getHealthState\(token\)/);
  assert.match(source, /collectionAvailable/);
  assert.match(source, /requestReadPermission\(/);
  assert.match(source, /requestWritePermission\(/);
  assert.match(source, /'health-export-toggle', exportEnabled, canConnect \|\| exportEnabled, toggleExport/);
  for (const forbidden of ['writeWorkout(', 'uploadHealthDays(']) {
    assert.equal(source.includes(forbidden), false);
  }
});

test('Health export failures stay account-scoped and a successful retry clears them', async () => {
  const AuthContext = React.createContext(null);
  const exportStatus = load('services/health/exportStatus.ts');
  let attempts = 0;
  const { default: HealthScreen } = load('app/settings/health.tsx', {
    react: React,
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { useRouter: () => ({ back() {} }) },
    'react-native': {
      Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove() {} }) },
      Pressable: 'Pressable', ScrollView: 'ScrollView', StatusBar: 'StatusBar', Switch: 'Switch', View: 'View',
      StyleSheet: { hairlineWidth: 1, create: (styles) => styles },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/components/themed-text': { ThemedText: 'ThemedText' },
    '@/components/screen-state': { ScreenState: 'ScreenState' },
    '@/config/healthBridgeTest': { HEALTH_BRIDGE_TEST_ENABLED: false },
    '@/constants/theme': { Colors: { dark: { background: '#151718', inputBackground: '#1F1F1F', inputBorder: '#3A3A3A', text: '#ECEDEE', icon: '#9BA1A6', primaryButton: '#6a4ff5', placeholder: '#9BA1A6' } }, Fonts: { sans: 'system-ui' } },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'dark' },
    '@/services/healthService': { getHealthState: async () => ({ collectionAvailable: true, sources: [], primarySource: null, coachEnabled: false, days: [] }) },
    '@/services/health/appleHealthAdapter': { appleHealthAdapter: { availability: async () => 'available', getPermissions: async () => ({ writeWorkout: 'unknown' }) } },
    '@/services/health/readSync': { syncAppleHealthRead: async () => false },
    '@/services/health/exportSync': { reconcileAppleHealthExport: async (_token, userId) => { attempts += 1; exportStatus.setHealthExportSyncStatus(userId, null); } },
    '@/services/health/exportStatus': exportStatus,
    '@/services/httpClient': { HttpError: Error },
    '@/utils/authContext': { AuthContext },
  });
  const render = (userId) => React.createElement(AuthContext.Provider, { value: { token: userId, user: { id: userId } } }, React.createElement(HealthScreen));
  let tree;
  await act(async () => { tree = create(render('A')); });
  await act(async () => { exportStatus.setHealthExportSyncStatus('A', 'retry'); });
  assert.equal(tree.root.findAllByProps({ testID: 'health-export-sync-error' }).length, 1);
  await act(async () => { tree.update(render('B')); });
  assert.equal(tree.root.findAllByProps({ testID: 'health-export-sync-error' }).length, 0);
  await act(async () => { exportStatus.setHealthExportSyncStatus('B', 'export-off-pending'); });
  assert.match(tree.root.findByProps({ testID: 'health-export-sync-error' }).findAllByType('ThemedText')[0].props.children, /server/);
  assert.equal(tree.root.findByProps({ testID: 'health-export-retry' }).props.accessibilityLabel, 'Retry stopping Apple Health export');
  await act(async () => { exportStatus.setHealthExportSyncStatus('B', 'disconnect-pending'); });
  assert.equal(tree.root.findByProps({ testID: 'health-export-retry' }).props.accessibilityLabel, 'Retry disconnecting Apple Health');
  await act(async () => { exportStatus.setHealthExportSyncStatus('B', 'connection-changed'); });
  assert.equal(tree.root.findAllByProps({ testID: 'health-export-connection-changed' }).length, 1);
  assert.equal(tree.root.findAllByProps({ testID: 'health-export-retry' }).length, 0);
  await act(async () => { tree.update(render('A')); });
  assert.equal(tree.root.findAllByProps({ testID: 'health-export-sync-error' }).length, 1);
  assert.equal(tree.root.findAllByProps({ testID: 'health-export-connection-changed' }).length, 0);
  await act(async () => { tree.root.findByProps({ testID: 'health-export-retry' }).props.onPress(); await new Promise(setImmediate); });
  assert.equal(attempts, 1);
  assert.equal(tree.root.findAllByProps({ testID: 'health-export-sync-error' }).length, 0);
  await act(async () => { tree.unmount(); });
});

test('offline export withdrawal and disconnect show durable pending revocation immediately', async () => {
  for (const action of ['export-off', 'disconnect']) {
    const AuthContext = React.createContext(null);
    const exportStatus = load('services/health/exportStatus.ts');
    const source = { source: 'apple_health', readEnabled: true, exportEnabled: true, connectionRevision: 4, exportEnabledAt: '2026-10-01T12:00:00Z', connectedAt: '2026-10-01T12:00:00Z', lastSuccessfulSyncAt: null };
    let reads = 0;
    let pending = null;
    const { default: HealthScreen } = load('app/settings/health.tsx', {
      react: React,
      '@expo/vector-icons': { Ionicons: 'Ionicons' },
      'expo-router': { useRouter: () => ({ back() {} }) },
      'react-native': {
        Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove() {} }) },
        Pressable: 'Pressable', ScrollView: 'ScrollView', StatusBar: 'StatusBar', Switch: 'Switch', View: 'View',
        StyleSheet: { hairlineWidth: 1, create: (styles) => styles },
      },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '@/components/themed-text': { ThemedText: 'ThemedText' },
      '@/components/screen-state': { ScreenState: 'ScreenState' },
      '@/config/healthBridgeTest': { HEALTH_BRIDGE_TEST_ENABLED: false },
      '@/constants/theme': { Colors: { dark: { background: '#151718', inputBackground: '#1F1F1F', inputBorder: '#3A3A3A', text: '#ECEDEE', icon: '#9BA1A6', primaryButton: '#6a4ff5', placeholder: '#9BA1A6' } }, Fonts: { sans: 'system-ui' } },
      '@/hooks/use-color-scheme': { useColorScheme: () => 'dark' },
      '@/services/health/appleHealthAdapter': { appleHealthAdapter: { availability: async () => 'available', getPermissions: async () => ({ writeWorkout: 'granted' }) } },
      '@/services/health/readSync': { syncAppleHealthRead: async () => false },
      '@/services/health/exportSync': {
        requestHealthExportStop: async (_userId, reason, connectionRevision, exportEnabledAt) => { pending = { reason, connectionRevision, exportEnabledAt }; },
        getHealthExportStop: async () => pending,
        waitForHealthExportIdle: async () => {}, pauseHealthExport() {}, resumeHealthExport() {},
        reconcileAppleHealthExport: async () => { throw new Error('offline'); },
      },
      '@/services/health/exportStatus': exportStatus,
      '@/services/healthService': {
        getHealthState: async () => { reads += 1; if (reads > 1) throw new Error('offline'); return { collectionAvailable: true, sources: [source], sourceRevisions: { apple_health: 4 }, primarySource: 'apple_health', coachEnabled: false, days: [] }; },
        setAppleHealthSource: async () => { throw new Error('offline'); },
        disconnectHealthSource: async () => { throw new Error('offline'); },
      },
      '@/services/httpClient': { HttpError: class HttpError extends Error {} },
      '@/utils/authContext': { AuthContext },
    });
    let tree;
    await act(async () => { tree = create(React.createElement(AuthContext.Provider, { value: { token: 'token', user: { id: 'user' } } }, React.createElement(HealthScreen))); });
    await act(async () => {
      if (action === 'export-off') tree.root.findByProps({ accessibilityLabel: 'Save PrimeRep workouts' }).props.onValueChange();
      else tree.root.findByProps({ testID: 'health-disconnect' }).props.onPress();
      await new Promise(setImmediate);
    });
    assert.equal(pending.reason, action);
    assert.equal(exportStatus.getHealthExportSyncStatus('user'), action === 'export-off' ? 'export-off-pending' : 'disconnect-pending');
    assert.match(tree.root.findByProps({ testID: 'health-export-sync-error' }).findAllByType('ThemedText')[0].props.children, /server has not confirmed/);
    assert.equal(tree.root.findAllByProps({ testID: 'health-action-error' }).length, 0);
    assert.equal(tree.root.findByProps({ testID: 'health-export-retry' }).props.accessibilityLabel, action === 'export-off' ? 'Retry stopping Apple Health export' : 'Retry disconnecting Apple Health');
    await act(async () => { tree.unmount(); });
  }
});

test('workout export requires explicit iOS write permission and preserves independent read choice', async () => {
  const AuthContext = React.createContext(null);
  let source = null;
  let permission = 'denied';
  let permissionRequests = 0;
  let failedEnable = false;
  let prepared = 0;
  let discarded = 0;
  let confirmed = 0;
  const mutations = [];
  let foreground;
  const screen = load('app/settings/health.tsx', {
    react: React,
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { useRouter: () => ({ back() {} }) },
    'react-native': {
      Platform: { OS: 'ios' }, AppState: { addEventListener: (_event, handler) => { foreground = handler; return { remove() {} }; } },
      Pressable: 'Pressable', ScrollView: 'ScrollView', StatusBar: 'StatusBar', Switch: 'Switch', View: 'View',
      StyleSheet: { hairlineWidth: 1, create: (styles) => styles },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/components/themed-text': { ThemedText: 'ThemedText' },
    '@/components/screen-state': { ScreenState: 'ScreenState' },
    '@/config/healthBridgeTest': { HEALTH_BRIDGE_TEST_ENABLED: false },
    '@/constants/theme': { Colors: { dark: { background: '#151718', inputBackground: '#1F1F1F', inputBorder: '#3A3A3A', text: '#ECEDEE', icon: '#9BA1A6', primaryButton: '#6a4ff5', placeholder: '#9BA1A6' } }, Fonts: { sans: 'system-ui' } },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'dark' },
    '@/services/health/appleHealthAdapter': { appleHealthAdapter: {
      availability: async () => 'available',
      getPermissions: async () => ({ writeWorkout: permission }),
      requestWritePermission: async () => { permissionRequests += 1; return { writeWorkout: permission }; },
    } },
    '@/services/health/readSync': { syncAppleHealthRead: async () => false },
    '@/services/health/exportSync': { disableHealthExport: async () => { discarded += 1; }, prepareHealthExport: async () => { prepared += 1; }, confirmHealthExportOptIn: async () => { confirmed += 1; return { server: 1, local: 1 }; }, reconcileAppleHealthExport: async () => {}, requestHealthExportStop: async () => {}, waitForHealthExportIdle: async () => {}, pauseHealthExport() {}, resumeHealthExport() {} },
    '@/services/health/exportStatus': quietExportStatus,
    '@/services/healthService': {
      getHealthState: async () => ({ collectionAvailable: true, sources: source ? [source] : [], primarySource: null, coachEnabled: false, days: [] }),
      setAppleHealthSource: async (_token, readEnabled, exportEnabled) => {
        if (failedEnable) { const error = new Error('conflict'); error.status = 409; throw error; }
        mutations.push([readEnabled, exportEnabled]);
        source = { source: 'apple_health', readEnabled, exportEnabled, connectionRevision: mutations.length, connectedAt: '2026-10-01T12:00:00Z', exportEnabledAt: exportEnabled ? '2026-10-01T12:00:00Z' : null };
        return source;
      },
      disconnectHealthSource: async () => { source = null; },
    },
    '@/services/httpClient': { HttpError: Error },
    '@/utils/authContext': { AuthContext },
  });
  let tree;
  await act(async () => { tree = create(React.createElement(AuthContext.Provider, { value: { token: 'token', user: { id: 'user' } } }, React.createElement(screen.default))); });
  const toggle = () => tree.root.findByProps({ accessibilityLabel: 'Save PrimeRep workouts' });
  assert.equal(toggle().props.disabled, false);
  await act(async () => { toggle().props.onValueChange(); await new Promise(setImmediate); });
  assert.equal(permissionRequests, 1);
  assert.equal(mutations.length, 0);
  assert.equal(toggle().props.value, false);
  permission = 'granted';
  failedEnable = true;
  await act(async () => { toggle().props.onValueChange(); await new Promise(setImmediate); });
  assert.equal(prepared, 1);
  assert.equal(discarded, 1);
  assert.equal(confirmed, 0);
  assert.equal(toggle().props.value, false);
  assert.match(tree.root.findByProps({ testID: 'health-action-error' }).props.children, /connection changed/i);
  failedEnable = false;
  await act(async () => { toggle().props.onValueChange(); await new Promise(setImmediate); });
  assert.deepEqual(mutations, [[false, true]]);
  assert.equal(prepared, 2);
  assert.equal(confirmed, 1);
  assert.equal(toggle().props.value, true);
  permission = 'denied';
  await act(async () => { foreground('active'); await new Promise(setImmediate); });
  assert.match(tree.root.findByProps({ testID: 'health-export-permission-warning' }).props.children, /paused/);
  await act(async () => { toggle().props.onValueChange(); await new Promise(setImmediate); });
  assert.equal(toggle().props.value, false);
  await act(async () => { tree.unmount(); });
});

test('Apple Health bridge route is hidden when the developer gate is off', async () => {
  const { default: BridgeScreen } = load('app/settings/health-bridge-test.tsx', {
    react: React,
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { Redirect: 'Redirect', useRouter: () => ({ back() {} }) },
    'react-native': { Alert: { alert() {} }, Pressable: 'Pressable', ScrollView: 'ScrollView', StatusBar: 'StatusBar', View: 'View', StyleSheet: { hairlineWidth: 1, create: (styles) => styles } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/components/themed-text': { ThemedText: 'ThemedText' },
    '@/config/healthBridgeTest': { HEALTH_BRIDGE_TEST_ENABLED: false },
    '@/constants/theme': { Colors: { dark: {} }, Fonts: { sans: 'system-ui' } },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'dark' },
  });
  let tree;
  await act(async () => { tree = create(React.createElement(BridgeScreen)); });
  assert.equal(tree.root.findByType('Redirect').props.href, '/settings/health');
  assert.equal(tree.root.findAllByProps({ testID: 'health-bridge-request-read' }).length, 0);
  await act(async () => { tree.unmount(); });
});

test('Apple Health bridge actions require separate taps and a workout confirmation', async () => {
  const calls = { availability: 0, readPermission: 0, read: 0, writePermission: 0, write: [] };
  let confirm;
  const adapter = {
    availability: async () => { calls.availability += 1; return 'available'; },
    requestReadPermission: async () => { calls.readPermission += 1; return { readSteps: 'unknown', readSleep: 'unknown', writeWorkout: 'unknown' }; },
    readDailySummaries: async () => { calls.read += 1; return [{ localDate: '2026-10-01', timeZone: 'America/New_York', steps: 4000, asleepMinutes: 420 }]; },
    requestWritePermission: async () => { calls.writePermission += 1; return { readSteps: 'unknown', readSleep: 'unknown', writeWorkout: 'granted' }; },
    writeWorkout: async (workout) => { calls.write.push(workout); },
  };
  const { default: BridgeScreen } = load('app/settings/health-bridge-test.tsx', {
    react: React,
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { Redirect: 'Redirect', useRouter: () => ({ back() {} }) },
    'react-native': {
      Alert: { alert: (_title, _message, buttons) => { confirm = buttons[1].onPress; } },
      Pressable: 'Pressable', ScrollView: 'ScrollView', StatusBar: 'StatusBar', View: 'View',
      StyleSheet: { hairlineWidth: 1, create: (styles) => styles },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/components/themed-text': { ThemedText: 'ThemedText' },
    '@/config/healthBridgeTest': { HEALTH_BRIDGE_TEST_ENABLED: true },
    '@/constants/theme': { Colors: { dark: { background: '#151718', inputBackground: '#1F1F1F', inputBorder: '#3A3A3A', text: '#ECEDEE', icon: '#9BA1A6', primaryButton: '#6a4ff5' } }, Fonts: { sans: 'system-ui' } },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'dark' },
    '@/services/health/appleHealthAdapter': { appleHealthAdapter: adapter },
  });
  let tree;
  const tap = async (id) => {
    await act(async () => {
      tree.root.findByProps({ testID: id }).props.onPress();
      await new Promise(setImmediate);
    });
  };
  await act(async () => { tree = create(React.createElement(BridgeScreen)); });
  assert.deepEqual(calls, { availability: 0, readPermission: 0, read: 0, writePermission: 0, write: [] });
  assert.equal(tree.root.findByProps({ testID: 'health-bridge-read-days' }).props.disabled, true);
  assert.equal(tree.root.findByProps({ testID: 'health-bridge-write-test' }).props.disabled, true);
  await tap('health-bridge-availability');
  assert.equal(calls.availability, 1);
  await tap('health-bridge-request-read');
  assert.equal(calls.readPermission, 1);
  assert.equal(tree.root.findByProps({ testID: 'health-bridge-read-days' }).props.disabled, false);
  await tap('health-bridge-read-days');
  assert.equal(calls.read, 1);
  assert.equal(tree.root.findAllByProps({ testID: 'health-bridge-day-2026-10-01' }).length, 1);
  await tap('health-bridge-request-write');
  assert.equal(calls.writePermission, 1);
  await tap('health-bridge-write-test');
  assert.equal(calls.write.length, 0);
  await act(async () => { confirm(); await new Promise(setImmediate); });
  assert.equal(calls.write.length, 1);
  assert.equal(calls.write[0].title, 'PrimeRep HealthKit test (1 minute)');
  assert.equal((Date.parse(calls.write[0].endTime) - Date.parse(calls.write[0].startTime)) / 60_000, 1);
  assert.equal(tree.root.findByProps({ testID: 'health-bridge-write-test' }).props.disabled, true);
  await act(async () => { tree.unmount(); });
});

test('Apple Health bridge requires development mode and an explicit environment opt-in', () => {
  const source = readFileSync(path.join(root, 'config/healthBridgeTest.ts'), 'utf8');
  assert.match(source, /__DEV__\s*&&\s*process\.env\.EXPO_PUBLIC_HEALTH_BRIDGE_TEST\s*===\s*'1'/);
  assert.match(source, /Platform\.OS\s*===\s*'ios'/);
  const screen = readFileSync(path.join(root, 'app/settings/health-bridge-test.tsx'), 'utf8');
  assert.equal(screen.includes('getHealthState('), false);
  assert.equal(screen.includes('uploadHealthDays('), false);
});
