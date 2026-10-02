import { requestJson } from '@/services/httpClient';
import type { HealthConnection, HealthDailySummary, HealthSourceName, HealthState } from '@/services/health/types';

export function getHealthState(token: string) {
  return requestJson<HealthState>('/v1/users/me/health', { token });
}

export function setAppleHealthSource(token: string, readEnabled: boolean, exportEnabled = false) {
  return requestJson<HealthConnection>('/v1/users/me/health/sources', {
    token, method: 'POST', body: { source: 'apple_health', readEnabled, exportEnabled },
  });
}

export function setHealthPreferences(token: string, primarySource: HealthSourceName | null, coachEnabled: boolean) {
  return requestJson<HealthState>('/v1/users/me/health/preferences', {
    token, method: 'PUT', body: { primarySource, coachEnabled },
  });
}

export function uploadHealthDays(token: string, connectionRevision: number, days: HealthDailySummary[], timeZone: string, startDate: string, endDate: string) {
  return requestJson<{ acceptedDays: number; lastSuccessfulSyncAt: string }>('/v1/users/me/health/days', {
    token, method: 'PUT', body: {
      source: 'apple_health', connectionRevision, days,
      replaceWindow: { startDate, endDate, timeZone },
    },
  });
}

export function disconnectHealthSource(token: string) {
  return requestJson<null>('/v1/users/me/health/sources/apple_health', { token, method: 'DELETE' });
}
