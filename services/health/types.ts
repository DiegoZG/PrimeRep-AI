export type HealthAccessStatus = 'granted' | 'denied' | 'unknown';

export type HealthPermissionState = {
  readSteps: HealthAccessStatus;
  readSleep: HealthAccessStatus;
  writeWorkout: HealthAccessStatus;
};

export type HealthDailySummary = {
  localDate: string;
  timeZone: string;
  steps: number | null;
  asleepMinutes: number | null;
};

export type HealthWorkoutExport = {
  sessionId: string;
  version: number;
  startTime: string;
  endTime: string;
  title: string;
  activityType: 'strength' | 'mixed' | 'other';
};

export type HealthAdapter = {
  availability(): Promise<'available' | 'unsupported' | 'update-required'>;
  getPermissions(): Promise<HealthPermissionState>;
  requestReadPermission(): Promise<HealthPermissionState>;
  requestWritePermission(): Promise<HealthPermissionState>;
  readDailySummaries(startDate: string, endDate: string, timeZone: string): Promise<HealthDailySummary[]>;
  writeWorkout(workout: HealthWorkoutExport): Promise<void>;
  openAppSettings(): Promise<void>;
};

export type HealthSourceName = 'apple_health' | 'health_connect';

export type HealthConnection = {
  source: HealthSourceName;
  connectionRevision: number;
  readEnabled: boolean;
  exportEnabled: boolean;
  exportEnabledAt: string | null;
  connectedAt: string;
  lastSuccessfulSyncAt: string | null;
};

export type HealthState = {
  collectionAvailable: boolean;
  sources: HealthConnection[];
  sourceRevisions: Partial<Record<HealthSourceName, number>>;
  primarySource: HealthSourceName | null;
  coachEnabled: boolean;
  days: (HealthDailySummary & { source: HealthSourceName })[];
};
