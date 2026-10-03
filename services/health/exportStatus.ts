export type HealthExportSyncStatus = 'retry' | 'export-off-pending' | 'disconnect-pending' | 'connection-changed' | null;

const statuses = new Map<string, HealthExportSyncStatus>();
const listeners = new Map<string, Set<(status: HealthExportSyncStatus) => void>>();

export function getHealthExportSyncStatus(userId: string): HealthExportSyncStatus {
  return statuses.get(userId) ?? null;
}

export function setHealthExportSyncStatus(userId: string, status: HealthExportSyncStatus): void {
  if (getHealthExportSyncStatus(userId) === status) return;
  if (status === null) statuses.delete(userId);
  else statuses.set(userId, status);
  listeners.get(userId)?.forEach((listener) => listener(status));
}

export function subscribeHealthExportSyncStatus(userId: string, listener: (status: HealthExportSyncStatus) => void): () => void {
  let accountListeners = listeners.get(userId);
  if (!accountListeners) {
    accountListeners = new Set();
    listeners.set(userId, accountListeners);
  }
  accountListeners.add(listener);
  listener(getHealthExportSyncStatus(userId));
  return () => {
    accountListeners?.delete(listener);
    if (accountListeners?.size === 0) listeners.delete(userId);
  };
}
