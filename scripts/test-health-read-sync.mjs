import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function load(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const require = (name) => name in mocks ? mocks[name] : fallback(name);
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require, console }, { filename });
  return module.exports;
}

test('empty HealthKit reads preserve previously uploaded summaries', async () => {
  const aggregation = load('services/health/aggregation.ts');
  const connection = { source: 'apple_health', connectionRevision: 7, readEnabled: true };
  const now = new Date('2026-10-01T12:00:00Z');
  for (const summaries of [[], [{ localDate: '2026-10-01', timeZone: 'UTC', steps: null, asleepMinutes: null }]]) {
    let uploads = 0;
    const adapter = { availability: async () => 'available', readDailySummaries: async () => summaries };
    const { syncAppleHealthRead } = load('services/health/readSync.ts', {
      './appleHealthAdapter': { appleHealthAdapter: adapter },
      './aggregation': aggregation,
      '@/services/healthService': { uploadHealthDays: async () => { uploads += 1; } },
    });
    assert.equal(await syncAppleHealthRead('user-token', connection, () => true, now), false);
    assert.equal(uploads, 0);
  }
});
