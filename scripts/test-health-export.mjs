import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function load(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(output, {
    module, exports: module.exports,
    require: (name) => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import ${name}`);
    },
    Date, JSON, Promise, Set, Map,
  }, { filename });
  return module.exports;
}

const policy = load('services/health/exportPolicy.ts');
const completed = (id, completedAt, types = ['strength']) => ({
  id, status: 'completed', startedAt: '2026-10-01T12:00:00Z', completedAt,
  summary: { title: 'Upper A' },
  workoutSnapshot: { exerciseBlocks: [{ items: types.map((exerciseType) => ({ exercise: { exerciseType } })) }] },
});

test('export payload uses canonical time/title and snapshot classification without private workout details', () => {
  const mixed = policy.workoutExportFromSession(completed('s1', '2026-10-01T12:30:00Z', ['strength', 'cardio']));
  assert.equal(mixed.activityType, 'mixed');
  assert.equal(mixed.title, 'Upper A');
  assert.equal(mixed.startTime, '2026-10-01T12:00:00Z');
  assert.equal(mixed.endTime, '2026-10-01T12:30:00Z');
  assert.equal('sets' in mixed, false);
  assert.equal('calories' in mixed, false);
  assert.equal(policy.workoutExportFromSession(completed('s2', '2026-10-01T12:30:00Z', ['bodyweight'])).activityType, 'strength');
  assert.equal(policy.workoutExportFromSession(completed('s3', '2026-10-01T12:30:00Z', ['cardio'])).activityType, 'other');
  assert.equal(policy.workoutExportFromSession(completed('s4', '2026-10-01T12:30:00Z', ['unknown'])).activityType, 'other');
  assert.equal(policy.workoutExportFromSession({ ...completed('s5', '2026-10-01T12:30:00Z'), status: 'in_progress' }), null);
});

function harness() {
  const cutoff = Date.parse('2026-10-01T12:10:00Z');
  const source = { source: 'apple_health', readEnabled: false, exportEnabled: true, connectionRevision: 4, connectedAt: '2026-10-01T12:10:00Z', exportEnabledAt: '2026-10-01T12:10:00Z' };
  const state = { collectionAvailable: true, sources: [source] };
  const sessions = {
    old: completed('old', '2026-10-01T12:30:00Z'),
    new: completed('new', '2026-10-01T12:30:00Z'),
    pending: { ...completed('pending', '2026-10-01T12:30:00Z'), status: 'in_progress' },
  };
  const records = new Map();
  const written = [];
  let failWrite = false;
  let permission = 'granted';
  const fetched = [];
  const statuses = new Map();
  const mocks = {
    './appleHealthAdapter': { appleHealthAdapter: {
      availability: async () => 'available', getPermissions: async () => ({ writeWorkout: permission }),
      writeWorkout: async (workout) => { written.push(workout); if (failWrite) throw new Error('transient'); },
    } },
    './exportPolicy': policy,
    './exportStatus': {
      getHealthExportSyncStatus: (userId) => statuses.get(userId) ?? null,
      setHealthExportSyncStatus: (userId, status) => { if (status === null) statuses.delete(userId); else statuses.set(userId, status); },
    },
    '@/services/healthService': { getHealthState: async () => state, setAppleHealthSource: async () => {}, disconnectHealthSource: async () => {} },
    '@/services/httpClient': { HttpError: class HttpError extends Error { constructor(message, status) { super(message); this.status = status; } } },
    '@/services/workoutLoggingService': { getSession: async (_token, id) => { fetched.push(id); if (id === 'missing') throw new mocks['@/services/httpClient'].HttpError('missing', 404); return sessions[id]; } },
    '@/utils/activeWorkoutStore': { healthExportCandidates: async (_user, since) => [
      { sessionId: 'old', startedAt: cutoff - 600_000, finishedAt: cutoff - 300_000 },
      { sessionId: 'pending', startedAt: cutoff + 60_000, finishedAt: cutoff + 300_000 },
      { sessionId: 'new', startedAt: cutoff + 60_000, finishedAt: cutoff + 300_000 },
    ].filter((item) => item.finishedAt >= since) },
    '@/utils/healthExportLedger.native': {
      enableHealthExport: async () => ({ server: cutoff, local: cutoff }),
      disableHealthExport: async () => {},
      getHealthExportStop: async () => null,
      confirmHealthExportStop: async () => {},
      requestHealthExportStop: async () => {},
      isHealthExportActive: async () => true,
      getHealthExportRecord: async (_user, id) => records.get(id) ?? null,
      reserveHealthExport: async (_user, id, fingerprint, version) => { records.set(id, { fingerprint, version, status: 'pending', checked_at: Date.now() }); },
      confirmHealthExport: async (_user, id, fingerprint, version) => { records.set(id, { fingerprint, version, status: 'exported', checked_at: Date.now() }); },
      markHealthExportChecked: async (_user, id) => { records.get(id).checked_at = Date.now(); },
      markHealthExportMissing: async (_user, id) => { records.set(id, { fingerprint: '', version: 0, status: 'missing', checked_at: Date.now() }); },
    },
  };
  return { state, sessions, records, written, fetched, statuses, mocks, setFailWrite: (value) => { failWrite = value; }, setPermission: (value) => { permission = value; } };
}

test('reconciliation excludes pre-opt-in offline finishes replayed later and does not duplicate on restart', async () => {
  const h = harness();
  await load('services/health/exportSync.ios.ts', h.mocks).reconcileAppleHealthExport('token', 'user');
  assert.deepEqual(h.written.map((workout) => workout.sessionId), ['new']);
  assert.equal(h.written[0].startTime, '2026-10-01T12:11:00.000Z');
  assert.equal(h.written[0].endTime, '2026-10-01T12:15:00.000Z');
  await load('services/health/exportSync.ios.ts', h.mocks).reconcileAppleHealthExport('token', 'user');
  assert.equal(h.written.length, 1);
  h.sessions.new.summary.title = 'Updated title';
  h.records.get('new').checked_at = 0;
  await load('services/health/exportSync.ios.ts', h.mocks).reconcileAppleHealthExport('token', 'user');
  assert.equal(h.written.at(-1).version, 2);
});

test('failed writes keep the same version for retries and revocation stops new writes', async () => {
  const h = harness();
  const worker = load('services/health/exportSync.ios.ts', h.mocks);
  h.setFailWrite(true);
  await assert.rejects(worker.reconcileAppleHealthExport('token', 'user'), /transient/);
  assert.equal(h.records.get('new').status, 'pending');
  h.setFailWrite(false);
  await worker.reconcileAppleHealthExport('token', 'user');
  assert.deepEqual(h.written.map((workout) => workout.version), [1, 1]);
  h.setPermission('denied');
  h.sessions.new.summary.title = 'Changed';
  await worker.reconcileAppleHealthExport('token', 'user');
  assert.equal(h.written.length, 2);
  h.setPermission('granted');
  h.state.sources = [];
  await worker.reconcileAppleHealthExport('token', 'user');
  assert.equal(h.written.length, 2);
});

test('missing canonical sessions do not starve later exports and exported backlog is not refetched each foreground', async () => {
  const h = harness();
  const now = Date.now();
  const cutoff = Date.parse('2026-10-01T12:10:00Z');
  for (let index = 0; index < 50; index += 1) {
    h.records.set(`exported-${index}`, { fingerprint: 'done', version: 1, status: 'exported', checked_at: now });
  }
  h.mocks['@/utils/activeWorkoutStore'].healthExportCandidates = async () => [
    ...Array.from({ length: 50 }, (_, index) => ({ sessionId: `exported-${index}`, startedAt: cutoff, finishedAt: cutoff + 1 })),
    { sessionId: 'missing', startedAt: cutoff + 1, finishedAt: cutoff + 2 },
    { sessionId: 'new', startedAt: cutoff + 1, finishedAt: cutoff + 2 },
  ];
  const worker = load('services/health/exportSync.ios.ts', h.mocks);
  await worker.reconcileAppleHealthExport('token', 'user');
  assert.deepEqual(h.fetched, ['missing', 'new']);
  assert.deepEqual(h.written.map((item) => item.sessionId), ['new']);
  assert.equal(h.records.get('missing').status, 'missing');
  await worker.reconcileAppleHealthExport('token', 'user');
  assert.deepEqual(h.fetched, ['missing', 'new']);
});

test('failed opt-out stays suppressed and retries server revocation before any workout export', async () => {
  const h = harness();
  h.state.sources[0].readEnabled = true;
  let pendingStop = { reason: 'export-off', connectionRevision: 4, exportEnabledAt: h.state.sources[0].exportEnabledAt };
  h.state.collectionAvailable = false;
  let revocations = 0;
  let fail = true;
  h.mocks['@/utils/healthExportLedger.native'].getHealthExportStop = async () => pendingStop;
  h.mocks['@/utils/healthExportLedger.native'].confirmHealthExportStop = async () => { pendingStop = null; };
  h.mocks['@/services/healthService'].setAppleHealthSource = async (_token, read, exportWorkouts, revision) => {
    assert.equal(read, true);
    assert.equal(exportWorkouts, false);
    assert.equal(revision, 4);
    revocations += 1;
    if (fail) throw new Error('offline');
    h.state.sources = [];
  };
  const worker = load('services/health/exportSync.ios.ts', h.mocks);
  await assert.rejects(worker.reconcileAppleHealthExport('token', 'user'), /offline/);
  assert.equal(h.statuses.get('user'), 'export-off-pending');
  assert.equal(pendingStop.reason, 'export-off');
  assert.equal(h.written.length, 0);
  fail = false;
  await worker.reconcileAppleHealthExport('token', 'user');
  assert.equal(h.statuses.get('user'), undefined);
  assert.equal(revocations, 2);
  assert.equal(pendingStop, null);
  assert.equal(h.written.length, 0);
});

test('stale offline stop does not revoke a newer cross-device export consent', async () => {
  const h = harness();
  h.state.sources[0].connectionRevision = 8;
  h.state.sources[0].exportEnabledAt = '2026-10-02T13:00:00Z';
  h.mocks['@/utils/healthExportLedger.native'].getHealthExportStop = async () => ({
    reason: 'export-off', connectionRevision: 4, exportEnabledAt: '2026-10-01T12:10:00Z',
  });
  h.mocks['@/services/healthService'].setAppleHealthSource = async () => { throw new Error('must not revoke newer consent'); };
  const worker = load('services/health/exportSync.ios.ts', h.mocks);
  await worker.reconcileAppleHealthExport('token', 'user');
  assert.equal(h.written.length, 0);
  assert.equal(h.statuses.get('user'), 'connection-changed');
});

test('read-only disconnect retries with an intentional null epoch after earlier export opt-out', async () => {
  let row = {
    connection_revision: 4, server_epoch: '2026-10-01T12:10:00Z',
    pending_stop: null, pending_stop_revision: null, pending_stop_epoch: null,
  };
  const db = {
    execAsync: async () => {},
    getFirstAsync: async () => ({ ...row }),
    runAsync: async (sql, params) => {
      if (sql.startsWith('INSERT INTO export_connections')) {
        row = { ...row, pending_stop: params[1], pending_stop_revision: params[2], pending_stop_epoch: params[3], active: 0, prepared: 0 };
      } else if (sql.startsWith('UPDATE export_connections')) {
        row = { ...row, pending_stop: null, pending_stop_revision: null, pending_stop_epoch: null, active: 0, prepared: 0 };
      }
    },
  };
  const ledger = load('utils/healthExportLedger.native.ts', { 'expo-sqlite': { openDatabaseAsync: async () => db } });
  await ledger.requestHealthExportStop('user', 'export-off', 4, row.server_epoch);
  await ledger.confirmHealthExportStop('user');
  await ledger.requestHealthExportStop('user', 'disconnect', 5, null);
  const stop = await ledger.getHealthExportStop('user');
  assert.equal(stop.exportEnabledAt, null);
  assert.equal(stop.connectionRevision, 5);

  const h = harness();
  h.state.collectionAvailable = false;
  h.state.sources[0] = { ...h.state.sources[0], readEnabled: true, exportEnabled: false, connectionRevision: 5, exportEnabledAt: null };
  h.mocks['@/utils/healthExportLedger.native'].getHealthExportStop = ledger.getHealthExportStop;
  h.mocks['@/utils/healthExportLedger.native'].confirmHealthExportStop = ledger.confirmHealthExportStop;
  let disconnects = 0;
  h.mocks['@/services/healthService'].disconnectHealthSource = async (_token, revision) => {
    assert.equal(revision, 5);
    disconnects += 1;
    h.state.sources = [];
  };
  await load('services/health/exportSync.ios.ts', h.mocks).reconcileAppleHealthExport('token', 'user');
  assert.equal(disconnects, 1);
  assert.equal(await ledger.getHealthExportStop('user'), null);
  assert.equal(h.written.length, 0);
});

test('failed server disconnect is identified as pending revocation', async () => {
  const h = harness();
  h.mocks['@/utils/healthExportLedger.native'].getHealthExportStop = async () => ({
    reason: 'disconnect', connectionRevision: 4, exportEnabledAt: h.state.sources[0].exportEnabledAt,
  });
  h.mocks['@/services/healthService'].disconnectHealthSource = async () => { throw new Error('offline'); };
  const worker = load('services/health/exportSync.ios.ts', h.mocks);
  await assert.rejects(worker.reconcileAppleHealthExport('token', 'user'), /offline/);
  assert.equal(h.statuses.get('user'), 'disconnect-pending');
});

test('durable opt-in intent survives a revision-only read change without moving the export cutoff', async () => {
  let row = null;
  const db = {
    execAsync: async () => {},
    getFirstAsync: async () => row && { ...row },
    runAsync: async (sql, params) => {
      if (sql.startsWith('INSERT INTO export_connections')) {
        if (sql.includes('pending_stop_revision')) {
          row = { ...row, user_id: params[0], pending_stop: params[1], pending_stop_revision: params[2], pending_stop_epoch: params[3], active: 0, prepared: 0 };
        } else if (params.length === 2) {
          row = { user_id: params[0], connection_revision: 0, enabled_at: 0, local_enabled_at: params[1], active: 0, prepared: 1 };
        } else {
          const [userId, revision, serverEpoch, enabledAt, localEnabledAt] = params;
          row = { user_id: userId, connection_revision: revision, server_epoch: serverEpoch, enabled_at: enabledAt, local_enabled_at: localEnabledAt, active: 1, prepared: 0 };
        }
      } else if (sql.startsWith('UPDATE export_connections')) {
        row = { ...row, active: 0, prepared: 0,
          pending_stop: sql.includes('pending_stop=NULL') ? null : row.pending_stop,
          pending_stop_revision: sql.includes('pending_stop_revision=NULL') ? null : row.pending_stop_revision,
          pending_stop_epoch: sql.includes('pending_stop_epoch=NULL') ? null : row.pending_stop_epoch };
      }
    },
  };
  const ledger = load('utils/healthExportLedger.native.ts', { 'expo-sqlite': { openDatabaseAsync: async () => db } });
  const source = { source: 'apple_health', connectionRevision: 2, connectedAt: '2026-10-01T12:10:00Z', exportEnabledAt: '2026-10-01T12:10:00Z' };
  await ledger.prepareHealthExport('user');
  assert.equal(row.prepared, 1);
  const preparedAt = row.local_enabled_at;
  assert.equal(await ledger.enableHealthExport('user', source), null);
  assert.equal(row.prepared, 1);
  await new Promise((resolve) => setTimeout(resolve, 2));
  await ledger.confirmHealthExportOptIn('user', { ...source, exportEnabled: true });
  assert.equal(row.prepared, 0);
  assert.ok(row.local_enabled_at > preparedAt);
  assert.equal(row.server_epoch, source.exportEnabledAt);
  assert.equal(row.connection_revision, source.connectionRevision);
  assert.ok(row.local_enabled_at >= Date.parse(source.connectedAt));
  const cutoff = row.local_enabled_at;
  await ledger.enableHealthExport('user', { ...source, connectionRevision: 3, connectedAt: '2026-10-02T12:10:00Z' });
  assert.equal(row.local_enabled_at, cutoff);
  assert.equal(row.connection_revision, 3);
  await ledger.disableHealthExport('user');
  assert.equal(row.active, 0);
  await ledger.requestHealthExportStop('user', 'export-off', 3, source.exportEnabledAt);
  assert.equal(JSON.stringify(await ledger.getHealthExportStop('user')), JSON.stringify({ reason: 'export-off', connectionRevision: 3, exportEnabledAt: source.exportEnabledAt }));
  assert.equal(await ledger.enableHealthExport('user', { ...source, connectionRevision: 4 }), null);
  await ledger.confirmHealthExportStop('user');
  assert.equal(await ledger.getHealthExportStop('user'), null);
  await ledger.enableHealthExport('user', { ...source, connectionRevision: 4 });
  assert.equal(row.local_enabled_at, cutoff);
  const nextEpoch = '2026-10-03T12:10:00Z';
  const observedAt = Date.now();
  await ledger.enableHealthExport('user', { ...source, connectionRevision: 5, exportEnabledAt: nextEpoch });
  assert.ok(row.local_enabled_at >= observedAt && row.local_enabled_at <= Date.now());
  assert.notEqual(row.local_enabled_at, Date.parse(nextEpoch));
  await ledger.prepareHealthExport('user');
  assert.equal(await ledger.enableHealthExport('user', { ...source, connectionRevision: 6, exportEnabledAt: nextEpoch }), null);
  await ledger.disableHealthExport('user');
  assert.equal(row.prepared, 0);
  const afterFailure = Date.now();
  await ledger.enableHealthExport('user', { ...source, connectionRevision: 7, exportEnabledAt: '2026-10-04T12:10:00Z' });
  assert.ok(row.local_enabled_at >= afterFailure && row.local_enabled_at <= Date.now());
});
