export async function reconcileAppleHealthExport(_token: string, _userId: string, _isCurrent: () => boolean = () => true): Promise<void> {}
export async function disableHealthExport(_userId: string): Promise<void> {}
export async function prepareHealthExport(_userId: string): Promise<void> {}
export async function confirmHealthExportOptIn(_userId: string, _connection: import('./types').HealthConnection): Promise<{ server: number; local: number } | null> { return null; }
export function pauseHealthExport(_userId: string): void {}
export function resumeHealthExport(_userId: string): void {}
export async function waitForHealthExportIdle(): Promise<void> {}
export async function requestHealthExportStop(_userId: string, _reason: 'export-off' | 'disconnect', _connectionRevision: number, _exportEnabledAt: string | null): Promise<void> {}
export async function getHealthExportStop(_userId: string): Promise<{ reason: 'export-off' | 'disconnect' } | null> { return null; }
