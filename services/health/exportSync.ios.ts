import { appleHealthAdapter } from './appleHealthAdapter';
import { workoutExportFingerprint, workoutExportFromSession } from './exportPolicy';
import { getHealthExportSyncStatus, setHealthExportSyncStatus } from './exportStatus';
import { disconnectHealthSource, getHealthState, setAppleHealthSource } from '@/services/healthService';
import { HttpError } from '@/services/httpClient';
import { getSession } from '@/services/workoutLoggingService';
import { healthExportCandidates } from '@/utils/activeWorkoutStore';
import {
  confirmHealthExport,
  disableHealthExport,
  enableHealthExport,
  getHealthExportRecord,
  getHealthExportStop,
  isHealthExportActive,
  markHealthExportChecked,
  markHealthExportMissing,
  prepareHealthExport,
  reserveHealthExport,
  confirmHealthExportStop,
  requestHealthExportStop,
} from '@/utils/healthExportLedger.native';
import type { HealthExportSyncStatus } from './exportStatus';

let serial: Promise<void> = Promise.resolve();
const pausedUsers = new Set<string>();

export function pauseHealthExport(userId: string): void { pausedUsers.add(userId); }
export function resumeHealthExport(userId: string): void { pausedUsers.delete(userId); }
export async function waitForHealthExportIdle(): Promise<void> { await serial; }
export { requestHealthExportStop };
export { getHealthExportStop };

async function reconcile(token: string, userId: string, isCurrent: () => boolean): Promise<void> {
  if (!isCurrent() || pausedUsers.has(userId)) return;
  const state = await getHealthState(token);
  if (!isCurrent() || pausedUsers.has(userId)) return;
  const pendingStop = await getHealthExportStop(userId);
  if (pendingStop) {
    const current = state.sources.find((item) => item.source === 'apple_health');
    if (!current || (pendingStop.reason === 'export-off' && !current.exportEnabled)) {
      await confirmHealthExportStop(userId);
      setHealthExportSyncStatus(userId, null);
      return;
    }
    const sameEpoch = current.exportEnabledAt === pendingStop.exportEnabledAt;
    const sameRevision = current.connectionRevision === pendingStop.connectionRevision;
    if (!sameEpoch || (pendingStop.reason === 'disconnect' || pendingStop.exportEnabledAt === null) && !sameRevision) {
      setHealthExportSyncStatus(userId, 'connection-changed');
      return;
    }
    if (pendingStop.reason === 'disconnect' || !current.readEnabled) {
      await disconnectHealthSource(token, current.connectionRevision);
    } else {
      await setAppleHealthSource(token, current.readEnabled, false, current.connectionRevision);
    }
    if (!isCurrent() || pausedUsers.has(userId)) return;
    await confirmHealthExportStop(userId);
    setHealthExportSyncStatus(userId, null);
    return;
  }
  setHealthExportSyncStatus(userId, null);
  if (!state.collectionAvailable) return;
  const source = state.sources.find((item) => item.source === 'apple_health' && item.exportEnabled);
  if (!source) {
    await disableHealthExport(userId);
    return;
  }
  const cutoff = await enableHealthExport(userId, source);
  if (!cutoff) return;
  if (await appleHealthAdapter.availability() !== 'available' || !isCurrent()) return;
  if ((await appleHealthAdapter.getPermissions()).writeWorkout !== 'granted' || !isCurrent()) return;

  const candidates = await healthExportCandidates(userId, cutoff.local);
  let checkedExported = 0;
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!isCurrent() || pausedUsers.has(userId)) return;
    const { sessionId } = candidate;
    if (seen.has(sessionId)) continue;
    seen.add(sessionId);
    const existing = await getHealthExportRecord(userId, sessionId);
    if (existing?.status === 'exported') {
      if (Date.now() - (existing.checked_at ?? 0) < 24 * 60 * 60 * 1000 || checkedExported >= 10) continue;
      checkedExported += 1;
    }
    if (existing?.status === 'missing' && Date.now() - (existing.checked_at ?? 0) < 24 * 60 * 60 * 1000) continue;
    let canonical;
    try {
      canonical = await getSession(token, sessionId);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        await markHealthExportMissing(userId, sessionId);
        continue;
      }
      throw error;
    }
    if (!isCurrent()) return;
    if (canonical.status !== 'completed') continue;
    const workout = workoutExportFromSession(canonical, candidate);
    if (!workout) continue;
    const fingerprint = workoutExportFingerprint(workout);
    if (existing?.status === 'exported' && existing.fingerprint === fingerprint) {
      await markHealthExportChecked(userId, sessionId);
      continue;
    }
    const fresh = await getHealthState(token);
    const currentSource = fresh.sources.find((item) => item.source === 'apple_health' && item.exportEnabled);
    if (!isCurrent() || !fresh.collectionAvailable || currentSource?.connectionRevision !== source.connectionRevision || currentSource?.exportEnabledAt !== source.exportEnabledAt) return;
    if ((await appleHealthAdapter.getPermissions()).writeWorkout !== 'granted' || !isCurrent()) return;
    workout.version = existing?.fingerprint === fingerprint ? existing.version : (existing?.version ?? 0) + 1;
    await reserveHealthExport(userId, sessionId, fingerprint, workout.version);
    if (!isCurrent() || pausedUsers.has(userId) || !(await isHealthExportActive(userId, source.connectionRevision))) return;
    await appleHealthAdapter.writeWorkout(workout);
    await confirmHealthExport(userId, sessionId, fingerprint, workout.version);
  }
}

export function reconcileAppleHealthExport(token: string, userId: string, isCurrent: () => boolean = () => true): Promise<void> {
  const task = serial.then(() => reconcile(token, userId, isCurrent)).catch(async (error) => {
    if (isCurrent() && getHealthExportSyncStatus(userId) !== 'connection-changed') {
      let status: HealthExportSyncStatus = 'retry';
      try {
        const pendingStop = await getHealthExportStop(userId);
        if (pendingStop) status = pendingStop.reason === 'disconnect' ? 'disconnect-pending' : 'export-off-pending';
      } catch {}
      if (isCurrent()) setHealthExportSyncStatus(userId, status);
    }
    throw error;
  });
  serial = task.catch(() => undefined);
  return task;
}

export { disableHealthExport } from '@/utils/healthExportLedger.native';
export { prepareHealthExport } from '@/utils/healthExportLedger.native';
export { confirmHealthExportOptIn } from '@/utils/healthExportLedger.native';
