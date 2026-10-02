import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import typescript from 'typescript';

const source = readFileSync(fileURLToPath(new URL('../services/health/aggregation.ts', import.meta.url)), 'utf8');
const compiled = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 } }).outputText;
const { asleepMinutesByWakeDate, dayKeys, localDateKey, localMidnight, nextDateKey } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const adapterSource = readFileSync(fileURLToPath(new URL('../services/health/appleHealthAdapter.ios.ts', import.meta.url)), 'utf8');

function loadAppleAdapter() {
  const calls = { authorizationRequests: [], savedWorkouts: [], settingsOpened: 0 };
  const healthkit = {
    AuthorizationStatus: { sharingAuthorized: 2, sharingDenied: 1 },
    WorkoutActivityType: { traditionalStrengthTraining: 1, crossTraining: 2, other: 3 },
    authorizationStatusFor: () => 2,
    isHealthDataAvailableAsync: async () => true,
    queryCategorySamples: async () => [],
    queryStatisticsForQuantity: async () => ({ sumQuantity: { quantity: 42 } }),
    requestAuthorization: async (types) => { calls.authorizationRequests.push(types); return true; },
    saveWorkoutSample: async (...args) => { calls.savedWorkouts.push(args); },
  };
  const reactNative = { Linking: { openSettings: async () => { calls.settingsOpened += 1; } } };
  const aggregation = { asleepMinutesByWakeDate, dayKeys, localMidnight, nextDateKey };
  const output = typescript.transpileModule(adapterSource, { compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  runInNewContext(output, {
    module,
    exports: module.exports,
    require: (id) => {
      if (id === '@kingstinct/react-native-healthkit') return healthkit;
      if (id === 'react-native') return reactNative;
      if (id === './aggregation') return aggregation;
      throw new Error(`Unexpected module: ${id}`);
    },
  });
  return { adapter: module.exports.appleHealthAdapter, calls };
}

test('local-day boundaries honor DST and the supplied timezone', () => {
  const zone = 'America/New_York';
  assert.equal(localMidnight('2026-03-08', zone).toISOString(), '2026-03-08T05:00:00.000Z');
  assert.equal(localMidnight('2026-03-09', zone).toISOString(), '2026-03-09T04:00:00.000Z');
  assert.equal(localDateKey(new Date('2026-03-09T03:59:59Z'), zone), '2026-03-08');
  assert.deepEqual(dayKeys('2026-03-08', '2026-03-10'), ['2026-03-08', '2026-03-09', '2026-03-10']);
});

test('sleep excludes awake/in-bed records and unions overlapping stages by wake date', () => {
  const sample = (value, start, end) => ({ value, startDate: new Date(start), endDate: new Date(end) });
  const totals = asleepMinutesByWakeDate([
    sample(0, '2026-03-08T04:00:00Z', '2026-03-08T08:00:00Z'),
    sample(3, '2026-03-08T06:00:00Z', '2026-03-08T07:00:00Z'),
    sample(4, '2026-03-08T06:30:00Z', '2026-03-08T07:30:00Z'),
    sample(2, '2026-03-08T07:30:00Z', '2026-03-08T08:00:00Z'),
  ], '2026-03-08', '2026-03-08', 'America/New_York');
  assert.equal(totals.get('2026-03-08'), 90);
  assert.equal(totals.size, 1);
});

test('sleep stages before midnight follow the final wake date', () => {
  const sample = (start, end) => ({ value: 3, startDate: new Date(start), endDate: new Date(end) });
  const totals = asleepMinutesByWakeDate([
    sample('2026-05-02T02:00:00Z', '2026-05-02T03:00:00Z'),
    sample('2026-05-02T04:00:00Z', '2026-05-02T10:00:00Z'),
  ], '2026-05-01', '2026-05-02', 'America/New_York');
  assert.equal(totals.get('2026-05-01'), undefined);
  assert.equal(totals.get('2026-05-02'), 420);
});

test('Apple Health reads after adapter restart without a process-local authorization flag', async () => {
  const { adapter, calls } = loadAppleAdapter();
  const permissions = await adapter.getPermissions();
  assert.equal(permissions.readSteps, 'unknown');
  assert.equal(permissions.readSleep, 'unknown');
  const days = await adapter.readDailySummaries('2026-03-08', '2026-03-08', 'America/New_York');
  assert.equal(calls.authorizationRequests.length, 0);
  assert.equal(days.length, 1);
  assert.equal(days[0].steps, 42);
});

test('Apple Health writes raw sync keys and preserves the PrimeRep title as custom metadata', async () => {
  const { adapter, calls } = loadAppleAdapter();
  await adapter.writeWorkout({
    sessionId: 'session-123',
    version: 4,
    startTime: '2026-03-08T16:00:00Z',
    endTime: '2026-03-08T16:45:00Z',
    title: 'Upper A',
    activityType: 'strength',
  });
  assert.equal(calls.savedWorkouts.length, 1);
  const metadata = calls.savedWorkouts[0][5];
  assert.equal(metadata.HKSyncIdentifier, 'primerep:session-123');
  assert.equal(metadata.HKSyncVersion, 4);
  assert.equal(metadata.HKWorkoutBrandName, 'PrimeRep');
  assert.equal(metadata['com.primerep.workout.title'], 'Upper A');
  assert.equal(metadata.HKMetadataKeySyncIdentifier, undefined);
});

test('Apple Health settings action opens PrimeRep app settings', async () => {
  const { adapter, calls } = loadAppleAdapter();
  await adapter.openAppSettings();
  assert.equal(calls.settingsOpened, 1);
});
