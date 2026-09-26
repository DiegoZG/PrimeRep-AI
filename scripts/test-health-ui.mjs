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
    '@/constants/theme': { Colors: { dark: { background: '#151718', inputBackground: '#1F1F1F', inputBorder: '#3A3A3A', text: '#ECEDEE', icon: '#9BA1A6', primaryButton: '#6a4ff5', placeholder: '#9BA1A6' } }, Fonts: { sans: 'system-ui' } },
    '@/hooks/use-color-scheme': { useColorScheme: () => 'dark' },
    '@/services/healthService': { getHealthState },
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
  for (const id of ['health-sync-now', 'health-disconnect', 'health-open-health-app-settings']) {
    assert.equal(tree.root.findByProps({ testID: id }).props.accessibilityState.disabled, true);
  }
  await act(async () => { tree.unmount(); });
});

test('Health screen is read-only until native and privacy gates pass', () => {
  const source = readFileSync(path.join(root, 'app/settings/health.tsx'), 'utf8');
  assert.match(source, /getHealthState\(token\)/);
  for (const forbidden of ['requestReadPermission(', 'requestWritePermission(', 'readDailySummaries(', 'writeWorkout(', 'enableHealthSource(', 'uploadHealthDays(']) {
    assert.equal(source.includes(forbidden), false);
  }
});
