import { requestJson } from '@/services/httpClient';
import type { HealthState } from '@/services/health/types';

export function getHealthState(token: string) {
  return requestJson<HealthState>('/v1/users/me/health', { token });
}
