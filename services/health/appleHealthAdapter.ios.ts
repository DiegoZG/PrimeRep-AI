import {
  AuthorizationStatus,
  WorkoutActivityType,
  authorizationStatusFor,
  isHealthDataAvailableAsync,
  queryCategorySamples,
  queryStatisticsForQuantity,
  requestAuthorization,
  saveWorkoutSample,
} from '@kingstinct/react-native-healthkit';
import { Linking } from 'react-native';

import { asleepMinutesByWakeDate, dayKeys, localMidnight, nextDateKey } from './aggregation';
import type { HealthAdapter, HealthPermissionState, HealthWorkoutExport } from './types';

const STEPS = 'HKQuantityTypeIdentifierStepCount' as const;
const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis' as const;
const WORKOUT = 'HKWorkoutTypeIdentifier' as const;

const writePermission = (): HealthPermissionState['writeWorkout'] => {
  const status = authorizationStatusFor(WORKOUT);
  if (status === AuthorizationStatus.sharingAuthorized) return 'granted';
  if (status === AuthorizationStatus.sharingDenied) return 'denied';
  return 'unknown';
};

const permissionState = (): HealthPermissionState => ({
  readSteps: 'unknown',
  readSleep: 'unknown',
  writeWorkout: writePermission(),
});

const activityType = (workout: HealthWorkoutExport): WorkoutActivityType => {
  if (workout.activityType === 'strength') return WorkoutActivityType.traditionalStrengthTraining;
  if (workout.activityType === 'mixed') return WorkoutActivityType.crossTraining;
  return WorkoutActivityType.other;
};

export const appleHealthAdapter: HealthAdapter = {
  async availability() {
    return (await isHealthDataAvailableAsync()) ? 'available' : 'unsupported';
  },
  async getPermissions() {
    if (!(await isHealthDataAvailableAsync())) return { readSteps: 'unknown', readSleep: 'unknown', writeWorkout: 'unknown' };
    return permissionState();
  },
  async requestReadPermission() {
    if (!(await isHealthDataAvailableAsync())) throw new Error('Apple Health is unavailable on this device');
    if (!(await requestAuthorization({ toRead: [STEPS, SLEEP] }))) throw new Error('Apple Health did not complete the read-access request');
    return permissionState();
  },
  async requestWritePermission() {
    if (!(await isHealthDataAvailableAsync())) throw new Error('Apple Health is unavailable on this device');
    if (!(await requestAuthorization({ toShare: [WORKOUT] }))) throw new Error('Apple Health did not complete the workout-access request');
    return permissionState();
  },
  async readDailySummaries(startDate, endDate, timeZone) {
    const dates = dayKeys(startDate, endDate);
    const previousDay = new Date(Date.parse(`${startDate}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    const sleepSamples = await queryCategorySamples(SLEEP, {
      limit: 0,
      filter: { date: { startDate: localMidnight(previousDay, timeZone), endDate: localMidnight(nextDateKey(endDate), timeZone) } },
    });
    const asleep = asleepMinutesByWakeDate(sleepSamples, startDate, endDate, timeZone);
    return Promise.all(dates.map(async (localDate) => {
      const statistics = await queryStatisticsForQuantity(STEPS, ['cumulativeSum'], {
        unit: 'count',
        filter: { date: { startDate: localMidnight(localDate, timeZone), endDate: localMidnight(nextDateKey(localDate), timeZone) } },
      });
      return {
        localDate,
        timeZone,
        steps: statistics.sumQuantity?.quantity ?? null,
        asleepMinutes: asleep.get(localDate) ?? null,
      };
    }));
  },
  async writeWorkout(workout) {
    if (writePermission() !== 'granted') throw new Error('Apple Health workout write access is unavailable');
    const startDate = new Date(workout.startTime);
    const endDate = new Date(workout.endTime);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
      throw new Error('Invalid workout time range');
    }
    await saveWorkoutSample(activityType(workout), [], startDate, endDate, undefined, {
      HKSyncIdentifier: `primerep:${workout.sessionId}`,
      HKSyncVersion: workout.version,
      HKWorkoutBrandName: 'PrimeRep',
      'com.primerep.workout.title': workout.title,
    });
  },
  async openAppSettings() {
    await Linking.openSettings();
  },
};
