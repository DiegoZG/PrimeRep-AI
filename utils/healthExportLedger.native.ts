import * as SQLite from 'expo-sqlite';

import type { HealthConnection } from '@/services/health/types';

export type HealthExportRecord = {
  fingerprint: string;
  version: number;
  status: 'pending' | 'exported' | 'missing';
  checked_at: number;
};

export type HealthExportStop = {
  reason: 'export-off' | 'disconnect';
  connectionRevision: number;
  exportEnabledAt: string | null;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
const optInRequests = new Set<string>();

function database() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('primerep-health-export.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS export_connections (
          user_id TEXT PRIMARY KEY NOT NULL,
          connection_revision INTEGER NOT NULL,
          server_epoch TEXT,
          enabled_at INTEGER NOT NULL,
          local_enabled_at INTEGER NOT NULL,
          active INTEGER NOT NULL,
          prepared INTEGER NOT NULL DEFAULT 0,
          pending_stop TEXT,
          pending_stop_revision INTEGER,
          pending_stop_epoch TEXT
        );
        CREATE TABLE IF NOT EXISTS exported_workouts (
          user_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          fingerprint TEXT NOT NULL,
          version INTEGER NOT NULL,
          status TEXT NOT NULL,
          checked_at INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, session_id)
        );
      `);
      try { await db.execAsync('ALTER TABLE export_connections ADD COLUMN prepared INTEGER NOT NULL DEFAULT 0'); } catch { /* already migrated */ }
      try { await db.execAsync('ALTER TABLE export_connections ADD COLUMN pending_stop TEXT'); } catch { /* already migrated */ }
      try { await db.execAsync('ALTER TABLE export_connections ADD COLUMN pending_stop_revision INTEGER'); } catch { /* already migrated */ }
      try { await db.execAsync('ALTER TABLE export_connections ADD COLUMN pending_stop_epoch TEXT'); } catch { /* already migrated */ }
      try { await db.execAsync('ALTER TABLE export_connections ADD COLUMN server_epoch TEXT'); } catch { /* already migrated */ }
      try { await db.execAsync('ALTER TABLE exported_workouts ADD COLUMN checked_at INTEGER NOT NULL DEFAULT 0'); } catch { /* already migrated */ }
      return db;
    });
  }
  return databasePromise;
}

export async function prepareHealthExport(userId: string): Promise<void> {
  optInRequests.add(userId);
  try {
    const db = await database();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO export_connections (user_id, connection_revision, enabled_at, local_enabled_at, active, prepared) VALUES (?, 0, 0, ?, 0, 1)
       ON CONFLICT(user_id) DO UPDATE SET local_enabled_at=excluded.local_enabled_at, active=0, prepared=1, pending_stop=NULL`,
      [userId, now]
    );
  } catch (error) {
    optInRequests.delete(userId);
    throw error;
  }
}

async function activateHealthExport(userId: string, connection: HealthConnection, confirmedLocally: boolean): Promise<{ server: number; local: number } | null> {
  const db = await database();
  const previous = await db.getFirstAsync<{ server_epoch: string | null; enabled_at: number; local_enabled_at: number; prepared: number; pending_stop: string | null }>(
    'SELECT server_epoch, enabled_at, local_enabled_at, prepared, pending_stop FROM export_connections WHERE user_id = ?', [userId]
  );
  if (previous?.pending_stop) return null;
  if (previous?.prepared === 1 && optInRequests.has(userId) && !confirmedLocally) return null;
  const enabledAt = connection.exportEnabledAt ? Date.parse(connection.exportEnabledAt) : NaN;
  if (!Number.isFinite(enabledAt)) return null;
  const sameEpoch = previous?.server_epoch === connection.exportEnabledAt;
  const localEnabledAt = sameEpoch && previous?.prepared !== 1 ? previous.local_enabled_at : Date.now();
  await db.runAsync(
    `INSERT INTO export_connections (user_id, connection_revision, server_epoch, enabled_at, local_enabled_at, active, prepared) VALUES (?, ?, ?, ?, ?, 1, 0)
     ON CONFLICT(user_id) DO UPDATE SET connection_revision=excluded.connection_revision, server_epoch=excluded.server_epoch, enabled_at=excluded.enabled_at, local_enabled_at=excluded.local_enabled_at, active=1, prepared=0`,
    [userId, connection.connectionRevision, connection.exportEnabledAt, enabledAt, localEnabledAt]
  );
  return { server: enabledAt, local: localEnabledAt };
}

export async function enableHealthExport(userId: string, connection: HealthConnection): Promise<{ server: number; local: number } | null> {
  return activateHealthExport(userId, connection, false);
}

