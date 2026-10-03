type SleepInterval = {
  value: number;
  startDate: Date;
  endDate: Date;
};

const dateFormatter = (timeZone: string) => new Intl.DateTimeFormat('en-US', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const dateParts = (value: Date, timeZone: string) => {
  const parts = dateFormatter(timeZone).formatToParts(value);
  const number = (part: string) => Number(parts.find((item) => item.type === part)?.value);
  return { year: number('year'), month: number('month'), day: number('day'), hour: number('hour'), minute: number('minute'), second: number('second') };
};

export const localDateKey = (value: Date, timeZone: string): string => {
  const { year, month, day } = dateParts(value, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const dayKeys = (startDate: string, endDate: string): string[] => {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error('Invalid health summary date range');
  const days: string[] = [];
  for (let time = start; time <= end; time += 86_400_000) days.push(new Date(time).toISOString().slice(0, 10));
  return days;
};

export const nextDateKey = (dateKey: string): string => {
  const time = Date.parse(`${dateKey}T00:00:00Z`);
  return new Date(time + 86_400_000).toISOString().slice(0, 10);
};

export const localMidnight = (dateKey: string, timeZone: string): Date => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  let time = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = dateParts(new Date(time), timeZone);
    const displayed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    time += target - displayed;
  }
  return new Date(time);
};

export const asleepMinutesByWakeDate = (samples: readonly SleepInterval[], startDate: string, endDate: string, timeZone: string): Map<string, number> => {
  const intervals = samples
    .filter((sample) => [1, 3, 4, 5].includes(sample.value))
    .map((sample): [number, number] => [sample.startDate.getTime(), sample.endDate.getTime()])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((a, b) => a[0] - b[0]);
  const totals = new Map<string, number>();
  if (!intervals.length) return totals;
  let clusterEnd = intervals[0][1];
  let unionEnd = intervals[0][1];
  let unionStart = intervals[0][0];
  let clusterMillis = 0;
  const finishCluster = () => {
    const wakeDate = localDateKey(new Date(clusterEnd), timeZone);
    if (wakeDate >= startDate && wakeDate <= endDate) {
      totals.set(wakeDate, (totals.get(wakeDate) ?? 0) + Math.round((clusterMillis + unionEnd - unionStart) / 60_000));
    }
  };
  for (const [start, end] of intervals.slice(1)) {
    if (start > clusterEnd + 4 * 3_600_000) {
      finishCluster();
      clusterEnd = end;
      unionStart = start;
      unionEnd = end;
      clusterMillis = 0;
      continue;
    }
    clusterEnd = Math.max(clusterEnd, end);
    if (start > unionEnd) {
      clusterMillis += unionEnd - unionStart;
      unionStart = start;
      unionEnd = end;
    } else unionEnd = Math.max(unionEnd, end);
  }
  finishCluster();
  return totals;
};
