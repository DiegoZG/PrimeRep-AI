import { appleHealthAdapter } from './appleHealthAdapter';
import { dayKeys, localDateKey } from './aggregation';
import type { HealthConnection, HealthDailySummary } from './types';
import { uploadHealthDays } from '@/services/healthService';

const timeZoneForDevice = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const readWindow = (now: Date, timeZone: string) => {
  const endDate = localDateKey(now, timeZone);
  const endTime = Date.parse(`${endDate}T00:00:00Z`);
  const startDate = new Date(endTime - 29 * 86_400_000).toISOString().slice(0, 10);
  return { startDate, endDate, timeZone };
};

const validDay = (day: HealthDailySummary): HealthDailySummary => ({
  ...day,
  steps: day.steps === null || !Number.isFinite(day.steps) || day.steps < 0 || day.steps > 2_147_483_647 ? null : Math.round(day.steps),
  asleepMinutes: day.asleepMinutes === null || !Number.isFinite(day.asleepMinutes) || day.asleepMinutes < 0 || day.asleepMinutes > 1440 ? null : Math.round(day.asleepMinutes),
});

export async function syncAppleHealthRead(token: string, connection: HealthConnection, isCurrent: () => boolean, now = new Date()) {
  if (!connection.readEnabled || !isCurrent()) return false;
  if (await appleHealthAdapter.availability() !== 'available') throw new Error('Apple Health is unavailable on this device');
  const window = readWindow(now, timeZoneForDevice());
  const summaries = await appleHealthAdapter.readDailySummaries(window.startDate, window.endDate, window.timeZone);
  if (!isCurrent()) return false;
  const byDate = new Map(summaries.map((day) => [day.localDate, day]));
  const days = dayKeys(window.startDate, window.endDate).map((localDate) => validDay(byDate.get(localDate) ?? {
    localDate, timeZone: window.timeZone, steps: null, asleepMinutes: null,
  }));
  if (!isCurrent()) return false;
  const hasData = days.some((day) => day.steps !== null || day.asleepMinutes !== null);
  if (!hasData) return false;
  await uploadHealthDays(token, connection.connectionRevision, days, window.timeZone, window.startDate, window.endDate);
  return true;
}