export async function confirmHealthExportOptIn(userId: string, connection: HealthConnection): Promise<{ server: number; local: number } | null> {
  if (!connection.exportEnabled || !Number.isInteger(connection.connectionRevision) || !optInRequests.has(userId)) return null;
  const cutoff = await activateHealthExport(userId, connection, true);
  if (cutoff) optInRequests.delete(userId);
  return cutoff;
}

export async function requestHealthExportStop(userId: string, reason: HealthExportStop['reason'], connectionRevision: number, exportEnabledAt: string | null): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT INTO export_connections (user_id, connection_revision, enabled_at, local_enabled_at, active, prepared, pending_stop, pending_stop_revision, pending_stop_epoch)
     VALUES (?, 0, 0, 0, 0, 0, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET active=0, prepared=0, pending_stop=excluded.pending_stop,
       pending_stop_revision=excluded.pending_stop_revision, pending_stop_epoch=excluded.pending_stop_epoch`,
    [userId, reason, connectionRevision, exportEnabledAt]
  );
}

export async function getHealthExportStop(userId: string): Promise<HealthExportStop | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ pending_stop: HealthExportStop['reason'] | null; pending_stop_revision: number | null; pending_stop_epoch: string | null; connection_revision: number; server_epoch: string | null }>(
    'SELECT pending_stop, pending_stop_revision, pending_stop_epoch, connection_revision, server_epoch FROM export_connections WHERE user_id = ?', [userId]
  );
  return row?.pending_stop
    ? { reason: row.pending_stop, connectionRevision: row.pending_stop_revision ?? row.connection_revision, exportEnabledAt: row.pending_stop_epoch }
    : null;
}

export async function confirmHealthExportStop(userId: string): Promise<void> {
  const db = await database();
  await db.runAsync('UPDATE export_connections SET active=0, prepared=0, pending_stop=NULL, pending_stop_revision=NULL, pending_stop_epoch=NULL WHERE user_id = ?', [userId]);
}

export async function disableHealthExport(userId: string): Promise<void> {
  try {
    const db = await database();
    await db.runAsync('UPDATE export_connections SET active = 0, prepared = 0 WHERE user_id = ?', [userId]);
  } finally {
    optInRequests.delete(userId);
  }
}

export async function isHealthExportActive(userId: string, connectionRevision: number): Promise<boolean> {
  const db = await database();
  const row = await db.getFirstAsync<{ active: number; connection_revision: number }>(
    'SELECT active, connection_revision FROM export_connections WHERE user_id = ?', [userId]
  );
  return row?.active === 1 && row.connection_revision === connectionRevision;
}

export async function getHealthExportRecord(userId: string, sessionId: string): Promise<HealthExportRecord | null> {
  const db = await database();
  return db.getFirstAsync<HealthExportRecord>(
    'SELECT fingerprint, version, status, checked_at FROM exported_workouts WHERE user_id = ? AND session_id = ?', [userId, sessionId]
  );
}

export async function reserveHealthExport(userId: string, sessionId: string, fingerprint: string, version: number): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT INTO exported_workouts (user_id, session_id, fingerprint, version, status, checked_at) VALUES (?, ?, ?, ?, 'pending', ?)
     ON CONFLICT(user_id, session_id) DO UPDATE SET fingerprint=excluded.fingerprint, version=excluded.version, status='pending', checked_at=excluded.checked_at`,
    [userId, sessionId, fingerprint, version, Date.now()]
  );
}

export async function confirmHealthExport(userId: string, sessionId: string, fingerprint: string, version: number): Promise<void> {
  const db = await database();
  await db.runAsync(
    `UPDATE exported_workouts SET status = 'exported', checked_at = ? WHERE user_id = ? AND session_id = ? AND fingerprint = ? AND version = ?`,
    [Date.now(), userId, sessionId, fingerprint, version]
  );
}

export async function markHealthExportChecked(userId: string, sessionId: string): Promise<void> {
  const db = await database();
  await db.runAsync('UPDATE exported_workouts SET checked_at = ? WHERE user_id = ? AND session_id = ?', [Date.now(), userId, sessionId]);
}

export async function markHealthExportMissing(userId: string, sessionId: string): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT INTO exported_workouts (user_id, session_id, fingerprint, version, status, checked_at) VALUES (?, ?, '', 0, 'missing', ?)
     ON CONFLICT(user_id, session_id) DO UPDATE SET status='missing', checked_at=excluded.checked_at`,
    [userId, sessionId, Date.now()]
  );
}

export async function clearHealthExportAccount(userId: string): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM exported_workouts WHERE user_id = ?', [userId]);
    await db.runAsync('DELETE FROM export_connections WHERE user_id = ?', [userId]);
  });
}
