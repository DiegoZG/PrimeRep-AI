import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function load(relative, mocks) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require: (name) => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import ${name}`);
    },
  }, { filename });
  return module.exports;
}

test('deleting an account removes only its local Health export rows', async () => {
  const connections = new Set(['deleted-user', 'other-user']);
  const workouts = new Map([
    ['deleted-user', new Set(['session-1', 'session-2'])],
    ['other-user', new Set(['session-3'])],
  ]);
  const statements = [];
  const db = {
    execAsync: async () => {},
    withTransactionAsync: async (callback) => callback(),
    runAsync: async (statement, [userId]) => {
      statements.push([statement, userId]);
      if (statement.startsWith('DELETE FROM exported_workouts')) workouts.delete(userId);
      if (statement.startsWith('DELETE FROM export_connections')) connections.delete(userId);
    },
  };
  const ledger = load('utils/healthExportLedger.native.ts', {
    'expo-sqlite': { openDatabaseAsync: async () => db },
  });

  await ledger.clearHealthExportAccount('deleted-user');

  assert.equal(connections.has('deleted-user'), false);
  assert.equal(workouts.has('deleted-user'), false);
  assert.equal(connections.has('other-user'), true);
  assert.deepEqual([...workouts.get('other-user')], ['session-3']);
  assert.equal(statements.length, 2);
  assert.equal(statements.every(([, userId]) => userId === 'deleted-user'), true);
});
