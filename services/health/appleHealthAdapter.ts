import type { HealthAdapter } from './types';

export const appleHealthAdapter: HealthAdapter = {
  async availability() { return 'unsupported'; },
  async getPermissions() { return { readSteps: 'unknown', readSleep: 'unknown', writeWorkout: 'unknown' }; },
  async requestReadPermission() { throw new Error('Apple Health requires an iOS native build'); },
  async requestWritePermission() { throw new Error('Apple Health requires an iOS native build'); },
  async readDailySummaries() { throw new Error('Apple Health requires an iOS native build'); },
  async writeWorkout() { throw new Error('Apple Health requires an iOS native build'); },
  async openAppSettings() { throw new Error('Apple Health requires an iOS native build'); },
};
